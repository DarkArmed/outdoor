from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Milestone, User
from app.schemas import MilestoneOut

router = APIRouter(prefix="/api/milestones", tags=["milestones"])


@router.get("", response_model=list[MilestoneOut])
def list_milestones(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(Milestone).all()
