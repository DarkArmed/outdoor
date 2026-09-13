from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import get_settings
from app.database import Base, engine, get_db
from app.models import BadgeUnlock, User
from app.routers import legacy, auth, milestones, plans, profile, routes, state, trips, users
from app.schemas import BadgeUnlockOut, UserOut

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables for dev convenience; Alembic is the source of truth for migrations.
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(legacy.router)
app.include_router(users.router)
app.include_router(profile.router)
app.include_router(plans.router)
app.include_router(trips.router)
app.include_router(routes.router)
app.include_router(milestones.router)
app.include_router(state.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@app.get("/api/me/badges", response_model=list[BadgeUnlockOut])
def my_badges(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(BadgeUnlock).filter(BadgeUnlock.user_id == current_user.id).all()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
