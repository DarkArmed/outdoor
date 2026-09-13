import json
import os
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from app.auth import get_password_hash
from app.database import Base, SessionLocal, engine
from app.models import (
    BadgeUnlock,
    Checkin,
    GearState,
    Milestone,
    Network,
    Plan,
    Profile,
    Route,
    TaskState,
    Trip,
    User,
)

ROOT = Path(__file__).resolve().parents[2]
CONFIG_PATH = ROOT / "config" / "profile.json"


def dump_data() -> dict[str, Any]:
    script = ROOT / "tools" / "dump-data.js"
    result = subprocess.run(
        ["node", str(script)],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=True,
    )
    return json.loads(result.stdout)


def load_profile() -> dict[str, Any] | None:
    if not CONFIG_PATH.exists():
        return None
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))


def seed_plans(db: Session, plans: list[dict], routes: dict) -> None:
    existing_ids = {p.id for p in db.query(Plan.id).all()}
    for p in plans:
        if p["id"] in existing_ids:
            continue
        plan = Plan(
            id=p["id"],
            title=p["title"],
            date=p.get("date", ""),
            type=p.get("type", ""),
            theme=p.get("theme", "hike"),
            emoji=p.get("emoji", ""),
            location=p.get("location", ""),
            archived=bool(p.get("archived")),
            mom=bool(p.get("mom")),
            goal=p.get("goal", ""),
            tips=p.get("tips", []),
            itinerary=p.get("itinerary", []),
            day_names=p.get("dayNames", []),
            drive=p.get("drive", {}),
            hike=(p.get("hike") or {}),
            gear=p.get("gear", {}),
            safety=p.get("safety", []),
            review=p.get("review", []),
            badge=p.get("badge"),
            tasks=p.get("tasks", []),
        )
        db.add(plan)
        db.flush()

        route_data = routes.get(p["id"])
        if route_data:
            generated_at = route_data.get("generatedAt")
            if generated_at:
                generated_at = datetime.fromisoformat(generated_at)
            route = Route(
                plan_id=plan.id,
                source=route_data.get("source", ""),
                generated_at=generated_at,
                drive=route_data.get("drive", {}),
                hike=(route_data.get("hike") or {}),
            )
            db.add(route)
    db.commit()


def seed_milestones(db: Session, milestones: list[dict]) -> None:
    existing_ids = {m.id for m in db.query(Milestone.id).all()}
    for m in milestones:
        if m["id"] in existing_ids:
            continue
        db.add(Milestone(id=m["id"], icon=m["icon"], name=m["name"], rule=m.get("rule", {})))
    db.commit()


def seed_network(db: Session, network: dict | None) -> None:
    if not network:
        return
    existing = db.query(Network).filter(Network.region == "beijing").first()
    if existing:
        return
    db.add(
        Network(
            region="beijing",
            bbox=network.get("bbox", []),
            ways=network.get("ways", []),
        )
    )
    db.commit()


def seed_default_user(db: Session, profile_data: dict | None) -> User | None:
    default_email = "default@outdoor.local"
    user = db.query(User).filter(User.email == default_email).first()
    if user:
        return user

    user = User(
        email=default_email,
        hashed_password=get_password_hash("outdoor"),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    if profile_data:
        home = profile_data.get("home", {})
        family = profile_data.get("family", {})
        child = profile_data.get("child", {})
        prefs = profile_data.get("prefs", {})
        profile = Profile(
            user_id=user.id,
            home_name=home.get("name", ""),
            home_city=home.get("city", ""),
            family_travelers=family.get("travelers", []),
            child=child,
            prefs=prefs,
        )
        db.add(profile)
        db.commit()

    return user


def seed_default_trips(db: Session, user: User, plans: list[dict]) -> None:
    existing = db.query(Trip).filter(Trip.user_id == user.id).count()
    if existing:
        return

    for p in plans:
        if p.get("archived"):
            continue
        snapshot = {
            "id": p["id"],
            "title": p["title"],
            "date": p.get("date", ""),
            "type": p.get("type", ""),
            "theme": p.get("theme", "hike"),
            "emoji": p.get("emoji", ""),
            "location": p.get("location", ""),
            "mom": bool(p.get("mom")),
            "goal": p.get("goal", ""),
            "tips": p.get("tips", []),
            "itinerary": p.get("itinerary", []),
            "day_names": p.get("dayNames", []),
            "drive": p.get("drive", {}),
            "hike": (p.get("hike") or {}),
            "gear": p.get("gear", {}),
            "safety": p.get("safety", []),
            "review": p.get("review", []),
            "badge": p.get("badge"),
            "tasks": p.get("tasks", []),
        }
        trip = Trip(
            user_id=user.id,
            plan_id=p["id"],
            snapshot=snapshot,
            overrides={},
            status="planned",
            planned_date=p.get("date", ""),
        )
        db.add(trip)
    db.commit()


def seed_all() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        data = dump_data()
        profile_data = load_profile()

        seed_plans(db, data["plans"], data.get("routes", {}))
        seed_milestones(db, data.get("milestones", []))
        seed_network(db, data.get("network"))
        user = seed_default_user(db, profile_data)
        if user:
            seed_default_trips(db, user, data["plans"])
        print("Seed completed.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_all()
