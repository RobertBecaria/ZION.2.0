#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
import uuid

class TeamManagementAPITester:
    def __init__(self, base_url="https://mod-official-news.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.member_token = None
        self.non_member_token = None
        self.admin_user_id = None
        self.member_user_id = None
        self.non_member_user_id = None
        self.organization_id = "d80dbe76-45e7-45fa-b937-a2b5a20b8aaf"  # ZION.CITY organization
        self.created_teams = []
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

    def test_admin_login(self):
        """Test admin login with provided credentials"""
        login_data = {
            "email": "admin@test.com",
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

    def test_create_test_member(self):
        """Create a test member user for testing"""
        timestamp = datetime.now().strftime('%H%M%S')
        member_data = {
            "email": f"member_test_{timestamp}@example.com",
            "password": "TestPass123!",
            "first_name": "Test",
            "last_name": "Member",
            "phone": "+1234567890"
        }
        
        success, response = self.make_request("POST", "auth/register", member_data, 200)
        
        if success and "access_token" in response:
            self.member_token = response["access_token"]
            self.member_user_id = response["user"]["id"]
            
            # Add member to organization
            add_member_data = {
                "user_email": member_data["email"],
                "role": "MEMBER",
                "department": "Engineering",
                "can_invite": False,
                "is_admin": False
            }
            
            add_success, add_response = self.make_request(
                "POST", 
                f"work/organizations/{self.organization_id}/members", 
                add_member_data, 
                200, 
                self.admin_token
            )
            
            if add_success:
                self.log_test("Create Test Member & Add to Organization", True)
                return True
            else:
                self.log_test("Create Test Member & Add to Organization", False, f"Add member failed: {add_response}")
                return False
        else:
            self.log_test("Create Test Member", False, f"Registration failed: {response}")
            return False

    def test_create_non_member_user(self):
        """Create a user who is NOT a member of the organization"""
        timestamp = datetime.now().strftime('%H%M%S')
        non_member_data = {
            "email": f"nonmember_test_{timestamp}@example.com",
            "password": "TestPass123!",
            "first_name": "Non",
            "last_name": "Member",
            "phone": "+1234567891"
        }
        
        success, response = self.make_request("POST", "auth/register", non_member_data, 200)
        
        if success and "access_token" in response:
            self.non_member_token = response["access_token"]
            self.non_member_user_id = response["user"]["id"]
            self.log_test("Create Non-Member User", True)
            return True
        else:
            self.log_test("Create Non-Member User", False, f"Response: {response}")
            return False

    def test_create_team_minimal_data(self):
        """Test creating team with minimal required data (name only)"""
        team_data = {
            "name": "Test Team Minimal"
        }
        
        success, response = self.make_request(
            "POST", 
            f"work/organizations/{self.organization_id}/teams", 
            team_data, 
            200, 
            self.member_token
        )
        
        if success and response.get("success") and response.get("team_id"):
            team_id = response["team_id"]
            self.created_teams.append(team_id)
            self.log_test("Create Team - Minimal Data", True, f"Team ID: {team_id}")
            return True
        else:
            self.log_test("Create Team - Minimal Data", False, f"Response: {response}")
            return False

    def test_create_team_full_data(self):
        """Test creating team with full data including department and team lead"""
        team_data = {
            "name": "Test Team Full Data",
            "description": "A comprehensive test team with all fields",
            "department_id": "engineering-dept-123",
            "team_lead_id": self.admin_user_id
        }
        
        success, response = self.make_request(
            "POST", 
            f"work/organizations/{self.organization_id}/teams", 
            team_data, 
            200, 
            self.member_token
        )
        
        if success and response.get("success") and response.get("team_id"):
            team_id = response["team_id"]
            self.created_teams.append(team_id)
            self.log_test("Create Team - Full Data", True, f"Team ID: {team_id}")
            return True
        else:
            self.log_test("Create Team - Full Data", False, f"Response: {response}")
            return False

    def test_create_team_no_team_lead(self):
        """Test creating team without team_lead_id (should default to creator)"""
        team_data = {
            "name": "Test Team Default Lead",
            "description": "Team where creator becomes team lead by default"
        }
        
        success, response = self.make_request(
            "POST", 
            f"work/organizations/{self.organization_id}/teams", 
            team_data, 
            200, 
            self.member_token
        )
        
        if success and response.get("success") and response.get("team_id"):
            team_id = response["team_id"]
            self.created_teams.append(team_id)
            self.log_test("Create Team - Default Team Lead", True, f"Team ID: {team_id}")
            return True
        else:
            self.log_test("Create Team - Default Team Lead", False, f"Response: {response}")
            return False

    def test_create_team_validation_error(self):
        """Test creating team with missing required field (name)"""
        team_data = {
            "description": "Team without name should fail"
        }
        
        success, response = self.make_request(
            "POST", 
            f"work/organizations/{self.organization_id}/teams", 
            team_data, 
            422,  # Validation error expected
            self.member_token
        )
        
        if success or (not success and response.get("status_code") == 422):
            self.log_test("Create Team - Validation Error (Missing Name)", True, "Correctly rejected team without name")
            return True
        else:
            self.log_test("Create Team - Validation Error (Missing Name)", False, f"Response: {response}")
            return False

    def test_get_teams_as_member(self):
        """Test getting all teams as organization member"""
        success, response = self.make_request(
            "GET", 
            f"work/organizations/{self.organization_id}/teams", 
            None, 
            200, 
            self.member_token
        )
        
        if success and response.get("success") and "data" in response:
            teams = response["data"]
            created_team_count = len([t for t in teams if t.get("name", "").startswith("Test Team")])
            
            self.log_test("Get Teams - As Member", True, f"Found {len(teams)} total teams, {created_team_count} test teams")
            
            # Verify team structure
            if teams:
                sample_team = teams[0]
                required_fields = ["id", "name", "organization_id", "member_ids", "created_by", "created_at", "is_active"]
                missing_fields = [field for field in required_fields if field not in sample_team]
                
                if not missing_fields:
                    self.log_test("Team Data Structure Validation", True, "All required fields present")
                else:
                    self.log_test("Team Data Structure Validation", False, f"Missing fields: {missing_fields}")
            
            return True
        else:
            self.log_test("Get Teams - As Member", False, f"Response: {response}")
            return False

    def test_verify_creator_in_members(self):
        """Test that team creator is automatically added to member_ids"""
        success, response = self.make_request(
            "GET", 
            f"work/organizations/{self.organization_id}/teams", 
            None, 
            200, 
            self.member_token
        )
        
        if success and response.get("success") and "data" in response:
            teams = response["data"]
            test_teams = [t for t in teams if t.get("name", "").startswith("Test Team")]
            
            all_valid = True
            for team in test_teams:
                creator_id = team.get("created_by")
                member_ids = team.get("member_ids", [])
                
                if creator_id not in member_ids:
                    all_valid = False
                    self.log_test("Creator in Members Check", False, f"Team '{team.get('name')}': Creator {creator_id} not in member_ids {member_ids}")
                    break
            
            if all_valid and test_teams:
                self.log_test("Creator in Members Check", True, f"Verified {len(test_teams)} teams have creator in member_ids")
                return True
            elif not test_teams:
                self.log_test("Creator in Members Check", False, "No test teams found to verify")
                return False
        else:
            self.log_test("Creator in Members Check", False, f"Failed to get teams: {response}")
            return False

    def test_verify_team_lead_defaults(self):
        """Test that team_lead_id defaults to creator when not provided"""
        success, response = self.make_request(
            "GET", 
            f"work/organizations/{self.organization_id}/teams", 
            None, 
            200, 
            self.member_token
        )
        
        if success and response.get("success") and "data" in response:
            teams = response["data"]
            default_lead_teams = [t for t in teams if t.get("name") == "Test Team Default Lead"]
            
            if default_lead_teams:
                team = default_lead_teams[0]
                creator_id = team.get("created_by")
                team_lead_id = team.get("team_lead_id")
                
                if creator_id == team_lead_id:
                    self.log_test("Team Lead Default Check", True, f"Creator {creator_id} correctly set as team lead")
                    return True
                else:
                    self.log_test("Team Lead Default Check", False, f"Creator {creator_id} != Team Lead {team_lead_id}")
                    return False
            else:
                self.log_test("Team Lead Default Check", False, "Default lead test team not found")
                return False
        else:
            self.log_test("Team Lead Default Check", False, f"Failed to get teams: {response}")
            return False

    def test_non_member_create_team_forbidden(self):
        """Test that non-members cannot create teams (403 error)"""
        team_data = {
            "name": "Unauthorized Team"
        }
        
        success, response = self.make_request(
            "POST", 
            f"work/organizations/{self.organization_id}/teams", 
            team_data, 
            404,  # Expecting 404 "not a member" error
            self.non_member_token
        )
        
        if success or (not success and response.get("status_code") in [403, 404]):
            self.log_test("Non-Member Create Team - Authorization Check", True, "Correctly denied access to non-member")
            return True
        else:
            self.log_test("Non-Member Create Team - Authorization Check", False, f"Response: {response}")
            return False

    def test_non_member_get_teams_forbidden(self):
        """Test that non-members cannot view teams (403 error)"""
        success, response = self.make_request(
            "GET", 
            f"work/organizations/{self.organization_id}/teams", 
            None, 
            404,  # Expecting 404 "not a member" error
            self.non_member_token
        )
        
        if success or (not success and response.get("status_code") in [403, 404]):
            self.log_test("Non-Member Get Teams - Authorization Check", True, "Correctly denied access to non-member")
            return True
        else:
            self.log_test("Non-Member Get Teams - Authorization Check", False, f"Response: {response}")
            return False

    def test_unauthenticated_access(self):
        """Test that unauthenticated requests are rejected"""
        # Test create team without token
        team_data = {"name": "Unauthenticated Team"}
        success, response = self.make_request(
            "POST", 
            f"work/organizations/{self.organization_id}/teams", 
            team_data, 
            401,  # Unauthorized
            None  # No token
        )
        
        create_blocked = success or (not success and response.get("status_code") == 401)
        
        # Test get teams without token
        success, response = self.make_request(
            "GET", 
            f"work/organizations/{self.organization_id}/teams", 
            None, 
            401,  # Unauthorized
            None  # No token
        )
        
        get_blocked = success or (not success and response.get("status_code") == 401)
        
        if create_blocked and get_blocked:
            self.log_test("Unauthenticated Access Check", True, "Both endpoints correctly require authentication")
            return True
        else:
            self.log_test("Unauthenticated Access Check", False, f"Create blocked: {create_blocked}, Get blocked: {get_blocked}")
            return False

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Team Management API Tests...")
        print(f"📍 Testing against: {self.base_url}")
        print(f"🏢 Organization ID: {self.organization_id}")
        print("-" * 80)
        
        # Test sequence
        tests = [
            self.test_admin_login,
            self.test_create_test_member,
            self.test_create_non_member_user,
            self.test_create_team_minimal_data,
            self.test_create_team_full_data,
            self.test_create_team_no_team_lead,
            self.test_create_team_validation_error,
            self.test_get_teams_as_member,
            self.test_verify_creator_in_members,
            self.test_verify_team_lead_defaults,
            self.test_non_member_create_team_forbidden,
            self.test_non_member_get_teams_forbidden,
            self.test_unauthenticated_access,
        ]
        
        for test in tests:
            test()
        
        # Print summary
        print("-" * 80)
        print(f"📊 Tests completed: {self.tests_passed}/{self.tests_run}")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Success rate: {success_rate:.1f}%")
        
        if self.created_teams:
            print(f"🔧 Created {len(self.created_teams)} test teams: {self.created_teams}")
        
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
            "created_teams": self.created_teams,
            "admin_user_id": self.admin_user_id,
            "member_user_id": self.member_user_id,
            "non_member_user_id": self.non_member_user_id
        }

def main():
    """Main test execution"""
    tester = TeamManagementAPITester()
    exit_code = tester.run_all_tests()
    
    # Save test results for reporting
    summary = tester.get_test_summary()
    try:
        with open('/app/team_management_test_results.json', 'w') as f:
            json.dump(summary, f, indent=2, default=str)
        print(f"📄 Test results saved to: /app/team_management_test_results.json")
    except Exception as e:
        print(f"⚠️  Could not save test results: {e}")
    
    return exit_code

if __name__ == "__main__":
    sys.exit(main())