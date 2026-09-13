from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Plan, Trip, User
from app.schemas import TripCreate, TripDetailOut, TripOut, TripUpdate

router = APIRouter(prefix="/api/trips", tags=["trips"])


def merge_snapshot_overrides(trip: Trip) -> dict[str, Any]:
    content = dict(trip.snapshot)
    overrides = trip.overrides or {}
    # Simple top-level merge; nested merging can be added later.
    content.update(overrides)
    return content


@router.get("", response_model=list[TripOut])
def list_trips(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(Trip).filter(Trip.user_id == current_user.id).order_by(Trip.id).offset(skip).limit(limit).all()


@router.post("", response_model=TripDetailOut, status_code=201)
def create_trip(
    payload: TripCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan = db.query(Plan).filter(Plan.id == payload.plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    snapshot = snapshot_plan(plan)
    trip = Trip(
        user_id=current_user.id,
        plan_id=plan.id,
        snapshot=snapshot,
        overrides=payload.overrides,
        planned_date=payload.planned_date,
    )
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return {**TripOut.model_validate(trip).model_dump(), "content": merge_snapshot_overrides(trip)}


@router.get("/{trip_id}", response_model=TripDetailOut)
def get_trip(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    trip = db.query(Trip).filter(Trip.id == trip_id, Trip.user_id == current_user.id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return {**TripOut.model_validate(trip).model_dump(), "content": merge_snapshot_overrides(trip)}


@router.put("/{trip_id}", response_model=TripDetailOut)
def update_trip(
    trip_id: int,
    payload: TripUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    trip = db.query(Trip).filter(Trip.id == trip_id, Trip.user_id == current_user.id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    if payload.overrides is not None:
        trip.overrides = payload.overrides
    if payload.planned_date is not None:
        trip.planned_date = payload.planned_date
    if payload.status is not None:
        trip.status = payload.status

    db.commit()
    db.refresh(trip)
    return {**TripOut.model_validate(trip).model_dump(), "content": merge_snapshot_overrides(trip)}


@router.delete("/{trip_id}", status_code=204)
def delete_trip(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    trip = db.query(Trip).filter(Trip.id == trip_id, Trip.user_id == current_user.id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    db.delete(trip)
    db.commit()
    return None


def snapshot_plan(plan: Plan) -> dict[str, Any]:
    return {
        "id": plan.id,
        "title": plan.title,
        "date": plan.date,
        "type": plan.type,
        "theme": plan.theme,
        "emoji": plan.emoji,
        "location": plan.location,
        "mom": plan.mom,
        "goal": plan.goal,
        "tips": plan.tips,
        "itinerary": plan.itinerary,
        "day_names": plan.day_names,
        "drive": plan.drive,
        "hike": plan.hike,
        "gear": plan.gear,
        "safety": plan.safety,
        "review": plan.review,
        "badge": plan.badge,
        "tasks": plan.tasks,
    }
