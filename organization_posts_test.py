#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
import uuid

class OrganizationPostsAPITester:
    def __init__(self, base_url="https://profile-hub-76.preview.emergentagent.com"):
        self.base_url = base_url
        self.tokens = {}  # Store tokens for different users
        self.user_ids = {}  # Store user IDs for different users
        self.organization_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Create test users with realistic data (dynamic to avoid conflicts)
        timestamp = datetime.now().strftime('%H%M%S')
        self.test_users = {
            "owner": {
                "email": f"owner_{timestamp}@testorg.com",
                "password": "password123",
                "first_name": "Owner",
                "last_name": "User",
                "phone": "+1234567890",
                "expected_can_post": True
            },
            "admin": {
                "email": f"admin_{timestamp}@testorg.com", 
                "password": "password123",
                "first_name": "Admin",
                "last_name": "User",
                "phone": "+1234567891",
                "expected_can_post": True
            },
            "member": {
                "email": f"member_{timestamp}@testorg.com",
                "password": "password123", 
                "first_name": "Member",
                "last_name": "User",
                "phone": "+1234567892",
                "expected_can_post": True  # Assuming member has can_post: true
            }
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

    def make_request(self, method, endpoint, data=None, expected_status=200, user_type=None):
        """Make API request with error handling"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        # Use specific user's token if provided
        if user_type and user_type in self.tokens:
            headers['Authorization'] = f'Bearer {self.tokens[user_type]}'

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

    def test_user_registration(self, user_type):
        """Test user registration for specific user type"""
        user_data = self.test_users[user_type]
        
        success, response = self.make_request("POST", "auth/register", user_data, 200)
        
        if success and "access_token" in response:
            self.tokens[user_type] = response["access_token"]
            self.user_ids[user_type] = response["user"]["id"]
            self.log_test(f"User Registration ({user_type})", True)
            return True
        else:
            self.log_test(f"User Registration ({user_type})", False, f"Response: {response}")
            return False

    def test_user_login(self, user_type):
        """Test user login for specific user type"""
        user_data = self.test_users[user_type]
        login_data = {
            "email": user_data["email"],
            "password": user_data["password"]
        }
        
        success, response = self.make_request("POST", "auth/login", login_data, 200)
        
        if success and "access_token" in response:
            self.tokens[user_type] = response["access_token"]
            self.user_ids[user_type] = response["user"]["id"]
            self.log_test(f"User Login ({user_type})", True)
            return True
        else:
            self.log_test(f"User Login ({user_type})", False, f"Response: {response}")
            return False

    def test_create_organization(self, user_type="owner"):
        """Test creating an organization (owner only)"""
        org_data = {
            "name": f"Test Organization {datetime.now().strftime('%H%M%S')}",
            "organization_type": "COMPANY",
            "description": "Test organization for posts permission testing",
            "industry": "Technology",
            "organization_size": "11-50",
            "website": "https://testorg.com",
            "address_city": "Test City",
            "address_country": "Test Country",
            "creator_role": "CEO",
            "creator_department": "Management"
        }
        
        success, response = self.make_request("POST", "work/organizations", org_data, 200, user_type)
        
        if success and "id" in response:
            self.organization_id = response["id"]
            self.log_test(f"Create Organization ({user_type})", True, f"Created org: {self.organization_id}")
            return True
        else:
            self.log_test(f"Create Organization ({user_type})", False, f"Response: {response}")
            return False

    def test_add_organization_member(self, member_user_type, role="EMPLOYEE", can_post=True):
        """Test adding a member to the organization"""
        if not self.organization_id:
            self.log_test(f"Add Member ({member_user_type})", False, "No organization_id available")
            return False
        
        member_data = {
            "user_email": self.test_users[member_user_type]["email"],
            "role": role,
            "department": "Engineering",
            "job_title": f"Test {role}",
            "can_invite": role in ["CEO", "MANAGER"],
            "is_admin": role in ["CEO", "MANAGER"]
        }
        
        success, response = self.make_request(
            "POST", 
            f"work/organizations/{self.organization_id}/members", 
            member_data, 
            200, 
            "owner"  # Owner adds members
        )
        
        if success:
            self.log_test(f"Add Member ({member_user_type})", True, f"Added as {role}")
            return True
        else:
            self.log_test(f"Add Member ({member_user_type})", False, f"Response: {response}")
            return False

    def test_get_user_organizations(self, user_type):
        """Test getting user's organizations"""
        success, response = self.make_request("GET", "work/organizations", None, 200, user_type)
        
        if success and "organizations" in response:
            organizations = response["organizations"]
            if organizations:
                # Use the first organization for testing
                if not self.organization_id:
                    self.organization_id = organizations[0]["id"]
                self.log_test(f"Get Organizations ({user_type})", True, f"Found {len(organizations)} organizations")
                return True
            else:
                self.log_test(f"Get Organizations ({user_type})", False, "No organizations found")
                return False
        else:
            self.log_test(f"Get Organizations ({user_type})", False, f"Response: {response}")
            return False

    def test_create_organization_post(self, user_type):
        """Test creating a post in organization - THIS IS THE MAIN TEST FOR THE FIX"""
        if not self.organization_id:
            self.log_test(f"Create Organization Post ({user_type})", False, "No organization_id available")
            return False
        
        # Content as query parameter
        content = f"Test post from {user_type} user - {datetime.now().isoformat()}"
        endpoint = f"work/organizations/{self.organization_id}/posts?content={content}"
        
        # This should work for users with can_post: true after the fix
        expected_status = 200 if self.test_users[user_type]["expected_can_post"] else 403
        
        success, response = self.make_request(
            "POST", 
            endpoint, 
            None,  # No JSON body needed
            expected_status, 
            user_type
        )
        
        if success:
            if expected_status == 200:
                self.log_test(f"Create Organization Post ({user_type})", True, "Post created successfully")
            else:
                self.log_test(f"Create Organization Post ({user_type})", True, "Correctly blocked unauthorized user")
            return True
        else:
            error_detail = response.get("detail", "Unknown error")
            if expected_status == 403 and response.get("status_code") == 403:
                # This is expected for users without permission
                self.log_test(f"Create Organization Post ({user_type})", True, f"Correctly blocked: {error_detail}")
                return True
            else:
                self.log_test(f"Create Organization Post ({user_type})", False, f"Response: {response}")
                return False

    def test_get_organization_posts(self, user_type):
        """Test retrieving organization posts"""
        if not self.organization_id:
            self.log_test(f"Get Organization Posts ({user_type})", False, "No organization_id available")
            return False
        
        success, response = self.make_request(
            "GET", 
            f"work/organizations/{self.organization_id}/posts", 
            None, 
            200, 
            user_type
        )
        
        if success and "posts" in response:
            posts_count = len(response["posts"])
            self.log_test(f"Get Organization Posts ({user_type})", True, f"Retrieved {posts_count} posts")
            return True
        else:
            self.log_test(f"Get Organization Posts ({user_type})", False, f"Response: {response}")
            return False

    def test_get_work_posts_feed(self, user_type):
        """Test retrieving work posts feed"""
        success, response = self.make_request("GET", "work/posts/feed", None, 200, user_type)
        
        if success and "posts" in response:
            posts_count = len(response["posts"])
            self.log_test(f"Get Work Posts Feed ({user_type})", True, f"Retrieved {posts_count} posts from feed")
            return True
        else:
            self.log_test(f"Get Work Posts Feed ({user_type})", False, f"Response: {response}")
            return False

    def test_organization_membership_details(self, user_type):
        """Test getting organization details to verify membership structure"""
        if not self.organization_id:
            self.log_test(f"Get Organization Details ({user_type})", False, "No organization_id available")
            return False
        
        success, response = self.make_request(
            "GET", 
            f"work/organizations/{self.organization_id}", 
            None, 
            200, 
            user_type
        )
        
        if success:
            # Check if the response includes user membership details
            user_can_post = response.get("user_can_post", False)
            user_role = response.get("user_role", "Unknown")
            
            details = f"Role: {user_role}, Can Post: {user_can_post}"
            self.log_test(f"Get Organization Details ({user_type})", True, details)
            
            # Verify the fix - user_can_post should match expected
            expected_can_post = self.test_users[user_type]["expected_can_post"]
            if user_can_post == expected_can_post:
                self.log_test(f"Permission Check ({user_type})", True, f"can_post correctly set to {user_can_post}")
            else:
                self.log_test(f"Permission Check ({user_type})", False, f"Expected can_post: {expected_can_post}, Got: {user_can_post}")
            
            return True
        else:
            self.log_test(f"Get Organization Details ({user_type})", False, f"Response: {response}")
            return False

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Organization Posts Permission Fix Tests...")
        print(f"📍 Testing against: {self.base_url}")
        print("🎯 Focus: Verifying organization posts permission fix (line 7012)")
        print("-" * 80)
        
        # Step 1: Register all users
        print("\n📝 STEP 1: User Registration")
        print("-" * 40)
        for user_type in ["owner", "admin", "member"]:
            if not self.test_user_registration(user_type):
                print(f"❌ Failed to register {user_type}, aborting tests")
                return 1
        
        # Step 2: Create organization (owner only)
        print("\n🏢 STEP 2: Organization Setup")
        print("-" * 40)
        if not self.test_create_organization("owner"):
            print("❌ Failed to create organization, aborting tests")
            return 1
        
        # Step 3: Add members to organization
        print("\n👥 STEP 3: Add Organization Members")
        print("-" * 40)
        if not self.test_add_organization_member("admin", "MANAGER", True):
            print("❌ Failed to add admin member")
        if not self.test_add_organization_member("member", "EMPLOYEE", True):
            print("❌ Failed to add regular member")
        
        # Step 4: Test organization posts functionality
        print("\n📝 STEP 4: Organization Posts Testing")
        print("-" * 40)
        
        # Test each user type
        for user_type in ["owner", "admin", "member"]:
            print(f"\n👤 Testing {user_type.upper()} user ({self.test_users[user_type]['email']}):")
            print("-" * 30)
            
            # Test organization membership details
            self.test_organization_membership_details(user_type)
            
            # Test creating posts (main test for the fix)
            self.test_create_organization_post(user_type)
            
            # Test retrieving posts
            self.test_get_organization_posts(user_type)
            
            # Test work posts feed
            self.test_get_work_posts_feed(user_type)
        
        # Print summary
        print("\n" + "=" * 80)
        print(f"📊 Tests completed: {self.tests_passed}/{self.tests_run}")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Success rate: {success_rate:.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed! Organization posts permission fix is working correctly.")
            return 0
        else:
            print("⚠️  Some tests failed. The fix may need additional work.")
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
            "user_ids": self.user_ids,
            "focus": "Organization posts permission fix verification"
        }

def main():
    """Main test execution"""
    tester = OrganizationPostsAPITester()
    exit_code = tester.run_all_tests()
    
    # Save test results for reporting
    summary = tester.get_test_summary()
    try:
        with open('/app/organization_posts_test_results.json', 'w') as f:
            json.dump(summary, f, indent=2, default=str)
        print(f"📄 Test results saved to: /app/organization_posts_test_results.json")
    except Exception as e:
        print(f"⚠️  Could not save test results: {e}")
    
    return exit_code

if __name__ == "__main__":
    sys.exit(main())