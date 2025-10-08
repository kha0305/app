import requests
import sys
from datetime import datetime, timedelta
import json

class MedicalAppointmentAPITester:
    def __init__(self, base_url="https://functional-site-3.preview.emergentagent.com"):
        self.base_url = base_url
        self.patient_token = None
        self.doctor_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.doctor_profile_id = None
        self.appointment_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                except:
                    print(f"   Response: {response.text[:200]}...")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text}")

            return success, response.json() if response.text and response.status_code < 500 else {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        return self.run_test("Root API", "GET", "", 200)

    def test_patient_login(self):
        """Test patient login"""
        success, response = self.run_test(
            "Patient Login",
            "POST",
            "auth/login",
            200,
            data={"username": "patient1", "password": "password123"}
        )
        if success and 'access_token' in response:
            self.patient_token = response['access_token']
            print(f"   Patient token obtained: {self.patient_token[:20]}...")
            return True
        return False

    def test_doctor_login(self):
        """Test doctor login"""
        success, response = self.run_test(
            "Doctor Login",
            "POST",
            "auth/login",
            200,
            data={"username": "doctor1", "password": "password123"}
        )
        if success and 'access_token' in response:
            self.doctor_token = response['access_token']
            print(f"   Doctor token obtained: {self.doctor_token[:20]}...")
            return True
        return False

    def test_get_me_patient(self):
        """Test get current user info for patient"""
        return self.run_test(
            "Get Patient Info",
            "GET",
            "auth/me",
            200,
            token=self.patient_token
        )

    def test_get_me_doctor(self):
        """Test get current user info for doctor"""
        return self.run_test(
            "Get Doctor Info",
            "GET",
            "auth/me",
            200,
            token=self.doctor_token
        )

    def test_get_specialties(self):
        """Test get specialties"""
        return self.run_test(
            "Get Specialties",
            "GET",
            "specialties",
            200
        )

    def test_create_doctor_profile(self):
        """Test creating doctor profile"""
        success, response = self.run_test(
            "Create Doctor Profile",
            "POST",
            "doctors/profile",
            200,
            data={
                "specialty": "Nội khoa",
                "experience_years": 5,
                "description": "Bác sĩ chuyên khoa nội với 5 năm kinh nghiệm",
                "consultation_fee": 200000.0
            },
            token=self.doctor_token
        )
        if success and 'id' in response:
            self.doctor_profile_id = response['id']
            return True
        return False

    def test_get_doctors(self):
        """Test get all doctors"""
        return self.run_test(
            "Get All Doctors",
            "GET",
            "doctors",
            200
        )

    def test_get_doctors_by_specialty(self):
        """Test get doctors by specialty"""
        return self.run_test(
            "Get Doctors by Specialty",
            "GET",
            "doctors?specialty=Nội khoa",
            200
        )

    def test_get_doctor_by_id(self):
        """Test get specific doctor"""
        # Get doctor user ID first
        success, response = self.run_test(
            "Get Doctor Info for ID",
            "GET",
            "auth/me",
            200,
            token=self.doctor_token
        )
        if success and 'id' in response:
            doctor_id = response['id']
            return self.run_test(
                "Get Doctor by ID",
                "GET",
                f"doctors/{doctor_id}",
                200
            )
        return False

    def test_create_doctor_schedule(self):
        """Test creating doctor schedule"""
        tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        time_slots = []
        
        # Generate time slots from 8:00 to 17:00, 30-minute intervals
        for hour in range(8, 17):
            for minute in [0, 30]:
                start_time = f"{hour:02d}:{minute:02d}"
                end_hour = hour if minute == 0 else hour + 1
                end_minute = 30 if minute == 0 else 0
                end_time = f"{end_hour:02d}:{end_minute:02d}"
                time_slots.append({
                    "start_time": start_time,
                    "end_time": end_time,
                    "is_available": True
                })

        return self.run_test(
            "Create Doctor Schedule",
            "POST",
            "doctors/schedule",
            200,
            data={
                "date": tomorrow,
                "time_slots": time_slots
            },
            token=self.doctor_token
        )

    def test_get_doctor_schedules(self):
        """Test get doctor schedules"""
        # Get doctor user ID first
        success, response = self.run_test(
            "Get Doctor Info for Schedules",
            "GET",
            "auth/me",
            200,
            token=self.doctor_token
        )
        if success and 'id' in response:
            doctor_id = response['id']
            return self.run_test(
                "Get Doctor Schedules",
                "GET",
                f"doctors/{doctor_id}/schedules",
                200
            )
        return False

    def test_get_available_slots(self):
        """Test get available slots"""
        # Get doctor user ID first
        success, response = self.run_test(
            "Get Doctor Info for Slots",
            "GET",
            "auth/me",
            200,
            token=self.doctor_token
        )
        if success and 'id' in response:
            doctor_id = response['id']
            tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
            return self.run_test(
                "Get Available Slots",
                "GET",
                f"doctors/{doctor_id}/available-slots?date={tomorrow}",
                200
            )
        return False

    def test_create_appointment(self):
        """Test creating appointment"""
        # Get doctor user ID first
        success, response = self.run_test(
            "Get Doctor Info for Appointment",
            "GET",
            "auth/me",
            200,
            token=self.doctor_token
        )
        if success and 'id' in response:
            doctor_id = response['id']
            tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
            
            success, response = self.run_test(
                "Create Appointment",
                "POST",
                "appointments",
                200,
                data={
                    "doctor_id": doctor_id,
                    "appointment_date": tomorrow,
                    "appointment_time": "08:00",
                    "reason": "Khám tổng quát",
                    "notes": "Cần khám sức khỏe định kỳ"
                },
                token=self.patient_token
            )
            if success and 'id' in response:
                self.appointment_id = response['id']
                return True
        return False

    def test_get_patient_appointments(self):
        """Test get patient appointments"""
        return self.run_test(
            "Get Patient Appointments",
            "GET",
            "appointments/my-appointments",
            200,
            token=self.patient_token
        )

    def test_get_doctor_appointments(self):
        """Test get doctor appointments"""
        return self.run_test(
            "Get Doctor Appointments",
            "GET",
            "appointments/my-appointments",
            200,
            token=self.doctor_token
        )

    def test_update_appointment_status(self):
        """Test updating appointment status (doctor confirms)"""
        if not self.appointment_id:
            print("❌ No appointment ID available for status update test")
            return False
            
        return self.run_test(
            "Update Appointment Status",
            "PATCH",
            f"appointments/{self.appointment_id}",
            200,
            data={"status": "confirmed"},
            token=self.doctor_token
        )

    def test_cancel_appointment(self):
        """Test cancelling appointment (patient cancels)"""
        if not self.appointment_id:
            print("❌ No appointment ID available for cancellation test")
            return False
            
        return self.run_test(
            "Cancel Appointment",
            "DELETE",
            f"appointments/{self.appointment_id}",
            200,
            token=self.patient_token
        )

    def test_invalid_login(self):
        """Test invalid login credentials"""
        return self.run_test(
            "Invalid Login",
            "POST",
            "auth/login",
            401,
            data={"username": "invalid", "password": "invalid"}
        )

    def test_unauthorized_access(self):
        """Test unauthorized access"""
        return self.run_test(
            "Unauthorized Access",
            "GET",
            "auth/me",
            401
        )

def main():
    print("🏥 Starting Medical Appointment System API Tests")
    print("=" * 60)
    
    tester = MedicalAppointmentAPITester()
    
    # Test sequence
    test_sequence = [
        # Basic tests
        ("Root API", tester.test_root_endpoint),
        ("Invalid Login", tester.test_invalid_login),
        ("Unauthorized Access", tester.test_unauthorized_access),
        
        # Authentication tests
        ("Patient Login", tester.test_patient_login),
        ("Doctor Login", tester.test_doctor_login),
        ("Get Patient Info", tester.test_get_me_patient),
        ("Get Doctor Info", tester.test_get_me_doctor),
        
        # Specialty and doctor tests
        ("Get Specialties", tester.test_get_specialties),
        ("Create Doctor Profile", tester.test_create_doctor_profile),
        ("Get All Doctors", tester.test_get_doctors),
        ("Get Doctors by Specialty", tester.test_get_doctors_by_specialty),
        ("Get Doctor by ID", tester.test_get_doctor_by_id),
        
        # Schedule tests
        ("Create Doctor Schedule", tester.test_create_doctor_schedule),
        ("Get Doctor Schedules", tester.test_get_doctor_schedules),
        ("Get Available Slots", tester.test_get_available_slots),
        
        # Appointment tests
        ("Create Appointment", tester.test_create_appointment),
        ("Get Patient Appointments", tester.test_get_patient_appointments),
        ("Get Doctor Appointments", tester.test_get_doctor_appointments),
        ("Update Appointment Status", tester.test_update_appointment_status),
        ("Cancel Appointment", tester.test_cancel_appointment),
    ]
    
    # Run all tests
    for test_name, test_func in test_sequence:
        try:
            test_func()
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {str(e)}")
    
    # Print results
    print("\n" + "=" * 60)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    print(f"📈 Success Rate: {success_rate:.1f}%")
    
    if success_rate >= 80:
        print("✅ Backend API tests mostly successful!")
        return 0
    else:
        print("❌ Backend API tests have significant failures!")
        return 1

if __name__ == "__main__":
    sys.exit(main())