#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
import uuid

class WorkMemberSettingsIntegrationTester:
    def __init__(self, base_url="https://zion-eric-ai.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.admin_user_id = None
        self.member_token = None
        self.member_user_id = None
        self.manager_token = None
        self.manager_user_id = None
        self.organization_id = None
        self.team_id = None
        self.change_request_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Test user data
        timestamp = datetime.now().strftime('%H%M%S')
        self.admin_user_data = {
            "email": f"admin_integration_{timestamp}@example.com",
            "password": "TestPass123!",
            "first_name": "Admin",
            "last_name": "Integration",
            "phone": "+1234567890"
        }
        
        self.member_user_data = {
            "email": f"member_integration_{timestamp}@example.com", 
            "password": "TestPass123!",
            "first_name": "Member",
            "last_name": "Integration",
            "phone": "+1234567891"
        }
        
        self.manager_user_data = {
            "email": f"manager_integration_{timestamp}@example.com", 
            "password": "TestPass123!",
            "first_name": "Manager",
            "last_name": "Integration",
            "phone": "+1234567892"
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

    def setup_users_and_organization(self):
        """Setup test users and organization"""
        print("🔧 Setting up test environment...")
        
        # Register admin user
        success, response = self.make_request("POST", "auth/register", self.admin_user_data, 200)
        if not success:
            self.log_test("Setup: Admin Registration", False, f"Response: {response}")
            return False
        self.admin_token = response["access_token"]
        self.admin_user_id = response["user"]["id"]
        
        # Register member user
        success, response = self.make_request("POST", "auth/register", self.member_user_data, 200)
        if not success:
            self.log_test("Setup: Member Registration", False, f"Response: {response}")
            return False
        self.member_token = response["access_token"]
        self.member_user_id = response["user"]["id"]
        
        # Register manager user
        success, response = self.make_request("POST", "auth/register", self.manager_user_data, 200)
        if not success:
            self.log_test("Setup: Manager Registration", False, f"Response: {response}")
            return False
        self.manager_token = response["access_token"]
        self.manager_user_id = response["user"]["id"]
        
        # Create organization
        timestamp = datetime.now().strftime('%H%M%S%f')
        org_data = {
            "name": f"Integration Test Organization {timestamp}",
            "organization_type": "COMPANY",
            "description": "Organization for integration testing",
            "industry": "Technology",
            "creator_role": "ADMIN",
            "creator_department": "Management",
            "creator_job_title": "Administrator"
        }
        
        success, response = self.make_request("POST", "work/organizations", org_data, 200, self.admin_token)
        if not success:
            self.log_test("Setup: Create Organization", False, f"Response: {response}")
            return False
        self.organization_id = response["id"]
        
        # Add member to organization
        member_data = {
            "user_email": self.member_user_data["email"],
            "role": "MEMBER",
            "department": "Engineering",
            "job_title": "Software Developer",
            "can_invite": False,
            "is_admin": False
        }
        
        success, response = self.make_request("POST", f"work/organizations/{self.organization_id}/members", member_data, 200, self.admin_token)
        if not success:
            self.log_test("Setup: Add Member", False, f"Response: {response}")
            return False
        
        # Add manager to organization
        manager_data = {
            "user_email": self.manager_user_data["email"],
            "role": "MANAGER",
            "department": "Engineering",
            "job_title": "Engineering Manager",
            "can_invite": True,
            "is_admin": False
        }
        
        success, response = self.make_request("POST", f"work/organizations/{self.organization_id}/members", manager_data, 200, self.admin_token)
        if not success:
            self.log_test("Setup: Add Manager", False, f"Response: {response}")
            return False
        
        self.log_test("Setup: Environment Setup", True, "All users and organization created successfully")
        return True

    def test_member_settings_workflow(self):
        """Test complete member settings workflow"""
        print("\n📋 Testing Member Settings Workflow...")
        
        # 1. Member updates their job title (immediate update)
        settings_data = {
            "job_title": "Senior Software Developer"
        }
        
        success, response = self.make_request("PUT", f"work/organizations/{self.organization_id}/members/me", settings_data, 200, self.member_token)
        if success:
            self.log_test("Member Settings: Update Job Title", True)
        else:
            self.log_test("Member Settings: Update Job Title", False, f"Response: {response}")
            return False
        
        # 2. Member requests role change (creates change request)
        role_change_data = {
            "requested_role": "MANAGER",
            "requested_department": "Product",
            "reason": "I have gained experience and would like to take on management responsibilities"
        }
        
        success, response = self.make_request("PUT", f"work/organizations/{self.organization_id}/members/me", role_change_data, 200, self.member_token)
        if success:
            self.log_test("Member Settings: Request Role Change", True)
        else:
            self.log_test("Member Settings: Request Role Change", False, f"Response: {response}")
            return False
        
        return True

    def test_role_change_request_workflow(self):
        """Test role change request approval workflow"""
        print("\n🔄 Testing Role Change Request Workflow...")
        
        # 1. Admin gets pending change requests
        success, response = self.make_request("GET", f"work/organizations/{self.organization_id}/change-requests?status=PENDING", None, 200, self.admin_token)
        if not success:
            self.log_test("Role Change: Get Pending Requests", False, f"Response: {response}")
            return False
        
        requests_data = response.get("data", [])
        if not requests_data:
            self.log_test("Role Change: Get Pending Requests", False, "No pending requests found")
            return False
        
        self.change_request_id = requests_data[0]["id"]
        self.log_test("Role Change: Get Pending Requests", True, f"Found {len(requests_data)} pending requests")
        
        # 2. Admin approves the role change request
        success, response = self.make_request("POST", f"work/organizations/{self.organization_id}/change-requests/{self.change_request_id}/approve", None, 200, self.admin_token)
        if success:
            self.log_test("Role Change: Approve Request", True)
        else:
            self.log_test("Role Change: Approve Request", False, f"Response: {response}")
            return False
        
        # 3. Verify the role change was applied
        success, response = self.make_request("GET", f"work/organizations/{self.organization_id}/members", None, 200, self.admin_token)
        if success:
            members = response.get("data", [])
            member_found = False
            for member in members:
                if member["user_id"] == self.member_user_id:
                    if member["role"] == "MANAGER":
                        self.log_test("Role Change: Verify Role Update", True, "Member role updated to MANAGER")
                        member_found = True
                        break
            
            if not member_found:
                self.log_test("Role Change: Verify Role Update", False, "Member role not updated")
                return False
        else:
            self.log_test("Role Change: Verify Role Update", False, f"Response: {response}")
            return False
        
        return True

    def test_team_management_workflow(self):
        """Test team management workflow"""
        print("\n👥 Testing Team Management Workflow...")
        
        # 1. Create a team
        team_data = {
            "name": "Backend Development Team",
            "description": "Team responsible for backend development",
            "department_id": None,
            "team_lead_id": self.manager_user_id
        }
        
        success, response = self.make_request("POST", f"work/organizations/{self.organization_id}/teams", team_data, 200, self.admin_token)
        if not success:
            self.log_test("Team Management: Create Team", False, f"Response: {response}")
            return False
        
        self.team_id = response["team_id"]
        self.log_test("Team Management: Create Team", True, f"Team created with ID: {self.team_id}")
        
        # 2. Get all teams
        success, response = self.make_request("GET", f"work/organizations/{self.organization_id}/teams", None, 200, self.admin_token)
        if not success:
            self.log_test("Team Management: Get Teams", False, f"Response: {response}")
            return False
        
        teams = response.get("data", [])
        team_found = any(team["id"] == self.team_id for team in teams)
        if team_found:
            self.log_test("Team Management: Get Teams", True, f"Found {len(teams)} teams including created team")
        else:
            self.log_test("Team Management: Get Teams", False, "Created team not found in list")
            return False
        
        # 3. Member can also create teams
        member_team_data = {
            "name": "Frontend Development Team",
            "description": "Team for frontend development",
            "department_id": None,
            "team_lead_id": self.member_user_id
        }
        
        success, response = self.make_request("POST", f"work/organizations/{self.organization_id}/teams", member_team_data, 200, self.member_token)
        if success:
            self.log_test("Team Management: Member Create Team", True)
        else:
            self.log_test("Team Management: Member Create Team", False, f"Response: {response}")
        
        return True

    def test_authorization_and_permissions(self):
        """Test authorization and permission checks"""
        print("\n🔒 Testing Authorization & Permissions...")
        
        # 1. Test unauthorized access (no token)
        success, response = self.make_request("GET", f"work/organizations/{self.organization_id}/teams", None, 401, None)
        if success:  # 401 is expected
            self.log_test("Authorization: Unauthorized Access", True, "Correctly rejected unauthorized request")
        else:
            self.log_test("Authorization: Unauthorized Access", False, f"Expected 401, got: {response}")
        
        # 2. Test access to non-existent organization
        fake_org_id = str(uuid.uuid4())
        success, response = self.make_request("GET", f"work/organizations/{fake_org_id}/teams", None, 404, self.admin_token)
        if success:  # 404 is expected
            self.log_test("Authorization: Invalid Organization", True, "Correctly rejected invalid organization")
        else:
            self.log_test("Authorization: Invalid Organization", False, f"Expected 404, got: {response}")
        
        # 3. Test non-member access
        # Create a new user who is not a member
        outsider_data = {
            "email": f"outsider_{datetime.now().strftime('%H%M%S')}@example.com",
            "password": "TestPass123!",
            "first_name": "Outsider",
            "last_name": "User",
            "phone": "+1234567893"
        }
        
        success, response = self.make_request("POST", "auth/register", outsider_data, 200)
        if success:
            outsider_token = response["access_token"]
            
            # Try to access organization teams as non-member
            success, response = self.make_request("GET", f"work/organizations/{self.organization_id}/teams", None, 404, outsider_token)
            if success:  # 404 is expected (not a member)
                self.log_test("Authorization: Non-member Access", True, "Correctly rejected non-member access")
            else:
                self.log_test("Authorization: Non-member Access", False, f"Expected 404, got: {response}")
        else:
            self.log_test("Authorization: Non-member Access", False, "Could not create outsider user")
        
        return True

    def test_error_handling(self):
        """Test error handling scenarios"""
        print("\n⚠️  Testing Error Handling...")
        
        # 1. Test invalid role change request
        invalid_role_data = {
            "requested_role": "INVALID_ROLE",
            "reason": "Testing invalid role"
        }
        
        success, response = self.make_request("PUT", f"work/organizations/{self.organization_id}/members/me", invalid_role_data, 422, self.member_token)
        if success:  # 422 is expected for validation error
            self.log_test("Error Handling: Invalid Role", True, "Correctly rejected invalid role")
        else:
            self.log_test("Error Handling: Invalid Role", False, f"Expected 422, got: {response}")
        
        # 2. Test approving non-existent change request
        fake_request_id = str(uuid.uuid4())
        success, response = self.make_request("POST", f"work/organizations/{self.organization_id}/change-requests/{fake_request_id}/approve", None, 404, self.admin_token)
        if success:  # 404 is expected
            self.log_test("Error Handling: Non-existent Request", True, "Correctly handled non-existent request")
        else:
            self.log_test("Error Handling: Non-existent Request", False, f"Expected 404, got: {response}")
        
        return True

    def run_integration_tests(self):
        """Run all integration tests"""
        print("🚀 Starting Work Member Settings & Role Change Requests Integration Tests...")
        print(f"📍 Testing against: {self.base_url}")
        print("-" * 80)
        
        # Setup
        if not self.setup_users_and_organization():
            print("❌ Setup failed, aborting tests")
            return 1
        
        # Run test workflows
        workflows = [
            self.test_member_settings_workflow,
            self.test_role_change_request_workflow,
            self.test_team_management_workflow,
            self.test_authorization_and_permissions,
            self.test_error_handling,
        ]
        
        for workflow in workflows:
            try:
                workflow()
            except Exception as e:
                print(f"❌ Workflow {workflow.__name__} failed with exception: {e}")
        
        # Print summary
        print("-" * 80)
        print(f"📊 Tests completed: {self.tests_passed}/{self.tests_run}")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Success rate: {success_rate:.1f}%")
        
        if success_rate >= 80:
            print("🎉 Integration tests passed!")
            return 0
        else:
            print("⚠️  Some integration tests failed. Check the details above.")
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
            "team_id": self.team_id,
            "change_request_id": self.change_request_id
        }

def main():
    """Main test execution"""
    tester = WorkMemberSettingsIntegrationTester()
    exit_code = tester.run_integration_tests()
    
    # Save test results for reporting
    summary = tester.get_test_summary()
    try:
        with open('/app/work_member_settings_integration_results.json', 'w') as f:
            json.dump(summary, f, indent=2, default=str)
        print(f"📄 Test results saved to: /app/work_member_settings_integration_results.json")
    except Exception as e:
        print(f"⚠️  Could not save test results: {e}")
    
    return exit_code

if __name__ == "__main__":
    sys.exit(main())