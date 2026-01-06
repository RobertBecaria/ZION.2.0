#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
import uuid
import time

class CleanAdminChangeRequestsTester:
    def __init__(self, base_url="https://zion-eric-ai.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.member_token = None
        self.admin_user_id = None
        self.member_user_id = None
        self.organization_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

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

    def setup_fresh_test_environment(self):
        """Create fresh test users and organization"""
        timestamp = datetime.now().strftime('%H%M%S')
        
        # Create admin user
        admin_data = {
            "email": f"cleanadmin{timestamp}@example.com",
            "password": "admin123",
            "first_name": "Clean",
            "last_name": "Admin",
            "phone": f"+123456{timestamp}"
        }
        
        success, response = self.make_request("POST", "auth/register", admin_data, 200)
        if not (success and "access_token" in response):
            self.log_test("Setup - Create Admin User", False, f"Response: {response}")
            return False
        
        self.admin_token = response["access_token"]
        self.admin_user_id = response["user"]["id"]
        
        # Create member user
        member_data = {
            "email": f"cleanmember{timestamp}@example.com",
            "password": "test123",
            "first_name": "Clean",
            "last_name": "Member",
            "phone": f"+123457{timestamp}"
        }
        
        success, response = self.make_request("POST", "auth/register", member_data, 200)
        if not (success and "access_token" in response):
            self.log_test("Setup - Create Member User", False, f"Response: {response}")
            return False
        
        self.member_token = response["access_token"]
        self.member_user_id = response["user"]["id"]
        
        # Create organization
        org_data = {
            "name": f"Clean Test Org {timestamp}",
            "organization_type": "COMPANY",
            "description": "Clean test organization for change request testing",
            "creator_role": "ADMIN",
            "creator_department": "Management"
        }
        
        success, response = self.make_request("POST", "work/organizations", org_data, 200, self.admin_token)
        if not (success and response.get("id")):
            self.log_test("Setup - Create Organization", False, f"Response: {response}")
            return False
        
        self.organization_id = response["id"]
        
        # Add member to organization
        member_data = {
            "user_email": f"cleanmember{timestamp}@example.com",
            "role": "MEMBER",
            "department": "General"
        }
        
        success, response = self.make_request(
            "POST", 
            f"work/organizations/{self.organization_id}/members", 
            member_data, 
            200, 
            self.admin_token
        )
        
        if success:
            self.log_test("Setup - Fresh Test Environment", True, f"Org ID: {self.organization_id}")
            return True
        else:
            self.log_test("Setup - Fresh Test Environment", False, f"Response: {response}")
            return False

    def test_complete_rejection_flow(self):
        """Test complete rejection flow from start to finish"""
        if not all([self.admin_token, self.member_token, self.organization_id]):
            self.log_test("Complete Rejection Flow", False, "Missing setup data")
            return False
        
        # Step 1: Member submits department change request
        request_data = {
            "requested_department": "Engineering",
            "reason": "I want to move to Engineering department for better career growth."
        }
        
        success, response = self.make_request(
            "PUT", 
            f"work/organizations/{self.organization_id}/members/me", 
            request_data, 
            200, 
            self.member_token
        )
        
        if not success:
            self.log_test("Complete Rejection Flow", False, f"Failed to create request: {response}")
            return False
        
        # Step 2: Wait a moment for the request to be processed
        time.sleep(1)
        
        # Step 3: Admin gets pending requests
        success, response = self.make_request(
            "GET", 
            f"work/organizations/{self.organization_id}/change-requests?status=PENDING", 
            None, 
            200, 
            self.admin_token
        )
        
        if not (success and response.get("success") and isinstance(response.get("data"), list)):
            self.log_test("Complete Rejection Flow", False, f"Failed to get pending requests: {response}")
            return False
        
        # Step 4: Find the department change request
        department_request = None
        for req in response["data"]:
            if (req.get("user_id") == self.member_user_id and 
                req.get("request_type") == "DEPARTMENT_CHANGE"):
                department_request = req
                break
        
        if not department_request:
            self.log_test("Complete Rejection Flow", False, "Department change request not found")
            return False
        
        request_id = department_request["id"]
        
        # Step 5: Admin rejects the request
        rejection_reason = "Engineering department is at full capacity. Please try again next quarter."
        
        success, response = self.make_request(
            "POST", 
            f"work/organizations/{self.organization_id}/change-requests/{request_id}/reject?rejection_reason={rejection_reason}", 
            {}, 
            200, 
            self.admin_token
        )
        
        if not success:
            self.log_test("Complete Rejection Flow", False, f"Failed to reject request: {response}")
            return False
        
        # Step 6: Wait a moment for the rejection to be processed
        time.sleep(1)
        
        # Step 7: Verify the request is now rejected with reason
        success, response = self.make_request(
            "GET", 
            f"work/organizations/{self.organization_id}/change-requests?status=REJECTED", 
            None, 
            200, 
            self.admin_token
        )
        
        if not (success and response.get("success") and isinstance(response.get("data"), list)):
            self.log_test("Complete Rejection Flow", False, f"Failed to get all requests: {response}")
            return False
        
        # Find the rejected request
        rejected_request = None
        for req in response["data"]:
            if req.get("id") == request_id:
                rejected_request = req
                break
        
        if not rejected_request:
            self.log_test("Complete Rejection Flow", False, "Request not found after rejection")
            return False
        
        # Verify rejection details
        if (rejected_request.get("status") == "REJECTED" and 
            rejected_request.get("rejection_reason") and
            "Engineering department is at full capacity" in rejected_request.get("rejection_reason")):
            self.log_test("Complete Rejection Flow", True, "Request properly rejected with reason")
            return True
        else:
            self.log_test("Complete Rejection Flow", False, 
                         f"Request status: {rejected_request.get('status')}, "
                         f"reason: {rejected_request.get('rejection_reason')}")
            return False

    def test_complete_approval_flow(self):
        """Test complete approval flow from start to finish"""
        if not all([self.admin_token, self.member_token, self.organization_id]):
            self.log_test("Complete Approval Flow", False, "Missing setup data")
            return False
        
        # Step 1: Member submits role change request
        request_data = {
            "requested_role": "MANAGER",
            "reason": "I have been taking on management responsibilities and am ready for promotion."
        }
        
        success, response = self.make_request(
            "PUT", 
            f"work/organizations/{self.organization_id}/members/me", 
            request_data, 
            200, 
            self.member_token
        )
        
        if not success:
            self.log_test("Complete Approval Flow", False, f"Failed to create request: {response}")
            return False
        
        # Step 2: Wait a moment for the request to be processed
        time.sleep(1)
        
        # Step 3: Admin gets pending requests
        success, response = self.make_request(
            "GET", 
            f"work/organizations/{self.organization_id}/change-requests?status=PENDING", 
            None, 
            200, 
            self.admin_token
        )
        
        if not (success and response.get("success") and isinstance(response.get("data"), list)):
            self.log_test("Complete Approval Flow", False, f"Failed to get pending requests: {response}")
            return False
        
        # Step 4: Find the role change request
        role_request = None
        for req in response["data"]:
            if (req.get("user_id") == self.member_user_id and 
                req.get("request_type") == "ROLE_CHANGE"):
                role_request = req
                break
        
        if not role_request:
            self.log_test("Complete Approval Flow", False, "Role change request not found")
            return False
        
        request_id = role_request["id"]
        
        # Step 5: Admin approves the request
        success, response = self.make_request(
            "POST", 
            f"work/organizations/{self.organization_id}/change-requests/{request_id}/approve", 
            {}, 
            200, 
            self.admin_token
        )
        
        if not success:
            self.log_test("Complete Approval Flow", False, f"Failed to approve request: {response}")
            return False
        
        # Step 6: Wait a moment for the approval to be processed
        time.sleep(1)
        
        # Step 7: Verify member's role was updated
        success, response = self.make_request(
            "GET", 
            f"work/organizations/{self.organization_id}/members", 
            None, 
            200, 
            self.admin_token
        )
        
        if not (success and "members" in response):
            self.log_test("Complete Approval Flow", False, f"Failed to get members: {response}")
            return False
        
        # Find the member and check their role
        member_found = False
        for member in response["members"]:
            if member.get("user_id") == self.member_user_id:
                member_found = True
                if member.get("role") == "MANAGER":
                    self.log_test("Complete Approval Flow", True, "Member role successfully updated to MANAGER")
                    return True
                else:
                    self.log_test("Complete Approval Flow", False, f"Member role is {member.get('role')}, expected MANAGER")
                    return False
        
        if not member_found:
            self.log_test("Complete Approval Flow", False, "Member not found in organization")
            return False

    def test_badge_count_accuracy(self):
        """Test that badge count is accurate"""
        if not all([self.admin_token, self.member_token, self.organization_id]):
            self.log_test("Badge Count Accuracy", False, "Missing setup data")
            return False
        
        # Get initial pending count
        success, response = self.make_request(
            "GET", 
            f"work/organizations/{self.organization_id}/change-requests?status=PENDING", 
            None, 
            200, 
            self.admin_token
        )
        
        if not (success and response.get("success")):
            self.log_test("Badge Count Accuracy", False, f"Failed to get initial count: {response}")
            return False
        
        initial_count = len(response.get("data", []))
        
        # Create a new request
        request_data = {
            "requested_team": "Backend Team",
            "reason": "Testing badge count accuracy"
        }
        
        success, response = self.make_request(
            "PUT", 
            f"work/organizations/{self.organization_id}/members/me", 
            request_data, 
            200, 
            self.member_token
        )
        
        if not success:
            self.log_test("Badge Count Accuracy", False, f"Failed to create request: {response}")
            return False
        
        # Wait and check new count
        time.sleep(1)
        
        success, response = self.make_request(
            "GET", 
            f"work/organizations/{self.organization_id}/change-requests?status=PENDING", 
            None, 
            200, 
            self.admin_token
        )
        
        if not (success and response.get("success")):
            self.log_test("Badge Count Accuracy", False, f"Failed to get new count: {response}")
            return False
        
        new_count = len(response.get("data", []))
        
        if new_count == initial_count + 1:
            self.log_test("Badge Count Accuracy", True, f"Count increased from {initial_count} to {new_count}")
            return True
        else:
            self.log_test("Badge Count Accuracy", False, f"Expected count {initial_count + 1}, got {new_count}")
            return False

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Clean Admin Panel - Change Requests Management Tests...")
        print(f"📍 Testing against: {self.base_url}")
        print("-" * 80)
        
        # Setup
        if not self.setup_fresh_test_environment():
            print("❌ Failed to set up test environment")
            return 1
        
        # Test sequence
        tests = [
            self.test_complete_rejection_flow,
            self.test_complete_approval_flow,
            self.test_badge_count_accuracy,
        ]
        
        for test in tests:
            test()
            time.sleep(0.5)
        
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

def main():
    """Main test execution"""
    tester = CleanAdminChangeRequestsTester()
    exit_code = tester.run_all_tests()
    return exit_code

if __name__ == "__main__":
    sys.exit(main())