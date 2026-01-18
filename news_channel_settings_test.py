#!/usr/bin/env python3
"""
NEWS Module Channel Settings Backend Testing
Testing the Channel Settings feature implementation.

Test Scope:
1. Authentication Test - Login with admin@test.com and testuser@test.com
2. Create Test Channel - POST /api/news/channels (for testing)
3. Update Channel Settings - PUT /api/news/channels/{channel_id}
   - Test updating channel name, description
   - Test updating avatar_url and cover_url (base64 and URL strings)
   - Test updating categories
   - Verify only owner can update (403 for non-owners)
   - Verify 404 for non-existent channel
4. Delete Channel - DELETE /api/news/channels/{channel_id}
   - Test successful deletion by owner
   - Verify 403 for non-owners

Test Credentials:
- Admin user: admin@test.com / testpassword123 (owns channels)
- Test user: testuser@test.com / testpassword123
"""

import requests
import json
import time
from datetime import datetime
import sys
import os
import base64

# Get backend URL from environment
BACKEND_URL = "https://dbfix-social.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

# Test credentials
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "testpassword123"
USER_EMAIL = "testuser@test.com"
USER_PASSWORD = "testpassword123"

class NewsChannelSettingsTester:
    def __init__(self):
        self.admin_token = None
        self.user_token = None
        self.admin_id = None
        self.user_id = None
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
    
    def test_create_test_channel(self):
        """Test 2: Create Test Channel for Settings Testing"""
        print("\n=== Test 2: Create Test Channel ===")
        
        if not self.admin_token:
            self.log_test("Create Test Channel", False, "Admin authentication required")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Create channel data
            channel_data = {
                "name": "Channel Settings Test Channel",
                "description": "Test channel for settings functionality",
                "categories": ["TECHNOLOGY", "SCIENCE"]
            }
                
            response = requests.post(f"{API_BASE}/news/channels", json=channel_data, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                self.test_channel_id = data.get("channel_id")
                self.log_test("Create Test Channel", True, f"Test channel created with ID: {self.test_channel_id}")
                return True
            else:
                self.log_test("Create Test Channel", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Create Test Channel", False, f"Error: {e}")
            return False
    
    def test_update_channel_basic_info(self):
        """Test 3a: Update Channel Basic Info (Name & Description)"""
        print("\n=== Test 3a: Update Channel Basic Info ===")
        
        if not self.admin_token or not self.test_channel_id:
            self.log_test("Update Channel Basic Info", False, "Authentication and channel ID required")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Update channel name and description
            update_data = {
                "name": "Updated Channel Settings Test",
                "description": "Updated description for channel settings testing"
            }
            
            response = requests.put(f"{API_BASE}/news/channels/{self.test_channel_id}", 
                                  json=update_data, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                updated_channel = data.get("channel", {})
                
                # Verify the updates
                if (updated_channel.get("name") == update_data["name"] and 
                    updated_channel.get("description") == update_data["description"]):
                    self.log_test("Update Channel Basic Info", True, "Name and description updated successfully")
                else:
                    self.log_test("Update Channel Basic Info", False, "Updated data doesn't match expected values")
                    
                return True
            else:
                self.log_test("Update Channel Basic Info", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Update Channel Basic Info", False, f"Error: {e}")
            return False
    
    def test_update_channel_images(self):
        """Test 3b: Update Channel Images (Avatar & Cover)"""
        print("\n=== Test 3b: Update Channel Images ===")
        
        if not self.admin_token or not self.test_channel_id:
            self.log_test("Update Channel Images", False, "Authentication and channel ID required")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Test with base64 encoded image (small test image)
            test_base64_image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
            test_url_image = "https://example.com/test-image.jpg"
            
            # Update with base64 avatar and URL cover
            update_data = {
                "avatar_url": test_base64_image,
                "cover_url": test_url_image
            }
            
            response = requests.put(f"{API_BASE}/news/channels/{self.test_channel_id}", 
                                  json=update_data, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                updated_channel = data.get("channel", {})
                
                # Verify the updates
                if (updated_channel.get("avatar_url") == test_base64_image and 
                    updated_channel.get("cover_url") == test_url_image):
                    self.log_test("Update Channel Images", True, "Avatar and cover images updated successfully")
                else:
                    self.log_test("Update Channel Images", False, "Updated image URLs don't match expected values")
                    
                return True
            else:
                self.log_test("Update Channel Images", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Update Channel Images", False, f"Error: {e}")
            return False
    
    def test_update_channel_categories(self):
        """Test 3c: Update Channel Categories"""
        print("\n=== Test 3c: Update Channel Categories ===")
        
        if not self.admin_token or not self.test_channel_id:
            self.log_test("Update Channel Categories", False, "Authentication and channel ID required")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Update categories
            update_data = {
                "categories": ["POLITICS", "ECONOMY", "HEALTH"]
            }
            
            response = requests.put(f"{API_BASE}/news/channels/{self.test_channel_id}", 
                                  json=update_data, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                updated_channel = data.get("channel", {})
                
                # Verify the categories update
                updated_categories = updated_channel.get("categories", [])
                expected_categories = set(update_data["categories"])
                actual_categories = set(updated_categories)
                
                if expected_categories == actual_categories:
                    self.log_test("Update Channel Categories", True, f"Categories updated successfully: {updated_categories}")
                else:
                    self.log_test("Update Channel Categories", False, f"Categories mismatch. Expected: {expected_categories}, Got: {actual_categories}")
                    
                return True
            else:
                self.log_test("Update Channel Categories", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Update Channel Categories", False, f"Error: {e}")
            return False
    
    def test_update_channel_invalid_categories(self):
        """Test 3d: Update Channel with Invalid Categories"""
        print("\n=== Test 3d: Update Channel with Invalid Categories ===")
        
        if not self.admin_token or not self.test_channel_id:
            self.log_test("Update Channel Invalid Categories", False, "Authentication and channel ID required")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Update with mix of valid and invalid categories
            update_data = {
                "categories": ["TECHNOLOGY", "INVALID_CATEGORY", "SPORTS", "ANOTHER_INVALID"]
            }
            
            response = requests.put(f"{API_BASE}/news/channels/{self.test_channel_id}", 
                                  json=update_data, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                updated_channel = data.get("channel", {})
                
                # Should only contain valid categories
                updated_categories = updated_channel.get("categories", [])
                valid_categories = ["TECHNOLOGY", "SPORTS"]
                
                if set(updated_categories) == set(valid_categories):
                    self.log_test("Update Channel Invalid Categories", True, f"Invalid categories filtered out correctly: {updated_categories}")
                else:
                    self.log_test("Update Channel Invalid Categories", False, f"Category filtering failed. Got: {updated_categories}")
                    
                return True
            else:
                self.log_test("Update Channel Invalid Categories", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Update Channel Invalid Categories", False, f"Error: {e}")
            return False
    
    def test_update_channel_unauthorized(self):
        """Test 4: Update Channel - Unauthorized User (403)"""
        print("\n=== Test 4: Update Channel - Unauthorized User ===")
        
        if not self.user_token or not self.test_channel_id:
            self.log_test("Update Channel Unauthorized", False, "User authentication and channel ID required")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.user_token}"}
            
            # Try to update channel as non-owner
            update_data = {
                "name": "Unauthorized Update Attempt",
                "description": "This should fail"
            }
            
            response = requests.put(f"{API_BASE}/news/channels/{self.test_channel_id}", 
                                  json=update_data, headers=headers)
            
            if response.status_code == 403:
                self.log_test("Update Channel Unauthorized", True, "Correctly returned 403 for non-owner")
                return True
            else:
                self.log_test("Update Channel Unauthorized", False, f"Expected 403, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Update Channel Unauthorized", False, f"Error: {e}")
            return False
    
    def test_update_nonexistent_channel(self):
        """Test 5: Update Non-existent Channel (404)"""
        print("\n=== Test 5: Update Non-existent Channel ===")
        
        if not self.admin_token:
            self.log_test("Update Nonexistent Channel", False, "Admin authentication required")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Try to update non-existent channel
            fake_channel_id = "nonexistent-channel-id-12345"
            update_data = {
                "name": "This Should Fail",
                "description": "Channel doesn't exist"
            }
            
            response = requests.put(f"{API_BASE}/news/channels/{fake_channel_id}", 
                                  json=update_data, headers=headers)
            
            if response.status_code == 404:
                self.log_test("Update Nonexistent Channel", True, "Correctly returned 404 for non-existent channel")
                return True
            else:
                self.log_test("Update Nonexistent Channel", False, f"Expected 404, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Update Nonexistent Channel", False, f"Error: {e}")
            return False
    
    def test_delete_channel_unauthorized(self):
        """Test 6: Delete Channel - Unauthorized User (403)"""
        print("\n=== Test 6: Delete Channel - Unauthorized User ===")
        
        if not self.user_token or not self.test_channel_id:
            self.log_test("Delete Channel Unauthorized", False, "User authentication and channel ID required")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.user_token}"}
            
            # Try to delete channel as non-owner
            response = requests.delete(f"{API_BASE}/news/channels/{self.test_channel_id}", headers=headers)
            
            if response.status_code == 403:
                self.log_test("Delete Channel Unauthorized", True, "Correctly returned 403 for non-owner deletion")
                return True
            else:
                self.log_test("Delete Channel Unauthorized", False, f"Expected 403, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Delete Channel Unauthorized", False, f"Error: {e}")
            return False
    
    def test_delete_nonexistent_channel(self):
        """Test 7: Delete Non-existent Channel (404)"""
        print("\n=== Test 7: Delete Non-existent Channel ===")
        
        if not self.admin_token:
            self.log_test("Delete Nonexistent Channel", False, "Admin authentication required")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Try to delete non-existent channel
            fake_channel_id = "nonexistent-channel-id-67890"
            response = requests.delete(f"{API_BASE}/news/channels/{fake_channel_id}", headers=headers)
            
            if response.status_code == 404:
                self.log_test("Delete Nonexistent Channel", True, "Correctly returned 404 for non-existent channel")
                return True
            else:
                self.log_test("Delete Nonexistent Channel", False, f"Expected 404, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Delete Nonexistent Channel", False, f"Error: {e}")
            return False
    
    def test_delete_channel_success(self):
        """Test 8: Delete Channel - Successful Deletion by Owner"""
        print("\n=== Test 8: Delete Channel - Successful Deletion ===")
        
        if not self.admin_token or not self.test_channel_id:
            self.log_test("Delete Channel Success", False, "Admin authentication and channel ID required")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Delete channel as owner
            response = requests.delete(f"{API_BASE}/news/channels/{self.test_channel_id}", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                message = data.get("message", "")
                
                if "deleted successfully" in message.lower():
                    self.log_test("Delete Channel Success", True, f"Channel deleted successfully: {message}")
                    
                    # Verify channel is actually deleted by trying to get it
                    get_response = requests.get(f"{API_BASE}/news/channels/{self.test_channel_id}", headers=headers)
                    
                    if get_response.status_code == 404:
                        self.log_test("Delete Channel Verification", True, "Channel confirmed deleted (404 on GET)")
                    else:
                        self.log_test("Delete Channel Verification", False, f"Channel still exists after deletion (GET returned {get_response.status_code})")
                        
                else:
                    self.log_test("Delete Channel Success", False, f"Unexpected response message: {message}")
                    
                return True
            else:
                self.log_test("Delete Channel Success", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Delete Channel Success", False, f"Error: {e}")
            return False
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting NEWS Module Channel Settings Backend Testing")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Test Time: {datetime.now().isoformat()}")
        
        # Run tests in order
        if not self.test_authentication():
            print("❌ Authentication failed - stopping tests")
            return
            
        if not self.test_create_test_channel():
            print("❌ Test channel creation failed - stopping tests")
            return
            
        # Test channel updates
        self.test_update_channel_basic_info()
        self.test_update_channel_images()
        self.test_update_channel_categories()
        self.test_update_channel_invalid_categories()
        
        # Test authorization and error cases
        self.test_update_channel_unauthorized()
        self.test_update_nonexistent_channel()
        self.test_delete_channel_unauthorized()
        self.test_delete_nonexistent_channel()
        
        # Test successful deletion (should be last)
        self.test_delete_channel_success()
        
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
            print("\n🎉 ALL TESTS PASSED - Channel Settings feature is PRODUCTION READY!")
        elif passed_tests >= total_tests * 0.8:
            print("\n✅ MOSTLY WORKING - Channel Settings feature is functional with minor issues")
        else:
            print("\n⚠️  SIGNIFICANT ISSUES - Channel Settings feature needs attention")

if __name__ == "__main__":
    tester = NewsChannelSettingsTester()
    tester.run_all_tests()