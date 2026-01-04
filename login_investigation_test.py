#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
import pymongo
from pymongo import MongoClient
import os
from dotenv import load_dotenv

class LoginInvestigationTester:
    def __init__(self, base_url="https://context-aware-ai-4.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        
        # Load environment variables
        load_dotenv('/app/backend/.env')
        
        # MongoDB connection
        self.mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
        self.db_name = os.environ.get('DB_NAME', 'zion_city')
        
        # Target user credentials from review request
        self.target_email = "30new18@gmail.com"
        self.target_password = "X15resto1"
        
        # Known working test user
        self.test_email = "test@example.com"
        self.test_password = "password123"

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
                    print(f"   Error Details: {error_data}")
                except:
                    print(f"   Error Text: {response.text}")
            
            return response
        except requests.exceptions.RequestException as e:
            print(f"❌ Network error for {method} {url}: {str(e)}")
            return None

    def connect_to_mongodb(self):
        """Connect to MongoDB and return database connection"""
        try:
            client = MongoClient(self.mongo_url)
            db = client[self.db_name]
            # Test connection
            db.command('ping')
            print(f"✅ Connected to MongoDB: {self.mongo_url}/{self.db_name}")
            return db
        except Exception as e:
            print(f"❌ Failed to connect to MongoDB: {str(e)}")
            return None

    def search_user_in_database(self, email):
        """Search for user in MongoDB database"""
        print(f"\n🔍 Searching for user '{email}' in database...")
        
        db = self.connect_to_mongodb()
        if db is None:
            self.log_test("Database connection", False, "Could not connect to MongoDB")
            return None
        
        try:
            # Search for user by email
            user = db.users.find_one({"email": email})
            
            if user:
                # Remove sensitive data for logging
                user_info = {
                    "id": user.get("id"),
                    "email": user.get("email"),
                    "first_name": user.get("first_name"),
                    "last_name": user.get("last_name"),
                    "is_active": user.get("is_active"),
                    "is_verified": user.get("is_verified"),
                    "created_at": user.get("created_at"),
                    "last_login": user.get("last_login"),
                    "has_password_hash": bool(user.get("password_hash"))
                }
                
                self.log_test(f"User '{email}' exists in database", True, f"User info: {json.dumps(user_info, indent=2, default=str)}")
                return user
            else:
                self.log_test(f"User '{email}' exists in database", False, "User not found in database")
                return None
                
        except Exception as e:
            self.log_test(f"Database search for '{email}'", False, f"Database error: {str(e)}")
            return None

    def test_target_user_login(self):
        """Test login with the target user credentials"""
        print(f"\n🔍 Testing login for target user: {self.target_email}")
        
        login_data = {
            "email": self.target_email,
            "password": self.target_password
        }
        
        response = self.make_request('POST', 'auth/login', login_data)
        
        if response and response.status_code == 200:
            data = response.json()
            if 'access_token' in data and 'user' in data:
                self.token = data['access_token']
                success = data['user']['email'] == self.target_email
                self.log_test(f"Target user login ({self.target_email})", success, f"Login successful, token received")
                return True
            else:
                self.log_test(f"Target user login ({self.target_email})", False, "Missing token or user data in response")
        else:
            error_msg = ""
            if response:
                try:
                    error_data = response.json()
                    error_msg = error_data.get('detail', f'Status: {response.status_code}')
                except:
                    error_msg = f'Status: {response.status_code}, Response: {response.text}'
            else:
                error_msg = "No response from server"
            
            self.log_test(f"Target user login ({self.target_email})", False, error_msg)
        
        return False

    def test_known_working_user_login(self):
        """Test login with known working user credentials"""
        print(f"\n🔍 Testing login with known working user: {self.test_email}")
        
        login_data = {
            "email": self.test_email,
            "password": self.test_password
        }
        
        response = self.make_request('POST', 'auth/login', login_data)
        
        if response and response.status_code == 200:
            data = response.json()
            if 'access_token' in data and 'user' in data:
                success = data['user']['email'] == self.test_email
                self.log_test(f"Known working user login ({self.test_email})", success, f"Login successful - authentication system is working")
                return True
            else:
                self.log_test(f"Known working user login ({self.test_email})", False, "Missing token or user data in response")
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
            
            self.log_test(f"Known working user login ({self.test_email})", False, error_msg)
        
        return False

    def verify_password_hash(self, user_data, password):
        """Verify password hash using the same method as the backend"""
        try:
            from passlib.context import CryptContext
            pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
            
            stored_hash = user_data.get("password_hash")
            if not stored_hash:
                return False, "No password hash found"
            
            is_valid = pwd_context.verify(password, stored_hash)
            return is_valid, f"Password verification: {'VALID' if is_valid else 'INVALID'}"
            
        except Exception as e:
            return False, f"Password verification error: {str(e)}"

    def check_backend_logs(self):
        """Check backend logs for authentication errors"""
        print(f"\n🔍 Checking backend logs for authentication errors...")
        
        try:
            import subprocess
            
            # Check supervisor backend logs
            result = subprocess.run(
                ['tail', '-n', '50', '/var/log/supervisor/backend.err.log'],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0:
                log_content = result.stdout
                if log_content.strip():
                    print("   Recent backend error logs:")
                    print("   " + "\n   ".join(log_content.strip().split('\n')[-10:]))  # Last 10 lines
                    
                    # Look for authentication-related errors
                    auth_errors = []
                    for line in log_content.split('\n'):
                        if any(keyword in line.lower() for keyword in ['auth', 'login', 'password', 'credential', 'token']):
                            auth_errors.append(line)
                    
                    if auth_errors:
                        self.log_test("Authentication errors in logs", True, f"Found {len(auth_errors)} auth-related log entries")
                        for error in auth_errors[-5:]:  # Show last 5
                            print(f"   AUTH LOG: {error}")
                    else:
                        self.log_test("Authentication errors in logs", True, "No specific authentication errors found in recent logs")
                else:
                    self.log_test("Backend error logs", True, "No recent error logs found")
            else:
                self.log_test("Backend error logs", False, f"Could not read logs: {result.stderr}")
                
        except Exception as e:
            self.log_test("Backend error logs", False, f"Error checking logs: {str(e)}")

    def test_authentication_endpoint_directly(self):
        """Test the authentication endpoint with various scenarios"""
        print(f"\n🔍 Testing authentication endpoint directly...")
        
        # Test 1: Valid format but wrong credentials
        test_cases = [
            {
                "name": "Target user credentials",
                "email": self.target_email,
                "password": self.target_password,
                "expected_success": None  # We'll determine this based on database check
            },
            {
                "name": "Invalid email format",
                "email": "invalid-email",
                "password": "somepassword",
                "expected_success": False
            },
            {
                "name": "Empty password",
                "email": self.target_email,
                "password": "",
                "expected_success": False
            },
            {
                "name": "Non-existent user",
                "email": "nonexistent@example.com",
                "password": "somepassword",
                "expected_success": False
            }
        ]
        
        for test_case in test_cases:
            login_data = {
                "email": test_case["email"],
                "password": test_case["password"]
            }
            
            response = self.make_request('POST', 'auth/login', login_data)
            
            if test_case["name"] == "Target user credentials":
                # For target user, we'll analyze the response regardless of expected outcome
                if response and response.status_code == 200:
                    self.log_test(f"Direct auth test: {test_case['name']}", True, "Authentication successful")
                elif response and response.status_code == 401:
                    self.log_test(f"Direct auth test: {test_case['name']}", False, "Authentication failed - incorrect credentials")
                else:
                    status = response.status_code if response else "No response"
                    self.log_test(f"Direct auth test: {test_case['name']}", False, f"Unexpected response: {status}")
            else:
                # For other test cases, check if they behave as expected
                success = False
                if test_case["expected_success"] == False:
                    success = response and response.status_code in [400, 401, 422]
                elif test_case["expected_success"] == True:
                    success = response and response.status_code == 200
                
                self.log_test(f"Direct auth test: {test_case['name']}", success, f"Status: {response.status_code if response else 'No response'}")

    def run_investigation(self):
        """Run complete login investigation"""
        print("🔍 STARTING LOGIN INVESTIGATION")
        print(f"📧 Target User: {self.target_email}")
        print(f"🔑 Target Password: {self.target_password}")
        print(f"📡 API Endpoint: {self.base_url}")
        print("=" * 80)
        
        # Step 1: Check if user exists in database
        print("\n📋 STEP 1: DATABASE INVESTIGATION")
        print("=" * 50)
        target_user = self.search_user_in_database(self.target_email)
        
        # Also check if known working user exists
        working_user = self.search_user_in_database(self.test_email)
        
        # Step 2: Test authentication endpoint directly
        print("\n🔐 STEP 2: AUTHENTICATION ENDPOINT TESTING")
        print("=" * 50)
        self.test_authentication_endpoint_directly()
        
        # Step 3: Test target user login
        print("\n🎯 STEP 3: TARGET USER LOGIN TEST")
        print("=" * 50)
        target_login_success = self.test_target_user_login()
        
        # Step 4: Test known working user login (to verify system works)
        print("\n✅ STEP 4: KNOWN WORKING USER LOGIN TEST")
        print("=" * 50)
        working_login_success = self.test_known_working_user_login()
        
        # Step 5: Password hash verification (if user exists)
        if target_user:
            print("\n🔒 STEP 5: PASSWORD HASH VERIFICATION")
            print("=" * 50)
            is_valid, message = self.verify_password_hash(target_user, self.target_password)
            self.log_test("Password hash verification", is_valid, message)
        
        # Step 6: Check backend logs
        print("\n📝 STEP 6: BACKEND LOG ANALYSIS")
        print("=" * 50)
        self.check_backend_logs()
        
        # Summary
        print("\n📊 INVESTIGATION SUMMARY")
        print("=" * 50)
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        print("\n🔍 FINDINGS:")
        if target_user:
            print(f"✅ User '{self.target_email}' EXISTS in database")
            if target_login_success:
                print(f"✅ Login SUCCESSFUL for '{self.target_email}'")
            else:
                print(f"❌ Login FAILED for '{self.target_email}'")
        else:
            print(f"❌ User '{self.target_email}' NOT FOUND in database")
        
        if working_login_success:
            print(f"✅ Authentication system is WORKING (verified with {self.test_email})")
        else:
            print(f"❌ Authentication system may have issues (test user {self.test_email} failed)")
        
        print("\n💡 RECOMMENDATIONS:")
        if not target_user:
            print("- User needs to register first")
        elif target_user and not target_login_success:
            print("- Check password correctness")
            print("- Verify user account is active")
            print("- Check for any account lockouts or restrictions")
        elif not working_login_success:
            print("- Check authentication system configuration")
            print("- Verify database connectivity")
            print("- Check JWT token generation")

if __name__ == "__main__":
    tester = LoginInvestigationTester()
    tester.run_investigation()