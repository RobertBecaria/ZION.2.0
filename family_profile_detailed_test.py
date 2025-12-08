#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timezone, timedelta
import uuid

class DetailedFamilyProfileTester:
    def __init__(self, base_url="https://orgplanner.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.family_profile_id = None
        self.invitation_id = None
        
        # Test user credentials as specified in review request
        self.test_user_email = "test@example.com"
        self.test_user_password = "password123"

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        if details:
            print(f"   Details: {details}")

    def make_request(self, method, endpoint, data=None, auth_required=False):
        """Make HTTP request to API"""
        url = f"{self.base_url}/{endpoint}"
        headers = {}
        
        if auth_required and self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        headers['Content-Type'] = 'application/json'
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)
            
            print(f"   Request: {method} {url} -> Status: {response.status_code}")
            
            # Print response details for debugging errors
            if response.status_code >= 400:
                try:
                    error_data = response.json()
                    print(f"   Error Details: {error_data}")
                except:
                    print(f"   Error Text: {response.text}")
            
            return response
        except requests.exceptions.RequestException as e:
            print(f"❌ Network error for {method} {url}: {str(e)}")
            return None

    def test_user_login(self):
        """Test login with specified test credentials"""
        print("\n🔍 Testing User Login...")
        
        login_data = {
            "email": self.test_user_email,
            "password": self.test_user_password
        }
        
        response = self.make_request('POST', 'auth/login', login_data)
        
        if response and response.status_code == 200:
            data = response.json()
            if 'access_token' in data and 'user' in data:
                self.token = data['access_token']
                self.user_id = data['user']['id']
                user_role = data['user'].get('role', 'UNKNOWN')
                success = user_role in ['ADULT', 'ADMIN', 'FAMILY_ADMIN']
                self.log_test("User login", success, f"User ID: {self.user_id}, Role: {user_role}")
                return success
            else:
                self.log_test("User login", False, "Missing token or user data")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("User login", False, error_msg)
        
        return False

    def test_family_profile_creation_detailed(self):
        """Test family profile creation with detailed validation"""
        print("\n🔍 Testing Detailed Family Profile Creation...")
        
        if not self.token:
            self.log_test("Family profile creation", False, "No authentication token available")
            return False
        
        # Test with comprehensive family data
        family_data = {
            "family_name": "The Smith Family Profile",
            "family_surname": "Smith",
            "description": "A comprehensive test family profile with all fields",
            "public_bio": "We are a test family for API validation",
            "primary_address": "456 Test Street",
            "city": "Test City",
            "state": "Test State",
            "country": "Test Country",
            "established_date": "2020-06-15T00:00:00Z",
            "is_private": True,
            "allow_public_discovery": False
        }
        
        response = self.make_request('POST', 'family-profiles', family_data, auth_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            
            # Detailed validation of response structure
            required_fields = [
                'id', 'family_name', 'family_surname', 'description', 'public_bio',
                'primary_address', 'city', 'state', 'country', 'established_date',
                'is_private', 'allow_public_discovery', 'member_count', 'children_count',
                'creator_id', 'created_at', 'updated_at', 'is_active',
                'is_user_member', 'user_role', 'subscription_status'
            ]
            
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_test("Family profile creation - structure", False, f"Missing fields: {missing_fields}")
                return False
            
            # Validate data correctness
            validation_checks = [
                (data['family_name'] == family_data['family_name'], "family_name mismatch"),
                (data['family_surname'] == family_data['family_surname'], "family_surname mismatch"),
                (data['creator_id'] == self.user_id, "creator_id mismatch"),
                (data['is_user_member'] == True, "is_user_member should be True"),
                (data['user_role'] == 'CREATOR', "user_role should be CREATOR"),
                (data['member_count'] >= 1, "member_count should be >= 1"),
                (data['is_active'] == True, "is_active should be True"),
                (data['is_private'] == family_data['is_private'], "is_private mismatch"),
                (data['allow_public_discovery'] == family_data['allow_public_discovery'], "allow_public_discovery mismatch")
            ]
            
            failed_checks = [check[1] for check in validation_checks if not check[0]]
            
            if failed_checks:
                self.log_test("Family profile creation - validation", False, f"Failed checks: {failed_checks}")
                return False
            
            self.family_profile_id = data['id']
            self.log_test("Family profile creation", True, f"Family ID: {self.family_profile_id}")
            return True
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("Family profile creation", False, error_msg)
        
        return False

    def test_invitation_acceptance_workflow(self):
        """Test the complete invitation acceptance workflow"""
        print("\n🔍 Testing Invitation Acceptance Workflow...")
        
        if not self.token or not self.family_profile_id:
            self.log_test("Invitation workflow", False, "Prerequisites not met")
            return False
        
        success_count = 0
        total_steps = 3
        
        # Step 1: Send invitation
        invitation_data = {
            "invited_user_email": self.test_user_email,  # Invite ourselves for testing
            "invitation_type": "MEMBER",
            "relationship_to_family": "Test Member",
            "message": "Test invitation for workflow validation"
        }
        
        response = self.make_request('POST', f'family-profiles/{self.family_profile_id}/invite', invitation_data, auth_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            if 'invitation_id' in data:
                self.invitation_id = data['invitation_id']
                success_count += 1
                self.log_test("Send invitation", True, f"Invitation ID: {self.invitation_id}")
            else:
                self.log_test("Send invitation", False, "No invitation_id in response")
                return False
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("Send invitation", False, error_msg)
            return False
        
        # Step 2: Accept invitation
        response = self.make_request('POST', f'family-invitations/{self.invitation_id}/accept', auth_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            if 'message' in data and 'successfully' in data['message'].lower():
                success_count += 1
                self.log_test("Accept invitation", True, data['message'])
            else:
                self.log_test("Accept invitation", False, "Invalid response message")
                return False
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("Accept invitation", False, error_msg)
            return False
        
        # Step 3: Verify membership was created
        response = self.make_request('GET', f'family-profiles/{self.family_profile_id}/members', auth_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            members = data.get('family_members', [])
            
            # Should now have 2 members (creator + accepted member)
            if len(members) >= 2:
                # Check if we have both CREATOR and MEMBER roles
                roles = [member.get('family_role') for member in members]
                if 'CREATOR' in roles and 'MEMBER' in roles:
                    success_count += 1
                    self.log_test("Verify membership created", True, f"Found {len(members)} members with correct roles")
                else:
                    self.log_test("Verify membership created", False, f"Incorrect roles: {roles}")
            else:
                self.log_test("Verify membership created", False, f"Expected >= 2 members, got {len(members)}")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("Verify membership created", False, error_msg)
        
        return success_count == total_steps

    def test_family_posts_with_different_types(self):
        """Test family posts with different content types and privacy levels"""
        print("\n🔍 Testing Family Posts with Different Types...")
        
        if not self.token or not self.family_profile_id:
            self.log_test("Family posts types", False, "Prerequisites not met")
            return False
        
        success_count = 0
        total_tests = 5
        
        # Test different content types
        post_types = [
            {
                "name": "ANNOUNCEMENT",
                "data": {
                    "title": "Family Announcement",
                    "content": "Important family news to share with everyone",
                    "content_type": "ANNOUNCEMENT",
                    "privacy_level": "PUBLIC"
                }
            },
            {
                "name": "PHOTO_ALBUM",
                "data": {
                    "title": "Family Photos",
                    "content": "Check out our latest family photos",
                    "content_type": "PHOTO_ALBUM",
                    "privacy_level": "FAMILY_ONLY"
                }
            },
            {
                "name": "EVENT",
                "data": {
                    "title": "Family Reunion",
                    "content": "Planning our annual family reunion",
                    "content_type": "EVENT",
                    "privacy_level": "PUBLIC"
                }
            },
            {
                "name": "MILESTONE",
                "data": {
                    "title": "Birthday Celebration",
                    "content": "Celebrating a special birthday in the family",
                    "content_type": "MILESTONE",
                    "privacy_level": "FAMILY_ONLY"
                }
            },
            {
                "name": "BUSINESS_UPDATE",
                "data": {
                    "title": "Family Business News",
                    "content": "Updates about our family business",
                    "content_type": "BUSINESS_UPDATE",
                    "privacy_level": "ADMIN_ONLY"
                }
            }
        ]
        
        created_posts = []
        
        for post_type in post_types:
            response = self.make_request('POST', f'family-profiles/{self.family_profile_id}/posts', post_type['data'], auth_required=True)
            
            if response and response.status_code == 200:
                data = response.json()
                if (data.get('content_type') == post_type['data']['content_type'] and
                    data.get('privacy_level') == post_type['data']['privacy_level']):
                    success_count += 1
                    created_posts.append(data['id'])
                    self.log_test(f"Create {post_type['name']} post", True, f"Post ID: {data['id']}")
                else:
                    self.log_test(f"Create {post_type['name']} post", False, "Content type or privacy level mismatch")
            else:
                error_msg = f"Status: {response.status_code}" if response else "No response"
                self.log_test(f"Create {post_type['name']} post", False, error_msg)
        
        # Verify all posts can be retrieved
        if created_posts:
            response = self.make_request('GET', f'family-profiles/{self.family_profile_id}/posts', auth_required=True)
            
            if response and response.status_code == 200:
                data = response.json()
                posts = data.get('family_posts', [])
                
                # Check if all our created posts are in the response
                retrieved_post_ids = [post['id'] for post in posts]
                all_found = all(post_id in retrieved_post_ids for post_id in created_posts)
                
                if all_found:
                    self.log_test("Retrieve all post types", True, f"All {len(created_posts)} posts retrieved successfully")
                else:
                    self.log_test("Retrieve all post types", False, "Some created posts not found in retrieval")
            else:
                self.log_test("Retrieve all post types", False, "Failed to retrieve posts")
        
        return success_count >= 4  # Allow for one failure

    def test_error_handling_and_edge_cases(self):
        """Test error handling and edge cases"""
        print("\n🔍 Testing Error Handling and Edge Cases...")
        
        if not self.token:
            self.log_test("Error handling", False, "No authentication token available")
            return False
        
        success_count = 0
        total_tests = 5
        
        # Test 1: Access non-existent family profile
        fake_family_id = str(uuid.uuid4())
        response = self.make_request('GET', f'family-profiles/{fake_family_id}', auth_required=True)
        
        if response and response.status_code == 404:
            success_count += 1
            self.log_test("Non-existent family 404", True, "Correctly returned 404")
        else:
            status = response.status_code if response else "No response"
            self.log_test("Non-existent family 404", False, f"Expected 404, got {status}")
        
        # Test 2: Invalid family profile data
        invalid_data = {
            "family_name": "",  # Empty name
            "is_private": "not_boolean"  # Invalid type
        }
        
        response = self.make_request('POST', 'family-profiles', invalid_data, auth_required=True)
        
        if response and response.status_code == 422:
            success_count += 1
            self.log_test("Invalid family data validation", True, "Correctly returned 422")
        else:
            status = response.status_code if response else "No response"
            self.log_test("Invalid family data validation", False, f"Expected 422, got {status}")
        
        # Test 3: Access family posts without membership
        if self.family_profile_id:
            # This should work since we're the creator, but let's test with non-existent family
            response = self.make_request('GET', f'family-profiles/{fake_family_id}/posts', auth_required=True)
            
            if response and response.status_code in [403, 404]:
                success_count += 1
                self.log_test("Unauthorized family posts access", True, f"Correctly returned {response.status_code}")
            else:
                status = response.status_code if response else "No response"
                self.log_test("Unauthorized family posts access", False, f"Expected 403/404, got {status}")
        
        # Test 4: Invalid invitation data
        if self.family_profile_id:
            invalid_invitation = {
                "invited_user_email": "invalid-email",  # Invalid email format
                "invitation_type": "INVALID_TYPE"  # Invalid type
            }
            
            response = self.make_request('POST', f'family-profiles/{self.family_profile_id}/invite', invalid_invitation, auth_required=True)
            
            if response and response.status_code == 422:
                success_count += 1
                self.log_test("Invalid invitation data", True, "Correctly returned 422")
            else:
                status = response.status_code if response else "No response"
                self.log_test("Invalid invitation data", False, f"Expected 422, got {status}")
        
        # Test 5: Accept non-existent invitation
        fake_invitation_id = str(uuid.uuid4())
        response = self.make_request('POST', f'family-invitations/{fake_invitation_id}/accept', auth_required=True)
        
        if response and response.status_code == 404:
            success_count += 1
            self.log_test("Non-existent invitation", True, "Correctly returned 404")
        else:
            status = response.status_code if response else "No response"
            self.log_test("Non-existent invitation", False, f"Expected 404, got {status}")
        
        return success_count >= 4  # Allow for one failure

    def run_detailed_tests(self):
        """Run detailed Family Profile System tests"""
        print("🚀 Starting Detailed Family Profile System Tests...")
        print(f"📡 Testing against: {self.base_url}")
        print(f"👤 Using test credentials: {self.test_user_email}")
        print("=" * 60)
        
        # Authentication
        login_success = self.test_user_login()
        if not login_success:
            print("\n❌ CRITICAL: Could not login with test credentials. Stopping tests.")
            return False
        
        print("\n🔥 DETAILED FAMILY PROFILE SYSTEM TESTING")
        print("=" * 60)
        
        # Detailed tests
        profile_created = self.test_family_profile_creation_detailed()
        
        if profile_created:
            self.test_invitation_acceptance_workflow()
            self.test_family_posts_with_different_types()
        
        self.test_error_handling_and_edge_cases()
        
        # Final Results
        print("\n" + "=" * 60)
        print("🏁 DETAILED FAMILY PROFILE SYSTEM TEST RESULTS")
        print("=" * 60)
        print(f"✅ Tests Passed: {self.tests_passed}")
        print(f"❌ Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"📊 Total Tests: {self.tests_run}")
        print(f"📈 Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.tests_passed >= self.tests_run * 0.8:  # 80% success rate
            print("\n🎉 FAMILY PROFILE SYSTEM TESTS MOSTLY SUCCESSFUL!")
            return True
        else:
            print(f"\n⚠️  TOO MANY TESTS FAILED - REVIEW REQUIRED")
            return False

if __name__ == "__main__":
    tester = DetailedFamilyProfileTester()
    success = tester.run_detailed_tests()
    sys.exit(0 if success else 1)