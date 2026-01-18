#!/usr/bin/env python3
"""
Backend Testing for ZION.CITY Application - SERVICES Module Phase 3 - Booking Calendar & CRM

Test Focus:
1. GET /api/services/bookings/available-slots/{service_id}?date={date} - Available booking slots
2. POST /api/services/bookings - Create booking
3. GET /api/services/bookings/my - My bookings
4. PUT /api/services/bookings/{booking_id}/status?new_status=CONFIRMED - Update booking status

Test Scenarios:
- Test available slots API with specific service ID and date
- Test booking creation with authentication
- Test retrieving user's bookings
- Test updating booking status

Test Credentials:
- Admin: admin@test.com / testpassword123

Test Data:
- Service ID: c5aa409c-d881-4c2e-b388-515cfb7b5b94
- Test Date: 2025-12-20
"""

import requests
import json
import sys
from datetime import datetime, timedelta
from typing import Optional

# Get backend URL from environment
BACKEND_URL = "https://social-login-fix.preview.emergentagent.com/api"

class ServicesBookingTester:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
        self.admin_user_id = None
        self.test_service_id = "c5aa409c-d881-4c2e-b388-515cfb7b5b94"
        self.test_date = "2025-12-20"
        self.created_booking_id = None
        
    def log(self, message, level="INFO"):
        """Log test messages with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def login_admin(self):
        """Login admin user and get JWT token"""
        try:
            self.log("🔐 Logging in admin user: admin@test.com")
            
            response = self.session.post(f"{BACKEND_URL}/auth/login", json={
                "email": "admin@test.com",
                "password": "testpassword123"
            })
            
            if response.status_code == 200:
                data = response.json()
                self.admin_token = data.get("access_token")
                self.admin_user_id = data.get("user", {}).get("id")
                
                self.log(f"✅ Admin login successful - User ID: {self.admin_user_id}")
                return True
            else:
                self.log(f"❌ Admin login failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Admin login error: {str(e)}", "ERROR")
            return False
    
    def get_auth_headers(self):
        """Get authorization headers"""
        return {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_available_slots_api(self):
        """Test 1: GET /api/services/bookings/available-slots/{service_id}?date={date}"""
        self.log(f"📅 Testing GET /api/services/bookings/available-slots/{self.test_service_id}?date={self.test_date}")
        
        try:
            response = self.session.get(
                f"{BACKEND_URL}/services/bookings/available-slots/{self.test_service_id}",
                params={"date": self.test_date}
            )
            
            if response.status_code == 200:
                data = response.json()
                slots = data.get("slots", [])
                duration = data.get("duration_minutes")
                
                self.log(f"✅ Available slots retrieved - Found {len(slots)} slots")
                
                # Verify we have 9 slots from 09:00-17:00 as expected
                if len(slots) == 9:
                    self.log("✅ Correct number of slots (9) from 09:00-17:00")
                else:
                    self.log(f"⚠️ Expected 9 slots, found {len(slots)}", "WARNING")
                
                # Verify slot structure
                if slots:
                    first_slot = slots[0]
                    required_fields = ["start", "end", "available"]
                    missing_fields = [field for field in required_fields if field not in first_slot]
                    
                    if missing_fields:
                        self.log(f"❌ Missing fields in slot: {missing_fields}", "ERROR")
                        return False
                    else:
                        self.log("✅ Slot structure validated (start, end, available fields present)")
                    
                    # Check time format and range
                    first_start = first_slot.get("start", "")
                    last_slot = slots[-1]
                    last_end = last_slot.get("end", "")
                    
                    if "09:00" in first_start and "17:00" in last_end:
                        self.log("✅ Time range validated (09:00-17:00)")
                    else:
                        self.log(f"⚠️ Time range unexpected: {first_start} to {last_end}", "WARNING")
                    
                    # Check availability status
                    available_slots = [slot for slot in slots if slot.get("available")]
                    self.log(f"✅ Available slots: {len(available_slots)}/{len(slots)}")
                
                if duration:
                    self.log(f"✅ Duration specified: {duration} minutes")
                
                return True
            else:
                self.log(f"❌ Get available slots failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Get available slots error: {str(e)}", "ERROR")
            return False
    
    def test_create_booking_api(self):
        """Test 2: POST /api/services/bookings"""
        self.log("➕ Testing POST /api/services/bookings")
        
        try:
            booking_data = {
                "service_id": self.test_service_id,
                "booking_date": "2025-12-20T09:00:00+00:00",
                "client_name": "Анна Петрова",
                "client_phone": "+7 (999) 123-45-67",
                "client_email": "anna.petrova@example.com"
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/services/bookings",
                json=booking_data,
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("success") and data.get("booking"):
                    booking = data["booking"]
                    self.created_booking_id = booking.get("id")
                    
                    self.log(f"✅ Booking created successfully - ID: {self.created_booking_id}")
                    
                    # Verify booking data
                    if booking.get("service_id") == booking_data["service_id"]:
                        self.log("✅ Service ID matches")
                    else:
                        self.log("❌ Service ID mismatch", "ERROR")
                    
                    if booking.get("client_name") == booking_data["client_name"]:
                        self.log("✅ Client name matches")
                    else:
                        self.log("❌ Client name mismatch", "ERROR")
                    
                    if booking.get("client_phone") == booking_data["client_phone"]:
                        self.log("✅ Client phone matches")
                    else:
                        self.log("❌ Client phone mismatch", "ERROR")
                    
                    if booking.get("client_email") == booking_data["client_email"]:
                        self.log("✅ Client email matches")
                    else:
                        self.log("❌ Client email mismatch", "ERROR")
                    
                    # Check booking status
                    status = booking.get("status", "")
                    if status in ["PENDING", "CONFIRMED"]:
                        self.log(f"✅ Booking status valid: {status}")
                    else:
                        self.log(f"⚠️ Unexpected booking status: {status}", "WARNING")
                    
                    return True
                else:
                    self.log("❌ Booking created but response format unexpected", "ERROR")
                    return False
            else:
                self.log(f"❌ Create booking failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Create booking error: {str(e)}", "ERROR")
            return False
    
    def test_my_bookings_api(self):
        """Test 3: GET /api/services/bookings/my"""
        self.log("👤 Testing GET /api/services/bookings/my")
        
        try:
            response = self.session.get(
                f"{BACKEND_URL}/services/bookings/my",
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                bookings = data.get("bookings", [])
                
                self.log(f"✅ My bookings retrieved - Found {len(bookings)} bookings")
                
                # If we have bookings, verify structure
                if bookings:
                    first_booking = bookings[0]
                    required_fields = ["id", "service_id", "booking_date", "client_name", "status"]
                    missing_fields = [field for field in required_fields if field not in first_booking]
                    
                    if missing_fields:
                        self.log(f"❌ Missing fields in booking: {missing_fields}", "ERROR")
                        return False
                    else:
                        self.log("✅ Booking structure validated")
                    
                    # Check if service details are included
                    if "service" in first_booking:
                        service = first_booking["service"]
                        if "name" in service:
                            self.log("✅ Service details included in booking")
                        else:
                            self.log("⚠️ Service name not included", "WARNING")
                    else:
                        self.log("⚠️ Service details not included", "WARNING")
                    
                    # Check if our created booking is in the list
                    if self.created_booking_id:
                        found_booking = next((b for b in bookings if b.get("id") == self.created_booking_id), None)
                        if found_booking:
                            self.log("✅ Created booking found in my bookings list")
                        else:
                            self.log("⚠️ Created booking not found in my bookings list", "WARNING")
                
                return True
            else:
                self.log(f"❌ Get my bookings failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Get my bookings error: {str(e)}", "ERROR")
            return False
    
    def test_update_booking_status_api(self):
        """Test 4: PUT /api/services/bookings/{booking_id}/status?new_status=CONFIRMED"""
        if not self.created_booking_id:
            self.log("⚠️ No booking ID available for status update test", "WARNING")
            return False
            
        self.log(f"🔄 Testing PUT /api/services/bookings/{self.created_booking_id}/status?new_status=CONFIRMED")
        
        try:
            response = self.session.put(
                f"{BACKEND_URL}/services/bookings/{self.created_booking_id}/status",
                params={"new_status": "CONFIRMED"},
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("success"):
                    self.log("✅ Booking status updated successfully")
                    
                    # Verify the updated booking
                    updated_booking = data.get("booking")
                    if updated_booking:
                        new_status = updated_booking.get("status")
                        if new_status == "CONFIRMED":
                            self.log("✅ Booking status confirmed as CONFIRMED")
                        else:
                            self.log(f"❌ Status not updated correctly: {new_status}", "ERROR")
                            return False
                    else:
                        self.log("⚠️ Updated booking not returned in response", "WARNING")
                    
                    return True
                else:
                    self.log("❌ Status update failed - success flag false", "ERROR")
                    return False
            else:
                self.log(f"❌ Update booking status failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Update booking status error: {str(e)}", "ERROR")
            return False
    
    def run_comprehensive_test(self):
        """Run all SERVICES booking tests in sequence"""
        self.log("🚀 Starting ZION.CITY Backend Testing - SERVICES Module Phase 3 - Booking Calendar & CRM")
        self.log("=" * 90)
        
        # Test results tracking
        test_results = {
            "admin_login": False,
            "available_slots": False,
            "create_booking": False,
            "my_bookings": False,
            "update_booking_status": False
        }
        
        # 1. Login admin user
        test_results["admin_login"] = self.login_admin()
        
        if not test_results["admin_login"]:
            self.log("❌ Cannot proceed without admin login", "ERROR")
            return test_results
        
        # 2. Test available slots API
        test_results["available_slots"] = self.test_available_slots_api()
        
        # 3. Test create booking API
        test_results["create_booking"] = self.test_create_booking_api()
        
        # 4. Test my bookings API
        test_results["my_bookings"] = self.test_my_bookings_api()
        
        # 5. Test update booking status API
        test_results["update_booking_status"] = self.test_update_booking_status_api()
        
        # Print final results
        self.log("=" * 90)
        self.log("📊 FINAL TEST RESULTS - SERVICES Booking Calendar & CRM")
        self.log("=" * 90)
        
        passed_tests = 0
        total_tests = len(test_results)
        
        for test_name, result in test_results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            self.log(f"{test_name.replace('_', ' ').title()}: {status}")
            if result:
                passed_tests += 1
        
        # Overall summary
        success_rate = (passed_tests / total_tests) * 100
        self.log("=" * 90)
        self.log(f"📈 OVERALL SUCCESS RATE: {passed_tests}/{total_tests} ({success_rate:.1f}%)")
        
        # Critical features check
        critical_tests = ["available_slots", "create_booking", "my_bookings", "update_booking_status"]
        critical_passed = sum(1 for test in critical_tests if test_results.get(test, False))
        
        if critical_passed == len(critical_tests):
            self.log("🎉 ALL CRITICAL BOOKING FEATURES WORKING!")
        else:
            self.log(f"⚠️ {critical_passed}/{len(critical_tests)} critical booking features working")
        
        self.log("=" * 90)
        
        return test_results

def main():
    """Main test execution"""
    tester = ServicesBookingTester()
    results = tester.run_comprehensive_test()
    
    # Exit with appropriate code
    critical_tests = ["admin_login", "available_slots", "create_booking", "my_bookings"]
    critical_passed = all(results.get(test, False) for test in critical_tests)
    
    if critical_passed:
        print("\n🎉 All critical SERVICES booking tests passed!")
        sys.exit(0)
    else:
        print("\n❌ Some critical SERVICES booking tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()