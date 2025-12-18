#!/usr/bin/env python3
"""
Task-to-Post Integration Backend Testing
Testing the Task-to-Post Integration features in the Organizations (Work) module.

Test Scope:
1. Authentication Test - Login with admin@test.com to get JWT token
2. Task Creation Test - POST /api/work/organizations/{org_id}/tasks
3. Task Status Update Test - POST /api/work/organizations/{org_id}/tasks/{task_id}/status
4. Task Completion Creates Post Test - POST /api/work/organizations/{org_id}/tasks/{task_id}/status (DONE)
5. Feed Contains Completion Post Test - GET /api/work/posts/feed
6. Task Discussion Creation Test - POST /api/work/organizations/{org_id}/tasks/{task_id}/discuss
7. Feed Contains Discussion Post Test - GET /api/work/posts/feed

Test Credentials:
- User: admin@test.com / testpassword123
- Organization ID: 1f6f47c5-ab00-4f4a-8577-812380098a32
"""

import requests
import json
import time
from datetime import datetime, timedelta
import sys
import os

# Get backend URL from environment
BACKEND_URL = "https://news-social-update.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

# Test credentials and organization
USER_EMAIL = "admin@test.com"
USER_PASSWORD = "testpassword123"
ORG_ID = "1f6f47c5-ab00-4f4a-8577-812380098a32"

