"""Check the real database revision against the migrations shipped in the image."""
from pathlib import Path

from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.database import engine

config = Config()
config.set_main_option("script_location", str(Path(__file__).resolve().parents[1] / "alembic"))
EXPECTED_HEADS = set(ScriptDirectory.from_config(config).get_heads())


def readiness():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
            heads = set(MigrationContext.configure(connection).get_current_heads())
        if heads != EXPECTED_HEADS:
            raise HTTPException(status_code=503, detail="Database migration required")
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="Database unavailable") from None
    return {"status": "ready"}
