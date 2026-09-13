from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Network, Route, Trip, User
from app.schemas import NetworkOut, RouteOut

router = APIRouter(prefix="/api", tags=["routes"])


@router.get("/routes", response_model=list[RouteOut])
def list_routes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(Route).all()


@router.get("/trips/{trip_id}/route", response_model=RouteOut)
def get_trip_route(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    trip = db.query(Trip).filter(Trip.id == trip_id, Trip.user_id == current_user.id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    route = db.query(Route).filter(Route.plan_id == trip.plan_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    return route


@router.get("/network", response_model=NetworkOut)
def get_network(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    network = db.query(Network).first()
    if not network:
        raise HTTPException(status_code=404, detail="Network not found")
    return network
