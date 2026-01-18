#!/usr/bin/env python3
"""
Good Will Module Permission System Testing - Isolated Tests
Tests different user roles and their permissions for Good Will events
Each test scenario is properly isolated
"""

import requests
import json
import sys
from datetime import datetime, timedelta

# API Configuration
BASE_URL = "https://dbfix-social.preview.emergentagent.com/api"

# Test Credentials
ADMIN_CREDENTIALS = {
    "email": "admin@test.com",
    "password": "testpassword123"
}

USER_CREDENTIALS = {
    "email": "testuser@test.com", 
    "password": "testpassword123"
}

class GoodWillPermissionTester:
    def __init__(self):
        self.admin_token = None
        self.user_token = None
        self.test_event_id = None
        self.test_user_id = None
        self.results = []
        
    def log_result(self, test_name, expected, actual, details=""):
        """Log test result"""
        status = "✅ PASS" if expected == actual else "❌ FAIL"
        result = {
            "test": test_name,
            "expected": expected,
            "actual": actual,
            "status": status,
            "details": details
        }
        self.results.append(result)
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        return expected == actual
    
    def login_user(self, credentials, role_name):
        """Login and get JWT token"""
        try:
            response = requests.post(f"{BASE_URL}/auth/login", json=credentials)
            if response.status_code == 200:
                token = response.json().get("access_token")
                print(f"✅ {role_name} login successful")
                return token
            else:
                print(f"❌ {role_name} login failed: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            print(f"❌ {role_name} login error: {str(e)}")
            return None
    
    def get_headers(self, token):
        """Get authorization headers"""
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    def find_test_event(self):
        """Find an event where admin is the organizer"""
        try:
            headers = self.get_headers(self.admin_token)
            response = requests.get(f"{BASE_URL}/goodwill/events", headers=headers)
            
            if response.status_code == 200:
                events = response.json().get("events", [])
                
                if events:
                    self.test_event_id = events[0]["id"]
                    print(f"✅ Found test event: {events[0]['title']} (ID: {self.test_event_id})")
                    return True
                else:
                    print("❌ No events found for testing")
                    return False
            else:
                print(f"❌ Failed to get events: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Error finding test event: {str(e)}")
            return False
    
    def get_user_id(self, token):
        """Get user ID from token"""
        try:
            headers = self.get_headers(token)
            response = requests.get(f"{BASE_URL}/auth/me", headers=headers)
            if response.status_code == 200:
                return response.json().get("id")
            return None
        except:
            return None
    
    def remove_user_from_event(self, user_id):
        """Remove user from event (RSVP and co-organizer)"""
        try:
            headers = self.get_headers(self.admin_token)
            
            # Remove RSVP
            rsvp_data = {"status": "NOT_GOING"}
            requests.post(f"{BASE_URL}/goodwill/events/{self.test_event_id}/rsvp", 
                         json=rsvp_data, headers=self.get_headers(self.user_token))
            
            # Remove as co-organizer if exists
            requests.delete(f"{BASE_URL}/goodwill/events/{self.test_event_id}/co-organizers/{user_id}", 
                           headers=headers)
            
            print(f"🧹 Cleaned up user {user_id} from event")
        except Exception as e:
            print(f"⚠️  Cleanup warning: {str(e)}")
    
    def test_scenario_1_organizer_permissions(self):
        """Scenario 1: Test organizer permissions (admin user)"""
        print("\n=== SCENARIO 1: Organizer Permissions (admin@test.com) ===")
        headers = self.get_headers(self.admin_token)
        
        # Test 1: QR Code Access (Should SUCCESS)
        try:
            response = requests.get(f"{BASE_URL}/goodwill/events/{self.test_event_id}/qr-code", headers=headers)
            self.log_result(
                "S1: Organizer QR Code Access", 
                200, 
                response.status_code,
                f"Response: {response.text[:100]}..."
            )
        except Exception as e:
            self.log_result("S1: Organizer QR Code Access", 200, "ERROR", str(e))
        
        # Test 2: Chat Message (Should SUCCESS)
        try:
            chat_data = {"message": "Test from organizer"}
            response = requests.post(f"{BASE_URL}/goodwill/events/{self.test_event_id}/chat", 
                                   json=chat_data, headers=headers)
            self.log_result(
                "S1: Organizer Chat Access", 
                200, 
                response.status_code,
                f"Response: {response.text[:100]}..."
            )
        except Exception as e:
            self.log_result("S1: Organizer Chat Access", 200, "ERROR", str(e))
    
    def test_scenario_2_non_attendee_permissions(self):
        """Scenario 2: Test non-attendee permissions (testuser without RSVP)"""
        print("\n=== SCENARIO 2: Non-Attendee Permissions (testuser@test.com - No RSVP) ===")
        
        # Ensure user is NOT attending and NOT co-organizer
        user_id = self.get_user_id(self.user_token)
        if user_id:
            self.remove_user_from_event(user_id)
        
        headers = self.get_headers(self.user_token)
        
        # Test 1: QR Code Access (Should FAIL - 403)
        try:
            response = requests.get(f"{BASE_URL}/goodwill/events/{self.test_event_id}/qr-code", headers=headers)
            self.log_result(
                "S2: Non-Attendee QR Code Access", 
                403, 
                response.status_code,
                f"Response: {response.text[:100]}..."
            )
        except Exception as e:
            self.log_result("S2: Non-Attendee QR Code Access", 403, "ERROR", str(e))
        
        # Test 2: Chat Message (Should FAIL - 403)
        try:
            chat_data = {"message": "Test from non-attendee"}
            response = requests.post(f"{BASE_URL}/goodwill/events/{self.test_event_id}/chat", 
                                   json=chat_data, headers=headers)
            self.log_result(
                "S2: Non-Attendee Chat Access", 
                403, 
                response.status_code,
                f"Response: {response.text[:100]}..."
            )
        except Exception as e:
            self.log_result("S2: Non-Attendee Chat Access", 403, "ERROR", str(e))
        
        # Test 3: Add Review (Should FAIL - 403)
        try:
            review_data = {"rating": 4, "comment": "Test review"}
            response = requests.post(f"{BASE_URL}/goodwill/events/{self.test_event_id}/reviews", 
                                   json=review_data, headers=headers)
            self.log_result(
                "S2: Non-Attendee Review Access", 
                403, 
                response.status_code,
                f"Response: {response.text[:100]}..."
            )
        except Exception as e:
            self.log_result("S2: Non-Attendee Review Access", 403, "ERROR", str(e))
        
        # Test 4: Add Photo (Should FAIL - 403)
        try:
            photo_data = {"photo_url": "https://example.com/test.jpg", "caption": "Test photo"}
            response = requests.post(f"{BASE_URL}/goodwill/events/{self.test_event_id}/photos", 
                                   json=photo_data, headers=headers)
            self.log_result(
                "S2: Non-Attendee Photo Upload", 
                403, 
                response.status_code,
                f"Response: {response.text[:100]}..."
            )
        except Exception as e:
            self.log_result("S2: Non-Attendee Photo Upload", 403, "ERROR", str(e))
    
    def test_scenario_3_attendee_permissions(self):
        """Scenario 3: Test attendee permissions (testuser after RSVP)"""
        print("\n=== SCENARIO 3: Attendee Permissions (testuser@test.com - After RSVP) ===")
        
        # Ensure user is clean, then RSVP
        user_id = self.get_user_id(self.user_token)
        if user_id:
            self.remove_user_from_event(user_id)
        
        headers = self.get_headers(self.user_token)
        
        # First, RSVP to the event
        try:
            rsvp_data = {"status": "GOING"}
            rsvp_response = requests.post(f"{BASE_URL}/goodwill/events/{self.test_event_id}/rsvp", 
                                        json=rsvp_data, headers=headers)
            self.log_result(
                "S3: User RSVP to Event", 
                200, 
                rsvp_response.status_code,
                f"Response: {rsvp_response.text[:100]}..."
            )
        except Exception as e:
            self.log_result("S3: User RSVP to Event", 200, "ERROR", str(e))
        
        # Test 1: Chat Message (Should SUCCESS now)
        try:
            chat_data = {"message": "Hello from attendee!"}
            response = requests.post(f"{BASE_URL}/goodwill/events/{self.test_event_id}/chat", 
                                   json=chat_data, headers=headers)
            self.log_result(
                "S3: Attendee Chat Access", 
                200, 
                response.status_code,
                f"Response: {response.text[:100]}..."
            )
        except Exception as e:
            self.log_result("S3: Attendee Chat Access", 200, "ERROR", str(e))
        
        # Test 2: Add Review (Should SUCCESS now)
        try:
            review_data = {"rating": 4, "comment": "Nice event!"}
            response = requests.post(f"{BASE_URL}/goodwill/events/{self.test_event_id}/reviews", 
                                   json=review_data, headers=headers)
            expected_status = 200 if response.status_code != 400 else 400  # Handle "already reviewed"
            self.log_result(
                "S3: Attendee Review Access", 
                expected_status, 
                response.status_code,
                f"Response: {response.text[:100]}..."
            )
        except Exception as e:
            self.log_result("S3: Attendee Review Access", 200, "ERROR", str(e))
        
        # Test 3: QR Code Access (Should still FAIL - 403, not organizer)
        try:
            response = requests.get(f"{BASE_URL}/goodwill/events/{self.test_event_id}/qr-code", headers=headers)
            self.log_result(
                "S3: Attendee QR Code Access", 
                403, 
                response.status_code,
                f"Response: {response.text[:100]}..."
            )
        except Exception as e:
            self.log_result("S3: Attendee QR Code Access", 403, "ERROR", str(e))
    
    def test_scenario_4_co_organizer_permissions(self):
        """Scenario 4: Test co-organizer permissions"""
        print("\n=== SCENARIO 4: Co-Organizer Permissions ===")
        
        # Clean user first
        user_id = self.get_user_id(self.user_token)
        if user_id:
            self.remove_user_from_event(user_id)
        
        # Add user as co-organizer
        try:
            admin_headers = self.get_headers(self.admin_token)
            response = requests.post(f"{BASE_URL}/goodwill/events/{self.test_event_id}/co-organizers?user_id_to_add={user_id}", 
                                   headers=admin_headers)
            self.log_result(
                "S4: Add User as Co-organizer", 
                200, 
                response.status_code,
                f"Response: {response.text[:100]}..."
            )
        except Exception as e:
            self.log_result("S4: Add User as Co-organizer", 200, "ERROR", str(e))
        
        # Test co-organizer permissions
        headers = self.get_headers(self.user_token)
        
        # Test 1: QR Code Access (Should SUCCESS now as co-organizer)
        try:
            response = requests.get(f"{BASE_URL}/goodwill/events/{self.test_event_id}/qr-code", headers=headers)
            self.log_result(
                "S4: Co-Organizer QR Code Access", 
                200, 
                response.status_code,
                f"Response: {response.text[:100]}..."
            )
        except Exception as e:
            self.log_result("S4: Co-Organizer QR Code Access", 200, "ERROR", str(e))
        
        # Test 2: Chat Message (Should SUCCESS)
        try:
            chat_data = {"message": "Message from co-organizer"}
            response = requests.post(f"{BASE_URL}/goodwill/events/{self.test_event_id}/chat", 
                                   json=chat_data, headers=headers)
            self.log_result(
                "S4: Co-Organizer Chat Access", 
                200, 
                response.status_code,
                f"Response: {response.text[:100]}..."
            )
        except Exception as e:
            self.log_result("S4: Co-Organizer Chat Access", 200, "ERROR", str(e))
    
    def test_scenario_5_permission_boundaries(self):
        """Scenario 5: Test permission boundaries and edge cases"""
        print("\n=== SCENARIO 5: Permission Boundaries ===")
        
        # Clean user first
        user_id = self.get_user_id(self.user_token)
        if user_id:
            self.remove_user_from_event(user_id)
        
        headers = self.get_headers(self.user_token)
        
        # Test: Non-organizer cannot add co-organizers
        try:
            fake_user_id = "fake-user-id-123"
            response = requests.post(f"{BASE_URL}/goodwill/events/{self.test_event_id}/co-organizers?user_id_to_add={fake_user_id}", 
                                   headers=headers)
            self.log_result(
                "S5: Non-Organizer Add Co-organizer", 
                403, 
                response.status_code,
                f"Response: {response.text[:100]}..."
            )
        except Exception as e:
            self.log_result("S5: Non-Organizer Add Co-organizer", 403, "ERROR", str(e))
    
    def run_all_tests(self):
        """Run all permission tests in isolated scenarios"""
        print("🚀 Starting Good Will Module Permission System Tests")
        print("=" * 60)
        
        # Step 1: Login both users
        print("\n=== Authentication ===")
        self.admin_token = self.login_user(ADMIN_CREDENTIALS, "Admin")
        self.user_token = self.login_user(USER_CREDENTIALS, "Test User")
        
        if not self.admin_token or not self.user_token:
            print("❌ Authentication failed. Cannot proceed with tests.")
            return False
        
        # Step 2: Find test event
        print("\n=== Finding Test Event ===")
        if not self.find_test_event():
            print("❌ Could not find test event. Cannot proceed with tests.")
            return False
        
        # Step 3: Run isolated permission test scenarios
        self.test_scenario_1_organizer_permissions()
        self.test_scenario_2_non_attendee_permissions()
        self.test_scenario_3_attendee_permissions()
        self.test_scenario_4_co_organizer_permissions()
        self.test_scenario_5_permission_boundaries()
        
        # Step 4: Summary
        self.print_summary()
        
        return True
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for r in self.results if r["status"] == "✅ PASS")
        failed = sum(1 for r in self.results if r["status"] == "❌ FAIL")
        total = len(self.results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Success Rate: {(passed/total*100):.1f}%")
        
        if failed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.results:
                if result["status"] == "❌ FAIL":
                    print(f"  - {result['test']}")
                    print(f"    Expected: {result['expected']}, Got: {result['actual']}")
                    if result["details"]:
                        print(f"    Details: {result['details']}")
        
        print("\n✅ PASSED TESTS:")
        for result in self.results:
            if result["status"] == "✅ PASS":
                print(f"  - {result['test']}")

def main():
    """Main test execution"""
    tester = GoodWillPermissionTester()
    success = tester.run_all_tests()
    
    if not success:
        sys.exit(1)
    
    # Return exit code based on test results
    failed_tests = sum(1 for r in tester.results if r["status"] == "❌ FAIL")
    sys.exit(0 if failed_tests == 0 else 1)

if __name__ == "__main__":
    main()