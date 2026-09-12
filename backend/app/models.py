from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    profile = relationship("Profile", back_populates="user", uselist=False)
    trips = relationship("Trip", back_populates="user")
    badge_unlocks = relationship("BadgeUnlock", back_populates="user")


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)

    home_name = Column(String(255), nullable=False)
    home_city = Column(String(100), nullable=False)
    family_travelers = Column(JSON, default=list, nullable=False)
    child = Column(JSON, default=dict, nullable=False)
    prefs = Column(JSON, default=dict, nullable=False)

    user = relationship("User", back_populates="profile")


class Plan(Base):
    __tablename__ = "plans"

    id = Column(String(64), primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    date = Column(String(64), nullable=False)
    type = Column(String(16), nullable=False)
    theme = Column(String(32), nullable=False)
    emoji = Column(String(16), nullable=False)
    location = Column(String(255), nullable=False)
    archived = Column(Boolean, default=False, nullable=False)
    mom = Column(Boolean, default=False, nullable=False)

    goal = Column(Text, nullable=False)
    tips = Column(JSON, default=list, nullable=False)
    itinerary = Column(JSON, default=list, nullable=False)
    day_names = Column(JSON, default=list, nullable=False)
    drive = Column(JSON, default=dict, nullable=False)
    hike = Column(JSON, default=dict, nullable=False)
    gear = Column(JSON, default=dict, nullable=False)
    safety = Column(JSON, default=list, nullable=False)
    review = Column(JSON, default=list, nullable=False)
    badge = Column(JSON, default=dict, nullable=True)
    tasks = Column(JSON, default=list, nullable=False)

    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    trips = relationship("Trip", back_populates="plan")
    route = relationship("Route", back_populates="plan", uselist=False)


class Trip(Base):
    __tablename__ = "trips"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    plan_id = Column(String(64), ForeignKey("plans.id", ondelete="CASCADE"), nullable=False, index=True)

    snapshot = Column(JSON, default=dict, nullable=False)
    overrides = Column(JSON, default=dict, nullable=False)
    status = Column(String(16), default="planned", nullable=False)
    planned_date = Column(String(64), nullable=True)

    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    user = relationship("User", back_populates="trips")
    plan = relationship("Plan", back_populates="trips")
    gear_states = relationship("GearState", back_populates="trip", cascade="all, delete-orphan")
    task_states = relationship("TaskState", back_populates="trip", cascade="all, delete-orphan")
    checkins = relationship("Checkin", back_populates="trip", cascade="all, delete-orphan")


class Route(Base):
    __tablename__ = "routes"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(String(64), ForeignKey("plans.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)

    source = Column(String(32), nullable=False)
    generated_at = Column(DateTime(timezone=True), nullable=True)
    drive = Column(JSON, default=dict, nullable=False)
    hike = Column(JSON, default=dict, nullable=False)

    plan = relationship("Plan", back_populates="route")


class Network(Base):
    __tablename__ = "networks"

    id = Column(Integer, primary_key=True, index=True)
    region = Column(String(64), unique=True, nullable=False)
    bbox = Column(JSON, default=list, nullable=False)
    ways = Column(JSON, default=list, nullable=False)


class Milestone(Base):
    __tablename__ = "milestones"

    id = Column(String(64), primary_key=True, index=True)
    icon = Column(String(16), nullable=False)
    name = Column(String(255), nullable=False)
    rule = Column(JSON, default=dict, nullable=False)


class GearState(Base):
    __tablename__ = "gear_states"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), nullable=False, index=True)
    item_idx = Column(Integer, nullable=False)
    checked = Column(Boolean, default=False, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    trip = relationship("Trip", back_populates="gear_states")

    __table_args__ = (UniqueConstraint("trip_id", "item_idx", name="uix_gear_trip_idx"),)


class TaskState(Base):
    __tablename__ = "task_states"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), nullable=False, index=True)
    task_idx = Column(Integer, nullable=False)
    checked = Column(Boolean, default=False, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    trip = relationship("Trip", back_populates="task_states")

    __table_args__ = (UniqueConstraint("trip_id", "task_idx", name="uix_task_trip_idx"),)


class Checkin(Base):
    __tablename__ = "checkins"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), nullable=False, index=True)
    checked_in_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    trip = relationship("Trip", back_populates="checkins")


class BadgeUnlock(Base):
    __tablename__ = "badge_unlocks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    badge_id = Column(String(64), nullable=False)
    unlocked_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    user = relationship("User", back_populates="badge_unlocks")

    __table_args__ = (UniqueConstraint("user_id", "badge_id", name="uix_badge_user_badge"),)
