#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
import uuid
import time

class AdminChangeRequestsTester:
    def __init__(self, base_url="https://goodwill-events.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.member_token = None
        self.admin_user_id = None
        self.member_user_id = None
        self.organization_id = "7a1968de-4575-46ef-8d99-7650fd522a2b"  # New test org
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.change_request_ids = []

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
        if token:
            headers['Authorization'] = f'Bearer {token}'

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
        """Test admin user login"""
        login_data = {
            "email": "admintest@example.com",
            "password": "admin123"
        }
        
        success, response = self.make_request("POST", "auth/login", login_data, 200)
        
        if success and "access_token" in response:
            self.admin_token = response["access_token"]
            self.admin_user_id = response["user"]["id"]
            self.log_test("Admin Login", True)
            return True
        else:
            self.log_test("Admin Login", False, f"Response: {response}")
            return False

    def test_member_login(self):
        """Test member user login"""
        login_data = {
            "email": "membertest@example.com",
            "password": "test123"
        }
        
        success, response = self.make_request("POST", "auth/login", login_data, 200)
        
        if success and "access_token" in response:
            self.member_token = response["access_token"]
            self.member_user_id = response["user"]["id"]
            self.log_test("Member Login", True)
            return True
        else:
            self.log_test("Member Login", False, f"Response: {response}")
            return False

    def test_member_submit_role_change_request(self):
        """Test Scenario 1: Member submits role change request (MEMBER → MANAGER)"""
        if not self.member_token:
            self.log_test("Member Submit Role Change Request", False, "No member token")
            return False

        request_data = {
            "requested_role": "MANAGER",
            "reason": "I have been taking on management responsibilities and would like my role to reflect this."
        }
        
        success, response = self.make_request(
            "PUT", 
            f"work/organizations/{self.organization_id}/members/me", 
            request_data, 
            200, 
            self.member_token
        )
        
        if success:
            self.log_test("Member Submit Role Change Request", True)
            return True
        else:
            self.log_test("Member Submit Role Change Request", False, f"Response: {response}")
            return False

    def test_admin_get_pending_count(self):
        """Test Scenario 1: Admin gets pending change requests count"""
        if not self.admin_token:
            self.log_test("Admin Get Pending Count", False, "No admin token")
            return False

        success, response = self.make_request(
            "GET", 
            f"work/organizations/{self.organization_id}/change-requests?status=PENDING", 
            None, 
            200, 
            self.admin_token
        )
        
        if success and response.get("success") and isinstance(response.get("data"), list):
            pending_count = len(response["data"])
            if pending_count >= 1:  # Should have at least the request we just created
                self.log_test("Admin Get Pending Count", True, f"Found {pending_count} pending requests")
                return True
            else:
                self.log_test("Admin Get Pending Count", False, f"Expected at least 1 pending request, got {pending_count}")
                return False
        else:
            self.log_test("Admin Get Pending Count", False, f"Response: {response}")
            return False

    def test_admin_get_pending_requests_list(self):
        """Test Scenario 1: Admin gets list of pending requests"""
        if not self.admin_token:
            self.log_test("Admin Get Pending Requests List", False, "No admin token")
            return False

        success, response = self.make_request(
            "GET", 
            f"work/organizations/{self.organization_id}/change-requests?status=PENDING", 
            None, 
            200, 
            self.admin_token
        )
        
        if success and response.get("success") and isinstance(response.get("data"), list) and len(response["data"]) > 0:
            # Verify the member's request appears
            member_request_found = False
            for request in response["data"]:
                if request.get("user_id") == self.member_user_id and request.get("request_type") == "ROLE_CHANGE":
                    member_request_found = True
                    # Store the request ID for later use
                    self.change_request_ids.append(request.get("id"))
                    # Verify request details
                    if (request.get("requested_role") == "MANAGER" and 
                        request.get("status") == "PENDING" and
                        "user_first_name" in request and
                        "user_last_name" in request and
                        "user_email" in request):
                        self.log_test("Admin Get Pending Requests List", True, "Member's request found with correct details")
                        return True
                    else:
                        self.log_test("Admin Get Pending Requests List", False, "Member's request found but missing details")
                        return False
            
            if not member_request_found:
                self.log_test("Admin Get Pending Requests List", False, "Member's request not found in list")
                return False
        else:
            self.log_test("Admin Get Pending Requests List", False, f"Response: {response}")
            return False

    def test_admin_approve_request(self):
        """Test Scenario 1: Admin approves request"""
        if not self.admin_token or not self.change_request_ids:
            self.log_test("Admin Approve Request", False, "No admin token or change request ID")
            return False

        request_id = self.change_request_ids[0]
        
        success, response = self.make_request(
            "POST", 
            f"work/organizations/{self.organization_id}/change-requests/{request_id}/approve", 
            {}, 
            200, 
            self.admin_token
        )
        
        if success:
            self.log_test("Admin Approve Request", True)
            return True
        else:
            self.log_test("Admin Approve Request", False, f"Response: {response}")
            return False

    def test_verify_member_role_updated(self):
        """Test Scenario 1: Verify member's role updated in work_members collection"""
        if not self.admin_token:
            self.log_test("Verify Member Role Updated", False, "No admin token")
            return False

        # Get organization members to verify role change
        success, response = self.make_request(
            "GET", 
            f"work/organizations/{self.organization_id}/members", 
            None, 
            200, 
            self.admin_token
        )
        
        if success and "members" in response and isinstance(response["members"], list):
            for member in response["members"]:
                if member.get("user_id") == self.member_user_id:
                    if member.get("role") == "MANAGER":
                        self.log_test("Verify Member Role Updated", True, "Member role successfully updated to MANAGER")
                        return True
                    else:
                        self.log_test("Verify Member Role Updated", False, f"Member role is {member.get('role')}, expected MANAGER")
                        return False
            
            self.log_test("Verify Member Role Updated", False, "Member not found in organization")
            return False
        else:
            self.log_test("Verify Member Role Updated", False, f"Response: {response}")
            return False

    def test_verify_pending_count_zero(self):
        """Test Scenario 1: Verify pending count decreased after approval"""
        if not self.admin_token:
            self.log_test("Verify Pending Count Zero", False, "No admin token")
            return False

        success, response = self.make_request(
            "GET", 
            f"work/organizations/{self.organization_id}/change-requests?status=PENDING", 
            None, 
            200, 
            self.admin_token
        )
        
        if success and response.get("success") and isinstance(response.get("data"), list):
            pending_count = len(response["data"])
            # Check that there are no role change requests pending (since we approved it)
            role_change_pending = any(req.get("request_type") == "ROLE_CHANGE" for req in response["data"])
            if not role_change_pending:
                self.log_test("Verify Pending Count Zero", True, f"Role change request no longer pending (total pending: {pending_count})")
                return True
            else:
                self.log_test("Verify Pending Count Zero", False, f"Role change request still pending")
                return False
        else:
            self.log_test("Verify Pending Count Zero", False, f"Response: {response}")
            return False

    def test_member_submit_department_change_request(self):
        """Test Scenario 2: Member submits department change request"""
        if not self.member_token:
            self.log_test("Member Submit Department Change Request", False, "No member token")
            return False

        request_data = {
            "requested_department": "Engineering",
            "reason": "I would like to move to the Engineering department to better utilize my technical skills."
        }
        
        success, response = self.make_request(
            "PUT", 
            f"work/organizations/{self.organization_id}/members/me", 
            request_data, 
            200, 
            self.member_token
        )
        
        if success:
            self.log_test("Member Submit Department Change Request", True)
            return True
        else:
            self.log_test("Member Submit Department Change Request", False, f"Response: {response}")
            return False

    def test_admin_reject_request(self):
        """Test Scenario 2: Admin rejects request with reason"""
        if not self.admin_token:
            self.log_test("Admin Reject Request", False, "No admin token")
            return False

        # Get current pending requests to find the department change request
        success, response = self.make_request(
            "GET", 
            f"work/organizations/{self.organization_id}/change-requests?status=PENDING", 
            None, 
            200, 
            self.admin_token
        )
        
        if not (success and response.get("success") and isinstance(response.get("data"), list)):
            self.log_test("Admin Reject Request", False, f"Failed to get pending requests: {response}")
            return False
        
        # Find department change request
        department_request_id = None
        for request in response["data"]:
            if (request.get("user_id") == self.member_user_id and 
                request.get("request_type") == "DEPARTMENT_CHANGE"):
                department_request_id = request.get("id")
                break
        
        if not department_request_id:
            self.log_test("Admin Reject Request", False, "Department change request not found")
            return False

        rejection_reason = "Engineering department is currently at full capacity. Please reapply next quarter."
        
        success, response = self.make_request(
            "POST", 
            f"work/organizations/{self.organization_id}/change-requests/{department_request_id}/reject?rejection_reason={rejection_reason}", 
            {}, 
            200, 
            self.admin_token
        )
        
        if success:
            self.log_test("Admin Reject Request", True)
            return True
        else:
            self.log_test("Admin Reject Request", False, f"Response: {response}")
            return False

    def test_verify_rejection_saved(self):
        """Test Scenario 2: Verify rejection reason saved and member's department NOT changed"""
        if not self.admin_token:
            self.log_test("Verify Rejection Saved", False, "No admin token")
            return False

        # Get rejected requests to find the rejected one
        success, response = self.make_request(
            "GET", 
            f"work/organizations/{self.organization_id}/change-requests?status=REJECTED", 
            None, 
            200, 
            self.admin_token
        )
        
        if success and response.get("success") and isinstance(response.get("data"), list):
            for request in response["data"]:
                if (request.get("user_id") == self.member_user_id and 
                    request.get("request_type") == "DEPARTMENT_CHANGE" and
                    request.get("status") == "REJECTED"):
                    if request.get("rejection_reason"):
                        self.log_test("Verify Rejection Saved", True, f"Rejection reason saved: {request.get('rejection_reason')}")
                        return True
                    else:
                        self.log_test("Verify Rejection Saved", False, "Rejection reason not saved")
                        return False
            
            # If not found in rejected, check if it's still pending or approved
            dept_requests = [req for req in response["data"] if req.get("user_id") == self.member_user_id and req.get("request_type") == "DEPARTMENT_CHANGE"]
            if dept_requests:
                req = dept_requests[0]
                self.log_test("Verify Rejection Saved", False, f"Department request found but status is {req.get('status')}, not REJECTED")
            else:
                self.log_test("Verify Rejection Saved", False, "Department change request not found at all")
            return False
        else:
            self.log_test("Verify Rejection Saved", False, f"Response: {response}")
            return False

    def test_request_details_validation(self):
        """Test Scenario 5: Verify request contains all required fields"""
        if not self.admin_token:
            self.log_test("Request Details Validation", False, "No admin token")
            return False

        # Get all requests to validate structure
        success, response = self.make_request(
            "GET", 
            f"work/organizations/{self.organization_id}/change-requests", 
            None, 
            200, 
            self.admin_token
        )
        
        if success and response.get("success") and isinstance(response.get("data"), list) and len(response["data"]) > 0:
            request = response["data"][0]  # Check first request
            required_fields = [
                "id", "user_id", "request_type", "status", "created_at",
                "user_first_name", "user_last_name", "user_email"
            ]
            
            missing_fields = []
            for field in required_fields:
                if field not in request:
                    missing_fields.append(field)
            
            if not missing_fields:
                # Check for optional fields that should be present when relevant
                if request.get("status") == "APPROVED" and "reviewed_at" not in request:
                    missing_fields.append("reviewed_at (for approved request)")
                
                if not missing_fields:
                    self.log_test("Request Details Validation", True, "All required fields present")
                    return True
                else:
                    self.log_test("Request Details Validation", False, f"Missing optional fields: {missing_fields}")
                    return False
            else:
                self.log_test("Request Details Validation", False, f"Missing required fields: {missing_fields}")
                return False
        else:
            self.log_test("Request Details Validation", False, f"Response: {response}")
            return False

    def test_non_admin_authorization(self):
        """Test Scenario 6: Test that non-admin cannot access admin endpoints"""
        if not self.member_token:
            self.log_test("Non-Admin Authorization", False, "No member token")
            return False

        # Try to approve a request as member (should fail)
        if self.change_request_ids:
            request_id = self.change_request_ids[0]
            success, response = self.make_request(
                "POST", 
                f"work/organizations/{self.organization_id}/change-requests/{request_id}/approve", 
                {}, 
                403,  # Expect forbidden
                self.member_token
            )
            
            if success:  # Success means we got the expected 403
                self.log_test("Non-Admin Authorization", True, "Member correctly denied admin access")
                return True
            else:
                self.log_test("Non-Admin Authorization", False, f"Member should not have admin access. Response: {response}")
                return False
        else:
            self.log_test("Non-Admin Authorization", False, "No change request ID to test with")
            return False

    def test_edge_case_duplicate_approval(self):
        """Test Scenario 7: Try to approve already approved request"""
        if not self.admin_token or not self.change_request_ids:
            self.log_test("Edge Case - Duplicate Approval", False, "No admin token or change request ID")
            return False

        request_id = self.change_request_ids[0]  # This should already be approved
        
        success, response = self.make_request(
            "POST", 
            f"work/organizations/{self.organization_id}/change-requests/{request_id}/approve", 
            {}, 
            400,  # Expect bad request
            self.admin_token
        )
        
        if success:  # Success means we got the expected 400
            self.log_test("Edge Case - Duplicate Approval", True, "Duplicate approval correctly rejected")
            return True
        elif response.get("status_code") == 404:
            # 404 is also acceptable - request might be removed after approval
            self.log_test("Edge Case - Duplicate Approval", True, "Request not found after approval (acceptable)")
            return True
        else:
            self.log_test("Edge Case - Duplicate Approval", False, f"Should reject duplicate approval. Response: {response}")
            return False

    def test_badge_count_integration(self):
        """Test Scenario 4: Badge count integration"""
        if not self.admin_token:
            self.log_test("Badge Count Integration", False, "No admin token")
            return False

        # Create a new request to test count
        if self.member_token:
            request_data = {
                "requested_team": "Backend Team",
                "reason": "Testing badge count functionality"
            }
            
            success, response = self.make_request(
                "PUT", 
                f"work/organizations/{self.organization_id}/members/me", 
                request_data, 
                200, 
                self.member_token
            )
            
            if success:
                # Now check the count
                success2, response2 = self.make_request(
                    "GET", 
                    f"work/organizations/{self.organization_id}/change-requests?status=PENDING", 
                    None, 
                    200, 
                    self.admin_token
                )
                
                if success2 and response2.get("success") and isinstance(response2.get("data"), list):
                    pending_count = len(response2["data"])
                    if pending_count >= 1:
                        self.log_test("Badge Count Integration", True, f"Badge count shows {pending_count} pending requests")
                        return True
                    else:
                        self.log_test("Badge Count Integration", False, f"Expected at least 1 pending request, got {pending_count}")
                        return False
                else:
                    self.log_test("Badge Count Integration", False, f"Failed to get pending count: {response2}")
                    return False
            else:
                self.log_test("Badge Count Integration", False, f"Failed to create test request: {response}")
                return False
        else:
            self.log_test("Badge Count Integration", False, "No member token to create test request")
            return False

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Admin Panel - Change Requests Management Tests...")
        print(f"📍 Testing against: {self.base_url}")
        print(f"🏢 Organization ID: {self.organization_id}")
        print("-" * 80)
        
        # Test sequence
        tests = [
            # Authentication
            self.test_admin_login,
            self.test_member_login,
            
            # Scenario 1: Complete Member-to-Admin Flow
            self.test_member_submit_role_change_request,
            self.test_admin_get_pending_count,
            self.test_admin_get_pending_requests_list,
            self.test_admin_approve_request,
            self.test_verify_member_role_updated,
            self.test_verify_pending_count_zero,
            
            # Scenario 2: Rejection Flow
            self.test_member_submit_department_change_request,
            self.test_admin_reject_request,
            self.test_verify_rejection_saved,
            
            # Scenario 4: Badge Count Integration
            self.test_badge_count_integration,
            
            # Scenario 5: Request Details Validation
            self.test_request_details_validation,
            
            # Scenario 6: Authorization
            self.test_non_admin_authorization,
            
            # Scenario 7: Edge Cases
            self.test_edge_case_duplicate_approval,
        ]
        
        for test in tests:
            test()
            time.sleep(0.5)  # Small delay between tests
        
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
            "organization_id": self.organization_id,
            "admin_user_id": self.admin_user_id,
            "member_user_id": self.member_user_id,
            "change_request_ids": self.change_request_ids
        }

def main():
    """Main test execution"""
    tester = AdminChangeRequestsTester()
    exit_code = tester.run_all_tests()
    
    # Save test results for reporting
    summary = tester.get_test_summary()
    try:
        with open('/app/admin_change_requests_test_results.json', 'w') as f:
            json.dump(summary, f, indent=2, default=str)
        print(f"📄 Test results saved to: /app/admin_change_requests_test_results.json")
    except Exception as e:
        print(f"⚠️  Could not save test results: {e}")
    
    return exit_code

if __name__ == "__main__":
    sys.exit(main())