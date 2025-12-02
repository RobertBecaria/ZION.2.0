#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class TeamCoreFunctionalityTester:
    def __init__(self, base_url="https://messagehub-387.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.member_token = None
        self.organization_id = "d80dbe76-45e7-45fa-b937-a2b5a20b8aaf"
        self.created_teams = []
        self.tests_run = 0
        self.tests_passed = 0

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
            if details:
                print(f"   📝 {details}")
        else:
            print(f"❌ {name}")
            if details:
                print(f"   ❗ {details}")

    def make_request(self, method, endpoint, data=None, token=None):
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
            
            try:
                response_data = response.json() if response.content else {}
            except:
                response_data = {"raw_response": response.text}
            
            response_data["status_code"] = response.status_code
            return response_data

        except Exception as e:
            return {"error": str(e), "status_code": 0}

    def setup_authentication(self):
        """Setup admin authentication"""
        print("🔐 Setting up authentication...")
        
        login_data = {
            "email": "admin@test.com",
            "password": "admin123"
        }
        
        response = self.make_request("POST", "auth/login", login_data)
        
        if response.get("status_code") == 200 and "access_token" in response:
            self.admin_token = response["access_token"]
            self.log_test("Admin Authentication", True, f"Logged in as {response['user']['email']}")
            return True
        else:
            self.log_test("Admin Authentication", False, f"Login failed: {response}")
            return False

    def test_team_creation_scenarios(self):
        """Test various team creation scenarios"""
        print("\n🏗️  Testing Team Creation Scenarios...")
        
        # Test 1: Minimal data (name only)
        team_data = {"name": "Engineering Team Alpha"}
        response = self.make_request("POST", f"work/organizations/{self.organization_id}/teams", team_data, self.admin_token)
        
        if response.get("status_code") == 200 and response.get("success"):
            team_id = response.get("team_id")
            self.created_teams.append(team_id)
            self.log_test("Create Team - Minimal Data", True, f"Team ID: {team_id}")
        else:
            self.log_test("Create Team - Minimal Data", False, f"Response: {response}")
        
        # Test 2: Full data with description and department
        team_data = {
            "name": "Marketing Team Beta",
            "description": "Responsible for all marketing campaigns and brand management",
            "department_id": "marketing-dept-001"
        }
        response = self.make_request("POST", f"work/organizations/{self.organization_id}/teams", team_data, self.admin_token)
        
        if response.get("status_code") == 200 and response.get("success"):
            team_id = response.get("team_id")
            self.created_teams.append(team_id)
            self.log_test("Create Team - Full Data", True, f"Team ID: {team_id}")
        else:
            self.log_test("Create Team - Full Data", False, f"Response: {response}")
        
        # Test 3: Team with specific team lead
        team_data = {
            "name": "DevOps Team Gamma",
            "description": "Infrastructure and deployment management",
            "team_lead_id": "b2b2f7ee-5b9c-4972-8658-50be80d9429e"  # Admin user ID
        }
        response = self.make_request("POST", f"work/organizations/{self.organization_id}/teams", team_data, self.admin_token)
        
        if response.get("status_code") == 200 and response.get("success"):
            team_id = response.get("team_id")
            self.created_teams.append(team_id)
            self.log_test("Create Team - Specific Team Lead", True, f"Team ID: {team_id}")
        else:
            self.log_test("Create Team - Specific Team Lead", False, f"Response: {response}")

    def test_team_listing_and_validation(self):
        """Test team listing and data validation"""
        print("\n📋 Testing Team Listing and Data Validation...")
        
        response = self.make_request("GET", f"work/organizations/{self.organization_id}/teams", None, self.admin_token)
        
        if response.get("status_code") == 200 and response.get("success"):
            teams = response.get("data", [])
            self.log_test("Get Teams List", True, f"Retrieved {len(teams)} teams")
            
            # Validate team data structure
            if teams:
                sample_team = teams[0]
                required_fields = ["id", "name", "organization_id", "member_ids", "created_by", "created_at", "is_active"]
                missing_fields = [field for field in required_fields if field not in sample_team]
                
                if not missing_fields:
                    self.log_test("Team Data Structure", True, "All required fields present")
                else:
                    self.log_test("Team Data Structure", False, f"Missing fields: {missing_fields}")
                
                # Check creator in member_ids
                creator_in_members = True
                for team in teams:
                    if team.get("name", "").endswith(("Alpha", "Beta", "Gamma")):  # Our test teams
                        creator_id = team.get("created_by")
                        member_ids = team.get("member_ids", [])
                        if creator_id not in member_ids:
                            creator_in_members = False
                            break
                
                if creator_in_members:
                    self.log_test("Creator in Member IDs", True, "All team creators are in member_ids")
                else:
                    self.log_test("Creator in Member IDs", False, "Some creators missing from member_ids")
                
                # Check team lead defaults
                default_lead_correct = True
                for team in teams:
                    if team.get("name") == "Engineering Team Alpha":  # No team_lead_id specified
                        creator_id = team.get("created_by")
                        team_lead_id = team.get("team_lead_id")
                        if creator_id != team_lead_id:
                            default_lead_correct = False
                            break
                
                if default_lead_correct:
                    self.log_test("Team Lead Default", True, "Team lead defaults to creator when not specified")
                else:
                    self.log_test("Team Lead Default", False, "Team lead not defaulting correctly")
            
        else:
            self.log_test("Get Teams List", False, f"Response: {response}")

    def test_authorization_controls(self):
        """Test authorization controls"""
        print("\n🔒 Testing Authorization Controls...")
        
        # Test unauthenticated access
        response = self.make_request("POST", f"work/organizations/{self.organization_id}/teams", {"name": "Unauthorized Team"}, None)
        
        if response.get("status_code") in [401, 403]:
            self.log_test("Unauthenticated Create Team", True, f"Correctly blocked with status {response.get('status_code')}")
        else:
            self.log_test("Unauthenticated Create Team", False, f"Should block unauthenticated access: {response}")
        
        response = self.make_request("GET", f"work/organizations/{self.organization_id}/teams", None, None)
        
        if response.get("status_code") in [401, 403]:
            self.log_test("Unauthenticated Get Teams", True, f"Correctly blocked with status {response.get('status_code')}")
        else:
            self.log_test("Unauthenticated Get Teams", False, f"Should block unauthenticated access: {response}")

    def test_data_validation(self):
        """Test data validation"""
        print("\n✅ Testing Data Validation...")
        
        # Test missing name field
        response = self.make_request("POST", f"work/organizations/{self.organization_id}/teams", {"description": "No name"}, self.admin_token)
        
        if response.get("status_code") == 422:
            self.log_test("Missing Name Validation", True, "Correctly rejected team without name")
        else:
            self.log_test("Missing Name Validation", False, f"Should reject team without name: {response}")
        
        # Test empty name field
        response = self.make_request("POST", f"work/organizations/{self.organization_id}/teams", {"name": ""}, self.admin_token)
        
        if response.get("status_code") == 422:
            self.log_test("Empty Name Validation", True, "Correctly rejected team with empty name")
        else:
            self.log_test("Empty Name Validation", False, f"Should reject team with empty name: {response}")

    def run_comprehensive_test(self):
        """Run comprehensive team management test"""
        print("🚀 Starting Comprehensive Team Management Test")
        print(f"📍 Testing against: {self.base_url}")
        print(f"🏢 Organization ID: {self.organization_id}")
        print("=" * 80)
        
        if not self.setup_authentication():
            print("❌ Authentication failed. Cannot proceed with tests.")
            return 1
        
        self.test_team_creation_scenarios()
        self.test_team_listing_and_validation()
        self.test_authorization_controls()
        self.test_data_validation()
        
        # Summary
        print("\n" + "=" * 80)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        if self.created_teams:
            print(f"🔧 Created Teams: {len(self.created_teams)}")
            for i, team_id in enumerate(self.created_teams, 1):
                print(f"   {i}. {team_id}")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed! Team management functionality is working correctly.")
            return 0
        else:
            print("⚠️  Some tests failed. Review the details above.")
            return 1

def main():
    """Main test execution"""
    tester = TeamCoreFunctionalityTester()
    return tester.run_comprehensive_test()

if __name__ == "__main__":
    sys.exit(main())