class TaskToPostIntegrationTester:
    def __init__(self):
        self.user_token = None
        self.user_id = None
        self.task_id = None
        self.discussion_task_id = None
        self.completion_post_id = None
        self.discussion_post_id = None
        self.test_results = []
        
    def log_test(self, test_name, success, details=""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
        
    def authenticate_user(self):
        """Authenticate user and return token and user info"""
        try:
            # Login request
            login_data = {
                "email": USER_EMAIL,
                "password": USER_PASSWORD
            }
            
            response = requests.post(f"{API_BASE}/auth/login", json=login_data)
            
            if response.status_code == 200:
                data = response.json()
                token = data.get("access_token")
                
                # Get user info
                headers = {"Authorization": f"Bearer {token}"}
                me_response = requests.get(f"{API_BASE}/auth/me", headers=headers)
                
                if me_response.status_code == 200:
                    user_info = me_response.json()
                    return token, user_info.get("id"), user_info
                else:
                    return None, None, None
            else:
                print(f"Login failed with status {response.status_code}: {response.text}")
                return None, None, None
                
        except Exception as e:
            print(f"Authentication error: {e}")
            return None, None, None
    
    def test_authentication(self):
        """Test 1: Authentication Test"""
        print("\n=== Test 1: Authentication Test ===")
        
        # Test User authentication
        self.user_token, self.user_id, user_info = self.authenticate_user()
        
        if self.user_token and self.user_id:
            self.log_test("User Authentication", True, f"Token obtained for user {self.user_id}")
            return True
        else:
            self.log_test("User Authentication", False, "Failed to authenticate user")
            return False
    
    def test_task_creation(self):
        """Test 2: Task Creation with Full Data"""
        print("\n=== Test 2: Task Creation Test ===")
        
        if not self.user_token:
            self.log_test("Task Creation", False, "Authentication required first")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.user_token}"}
            
            # Create task with full data
            task_data = {
                "title": "Test Task for Integration Testing",
                "description": "This is a test task created by the testing agent to verify task-to-post integration functionality.",
                "priority": "URGENT",
                "deadline": (datetime.now() + timedelta(days=7)).isoformat(),
                "requires_photo_proof": False
            }
            
            response = requests.post(f"{API_BASE}/work/organizations/{ORG_ID}/tasks", 
                                   json=task_data, headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                task_data = result.get("task", {})
                self.task_id = task_data.get("id")
                task_status = task_data.get("status")
                
                if self.task_id and task_status == "ACCEPTED":
                    self.log_test("Task Creation", True, f"Task created with ID: {self.task_id}, Status: {task_status}")
                    return True
                else:
                    self.log_test("Task Creation", False, f"Task created but missing ID or wrong status. Task ID: {self.task_id}, Status: {task_status}")
                    return False
            else:
                self.log_test("Task Creation", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Task Creation", False, f"Error: {e}")
            return False
    
    def test_task_status_update_in_progress(self):
        """Test 3: Task Status Update to IN_PROGRESS"""
        print("\n=== Test 3: Task Status Update to IN_PROGRESS ===")
        
        if not self.task_id:
            self.log_test("Task Status Update IN_PROGRESS", False, "Task ID required")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.user_token}"}
            
            # Update task status to IN_PROGRESS
            status_data = {"status": "IN_PROGRESS"}
            
            response = requests.post(f"{API_BASE}/work/organizations/{ORG_ID}/tasks/{self.task_id}/status", 
                                   json=status_data, headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                task_data = result.get("task", {})
                updated_status = task_data.get("status")
                
                if updated_status == "IN_PROGRESS":
                    self.log_test("Task Status Update IN_PROGRESS", True, f"Task status updated to: {updated_status}")
                    return True
                else:
                    self.log_test("Task Status Update IN_PROGRESS", False, f"Status not updated correctly. Expected: IN_PROGRESS, Got: {updated_status}")
                    return False
            else:
                self.log_test("Task Status Update IN_PROGRESS", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Task Status Update IN_PROGRESS", False, f"Error: {e}")
            return False
    
    def test_task_completion_creates_post(self):
        """Test 4: Task Completion Creates Post"""
        print("\n=== Test 4: Task Completion Creates Post ===")
        
        if not self.task_id:
            self.log_test("Task Completion Creates Post", False, "Task ID required")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.user_token}"}
            
            # Complete task with completion note
            completion_data = {
                "status": "DONE",
                "completion_note": "Test completion note - task completed successfully by testing agent",
                "completion_photo_ids": []
            }
            
            response = requests.post(f"{API_BASE}/work/organizations/{ORG_ID}/tasks/{self.task_id}/status", 
                                   json=completion_data, headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                task_data = result.get("task", {})
                task_status = task_data.get("status")
                self.completion_post_id = task_data.get("completion_post_id")
                completed_by = task_data.get("completed_by")
                completed_at = task_data.get("completed_at")
                
                success_checks = []
                
                # Check task status = DONE
                if task_status == "DONE":
                    success_checks.append("✓ Task status = DONE")
                else:
                    success_checks.append(f"✗ Task status = {task_status} (expected DONE)")
                
                # Check completion_post_id is returned
                if self.completion_post_id:
                    success_checks.append(f"✓ completion_post_id returned: {self.completion_post_id}")
                else:
                    success_checks.append("✗ completion_post_id not returned")
                
                # Check completed_by is set
                if completed_by:
                    success_checks.append(f"✓ completed_by set: {completed_by}")
                else:
                    success_checks.append("✗ completed_by not set")
                
                # Check completed_at is set
                if completed_at:
                    success_checks.append(f"✓ completed_at set: {completed_at}")
                else:
                    success_checks.append("✗ completed_at not set")
                
                all_checks_passed = all("✓" in check for check in success_checks)
                
                self.log_test("Task Completion Creates Post", all_checks_passed, 
                            f"Verification results: {'; '.join(success_checks)}")
                return all_checks_passed
            else:
                self.log_test("Task Completion Creates Post", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Task Completion Creates Post", False, f"Error: {e}")
            return False
    
    def test_feed_contains_completion_post(self):
        """Test 5: Feed Contains Completion Post"""
        print("\n=== Test 5: Feed Contains Completion Post ===")
        
        if not self.completion_post_id:
            self.log_test("Feed Contains Completion Post", False, "Completion post ID required")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.user_token}"}
            
            # Get feed
            response = requests.get(f"{API_BASE}/work/posts/feed", headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                posts = result.get("posts", [])
                
                if len(posts) >= 1:
                    # Find our completion post
                    completion_post = None
                    for post in posts:
                        if post.get("id") == self.completion_post_id:
                            completion_post = post
                            break
                    
                    if completion_post:
                        success_checks = []
                        
                        # Check post_type = "TASK_COMPLETION"
                        post_type = completion_post.get("post_type")
                        if post_type == "TASK_COMPLETION":
                            success_checks.append("✓ post_type = TASK_COMPLETION")
                        else:
                            success_checks.append(f"✗ post_type = {post_type} (expected TASK_COMPLETION)")
                        
                        # Check task_metadata exists and has required fields
                        task_metadata = completion_post.get("task_metadata", {})
                        if task_metadata:
                            task_id = task_metadata.get("task_id")
                            task_title = task_metadata.get("task_title")
                            completion_note = task_metadata.get("completion_note")
                            
                            if task_id == self.task_id:
                                success_checks.append(f"✓ task_metadata.task_id = {task_id}")
                            else:
                                success_checks.append(f"✗ task_metadata.task_id = {task_id} (expected {self.task_id})")
                            
                            if task_title:
                                success_checks.append(f"✓ task_metadata.task_title = {task_title}")
                            else:
                                success_checks.append("✗ task_metadata.task_title missing")
                            
                            if completion_note:
                                success_checks.append(f"✓ task_metadata.completion_note = {completion_note}")
                            else:
                                success_checks.append("✗ task_metadata.completion_note missing")
                        else:
                            success_checks.append("✗ task_metadata missing")
                        
                        # Check author_name exists
                        author = completion_post.get("author", {})
                        author_name = author.get("first_name") or author.get("name") or author.get("user_first_name")
                        if author_name:
                            success_checks.append(f"✓ author_name = {author_name}")
                        else:
                            success_checks.append(f"✗ author_name missing (author object: {author})")
                        
                        all_checks_passed = all("✓" in check for check in success_checks)
                        
                        self.log_test("Feed Contains Completion Post", all_checks_passed, 
                                    f"Verification results: {'; '.join(success_checks)}")
                        return all_checks_passed
                    else:
                        self.log_test("Feed Contains Completion Post", False, f"Completion post with ID {self.completion_post_id} not found in feed")
                        return False
                else:
                    self.log_test("Feed Contains Completion Post", False, f"Feed contains {len(posts)} posts (expected at least 1)")
                    return False
            else:
                self.log_test("Feed Contains Completion Post", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Feed Contains Completion Post", False, f"Error: {e}")
            return False
    
    def test_task_discussion_creation(self):
        """Test 6: Task Discussion Creation"""
        print("\n=== Test 6: Task Discussion Creation ===")
        
        if not self.user_token:
            self.log_test("Task Discussion Creation", False, "Authentication required")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.user_token}"}
            
            # First create a new task for discussion
            task_data = {
                "title": "Discussion Test Task",
                "description": "This task is created to test the discussion feature.",
                "priority": "MEDIUM",
                "deadline": (datetime.now() + timedelta(days=5)).isoformat(),
                "requires_photo_proof": False
            }
            
            task_response = requests.post(f"{API_BASE}/work/organizations/{ORG_ID}/tasks", 
                                        json=task_data, headers=headers)
            
            if task_response.status_code == 200:
                task_result = task_response.json()
                task_data = task_result.get("task", {})
                self.discussion_task_id = task_data.get("id")
                
                if self.discussion_task_id:
                    # Create discussion post
                    response = requests.post(f"{API_BASE}/work/organizations/{ORG_ID}/tasks/{self.discussion_task_id}/discuss", 
                                           headers=headers)
                    
                    if response.status_code == 200:
                        result = response.json()
                        self.discussion_post_id = result.get("post_id")
                        message = result.get("message", "")
                        
                        success_checks = []
                        
                        # Check post_id is returned
                        if self.discussion_post_id:
                            success_checks.append(f"✓ post_id returned: {self.discussion_post_id}")
                        else:
                            success_checks.append("✗ post_id not returned")
                        
                        # Check success message (accept both English and Russian)
                        if "success" in message.lower() or "создано" in message.lower():
                            success_checks.append(f"✓ Success message: {message}")
                        else:
                            success_checks.append(f"✗ Unexpected message: {message}")
                        
                        all_checks_passed = all("✓" in check for check in success_checks)
                        
                        self.log_test("Task Discussion Creation", all_checks_passed, 
                                    f"Verification results: {'; '.join(success_checks)}")
                        return all_checks_passed
                    else:
                        self.log_test("Task Discussion Creation", False, f"Status: {response.status_code}, Response: {response.text}")
                        return False
                else:
                    self.log_test("Task Discussion Creation", False, "Failed to create discussion task")
                    return False
            else:
                self.log_test("Task Discussion Creation", False, f"Failed to create task for discussion. Status: {task_response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Task Discussion Creation", False, f"Error: {e}")
            return False
    
    def test_feed_contains_discussion_post(self):
        """Test 7: Feed Contains Discussion Post"""
        print("\n=== Test 7: Feed Contains Discussion Post ===")
        
        if not self.discussion_post_id:
            self.log_test("Feed Contains Discussion Post", False, "Discussion post ID required")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.user_token}"}
            
            # Get feed
            response = requests.get(f"{API_BASE}/work/posts/feed", headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                posts = result.get("posts", [])
                
                if len(posts) >= 1:
                    # Find our discussion post
                    discussion_post = None
                    for post in posts:
                        if post.get("id") == self.discussion_post_id:
                            discussion_post = post
                            break
                    
                    if discussion_post:
                        success_checks = []
                        
                        # Check post_type = "TASK_DISCUSSION"
                        post_type = discussion_post.get("post_type")
                        if post_type == "TASK_DISCUSSION":
                            success_checks.append("✓ post_type = TASK_DISCUSSION")
                        else:
                            success_checks.append(f"✗ post_type = {post_type} (expected TASK_DISCUSSION)")
                        
                        # Check task_metadata exists and has required fields
                        task_metadata = discussion_post.get("task_metadata", {})
                        if task_metadata:
                            task_id = task_metadata.get("task_id")
                            task_title = task_metadata.get("task_title")
                            
                            if task_id == self.discussion_task_id:
                                success_checks.append(f"✓ task_metadata.task_id = {task_id}")
                            else:
                                success_checks.append(f"✗ task_metadata.task_id = {task_id} (expected {self.discussion_task_id})")
                            
                            if task_title:
                                success_checks.append(f"✓ task_metadata.task_title = {task_title}")
                            else:
                                success_checks.append("✗ task_metadata.task_title missing")
                        else:
                            success_checks.append("✗ task_metadata missing")
                        
                        all_checks_passed = all("✓" in check for check in success_checks)
                        
                        self.log_test("Feed Contains Discussion Post", all_checks_passed, 
                                    f"Verification results: {'; '.join(success_checks)}")
                        return all_checks_passed
                    else:
                        self.log_test("Feed Contains Discussion Post", False, f"Discussion post with ID {self.discussion_post_id} not found in feed")
                        return False
                else:
                    self.log_test("Feed Contains Discussion Post", False, f"Feed contains {len(posts)} posts (expected at least 1)")
                    return False
            else:
                self.log_test("Feed Contains Discussion Post", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Feed Contains Discussion Post", False, f"Error: {e}")
            return False
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Task-to-Post Integration Backend Testing")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Organization ID: {ORG_ID}")
        print(f"Test Time: {datetime.now().isoformat()}")
        
        # Run tests in order
        if not self.test_authentication():
            print("❌ Authentication failed - stopping tests")
            return
            
        if not self.test_task_creation():
            print("❌ Task creation failed - stopping tests")
            return
            
        # Continue with task status tests
        self.test_task_status_update_in_progress()
        self.test_task_completion_creates_post()
        self.test_feed_contains_completion_post()
        self.test_task_discussion_creation()
        self.test_feed_contains_discussion_post()
        
        # Print summary
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("📊 TEST SUMMARY")
        print("="*60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        print("\n✅ PASSED TESTS:")
        for result in self.test_results:
            if result["success"]:
                print(f"  - {result['test']}")
                
        # Overall assessment
        if passed_tests == total_tests:
            print("\n🎉 ALL TESTS PASSED - Task-to-Post Integration is PRODUCTION READY!")
        elif passed_tests >= total_tests * 0.8:
            print("\n✅ MOSTLY WORKING - Task-to-Post Integration is functional with minor issues")
        else:
            print("\n⚠️  SIGNIFICANT ISSUES - Task-to-Post Integration needs attention")

if __name__ == "__main__":
    tester = TaskToPostIntegrationTester()
    tester.run_all_tests()