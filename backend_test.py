#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
import uuid

class ZionCityAPITester:
    def __init__(self, base_url="https://profile-hub-34.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_user_email = f"test_user_{datetime.now().strftime('%Y%m%d_%H%M%S')}@zioncity.test"
        self.test_user_data = {
            "email": self.test_user_email,
            "password": "testpass123",
            "first_name": "Тест",
            "last_name": "Пользователь", 
            "middle_name": "Тестович",
            "phone": "+38067123456"
        }

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
        headers = {'Content-Type': 'application/json'}
        
        if auth_required and self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
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
            return response
        except requests.exceptions.RequestException as e:
            print(f"❌ Network error for {method} {url}: {str(e)}")
            return None

    def test_health_check(self):
        """Test basic health endpoints"""
        print("\n🔍 Testing Health Endpoints...")
        
        # Test root endpoint
        response = self.make_request('GET', '')
        if response and response.status_code == 200:
            data = response.json()
            success = "ZION.CITY API" in data.get("message", "")
            self.log_test("Root endpoint", success, f"Status: {response.status_code}, Message: {data.get('message')}")
        else:
            self.log_test("Root endpoint", False, f"Status: {response.status_code if response else 'No response'}")
        
        # Test health endpoint
        response = self.make_request('GET', 'health')
        if response and response.status_code == 200:
            data = response.json()
            success = data.get("status") == "healthy"
            self.log_test("Health check", success, f"Status: {data.get('status')}")
        else:
            self.log_test("Health check", False, f"Status: {response.status_code if response else 'No response'}")

    def test_user_registration(self):
        """Test user registration"""
        print("\n🔍 Testing User Registration...")
        
        response = self.make_request('POST', 'auth/register', self.test_user_data)
        
        if response and response.status_code == 200:
            data = response.json()
            if 'access_token' in data and 'user' in data:
                self.token = data['access_token']
                self.user_id = data['user']['id']
                success = (
                    data['user']['email'] == self.test_user_email and
                    data['user']['first_name'] == self.test_user_data['first_name'] and
                    data['user']['last_name'] == self.test_user_data['last_name']
                )
                self.log_test("User registration", success, f"User ID: {self.user_id}")
                return success
            else:
                self.log_test("User registration", False, "Missing token or user data in response")
        else:
            error_msg = ""
            if response:
                try:
                    error_data = response.json()
                    error_msg = error_data.get('detail', f'Status: {response.status_code}')
                except:
                    error_msg = f'Status: {response.status_code}'
            else:
                error_msg = "No response"
            self.log_test("User registration", False, error_msg)
        
        return False

    def test_duplicate_registration(self):
        """Test duplicate email registration should fail"""
        print("\n🔍 Testing Duplicate Registration...")
        
        response = self.make_request('POST', 'auth/register', self.test_user_data)
        
        if response and response.status_code == 400:
            data = response.json()
            success = "already registered" in data.get('detail', '').lower()
            self.log_test("Duplicate registration prevention", success, f"Error: {data.get('detail')}")
        else:
            self.log_test("Duplicate registration prevention", False, f"Expected 400, got {response.status_code if response else 'No response'}")

    def test_user_login(self):
        """Test user login"""
        print("\n🔍 Testing User Login...")
        
        login_data = {
            "email": self.test_user_email,
            "password": self.test_user_data['password']
        }
        
        response = self.make_request('POST', 'auth/login', login_data)
        
        if response and response.status_code == 200:
            data = response.json()
            if 'access_token' in data and 'user' in data:
                # Update token (should be same but let's be safe)
                self.token = data['access_token']
                success = (
                    data['user']['email'] == self.test_user_email and
                    'affiliations' in data['user']
                )
                self.log_test("User login", success, f"Token received, affiliations: {len(data['user'].get('affiliations', []))}")
                return success
            else:
                self.log_test("User login", False, "Missing token or user data")
        else:
            error_msg = ""
            if response:
                try:
                    error_data = response.json()
                    error_msg = error_data.get('detail', f'Status: {response.status_code}')
                except:
                    error_msg = f'Status: {response.status_code}'
            self.log_test("User login", False, error_msg)
        
        return False

    def test_invalid_login(self):
        """Test login with invalid credentials"""
        print("\n🔍 Testing Invalid Login...")
        
        invalid_login = {
            "email": self.test_user_email,
            "password": "wrongpassword"
        }
        
        response = self.make_request('POST', 'auth/login', invalid_login)
        
        if response and response.status_code == 401:
            success = True
            self.log_test("Invalid login rejection", success, "Correctly rejected invalid credentials")
        else:
            self.log_test("Invalid login rejection", False, f"Expected 401, got {response.status_code if response else 'No response'}")

    def test_get_user_profile(self):
        """Test getting current user profile"""
        print("\n🔍 Testing Get User Profile...")
        
        if not self.token:
            self.log_test("Get user profile", False, "No authentication token available")
            return False
        
        response = self.make_request('GET', 'auth/me', auth_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            success = (
                data.get('email') == self.test_user_email and
                'affiliations' in data and
                'privacy_settings' in data
            )
            self.log_test("Get user profile", success, f"Profile retrieved, affiliations: {len(data.get('affiliations', []))}")
            return success
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("Get user profile", False, error_msg)
        
        return False

    def test_onboarding_flow(self):
        """Test complete onboarding with affiliations"""
        print("\n🔍 Testing Onboarding Flow...")
        
        if not self.token:
            self.log_test("Onboarding flow", False, "No authentication token available")
            return False
        
        onboarding_data = {
            "work_place": "ООО ТехноПром",
            "work_role": "Менеджер по проектам",
            "university": "Херсонский Государственный Университет", 
            "university_role": "Выпускник",
            "school": "Средняя школа №5",
            "school_role": "Родитель",
            "privacy_settings": {
                "work_visible_in_services": True,
                "school_visible_in_events": True,
                "location_sharing_enabled": False,
                "profile_visible_to_public": True,
                "family_visible_to_friends": True
            }
        }
        
        response = self.make_request('POST', 'onboarding', onboarding_data, auth_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            success = (
                data.get('message') == 'Onboarding completed successfully' and
                'affiliations_created' in data and
                len(data['affiliations_created']) == 3  # work, university, school
            )
            self.log_test("Onboarding completion", success, f"Affiliations created: {data.get('affiliations_created', [])}")
            return success
        else:
            error_msg = ""
            if response:
                try:
                    error_data = response.json()
                    error_msg = error_data.get('detail', f'Status: {response.status_code}')
                except:
                    error_msg = f'Status: {response.status_code}'
            self.log_test("Onboarding completion", False, error_msg)
        
        return False

    def test_get_user_affiliations(self):
        """Test getting user affiliations"""
        print("\n🔍 Testing Get User Affiliations...")
        
        if not self.token:
            self.log_test("Get user affiliations", False, "No authentication token available")
            return False
        
        response = self.make_request('GET', 'user-affiliations', auth_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            affiliations = data.get('affiliations', [])
            success = len(affiliations) >= 3  # Should have work, university, school
            
            # Check if affiliations have proper structure
            if success and affiliations:
                first_affiliation = affiliations[0]
                success = (
                    'affiliation' in first_affiliation and
                    'user_role_in_org' in first_affiliation and
                    'verification_level' in first_affiliation
                )
            
            self.log_test("Get user affiliations", success, f"Found {len(affiliations)} affiliations")
            
            # Print affiliation details for verification
            if affiliations:
                print("   Affiliations found:")
                for aff in affiliations:
                    org_name = aff.get('affiliation', {}).get('name', 'Unknown')
                    org_type = aff.get('affiliation', {}).get('type', 'Unknown')
                    role = aff.get('user_role_in_org', 'Unknown')
                    print(f"     - {org_name} ({org_type}) - {role}")
            
            return success
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("Get user affiliations", False, error_msg)
        
        return False

    def test_profile_after_onboarding(self):
        """Test that profile includes affiliations after onboarding"""
        print("\n🔍 Testing Profile After Onboarding...")
        
        if not self.token:
            self.log_test("Profile after onboarding", False, "No authentication token available")
            return False
        
        response = self.make_request('GET', 'auth/me', auth_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            affiliations = data.get('affiliations', [])
            success = len(affiliations) >= 3  # Should have work, university, school after onboarding
            
            self.log_test("Profile includes affiliations", success, f"Profile has {len(affiliations)} affiliations")
            return success
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("Profile includes affiliations", False, error_msg)
        
        return False

    def test_existing_user_login(self):
        """Test login with the pre-created test user"""
        print("\n🔍 Testing Existing Test User Login...")
        
        existing_user_data = {
            "email": "test@zioncity.example",
            "password": "testpass123"
        }
        
        response = self.make_request('POST', 'auth/login', existing_user_data)
        
        if response and response.status_code == 200:
            data = response.json()
            if 'access_token' in data and 'user' in data:
                affiliations = data['user'].get('affiliations', [])
                success = len(affiliations) >= 3  # Should have the 3 pre-created affiliations
                self.log_test("Existing test user login", success, f"User has {len(affiliations)} affiliations")
                
                if affiliations:
                    print("   Pre-created affiliations:")
                    for aff in affiliations:
                        org_name = aff.get('affiliation', {}).get('name', 'Unknown')
                        org_type = aff.get('affiliation', {}).get('type', 'Unknown')
                        role = aff.get('user_role_in_org', 'Unknown')
                        print(f"     - {org_name} ({org_type}) - {role}")
                
                return success
            else:
                self.log_test("Existing test user login", False, "Missing token or user data")
        else:
            # This is expected if the user doesn't exist yet
            self.log_test("Existing test user login", False, "Pre-created test user not found (this is expected)")
        
        return False

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting ZION.CITY API Tests...")
        print(f"📡 Testing against: {self.base_url}")
        print("=" * 60)
        
        # Basic connectivity tests
        self.test_health_check()
        
        # Authentication flow tests
        registration_success = self.test_user_registration()
        if registration_success:
            self.test_duplicate_registration()
            self.test_user_login()
            self.test_get_user_profile()
            
            # Onboarding and affiliations tests
            onboarding_success = self.test_onboarding_flow()
            if onboarding_success:
                self.test_get_user_affiliations()
                self.test_profile_after_onboarding()
        
        # Test invalid scenarios
        self.test_invalid_login()
        
        # Test existing user (if available)
        self.test_existing_user_login()
        
        # Print final results
        print("\n" + "=" * 60)
        print(f"📊 TEST RESULTS: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests PASSED! Backend API is working correctly.")
            return 0
        else:
            failed_tests = self.tests_run - self.tests_passed
            print(f"⚠️  {failed_tests} test(s) FAILED. Please check the issues above.")
            return 1

def main():
    tester = ZionCityAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())