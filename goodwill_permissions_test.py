#!/usr/bin/env python3
"""
Good Will Module Permission System Testing
Tests different user roles and their permissions for Good Will events
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
                
                # Look for an event where admin is organizer
                for event in events:
                    # Get organizer profile to check if admin owns it
                    organizer_id = event.get("organizer_profile_id")
                    if organizer_id:
                        org_response = requests.get(f"{BASE_URL}/goodwill/organizer-profile/{organizer_id}", headers=headers)
                        if org_response.status_code == 200:
                            organizer = org_response.json()
                            # Check if this organizer belongs to admin (we'll assume first event for testing)
                            self.test_event_id = event["id"]
                            print(f"✅ Found test event: {event['title']} (ID: {self.test_event_id})")
                            return True
                
                # If no suitable event found, we'll use the first available event
                if events:
                    self.test_event_id = events[0]["id"]
                    print(f"⚠️  Using first available event: {events[0]['title']} (ID: {self.test_event_id})")
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
    
    def test_organizer_permissions(self):
        """Test organizer permissions (admin user)"""
        print("\n=== Testing Organizer Permissions (admin@test.com) ===")
        headers = self.get_headers(self.admin_token)
        
        # Test 1: QR Code Access (Should SUCCESS)
        try:
            response = requests.get(f"{BASE_URL}/goodwill/events/{self.test_event_id}/qr-code", headers=headers)
            self.log_result(
                "Organizer QR Code Access", 
                200, 
                response.status_code,
                f"Response: {response.text[:200]}"
            )
        except Exception as e:
            self.log_result("Organizer QR Code Access", 200, "ERROR", str(e))
        
        # Test 2: Chat Message (Should SUCCESS)
        try:
            chat_data = {"message": "Test message from organizer"}
            response = requests.post(f"{BASE_URL}/goodwill/events/{self.test_event_id}/chat", 
                                   json=chat_data, headers=headers)
            self.log_result(
                "Organizer Chat Access", 
                200, 
                response.status_code,
                f"Response: {response.text[:200]}"
            )
        except Exception as e:
            self.log_result("Organizer Chat Access", 200, "ERROR", str(e))
        
        # Test 3: Add Co-organizer (Should SUCCESS)
        try:
            # We'll try to add the test user as co-organizer
            # First get user ID
            user_response = requests.get(f"{BASE_URL}/auth/me", headers=self.get_headers(self.user_token))
            if user_response.status_code == 200:
                user_id = user_response.json().get("id")
                # Store user_id for later use in co-organizer tests
                self.test_user_id = user_id
                # API expects user_id_to_add as query parameter
                response = requests.post(f"{BASE_URL}/goodwill/events/{self.test_event_id}/co-organizers?user_id_to_add={user_id}", 
                                       headers=headers)
                self.log_result(
                    "Organizer Add Co-organizer", 
                    200, 
                    response.status_code,
                    f"Response: {response.text[:200]}"
                )
            else:
                self.log_result("Organizer Add Co-organizer", 200, "ERROR", "Could not get user ID")
        except Exception as e:
            self.log_result("Organizer Add Co-organizer", 200, "ERROR", str(e))
    
    def test_non_attendee_permissions(self):
        """Test non-attendee permissions (testuser without RSVP)"""
        print("\n=== Testing Non-Attendee Permissions (testuser@test.com - No RSVP) ===")
        headers = self.get_headers(self.user_token)
        
        # Test 1: QR Code Access (Should FAIL - 403)
        try:
            response = requests.get(f"{BASE_URL}/goodwill/events/{self.test_event_id}/qr-code", headers=headers)
            self.log_result(
                "Non-Attendee QR Code Access", 
                403, 
                response.status_code,
                f"Response: {response.text[:200]}"
            )
        except Exception as e:
            self.log_result("Non-Attendee QR Code Access", 403, "ERROR", str(e))
        
        # Test 2: Chat Message (Should FAIL - 403)
        try:
            chat_data = {"message": "Test message from non-attendee"}
            response = requests.post(f"{BASE_URL}/goodwill/events/{self.test_event_id}/chat", 
                                   json=chat_data, headers=headers)
            self.log_result(
                "Non-Attendee Chat Access", 
                403, 
                response.status_code,
                f"Response: {response.text[:200]}"
            )
        except Exception as e:
            self.log_result("Non-Attendee Chat Access", 403, "ERROR", str(e))
        
        # Test 3: Add Review (Should FAIL - 403)
        try:
            review_data = {"rating": 4, "comment": "Test review from non-attendee"}
            response = requests.post(f"{BASE_URL}/goodwill/events/{self.test_event_id}/reviews", 
                                   json=review_data, headers=headers)
            self.log_result(
                "Non-Attendee Review Access", 
                403, 
                response.status_code,
                f"Response: {response.text[:200]}"
            )
        except Exception as e:
            self.log_result("Non-Attendee Review Access", 403, "ERROR", str(e))
        
        # Test 4: Add Photo (Should FAIL - 403)
        try:
            photo_data = {"photo_url": "https://example.com/test.jpg", "caption": "Test photo"}
            response = requests.post(f"{BASE_URL}/goodwill/events/{self.test_event_id}/photos", 
                                   json=photo_data, headers=headers)
            self.log_result(
                "Non-Attendee Photo Upload", 
                403, 
                response.status_code,
                f"Response: {response.text[:200]}"
            )
        except Exception as e:
            self.log_result("Non-Attendee Photo Upload", 403, "ERROR", str(e))
    
    def test_attendee_permissions(self):
        """Test attendee permissions (testuser after RSVP)"""
        print("\n=== Testing Attendee Permissions (testuser@test.com - After RSVP) ===")
        headers = self.get_headers(self.user_token)
        
        # First, RSVP to the event
        try:
            rsvp_data = {"status": "GOING"}
            rsvp_response = requests.post(f"{BASE_URL}/goodwill/events/{self.test_event_id}/rsvp", 
                                        json=rsvp_data, headers=headers)
            self.log_result(
                "User RSVP to Event", 
                200, 
                rsvp_response.status_code,
                f"Response: {rsvp_response.text[:200]}"
            )
        except Exception as e:
            self.log_result("User RSVP to Event", 200, "ERROR", str(e))
        
        # Test 1: Chat Message (Should SUCCESS now)
        try:
            chat_data = {"message": "Hello from attendee!"}
            response = requests.post(f"{BASE_URL}/goodwill/events/{self.test_event_id}/chat", 
                                   json=chat_data, headers=headers)
            self.log_result(
                "Attendee Chat Access", 
                200, 
                response.status_code,
                f"Response: {response.text[:200]}"
            )
        except Exception as e:
            self.log_result("Attendee Chat Access", 200, "ERROR", str(e))
        
        # Test 2: Add Review (Should SUCCESS now)
        try:
            review_data = {"rating": 4, "comment": "Nice event!"}
            response = requests.post(f"{BASE_URL}/goodwill/events/{self.test_event_id}/reviews", 
                                   json=review_data, headers=headers)
            self.log_result(
                "Attendee Review Access", 
                200, 
                response.status_code,
                f"Response: {response.text[:200]}"
            )
        except Exception as e:
            self.log_result("Attendee Review Access", 200, "ERROR", str(e))
        
        # Test 3: QR Code Access (Should still FAIL - 403, not organizer)
        try:
            response = requests.get(f"{BASE_URL}/goodwill/events/{self.test_event_id}/qr-code", headers=headers)
            self.log_result(
                "Attendee QR Code Access", 
                403, 
                response.status_code,
                f"Response: {response.text[:200]}"
            )
        except Exception as e:
            self.log_result("Attendee QR Code Access", 403, "ERROR", str(e))
    
    def test_co_organizer_permissions(self):
        """Test co-organizer permissions (testuser after being added as co-organizer)"""
        print("\n=== Testing Co-Organizer Permissions (testuser@test.com - As Co-organizer) ===")
        headers = self.get_headers(self.user_token)
        
        # Test 1: QR Code Access (Should SUCCESS now as co-organizer)
        try:
            response = requests.get(f"{BASE_URL}/goodwill/events/{self.test_event_id}/qr-code", headers=headers)
            self.log_result(
                "Co-Organizer QR Code Access", 
                200, 
                response.status_code,
                f"Response: {response.text[:200]}"
            )
        except Exception as e:
            self.log_result("Co-Organizer QR Code Access", 200, "ERROR", str(e))
        
        # Test 2: Chat Message (Should SUCCESS)
        try:
            chat_data = {"message": "Message from co-organizer"}
            response = requests.post(f"{BASE_URL}/goodwill/events/{self.test_event_id}/chat", 
                                   json=chat_data, headers=headers)
            self.log_result(
                "Co-Organizer Chat Access", 
                200, 
                response.status_code,
                f"Response: {response.text[:200]}"
            )
        except Exception as e:
            self.log_result("Co-Organizer Chat Access", 200, "ERROR", str(e))
    
    def test_error_messages_language(self):
        """Test that error messages are in Russian"""
        print("\n=== Testing Error Message Language ===")
        headers = self.get_headers(self.user_token)
        
        # Remove RSVP first to test non-attendee error
        try:
            rsvp_data = {"status": "NOT_GOING"}
            requests.post(f"{BASE_URL}/goodwill/events/{self.test_event_id}/rsvp", 
                         json=rsvp_data, headers=headers)
        except:
            pass
        
        # Test Russian error message for chat access
        try:
            chat_data = {"message": "Test message"}
            response = requests.post(f"{BASE_URL}/goodwill/events/{self.test_event_id}/chat", 
                                   json=chat_data, headers=headers)
            if response.status_code == 403:
                error_msg = response.json().get("detail", "")
                # Check if error message contains English (should be Russian)
                has_english = any(word in error_msg.lower() for word in ["only", "participants", "can", "chat"])
                self.log_result(
                    "Error Message Language (Russian)", 
                    False,  # We expect NO English words
                    has_english,
                    f"Error message: {error_msg}"
                )
        except Exception as e:
            self.log_result("Error Message Language (Russian)", False, "ERROR", str(e))
    
    def run_all_tests(self):
        """Run all permission tests"""
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
        
        # Step 3: Run permission tests
        self.test_organizer_permissions()
        self.test_non_attendee_permissions()
        self.test_attendee_permissions()
        self.test_co_organizer_permissions()
        self.test_error_messages_language()
        
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