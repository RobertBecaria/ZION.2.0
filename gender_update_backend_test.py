#!/usr/bin/env python3
"""
Gender Update API Backend Test
Tests the gender update functionality as requested in the review.

Test Scenarios:
1. Register a new user via POST /api/auth/register
2. Update the gender via PUT /api/users/gender with Authorization Bearer token
3. Verify the response contains {"message": "Gender updated successfully", "gender": "MALE"}
4. Try to update gender without token - should return 403
5. Test all gender options: MALE, FEMALE, IT
"""

import requests
import json
import uuid
from datetime import datetime
import sys

# Backend URL from environment
BACKEND_URL = "https://dbfix-social.preview.emergentagent.com/api"

class GenderUpdateTester:
    def __init__(self):
        self.backend_url = BACKEND_URL
        self.test_results = []
        self.access_token = None
        self.test_user_email = f"gendertest_{uuid.uuid4().hex[:8]}@test.com"
        
    def log_result(self, test_name, success, message, details=None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details or {}
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if details and not success:
            print(f"   Details: {details}")
    
    def test_user_registration(self):
        """Test 1: Register a new user via POST /api/auth/register"""
        print("\n=== Test 1: User Registration ===")
        
        registration_data = {
            "email": self.test_user_email,
            "password": "testpassword123",
            "first_name": "Gender",
            "last_name": "Tester",
            "middle_name": "Update",
            "phone": "+1234567890",
            "date_of_birth": "1990-01-01T00:00:00Z",
            "gender": "MALE"
        }
        
        try:
            response = requests.post(
                f"{self.backend_url}/auth/register",
                json=registration_data,
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                self.access_token = data.get("access_token")
                
                if self.access_token:
                    self.log_result(
                        "User Registration",
                        True,
                        f"User registered successfully with email: {self.test_user_email}",
                        {"token_received": True, "user_data": data.get("user", {})}
                    )
                    return True
                else:
                    self.log_result(
                        "User Registration",
                        False,
                        "Registration successful but no access token received",
                        {"response": data}
                    )
                    return False
            else:
                self.log_result(
                    "User Registration",
                    False,
                    f"Registration failed with status {response.status_code}",
                    {"response": response.text}
                )
                return False
                
        except Exception as e:
            self.log_result(
                "User Registration",
                False,
                f"Registration request failed: {str(e)}",
                {"error": str(e)}
            )
            return False
    
    def test_gender_update_with_token(self, gender_value):
        """Test gender update with valid token"""
        print(f"\n=== Test: Gender Update to {gender_value} ===")
        
        if not self.access_token:
            self.log_result(
                f"Gender Update ({gender_value})",
                False,
                "No access token available for testing",
                {}
            )
            return False
        
        gender_data = {
            "gender": gender_value
        }
        
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }
        
        try:
            response = requests.put(
                f"{self.backend_url}/users/gender",
                json=gender_data,
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                expected_message = "Gender updated successfully"
                
                # Verify response structure
                if (data.get("message") == expected_message and 
                    data.get("gender") == gender_value):
                    self.log_result(
                        f"Gender Update ({gender_value})",
                        True,
                        f"Gender successfully updated to {gender_value}",
                        {"response": data}
                    )
                    return True
                else:
                    self.log_result(
                        f"Gender Update ({gender_value})",
                        False,
                        "Response format incorrect",
                        {
                            "expected": {"message": expected_message, "gender": gender_value},
                            "actual": data
                        }
                    )
                    return False
            else:
                self.log_result(
                    f"Gender Update ({gender_value})",
                    False,
                    f"Update failed with status {response.status_code}",
                    {"response": response.text}
                )
                return False
                
        except Exception as e:
            self.log_result(
                f"Gender Update ({gender_value})",
                False,
                f"Update request failed: {str(e)}",
                {"error": str(e)}
            )
            return False
    
    def test_gender_update_without_token(self):
        """Test 4: Try to update gender without token - should return 403"""
        print("\n=== Test 4: Gender Update Without Token ===")
        
        gender_data = {
            "gender": "FEMALE"
        }
        
        headers = {
            "Content-Type": "application/json"
            # Intentionally no Authorization header
        }
        
        try:
            response = requests.put(
                f"{self.backend_url}/users/gender",
                json=gender_data,
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 403:
                self.log_result(
                    "Gender Update (No Token)",
                    True,
                    "Correctly rejected request without token (403 Forbidden)",
                    {"status_code": response.status_code}
                )
                return True
            elif response.status_code == 401:
                self.log_result(
                    "Gender Update (No Token)",
                    True,
                    "Correctly rejected request without token (401 Unauthorized)",
                    {"status_code": response.status_code}
                )
                return True
            else:
                self.log_result(
                    "Gender Update (No Token)",
                    False,
                    f"Expected 403/401 but got {response.status_code}",
                    {"response": response.text}
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Gender Update (No Token)",
                False,
                f"Request failed: {str(e)}",
                {"error": str(e)}
            )
            return False
    
    def test_all_gender_options(self):
        """Test 5: Test all gender options: MALE, FEMALE, IT"""
        print("\n=== Test 5: All Gender Options ===")
        
        gender_options = ["MALE", "FEMALE", "IT"]
        all_passed = True
        
        for gender in gender_options:
            success = self.test_gender_update_with_token(gender)
            if not success:
                all_passed = False
        
        return all_passed
    
    def run_all_tests(self):
        """Run all gender update tests"""
        print("🧪 Starting Gender Update API Backend Tests")
        print(f"Backend URL: {self.backend_url}")
        print(f"Test User Email: {self.test_user_email}")
        print("=" * 60)
        
        # Test 1: Register user
        registration_success = self.test_user_registration()
        
        if not registration_success:
            print("\n❌ Cannot proceed with gender tests - registration failed")
            return self.generate_summary()
        
        # Test 2 & 3: Update gender with token (MALE first)
        self.test_gender_update_with_token("MALE")
        
        # Test 4: Update without token
        self.test_gender_update_without_token()
        
        # Test 5: Test all gender options
        self.test_all_gender_options()
        
        return self.generate_summary()
    
    def generate_summary(self):
        """Generate test summary"""
        print("\n" + "=" * 60)
        print("📊 GENDER UPDATE API TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%" if total_tests > 0 else "0%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['message']}")
        
        print("\n✅ PASSED TESTS:")
        for result in self.test_results:
            if result["success"]:
                print(f"  - {result['test']}: {result['message']}")
        
        # Specific verification for the review requirements
        print("\n🎯 REVIEW REQUIREMENTS VERIFICATION:")
        
        # Check if we have the specific response format
        gender_update_tests = [r for r in self.test_results if "Gender Update (MALE)" in r["test"]]
        if gender_update_tests and gender_update_tests[0]["success"]:
            print("✅ Response contains correct format: {'message': 'Gender updated successfully', 'gender': 'MALE'}")
        else:
            print("❌ Response format verification failed")
        
        # Check unauthorized access
        no_token_tests = [r for r in self.test_results if "No Token" in r["test"]]
        if no_token_tests and no_token_tests[0]["success"]:
            print("✅ Correctly rejects requests without token (403/401)")
        else:
            print("❌ Authorization check failed")
        
        # Check all gender options
        gender_tests = [r for r in self.test_results if any(g in r["test"] for g in ["MALE", "FEMALE", "IT"]) and "Update" in r["test"]]
        successful_genders = [r["test"] for r in gender_tests if r["success"]]
        print(f"✅ Gender options tested: {len(successful_genders)} of 3 (MALE, FEMALE, IT)")
        
        return {
            "total_tests": total_tests,
            "passed": passed_tests,
            "failed": failed_tests,
            "success_rate": (passed_tests/total_tests*100) if total_tests > 0 else 0,
            "all_tests_passed": failed_tests == 0,
            "test_results": self.test_results
        }

def main():
    """Main test execution"""
    tester = GenderUpdateTester()
    summary = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if summary["all_tests_passed"] else 1)

if __name__ == "__main__":
    main()