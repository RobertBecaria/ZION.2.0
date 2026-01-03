#!/usr/bin/env python3
"""
NEWS Module Phase 4: Official Channels Backend Testing
Testing the Official Channels feature implementation.

Test Scope:
1. Authentication Test - Login with admin@test.com and testuser@test.com
2. Get Admin Organizations - GET /api/users/me/admin-organizations
3. Create Official Channel - POST /api/news/channels with organization_id
4. Get Channels with Organization Info - GET /api/news/channels
5. Get Channel Details - GET /api/news/channels/{channel_id}
6. User Search - GET /api/users/search?query=test
7. Add Moderator - POST /api/news/channels/{channel_id}/moderators
8. Get Moderators - GET /api/news/channels/{channel_id}/moderators
9. Remove Moderator - DELETE /api/news/channels/{channel_id}/moderators/{user_id}

Test Credentials:
- User 1 (Admin): admin@test.com / testpassword123
- User 2 (Test User): testuser@test.com / testpassword123
"""

import requests
import json
import time
from datetime import datetime
import sys
import os

# Get backend URL from environment
BACKEND_URL = "https://personal-ai-chat-24.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

# Test credentials
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "testpassword123"
USER_EMAIL = "testuser@test.com"
USER_PASSWORD = "testpassword123"

