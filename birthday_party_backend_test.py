#!/usr/bin/env python3

import requests
import json
import sys
from datetime import datetime, date

# Configuration
BASE_URL = "https://personal-ai-chat-24.preview.emergentagent.com/api"
TEST_EMAIL = "admin@test.com"
TEST_PASSWORD = "testpassword123"
ORG_ID = "7b2aba34-723f-4f5a-bd93-c451d94452cd"

class BirthdayPartyTester:
    def __init__(self):
        self.token = None
        self.headers = {}
        self.test_results = []
        
    def log_test(self, test_name, success, details=""):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        print()
    
    def authenticate(self):
        """Authenticate and get token"""
        print("🔐 Authenticating...")
        try:
            response = requests.post(f"{BASE_URL}/auth/login", json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            })
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("access_token")
                self.headers = {"Authorization": f"Bearer {self.token}"}
                self.log_test("Authentication", True, f"Token obtained successfully")
                return True
            else:
                self.log_test("Authentication", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Authentication", False, f"Exception: {str(e)}")
            return False
    
    def test_create_birthday_party_event(self):
        """Test creating a birthday party event with birthday_party_data"""
        print("🎂 Testing Birthday Party Event Creation...")
        
        # Test data for birthday party
        birthday_event_data = {
            "title": "Emma's 8th Birthday Party! 🎉",
            "description": "Join us for Emma's magical 8th birthday celebration with games, cake, and fun!",
            "event_type": "BIRTHDAY",
            "start_date": "2024-12-15",
            "start_time": "14:00",
            "end_time": "17:00",
            "location": "Community Center - Main Hall",
            "is_all_day": False,
            "audience_type": "PUBLIC",
            "requires_rsvp": True,
            "max_attendees": 25,
            "birthday_party_data": {
                "theme": "PINK",
                "custom_message": "Come celebrate Emma's special day with us! There will be princess games, face painting, and lots of fun activities!",
                "wish_list": ["Art supplies", "Books", "Puzzles", "Dolls", "Board games"],
                "birthday_child_name": "Emma Johnson",
                "birthday_child_age": 8
            }
        }
        
        try:
            response = requests.post(
                f"{BASE_URL}/journal/organizations/{ORG_ID}/calendar",
                json=birthday_event_data,
                headers=self.headers
            )
            
            if response.status_code == 200:
                data = response.json()
                event_id = data.get("id")
                
                # Verify birthday_party_data is included in response
                birthday_data = data.get("birthday_party_data")
                if birthday_data:
                    # Check all birthday party fields
                    theme_correct = birthday_data.get("theme") == "PINK"
                    message_correct = "Emma's special day" in birthday_data.get("custom_message", "")
                    wish_list_correct = len(birthday_data.get("wish_list", [])) == 5
                    child_name_correct = birthday_data.get("birthday_child_name") == "Emma Johnson"
                    child_age_correct = birthday_data.get("birthday_child_age") == 8
                    
                    if all([theme_correct, message_correct, wish_list_correct, child_name_correct, child_age_correct]):
                        self.log_test("Create Birthday Party Event", True, 
                                    f"Event created with ID: {event_id}. All birthday party data verified: theme={birthday_data.get('theme')}, child={birthday_data.get('birthday_child_name')}, age={birthday_data.get('birthday_child_age')}")
                        return event_id
                    else:
                        self.log_test("Create Birthday Party Event", False, 
                                    f"Birthday party data incomplete or incorrect: {birthday_data}")
                        return None
                else:
                    self.log_test("Create Birthday Party Event", False, 
                                "Birthday party data missing from response")
                    return None
            else:
                self.log_test("Create Birthday Party Event", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
                return None
                
        except Exception as e:
            self.log_test("Create Birthday Party Event", False, f"Exception: {str(e)}")
            return None
    
    def test_get_events_with_birthday_data(self, event_id):
        """Test retrieving events and verify birthday_party_data is included"""
        print("📅 Testing Event Retrieval with Birthday Data...")
        
        try:
            response = requests.get(
                f"{BASE_URL}/journal/organizations/{ORG_ID}/calendar",
                headers=self.headers
            )
            
            if response.status_code == 200:
                events = response.json()
                
                # Find our birthday event
                birthday_event = None
                for event in events:
                    if event.get("id") == event_id:
                        birthday_event = event
                        break
                
                if birthday_event:
                    birthday_data = birthday_event.get("birthday_party_data")
                    if birthday_data:
                        # Verify all birthday party data is present
                        required_fields = ["theme", "custom_message", "wish_list", "birthday_child_name", "birthday_child_age"]
                        missing_fields = [field for field in required_fields if field not in birthday_data]
                        
                        if not missing_fields:
                            self.log_test("Get Events with Birthday Data", True, 
                                        f"Birthday event found with complete data: theme={birthday_data.get('theme')}, wishes={len(birthday_data.get('wish_list', []))}")
                            return True
                        else:
                            self.log_test("Get Events with Birthday Data", False, 
                                        f"Missing birthday party fields: {missing_fields}")
                            return False
                    else:
                        self.log_test("Get Events with Birthday Data", False, 
                                    "Birthday party data missing from event")
                        return False
                else:
                    self.log_test("Get Events with Birthday Data", False, 
                                f"Birthday event with ID {event_id} not found in events list")
                    return False
            else:
                self.log_test("Get Events with Birthday Data", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Get Events with Birthday Data", False, f"Exception: {str(e)}")
            return False
    
    def test_rsvp_with_dietary_restrictions(self, event_id):
        """Test RSVP with dietary_restrictions field for birthday events"""
        print("🍰 Testing RSVP with Dietary Restrictions...")
        
        rsvp_data = {
            "status": "YES",
            "dietary_restrictions": "Nut allergy - please no peanuts or tree nuts. Also vegetarian preferred."
        }
        
        try:
            response = requests.post(
                f"{BASE_URL}/journal/calendar/{event_id}/rsvp",
                json=rsvp_data,
                headers=self.headers
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("RSVP with Dietary Restrictions", True, 
                            f"RSVP submitted successfully: {data.get('message', 'Success')}")
                return True
            else:
                self.log_test("RSVP with Dietary Restrictions", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("RSVP with Dietary Restrictions", False, f"Exception: {str(e)}")
            return False
    
    def test_get_rsvp_details(self, event_id):
        """Test getting RSVP details and verify dietary_restrictions are included"""
        print("📋 Testing RSVP Details Retrieval...")
        
        try:
            response = requests.get(
                f"{BASE_URL}/journal/calendar/{event_id}/rsvp",
                headers=self.headers
            )
            
            if response.status_code == 200:
                rsvp_data = response.json()
                
                # Check if dietary restrictions are included in rsvp_responses
                rsvp_responses = rsvp_data.get("rsvp_responses", [])
                dietary_restrictions_found = False
                
                for rsvp in rsvp_responses:
                    dietary_restrictions = rsvp.get("dietary_restrictions")
                    if dietary_restrictions and "Nut allergy" in dietary_restrictions:
                        dietary_restrictions_found = True
                        self.log_test("Get RSVP Details", True, 
                                    f"RSVP details retrieved with dietary restrictions: {dietary_restrictions}")
                        return True
                
                if not dietary_restrictions_found:
                    self.log_test("Get RSVP Details", False, 
                                f"Dietary restrictions not found in RSVP responses: {rsvp_responses}")
                    return False
            else:
                self.log_test("Get RSVP Details", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Get RSVP Details", False, f"Exception: {str(e)}")
            return False
    
    def test_classmates_endpoint(self):
        """Test the classmates endpoint for birthday party invitations"""
        print("👫 Testing Classmates Endpoint...")
        
        try:
            # Test without class filter
            response = requests.get(
                f"{BASE_URL}/journal/organizations/{ORG_ID}/classmates",
                headers=self.headers
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify response structure
                required_fields = ["organization_id", "classmates", "total_count"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    classmates = data.get("classmates", [])
                    total_count = data.get("total_count", 0)
                    
                    # Verify classmate structure if any exist
                    if classmates:
                        first_classmate = classmates[0]
                        classmate_fields = ["id", "student_id", "first_name", "last_name", "full_name"]
                        missing_classmate_fields = [field for field in classmate_fields if field not in first_classmate]
                        
                        if not missing_classmate_fields:
                            self.log_test("Classmates Endpoint", True, 
                                        f"Found {total_count} classmates. Sample: {first_classmate.get('full_name', 'N/A')}")
                        else:
                            self.log_test("Classmates Endpoint", False, 
                                        f"Classmate data missing fields: {missing_classmate_fields}")
                    else:
                        self.log_test("Classmates Endpoint", True, 
                                    f"Endpoint working, no classmates found (total_count: {total_count})")
                    
                    return True
                else:
                    self.log_test("Classmates Endpoint", False, 
                                f"Response missing required fields: {missing_fields}")
                    return False
            else:
                self.log_test("Classmates Endpoint", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Classmates Endpoint", False, f"Exception: {str(e)}")
            return False
    
    def test_classmates_with_class_filter(self):
        """Test the classmates endpoint with class filter"""
        print("🎓 Testing Classmates Endpoint with Class Filter...")
        
        try:
            # Test with class filter
            response = requests.get(
                f"{BASE_URL}/journal/organizations/{ORG_ID}/classmates?assigned_class=5А",
                headers=self.headers
            )
            
            if response.status_code == 200:
                data = response.json()
                assigned_class = data.get("assigned_class")
                
                if assigned_class == "5А":
                    classmates = data.get("classmates", [])
                    # Verify all returned classmates are from the specified class
                    wrong_class_students = [c for c in classmates if c.get("assigned_class") != "5А" and c.get("assigned_class") is not None]
                    
                    if not wrong_class_students:
                        self.log_test("Classmates with Class Filter", True, 
                                    f"Class filter working correctly. Found {len(classmates)} students in class 5А")
                        return True
                    else:
                        self.log_test("Classmates with Class Filter", False, 
                                    f"Class filter not working properly. Found students from other classes: {wrong_class_students}")
                        return False
                else:
                    self.log_test("Classmates with Class Filter", False, 
                                f"Class filter not applied correctly. Expected '5А', got '{assigned_class}'")
                    return False
            else:
                self.log_test("Classmates with Class Filter", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Classmates with Class Filter", False, f"Exception: {str(e)}")
            return False
    
    def test_blue_theme_birthday_party(self):
        """Test creating a birthday party with BLUE theme"""
        print("💙 Testing Blue Theme Birthday Party...")
        
        blue_party_data = {
            "title": "Alex's 10th Birthday Adventure! 🚀",
            "description": "Join Alex for an awesome space-themed birthday party!",
            "event_type": "BIRTHDAY",
            "start_date": "2024-12-20",
            "start_time": "15:00",
            "end_time": "18:00",
            "location": "Backyard Space Station",
            "is_all_day": False,
            "audience_type": "PUBLIC",
            "requires_rsvp": True,
            "max_attendees": 20,
            "birthday_party_data": {
                "theme": "BLUE",
                "custom_message": "Blast off to Alex's space adventure birthday party! Astronaut training included!",
                "wish_list": ["LEGO sets", "Science kits", "Space books", "Model rockets", "Telescope"],
                "birthday_child_name": "Alex Smith",
                "birthday_child_age": 10
            }
        }
        
        try:
            response = requests.post(
                f"{BASE_URL}/journal/organizations/{ORG_ID}/calendar",
                json=blue_party_data,
                headers=self.headers
            )
            
            if response.status_code == 200:
                data = response.json()
                birthday_data = data.get("birthday_party_data")
                
                if birthday_data and birthday_data.get("theme") == "BLUE":
                    self.log_test("Blue Theme Birthday Party", True, 
                                f"Blue theme party created successfully for {birthday_data.get('birthday_child_name')}")
                    return data.get("id")
                else:
                    self.log_test("Blue Theme Birthday Party", False, 
                                f"Blue theme not set correctly: {birthday_data}")
                    return None
            else:
                self.log_test("Blue Theme Birthday Party", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
                return None
                
        except Exception as e:
            self.log_test("Blue Theme Birthday Party", False, f"Exception: {str(e)}")
            return None
    
    def run_all_tests(self):
        """Run all birthday party invitation tests"""
        print("🎉 Starting Birthday Party Invitations Feature Testing...")
        print("=" * 60)
        
        # Step 1: Authenticate
        if not self.authenticate():
            print("❌ Authentication failed. Cannot proceed with tests.")
            return False
        
        # Step 2: Test creating birthday party event (PINK theme)
        event_id = self.test_create_birthday_party_event()
        if not event_id:
            print("❌ Birthday party creation failed. Some tests may be skipped.")
        
        # Step 3: Test retrieving events with birthday data
        if event_id:
            self.test_get_events_with_birthday_data(event_id)
        
        # Step 4: Test RSVP with dietary restrictions
        if event_id:
            self.test_rsvp_with_dietary_restrictions(event_id)
        
        # Step 5: Test getting RSVP details
        if event_id:
            self.test_get_rsvp_details(event_id)
        
        # Step 6: Test classmates endpoint
        self.test_classmates_endpoint()
        
        # Step 7: Test classmates with class filter
        self.test_classmates_with_class_filter()
        
        # Step 8: Test BLUE theme birthday party
        blue_event_id = self.test_blue_theme_birthday_party()
        
        # Print summary
        self.print_summary()
        
        return True
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("🎂 BIRTHDAY PARTY INVITATIONS FEATURE TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {success_rate:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  • {result['test']}: {result['details']}")
        
        print("\n✅ PASSED TESTS:")
        for result in self.test_results:
            if result["success"]:
                print(f"  • {result['test']}")
        
        # Overall assessment
        if success_rate >= 90:
            print(f"\n🎉 EXCELLENT! Birthday Party Invitations feature is working perfectly!")
        elif success_rate >= 75:
            print(f"\n✅ GOOD! Birthday Party Invitations feature is mostly working with minor issues.")
        elif success_rate >= 50:
            print(f"\n⚠️  PARTIAL! Birthday Party Invitations feature has some significant issues.")
        else:
            print(f"\n❌ CRITICAL! Birthday Party Invitations feature has major problems.")

if __name__ == "__main__":
    tester = BirthdayPartyTester()
    tester.run_all_tests()