import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine, text

from app.config import Settings
import app.readiness as probes


def production(**values):
    return Settings(_env_file=None, app_env="production",
                    database_url=values.pop("database_url", "postgresql://test:test@db/test"),
                    secret_key=values.pop("secret_key", "x" * 40), **values)


@pytest.mark.parametrize("values", [
    {"secret_key": "change-me-in-production"},
    {"database_url": "sqlite:///local.db"},
    {"debug": True},
])
def test_production_rejects_unsafe_defaults(values):
    with pytest.raises(ValidationError):
        production(**values)


def test_secret_file_and_ambiguous_sources(tmp_path, monkeypatch):
    monkeypatch.delenv("SECRET_KEY", raising=False)
    filename = tmp_path / "key"
    filename.write_text("x" * 40, encoding="utf-8")
    assert Settings(_env_file=None, secret_key_file=str(filename)).secret_key == "x" * 40
    with pytest.raises(ValidationError, match="either"):
        Settings(_env_file=None, secret_key="other", secret_key_file=str(filename))


def test_ready_requires_actual_migration_head(monkeypatch):
    engine = create_engine("sqlite://")
    monkeypatch.setattr(probes, "engine", engine)
    with pytest.raises(HTTPException) as missing:
        probes.readiness()
    assert missing.value.status_code == 503
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(64))"))
        connection.execute(text("INSERT INTO alembic_version VALUES ('outdated')"))
    with pytest.raises(HTTPException) as outdated:
        probes.readiness()
    assert outdated.value.status_code == 503
    with engine.begin() as connection:
        connection.execute(text("DELETE FROM alembic_version"))
        for head in probes.EXPECTED_HEADS:
            connection.execute(text("INSERT INTO alembic_version VALUES (:head)"), {"head": head})
    assert probes.readiness() == {"status": "ready"}
    engine.dispose()


def test_ready_hides_database_error(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path}/missing-parent/private.db")
    monkeypatch.setattr(probes, "engine", engine)
    with pytest.raises(HTTPException) as error:
        probes.readiness()
    assert error.value.status_code == 503
    assert error.value.detail == "Database unavailable"
    engine.dispose()
