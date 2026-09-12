from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Plan, User
from app.schemas import PlanOut

router = APIRouter(prefix="/api/plans", tags=["plans"])


@router.get("", response_model=list[PlanOut])
def list_plans(
    skip: int = 0,
    limit: int = 100,
    archived: bool | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Plan)
    if archived is not None:
        query = query.filter(Plan.archived == archived)
    return query.offset(skip).limit(limit).all()


@router.get("/{plan_id}", response_model=PlanOut)
def get_plan(plan_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    return plan
