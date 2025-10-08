from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from typing import List, Optional
from datetime import datetime, timedelta

# Import models and auth
from models import (
    User, UserCreate, UserLogin, Token,
    DoctorProfile, DoctorProfileCreate, DoctorWithUser,
    DoctorSchedule, DoctorScheduleCreate, TimeSlot,
    Appointment, AppointmentCreate, AppointmentUpdate, AppointmentWithDetails
)
from auth import (
    get_password_hash, verify_password, create_access_token,
    get_current_user, get_current_doctor, get_current_patient
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ============= HELPER FUNCTIONS =============
def serialize_datetime(obj):
    """Convert datetime objects to ISO string for MongoDB"""
    if isinstance(obj, dict):
        return {k: serialize_datetime(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [serialize_datetime(item) for item in obj]
    elif isinstance(obj, datetime):
        return obj.isoformat()
    return obj

def deserialize_datetime(obj):
    """Convert ISO strings back to datetime objects"""
    if isinstance(obj, dict):
        result = {}
        for k, v in obj.items():
            if k in ['created_at', 'timestamp'] and isinstance(v, str):
                try:
                    result[k] = datetime.fromisoformat(v)
                except:
                    result[k] = v
            else:
                result[k] = deserialize_datetime(v)
        return result
    elif isinstance(obj, list):
        return [deserialize_datetime(item) for item in obj]
    return obj

# ============= AUTH ROUTES =============
@api_router.post("/auth/register", response_model=User)
async def register(user_data: UserCreate):
    # Check if username exists
    existing_user = await db.users.find_one({"username": user_data.username}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Check if email exists
    existing_email = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    # Create user
    user_dict = user_data.model_dump()
    password = user_dict.pop("password")
    user = User(**user_dict)
    
    # Hash password and store
    user_doc = user.model_dump()
    user_doc["password_hash"] = get_password_hash(password)
    user_doc = serialize_datetime(user_doc)
    
    await db.users.insert_one(user_doc)
    return user

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"username": credentials.username}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    user = deserialize_datetime(user)
    user_obj = User(**user)
    
    # Create access token
    access_token = create_access_token(
        data={"sub": user_obj.id, "username": user_obj.username, "role": user_obj.role}
    )
    
    return Token(access_token=access_token, token_type="bearer", user=user_obj)

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user = deserialize_datetime(user)
    return User(**user)

# ============= DOCTOR PROFILE ROUTES =============
@api_router.post("/doctors/profile", response_model=DoctorProfile)
async def create_doctor_profile(
    profile_data: DoctorProfileCreate,
    current_user: dict = Depends(get_current_doctor)
):
    # Check if profile already exists
    existing = await db.doctor_profiles.find_one({"user_id": current_user["sub"]}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Doctor profile already exists")
    
    profile = DoctorProfile(**profile_data.model_dump(), user_id=current_user["sub"])
    profile_doc = serialize_datetime(profile.model_dump())
    
    await db.doctor_profiles.insert_one(profile_doc)
    return profile

@api_router.get("/doctors", response_model=List[DoctorWithUser])
async def get_doctors(specialty: Optional[str] = None):
    # Get all doctor profiles
    query = {}
    if specialty:
        query["specialty"] = specialty
    
    doctor_profiles = await db.doctor_profiles.find(query, {"_id": 0}).to_list(1000)
    
    # Get user info for each doctor
    result = []
    for profile in doctor_profiles:
        user = await db.users.find_one({"id": profile["user_id"]}, {"_id": 0})
        if user:
            doctor_with_user = DoctorWithUser(
                id=profile["id"],
                user_id=profile["user_id"],
                full_name=user["full_name"],
                specialty=profile["specialty"],
                experience_years=profile["experience_years"],
                description=profile["description"],
                consultation_fee=profile["consultation_fee"],
                rating=profile.get("rating", 0.0),
                email=user["email"],
                phone=user["phone"]
            )
            result.append(doctor_with_user)
    
    return result

@api_router.get("/doctors/{doctor_id}", response_model=DoctorWithUser)
async def get_doctor(doctor_id: str):
    profile = await db.doctor_profiles.find_one({"user_id": doctor_id}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    user = await db.users.find_one({"id": profile["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return DoctorWithUser(
        id=profile["id"],
        user_id=profile["user_id"],
        full_name=user["full_name"],
        specialty=profile["specialty"],
        experience_years=profile["experience_years"],
        description=profile["description"],
        consultation_fee=profile["consultation_fee"],
        rating=profile.get("rating", 0.0),
        email=user["email"],
        phone=user["phone"]
    )

@api_router.get("/specialties")
async def get_specialties():
    """Get list of available medical specialties"""
    specialties = [
        "Nội khoa",
        "Ngoại khoa", 
        "Sản phụ khoa",
        "Nhi khoa",
        "Tim mạch",
        "Da liễu",
        "Thần kinh",
        "Tai Mũi Họng"
    ]
    return {"specialties": specialties}

# ============= DOCTOR SCHEDULE ROUTES =============
@api_router.post("/doctors/schedule", response_model=DoctorSchedule)
async def create_schedule(
    schedule_data: DoctorScheduleCreate,
    current_user: dict = Depends(get_current_doctor)
):
    # Check if schedule already exists for this date
    existing = await db.doctor_schedules.find_one({
        "doctor_id": current_user["sub"],
        "date": schedule_data.date
    }, {"_id": 0})
    
    if existing:
        raise HTTPException(status_code=400, detail="Schedule for this date already exists")
    
    schedule = DoctorSchedule(**schedule_data.model_dump(), doctor_id=current_user["sub"])
    schedule_doc = serialize_datetime(schedule.model_dump())
    
    await db.doctor_schedules.insert_one(schedule_doc)
    return schedule

@api_router.get("/doctors/{doctor_id}/schedules")
async def get_doctor_schedules(doctor_id: str, date: Optional[str] = None):
    """Get doctor's schedules, optionally filtered by date"""
    query = {"doctor_id": doctor_id}
    if date:
        query["date"] = date
    
    schedules = await db.doctor_schedules.find(query, {"_id": 0}).sort("date", 1).to_list(1000)
    return schedules

@api_router.get("/doctors/{doctor_id}/available-slots")
async def get_available_slots(doctor_id: str, date: str):
    """Get available time slots for a doctor on a specific date"""
    schedule = await db.doctor_schedules.find_one({
        "doctor_id": doctor_id,
        "date": date
    }, {"_id": 0})
    
    if not schedule:
        return {"date": date, "slots": []}
    
    # Get booked appointments for this date
    booked_appointments = await db.appointments.find({
        "doctor_id": doctor_id,
        "appointment_date": date,
        "status": {"$in": ["pending", "confirmed"]}
    }, {"_id": 0}).to_list(1000)
    
    booked_times = {apt["appointment_time"] for apt in booked_appointments}
    
    # Filter available slots
    available_slots = []
    for slot in schedule["time_slots"]:
        if slot["is_available"] and slot["start_time"] not in booked_times:
            available_slots.append(slot)
    
    return {"date": date, "slots": available_slots}

# ============= APPOINTMENT ROUTES =============
@api_router.post("/appointments", response_model=Appointment)
async def create_appointment(
    appointment_data: AppointmentCreate,
    current_user: dict = Depends(get_current_patient)
):
    # Verify doctor exists
    doctor = await db.users.find_one({"id": appointment_data.doctor_id, "role": "doctor"}, {"_id": 0})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    # Check if slot is available
    schedule = await db.doctor_schedules.find_one({
        "doctor_id": appointment_data.doctor_id,
        "date": appointment_data.appointment_date
    }, {"_id": 0})
    
    if not schedule:
        raise HTTPException(status_code=400, detail="Doctor not available on this date")
    
    # Check if time slot exists and is available
    slot_available = False
    for slot in schedule["time_slots"]:
        if slot["start_time"] == appointment_data.appointment_time and slot["is_available"]:
            slot_available = True
            break
    
    if not slot_available:
        raise HTTPException(status_code=400, detail="Time slot not available")
    
    # Check if already booked
    existing = await db.appointments.find_one({
        "doctor_id": appointment_data.doctor_id,
        "appointment_date": appointment_data.appointment_date,
        "appointment_time": appointment_data.appointment_time,
        "status": {"$in": ["pending", "confirmed"]}
    }, {"_id": 0})
    
    if existing:
        raise HTTPException(status_code=400, detail="Time slot already booked")
    
    appointment = Appointment(**appointment_data.model_dump(), patient_id=current_user["sub"])
    appointment_doc = serialize_datetime(appointment.model_dump())
    
    await db.appointments.insert_one(appointment_doc)
    return appointment

@api_router.get("/appointments/my-appointments", response_model=List[AppointmentWithDetails])
async def get_my_appointments(current_user: dict = Depends(get_current_user)):
    """Get appointments for current user (patient or doctor)"""
    if current_user["role"] == "patient":
        query = {"patient_id": current_user["sub"]}
    else:
        query = {"doctor_id": current_user["sub"]}
    
    appointments = await db.appointments.find(query, {"_id": 0}).sort("appointment_date", -1).to_list(1000)
    
    # Get details for each appointment
    result = []
    for apt in appointments:
        # Get patient info
        patient = await db.users.find_one({"id": apt["patient_id"]}, {"_id": 0})
        # Get doctor info
        doctor = await db.users.find_one({"id": apt["doctor_id"]}, {"_id": 0})
        doctor_profile = await db.doctor_profiles.find_one({"user_id": apt["doctor_id"]}, {"_id": 0})
        
        if patient and doctor and doctor_profile:
            apt_with_details = AppointmentWithDetails(
                **apt,
                patient_name=patient["full_name"],
                patient_phone=patient["phone"],
                patient_email=patient["email"],
                doctor_name=doctor["full_name"],
                doctor_specialty=doctor_profile["specialty"],
                doctor_phone=doctor["phone"]
            )
            result.append(apt_with_details)
    
    return result

@api_router.patch("/appointments/{appointment_id}", response_model=Appointment)
async def update_appointment(
    appointment_id: str,
    update_data: AppointmentUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update appointment status (doctor can confirm/complete, patient can cancel)"""
    appointment = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    # Verify authorization
    if current_user["role"] == "doctor":
        if appointment["doctor_id"] != current_user["sub"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    elif current_user["role"] == "patient":
        if appointment["patient_id"] != current_user["sub"]:
            raise HTTPException(status_code=403, detail="Not authorized")
        # Patients can only cancel
        if update_data.status != "cancelled":
            raise HTTPException(status_code=403, detail="Patients can only cancel appointments")
    
    # Update appointment
    update_dict = update_data.model_dump(exclude_unset=True)
    await db.appointments.update_one(
        {"id": appointment_id},
        {"$set": update_dict}
    )
    
    # Get updated appointment
    updated = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
    updated = deserialize_datetime(updated)
    return Appointment(**updated)

@api_router.delete("/appointments/{appointment_id}")
async def delete_appointment(
    appointment_id: str,
    current_user: dict = Depends(get_current_patient)
):
    """Cancel/delete appointment (patient only)"""
    appointment = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    if appointment["patient_id"] != current_user["sub"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Update to cancelled instead of deleting
    await db.appointments.update_one(
        {"id": appointment_id},
        {"$set": {"status": "cancelled"}}
    )
    
    return {"message": "Appointment cancelled successfully"}

# ============= ROOT ROUTE =============
@api_router.get("/")
async def root():
    return {"message": "Medical Appointment System API", "version": "1.0"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()