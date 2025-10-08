from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import Optional, List, Literal
from datetime import datetime, date, time
import uuid

# ============= USER MODELS =============
class UserBase(BaseModel):
    username: str
    email: EmailStr
    phone: str
    full_name: str
    role: Literal["patient", "doctor"]

class UserCreate(UserBase):
    password: str

class User(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

# ============= DOCTOR MODELS =============
class DoctorProfileCreate(BaseModel):
    specialty: str
    experience_years: int
    description: str
    consultation_fee: float

class DoctorProfile(DoctorProfileCreate):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    rating: float = 0.0
    created_at: datetime = Field(default_factory=datetime.utcnow)

class DoctorWithUser(BaseModel):
    id: str
    user_id: str
    full_name: str
    specialty: str
    experience_years: int
    description: str
    consultation_fee: float
    rating: float
    email: str
    phone: str

# ============= DOCTOR SCHEDULE MODELS =============
class TimeSlot(BaseModel):
    start_time: str  # Format: "HH:MM"
    end_time: str    # Format: "HH:MM"
    is_available: bool = True

class DoctorScheduleCreate(BaseModel):
    date: str  # Format: "YYYY-MM-DD"
    time_slots: List[TimeSlot]

class DoctorSchedule(DoctorScheduleCreate):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    doctor_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

# ============= APPOINTMENT MODELS =============
class AppointmentCreate(BaseModel):
    doctor_id: str
    appointment_date: str  # Format: "YYYY-MM-DD"
    appointment_time: str  # Format: "HH:MM"
    reason: str
    notes: Optional[str] = None

class AppointmentUpdate(BaseModel):
    status: Literal["pending", "confirmed", "completed", "cancelled"]
    doctor_notes: Optional[str] = None

class Appointment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    patient_id: str
    doctor_id: str
    appointment_date: str
    appointment_time: str
    reason: str
    notes: Optional[str] = None
    status: Literal["pending", "confirmed", "completed", "cancelled"] = "pending"
    doctor_notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class AppointmentWithDetails(Appointment):
    patient_name: str
    patient_phone: str
    patient_email: str
    doctor_name: str
    doctor_specialty: str
    doctor_phone: str
