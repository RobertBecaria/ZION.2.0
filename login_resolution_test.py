#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class LoginResolutionTester:
    def __init__(self, base_url="https://famiconnect.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        
        # Target user credentials
        self.target_email = "30new18@gmail.com"
        self.reported_password = "X15resto1"  # Password user reported
        self.actual_password = "password123"   # Actual password in database

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
            
            print(f"   Request: {method} {url} -> Status: {response.status_code}")
            
            if response.status_code in [400, 401, 422]:
                try:
                    error_data = response.json()
                    print(f"   Response: {error_data}")
                except:
                    print(f"   Response: {response.text}")
            
            return response
        except requests.exceptions.RequestException as e:
            print(f"❌ Network error for {method} {url}: {str(e)}")
            return None

    def test_login_with_reported_password(self):
        """Test login with the password user reported"""
        print(f"\n🔍 Testing login with reported password: {self.reported_password}")
        
        login_data = {
            "email": self.target_email,
            "password": self.reported_password
        }
        
        response = self.make_request('POST', 'auth/login', login_data)
        
        if response and response.status_code == 200:
            data = response.json()
            if 'access_token' in data and 'user' in data:
                self.token = data['access_token']
                self.log_test(f"Login with reported password ({self.reported_password})", True, "Login successful")
                return True
            else:
                self.log_test(f"Login with reported password ({self.reported_password})", False, "Missing token or user data")
        else:
            error_msg = ""
            if response:
                try:
                    error_data = response.json()
                    error_msg = error_data.get('detail', f'Status: {response.status_code}')
                except:
                    error_msg = f'Status: {response.status_code}'
            else:
                error_msg = "No response from server"
            
            self.log_test(f"Login with reported password ({self.reported_password})", False, error_msg)
        
        return False

    def test_login_with_actual_password(self):
        """Test login with the actual password in database"""
        print(f"\n🔍 Testing login with actual password: {self.actual_password}")
        
        login_data = {
            "email": self.target_email,
            "password": self.actual_password
        }
        
        response = self.make_request('POST', 'auth/login', login_data)
        
        if response and response.status_code == 200:
            data = response.json()
            if 'access_token' in data and 'user' in data:
                self.token = data['access_token']
                user_info = data['user']
                self.log_test(f"Login with actual password ({self.actual_password})", True, 
                            f"Login successful - User: {user_info.get('first_name')} {user_info.get('last_name')}")
                return True, data
            else:
                self.log_test(f"Login with actual password ({self.actual_password})", False, "Missing token or user data")
        else:
            error_msg = ""
            if response:
                try:
                    error_data = response.json()
                    error_msg = error_data.get('detail', f'Status: {response.status_code}')
                except:
                    error_msg = f'Status: {response.status_code}'
            else:
                error_msg = "No response from server"
            
            self.log_test(f"Login with actual password ({self.actual_password})", False, error_msg)
        
        return False, None

    def test_user_profile_access(self):
        """Test accessing user profile after successful login"""
        print(f"\n🔍 Testing user profile access...")
        
        if not self.token:
            self.log_test("User profile access", False, "No authentication token available")
            return False
        
        response = self.make_request('GET', 'auth/me', auth_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            success = (
                data.get('email') == self.target_email and
                'first_name' in data and
                'last_name' in data
            )
            if success:
                self.log_test("User profile access", True, 
                            f"Profile accessed - {data.get('first_name')} {data.get('last_name')} ({data.get('email')})")
                return True
            else:
                self.log_test("User profile access", False, "Invalid profile data")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("User profile access", False, error_msg)
        
        return False

    def test_api_functionality_with_user(self):
        """Test some API functionality to ensure user can perform actions"""
        print(f"\n🔍 Testing API functionality with authenticated user...")
        
        if not self.token:
            self.log_test("API functionality test", False, "No authentication token available")
            return False
        
        # Test getting posts
        response = self.make_request('GET', 'posts?module=family', auth_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            posts = data if isinstance(data, list) else []
            self.log_test("Get family posts", True, f"Retrieved {len(posts)} family posts")
            
            # Test getting chat groups
            response = self.make_request('GET', 'chat-groups', auth_required=True)
            
            if response and response.status_code == 200:
                data = response.json()
                groups = data.get('chat_groups', [])
                self.log_test("Get chat groups", True, f"Retrieved {len(groups)} chat groups")
                return True
            else:
                self.log_test("Get chat groups", False, f"Status: {response.status_code if response else 'No response'}")
        else:
            self.log_test("Get family posts", False, f"Status: {response.status_code if response else 'No response'}")
        
        return False

    def run_resolution_test(self):
        """Run complete login resolution test"""
        print("🔧 LOGIN ISSUE RESOLUTION TEST")
        print(f"📧 Target User: {self.target_email}")
        print(f"🔑 Reported Password: {self.reported_password}")
        print(f"🔑 Actual Password: {self.actual_password}")
        print(f"📡 API Endpoint: {self.base_url}")
        print("=" * 80)
        
        # Step 1: Test with reported password (should fail)
        print("\n❌ STEP 1: TEST WITH REPORTED PASSWORD (EXPECTED TO FAIL)")
        print("=" * 60)
        reported_success = self.test_login_with_reported_password()
        
        # Step 2: Test with actual password (should succeed)
        print("\n✅ STEP 2: TEST WITH ACTUAL PASSWORD (EXPECTED TO SUCCEED)")
        print("=" * 60)
        actual_success, login_data = self.test_login_with_actual_password()
        
        # Step 3: Test user profile access
        if actual_success:
            print("\n👤 STEP 3: TEST USER PROFILE ACCESS")
            print("=" * 60)
            profile_success = self.test_user_profile_access()
            
            # Step 4: Test API functionality
            print("\n🔧 STEP 4: TEST API FUNCTIONALITY")
            print("=" * 60)
            api_success = self.test_api_functionality_with_user()
        
        # Summary
        print("\n📊 RESOLUTION TEST SUMMARY")
        print("=" * 60)
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        print("\n🔍 FINDINGS:")
        print(f"❌ Reported password '{self.reported_password}': {'WORKS' if reported_success else 'DOES NOT WORK'}")
        print(f"✅ Actual password '{self.actual_password}': {'WORKS' if actual_success else 'DOES NOT WORK'}")
        
        if actual_success:
            print(f"✅ User can successfully log in and access the system")
            print(f"✅ Authentication system is working correctly")
        
        print("\n💡 RESOLUTION:")
        if not reported_success and actual_success:
            print(f"🎯 ISSUE IDENTIFIED: Password mismatch!")
            print(f"   - User is trying to log in with: '{self.reported_password}'")
            print(f"   - Correct password in database is: '{self.actual_password}'")
            print(f"   - User needs to use the correct password: '{self.actual_password}'")
            print(f"   - OR user needs to reset their password if they forgot it")
        elif reported_success:
            print(f"✅ No issue found - both passwords work")
        else:
            print(f"❌ Both passwords failed - deeper investigation needed")
        
        return actual_success

if __name__ == "__main__":
    tester = LoginResolutionTester()
    success = tester.run_resolution_test()
    
    if success:
        print(f"\n🎉 LOGIN ISSUE RESOLVED!")
        print(f"   User '{tester.target_email}' can log in with password '{tester.actual_password}'")
    else:
        print(f"\n⚠️  LOGIN ISSUE NOT RESOLVED - Further investigation needed")