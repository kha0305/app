import requests
import sys
import json
from datetime import datetime, timedelta

class NewFeaturesAPITester:
    def __init__(self, base_url="https://ongoing-work-18.preview.emergentagent.com"):
        self.base_url = base_url
        self.patient_token = None
        self.doctor_token = None
        self.admin_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.patient_id = None
        self.doctor_id = None
        self.admin_id = None
        self.appointment_id = None
        self.consultation_id = None
        self.payment_id = None
        self.reset_token = None

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
                    print(f"   Response: {json.dumps(response_data, indent=2)[:300]}...")
                    return True, response_data
                except:
                    print(f"   Response: {response.text[:200]}...")
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text}")
                self.failed_tests.append(f"{name}: Expected {expected_status}, got {response.status_code}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append(f"{name}: Exception - {str(e)}")
            return False, {}

    def setup_users(self):
        """Create test users: patient, doctor, and admin"""
        print("\n🔧 Setting up test users...")
        
        # Create patient
        success, response = self.run_test(
            "Create Patient User",
            "POST",
            "auth/register",
            200,
            data={
                "username": "testpatient123",
                "email": "patient@test.com",
                "password": "testpass123",
                "phone": "0123456789",
                "full_name": "Nguyễn Văn Bệnh Nhân",
                "role": "patient"
            }
        )
        if success:
            self.patient_id = response.get('id')

        # Create doctor
        success, response = self.run_test(
            "Create Doctor User",
            "POST",
            "auth/register",
            200,
            data={
                "username": "testdoctor123",
                "email": "doctor@test.com",
                "password": "testpass123",
                "phone": "0987654321",
                "full_name": "Bác Sĩ Nguyễn Văn A",
                "role": "doctor"
            }
        )
        if success:
            self.doctor_id = response.get('id')

        # Create admin
        success, response = self.run_test(
            "Create Admin User",
            "POST",
            "auth/register",
            200,
            data={
                "username": "testadmin123",
                "email": "admin@test.com",
                "password": "testpass123",
                "phone": "0111222333",
                "full_name": "Quản Trị Viên",
                "role": "admin"
            }
        )
        if success:
            self.admin_id = response.get('id')

    def login_users(self):
        """Login all test users"""
        print("\n🔑 Logging in test users...")
        
        # Login patient
        success, response = self.run_test(
            "Patient Login",
            "POST",
            "auth/login",
            200,
            data={"username": "testpatient123", "password": "testpass123"}
        )
        if success and 'access_token' in response:
            self.patient_token = response['access_token']

        # Login doctor
        success, response = self.run_test(
            "Doctor Login",
            "POST",
            "auth/login",
            200,
            data={"username": "testdoctor123", "password": "testpass123"}
        )
        if success and 'access_token' in response:
            self.doctor_token = response['access_token']

        # Login admin
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"username": "testadmin123", "password": "testpass123"}
        )
        if success and 'access_token' in response:
            self.admin_token = response['access_token']

    def setup_doctor_profile(self):
        """Create doctor profile for testing"""
        if not self.doctor_token:
            return False
            
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
        return success

    def create_test_appointment(self):
        """Create a test appointment for payment testing"""
        if not self.patient_token or not self.doctor_id:
            return False
            
        tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        success, response = self.run_test(
            "Create Test Appointment",
            "POST",
            "appointments",
            200,
            data={
                "doctor_id": self.doctor_id,
                "appointment_date": tomorrow,
                "appointment_time": "08:00",
                "reason": "Khám tổng quát",
                "notes": "Test appointment for payment"
            },
            token=self.patient_token
        )
        if success:
            self.appointment_id = response.get('id')
        return success

    # ============= FORGOT PASSWORD TESTS =============
    def test_forgot_password_valid_email(self):
        """Test forgot password with valid email"""
        success, response = self.run_test(
            "Forgot Password - Valid Email",
            "POST",
            "auth/forgot-password",
            200,
            data={"email": "patient@test.com"}
        )
        if success and 'demo_token' in response:
            self.reset_token = response['demo_token']
            print(f"   Reset token received: {self.reset_token[:20]}...")
        return success

    def test_forgot_password_invalid_email(self):
        """Test forgot password with non-existent email"""
        return self.run_test(
            "Forgot Password - Invalid Email",
            "POST",
            "auth/forgot-password",
            200,  # Should still return 200 for security
            data={"email": "nonexistent@test.com"}
        )[0]

    def test_forgot_password_missing_email(self):
        """Test forgot password without email"""
        return self.run_test(
            "Forgot Password - Missing Email",
            "POST",
            "auth/forgot-password",
            400,
            data={}
        )[0]

    def test_reset_password_valid_token(self):
        """Test reset password with valid token"""
        if not self.reset_token:
            print("❌ No reset token available")
            return False
            
        return self.run_test(
            "Reset Password - Valid Token",
            "POST",
            "auth/reset-password",
            200,
            data={
                "token": self.reset_token,
                "new_password": "newpassword123"
            }
        )[0]

    def test_reset_password_invalid_token(self):
        """Test reset password with invalid token"""
        return self.run_test(
            "Reset Password - Invalid Token",
            "POST",
            "auth/reset-password",
            400,
            data={
                "token": "invalid_token_123",
                "new_password": "newpassword123"
            }
        )[0]

    def test_reset_password_used_token(self):
        """Test reset password with already used token"""
        if not self.reset_token:
            print("❌ No reset token available")
            return False
            
        return self.run_test(
            "Reset Password - Used Token",
            "POST",
            "auth/reset-password",
            400,
            data={
                "token": self.reset_token,
                "new_password": "anothernewpass123"
            }
        )[0]

    def test_login_with_new_password(self):
        """Test login with new password after reset"""
        return self.run_test(
            "Login with New Password",
            "POST",
            "auth/login",
            200,
            data={"username": "testpatient123", "password": "newpassword123"}
        )[0]

    # ============= CONSULTATION/CHAT TESTS =============
    def test_create_consultation(self):
        """Test creating consultation"""
        if not self.patient_token or not self.doctor_id:
            print("❌ Missing patient token or doctor ID")
            return False
            
        success, response = self.run_test(
            "Create Consultation",
            "POST",
            "consultations",
            200,
            data={
                "doctor_id": self.doctor_id,
                "appointment_id": self.appointment_id,
                "consultation_type": "chat"
            },
            token=self.patient_token
        )
        if success:
            self.consultation_id = response.get('id')
        return success

    def test_create_consultation_invalid_doctor(self):
        """Test creating consultation with invalid doctor"""
        if not self.patient_token:
            return False
            
        return self.run_test(
            "Create Consultation - Invalid Doctor",
            "POST",
            "consultations",
            404,
            data={
                "doctor_id": "invalid_doctor_id",
                "consultation_type": "chat"
            },
            token=self.patient_token
        )[0]

    def test_get_consultations(self):
        """Test getting consultations list"""
        if not self.patient_token:
            return False
            
        return self.run_test(
            "Get Consultations List",
            "GET",
            "consultations",
            200,
            token=self.patient_token
        )[0]

    def test_get_consultation_by_id(self):
        """Test getting specific consultation"""
        if not self.patient_token or not self.consultation_id:
            print("❌ Missing patient token or consultation ID")
            return False
            
        return self.run_test(
            "Get Consultation by ID",
            "GET",
            f"consultations/{self.consultation_id}",
            200,
            token=self.patient_token
        )[0]

    def test_send_message(self):
        """Test sending message in consultation"""
        if not self.patient_token or not self.consultation_id:
            print("❌ Missing patient token or consultation ID")
            return False
            
        return self.run_test(
            "Send Message",
            "POST",
            f"consultations/{self.consultation_id}/messages",
            200,
            data={"message_text": "Xin chào bác sĩ, tôi cần tư vấn về tình trạng sức khỏe"},
            token=self.patient_token
        )[0]

    def test_get_messages(self):
        """Test getting messages from consultation"""
        if not self.patient_token or not self.consultation_id:
            print("❌ Missing patient token or consultation ID")
            return False
            
        return self.run_test(
            "Get Messages",
            "GET",
            f"consultations/{self.consultation_id}/messages",
            200,
            token=self.patient_token
        )[0]

    def test_doctor_send_message(self):
        """Test doctor sending message"""
        if not self.doctor_token or not self.consultation_id:
            print("❌ Missing doctor token or consultation ID")
            return False
            
        return self.run_test(
            "Doctor Send Message",
            "POST",
            f"consultations/{self.consultation_id}/messages",
            200,
            data={"message_text": "Chào bạn, tôi sẽ tư vấn cho bạn. Bạn có triệu chứng gì?"},
            token=self.doctor_token
        )[0]

    def test_end_consultation(self):
        """Test ending consultation"""
        if not self.patient_token or not self.consultation_id:
            print("❌ Missing patient token or consultation ID")
            return False
            
        return self.run_test(
            "End Consultation",
            "PATCH",
            f"consultations/{self.consultation_id}/end",
            200,
            token=self.patient_token
        )[0]

    # ============= PAYMENT TESTS =============
    def test_create_payment(self):
        """Test creating payment"""
        if not self.patient_token or not self.appointment_id:
            print("❌ Missing patient token or appointment ID")
            return False
            
        success, response = self.run_test(
            "Create Payment",
            "POST",
            "payments/create",
            200,
            data={
                "appointment_id": self.appointment_id,
                "payment_method": "credit_card"
            },
            token=self.patient_token
        )
        if success:
            self.payment_id = response.get('id')
        return success

    def test_create_payment_invalid_appointment(self):
        """Test creating payment with invalid appointment"""
        if not self.patient_token:
            return False
            
        return self.run_test(
            "Create Payment - Invalid Appointment",
            "POST",
            "payments/create",
            404,
            data={
                "appointment_id": "invalid_appointment_id",
                "payment_method": "cash"
            },
            token=self.patient_token
        )[0]

    def test_confirm_payment(self):
        """Test confirming payment"""
        if not self.patient_token or not self.payment_id:
            print("❌ Missing patient token or payment ID")
            return False
            
        return self.run_test(
            "Confirm Payment",
            "POST",
            f"payments/{self.payment_id}/confirm",
            200,
            token=self.patient_token
        )[0]

    def test_get_payment_by_appointment(self):
        """Test getting payment by appointment"""
        if not self.patient_token or not self.appointment_id:
            print("❌ Missing patient token or appointment ID")
            return False
            
        return self.run_test(
            "Get Payment by Appointment",
            "GET",
            f"payments/appointment/{self.appointment_id}",
            200,
            token=self.patient_token
        )[0]

    def test_get_my_payments(self):
        """Test getting user's payments"""
        if not self.patient_token:
            return False
            
        return self.run_test(
            "Get My Payments",
            "GET",
            "payments/my-payments",
            200,
            token=self.patient_token
        )[0]

    # ============= ADMIN TESTS =============
    def test_admin_stats(self):
        """Test getting admin statistics"""
        if not self.admin_token:
            print("❌ Missing admin token")
            return False
            
        return self.run_test(
            "Admin Stats",
            "GET",
            "admin/stats",
            200,
            token=self.admin_token
        )[0]

    def test_admin_get_users(self):
        """Test getting users list"""
        if not self.admin_token:
            return False
            
        return self.run_test(
            "Admin Get Users",
            "GET",
            "admin/users?role=patient&page=1&limit=10",
            200,
            token=self.admin_token
        )[0]

    def test_admin_get_user_by_id(self):
        """Test getting specific user"""
        if not self.admin_token or not self.patient_id:
            print("❌ Missing admin token or patient ID")
            return False
            
        return self.run_test(
            "Admin Get User by ID",
            "GET",
            f"admin/users/{self.patient_id}",
            200,
            token=self.admin_token
        )[0]

    def test_admin_get_appointments(self):
        """Test getting appointments list"""
        if not self.admin_token:
            return False
            
        return self.run_test(
            "Admin Get Appointments",
            "GET",
            "admin/appointments?status=pending&page=1",
            200,
            token=self.admin_token
        )[0]

    def test_admin_delete_user_protection(self):
        """Test that admin cannot delete admin accounts"""
        if not self.admin_token or not self.admin_id:
            return False
            
        return self.run_test(
            "Admin Delete User - Admin Protection",
            "DELETE",
            f"admin/users/{self.admin_id}",
            403,
            token=self.admin_token
        )[0]

    def test_unauthorized_admin_access(self):
        """Test unauthorized access to admin endpoints"""
        if not self.patient_token:
            return False
            
        return self.run_test(
            "Unauthorized Admin Access",
            "GET",
            "admin/stats",
            403,
            token=self.patient_token
        )[0]

