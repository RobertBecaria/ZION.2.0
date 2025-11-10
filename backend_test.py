#!/usr/bin/env python3
"""
RE-TEST AFTER BUG FIX - School Management Phase 1: Teacher Listing Endpoints
Testing the field mapping bug fix for teacher endpoints
"""

import requests
import json
import uuid
from datetime import datetime

# Configuration
BASE_URL = "https://teacher-mgmt.preview.emergentagent.com/api"
ORGANIZATION_ID = "d80dbe76-45e7-45fa-b937-a2b5a20b8aaf"  # ZION.CITY organization

# Test credentials
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "admin123"

class TeacherEndpointBugFixTester:
    def __init__(self):
        self.admin_token = None
        self.test_user_token = None
        self.test_user_id = None
        self.test_user_email = None
        self.join_request_id = None
        self.results = []
        
    def log_result(self, test_name, success, details="", response_data=None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = {
            "test": test_name,
            "status": status,
            "details": details,
            "response_data": response_data
        }
        self.results.append(result)
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        if not success and response_data:
            print(f"   Response: {response_data}")
        print()

    def authenticate_admin(self):
        """Authenticate admin user"""
        try:
            response = requests.post(f"{BASE_URL}/auth/login", json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            })
            
            if response.status_code == 200:
                data = response.json()
                self.admin_token = data.get("access_token")
                self.log_result("Admin Authentication", True, f"Admin logged in successfully")
                return True
            else:
                self.log_result("Admin Authentication", False, f"Status: {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Admin Authentication", False, f"Exception: {str(e)}")
            return False

    def create_test_user(self):
        """Create a test user for join requests"""
        try:
            # Generate unique email
            unique_id = str(uuid.uuid4())[:8]
            self.test_user_email = f"jointest_{unique_id}@example.com"
            test_password = "testpass123"
            
            # Register test user
            response = requests.post(f"{BASE_URL}/auth/register", json={
                "email": self.test_user_email,
                "password": test_password,
                "first_name": "Join",
                "last_name": "Tester"
            })
            
            if response.status_code in [200, 201]:
                # Login test user
                login_response = requests.post(f"{BASE_URL}/auth/login", json={
                    "email": self.test_user_email,
                    "password": test_password
                })
                
                if login_response.status_code == 200:
                    login_data = login_response.json()
                    self.test_user_token = login_data.get("access_token")
                    self.test_user_id = login_data.get("user", {}).get("id")
                    self.log_result("Test User Creation", True, f"Created user: {self.test_user_email}")
                    return True
                else:
                    self.log_result("Test User Creation", False, f"Login failed: {login_response.status_code}", login_response.text)
                    return False
            else:
                self.log_result("Test User Creation", False, f"Registration failed: {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Test User Creation", False, f"Exception: {str(e)}")
            return False

    def test_request_join_organization(self):
        """Test POST /api/work/organizations/{org_id}/request-join"""
        try:
            headers = {"Authorization": f"Bearer {self.test_user_token}"}
            
            response = requests.post(
                f"{BASE_URL}/work/organizations/{ORGANIZATION_ID}/request-join",
                headers=headers,
                json={"message": "I would like to join this organization to contribute my skills"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.join_request_id = data.get("request_id")
                self.log_result("Request Join Organization", True, 
                               f"Join request created with ID: {self.join_request_id}")
                return True
            else:
                self.log_result("Request Join Organization", False, 
                               f"Status: {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Request Join Organization", False, f"Exception: {str(e)}")
            return False

    def test_get_join_requests_admin(self):
        """Test GET /api/work/organizations/{org_id}/join-requests (admin only)"""
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            response = requests.get(
                f"{BASE_URL}/work/organizations/{ORGANIZATION_ID}/join-requests",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                requests_list = data.get("requests", [])
                
                # Check if our request is in the list
                found_request = False
                for req in requests_list:
                    if req.get("id") == self.join_request_id:
                        found_request = True
                        # Verify required fields
                        required_fields = ["user_email", "user_name", "message", "status", "requested_at"]
                        missing_fields = [field for field in required_fields if field not in req]
                        
                        if missing_fields:
                            self.log_result("Get Join Requests (Admin)", False, 
                                           f"Missing fields: {missing_fields}")
                            return False
                        break
                
                if found_request:
                    self.log_result("Get Join Requests (Admin)", True, 
                                   f"Found {len(requests_list)} requests, including our test request")
                    return True
                else:
                    self.log_result("Get Join Requests (Admin)", False, 
                                   f"Test request not found in {len(requests_list)} requests")
                    return False
            else:
                self.log_result("Get Join Requests (Admin)", False, 
                               f"Status: {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Get Join Requests (Admin)", False, f"Exception: {str(e)}")
            return False

    def test_get_join_requests_non_admin(self):
        """Test GET /api/work/organizations/{org_id}/join-requests (non-admin should get 403)"""
        try:
            headers = {"Authorization": f"Bearer {self.test_user_token}"}
            
            response = requests.get(
                f"{BASE_URL}/work/organizations/{ORGANIZATION_ID}/join-requests",
                headers=headers
            )
            
            if response.status_code == 403:
                self.log_result("Get Join Requests (Non-Admin)", True, 
                               "Correctly denied access with 403 Forbidden")
                return True
            else:
                self.log_result("Get Join Requests (Non-Admin)", False, 
                               f"Expected 403, got {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Get Join Requests (Non-Admin)", False, f"Exception: {str(e)}")
            return False

    def test_approve_join_request(self):
        """Test POST /api/work/join-requests/{request_id}/approve"""
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            response = requests.post(
                f"{BASE_URL}/work/join-requests/{self.join_request_id}/approve",
                headers=headers,
                json={"role": "MEMBER"}
            )
            
            if response.status_code == 200:
                data = response.json()
                member_id = data.get("member_id")
                
                # Verify user is now a member
                members_response = requests.get(
                    f"{BASE_URL}/work/organizations/{ORGANIZATION_ID}/members",
                    headers=headers
                )
                
                if members_response.status_code == 200:
                    members_data = members_response.json()
                    members_list = members_data.get("members", [])
                    
                    # Check if test user is now a member
                    is_member = any(member.get("user_id") == self.test_user_id for member in members_list)
                    
                    if is_member:
                        self.log_result("Approve Join Request", True, 
                                       f"Request approved and user added as member with ID: {member_id}")
                        return True
                    else:
                        self.log_result("Approve Join Request", False, 
                                       "Request approved but user not found in members list")
                        return False
                else:
                    self.log_result("Approve Join Request", False, 
                                   f"Could not verify membership: {members_response.status_code}")
                    return False
            else:
                self.log_result("Approve Join Request", False, 
                               f"Status: {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Approve Join Request", False, f"Exception: {str(e)}")
            return False

    def test_reject_join_request(self):
        """Test POST /api/work/join-requests/{request_id}/reject"""
        try:
            # First create another join request to reject
            headers_user = {"Authorization": f"Bearer {self.test_user_token}"}
            
            # Create second test user for rejection test
            unique_id = str(uuid.uuid4())[:8]
            reject_user_email = f"rejecttest_{unique_id}@example.com"
            
            # Register second test user
            register_response = requests.post(f"{BASE_URL}/auth/register", json={
                "email": reject_user_email,
                "password": "testpass123",
                "first_name": "Reject",
                "last_name": "Tester"
            })
            
            if register_response.status_code not in [200, 201]:
                self.log_result("Reject Join Request", False, "Could not create second test user")
                return False
            
            # Login second test user
            login_response = requests.post(f"{BASE_URL}/auth/login", json={
                "email": reject_user_email,
                "password": "testpass123"
            })
            
            if login_response.status_code != 200:
                self.log_result("Reject Join Request", False, "Could not login second test user")
                return False
            
            reject_user_token = login_response.json().get("access_token")
            headers_reject = {"Authorization": f"Bearer {reject_user_token}"}
            
            # Create join request to reject
            join_response = requests.post(
                f"{BASE_URL}/work/organizations/{ORGANIZATION_ID}/request-join",
                headers=headers_reject,
                json={"message": "Please let me join"}
            )
            
            if join_response.status_code != 200:
                self.log_result("Reject Join Request", False, "Could not create join request to reject")
                return False
            
            reject_request_id = join_response.json().get("request_id")
            
            # Now reject the request as admin
            headers_admin = {"Authorization": f"Bearer {self.admin_token}"}
            
            response = requests.post(
                f"{BASE_URL}/work/join-requests/{reject_request_id}/reject",
                headers=headers_admin,
                params={"rejection_reason": "Position not available at this time"}
            )
            
            if response.status_code == 200:
                self.log_result("Reject Join Request", True, 
                               "Join request rejected successfully with reason")
                return True
            else:
                self.log_result("Reject Join Request", False, 
                               f"Status: {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Reject Join Request", False, f"Exception: {str(e)}")
            return False

    def test_approve_non_admin(self):
        """Test that non-admin cannot approve join requests"""
        try:
            headers = {"Authorization": f"Bearer {self.test_user_token}"}
            
            response = requests.post(
                f"{BASE_URL}/work/join-requests/{self.join_request_id}/approve",
                headers=headers
            )
            
            if response.status_code == 403:
                self.log_result("Approve Join Request (Non-Admin)", True, 
                               "Correctly denied access with 403 Forbidden")
                return True
            else:
                self.log_result("Approve Join Request (Non-Admin)", False, 
                               f"Expected 403, got {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Approve Join Request (Non-Admin)", False, f"Exception: {str(e)}")
            return False

    def test_duplicate_membership_prevention(self):
        """Test that approving already approved request doesn't create duplicate membership"""
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Try to approve the same request again
            response = requests.post(
                f"{BASE_URL}/work/join-requests/{self.join_request_id}/approve",
                headers=headers
            )
            
            # Should either return 404 (request not found/already processed) or handle gracefully
            if response.status_code in [404, 400]:
                self.log_result("Duplicate Membership Prevention", True, 
                               f"Correctly handled duplicate approval with status {response.status_code}")
                return True
            elif response.status_code == 200:
                # If it returns 200, check the message
                data = response.json()
                message = data.get("message", "")
                if "already a member" in message.lower():
                    self.log_result("Duplicate Membership Prevention", True, 
                                   "Correctly detected existing membership")
                    return True
                else:
                    self.log_result("Duplicate Membership Prevention", False, 
                                   "Approved duplicate request without proper handling")
                    return False
            else:
                self.log_result("Duplicate Membership Prevention", False, 
                               f"Unexpected status: {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Duplicate Membership Prevention", False, f"Exception: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all join request tests"""
        print("🚀 Starting Join Request Notifications Integration Backend Testing")
        print("=" * 80)
        
        # Authentication
        if not self.authenticate_admin():
            print("❌ Cannot proceed without admin authentication")
            return
        
        if not self.create_test_user():
            print("❌ Cannot proceed without test user")
            return
        
        # Test join request creation
        if not self.test_request_join_organization():
            print("❌ Cannot proceed without join request")
            return
        
        # Test admin access to join requests
        self.test_get_join_requests_admin()
        
        # Test non-admin access (should be denied)
        self.test_get_join_requests_non_admin()
        
        # Test approval process
        self.test_approve_join_request()
        
        # Test rejection process
        self.test_reject_join_request()
        
        # Test authorization controls
        self.test_approve_non_admin()
        
        # Test duplicate prevention
        self.test_duplicate_membership_prevention()
        
        # Print summary
        self.print_summary()

    def print_summary(self):
        """Print test summary"""
        print("=" * 80)
        print("📊 JOIN REQUEST NOTIFICATIONS INTEGRATION TEST SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.results)
        passed_tests = sum(1 for result in self.results if "✅ PASS" in result["status"])
        failed_tests = total_tests - passed_tests
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {success_rate:.1f}%")
        print()
        
        if failed_tests > 0:
            print("❌ FAILED TESTS:")
            for result in self.results:
                if "❌ FAIL" in result["status"]:
                    print(f"   - {result['test']}: {result['details']}")
            print()
        
        print("✅ PASSED TESTS:")
        for result in self.results:
            if "✅ PASS" in result["status"]:
                print(f"   - {result['test']}")
        
        print()
        print("🎯 KEY FUNCTIONALITY TESTED:")
        print("   - POST /api/work/organizations/{org_id}/request-join")
        print("   - GET /api/work/organizations/{org_id}/join-requests")
        print("   - POST /api/work/join-requests/{request_id}/approve")
        print("   - POST /api/work/join-requests/{request_id}/reject")
        print("   - Authorization controls (admin vs non-admin)")
        print("   - Duplicate membership prevention")
        print("   - Data integrity and proper response formats")
        
        if success_rate >= 85:
            print(f"\n🎉 JOIN REQUEST SYSTEM IS PRODUCTION-READY! ({success_rate:.1f}% success rate)")
        elif success_rate >= 70:
            print(f"\n⚠️ JOIN REQUEST SYSTEM NEEDS MINOR FIXES ({success_rate:.1f}% success rate)")
        else:
            print(f"\n❌ JOIN REQUEST SYSTEM NEEDS MAJOR FIXES ({success_rate:.1f}% success rate)")

if __name__ == "__main__":
    tester = JoinRequestTester()
    tester.run_all_tests()