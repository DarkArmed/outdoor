from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


# ---------- Auth ----------

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


# ---------- Users ----------

class UserOut(BaseModel):
    id: int
    # Stored legacy/seed identities may use reserved local domains.
    # Registration input remains validated by EmailStr.
    email: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------- Profile ----------

class ProfileBase(BaseModel):
    home_name: str
    home_city: str
    family_travelers: list[str] = Field(default_factory=list)
    child: dict[str, Any] = Field(default_factory=dict)
    prefs: dict[str, Any] = Field(default_factory=dict)


class ProfileCreate(ProfileBase):
    pass


class ProfileUpdate(BaseModel):
    home_name: str | None = None
    home_city: str | None = None
    family_travelers: list[str] | None = None
    child: dict[str, Any] | None = None
    prefs: dict[str, Any] | None = None


class ProfileOut(ProfileBase):
    id: int
    user_id: int

    model_config = ConfigDict(from_attributes=True)


# ---------- Plans ----------

class PlanOut(BaseModel):
    id: str
    title: str
    date: str
    type: str
    theme: str
    emoji: str
    location: str
    archived: bool
    mom: bool
    goal: str
    tips: list[str]
    itinerary: list[Any]
    day_names: list[str]
    drive: dict[str, Any]
    hike: dict[str, Any]

    @field_validator("hike", mode="before")
    @classmethod
    def empty_hike(cls, value):
        return {} if value is None else value

    gear: dict[str, list[str]]
    safety: list[str]
    review: list[str]
    badge: dict[str, str] | None
    tasks: list[str]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------- Trips ----------

class TripCreate(BaseModel):
    plan_id: str
    planned_date: str | None = None
    overrides: dict[str, Any] = Field(default_factory=dict)


class TripUpdate(BaseModel):
    planned_date: str | None = None
    overrides: dict[str, Any] | None = None
    status: str | None = None


class TripOut(BaseModel):
    id: int
    user_id: int
    plan_id: str
    snapshot: dict[str, Any]
    overrides: dict[str, Any]
    status: str
    planned_date: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TripDetailOut(TripOut):
    # snapshot merged with overrides for rendering
    content: dict[str, Any]


# ---------- Routes / Network ----------

class RouteOut(BaseModel):
    plan_id: str
    source: str
    generated_at: datetime | None
    drive: dict[str, Any]
    hike: dict[str, Any]

    @field_validator("hike", mode="before")
    @classmethod
    def empty_hike(cls, value):
        return {} if value is None else value


    model_config = ConfigDict(from_attributes=True)


class NetworkOut(BaseModel):
    region: str
    bbox: list[float]
    ways: list[dict[str, Any]]

    model_config = ConfigDict(from_attributes=True)


# ---------- Milestones ----------

class MilestoneOut(BaseModel):
    id: str
    icon: str
    name: str
    rule: dict[str, Any]

    model_config = ConfigDict(from_attributes=True)


# ---------- State ----------

class GearItemState(BaseModel):
    item_idx: int
    checked: bool


class GearStateBatch(BaseModel):
    items: list[GearItemState]


class TaskItemState(BaseModel):
    task_idx: int
    checked: bool


class TaskStateBatch(BaseModel):
    items: list[TaskItemState]


class CheckinOut(BaseModel):
    id: int
    trip_id: int
    checked_in_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BadgeUnlockOut(BaseModel):
    id: int
    user_id: int
    badge_id: str
    unlocked_at: datetime

    model_config = ConfigDict(from_attributes=True)
