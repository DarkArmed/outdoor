import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app
from app.models import Plan, User

SQLITE_URL = "sqlite:///./test.db"

engine = create_engine(SQLITE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="function", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------- Helper functions ----------


def register_user(client, email="test@example.com", password="secret123"):
    r = client.post("/api/auth/register", json={"email": email, "password": password})
    assert r.status_code == 201, r.text
    return r.json()


def login_user(client, email="test@example.com", password="secret123"):
    r = client.post("/api/auth/login", data={"username": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def make_plan(
    db,
    plan_id="2026-09-05_test",
    title="Test Plan",
    theme="hike",
    gear=None,
    badge=None,
):
    plan = Plan(
        id=plan_id,
        title=title,
        date="9/5",
        type="A",
        theme=theme,
        emoji="🥾",
        location="Test Location",
        goal="Have fun",
        safety=["Be safe"],
        review=["How was it?"],
        gear=gear or {"base": ["背包"], "special": []},
        badge=badge,
    )
    db.add(plan)
    db.commit()
    return plan


@pytest.fixture
def user(client):
    register_user(client)
    token = login_user(client)
    return token


@pytest.fixture
def other_user(client):
    register_user(client, email="other@example.com", password="secret123")
    token = login_user(client, email="other@example.com", password="secret123")
    return token
