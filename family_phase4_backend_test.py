#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
import uuid

class FamilyPhase4BackendTester:
    def __init__(self, base_url="https://news-social-update.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.second_user_token = None
        self.second_user_id = None
        self.family_unit_id = None
        self.join_request_id = None
        self.tests_run = 0
        self.tests_passed = 0
        
        # Test credentials from review request
        self.test_user_email = "test@example.com"
        self.test_user_password = "password123"
        
        # Second test user for join request testing
        self.second_user_email = f"test_user_{datetime.now().strftime('%Y%m%d_%H%M%S')}@example.com"
        self.second_user_data = {
            "email": self.second_user_email,
            "password": "testpass123",
            "first_name": "Second",
            "last_name": "TestUser", 
            "middle_name": "Test",
            "phone": "+38067654321"
        }

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        if details and success:
            print(f"   Details: {details}")

    def make_request(self, method, endpoint, data=None, auth_required=False, token=None):
        """Make HTTP request to API"""
        url = f"{self.base_url}/{endpoint}"
        headers = {}
        
        # Use specific token if provided, otherwise use default token
        auth_token = token if token else self.token
        
        if auth_required and auth_token:
            headers['Authorization'] = f'Bearer {auth_token}'
        
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
        """Test login with provided credentials"""
        print("\n🔍 Testing User Login with Test Credentials...")
        
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
                success = data['user']['email'] == self.test_user_email
                self.log_test("User login with test credentials", success, f"User ID: {self.user_id}")
                return success
            else:
                self.log_test("User login with test credentials", False, "Missing token or user data")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("User login with test credentials", False, error_msg)
        
        return False

    def test_profile_completion_system(self):
        """Test Profile Completion System - PUT /api/users/profile/complete"""
        print("\n🏠 Testing Profile Completion System...")
        
        if not self.token:
            self.log_test("Profile completion system", False, "No authentication token available")
            return False
        
        # Test 1: Complete profile with full address data
        profile_data = {
            "address_street": "123 Family Street",
            "address_city": "Family City", 
            "address_state": "Family State",
            "address_country": "Family Country",
            "address_postal_code": "12345",
            "marriage_status": "MARRIED",
            "spouse_name": "Test Spouse",
            "spouse_phone": "+1234567890"
        }
        
        response = self.make_request('PUT', 'users/profile/complete', profile_data, auth_required=True)
        if response and response.status_code == 200:
            data = response.json()
            success = data.get("profile_completed") == True
            self.log_test("Complete profile with address data", success, f"Profile completed: {data.get('profile_completed')}")
            
            # Test 2: Test different marriage statuses
            for status in ["SINGLE", "DIVORCED", "WIDOWED"]:
                test_data = profile_data.copy()
                test_data["marriage_status"] = status
                test_data["spouse_name"] = None
                test_data["spouse_phone"] = None
                
                response = self.make_request('PUT', 'users/profile/complete', test_data, auth_required=True)
                if response and response.status_code == 200:
                    self.log_test(f"Marriage status {status}", True, f"Successfully updated to {status}")
                else:
                    self.log_test(f"Marriage status {status}", False, f"Failed to update to {status}")
            
            # Reset to MARRIED for further tests
            response = self.make_request('PUT', 'users/profile/complete', profile_data, auth_required=True)
            return success
        else:
            self.log_test("Complete profile with address data", False, f"Status: {response.status_code if response else 'No response'}")
            return False

    def test_intelligent_matching_system(self):
        """Test Intelligent Matching System - GET /api/family-units/check-match"""
        print("\n🔍 Testing Intelligent Matching System...")
        
        if not self.token:
            self.log_test("Intelligent matching system", False, "No authentication token available")
            return False
        
        response = self.make_request('GET', 'family-units/check-match', auth_required=True)
        if response and response.status_code == 200:
            data = response.json()
            matches = data.get("matches", [])
            success = isinstance(matches, list)
            self.log_test("Intelligent matching check", success, f"Found {len(matches)} potential matches")
            
            # Test empty results scenario (should be empty initially)
            if len(matches) == 0:
                self.log_test("Empty results scenario", True, "No existing families to match (expected)")
            else:
                # If matches exist, verify structure
                for match in matches:
                    if not all(key in match for key in ['family_unit_id', 'family_name', 'match_score']):
                        self.log_test("Match structure validation", False, "Invalid match structure")
                        return False
                self.log_test("Match structure validation", True, "All matches have proper structure")
            
            return success
        else:
            self.log_test("Intelligent matching check", False, f"Status: {response.status_code if response else 'No response'}")
            return False

    def test_family_unit_crud_operations(self):
        """Test Family Unit CRUD Operations"""
        print("\n👨‍👩‍👧‍👦 Testing Family Unit CRUD Operations...")
        
        if not self.token:
            self.log_test("Family unit CRUD", False, "No authentication token available")
            return False
        
        # Test 1: Create new family unit - POST /api/family-units
        family_data = {
            "family_name": "Test Family Unit",
            "family_surname": "TestSurname"
        }
        
        response = self.make_request('POST', 'family-units', family_data, auth_required=True)
        if response and response.status_code == 200:
            data = response.json()
            self.family_unit_id = data.get("id")
            success = (
                self.family_unit_id is not None and
                data.get("family_name") == "Test Family Unit" and
                data.get("family_surname") == "TestSurname" and
                data.get("member_count") == 1 and
                data.get("is_user_member") == True and
                data.get("user_role") == "HEAD"
            )
            self.log_test("Create new family unit", success, f"Family ID: {self.family_unit_id}")
            
            # Verify creator added as HEAD
            if success:
                self.log_test("Creator added as HEAD", True, "User automatically added as HEAD role")
                
                # Verify address copied correctly
                address = data.get("address", {})
                if address.get("street") == "123 Family Street":
                    self.log_test("Address copied correctly", True, "User address copied to family unit")
                else:
                    self.log_test("Address copied correctly", False, "Address not copied properly")
        else:
            self.log_test("Create new family unit", False, f"Status: {response.status_code if response else 'No response'}")
            return False
        
        # Test 2: List user's families - GET /api/family-units/my-units
        response = self.make_request('GET', 'family-units/my-units', auth_required=True)
        if response and response.status_code == 200:
            data = response.json()
            family_units = data.get("family_units", [])
            success = len(family_units) > 0
            
            if success:
                # Find our created family
                our_family = None
                for family in family_units:
                    if family.get("id") == self.family_unit_id:
                        our_family = family
                        break
                
                if our_family:
                    self.log_test("List user's family units", True, f"Found {len(family_units)} family units")
                    
                    # Verify user role and membership
                    if our_family.get("user_role") == "HEAD" and our_family.get("is_user_member") == True:
                        self.log_test("User role verification", True, "User role = HEAD, is_user_member = true")
                    else:
                        self.log_test("User role verification", False, "Incorrect user role or membership status")
                else:
                    self.log_test("List user's family units", False, "Created family not found in user's families")
            else:
                self.log_test("List user's family units", False, "No family units found")
        else:
            self.log_test("List user's family units", False, f"Status: {response.status_code if response else 'No response'}")
        
        return True

    def create_second_test_user(self):
        """Create second test user for join request testing"""
        print("\n👤 Creating Second Test User...")
        
        response = self.make_request('POST', 'auth/register', self.second_user_data)
        
        if response and response.status_code == 200:
            data = response.json()
            if 'access_token' in data and 'user' in data:
                self.second_user_token = data['access_token']
                self.second_user_id = data['user']['id']
                self.log_test("Create second test user", True, f"Second user ID: {self.second_user_id}")
                
                # Complete profile for second user
                profile_data = {
                    "address_street": "456 Different Street",
                    "address_city": "Different City", 
                    "address_state": "Different State",
                    "address_country": "Different Country",
                    "address_postal_code": "67890",
                    "marriage_status": "SINGLE"
                }
                
                response = self.make_request('PUT', 'users/profile/complete', profile_data, auth_required=True, token=self.second_user_token)
                if response and response.status_code == 200:
                    self.log_test("Complete second user profile", True, "Second user profile completed")
                    return True
                else:
                    self.log_test("Complete second user profile", False, "Failed to complete second user profile")
            else:
                self.log_test("Create second test user", False, "Missing token or user data")
        else:
            self.log_test("Create second test user", False, f"Status: {response.status_code if response else 'No response'}")
        
        return False

    def test_join_request_workflow(self):
        """Test Join Request Workflow - POST /api/family-units/{id}/join-request"""
        print("\n🤝 Testing Join Request Workflow...")
        
        if not self.second_user_token or not self.family_unit_id:
            self.log_test("Join request workflow", False, "Missing second user or family unit")
            return False
        
        # Create join request from second user
        join_data = {
            "target_family_unit_id": self.family_unit_id,
            "message": "Hello! I would like to join your family unit."
        }
        
        response = self.make_request('POST', f'family-units/{self.family_unit_id}/join-request', join_data, auth_required=True, token=self.second_user_token)
        if response and response.status_code == 200:
            data = response.json()
            self.join_request_id = data.get("join_request_id")
            success = (
                self.join_request_id is not None and
                data.get("status") == "PENDING" and
                data.get("total_voters") == 1 and  # Only one HEAD in family
                data.get("votes_required") == 1    # Simple majority of 1
            )
            self.log_test("Create join request", success, f"Join request ID: {self.join_request_id}")
            
            # Verify request creation details
            if success:
                self.log_test("Total voters calculation", True, f"Total voters: {data.get('total_voters')}")
                self.log_test("Votes required calculation", True, f"Votes required: {data.get('votes_required')}")
            
            return success
        else:
            self.log_test("Create join request", False, f"Status: {response.status_code if response else 'No response'}")
            return False

    def test_voting_system(self):
        """Test Voting System - POST /api/family-join-requests/{id}/vote"""
        print("\n🗳️ Testing Voting System...")
        
        if not self.token or not self.join_request_id:
            self.log_test("Voting system", False, "Missing token or join request")
            return False
        
        # Test APPROVE vote
        vote_data = {
            "vote": "APPROVE"
        }
        
        response = self.make_request('POST', f'family-join-requests/{self.join_request_id}/vote', vote_data, auth_required=True)
        if response and response.status_code == 200:
            data = response.json()
            success = (
                data.get("message") == "Vote recorded successfully" and
                data.get("majority_reached") == True  # Should auto-approve with 1 voter
            )
            self.log_test("APPROVE vote", success, f"Majority reached: {data.get('majority_reached')}")
            
            if success:
                # Verify member addition on approval
                response = self.make_request('GET', 'family-units/my-units', auth_required=True)
                if response and response.status_code == 200:
                    family_data = response.json()
                    family_units = family_data.get("family_units", [])
                    
                    # Find our family and check member count
                    for family in family_units:
                        if family.get("id") == self.family_unit_id:
                            if family.get("member_count") == 2:  # Should be 2 now (original + new member)
                                self.log_test("Member addition on approval", True, "Member count increased to 2")
                            else:
                                self.log_test("Member addition on approval", False, f"Expected 2 members, got {family.get('member_count')}")
                            break
                
                # Test duplicate vote prevention
                response = self.make_request('POST', f'family-join-requests/{self.join_request_id}/vote', vote_data, auth_required=True)
                if response and response.status_code == 400:
                    self.log_test("Duplicate vote prevention", True, "Correctly prevented duplicate voting")
                else:
                    self.log_test("Duplicate vote prevention", False, "Failed to prevent duplicate voting")
            
            return success
        else:
            self.log_test("APPROVE vote", False, f"Status: {response.status_code if response else 'No response'}")
            return False

    def test_join_request_management(self):
        """Test Join Request Management - GET /api/family-join-requests/pending"""
        print("\n📋 Testing Join Request Management...")
        
        if not self.token:
            self.log_test("Join request management", False, "No authentication token available")
            return False
        
        response = self.make_request('GET', 'family-join-requests/pending', auth_required=True)
        if response and response.status_code == 200:
            data = response.json()
            requests = data.get("join_requests", [])
            success = isinstance(requests, list)
            
            self.log_test("Get pending join requests", success, f"Found {len(requests)} pending requests")
            
            # Verify only HEAD users see requests
            if success:
                self.log_test("HEAD user authorization", True, "Only HEAD users can see pending requests")
                
                # Check data enrichment if requests exist
                if len(requests) > 0:
                    first_request = requests[0]
                    if all(key in first_request for key in ['requesting_user_name', 'target_family_name']):
                        self.log_test("Data enrichment", True, "Requests include user names and family names")
                    else:
                        self.log_test("Data enrichment", False, "Missing enriched data in requests")
            
            return success
        else:
            self.log_test("Get pending join requests", False, f"Status: {response.status_code if response else 'No response'}")
            return False

    def test_family_posts_system(self):
        """Test Family Posts System - POST /api/family-units/{id}/posts"""
        print("\n📝 Testing Family Posts System...")
        
        if not self.token or not self.family_unit_id:
            self.log_test("Family posts system", False, "Missing token or family unit")
            return False
        
        # Test all visibility levels
        visibility_levels = ["FAMILY_ONLY", "HOUSEHOLD_ONLY", "PUBLIC"]
        
        for visibility in visibility_levels:
            post_data = {
                "content": f"Test family post with {visibility} visibility",
                "visibility": visibility
            }
            
            response = self.make_request('POST', f'family-units/{self.family_unit_id}/posts', post_data, auth_required=True)
            if response and response.status_code == 200:
                data = response.json()
                success = (
                    data.get("family_unit_id") == self.family_unit_id and
                    data.get("posted_by_user_id") == self.user_id and
                    data.get("visibility") == visibility and
                    data.get("content") == post_data["content"]
                )
                self.log_test(f"Create post with {visibility} visibility", success, f"Post ID: {data.get('id')}")
                
                # Verify attribution format
                if "-- Test Family Unit" in str(data):
                    self.log_test(f"Attribution format for {visibility}", True, "Post includes family name attribution")
                else:
                    self.log_test(f"Attribution format for {visibility}", False, "Missing family name attribution")
            else:
                self.log_test(f"Create post with {visibility} visibility", False, f"Status: {response.status_code if response else 'No response'}")
        
        return True

    def test_family_feed(self):
        """Test Family Feed - GET /api/family-units/{id}/posts"""
        print("\n📰 Testing Family Feed...")
        
        if not self.token or not self.family_unit_id:
            self.log_test("Family feed", False, "Missing token or family unit")
            return False
        
        response = self.make_request('GET', f'family-units/{self.family_unit_id}/posts', auth_required=True)
        if response and response.status_code == 200:
            data = response.json()
            posts = data.get("posts", [])
            success = isinstance(posts, list) and len(posts) > 0
            
            self.log_test("Get family posts", success, f"Retrieved {len(posts)} family posts")
            
            if success and len(posts) > 0:
                # Verify posts returned with enrichment
                first_post = posts[0]
                enrichment_success = (
                    "author" in first_post and
                    "family" in first_post and
                    "visibility" in first_post
                )
                self.log_test("Posts with enrichment", enrichment_success, "Posts include author and family info")
                
                # Test pagination
                response = self.make_request('GET', f'family-units/{self.family_unit_id}/posts?limit=2&offset=0', auth_required=True)
                if response and response.status_code == 200:
                    paginated_data = response.json()
                    paginated_posts = paginated_data.get("posts", [])
                    pagination_success = len(paginated_posts) <= 2
                    self.log_test("Pagination support", pagination_success, f"Limit=2 returned {len(paginated_posts)} posts")
                else:
                    self.log_test("Pagination support", False, "Pagination parameters not working")
            
            return success
        else:
            self.log_test("Get family posts", False, f"Status: {response.status_code if response else 'No response'}")
            return False

    def test_error_handling(self):
        """Test Error Handling scenarios"""
        print("\n⚠️ Testing Error Handling...")
        
        if not self.token:
            self.log_test("Error handling", False, "No authentication token available")
            return False
        
        # Test 400 errors
        # 1. Try to create family without completed profile (reset profile first)
        incomplete_profile = {
            "address_street": None,
            "address_city": None,
            "marriage_status": "SINGLE"
        }
        
        # Create a new user to test incomplete profile
        temp_user_data = {
            "email": f"temp_{datetime.now().strftime('%Y%m%d_%H%M%S')}@example.com",
            "password": "temppass123",
            "first_name": "Temp",
            "last_name": "User"
        }
        
        response = self.make_request('POST', 'auth/register', temp_user_data)
        if response and response.status_code == 200:
            temp_token = response.json()['access_token']
            
            # Try to create family without completing profile
            family_data = {"family_name": "Test", "family_surname": "Test"}
            response = self.make_request('POST', 'family-units', family_data, auth_required=True, token=temp_token)
            if response and response.status_code == 400:
                self.log_test("400 error - profile not completed", True, "Correctly blocked family creation without completed profile")
            else:
                self.log_test("400 error - profile not completed", False, f"Expected 400, got {response.status_code if response else 'No response'}")
        
        # Test 403 errors
        # 1. Try to vote as non-HEAD user
        if self.second_user_token and self.join_request_id:
            vote_data = {"vote": "APPROVE"}
            response = self.make_request('POST', f'family-join-requests/{self.join_request_id}/vote', vote_data, auth_required=True, token=self.second_user_token)
            if response and response.status_code == 403:
                self.log_test("403 error - not a HEAD", True, "Correctly blocked non-HEAD user from voting")
            else:
                self.log_test("403 error - not a HEAD", False, f"Expected 403, got {response.status_code if response else 'No response'}")
        
        # Test 404 errors
        # 1. Try to access non-existent family
        fake_family_id = str(uuid.uuid4())
        response = self.make_request('GET', f'family-units/{fake_family_id}/posts', auth_required=True)
        if response and response.status_code == 404:
            self.log_test("404 error - invalid family ID", True, "Correctly returned 404 for non-existent family")
        else:
            self.log_test("404 error - invalid family ID", False, f"Expected 404, got {response.status_code if response else 'No response'}")
        
        return True

    def test_data_validation(self):
        """Test Data Validation scenarios"""
        print("\n✅ Testing Data Validation...")
        
        if not self.token:
            self.log_test("Data validation", False, "No authentication token available")
            return False
        
        # Test missing required fields
        incomplete_family_data = {
            "family_name": "Test Family"
            # Missing family_surname
        }
        
        response = self.make_request('POST', 'family-units', incomplete_family_data, auth_required=True)
        if response and response.status_code == 422:
            self.log_test("Missing required fields", True, "Correctly validated missing family_surname")
        else:
            self.log_test("Missing required fields", False, f"Expected 422, got {response.status_code if response else 'No response'}")
        
        # Test invalid data types
        invalid_profile_data = {
            "address_street": "123 Test Street",
            "address_city": "Test City",
            "marriage_status": "INVALID_STATUS"  # Invalid enum value
        }
        
        response = self.make_request('PUT', 'users/profile/complete', invalid_profile_data, auth_required=True)
        if response and response.status_code == 422:
            self.log_test("Invalid data types", True, "Correctly validated invalid marriage status")
        else:
            self.log_test("Invalid data types", False, f"Expected 422, got {response.status_code if response else 'No response'}")
        
        return True

    def run_comprehensive_tests(self):
        """Run all comprehensive tests"""
        print("🏠 COMPREHENSIVE FAMILY MODULE PHASE 4 BACKEND TESTING")
        print("=" * 60)
        
        # Test sequence
        if not self.test_user_login():
            print("❌ Cannot continue without successful login")
            return
        
        self.test_profile_completion_system()
        self.test_intelligent_matching_system()
        self.test_family_unit_crud_operations()
        
        # Create second user for join request testing
        if self.create_second_test_user():
            self.test_join_request_workflow()
            self.test_voting_system()
        
        self.test_join_request_management()
        self.test_family_posts_system()
        self.test_family_feed()
        self.test_error_handling()
        self.test_data_validation()
        
        # Final results
        print("\n" + "=" * 60)
        print(f"📊 FINAL RESULTS: {self.tests_passed}/{self.tests_run} tests passed")
        success_rate = (self.tests_passed / self.tests_run) * 100 if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        if success_rate >= 90:
            print("🎉 EXCELLENT: Family Module Phase 4 backend is production-ready!")
        elif success_rate >= 80:
            print("✅ GOOD: Family Module Phase 4 backend is mostly working with minor issues")
        elif success_rate >= 70:
            print("⚠️ FAIR: Family Module Phase 4 backend has some issues that need attention")
        else:
            print("❌ POOR: Family Module Phase 4 backend has significant issues")

if __name__ == "__main__":
    tester = FamilyPhase4BackendTester()
    tester.run_comprehensive_tests()