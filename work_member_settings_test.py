#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
import uuid

class WorkMemberSettingsAPITester:
    def __init__(self, base_url="https://goodwill-events.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.admin_token = None
        self.admin_user_id = None
        self.member_token = None
        self.member_user_id = None
        self.organization_id = None
        self.team_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Test user data
        timestamp = datetime.now().strftime('%H%M%S')
        self.admin_user_data = {
            "email": f"admin_member_settings_{timestamp}@example.com",
            "password": "TestPass123!",
            "first_name": "Admin",
            "last_name": "MemberSettings",
            "phone": "+1234567890"
        }
        
        self.member_user_data = {
            "email": f"member_settings_{timestamp}@example.com", 
            "password": "TestPass123!",
            "first_name": "Member",
            "last_name": "Settings",
            "phone": "+1234567891"
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
        
        # Use provided token or default to main token
        auth_token = token or self.token
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

    def test_admin_user_registration(self):
        """Test admin user registration"""
        success, response = self.make_request("POST", "auth/register", self.admin_user_data, 200)
        
        if success and "access_token" in response:
            self.admin_token = response["access_token"]
            self.admin_user_id = response["user"]["id"]
            self.token = self.admin_token  # Set as default token
            self.user_id = self.admin_user_id
            self.log_test("Admin User Registration", True)
            return True
        else:
            self.log_test("Admin User Registration", False, f"Response: {response}")
            return False

    def test_member_user_registration(self):
        """Test member user registration"""
        success, response = self.make_request("POST", "auth/register", self.member_user_data, 200)
        
        if success and "access_token" in response:
            self.member_token = response["access_token"]
            self.member_user_id = response["user"]["id"]
            self.log_test("Member User Registration", True)
            return True
        else:
            self.log_test("Member User Registration", False, f"Response: {response}")
            return False

    def test_create_organization(self):
        """Test creating a work organization"""
        timestamp = datetime.now().strftime('%H%M%S%f')
        org_data = {
            "name": f"Member Settings Test Organization {timestamp}",
            "organization_type": "COMPANY",
            "description": "Organization for testing member settings and role changes",
            "industry": "Technology",
            "creator_role": "ADMIN",
            "creator_department": "Management",
            "creator_job_title": "Administrator"
        }
        
        success, response = self.make_request("POST", "work/organizations", org_data, 200, self.admin_token)
        
        if success and response.get("id"):
            self.organization_id = response["id"]
            self.log_test("Create Organization", True)
            return True
        else:
            self.log_test("Create Organization", False, f"Response: {response}")
            return False

    def test_add_member_to_organization(self):
        """Test adding member to organization"""
        if not self.organization_id:
            self.log_test("Add Member to Organization", False, "No organization_id available")
            return False
        
        member_data = {
            "user_email": self.member_user_data["email"],
            "role": "MEMBER",
            "department": "Engineering",
            "job_title": "Software Developer",
            "can_invite": False,
            "is_admin": False
        }
        
        success, response = self.make_request("POST", f"work/organizations/{self.organization_id}/members", member_data, 200, self.admin_token)
        
        if success:
            self.log_test("Add Member to Organization", True)
            return True
        else:
            self.log_test("Add Member to Organization", False, f"Response: {response}")
            return False

    def test_get_member_settings(self):
        """Test getting member settings - GET /api/work/organizations/{organization_id}/members/{user_id}/settings"""
        if not self.organization_id or not self.member_user_id:
            self.log_test("Get Member Settings", False, "Missing organization_id or member_user_id")
            return False
        
        success, response = self.make_request("GET", f"work/organizations/{self.organization_id}/members/{self.member_user_id}/settings", None, 200, self.admin_token)
        
        if success:
            self.log_test("Get Member Settings", True)
            return True
        else:
            # This endpoint might not be implemented yet, check if it's 404
            if response.get("status_code") == 404:
                self.log_test("Get Member Settings", False, "Endpoint not implemented (404)")
            else:
                self.log_test("Get Member Settings", False, f"Response: {response}")
            return False

    def test_update_member_settings(self):
        """Test updating member settings - PUT /api/work/organizations/{organization_id}/members/{user_id}/settings"""
        if not self.organization_id or not self.member_user_id:
            self.log_test("Update Member Settings", False, "Missing organization_id or member_user_id")
            return False
        
        settings_data = {
            "job_title": "Senior Software Developer",
            "department": "Engineering",
            "team": "Backend Team"
        }
        
        success, response = self.make_request("PUT", f"work/organizations/{self.organization_id}/members/{self.member_user_id}/settings", settings_data, 200, self.admin_token)
        
        if success:
            self.log_test("Update Member Settings", True)
            return True
        else:
            # This endpoint might not be implemented yet, check if it's 404
            if response.get("status_code") == 404:
                self.log_test("Update Member Settings", False, "Endpoint not implemented (404)")
            else:
                self.log_test("Update Member Settings", False, f"Response: {response}")
            return False

    def test_member_self_update_settings(self):
        """Test member updating their own settings - PUT /api/work/organizations/{organization_id}/members/me"""
        if not self.organization_id:
            self.log_test("Member Self Update Settings", False, "No organization_id available")
            return False
        
        settings_data = {
            "job_title": "Senior Developer",
            "requested_role": "MANAGER",
            "requested_department": "Product",
            "requested_team": "Frontend Team",
            "reason": "I have gained experience and would like to take on more responsibilities"
        }
        
        success, response = self.make_request("PUT", f"work/organizations/{self.organization_id}/members/me", settings_data, 200, self.member_token)
        
        if success:
            self.log_test("Member Self Update Settings", True)
            return True
        else:
            self.log_test("Member Self Update Settings", False, f"Response: {response}")
            return False

    def test_create_role_change_request(self):
        """Test creating role change request via member settings update"""
        if not self.organization_id:
            self.log_test("Create Role Change Request (via member settings)", False, "No organization_id available")
            return False
        
        # Role change requests are created via the member settings update endpoint
        settings_data = {
            "requested_role": "MANAGER",
            "reason": "Ready for management responsibilities"
        }
        
        success, response = self.make_request("PUT", f"work/organizations/{self.organization_id}/members/me", settings_data, 200, self.member_token)
        
        if success:
            self.log_test("Create Role Change Request (via member settings)", True)
            return True
        else:
            self.log_test("Create Role Change Request (via member settings)", False, f"Response: {response}")
            return False

    def test_get_organization_role_change_requests(self):
        """Test getting all change requests for organization - GET /api/work/organizations/{organization_id}/change-requests"""
        if not self.organization_id:
            self.log_test("Get Organization Change Requests", False, "No organization_id available")
            return False
        
        success, response = self.make_request("GET", f"work/organizations/{self.organization_id}/change-requests", None, 200, self.admin_token)
        
        if success:
            self.log_test("Get Organization Change Requests", True)
            return True
        else:
            self.log_test("Get Organization Change Requests", False, f"Response: {response}")
            return False

    def test_get_specific_role_change_request(self):
        """Test getting specific role change request - GET /api/work/role-change-requests/{request_id}"""
        # This would need a request_id from previous test
        # For now, test with a dummy ID to check if endpoint exists
        dummy_request_id = str(uuid.uuid4())
        
        success, response = self.make_request("GET", f"work/role-change-requests/{dummy_request_id}", None, 404, self.admin_token)
        
        if success:  # 404 is expected for non-existent request
            self.log_test("Get Specific Role Change Request (Endpoint Check)", True)
            return True
        else:
            if response.get("status_code") == 404 and "not found" in response.get("detail", "").lower():
                self.log_test("Get Specific Role Change Request (Endpoint Check)", True)
                return True
            else:
                self.log_test("Get Specific Role Change Request (Endpoint Check)", False, f"Response: {response}")
                return False

    def test_approve_role_change_request(self):
        """Test approving change request - POST /api/work/organizations/{organization_id}/change-requests/{request_id}/approve"""
        if not self.organization_id:
            self.log_test("Approve Change Request (Endpoint Check)", False, "No organization_id available")
            return False
        
        # Test with a dummy ID to check if endpoint exists
        dummy_request_id = str(uuid.uuid4())
        
        success, response = self.make_request("POST", f"work/organizations/{self.organization_id}/change-requests/{dummy_request_id}/approve", None, 404, self.admin_token)
        
        if success:  # 404 is expected for non-existent request
            self.log_test("Approve Change Request (Endpoint Check)", True)
            return True
        else:
            if response.get("status_code") == 404:
                self.log_test("Approve Change Request (Endpoint Check)", True)
                return True
            else:
                self.log_test("Approve Change Request (Endpoint Check)", False, f"Response: {response}")
                return False

    def test_create_team(self):
        """Test creating team - POST /api/work/organizations/{organization_id}/teams"""
        if not self.organization_id:
            self.log_test("Create Team", False, "No organization_id available")
            return False
        
        team_data = {
            "name": "Backend Development Team",
            "description": "Team responsible for backend development",
            "department_id": None,
            "team_lead_id": self.admin_user_id
        }
        
        success, response = self.make_request("POST", f"work/organizations/{self.organization_id}/teams", team_data, 200, self.admin_token)
        
        if success and response.get("team_id"):
            self.team_id = response["team_id"]
            self.log_test("Create Team", True)
            return True
        else:
            self.log_test("Create Team", False, f"Response: {response}")
            return False

    def test_get_teams(self):
        """Test getting teams - GET /api/work/organizations/{organization_id}/teams"""
        if not self.organization_id:
            self.log_test("Get Teams", False, "No organization_id available")
            return False
        
        success, response = self.make_request("GET", f"work/organizations/{self.organization_id}/teams", None, 200, self.admin_token)
        
        if success:
            self.log_test("Get Teams", True)
            return True
        else:
            self.log_test("Get Teams", False, f"Response: {response}")
            return False

    def test_update_team(self):
        """Test updating team - PUT /api/work/teams/{team_id}"""
        if not self.team_id:
            self.log_test("Update Team", False, "No team_id available")
            return False
        
        update_data = {
            "name": "Updated Backend Development Team",
            "description": "Updated team description"
        }
        
        success, response = self.make_request("PUT", f"work/teams/{self.team_id}", update_data, 200, self.admin_token)
        
        if success:
            self.log_test("Update Team", True)
            return True
        else:
            # Check if endpoint exists
            if response.get("status_code") == 404:
                self.log_test("Update Team", False, "Endpoint not implemented (404)")
            else:
                self.log_test("Update Team", False, f"Response: {response}")
            return False

    def test_delete_team(self):
        """Test deleting team - DELETE /api/work/teams/{team_id}"""
        if not self.team_id:
            self.log_test("Delete Team", False, "No team_id available")
            return False
        
        success, response = self.make_request("DELETE", f"work/teams/{self.team_id}", None, 200, self.admin_token)
        
        if success:
            self.log_test("Delete Team", True)
            return True
        else:
            # Check if endpoint exists
            if response.get("status_code") == 404:
                self.log_test("Delete Team", False, "Endpoint not implemented (404)")
            else:
                self.log_test("Delete Team", False, f"Response: {response}")
            return False

    def test_unauthorized_access(self):
        """Test unauthorized access to member settings"""
        if not self.organization_id or not self.member_user_id:
            self.log_test("Unauthorized Access Test", False, "Missing organization_id or member_user_id")
            return False
        
        # Try to access member settings without authentication
        success, response = self.make_request("GET", f"work/organizations/{self.organization_id}/members/{self.member_user_id}/settings", None, 401, None)
        
        if success:  # 401 is expected
            self.log_test("Unauthorized Access Test", True)
            return True
        else:
            self.log_test("Unauthorized Access Test", False, f"Expected 401, got: {response}")
            return False

    def test_invalid_organization_id(self):
        """Test with invalid organization ID"""
        invalid_org_id = str(uuid.uuid4())
        
        success, response = self.make_request("GET", f"work/organizations/{invalid_org_id}/teams", None, 404, self.admin_token)
        
        if success:  # 404 is expected
            self.log_test("Invalid Organization ID Test", True)
            return True
        else:
            self.log_test("Invalid Organization ID Test", False, f"Expected 404, got: {response}")
            return False

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Work Member Settings & Role Change Requests API Tests...")
        print(f"📍 Testing against: {self.base_url}")
        print(f"👤 Admin user email: {self.admin_user_data['email']}")
        print(f"👤 Member user email: {self.member_user_data['email']}")
        print("-" * 80)
        
        # Test sequence
        tests = [
            self.test_admin_user_registration,
            self.test_member_user_registration,
            self.test_create_organization,
            self.test_add_member_to_organization,
            
            # Member Settings Endpoints
            self.test_get_member_settings,
            self.test_update_member_settings,
            self.test_member_self_update_settings,
            
            # Role Change Request Endpoints
            self.test_create_role_change_request,
            self.test_get_organization_role_change_requests,
            self.test_get_specific_role_change_request,
            self.test_approve_role_change_request,
            
            # Team Management Endpoints
            self.test_create_team,
            self.test_get_teams,
            self.test_update_team,
            self.test_delete_team,
            
            # Error Handling Tests
            self.test_unauthorized_access,
            self.test_invalid_organization_id,
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
            "admin_user_email": self.admin_user_data["email"],
            "member_user_email": self.member_user_data["email"],
            "organization_id": self.organization_id,
            "team_id": self.team_id
        }

def main():
    """Main test execution"""
    tester = WorkMemberSettingsAPITester()
    exit_code = tester.run_all_tests()
    
    # Save test results for reporting
    summary = tester.get_test_summary()
    try:
        with open('/app/work_member_settings_test_results.json', 'w') as f:
            json.dump(summary, f, indent=2, default=str)
        print(f"📄 Test results saved to: /app/work_member_settings_test_results.json")
    except Exception as e:
        print(f"⚠️  Could not save test results: {e}")
    
    return exit_code

if __name__ == "__main__":
    sys.exit(main())