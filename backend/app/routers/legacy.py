import hashlib
import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import BadgeUnlock, Checkin, GearState, LegacyImport, Milestone, Plan, TaskState, Trip, User
from app.routers.state import award_badges
from app.routers.trips import snapshot_plan

router = APIRouter(prefix="/api/legacy", tags=["legacy"])


class LegacyItem(BaseModel):
    plan_id: str
    gear: dict[int, bool] = Field(default_factory=dict)
    tasks: dict[int, bool] = Field(default_factory=dict)
    done: bool = False


class LegacyPayload(BaseModel):
    plans: list[LegacyItem] = Field(max_length=500)
    badges: list[str] = Field(default_factory=list, max_length=500)


@router.post("/import")
def import_legacy(payload: LegacyPayload, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    import_id = hashlib.sha256(json.dumps(payload.model_dump(), sort_keys=True).encode()).hexdigest()
    previous = db.get(LegacyImport, (user.id, import_id))
    if previous:
        return previous.result
    if len({item.plan_id for item in payload.plans}) != len(payload.plans):
        raise HTTPException(422, "Duplicate plan in import")
    plans = {p.id: p for p in db.query(Plan).all()}
    known_badges = set(plans) | {m.id for m in db.query(Milestone).all()}
    if any(item.plan_id not in plans for item in payload.plans) or any(b not in known_badges for b in payload.badges):
        raise HTTPException(422, "Unknown plan or badge; original data was not imported")
    for item in payload.plans:
        plan = plans[item.plan_id]
        gear_count = len(plan.gear.get("base", [])) + len(plan.gear.get("special", []))
        if any(i < 0 or i >= gear_count for i in item.gear) or any(i < 0 or i >= len(plan.tasks) for i in item.tasks):
            raise HTTPException(422, "Checklist indices do not match the current plan")
    imported = []
    for item in payload.plans:
        plan = plans[item.plan_id]
        trip = db.query(Trip).filter(Trip.user_id == user.id, Trip.plan_id == plan.id).order_by(Trip.id).first()
        if not trip:
            trip = Trip(user_id=user.id, plan_id=plan.id, snapshot=snapshot_plan(plan), overrides={}, planned_date=plan.id[:10])
            db.add(trip)
            db.flush()
        for model, field, values in [(GearState, "item_idx", item.gear), (TaskState, "task_idx", item.tasks)]:
            for index, checked in values.items():
                if not db.query(model).filter(model.trip_id == trip.id, getattr(model, field) == index).first():
                    db.add(model(trip_id=trip.id, **{field: index}, checked=checked))
        if item.done:
            trip.status = "done"
            if not db.query(Checkin).filter(Checkin.trip_id == trip.id).first():
                db.add(Checkin(trip_id=trip.id))
        imported.append(trip.id)
    existing = {b.badge_id for b in db.query(BadgeUnlock).filter(BadgeUnlock.user_id == user.id).all()}
    for badge_id in set(payload.badges) - existing:
        db.add(BadgeUnlock(user_id=user.id, badge_id=badge_id))
    db.flush()
    award_badges(user.id, db)
    result = {"import_id": import_id, "trip_ids": imported}
    db.add(LegacyImport(user_id=user.id, import_id=import_id, result=result))
    db.commit()
    return result
