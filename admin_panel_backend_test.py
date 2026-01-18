#!/usr/bin/env python3
"""
Admin Panel Backend API Testing for ZION.CITY Platform
Tests all admin endpoints with proper authentication and error handling.
"""

import requests
import json
import sys
from datetime import datetime
import time

# Test Configuration
BACKEND_URL = "https://social-login-fix.preview.emergentagent.com/api"
ADMIN_USERNAME = "Architect"
ADMIN_PASSWORD = "X17resto1!X21resto1!"

class AdminPanelTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.admin_token = None
        self.test_results = []
        self.session = requests.Session()
        
    def log_test(self, test_name, success, details="", response_data=None):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat(),
            "response_data": response_data
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"    Details: {details}")
        if not success and response_data:
            print(f"    Response: {response_data}")
        print()

    def test_admin_login_success(self):
        """Test admin login with correct credentials"""
        try:
            response = self.session.post(
                f"{self.base_url}/admin/login",
                json={
                    "username": ADMIN_USERNAME,
                    "password": ADMIN_PASSWORD
                },
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if "access_token" in data and "admin_name" in data:
                    self.admin_token = data["access_token"]
                    self.log_test(
                        "Admin Login (Success)", 
                        True, 
                        f"Successfully logged in as {data['admin_name']}, token received"
                    )
                    return True
                else:
                    self.log_test(
                        "Admin Login (Success)", 
                        False, 
                        "Missing access_token or admin_name in response", 
                        data
                    )
            else:
                self.log_test(
                    "Admin Login (Success)", 
                    False, 
                    f"Expected 200, got {response.status_code}", 
                    response.text
                )
        except Exception as e:
            self.log_test("Admin Login (Success)", False, f"Exception: {str(e)}")
        return False

    def test_admin_login_failure(self):
        """Test admin login with incorrect credentials"""
        try:
            response = self.session.post(
                f"{self.base_url}/admin/login",
                json={
                    "username": "wrong_user",
                    "password": "wrong_password"
                },
                timeout=10
            )
            
            if response.status_code == 401:
                data = response.json()
                if "detail" in data:
                    self.log_test(
                        "Admin Login (Failure)", 
                        True, 
                        f"Correctly rejected invalid credentials: {data['detail']}"
                    )
                    return True
                else:
                    self.log_test(
                        "Admin Login (Failure)", 
                        False, 
                        "Missing error detail in 401 response", 
                        data
                    )
            else:
                self.log_test(
                    "Admin Login (Failure)", 
                    False, 
                    f"Expected 401, got {response.status_code}", 
                    response.text
                )
        except Exception as e:
            self.log_test("Admin Login (Failure)", False, f"Exception: {str(e)}")
        return False

    def test_admin_verify_valid_token(self):
        """Test admin token verification with valid token"""
        if not self.admin_token:
            self.log_test("Admin Verify (Valid Token)", False, "No admin token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.get(
                f"{self.base_url}/admin/verify",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("valid") == True and "admin_name" in data:
                    self.log_test(
                        "Admin Verify (Valid Token)", 
                        True, 
                        f"Token verified for admin: {data['admin_name']}"
                    )
                    return True
                else:
                    self.log_test(
                        "Admin Verify (Valid Token)", 
                        False, 
                        "Invalid response structure", 
                        data
                    )
            else:
                self.log_test(
                    "Admin Verify (Valid Token)", 
                    False, 
                    f"Expected 200, got {response.status_code}", 
                    response.text
                )
        except Exception as e:
            self.log_test("Admin Verify (Valid Token)", False, f"Exception: {str(e)}")
        return False

    def test_admin_verify_invalid_token(self):
        """Test admin token verification with invalid token"""
        try:
            headers = {"Authorization": "Bearer invalid_token_12345"}
            response = self.session.get(
                f"{self.base_url}/admin/verify",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 401:
                data = response.json()
                if "detail" in data:
                    self.log_test(
                        "Admin Verify (Invalid Token)", 
                        True, 
                        f"Correctly rejected invalid token: {data['detail']}"
                    )
                    return True
                else:
                    self.log_test(
                        "Admin Verify (Invalid Token)", 
                        False, 
                        "Missing error detail in 401 response", 
                        data
                    )
            else:
                self.log_test(
                    "Admin Verify (Invalid Token)", 
                    False, 
                    f"Expected 401, got {response.status_code}", 
                    response.text
                )
        except Exception as e:
            self.log_test("Admin Verify (Invalid Token)", False, f"Exception: {str(e)}")
        return False

    def test_admin_dashboard(self):
        """Test admin dashboard statistics"""
        if not self.admin_token:
            self.log_test("Admin Dashboard", False, "No admin token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.get(
                f"{self.base_url}/admin/dashboard",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Check required fields
                required_fields = [
                    "total_users", "active_users", "inactive_users", "online_users",
                    "new_today", "new_this_week", "logged_in_today", 
                    "registration_trend", "login_trend", "role_distribution", "recent_users"
                ]
                
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    self.log_test(
                        "Admin Dashboard", 
                        True, 
                        f"Dashboard loaded successfully. Total users: {data['total_users']}, Active: {data['active_users']}, Online: {data['online_users']}"
                    )
                    return True
                else:
                    self.log_test(
                        "Admin Dashboard", 
                        False, 
                        f"Missing required fields: {missing_fields}", 
                        data
                    )
            else:
                self.log_test(
                    "Admin Dashboard", 
                    False, 
                    f"Expected 200, got {response.status_code}", 
                    response.text
                )
        except Exception as e:
            self.log_test("Admin Dashboard", False, f"Exception: {str(e)}")
        return False

    def test_admin_users_list(self):
        """Test admin users list with pagination"""
        if not self.admin_token:
            self.log_test("Admin Users List", False, "No admin token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Test basic list
            response = self.session.get(
                f"{self.base_url}/admin/users",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Check required fields
                required_fields = ["users", "total", "skip", "limit", "has_more"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    users_count = len(data["users"])
                    self.log_test(
                        "Admin Users List", 
                        True, 
                        f"Users list loaded successfully. Found {users_count} users, Total: {data['total']}"
                    )
                    return True
                else:
                    self.log_test(
                        "Admin Users List", 
                        False, 
                        f"Missing required fields: {missing_fields}", 
                        data
                    )
            else:
                self.log_test(
                    "Admin Users List", 
                    False, 
                    f"Expected 200, got {response.status_code}", 
                    response.text
                )
        except Exception as e:
            self.log_test("Admin Users List", False, f"Exception: {str(e)}")
        return False

    def test_admin_users_pagination(self):
        """Test admin users list pagination parameters"""
        if not self.admin_token:
            self.log_test("Admin Users Pagination", False, "No admin token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Test with pagination parameters
            response = self.session.get(
                f"{self.base_url}/admin/users?skip=0&limit=5",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("skip") == 0 and data.get("limit") == 5:
                    users_returned = len(data.get("users", []))
                    self.log_test(
                        "Admin Users Pagination", 
                        True, 
                        f"Pagination working correctly. Requested limit 5, got {users_returned} users"
                    )
                    return True
                else:
                    self.log_test(
                        "Admin Users Pagination", 
                        False, 
                        f"Pagination parameters not respected. Skip: {data.get('skip')}, Limit: {data.get('limit')}", 
                        data
                    )
            else:
                self.log_test(
                    "Admin Users Pagination", 
                    False, 
                    f"Expected 200, got {response.status_code}", 
                    response.text
                )
        except Exception as e:
            self.log_test("Admin Users Pagination", False, f"Exception: {str(e)}")
        return False

    def test_admin_users_search(self):
        """Test admin users search functionality"""
        if not self.admin_token:
            self.log_test("Admin Users Search", False, "No admin token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Test search functionality
            response = self.session.get(
                f"{self.base_url}/admin/users?search=admin",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Search should work even if no results found
                if "users" in data and "total" in data:
                    self.log_test(
                        "Admin Users Search", 
                        True, 
                        f"Search functionality working. Found {data['total']} users matching 'admin'"
                    )
                    return True
                else:
                    self.log_test(
                        "Admin Users Search", 
                        False, 
                        "Search response missing required fields", 
                        data
                    )
            else:
                self.log_test(
                    "Admin Users Search", 
                    False, 
                    f"Expected 200, got {response.status_code}", 
                    response.text
                )
        except Exception as e:
            self.log_test("Admin Users Search", False, f"Exception: {str(e)}")
        return False

    def test_admin_users_filter(self):
        """Test admin users status filter"""
        if not self.admin_token:
            self.log_test("Admin Users Filter", False, "No admin token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Test active users filter
            response = self.session.get(
                f"{self.base_url}/admin/users?status_filter=active",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if "users" in data:
                    # Check if all returned users are active
                    all_active = all(user.get("is_active", False) for user in data["users"])
                    if all_active or len(data["users"]) == 0:
                        self.log_test(
                            "Admin Users Filter", 
                            True, 
                            f"Status filter working correctly. Found {len(data['users'])} active users"
                        )
                        return True
                    else:
                        self.log_test(
                            "Admin Users Filter", 
                            False, 
                            "Filter returned inactive users when filtering for active", 
                            data
                        )
                else:
                    self.log_test(
                        "Admin Users Filter", 
                        False, 
                        "Filter response missing users field", 
                        data
                    )
            else:
                self.log_test(
                    "Admin Users Filter", 
                    False, 
                    f"Expected 200, got {response.status_code}", 
                    response.text
                )
        except Exception as e:
            self.log_test("Admin Users Filter", False, f"Exception: {str(e)}")
        return False

    def get_test_user_id(self):
        """Get a user ID for testing user-specific operations"""
        if not self.admin_token:
            return None
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.get(
                f"{self.base_url}/admin/users?limit=1",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                users = data.get("users", [])
                if users:
                    return users[0].get("id")
        except Exception as e:
            print(f"Error getting test user ID: {e}")
        return None

    def test_admin_user_detail(self):
        """Test getting detailed user information"""
        if not self.admin_token:
            self.log_test("Admin User Detail", False, "No admin token available")
            return False
            
        user_id = self.get_test_user_id()
        if not user_id:
            self.log_test("Admin User Detail", False, "No test user ID available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.get(
                f"{self.base_url}/admin/users/{user_id}",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Check for user details and stats
                if "id" in data and "email" in data and "stats" in data:
                    stats = data["stats"]
                    self.log_test(
                        "Admin User Detail", 
                        True, 
                        f"User detail loaded successfully. Email: {data['email']}, Posts: {stats.get('posts_count', 0)}, Comments: {stats.get('comments_count', 0)}"
                    )
                    return True
                else:
                    self.log_test(
                        "Admin User Detail", 
                        False, 
                        "User detail response missing required fields", 
                        data
                    )
            elif response.status_code == 404:
                self.log_test(
                    "Admin User Detail", 
                    False, 
                    f"User not found: {user_id}", 
                    response.text
                )
            else:
                self.log_test(
                    "Admin User Detail", 
                    False, 
                    f"Expected 200, got {response.status_code}", 
                    response.text
                )
        except Exception as e:
            self.log_test("Admin User Detail", False, f"Exception: {str(e)}")
        return False

    def test_admin_user_update(self):
        """Test updating user information"""
        if not self.admin_token:
            self.log_test("Admin User Update", False, "No admin token available")
            return False
            
        user_id = self.get_test_user_id()
        if not user_id:
            self.log_test("Admin User Update", False, "No test user ID available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Get current user data first
            get_response = self.session.get(
                f"{self.base_url}/admin/users/{user_id}",
                headers=headers,
                timeout=10
            )
            
            if get_response.status_code != 200:
                self.log_test("Admin User Update", False, "Could not fetch user for update test")
                return False
                
            current_user = get_response.json()
            original_first_name = current_user.get("first_name", "")
            
            # Update user with new first name
            test_first_name = f"TestUpdated_{int(time.time())}"
            update_data = {
                "first_name": test_first_name
            }
            
            response = self.session.put(
                f"{self.base_url}/admin/users/{user_id}",
                json=update_data,
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if "message" in data and "user" in data:
                    updated_user = data["user"]
                    if updated_user.get("first_name") == test_first_name:
                        # Restore original name
                        restore_data = {"first_name": original_first_name}
                        self.session.put(
                            f"{self.base_url}/admin/users/{user_id}",
                            json=restore_data,
                            headers=headers,
                            timeout=10
                        )
                        
                        self.log_test(
                            "Admin User Update", 
                            True, 
                            f"User updated successfully. Changed first_name to '{test_first_name}' and restored to '{original_first_name}'"
                        )
                        return True
                    else:
                        self.log_test(
                            "Admin User Update", 
                            False, 
                            f"Update did not take effect. Expected '{test_first_name}', got '{updated_user.get('first_name')}'", 
                            data
                        )
                else:
                    self.log_test(
                        "Admin User Update", 
                        False, 
                        "Update response missing required fields", 
                        data
                    )
            else:
                self.log_test(
                    "Admin User Update", 
                    False, 
                    f"Expected 200, got {response.status_code}", 
                    response.text
                )
        except Exception as e:
            self.log_test("Admin User Update", False, f"Exception: {str(e)}")
        return False

    def test_admin_user_status_toggle(self):
        """Test toggling user active/inactive status"""
        if not self.admin_token:
            self.log_test("Admin User Status Toggle", False, "No admin token available")
            return False
            
        user_id = self.get_test_user_id()
        if not user_id:
            self.log_test("Admin User Status Toggle", False, "No test user ID available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Get current status
            get_response = self.session.get(
                f"{self.base_url}/admin/users/{user_id}",
                headers=headers,
                timeout=10
            )
            
            if get_response.status_code != 200:
                self.log_test("Admin User Status Toggle", False, "Could not fetch user for status toggle test")
                return False
                
            current_user = get_response.json()
            original_status = current_user.get("is_active", True)
            
            # Toggle status
            response = self.session.put(
                f"{self.base_url}/admin/users/{user_id}/status",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if "message" in data and "is_active" in data:
                    new_status = data["is_active"]
                    if new_status != original_status:
                        # Toggle back to original status
                        self.session.put(
                            f"{self.base_url}/admin/users/{user_id}/status",
                            headers=headers,
                            timeout=10
                        )
                        
                        self.log_test(
                            "Admin User Status Toggle", 
                            True, 
                            f"Status toggled successfully. Changed from {original_status} to {new_status} and back"
                        )
                        return True
                    else:
                        self.log_test(
                            "Admin User Status Toggle", 
                            False, 
                            f"Status did not change. Original: {original_status}, New: {new_status}", 
                            data
                        )
                else:
                    self.log_test(
                        "Admin User Status Toggle", 
                        False, 
                        "Status toggle response missing required fields", 
                        data
                    )
            else:
                self.log_test(
                    "Admin User Status Toggle", 
                    False, 
                    f"Expected 200, got {response.status_code}", 
                    response.text
                )
        except Exception as e:
            self.log_test("Admin User Status Toggle", False, f"Exception: {str(e)}")
        return False

    def test_admin_user_password_reset(self):
        """Test resetting user password"""
        if not self.admin_token:
            self.log_test("Admin User Password Reset", False, "No admin token available")
            return False
            
        user_id = self.get_test_user_id()
        if not user_id:
            self.log_test("Admin User Password Reset", False, "No test user ID available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Test password reset
            new_password = f"TestPassword123_{int(time.time())}"
            password_data = {
                "new_password": new_password
            }
            
            response = self.session.post(
                f"{self.base_url}/admin/users/{user_id}/reset-password",
                json=password_data,
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if "message" in data:
                    self.log_test(
                        "Admin User Password Reset", 
                        True, 
                        f"Password reset successfully: {data['message']}"
                    )
                    return True
                else:
                    self.log_test(
                        "Admin User Password Reset", 
                        False, 
                        "Password reset response missing message", 
                        data
                    )
            else:
                self.log_test(
                    "Admin User Password Reset", 
                    False, 
                    f"Expected 200, got {response.status_code}", 
                    response.text
                )
        except Exception as e:
            self.log_test("Admin User Password Reset", False, f"Exception: {str(e)}")
        return False

    def test_admin_user_password_reset_validation(self):
        """Test password reset validation (short password)"""
        if not self.admin_token:
            self.log_test("Admin Password Reset Validation", False, "No admin token available")
            return False
            
        user_id = self.get_test_user_id()
        if not user_id:
            self.log_test("Admin Password Reset Validation", False, "No test user ID available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Test with short password (should fail)
            password_data = {
                "new_password": "123"  # Too short
            }
            
            response = self.session.post(
                f"{self.base_url}/admin/users/{user_id}/reset-password",
                json=password_data,
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 400:
                data = response.json()
                if "detail" in data:
                    self.log_test(
                        "Admin Password Reset Validation", 
                        True, 
                        f"Correctly rejected short password: {data['detail']}"
                    )
                    return True
                else:
                    self.log_test(
                        "Admin Password Reset Validation", 
                        False, 
                        "Missing error detail in 400 response", 
                        data
                    )
            else:
                self.log_test(
                    "Admin Password Reset Validation", 
                    False, 
                    f"Expected 400, got {response.status_code}", 
                    response.text
                )
        except Exception as e:
            self.log_test("Admin Password Reset Validation", False, f"Exception: {str(e)}")
        return False

    def run_all_tests(self):
        """Run all admin panel tests"""
        print("=" * 60)
        print("ZION.CITY Admin Panel Backend API Testing")
        print("=" * 60)
        print(f"Backend URL: {self.base_url}")
        print(f"Admin Username: {ADMIN_USERNAME}")
        print(f"Test Started: {datetime.now().isoformat()}")
        print("=" * 60)
        print()

        # Authentication Tests
        print("🔐 AUTHENTICATION TESTS")
        print("-" * 30)
        self.test_admin_login_success()
        self.test_admin_login_failure()
        self.test_admin_verify_valid_token()
        self.test_admin_verify_invalid_token()
        
        # Dashboard Tests
        print("📊 DASHBOARD TESTS")
        print("-" * 30)
        self.test_admin_dashboard()
        
        # User Management Tests
        print("👥 USER MANAGEMENT TESTS")
        print("-" * 30)
        self.test_admin_users_list()
        self.test_admin_users_pagination()
        self.test_admin_users_search()
        self.test_admin_users_filter()
        self.test_admin_user_detail()
        self.test_admin_user_update()
        self.test_admin_user_status_toggle()
        self.test_admin_user_password_reset()
        self.test_admin_user_password_reset_validation()
        
        # Summary
        print("=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        print()
        
        if failed_tests > 0:
            print("FAILED TESTS:")
            print("-" * 20)
            for result in self.test_results:
                if not result["success"]:
                    print(f"❌ {result['test']}: {result['details']}")
            print()
        
        print("=" * 60)
        return passed_tests, failed_tests

if __name__ == "__main__":
    tester = AdminPanelTester()
    passed, failed = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if failed == 0 else 1)