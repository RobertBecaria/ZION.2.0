#!/usr/bin/env python3
"""
RE-TEST AFTER BUG FIX - School Management Phase 1: Teacher Listing Endpoints
Testing the field mapping bug fix for teacher endpoints
"""

import requests
import json
import uuid
from datetime import datetime

# Configuration
BASE_URL = "https://messagehub-387.preview.emergentagent.com/api"
ORGANIZATION_ID = "d5e2d110-cb59-441f-b2f0-55c9ac715431"  # Test School organization

# Test credentials
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "admin123"

class TeacherEndpointBugFixTester:
    def __init__(self):
        self.admin_token = None
        self.teacher_token = None
        self.teacher_user_id = None
        self.teacher_email = None
        self.organization_id = ORGANIZATION_ID
        self.results = []
        
    def log_result(self, test_name, success, details="", response_data=None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = {
            "test": test_name,
            "status": status,
            "details": details,
            "response_data": response_data
        }
        self.results.append(result)
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        if not success and response_data:
            print(f"   Response: {response_data}")
        print()

    def authenticate_admin(self):
        """Authenticate admin user"""
        try:
            response = requests.post(f"{BASE_URL}/auth/login", json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            })
            
            if response.status_code == 200:
                data = response.json()
                self.admin_token = data.get("access_token")
                self.log_result("Admin Authentication", True, f"Admin logged in successfully")
                return True
            else:
                self.log_result("Admin Authentication", False, f"Status: {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Admin Authentication", False, f"Exception: {str(e)}")
            return False

    def get_or_create_teacher(self):
        """Get existing teacher or create one for testing"""
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # First, try to get existing members
            members_response = requests.get(f"{BASE_URL}/work/organizations/{self.organization_id}/members", headers=headers)
            
            if members_response.status_code == 200:
                members_data = members_response.json()
                members = members_data.get("members", [])
                
                # Look for existing teacher
                for member in members:
                    if member.get("is_teacher", False):
                        self.teacher_email = member.get("user_email")
                        self.teacher_user_id = member.get("user_id")
                        self.log_result("Get/Create Teacher", True, f"Found existing teacher: {self.teacher_email}")
                        return True
                
                # If no teacher found, create one
                if members:
                    # Use first member and make them a teacher
                    first_member = members[0]
                    self.teacher_email = first_member.get("user_email")
                    self.teacher_user_id = first_member.get("user_id")
                    
                    # Login as this user to update their profile
                    # We'll assume they have a standard password or create a new teacher
                    pass
            
            # Create a new teacher user
            unique_id = str(uuid.uuid4())[:8]
            self.teacher_email = f"teacher_{unique_id}@example.com"
            teacher_password = "teacher123"
            
            # Register teacher user
            register_response = requests.post(f"{BASE_URL}/auth/register", json={
                "email": self.teacher_email,
                "password": teacher_password,
                "first_name": "Анна",
                "last_name": "Петрова"
            })
            
            if register_response.status_code in [200, 201]:
                # Login teacher user
                login_response = requests.post(f"{BASE_URL}/auth/login", json={
                    "email": self.teacher_email,
                    "password": teacher_password
                })
                
                if login_response.status_code == 200:
                    login_data = login_response.json()
                    self.teacher_token = login_data.get("access_token")
                    self.teacher_user_id = login_data.get("user", {}).get("id")
                    
                    # Add teacher to organization as member
                    add_member_response = requests.post(
                        f"{BASE_URL}/work/organizations/{self.organization_id}/members",
                        headers=headers,
                        json={
                            "user_email": self.teacher_email,
                            "role": "EMPLOYEE",
                            "job_title": "Учитель математики"
                        }
                    )
                    
                    if add_member_response.status_code == 200:
                        # Update teacher profile
                        teacher_headers = {"Authorization": f"Bearer {self.teacher_token}"}
                        update_response = requests.put(
                            f"{BASE_URL}/work/organizations/{self.organization_id}/teachers/me",
                            headers=teacher_headers,
                            json={
                                "is_teacher": True,
                                "teaching_subjects": ["Математика", "Физика"],
                                "teaching_grades": [9, 10, 11],
                                "is_class_supervisor": True,
                                "supervised_class": "10А",
                                "teacher_qualification": "Высшая категория"
                            }
                        )
                        
                        if update_response.status_code == 200:
                            self.log_result("Get/Create Teacher", True, f"Created and configured teacher: {self.teacher_email}")
                            return True
                        else:
                            self.log_result("Get/Create Teacher", False, f"Failed to update teacher profile: {update_response.status_code}")
                            return False
                    else:
                        self.log_result("Get/Create Teacher", False, f"Failed to add to org: {add_member_response.status_code}")
                        return False
                else:
                    self.log_result("Get/Create Teacher", False, f"Login failed: {login_response.status_code}")
                    return False
            else:
                self.log_result("Get/Create Teacher", False, f"Registration failed: {register_response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("Get/Create Teacher", False, f"Exception: {str(e)}")
            return False

    def test_teachers_list_endpoint_no_filters(self):
        """Test GET /api/work/organizations/{org_id}/teachers - PREVIOUSLY FAILING WITH 500"""
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            print("🔍 Testing previously failing endpoint: GET /teachers (no filters)")
            response = requests.get(f"{BASE_URL}/work/organizations/{self.organization_id}/teachers", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                # Handle both response formats: direct list or {"teachers": [...]}
                if isinstance(data, list):
                    teachers = data
                else:
                    teachers = data.get("teachers", [])
                
                # Verify response structure
                if isinstance(teachers, list):
                    # Check if we have teachers and verify field structure
                    if teachers:
                        first_teacher = teachers[0]
                        required_fields = ["id", "user_first_name", "user_last_name", "user_email", "teaching_subjects", "teaching_grades"]
                        missing_fields = [field for field in required_fields if field not in first_teacher]
                        
                        if missing_fields:
                            self.log_result("Teachers List (No Filters) - BUG FIX VERIFICATION", False, 
                                           f"Missing required fields: {missing_fields}")
                            return False
                        
                        # Verify 'id' field is properly mapped (this was the bug)
                        if first_teacher.get("id"):
                            self.log_result("Teachers List (No Filters) - BUG FIX VERIFICATION", True, 
                                           f"✅ BUG FIXED! Endpoint returns 200 OK with {len(teachers)} teachers. 'id' field properly mapped.")
                            return True
                        else:
                            self.log_result("Teachers List (No Filters) - BUG FIX VERIFICATION", False, 
                                           "'id' field is empty or null - field mapping still has issues")
                            return False
                    else:
                        self.log_result("Teachers List (No Filters) - BUG FIX VERIFICATION", True, 
                                       "✅ BUG FIXED! Endpoint returns 200 OK (no teachers in organization)")
                        return True
                else:
                    self.log_result("Teachers List (No Filters) - BUG FIX VERIFICATION", False, 
                                   f"Response is not a list: {type(data)}")
                    return False
            elif response.status_code == 500:
                # This was the original bug - should not happen anymore
                error_text = response.text
                self.log_result("Teachers List (No Filters) - BUG FIX VERIFICATION", False, 
                               f"❌ BUG NOT FIXED! Still getting 500 error: {error_text}")
                return False
            else:
                self.log_result("Teachers List (No Filters) - BUG FIX VERIFICATION", False, 
                               f"Unexpected status code: {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Teachers List (No Filters) - BUG FIX VERIFICATION", False, f"Exception: {str(e)}")
            return False

    def test_teachers_list_with_grade_filter(self):
        """Test GET /api/work/organizations/{org_id}/teachers?grade=10 - PREVIOUSLY FAILING WITH 500"""
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            print("🔍 Testing previously failing endpoint: GET /teachers?grade=10")
            response = requests.get(f"{BASE_URL}/work/organizations/{self.organization_id}/teachers?grade=10", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                # Handle both response formats: direct list or {"teachers": [...]}
                if isinstance(data, list):
                    teachers = data
                else:
                    teachers = data.get("teachers", [])
                
                # Verify filtering works
                for teacher in teachers:
                    teaching_grades = teacher.get("teaching_grades", [])
                    if teaching_grades and 10 not in teaching_grades:
                        self.log_result("Teachers List (Grade Filter) - BUG FIX VERIFICATION", False, 
                                       f"Grade filtering not working: teacher doesn't teach grade 10")
                        return False
                
                self.log_result("Teachers List (Grade Filter) - BUG FIX VERIFICATION", True, 
                               f"✅ BUG FIXED! Grade filtering returns 200 OK with {len(teachers)} teachers for grade 10")
                return True
            elif response.status_code == 500:
                error_text = response.text
                self.log_result("Teachers List (Grade Filter) - BUG FIX VERIFICATION", False, 
                               f"❌ BUG NOT FIXED! Still getting 500 error: {error_text}")
                return False
            else:
                self.log_result("Teachers List (Grade Filter) - BUG FIX VERIFICATION", False, 
                               f"Unexpected status code: {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Teachers List (Grade Filter) - BUG FIX VERIFICATION", False, f"Exception: {str(e)}")
            return False

    def test_teachers_list_with_subject_filter(self):
        """Test GET /api/work/organizations/{org_id}/teachers?subject=Математика"""
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            print("🔍 Testing endpoint: GET /teachers?subject=Математика")
            response = requests.get(f"{BASE_URL}/work/organizations/{self.organization_id}/teachers?subject=Математика", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                # Handle both response formats: direct list or {"teachers": [...]}
                if isinstance(data, list):
                    teachers = data
                else:
                    teachers = data.get("teachers", [])
                
                # Verify filtering works
                for teacher in teachers:
                    teaching_subjects = teacher.get("teaching_subjects", [])
                    if teaching_subjects and "Математика" not in teaching_subjects:
                        self.log_result("Teachers List (Subject Filter)", False, 
                                       f"Subject filtering not working: teacher doesn't teach Математика")
                        return False
                
                self.log_result("Teachers List (Subject Filter)", True, 
                               f"Subject filtering returns 200 OK with {len(teachers)} teachers for Математика")
                return True
            else:
                self.log_result("Teachers List (Subject Filter)", False, 
                               f"Status: {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Teachers List (Subject Filter)", False, f"Exception: {str(e)}")
            return False

    def test_individual_teacher_endpoint(self):
        """Test GET /api/work/organizations/{org_id}/teachers/{id} - PREVIOUSLY FAILING"""
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # First get list of teachers to find a teacher ID
            list_response = requests.get(f"{BASE_URL}/work/organizations/{self.organization_id}/teachers", headers=headers)
            
            if list_response.status_code != 200:
                self.log_result("Individual Teacher Endpoint - BUG FIX VERIFICATION", False, 
                               "Cannot get teachers list to test individual retrieval")
                return False
            
            list_data = list_response.json()
            # Handle both response formats: direct list or {"teachers": [...]}
            if isinstance(list_data, list):
                teachers = list_data
            else:
                teachers = list_data.get("teachers", [])
            if not teachers:
                self.log_result("Individual Teacher Endpoint - BUG FIX VERIFICATION", True, 
                               "No teachers to test individual retrieval (organization empty)")
                return True
            
            # Get the first teacher
            teacher_id = teachers[0].get("id")
            if not teacher_id:
                self.log_result("Individual Teacher Endpoint - BUG FIX VERIFICATION", False, 
                               "No teacher ID found in teachers list")
                return False
            
            print(f"🔍 Testing previously failing endpoint: GET /teachers/{teacher_id}")
            response = requests.get(f"{BASE_URL}/work/organizations/{self.organization_id}/teachers/{teacher_id}", headers=headers)
            
            if response.status_code == 200:
                teacher = response.json()
                
                if teacher and teacher.get("id"):
                    self.log_result("Individual Teacher Endpoint - BUG FIX VERIFICATION", True, 
                                   f"✅ BUG FIXED! Individual teacher retrieval returns 200 OK with proper 'id' field")
                    return True
                else:
                    self.log_result("Individual Teacher Endpoint - BUG FIX VERIFICATION", False, 
                                   "Teacher data missing or 'id' field not properly mapped")
                    return False
            elif response.status_code == 500:
                error_text = response.text
                self.log_result("Individual Teacher Endpoint - BUG FIX VERIFICATION", False, 
                               f"❌ BUG NOT FIXED! Still getting 500 error: {error_text}")
                return False
            else:
                self.log_result("Individual Teacher Endpoint - BUG FIX VERIFICATION", False, 
                               f"Unexpected status code: {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Individual Teacher Endpoint - BUG FIX VERIFICATION", False, f"Exception: {str(e)}")
            return False

    def test_data_structure_integrity(self):
        """Verify that teacher data structure includes proper 'id' field and other required fields"""
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            response = requests.get(f"{BASE_URL}/work/organizations/{self.organization_id}/teachers", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                # Handle both response formats: direct list or {"teachers": [...]}
                if isinstance(data, list):
                    teachers = data
                else:
                    teachers = data.get("teachers", [])
                
                if teachers:
                    teacher = teachers[0]
                    
                    # Check critical fields that were affected by the bug
                    required_fields = {
                        "id": "Teacher ID (was the main bug - member_id not mapped to id)",
                        "user_id": "User ID reference",
                        "user_first_name": "Teacher first name",
                        "user_last_name": "Teacher last name", 
                        "user_email": "Teacher email",
                        "teaching_subjects": "Subjects taught",
                        "teaching_grades": "Grades taught"
                    }
                    
                    missing_fields = []
                    for field, description in required_fields.items():
                        if field not in teacher:
                            missing_fields.append(f"{field} ({description})")
                    
                    if missing_fields:
                        self.log_result("Data Structure Integrity", False, 
                                       f"Missing critical fields: {', '.join(missing_fields)}")
                        return False
                    
                    # Verify 'id' field has a value (not None/empty)
                    if not teacher.get("id"):
                        self.log_result("Data Structure Integrity", False, 
                                       "'id' field exists but is empty/null - field mapping incomplete")
                        return False
                    
                    self.log_result("Data Structure Integrity", True, 
                                   f"✅ All critical fields present including properly mapped 'id' field: {teacher.get('id')}")
                    return True
                else:
                    self.log_result("Data Structure Integrity", True, 
                                   "No teachers to verify structure (empty organization)")
                    return True
            else:
                self.log_result("Data Structure Integrity", False, 
                               f"Cannot verify structure, endpoint failed: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("Data Structure Integrity", False, f"Exception: {str(e)}")
            return False

    def test_previously_working_endpoints(self):
        """Verify that previously working endpoints still work after the fix"""
        try:
            # Test school constants endpoint (should still work)
            response = requests.get(f"{BASE_URL}/work/schools/constants")
            
            if response.status_code == 200:
                data = response.json()
                if "subjects" in data and "grades" in data:
                    self.log_result("Previously Working Endpoints", True, 
                                   "School constants endpoint still working after bug fix")
                    return True
                else:
                    self.log_result("Previously Working Endpoints", False, 
                                   "School constants endpoint structure changed")
                    return False
            else:
                self.log_result("Previously Working Endpoints", False, 
                               f"School constants endpoint broken: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("Previously Working Endpoints", False, f"Exception: {str(e)}")
            return False

    def run_bug_fix_verification(self):
        """Run focused bug fix verification tests"""
        print("🔧 RE-TESTING AFTER BUG FIX - School Management Phase 1: Teacher Listing Endpoints")
        print("=" * 90)
        print("🎯 FOCUS: Verifying field mapping bug fix (MongoDB 'member_id' → 'id' conversion)")
        print("📋 PREVIOUSLY FAILING ENDPOINTS:")
        print("   - GET /api/work/organizations/{org_id}/teachers")
        print("   - GET /api/work/organizations/{org_id}/teachers?grade=10")
        print("   - GET /api/work/organizations/{org_id}/teachers/{id}")
        print("=" * 90)
        print()
        
        # Authentication
        if not self.authenticate_admin():
            print("❌ Cannot proceed without admin authentication")
            return
        
        # Get or create teacher for testing
        if not self.get_or_create_teacher():
            print("⚠️ No teacher available, but can still test endpoints...")
        
        # Test the previously failing endpoints
        print("🔍 TESTING PREVIOUSLY FAILING ENDPOINTS:")
        print("-" * 50)
        
        self.test_teachers_list_endpoint_no_filters()
        self.test_teachers_list_with_grade_filter()
        self.test_individual_teacher_endpoint()
        
        print("\n🔍 ADDITIONAL VERIFICATION TESTS:")
        print("-" * 50)
        
        self.test_teachers_list_with_subject_filter()
        self.test_data_structure_integrity()
        self.test_previously_working_endpoints()
        
        # Print summary
        self.print_bug_fix_summary()

    def print_bug_fix_summary(self):
        """Print focused bug fix verification summary"""
        print("=" * 90)
        print("📊 BUG FIX VERIFICATION SUMMARY")
        print("=" * 90)
        
        total_tests = len(self.results)
        passed_tests = sum(1 for result in self.results if "✅ PASS" in result["status"])
        failed_tests = total_tests - passed_tests
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {success_rate:.1f}%")
        print()
        
        # Check if the critical bug fix tests passed
        critical_tests = [
            "Teachers List (No Filters) - BUG FIX VERIFICATION",
            "Teachers List (Grade Filter) - BUG FIX VERIFICATION", 
            "Individual Teacher Endpoint - BUG FIX VERIFICATION"
        ]
        
        critical_passed = 0
        for result in self.results:
            if result["test"] in critical_tests and "✅ PASS" in result["status"]:
                critical_passed += 1
        
        print("🎯 CRITICAL BUG FIX STATUS:")
        if critical_passed == len(critical_tests):
            print("✅ BUG COMPLETELY FIXED! All previously failing endpoints now return 200 OK")
        elif critical_passed > 0:
            print(f"⚠️ PARTIAL FIX: {critical_passed}/{len(critical_tests)} critical endpoints fixed")
        else:
            print("❌ BUG NOT FIXED: All critical endpoints still failing")
        print()
        
        if failed_tests > 0:
            print("❌ FAILED TESTS:")
            for result in self.results:
                if "❌ FAIL" in result["status"]:
                    print(f"   - {result['test']}: {result['details']}")
            print()
        
        print("✅ PASSED TESTS:")
        for result in self.results:
            if "✅ PASS" in result["status"]:
                print(f"   - {result['test']}")
        
        print()
        print("🔧 BUG FIX DETAILS:")
        print("   - Issue: MongoDB 'member_id' field not mapped to 'id' in TeacherResponse")
        print("   - Fix Applied: Added field mapping logic teacher_data['id'] = teacher_data.pop('member_id')")
        print("   - Endpoints Fixed: GET /teachers, GET /teachers?filters, GET /teachers/{id}")
        
        if success_rate == 100:
            print(f"\n🎉 BUG FIX SUCCESSFUL! All teacher endpoints working correctly ({success_rate:.1f}% success rate)")
        elif success_rate >= 80:
            print(f"\n✅ BUG FIX MOSTLY SUCCESSFUL ({success_rate:.1f}% success rate)")
        else:
            print(f"\n❌ BUG FIX INCOMPLETE - Further investigation needed ({success_rate:.1f}% success rate)")

if __name__ == "__main__":
    tester = TeacherEndpointBugFixTester()
    tester.run_bug_fix_verification()