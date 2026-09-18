from datetime import date, time
from typing import Literal

from pydantic import BaseModel, Field


class PlaceTask(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    text: str = Field(min_length=1, max_length=200, pattern=r"\S")
    description: str = Field(default='', max_length=1000)
    done: bool = False


class TaskStatus(BaseModel):
    done: bool


class SectionInput(BaseModel):
    name: str = Field(min_length=1, max_length=40, pattern=r"\S")
    visit_date: date


class PlaceInput(BaseModel):
    section_id: int | None = Field(default=None, ge=1)
    name: str = Field(min_length=1, max_length=120, pattern=r"\S")
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    address: str = Field(default="", max_length=500)
    description: str = Field(default='', max_length=4000)
    tasks: list[PlaceTask] = Field(default_factory=list, max_length=50)
    area: str = Field(default="", max_length=80)
    visit_date: date | None = None
    stay_minutes: int = Field(default=60, ge=0, le=1440)
    required_order: int | None = Field(default=None, ge=1, le=100)
    required_time: str | None = Field(default=None, pattern=r'^(?:[01]\d|2[0-3]):[0-5]\d$')
    google_place_id: str | None = None


class Place(PlaceInput):
    id: int


class PlanInput(BaseModel):
    section_id: int | None = Field(default=None, ge=1)
    force_refresh: bool = False
    visit_date: date
    start_id: int
    end_id: int
    departure_time: time = time(9, 0)
    time_zone: str = Field(default="Asia/Tokyo", max_length=80)
    mode: Literal["WALK", "DRIVE", "TRANSIT"] = "WALK"


class AssignInput(BaseModel):
    section_id: int | None = Field(default=None, ge=1)
    place_ids: list[int] = Field(min_length=1, max_length=100)
    visit_date: date


class MoveDayInput(BaseModel):
    source_date: date
    target_date: date
