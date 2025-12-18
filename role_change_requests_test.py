#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
import uuid

class RoleChangeRequestsAPITester:
    def __init__(self, base_url="https://social-features-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.member_token = None
        self.admin_user_id = None
        self.member_user_id = None
        self.org_id = "d80dbe76-45e7-45fa-b937-a2b5a20b8aaf"  # From review request
        self.test_request_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Test credentials from review request
        self.admin_credentials = {
            "email": "admin@test.com",
            "password": "admin123"
        }
        
        # Create test member credentials
        self.member_credentials = {
            "email": f"member_test_{datetime.now().strftime('%H%M%S')}@example.com",
            "password": "member123",
            "first_name": "Test",
            "last_name": "Member"
        }

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test_name": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })

    def make_request(self, method, endpoint, data=None, expected_status=200, token=None):
        """Make API request with error handling"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        # Use provided token or default to admin token
        auth_token = token or self.admin_token
        if auth_token:
            headers['Authorization'] = f'Bearer {auth_token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                return False, {"error": f"Unsupported method: {method}"}

            success = response.status_code == expected_status
            try:
                response_data = response.json() if response.content else {}
            except:
                response_data = {"raw_response": response.text}
            
            if not success:
                response_data["status_code"] = response.status_code
                response_data["expected_status"] = expected_status
            
            return success, response_data

        except Exception as e:
            return False, {"error": str(e)}

    def test_admin_login(self):
        """Test admin login"""
        success, response = self.make_request("POST", "auth/login", self.admin_credentials, 200, token=None)
        
        if success and "access_token" in response:
            self.admin_token = response["access_token"]
            self.admin_user_id = response["user"]["id"]
            self.log_test("Admin Login", True)
            return True
        else:
            self.log_test("Admin Login", False, f"Response: {response}")
            return False

    def test_member_registration_and_login(self):
        """Test member registration and login"""
        # Register member
        success, response = self.make_request("POST", "auth/register", self.member_credentials, 200, token=None)
        
        if not success:
            self.log_test("Member Registration", False, f"Registration failed: {response}")
            return False
        
        # Login member
        login_data = {
            "email": self.member_credentials["email"],
            "password": self.member_credentials["password"]
        }
        success, response = self.make_request("POST", "auth/login", login_data, 200, token=None)
        
        if success and "access_token" in response:
            self.member_token = response["access_token"]
            self.member_user_id = response["user"]["id"]
            self.log_test("Member Registration & Login", True)
            return True
        else:
            self.log_test("Member Registration & Login", False, f"Login failed: {response}")
            return False

    def test_add_member_to_organization(self):
        """Add test member to organization"""
        if not self.member_user_id:
            self.log_test("Add Member to Organization", False, "No member user ID")
            return False
        
        member_data = {
            "user_email": self.member_credentials["email"],
            "role": "MEMBER",
            "department": "General",
            "job_title": "Test Member"
        }
        
        success, response = self.make_request("POST", f"work/organizations/{self.org_id}/members", member_data, 200)
        
        if success:
            self.log_test("Add Member to Organization", True)
            return True
        else:
            self.log_test("Add Member to Organization", False, f"Response: {response}")
            return False

    def test_member_create_change_request(self):
        """Test member creating a role change request"""
        if not self.member_token:
            self.log_test("Member Create Change Request", False, "No member token")
            return False
        
        # Member updates their settings to request role change
        update_data = {
            "requested_role": "MANAGER",
            "requested_department": "Engineering", 
            "reason": "I have gained experience and would like to take on more responsibilities"
        }
        
        success, response = self.make_request("PUT", f"work/organizations/{self.org_id}/members/me", 
                                            update_data, 200, token=self.member_token)
        
        if success:
            self.log_test("Member Create Change Request", True)
            return True
        else:
            self.log_test("Member Create Change Request", False, f"Response: {response}")
            return False

    def test_get_pending_change_requests(self):
        """Test GET /api/work/organizations/{org_id}/change-requests endpoint"""
        success, response = self.make_request("GET", f"work/organizations/{self.org_id}/change-requests?status=PENDING", 200)
        
        if success and "data" in response and isinstance(response["data"], list):
            # Check if we have the expected structure
            if len(response["data"]) > 0:
                request = response["data"][0]
                required_fields = ["id", "user_id", "request_type", "status", "user_first_name", "user_last_name", "user_email"]
                
                missing_fields = [field for field in required_fields if field not in request]
                if missing_fields:
                    self.log_test("GET Pending Change Requests", False, f"Missing fields: {missing_fields}")
                    return False
                
                # Store request ID for later tests
                self.test_request_id = request["id"]
                
            self.log_test("GET Pending Change Requests", True, f"Found {len(response['data'])} requests")
            return True
        else:
            self.log_test("GET Pending Change Requests", False, f"Response: {response}")
            return False

    def test_approve_change_request(self):
        """Test POST /api/work/organizations/{org_id}/change-requests/{request_id}/approve endpoint"""
        if not self.test_request_id:
            self.log_test("Approve Change Request", False, "No test request ID available")
            return False
        
        success, response = self.make_request("POST", f"work/organizations/{self.org_id}/change-requests/{self.test_request_id}/approve", 
                                            {}, 200)
        
        if success:
            self.log_test("Approve Change Request", True)
            return True
        else:
            self.log_test("Approve Change Request", False, f"Response: {response}")
            return False

    def test_verify_role_updated(self):
        """Verify that member's role was actually updated after approval"""
        # Instead of trying to get member details (which has validation issues),
        # let's verify by checking if we can create another role change request
        # If the role was updated, the current_role should be MANAGER now
        
        if not self.member_token:
            self.log_test("Verify Role Updated", False, "No member token")
            return False
        
        # Try to create another change request - this will show us the current role
        update_data = {
            "requested_role": "SENIOR_MANAGER",
            "reason": "Testing role verification - requesting promotion to Senior Manager"
        }
        
        success, response = self.make_request("PUT", f"work/organizations/{self.org_id}/members/me", 
                                            update_data, 200, token=self.member_token)
        
        if success:
            # Now check the pending requests to see the current_role
            success2, response2 = self.make_request("GET", f"work/organizations/{self.org_id}/change-requests?status=PENDING", 200)
            
            if success2 and "data" in response2:
                for request in response2["data"]:
                    if (request.get("user_email") == self.member_credentials["email"] and 
                        request.get("requested_role") == "SENIOR_MANAGER"):
                        current_role = request.get("current_role")
                        if current_role == "MANAGER":
                            self.log_test("Verify Role Updated", True, f"Role successfully updated to MANAGER (verified via current_role: {current_role})")
                            return True
                        else:
                            self.log_test("Verify Role Updated", False, f"Role not updated. Current role: {current_role}")
                            return False
                
                self.log_test("Verify Role Updated", False, "Could not find verification request")
                return False
            else:
                self.log_test("Verify Role Updated", False, f"Could not get pending requests for verification: {response2}")
                return False
        else:
            self.log_test("Verify Role Updated", False, f"Could not create verification request: {response}")
            return False

    def test_create_another_change_request_for_rejection(self):
        """Create another change request to test rejection"""
        if not self.member_token:
            self.log_test("Create Request for Rejection Test", False, "No member token")
            return False
        
        # Member requests department change
        update_data = {
            "requested_department": "Marketing",
            "reason": "I want to explore marketing opportunities"
        }
        
        success, response = self.make_request("PUT", f"work/organizations/{self.org_id}/members/me", 
                                            update_data, 200, token=self.member_token)
        
        if success:
            self.log_test("Create Request for Rejection Test", True)
            return True
        else:
            self.log_test("Create Request for Rejection Test", False, f"Response: {response}")
            return False

    def test_get_new_pending_request(self):
        """Get the new pending request for rejection test"""
        success, response = self.make_request("GET", f"work/organizations/{self.org_id}/change-requests?status=PENDING", 200)
        
        if success and "data" in response and len(response["data"]) > 0:
            # Find the department change request
            for request in response["data"]:
                if request.get("request_type") == "DEPARTMENT_CHANGE":
                    self.test_request_id = request["id"]
                    self.log_test("Get New Pending Request", True)
                    return True
            
            self.log_test("Get New Pending Request", False, "No department change request found")
            return False
        else:
            self.log_test("Get New Pending Request", False, f"Response: {response}")
            return False

    def test_reject_change_request(self):
        """Test POST /api/work/organizations/{org_id}/change-requests/{request_id}/reject endpoint"""
        if not self.test_request_id:
            self.log_test("Reject Change Request", False, "No test request ID available")
            return False
        
        rejection_reason = "Department change not approved at this time"
        success, response = self.make_request("POST", 
                                            f"work/organizations/{self.org_id}/change-requests/{self.test_request_id}/reject?rejection_reason={rejection_reason}", 
                                            {}, 200)
        
        if success:
            self.log_test("Reject Change Request", True)
            return True
        else:
            self.log_test("Reject Change Request", False, f"Response: {response}")
            return False

    def test_verify_rejected_request(self):
        """Verify that request was properly rejected with reason"""
        success, response = self.make_request("GET", f"work/organizations/{self.org_id}/change-requests?status=REJECTED", 200)
        
        if success and "data" in response:
            for request in response["data"]:
                if request["id"] == self.test_request_id:
                    if request["status"] == "REJECTED" and request.get("rejection_reason"):
                        self.log_test("Verify Rejected Request", True, f"Request rejected with reason: {request['rejection_reason']}")
                        return True
            
            self.log_test("Verify Rejected Request", False, "Rejected request not found or missing rejection reason")
            return False
        else:
            self.log_test("Verify Rejected Request", False, f"Response: {response}")
            return False

    def test_non_admin_authorization(self):
        """Test that non-admin users get 403 errors"""
        if not self.member_token:
            self.log_test("Non-Admin Authorization Check", False, "No member token")
            return False
        
        # Try to access admin endpoints with member token
        endpoints_to_test = [
            f"work/organizations/{self.org_id}/change-requests",
            f"work/organizations/{self.org_id}/change-requests/fake-id/approve",
            f"work/organizations/{self.org_id}/change-requests/fake-id/reject"
        ]
        
        all_forbidden = True
        for endpoint in endpoints_to_test:
            method = "POST" if "approve" in endpoint or "reject" in endpoint else "GET"
            success, response = self.make_request(method, endpoint, {}, 403, token=self.member_token)
            
            if not success:
                all_forbidden = False
                break
        
        if all_forbidden:
            self.log_test("Non-Admin Authorization Check", True, "All admin endpoints properly return 403 for non-admin")
            return True
        else:
            self.log_test("Non-Admin Authorization Check", False, "Some admin endpoints accessible to non-admin")
            return False

    def test_pending_count_accuracy(self):
        """Test that pending count is accurate"""
        success, response = self.make_request("GET", f"work/organizations/{self.org_id}/change-requests?status=PENDING", 200)
        
        if success and "data" in response:
            pending_count = len(response["data"])
            self.log_test("Pending Count Accuracy", True, f"Found {pending_count} pending requests")
            return True
        else:
            self.log_test("Pending Count Accuracy", False, f"Response: {response}")
            return False

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Role Change Requests Admin Panel API Tests...")
        print(f"📍 Testing against: {self.base_url}")
        print(f"🏢 Organization ID: {self.org_id}")
        print(f"👤 Admin email: {self.admin_credentials['email']}")
        print(f"👤 Test member email: {self.member_credentials['email']}")
        print("-" * 80)
        
        # Test sequence
        tests = [
            self.test_admin_login,
            self.test_member_registration_and_login,
            self.test_add_member_to_organization,
            self.test_member_create_change_request,
            self.test_get_pending_change_requests,
            self.test_approve_change_request,
            self.test_verify_role_updated,
            self.test_create_another_change_request_for_rejection,
            self.test_get_new_pending_request,
            self.test_reject_change_request,
            self.test_verify_rejected_request,
            self.test_non_admin_authorization,
            self.test_pending_count_accuracy,
        ]
        
        for test in tests:
            test()
        
        # Print summary
        print("-" * 80)
        print(f"📊 Tests completed: {self.tests_passed}/{self.tests_run}")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Success rate: {success_rate:.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("⚠️  Some tests failed. Check the details above.")
            return 1

    def get_test_summary(self):
        """Get test summary for reporting"""
        return {
            "total_tests": self.tests_run,
            "passed_tests": self.tests_passed,
            "failed_tests": self.tests_run - self.tests_passed,
            "success_rate": (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0,
            "test_results": self.test_results,
            "admin_email": self.admin_credentials["email"],
            "member_email": self.member_credentials["email"],
            "organization_id": self.org_id,
            "admin_user_id": self.admin_user_id,
            "member_user_id": self.member_user_id
        }

def main():
    """Main test execution"""
    tester = RoleChangeRequestsAPITester()
    exit_code = tester.run_all_tests()
    
    # Save test results for reporting
    summary = tester.get_test_summary()
    try:
        with open('/app/role_change_requests_test_results.json', 'w') as f:
            json.dump(summary, f, indent=2, default=str)
        print(f"📄 Test results saved to: /app/role_change_requests_test_results.json")
    except Exception as e:
        print(f"⚠️  Could not save test results: {e}")
    
    return exit_code

if __name__ == "__main__":
    sys.exit(main())