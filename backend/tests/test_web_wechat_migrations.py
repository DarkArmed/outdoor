from datetime import datetime
from pathlib import Path
from types import SimpleNamespace

import pytest
import sqlalchemy as sa
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy.exc import IntegrityError

INITIAL = "20260912_initial"
WEB_HEAD = "20260913_legacy"
WECHAT_HEAD = "20261001_wechat_login"
MERGED_HEAD = "20261003_merge_web_wechat"
RECEIPT = {"import_id": "existing-import", "trip_ids": [17, 23]}


@pytest.fixture
def migration_db(tmp_path, monkeypatch):
    # Exercise the real Alembic env/revisions without using the developer DB.
    url = f"sqlite:///{(tmp_path / 'migration.db').as_posix()}"
    monkeypatch.setattr(
        "app.config.get_settings", lambda: SimpleNamespace(database_url=url)
    )
    config = Config()
    config.set_main_option(
        "script_location", str(Path(__file__).resolve().parents[1] / "alembic")
    )
    engine = sa.create_engine(url)
    yield config, engine
    engine.dispose()


def table(engine, name):
    return sa.Table(name, sa.MetaData(), autoload_with=engine)


def rows(engine, name):
    with engine.connect() as connection:
        return [dict(row) for row in connection.execute(sa.select(table(engine, name))).mappings()]


def versions(engine):
    return {row["version_num"] for row in rows(engine, "alembic_version")}


def assert_merged_schema(engine):
    inspector = sa.inspect(engine)
    assert {"users", "trips", "profiles", "legacy_imports"} <= set(inspector.get_table_names())
    columns = {column["name"]: column for column in inspector.get_columns("users")}
    assert columns["wechat_openid"]["nullable"] is True
    assert columns["nickname"]["nullable"] is True
    unique_columns = {
        tuple(constraint["column_names"])
        for constraint in inspector.get_unique_constraints("users")
    }
    assert ("email",) in unique_columns
    assert ("wechat_openid",) in unique_columns
    assert versions(engine) == {MERGED_HEAD}


def test_one_head_preserves_both_published_revision_parents(migration_db):
    config, _ = migration_db
    scripts = ScriptDirectory.from_config(config)
    assert scripts.get_heads() == [MERGED_HEAD]
    assert set(scripts.get_revision(MERGED_HEAD).down_revision) == {WEB_HEAD, WECHAT_HEAD}
    assert scripts.get_revision(WEB_HEAD).down_revision == INITIAL
    assert scripts.get_revision(WECHAT_HEAD).down_revision == INITIAL


def test_fresh_database_upgrade_downgrade_and_upgrade_again(migration_db):
    config, engine = migration_db
    command.upgrade(config, "head")
    assert_merged_schema(engine)

    command.downgrade(config, "base")
    assert sa.inspect(engine).get_table_names() == ["alembic_version"]
    assert versions(engine) == set()

    command.upgrade(config, "head")
    assert_merged_schema(engine)


@pytest.mark.parametrize("starting_head", [WEB_HEAD, WECHAT_HEAD])
def test_existing_branch_database_upgrades_without_losing_data(migration_db, starting_head):
    config, engine = migration_db
    command.upgrade(config, starting_head)
    original_user = {
        "id": 41,
        "email": "existing@example.com",
        "hashed_password": "existing-password-hash",
        "is_active": True,
        "created_at": datetime(2026, 9, 1, 12, 30),
    }
    if starting_head == WECHAT_HEAD:
        original_user.update(wechat_openid="existing-openid", nickname="原微信用户")
    original_profile = {
        "id": 11,
        "user_id": 41,
        "home_name": "家",
        "home_city": "测试城市",
        "family_travelers": ["爸爸", "孩子"],
        "child": {"name": "测试孩子", "birthYear": 2019},
        "prefs": {"availableDays": ["周六"]},
    }
    receipt = {"user_id": 41, "import_id": "existing-import", "result": RECEIPT}
    with engine.begin() as connection:
        connection.execute(table(engine, "users").insert(), original_user)
        connection.execute(table(engine, "profiles").insert(), original_profile)
        if starting_head == WEB_HEAD:
            connection.execute(table(engine, "legacy_imports").insert(), receipt)

    command.upgrade(config, "head")
    assert_merged_schema(engine)
    expected_user = {"wechat_openid": None, "nickname": None, **original_user}
    assert rows(engine, "users") == [expected_user]
    assert rows(engine, "profiles") == [original_profile]
    assert rows(engine, "legacy_imports") == ([receipt] if starting_head == WEB_HEAD else [])

    # Both formerly independent features are usable after either upgrade path.
    with engine.begin() as connection:
        if starting_head == WEB_HEAD:
            users = table(engine, "users")
            connection.execute(
                users.update().where(users.c.id == 41).values(
                    wechat_openid="newly-linked-openid", nickname="新昵称"
                )
            )
        else:
            connection.execute(table(engine, "legacy_imports").insert(), receipt)
    merged_user = rows(engine, "users")[0]
    with pytest.raises(IntegrityError):
        with engine.begin() as connection:
            connection.execute(
                table(engine, "users").insert(),
                {**merged_user, "id": 42, "email": "different@example.com"},
            )

    # Name a parent explicitly: "-1" is ambiguous at an Alembic merge point.
    # Removing only the merge splits version markers, not users or receipts.
    command.downgrade(config, WEB_HEAD)
    assert versions(engine) == {WEB_HEAD, WECHAT_HEAD}
    assert rows(engine, "users") == [merged_user]
    assert rows(engine, "legacy_imports") == [receipt]
    command.upgrade(config, "head")
    assert_merged_schema(engine)
    assert rows(engine, "users") == [merged_user]
    assert rows(engine, "profiles") == [original_profile]
    assert rows(engine, "legacy_imports") == [receipt]
