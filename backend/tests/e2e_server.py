import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
with tempfile.TemporaryDirectory(prefix="outdoor-e2e-") as directory:
    os.environ["DATABASE_URL"] = "sqlite:///" + str(Path(directory) / "test.db").replace("\\", "/")
    os.environ["SECRET_KEY"] = "isolated-browser-tests"
    from app.database import Base, engine, SessionLocal
    from app.seed import dump_data, seed_plans, seed_milestones, seed_network
    from app.main import app
    import uvicorn
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        data = dump_data()
        seed_plans(db, data["plans"], data["routes"])
        seed_milestones(db, data["milestones"])
        seed_network(db, data["network"])
    uvicorn.run(app, host="127.0.0.1", port=8015)
