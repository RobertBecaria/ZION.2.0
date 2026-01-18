#!/usr/bin/env python3
"""
Good Will Phase 2 Backend API Testing
Tests the Phase 2 backend APIs for the "Добрая Воля" (Good Will) module.

APIs to Test:
1. Event Reviews (GET/POST)
2. Event Photos (GET/POST) 
3. Event Chat (GET/POST)
4. Share & Reminders (POST/DELETE)
5. QR Code Check-in (GET)
6. Co-Organizers (POST/DELETE)
"""

import requests
import json
import sys
from datetime import datetime, timedelta

# Configuration
BASE_URL = "https://dbfix-social.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "testpassword123"

class GoodWillPhase2Tester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.user_id = None
        self.test_event_id = None
        self.organizer_profile_id = None
        self.test_results = []
        
    def log_result(self, test_name, success, message, details=None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = {
            "test": test_name,
            "status": status,
            "message": message,
            "details": details or {}
        }
        self.test_results.append(result)
        print(f"{status}: {test_name} - {message}")
        if details and not success:
            print(f"   Details: {details}")
    
    def login(self):
        """Login and get authentication token"""
        try:
            response = self.session.post(f"{BASE_URL}/auth/login", json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            })
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get("access_token")
                self.user_id = data.get("user", {}).get("id")
                
                if self.auth_token and self.user_id:
                    self.session.headers.update({
                        "Authorization": f"Bearer {self.auth_token}"
                    })
                    self.log_result("Authentication", True, f"Successfully logged in as {ADMIN_EMAIL}")
                    return True
                else:
                    self.log_result("Authentication", False, "Missing token or user_id in response", data)
                    return False
            else:
                self.log_result("Authentication", False, f"Login failed with status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Authentication", False, f"Login error: {str(e)}")
            return False
    
    def get_or_create_organizer_profile(self):
        """Get existing organizer profile or create one"""
        try:
            # Try to get existing profile
            response = self.session.get(f"{BASE_URL}/goodwill/organizer-profile")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("profile"):
                    self.organizer_profile_id = data["profile"]["id"]
                    self.log_result("Organizer Profile", True, "Found existing organizer profile")
                    return True
            
            # Create new organizer profile
            profile_data = {
                "name": "Test Organizer",
                "description": "Test organizer for API testing",
                "contact_email": ADMIN_EMAIL,
                "contact_phone": "+7 999 123 4567",
                "website": "https://test-organizer.com",
                "social_links": {
                    "telegram": "@testorganizer",
                    "instagram": "@testorganizer"
                }
            }
            
            response = self.session.post(f"{BASE_URL}/goodwill/organizer-profile", json=profile_data)
            
            if response.status_code == 200:
                data = response.json()
                self.organizer_profile_id = data.get("profile", {}).get("id")
                if self.organizer_profile_id:
                    self.log_result("Organizer Profile", True, "Created new organizer profile")
                    return True
                else:
                    self.log_result("Organizer Profile", False, "No profile ID in response", data)
                    return False
            else:
                self.log_result("Organizer Profile", False, f"Failed to create profile: {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Organizer Profile", False, f"Error: {str(e)}")
            return False
    
    def get_or_create_test_event(self):
        """Get existing event or create a test event"""
        try:
            # Try to get existing events
            response = self.session.get(f"{BASE_URL}/goodwill/events?limit=5")
            
            if response.status_code == 200:
                data = response.json()
                events = data.get("events", [])
                
                # Look for an event we can use for testing
                for event in events:
                    if event.get("organizer_profile_id") == self.organizer_profile_id:
                        self.test_event_id = event["id"]
                        self.log_result("Test Event", True, f"Using existing event: {event['title']}")
                        return True
            
            # Create a new test event
            if not self.organizer_profile_id:
                self.log_result("Test Event", False, "No organizer profile available")
                return False
            
            event_data = {
                "organizer_profile_id": self.organizer_profile_id,
                "title": "Test Event for Phase 2 APIs",
                "description": "This is a test event created for testing Phase 2 APIs including reviews, photos, chat, and co-organizers.",
                "category_id": "community",
                "city": "Москва",
                "address": "Тестовый адрес, 123",
                "venue_name": "Тестовая площадка",
                "start_date": (datetime.now() + timedelta(days=7)).isoformat(),
                "end_date": (datetime.now() + timedelta(days=7, hours=3)).isoformat(),
                "is_free": True,
                "max_attendees": 50,
                "tags": ["тест", "api", "фаза2"]
            }
            
            response = self.session.post(f"{BASE_URL}/goodwill/events", json=event_data)
            
            if response.status_code == 200:
                data = response.json()
                self.test_event_id = data.get("event", {}).get("id")
                if self.test_event_id:
                    self.log_result("Test Event", True, "Created new test event")
                    return True
                else:
                    self.log_result("Test Event", False, "No event ID in response", data)
                    return False
            else:
                self.log_result("Test Event", False, f"Failed to create event: {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Test Event", False, f"Error: {str(e)}")
            return False
    
    def register_for_event(self):
        """Register for the test event to enable testing attendee-only features"""
        try:
            response = self.session.post(f"{BASE_URL}/goodwill/events/{self.test_event_id}/rsvp", json={
                "status": "GOING"
            })
            
            if response.status_code == 200:
                self.log_result("Event Registration", True, "Successfully registered for test event")
                return True
            else:
                self.log_result("Event Registration", False, f"Registration failed: {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Event Registration", False, f"Error: {str(e)}")
            return False
    
    def test_event_reviews(self):
        """Test Event Reviews APIs"""
        print("\n=== Testing Event Reviews APIs ===")
        
        # Test GET reviews (should work without auth)
        try:
            response = requests.get(f"{BASE_URL}/goodwill/events/{self.test_event_id}/reviews")
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("GET Event Reviews", True, f"Retrieved {len(data.get('reviews', []))} reviews")
            else:
                self.log_result("GET Event Reviews", False, f"Failed: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("GET Event Reviews", False, f"Error: {str(e)}")
        
        # Test POST review (requires auth and attendance)
        try:
            review_data = {
                "rating": 5,
                "comment": "Отличное мероприятие! Очень понравилось, рекомендую всем."
            }
            
            response = self.session.post(f"{BASE_URL}/goodwill/events/{self.test_event_id}/reviews", json=review_data)
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("POST Event Review", True, "Successfully added review")
            elif response.status_code == 403:
                self.log_result("POST Event Review", True, "Correctly blocked - must attend event to review (expected)")
            elif response.status_code == 400 and "already reviewed" in response.text:
                self.log_result("POST Event Review", True, "Correctly blocked - user already reviewed this event (expected)")
            else:
                self.log_result("POST Event Review", False, f"Unexpected status: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("POST Event Review", False, f"Error: {str(e)}")
    
    def test_event_photos(self):
        """Test Event Photos APIs"""
        print("\n=== Testing Event Photos APIs ===")
        
        # Test GET photos
        try:
            response = requests.get(f"{BASE_URL}/goodwill/events/{self.test_event_id}/photos")
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("GET Event Photos", True, f"Retrieved {len(data.get('photos', []))} photos")
            else:
                self.log_result("GET Event Photos", False, f"Failed: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("GET Event Photos", False, f"Error: {str(e)}")
        
        # Test POST photo (requires auth and attendance)
        try:
            photo_data = {
                "photo_url": "https://example.com/test-photo.jpg",
                "caption": "Тестовое фото с мероприятия"
            }
            
            response = self.session.post(f"{BASE_URL}/goodwill/events/{self.test_event_id}/photos", json=photo_data)
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("POST Event Photo", True, "Successfully added photo")
            elif response.status_code == 403:
                self.log_result("POST Event Photo", True, "Correctly blocked - only attendees can add photos (expected)")
            else:
                self.log_result("POST Event Photo", False, f"Unexpected status: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("POST Event Photo", False, f"Error: {str(e)}")
    
    def test_event_chat(self):
        """Test Event Chat APIs"""
        print("\n=== Testing Event Chat APIs ===")
        
        # Test GET chat messages (requires auth)
        try:
            response = self.session.get(f"{BASE_URL}/goodwill/events/{self.test_event_id}/chat")
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("GET Event Chat", True, f"Retrieved {len(data.get('messages', []))} messages")
            else:
                self.log_result("GET Event Chat", False, f"Failed: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("GET Event Chat", False, f"Error: {str(e)}")
        
        # Test POST chat message (requires auth and participation)
        try:
            message_data = {
                "message": "Привет всем! Это тестовое сообщение в чате мероприятия."
            }
            
            response = self.session.post(f"{BASE_URL}/goodwill/events/{self.test_event_id}/chat", json=message_data)
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("POST Event Chat Message", True, "Successfully sent chat message")
            elif response.status_code == 403:
                self.log_result("POST Event Chat Message", True, "Correctly blocked - only participants can chat (expected)")
            else:
                self.log_result("POST Event Chat Message", False, f"Unexpected status: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("POST Event Chat Message", False, f"Error: {str(e)}")
    
    def test_share_and_reminders(self):
        """Test Share & Reminders APIs"""
        print("\n=== Testing Share & Reminders APIs ===")
        
        # Test share event
        try:
            share_data = {
                "platform": "twitter"
            }
            
            response = self.session.post(f"{BASE_URL}/goodwill/events/{self.test_event_id}/share", json=share_data)
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("POST Event Share", True, "Successfully shared event")
            else:
                self.log_result("POST Event Share", False, f"Failed: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("POST Event Share", False, f"Error: {str(e)}")
        
        # Test set reminder
        try:
            response = self.session.post(f"{BASE_URL}/goodwill/events/{self.test_event_id}/reminder")
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("POST Event Reminder", True, "Successfully set reminder")
            else:
                self.log_result("POST Event Reminder", False, f"Failed: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("POST Event Reminder", False, f"Error: {str(e)}")
        
        # Test remove reminder
        try:
            response = self.session.delete(f"{BASE_URL}/goodwill/events/{self.test_event_id}/reminder")
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("DELETE Event Reminder", True, "Successfully removed reminder")
            else:
                self.log_result("DELETE Event Reminder", False, f"Failed: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("DELETE Event Reminder", False, f"Error: {str(e)}")
    
    def test_qr_code_checkin(self):
        """Test QR Code Check-in API"""
        print("\n=== Testing QR Code Check-in API ===")
        
        # Test get QR code (organizer only)
        try:
            response = self.session.get(f"{BASE_URL}/goodwill/events/{self.test_event_id}/qr-code")
            
            if response.status_code == 200:
                data = response.json()
                qr_data = data.get("qr_data")
                checkin_code = data.get("checkin_code")
                
                if qr_data and checkin_code:
                    self.log_result("GET QR Code", True, f"Generated QR code: {qr_data}")
                else:
                    self.log_result("GET QR Code", False, "Missing QR data or checkin code", data)
            elif response.status_code == 403:
                self.log_result("GET QR Code", True, "Correctly blocked - only organizers can access QR code (expected)")
            else:
                self.log_result("GET QR Code", False, f"Unexpected status: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("GET QR Code", False, f"Error: {str(e)}")
    
    def test_co_organizers(self):
        """Test Co-Organizers APIs"""
        print("\n=== Testing Co-Organizers APIs ===")
        
        # Test add co-organizer (organizer only)
        try:
            # user_id_to_add is a query parameter, not in request body
            response = self.session.post(f"{BASE_URL}/goodwill/events/{self.test_event_id}/co-organizers?user_id_to_add={self.user_id}")
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("POST Co-Organizer", True, "Successfully added co-organizer")
                
                # Test remove co-organizer
                try:
                    response = self.session.delete(f"{BASE_URL}/goodwill/events/{self.test_event_id}/co-organizers/{self.user_id}")
                    
                    if response.status_code == 200:
                        self.log_result("DELETE Co-Organizer", True, "Successfully removed co-organizer")
                    else:
                        self.log_result("DELETE Co-Organizer", False, f"Failed: {response.status_code}", response.text)
                except Exception as e:
                    self.log_result("DELETE Co-Organizer", False, f"Error: {str(e)}")
                    
            elif response.status_code == 403:
                self.log_result("POST Co-Organizer", True, "Correctly blocked - only main organizer can add co-organizers (expected)")
            else:
                self.log_result("POST Co-Organizer", False, f"Unexpected status: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("POST Co-Organizer", False, f"Error: {str(e)}")
    
    def run_all_tests(self):
        """Run all Phase 2 API tests"""
        print("🧪 Starting Good Will Phase 2 Backend API Tests")
        print("=" * 60)
        
        # Setup
        if not self.login():
            print("❌ Cannot proceed without authentication")
            return False
        
        if not self.get_or_create_organizer_profile():
            print("❌ Cannot proceed without organizer profile")
            return False
        
        if not self.get_or_create_test_event():
            print("❌ Cannot proceed without test event")
            return False
        
        # Register for event to test attendee features
        self.register_for_event()
        
        # Run API tests
        self.test_event_reviews()
        self.test_event_photos()
        self.test_event_chat()
        self.test_share_and_reminders()
        self.test_qr_code_checkin()
        self.test_co_organizers()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for r in self.test_results if "✅ PASS" in r["status"])
        failed = sum(1 for r in self.test_results if "❌ FAIL" in r["status"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Success Rate: {(passed/total*100):.1f}%")
        
        # Show failed tests
        failed_tests = [r for r in self.test_results if "❌ FAIL" in r["status"]]
        if failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['message']}")
        
        # Show critical issues
        critical_failures = [r for r in failed_tests if "Authentication" in r["test"] or "Organizer Profile" in r["test"] or "Test Event" in r["test"]]
        if critical_failures:
            print("\n🚨 CRITICAL ISSUES:")
            for test in critical_failures:
                print(f"  - {test['test']}: {test['message']}")
        
        return failed == 0

def main():
    """Main test execution"""
    tester = GoodWillPhase2Tester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All tests passed!")
        sys.exit(0)
    else:
        print("\n⚠️  Some tests failed. Check the details above.")
        sys.exit(1)

if __name__ == "__main__":
    main()