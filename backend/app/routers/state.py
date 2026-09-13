from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import BadgeUnlock, Checkin, GearState, TaskState, Trip, User, Milestone
from app.schemas import (
    BadgeUnlockOut,
    CheckinOut,
    GearItemState,
    GearStateBatch,
    TaskItemState,
    TaskStateBatch,
)

router = APIRouter(prefix="/api/trips/{trip_id}", tags=["state"])


def _get_trip(trip_id: int, user: User, db: Session) -> Trip:
    trip = db.query(Trip).filter(Trip.id == trip_id, Trip.user_id == user.id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip


# ---------- Gear ----------

@router.get("/gear", response_model=list[GearItemState])
def get_gear(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_trip(trip_id, current_user, db)
    states = db.query(GearState).filter(GearState.trip_id == trip_id).all()
    return [GearItemState(item_idx=s.item_idx, checked=s.checked) for s in states]


@router.put("/gear", response_model=list[GearItemState])
def update_gear(
    trip_id: int,
    payload: GearStateBatch,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_trip(trip_id, current_user, db)
    now = datetime.now(timezone.utc)
    for item in payload.items:
        state = db.query(GearState).filter(
            GearState.trip_id == trip_id, GearState.item_idx == item.item_idx
        ).first()
        if state:
            state.checked = item.checked
            state.updated_at = now
        else:
            state = GearState(trip_id=trip_id, item_idx=item.item_idx, checked=item.checked)
            db.add(state)
    db.commit()
    return get_gear(trip_id, current_user, db)


# ---------- Tasks ----------

@router.get("/tasks", response_model=list[TaskItemState])
def get_tasks(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_trip(trip_id, current_user, db)
    states = db.query(TaskState).filter(TaskState.trip_id == trip_id).all()
    return [TaskItemState(task_idx=s.task_idx, checked=s.checked) for s in states]


@router.put("/tasks", response_model=list[TaskItemState])
def update_tasks(
    trip_id: int,
    payload: TaskStateBatch,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_trip(trip_id, current_user, db)
    now = datetime.now(timezone.utc)
    for item in payload.items:
        state = db.query(TaskState).filter(
            TaskState.trip_id == trip_id, TaskState.task_idx == item.task_idx
        ).first()
        if state:
            state.checked = item.checked
            state.updated_at = now
        else:
            state = TaskState(trip_id=trip_id, task_idx=item.task_idx, checked=item.checked)
            db.add(state)
    db.commit()
    return get_tasks(trip_id, current_user, db)


# ---------- Checkin ----------

@router.post("/checkin", response_model=CheckinOut, status_code=201)
def checkin(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    trip = _get_trip(trip_id, current_user, db)
    checkin = db.query(Checkin).filter(Checkin.trip_id == trip_id).first()
    if not checkin:
        checkin = Checkin(trip_id=trip_id)
        db.add(checkin)
    trip.status = "done"
    db.flush()
    award_badges(current_user.id, db)
    db.commit()
    db.refresh(checkin)
    return checkin


# ---------- Badges ----------

@router.post("/badges/{badge_id}", response_model=BadgeUnlockOut, status_code=201)
def unlock_badge(
    trip_id: int,
    badge_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_trip(trip_id, current_user, db)
    existing = db.query(BadgeUnlock).filter(
        BadgeUnlock.user_id == current_user.id, BadgeUnlock.badge_id == badge_id
    ).first()
    if existing:
        return existing
    unlock = BadgeUnlock(user_id=current_user.id, badge_id=badge_id)
    db.add(unlock)
    db.commit()
    db.refresh(unlock)
    return unlock


def award_badges(user_id: int, db: Session) -> None:
    """Same plan/milestone rules as the retired site; persist awards atomically."""
    done = {}
    for trip in db.query(Trip).filter(Trip.user_id == user_id, Trip.status == "done").all():
        done[trip.plan_id] = {**trip.snapshot, **(trip.overrides or {})}
    awards = {pid for pid, content in done.items() if content.get("badge")}
    for milestone in db.query(Milestone).all():
        rule = milestone.rule
        matched = False
        if rule.get("firstType"):
            matched = any(str(p.get("type", "")).startswith(rule["firstType"]) for p in done.values())
        if rule.get("count"):
            matched = len(done) >= rule["count"]
        if rule.get("minKm"):
            matched = any((p.get("drive", {}).get("km") or 0) >= rule["minKm"] for p in done.values())
        if matched:
            awards.add(milestone.id)
    existing = {b.badge_id for b in db.query(BadgeUnlock).filter(BadgeUnlock.user_id == user_id).all()}
    for badge_id in awards - existing:
        db.add(BadgeUnlock(user_id=user_id, badge_id=badge_id))