def main():
    print("🏥 Starting New Features API Tests")
    print("Testing: Forgot Password, Consultation/Chat, Payment, Admin APIs")
    print("=" * 80)
    
    tester = NewFeaturesAPITester()
    
    # Setup phase
    print("\n📋 SETUP PHASE")
    tester.setup_users()
    tester.login_users()
    tester.setup_doctor_profile()
    tester.create_test_appointment()
    
    # Test sequence for all 4 new features
    test_sequence = [
        # 1. FORGOT PASSWORD TESTS
        ("🔐 FORGOT PASSWORD TESTS", None),
        ("Forgot Password - Valid Email", tester.test_forgot_password_valid_email),
        ("Forgot Password - Invalid Email", tester.test_forgot_password_invalid_email),
        ("Forgot Password - Missing Email", tester.test_forgot_password_missing_email),
        ("Reset Password - Valid Token", tester.test_reset_password_valid_token),
        ("Reset Password - Invalid Token", tester.test_reset_password_invalid_token),
        ("Reset Password - Used Token", tester.test_reset_password_used_token),
        ("Login with New Password", tester.test_login_with_new_password),
        
        # 2. CONSULTATION/CHAT TESTS
        ("💬 CONSULTATION/CHAT TESTS", None),
        ("Create Consultation", tester.test_create_consultation),
        ("Create Consultation - Invalid Doctor", tester.test_create_consultation_invalid_doctor),
        ("Get Consultations List", tester.test_get_consultations),
        ("Get Consultation by ID", tester.test_get_consultation_by_id),
        ("Send Message", tester.test_send_message),
        ("Get Messages", tester.test_get_messages),
        ("Doctor Send Message", tester.test_doctor_send_message),
        ("End Consultation", tester.test_end_consultation),
        
        # 3. PAYMENT TESTS
        ("💰 PAYMENT TESTS", None),
        ("Create Payment", tester.test_create_payment),
        ("Create Payment - Invalid Appointment", tester.test_create_payment_invalid_appointment),
        ("Confirm Payment", tester.test_confirm_payment),
        ("Get Payment by Appointment", tester.test_get_payment_by_appointment),
        ("Get My Payments", tester.test_get_my_payments),
        
        # 4. ADMIN TESTS
        ("👑 ADMIN TESTS", None),
        ("Admin Stats", tester.test_admin_stats),
        ("Admin Get Users", tester.test_admin_get_users),
        ("Admin Get User by ID", tester.test_admin_get_user_by_id),
        ("Admin Get Appointments", tester.test_admin_get_appointments),
        ("Admin Delete User - Admin Protection", tester.test_admin_delete_user_protection),
        ("Unauthorized Admin Access", tester.test_unauthorized_admin_access),
    ]
    
    # Run all tests
    for test_name, test_func in test_sequence:
        if test_func is None:
            print(f"\n{test_name}")
            print("-" * 50)
            continue
            
        try:
            test_func()
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {str(e)}")
            tester.failed_tests.append(f"{test_name}: Exception - {str(e)}")
    
    # Print results
    print("\n" + "=" * 80)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    print(f"📈 Success Rate: {success_rate:.1f}%")
    
    if tester.failed_tests:
        print(f"\n❌ Failed Tests ({len(tester.failed_tests)}):")
        for i, failed_test in enumerate(tester.failed_tests, 1):
            print(f"   {i}. {failed_test}")
    
    if success_rate >= 80:
        print("\n✅ New Features API tests mostly successful!")
        return 0
    else:
        print("\n❌ New Features API tests have significant failures!")
        return 1

if __name__ == "__main__":
    sys.exit(main())