class NewsOfficialChannelsTester:
    def __init__(self):
        self.admin_token = None
        self.user_token = None
        self.admin_id = None
        self.user_id = None
        self.admin_organizations = []
        self.test_channel_id = None
        self.test_results = []
        
    def log_test(self, test_name, success, details=""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
        
    def authenticate_user(self, email, password):
        """Authenticate user and return token and user info"""
        try:
            # Login request
            login_data = {
                "email": email,
                "password": password
            }
            
            response = requests.post(f"{API_BASE}/auth/login", json=login_data)
            
            if response.status_code == 200:
                data = response.json()
                token = data.get("access_token")
                
                # Get user info
                headers = {"Authorization": f"Bearer {token}"}
                me_response = requests.get(f"{API_BASE}/auth/me", headers=headers)
                
                if me_response.status_code == 200:
                    user_info = me_response.json()
                    return token, user_info.get("id"), user_info
                else:
                    return None, None, None
            else:
                return None, None, None
                
        except Exception as e:
            print(f"Authentication error: {e}")
            return None, None, None
    
    def test_authentication(self):
        """Test 1: Authentication Test"""
        print("\n=== Test 1: Authentication Test ===")
        
        # Test Admin authentication
        self.admin_token, self.admin_id, admin_info = self.authenticate_user(ADMIN_EMAIL, ADMIN_PASSWORD)
        
        if self.admin_token and self.admin_id:
            self.log_test("Admin Authentication", True, f"Token obtained for admin {self.admin_id}")
        else:
            self.log_test("Admin Authentication", False, "Failed to authenticate admin")
            return False
            
        # Test User authentication
        self.user_token, self.user_id, user_info = self.authenticate_user(USER_EMAIL, USER_PASSWORD)
        
        if self.user_token and self.user_id:
            self.log_test("User Authentication", True, f"Token obtained for user {self.user_id}")
        else:
            self.log_test("User Authentication", False, "Failed to authenticate user")
            return False
            
        return True
    
    def test_get_admin_organizations(self):
        """Test 2: Get Admin Organizations"""
        print("\n=== Test 2: Get Admin Organizations ===")
        
        if not self.admin_token:
            self.log_test("Get Admin Organizations", False, "Admin authentication required")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.get(f"{API_BASE}/users/me/admin-organizations", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                organizations = data.get("organizations", [])
                self.admin_organizations = organizations
                
                if organizations:
                    self.log_test("Get Admin Organizations", True, f"Found {len(organizations)} admin organizations")
                    for org in organizations:
                        print(f"   - {org.get('name')} (ID: {org.get('id')})")
                else:
                    self.log_test("Get Admin Organizations", True, "No admin organizations found (expected for test)")
                    
                return True
            else:
                self.log_test("Get Admin Organizations", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Get Admin Organizations", False, f"Error: {e}")
            return False
    
    def test_create_official_channel(self):
        """Test 3: Create Official Channel"""
        print("\n=== Test 3: Create Official Channel ===")
        
        if not self.admin_token:
            self.log_test("Create Official Channel", False, "Admin authentication required")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Create channel data
            channel_data = {
                "name": "Test Official Channel",
                "description": "Testing official channel creation",
                "categories": ["TECHNOLOGY"]
            }
            
            # If we have admin organizations, use the first one
            if self.admin_organizations:
                channel_data["organization_id"] = self.admin_organizations[0]["id"]
                
            response = requests.post(f"{API_BASE}/news/channels", json=channel_data, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                self.test_channel_id = data.get("channel_id")
                
                if self.admin_organizations:
                    self.log_test("Create Official Channel", True, f"Official channel created with ID: {self.test_channel_id}")
                else:
                    self.log_test("Create Personal Channel", True, f"Personal channel created with ID: {self.test_channel_id}")
                    
                return True
            else:
                self.log_test("Create Official Channel", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Create Official Channel", False, f"Error: {e}")
            return False
    
    def test_get_channels(self):
        """Test 4: Get Channels with Organization Info"""
        print("\n=== Test 4: Get Channels with Organization Info ===")
        
        if not self.admin_token:
            self.log_test("Get Channels", False, "Authentication required")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.get(f"{API_BASE}/news/channels", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                channels = data.get("channels", [])
                
                self.log_test("Get Channels", True, f"Retrieved {len(channels)} channels")
                
                # Check if our test channel is in the list
                test_channel_found = False
                for channel in channels:
                    if channel.get("id") == self.test_channel_id:
                        test_channel_found = True
                        is_official = channel.get("is_official", False)
                        is_verified = channel.get("is_verified", False)
                        organization_info = channel.get("organization")
                        
                        print(f"   Test Channel Found: Official={is_official}, Verified={is_verified}")
                        if organization_info:
                            print(f"   Organization: {organization_info.get('name')}")
                        break
                        
                if test_channel_found:
                    self.log_test("Test Channel in List", True, "Test channel found in channels list")
                else:
                    self.log_test("Test Channel in List", False, "Test channel not found in channels list")
                    
                return True
            else:
                self.log_test("Get Channels", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Get Channels", False, f"Error: {e}")
            return False
    
    def test_get_channel_details(self):
        """Test 5: Get Channel Details"""
        print("\n=== Test 5: Get Channel Details ===")
        
        if not self.admin_token or not self.test_channel_id:
            self.log_test("Get Channel Details", False, "Authentication and channel ID required")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.get(f"{API_BASE}/news/channels/{self.test_channel_id}", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                channel = data.get("channel", {})
                
                is_moderator = data.get("is_moderator", False)
                organization_info = channel.get("organization")
                
                self.log_test("Get Channel Details", True, f"Retrieved channel details, is_moderator={is_moderator}")
                
                if organization_info:
                    print(f"   Organization: {organization_info.get('name')}")
                    
                return True
            else:
                self.log_test("Get Channel Details", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Get Channel Details", False, f"Error: {e}")
            return False
    
    def test_user_search(self):
        """Test 6: User Search"""
        print("\n=== Test 6: User Search ===")
        
        if not self.admin_token:
            self.log_test("User Search", False, "Authentication required")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.get(f"{API_BASE}/users/search?query=test", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                users = data.get("users", [])
                
                self.log_test("User Search", True, f"Found {len(users)} users matching 'test'")
                
                # Check if testuser is in results
                testuser_found = False
                for user in users:
                    if user.get("email") == USER_EMAIL:
                        testuser_found = True
                        print(f"   Found testuser: {user.get('first_name')} {user.get('last_name')}")
                        break
                        
                if testuser_found:
                    self.log_test("Testuser in Search Results", True, "Testuser found in search results")
                else:
                    self.log_test("Testuser in Search Results", False, "Testuser not found in search results")
                    
                return True
            else:
                self.log_test("User Search", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("User Search", False, f"Error: {e}")
            return False
    
    def test_add_moderator(self):
        """Test 7: Add Moderator"""
        print("\n=== Test 7: Add Moderator ===")
        
        if not self.admin_token or not self.test_channel_id or not self.user_id:
            self.log_test("Add Moderator", False, "Authentication, channel ID, and user ID required")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            moderator_data = {
                "user_id": self.user_id,
                "can_post": True,
                "can_delete_posts": True,
                "can_pin_posts": False
            }
            
            response = requests.post(f"{API_BASE}/news/channels/{self.test_channel_id}/moderators", 
                                   json=moderator_data, headers=headers)
            
            if response.status_code == 200:
                self.log_test("Add Moderator", True, f"Successfully added user {self.user_id} as moderator")
                return True
            else:
                self.log_test("Add Moderator", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Add Moderator", False, f"Error: {e}")
            return False
    
    def test_get_moderators(self):
        """Test 8: Get Moderators"""
        print("\n=== Test 8: Get Moderators ===")
        
        if not self.admin_token or not self.test_channel_id:
            self.log_test("Get Moderators", False, "Authentication and channel ID required")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.get(f"{API_BASE}/news/channels/{self.test_channel_id}/moderators", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                moderators = data.get("moderators", [])
                
                self.log_test("Get Moderators", True, f"Retrieved {len(moderators)} moderators")
                
                # Check if our test user is in the moderators list
                testuser_moderator = False
                for mod in moderators:
                    if mod.get("user_id") == self.user_id:
                        testuser_moderator = True
                        permissions = {
                            "can_post": mod.get("can_post"),
                            "can_delete_posts": mod.get("can_delete_posts"),
                            "can_pin_posts": mod.get("can_pin_posts")
                        }
                        print(f"   Testuser moderator permissions: {permissions}")
                        break
                        
                if testuser_moderator:
                    self.log_test("Testuser as Moderator", True, "Testuser found in moderators list")
                else:
                    self.log_test("Testuser as Moderator", False, "Testuser not found in moderators list")
                    
                return True
            else:
                self.log_test("Get Moderators", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Get Moderators", False, f"Error: {e}")
            return False
    
    def test_remove_moderator(self):
        """Test 9: Remove Moderator"""
        print("\n=== Test 9: Remove Moderator ===")
        
        if not self.admin_token or not self.test_channel_id or not self.user_id:
            self.log_test("Remove Moderator", False, "Authentication, channel ID, and user ID required")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.delete(f"{API_BASE}/news/channels/{self.test_channel_id}/moderators/{self.user_id}", 
                                     headers=headers)
            
            if response.status_code == 200:
                self.log_test("Remove Moderator", True, f"Successfully removed user {self.user_id} as moderator")
                
                # Verify removal by checking moderators list
                get_response = requests.get(f"{API_BASE}/news/channels/{self.test_channel_id}/moderators", headers=headers)
                if get_response.status_code == 200:
                    data = get_response.json()
                    moderators = data.get("moderators", [])
                    
                    testuser_still_moderator = any(mod.get("user_id") == self.user_id for mod in moderators)
                    
                    if not testuser_still_moderator:
                        self.log_test("Moderator Removal Verification", True, "Testuser successfully removed from moderators")
                    else:
                        self.log_test("Moderator Removal Verification", False, "Testuser still appears in moderators list")
                        
                return True
            else:
                self.log_test("Remove Moderator", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Remove Moderator", False, f"Error: {e}")
            return False
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting NEWS Module Phase 4: Official Channels Backend Testing")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Test Time: {datetime.now().isoformat()}")
        
        # Run tests in order
        if not self.test_authentication():
            print("❌ Authentication failed - stopping tests")
            return
            
        self.test_get_admin_organizations()
        
        if not self.test_create_official_channel():
            print("❌ Channel creation failed - stopping tests")
            return
            
        self.test_get_channels()
        self.test_get_channel_details()
        self.test_user_search()
        self.test_add_moderator()
        self.test_get_moderators()
        self.test_remove_moderator()
        
        # Print summary
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("📊 TEST SUMMARY")
        print("="*60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        print("\n✅ PASSED TESTS:")
        for result in self.test_results:
            if result["success"]:
                print(f"  - {result['test']}")
                
        # Overall assessment
        if passed_tests == total_tests:
            print("\n🎉 ALL TESTS PASSED - Official Channels feature is PRODUCTION READY!")
        elif passed_tests >= total_tests * 0.8:
            print("\n✅ MOSTLY WORKING - Official Channels feature is functional with minor issues")
        else:
            print("\n⚠️  SIGNIFICANT ISSUES - Official Channels feature needs attention")

if __name__ == "__main__":
    tester = NewsOfficialChannelsTester()
    tester.run_all_tests()