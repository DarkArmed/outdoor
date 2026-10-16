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
    from app.auth import get_password_hash
    from app.models import User
    from app.main import app
    import uvicorn
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        data = dump_data()
        seed_plans(db, data["plans"], data["routes"])
        seed_milestones(db, data["milestones"])
        seed_network(db, data["network"])
        # 后台 e2e 登录用管理员账号（密码风格同 web/e2e 测试账号）
        db.add(User(
            email="admin@example.com",
            hashed_password=get_password_hash("test-secret-123"),
            is_admin=True,
        ))
        db.commit()
    uvicorn.run(app, host="127.0.0.1", port=8015)
