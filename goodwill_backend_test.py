#!/usr/bin/env python3
"""
Good Will (Добрая Воля) Module Backend API Tests
Testing comprehensive events and gatherings platform functionality
"""

import requests
import json
import sys
from datetime import datetime, timedelta

# Get backend URL from environment
BACKEND_URL = "https://social-login-fix.preview.emergentagent.com/api"

# Test credentials
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "testpassword123"

class GoodWillTester:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
        self.test_results = []
        
    def log_result(self, test_name, success, details="", error=""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = {
            "test": test_name,
            "status": status,
            "details": details,
            "error": error
        }
        self.test_results.append(result)
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        if error:
            print(f"   Error: {error}")
        print()
    
    def login_admin(self):
        """Login as admin user"""
        try:
            response = self.session.post(f"{BACKEND_URL}/auth/login", json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            })
            
            if response.status_code == 200:
                data = response.json()
                self.admin_token = data.get("access_token")
                self.session.headers.update({"Authorization": f"Bearer {self.admin_token}"})
                self.log_result("Admin Login", True, f"Logged in as {ADMIN_EMAIL}")
                return True
            else:
                self.log_result("Admin Login", False, error=f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Admin Login", False, error=str(e))
            return False
    
    def test_categories_api(self):
        """Test GET /api/goodwill/categories"""
        try:
            response = self.session.get(f"{BACKEND_URL}/goodwill/categories")
            
            if response.status_code == 200:
                data = response.json()
                categories = data.get('categories', [])
                if isinstance(categories, list) and len(categories) > 0:
                    category_names = [cat.get('name', 'Unknown') for cat in categories]
                    self.log_result("Categories API", True, 
                                  f"Found {len(categories)} categories: {', '.join(category_names[:5])}")
                else:
                    self.log_result("Categories API", False, error="Empty or invalid categories list")
            else:
                self.log_result("Categories API", False, 
                              error=f"Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_result("Categories API", False, error=str(e))
    
    def test_organizer_profile_api(self):
        """Test GET /api/goodwill/organizer-profile (with auth)"""
        try:
            response = self.session.get(f"{BACKEND_URL}/goodwill/organizer-profile")
            
            if response.status_code == 200:
                profile = response.json()
                if profile and 'name' in profile:
                    self.log_result("Organizer Profile API", True, 
                                  f"Profile found: {profile.get('name', 'Unknown')}")
                else:
                    self.log_result("Organizer Profile API", True, 
                                  "No existing profile (expected for new users)")
            elif response.status_code == 404:
                self.log_result("Organizer Profile API", True, 
                              "No profile found (expected for new organizers)")
            else:
                self.log_result("Organizer Profile API", False, 
                              error=f"Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_result("Organizer Profile API", False, error=str(e))
    
    def test_events_search_api(self):
        """Test GET /api/goodwill/events with filters"""
        try:
            # Test basic events list
            response = self.session.get(f"{BACKEND_URL}/goodwill/events")
            
            if response.status_code == 200:
                data = response.json()
                events = data.get('events', [])
                total = data.get('total', 0)
                
                self.log_result("Events Search API - Basic", True, 
                              f"Found {total} total events, returned {len(events)} events")
                
                # Test with filters if events exist
                if len(events) > 0:
                    # Test city filter
                    first_event = events[0]
                    city = first_event.get('city')
                    if city:
                        city_response = self.session.get(f"{BACKEND_URL}/goodwill/events?city={city}")
                        if city_response.status_code == 200:
                            city_data = city_response.json()
                            city_events = city_data.get('events', [])
                            self.log_result("Events Search API - City Filter", True, 
                                          f"City '{city}' filter returned {len(city_events)} events")
                        else:
                            self.log_result("Events Search API - City Filter", False, 
                                          error=f"Status: {city_response.status_code}")
                    
                    # Test free events filter
                    free_response = self.session.get(f"{BACKEND_URL}/goodwill/events?is_free=true")
                    if free_response.status_code == 200:
                        free_data = free_response.json()
                        free_events = free_data.get('events', [])
                        self.log_result("Events Search API - Free Filter", True, 
                                      f"Free events filter returned {len(free_events)} events")
                    else:
                        self.log_result("Events Search API - Free Filter", False, 
                                      error=f"Status: {free_response.status_code}")
                
            else:
                self.log_result("Events Search API - Basic", False, 
                              error=f"Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_result("Events Search API", False, error=str(e))
    
    def test_event_detail_api(self):
        """Test GET /api/goodwill/events/{event_id}"""
        try:
            # First get events list to find an event ID
            response = self.session.get(f"{BACKEND_URL}/goodwill/events")
            
            if response.status_code == 200:
                data = response.json()
                events = data.get('events', [])
                
                if len(events) > 0:
                    event_id = events[0].get('id')
                    if event_id:
                        # Test event detail
                        detail_response = self.session.get(f"{BACKEND_URL}/goodwill/events/{event_id}")
                        
                        if detail_response.status_code == 200:
                            event_detail = detail_response.json()
                            title = event_detail.get('title', 'Unknown')
                            organizer = event_detail.get('organizer', {})
                            organizer_name = organizer.get('name', 'Unknown') if organizer else 'Unknown'
                            
                            self.log_result("Event Detail API", True, 
                                          f"Event '{title}' by organizer '{organizer_name}'")
                        else:
                            self.log_result("Event Detail API", False, 
                                          error=f"Status: {detail_response.status_code}, Response: {detail_response.text}")
                    else:
                        self.log_result("Event Detail API", False, error="No event ID found in events list")
                else:
                    self.log_result("Event Detail API", False, error="No events found to test detail API")
            else:
                self.log_result("Event Detail API", False, 
                              error=f"Failed to get events list: {response.status_code}")
                
        except Exception as e:
            self.log_result("Event Detail API", False, error=str(e))
    
    def test_rsvp_api(self):
        """Test POST /api/goodwill/events/{event_id}/rsvp"""
        try:
            # First get events list to find an event ID
            response = self.session.get(f"{BACKEND_URL}/goodwill/events")
            
            if response.status_code == 200:
                data = response.json()
                events = data.get('events', [])
                
                if len(events) > 0:
                    event_id = events[0].get('id')
                    if event_id:
                        # Test RSVP
                        rsvp_response = self.session.post(f"{BACKEND_URL}/goodwill/events/{event_id}/rsvp", 
                                                        json={"status": "GOING"})
                        
                        if rsvp_response.status_code == 200:
                            rsvp_data = rsvp_response.json()
                            message = rsvp_data.get('message', 'RSVP successful')
                            self.log_result("RSVP API", True, f"RSVP status updated: {message}")
                        else:
                            self.log_result("RSVP API", False, 
                                          error=f"Status: {rsvp_response.status_code}, Response: {rsvp_response.text}")
                    else:
                        self.log_result("RSVP API", False, error="No event ID found in events list")
                else:
                    self.log_result("RSVP API", False, error="No events found to test RSVP API")
            else:
                self.log_result("RSVP API", False, 
                              error=f"Failed to get events list: {response.status_code}")
                
        except Exception as e:
            self.log_result("RSVP API", False, error=str(e))
    
    def test_ticket_purchase_api(self):
        """Test POST /api/goodwill/events/{event_id}/purchase-ticket"""
        try:
            # First get events list to find a paid event
            response = self.session.get(f"{BACKEND_URL}/goodwill/events?is_free=false")
            
            if response.status_code == 200:
                data = response.json()
                events = data.get('events', [])
                
                if len(events) > 0:
                    event = events[0]
                    event_id = event.get('id')
                    ticket_types = event.get('ticket_types', [])
                    
                    if event_id and ticket_types:
                        ticket_type_id = ticket_types[0].get('id')
                        if ticket_type_id:
                            # Test ticket purchase
                            purchase_response = self.session.post(
                                f"{BACKEND_URL}/goodwill/events/{event_id}/purchase-ticket", 
                                json={
                                    "event_id": event_id,
                                    "ticket_type_id": ticket_type_id,
                                    "pay_with_altyn": True
                                }
                            )
                            
                            if purchase_response.status_code == 200:
                                purchase_data = purchase_response.json()
                                receipt = purchase_data.get('receipt', {})
                                receipt_id = receipt.get('receipt_id', 'Unknown')
                                self.log_result("Ticket Purchase API", True, 
                                              f"Ticket purchased successfully, Receipt ID: {receipt_id}")
                            elif purchase_response.status_code == 400:
                                # Insufficient balance is expected
                                error_msg = purchase_response.json().get('detail', 'Unknown error')
                                if 'insufficient' in error_msg.lower():
                                    self.log_result("Ticket Purchase API", True, 
                                                  f"Payment validation working: {error_msg}")
                                else:
                                    self.log_result("Ticket Purchase API", False, 
                                                  error=f"Unexpected error: {error_msg}")
                            else:
                                self.log_result("Ticket Purchase API", False, 
                                              error=f"Status: {purchase_response.status_code}, Response: {purchase_response.text}")
                        else:
                            self.log_result("Ticket Purchase API", False, error="No ticket type ID found")
                    else:
                        self.log_result("Ticket Purchase API", False, error="No paid event with ticket types found")
                else:
                    self.log_result("Ticket Purchase API", False, error="No paid events found to test purchase API")
            else:
                self.log_result("Ticket Purchase API", False, 
                              error=f"Failed to get paid events: {response.status_code}")
                
        except Exception as e:
            self.log_result("Ticket Purchase API", False, error=str(e))
    
    def test_groups_api(self):
        """Test GET /api/goodwill/groups"""
        try:
            response = self.session.get(f"{BACKEND_URL}/goodwill/groups")
            
            if response.status_code == 200:
                data = response.json()
                groups = data.get('groups', [])
                total = data.get('total', 0)
                if isinstance(groups, list):
                    self.log_result("Interest Groups API", True, 
                                  f"Found {total} interest groups (returned {len(groups)} groups)")
                else:
                    self.log_result("Interest Groups API", False, error="Invalid groups response format")
            else:
                self.log_result("Interest Groups API", False, 
                              error=f"Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_result("Interest Groups API", False, error=str(e))
    
    def test_calendar_api(self):
        """Test GET /api/goodwill/calendar?month=12&year=2025"""
        try:
            response = self.session.get(f"{BACKEND_URL}/goodwill/calendar?month=12&year=2025")
            
            if response.status_code == 200:
                data = response.json()
                calendar_data = data.get('calendar', {})
                month = data.get('month')
                year = data.get('year')
                
                if isinstance(calendar_data, dict):
                    total_events = sum(len(events) for events in calendar_data.values() if isinstance(events, list))
                    self.log_result("Calendar API", True, 
                                  f"Calendar data retrieved for {month}/{year}, {total_events} events found across {len(calendar_data)} dates")
                else:
                    self.log_result("Calendar API", False, error="Invalid calendar response format")
            else:
                self.log_result("Calendar API", False, 
                              error=f"Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_result("Calendar API", False, error=str(e))
    
    def run_all_tests(self):
        """Run all Good Will module tests"""
        print("=" * 60)
        print("GOOD WILL (ДОБРАЯ ВОЛЯ) MODULE BACKEND API TESTS")
        print("=" * 60)
        print()
        
        # Login first
        if not self.login_admin():
            print("❌ Cannot proceed without admin login")
            return False
        
        # Run all tests
        self.test_categories_api()
        self.test_organizer_profile_api()
        self.test_events_search_api()
        self.test_event_detail_api()
        self.test_rsvp_api()
        self.test_ticket_purchase_api()
        self.test_groups_api()
        self.test_calendar_api()
        
        # Summary
        print("=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if "✅ PASS" in result["status"])
        failed = sum(1 for result in self.test_results if "❌ FAIL" in result["status"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Success Rate: {(passed/total*100):.1f}%" if total > 0 else "0%")
        print()
        
        if failed > 0:
            print("FAILED TESTS:")
            for result in self.test_results:
                if "❌ FAIL" in result["status"]:
                    print(f"  - {result['test']}: {result['error']}")
            print()
        
        return failed == 0

if __name__ == "__main__":
    tester = GoodWillTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)