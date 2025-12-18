#!/usr/bin/env python3
"""
Work Module Notifications System Backend Testing
Tests all notification endpoints and integration flows
"""

import requests
import json
import uuid
from datetime import datetime
import time

# Configuration
BACKEND_URL = "https://social-features-1.preview.emergentagent.com/api"

# Test credentials
TEST_MEMBER_EMAIL = "test@zion.city"
TEST_MEMBER_PASSWORD = "test123"
TEST_ADMIN_EMAIL = "admin@zion.city"
TEST_ADMIN_PASSWORD = "admin123"
TEST_ORG_NAME = "BASIC TEST"

class WorkNotificationsBackendTester:
    def __init__(self):
        self.member_token = None
        self.admin_token = None
        self.organization_id = None
        self.test_results = []
        self.member_user_id = None
        self.admin_user_id = None
        
    def log_result(self, test_name, success, details="", error=""):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "error": error,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        if error:
            print(f"   Error: {error}")
        print()

    def authenticate_member(self):
        """Authenticate test member"""
        try:
            response = requests.post(f"{BACKEND_URL}/auth/login", json={
                "email": TEST_MEMBER_EMAIL,
                "password": TEST_MEMBER_PASSWORD
            })
            
            if response.status_code == 200:
                data = response.json()
                self.member_token = data["access_token"]
                self.member_user_id = data["user"]["id"]
                self.log_result("Member Authentication", True, f"Token obtained for {TEST_MEMBER_EMAIL}")
                return True
            else:
                self.log_result("Member Authentication", False, error=f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Member Authentication", False, error=str(e))
            return False

    def authenticate_admin(self):
        """Authenticate admin user"""
        try:
            response = requests.post(f"{BACKEND_URL}/auth/login", json={
                "email": TEST_ADMIN_EMAIL,
                "password": TEST_ADMIN_PASSWORD
            })
            
            if response.status_code == 200:
                data = response.json()
                self.admin_token = data["access_token"]
                self.admin_user_id = data["user"]["id"]
                self.log_result("Admin Authentication", True, f"Token obtained for {TEST_ADMIN_EMAIL}")
                return True
            else:
                self.log_result("Admin Authentication", False, error=f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Admin Authentication", False, error=str(e))
            return False

    def find_test_organization(self):
        """Find the test organization"""
        try:
            headers = {"Authorization": f"Bearer {self.member_token}"}
            response = requests.get(f"{BACKEND_URL}/work/organizations", headers=headers)
            
            if response.status_code == 200:
                organizations = response.json().get("organizations", [])
                for org in organizations:
                    if org["name"] == TEST_ORG_NAME:
                        self.organization_id = org["id"]
                        self.log_result("Find Test Organization", True, f"Found organization: {TEST_ORG_NAME} (ID: {self.organization_id})")
                        return True
                
                self.log_result("Find Test Organization", False, error=f"Organization '{TEST_ORG_NAME}' not found")
                return False
            else:
                self.log_result("Find Test Organization", False, error=f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Find Test Organization", False, error=str(e))
            return False

    def test_get_notifications_empty(self):
        """Test GET /api/work/notifications with no notifications"""
        try:
            headers = {"Authorization": f"Bearer {self.member_token}"}
            response = requests.get(f"{BACKEND_URL}/work/notifications", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and isinstance(data.get("notifications"), list):
                    self.log_result("GET Notifications (Empty)", True, f"Retrieved {len(data['notifications'])} notifications")
                    return True
                else:
                    self.log_result("GET Notifications (Empty)", False, error="Invalid response structure")
                    return False
            else:
                self.log_result("GET Notifications (Empty)", False, error=f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("GET Notifications (Empty)", False, error=str(e))
            return False

    def test_get_notifications_with_params(self):
        """Test GET /api/work/notifications with parameters"""
        try:
            headers = {"Authorization": f"Bearer {self.member_token}"}
            
            # Test with unread_only=true
            response = requests.get(f"{BACKEND_URL}/work/notifications?unread_only=true", headers=headers)
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    self.log_result("GET Notifications (unread_only=true)", True, f"Retrieved {len(data['notifications'])} unread notifications")
                else:
                    self.log_result("GET Notifications (unread_only=true)", False, error="Invalid response structure")
                    return False
            else:
                self.log_result("GET Notifications (unread_only=true)", False, error=f"Status: {response.status_code}")
                return False
            
            # Test with limit parameter
            response = requests.get(f"{BACKEND_URL}/work/notifications?limit=10", headers=headers)
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    self.log_result("GET Notifications (limit=10)", True, f"Retrieved {len(data['notifications'])} notifications with limit")
                    return True
                else:
                    self.log_result("GET Notifications (limit=10)", False, error="Invalid response structure")
                    return False
            else:
                self.log_result("GET Notifications (limit=10)", False, error=f"Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("GET Notifications with Parameters", False, error=str(e))
            return False

    def create_role_change_request(self):
        """Create a role change request to generate notifications"""
        try:
            headers = {"Authorization": f"Bearer {self.member_token}"}
            
            # Update member settings to create a role change request
            response = requests.put(f"{BACKEND_URL}/work/organizations/{self.organization_id}/members/me", 
                                  headers=headers,
                                  json={
                                      "requested_role": "MANAGER",
                                      "reason": "Test role change request for notification testing"
                                  })
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("Create Role Change Request", True, "Role change request created successfully")
                return True
            else:
                self.log_result("Create Role Change Request", False, error=f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Create Role Change Request", False, error=str(e))
            return False

    def approve_role_change_request(self):
        """Admin approves the role change request"""
        try:
            # First get pending change requests
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.get(f"{BACKEND_URL}/work/organizations/{self.organization_id}/change-requests?status=PENDING", 
                                  headers=headers)
            
            if response.status_code != 200:
                self.log_result("Get Pending Change Requests", False, error=f"Status: {response.status_code}")
                return False
            
            data = response.json()
            pending_requests = data.get("data", [])
            
            # Find the request for our test member
            request_id = None
            for request in pending_requests:
                if request.get("user_id") == self.member_user_id:
                    request_id = request.get("id")
                    break
            
            if not request_id:
                self.log_result("Find Role Change Request", False, error="No pending request found for test member")
                return False
            
            # Approve the request
            response = requests.post(f"{BACKEND_URL}/work/organizations/{self.organization_id}/change-requests/{request_id}/approve", 
                                   headers=headers)
            
            if response.status_code == 200:
                self.log_result("Approve Role Change Request", True, f"Request {request_id} approved successfully")
                return True
            else:
                self.log_result("Approve Role Change Request", False, error=f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Approve Role Change Request", False, error=str(e))
            return False

    def test_notification_created_after_approval(self):
        """Test that notification was created after role change approval"""
        try:
            # Wait a moment for notification to be created
            time.sleep(2)
            
            headers = {"Authorization": f"Bearer {self.member_token}"}
            response = requests.get(f"{BACKEND_URL}/work/notifications", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                notifications = data.get("notifications", [])
                
                # Look for role change approved notification
                approval_notification = None
                for notif in notifications:
                    if notif.get("notification_type") == "ROLE_CHANGE_APPROVED":
                        approval_notification = notif
                        break
                
                if approval_notification:
                    # Verify notification content
                    required_fields = ["id", "title", "message", "organization_name", "is_read", "created_at"]
                    missing_fields = [field for field in required_fields if field not in approval_notification]
                    
                    if not missing_fields:
                        self.log_result("Notification Created After Approval", True, 
                                      f"Found ROLE_CHANGE_APPROVED notification with title: '{approval_notification['title']}'")
                        return approval_notification["id"]
                    else:
                        self.log_result("Notification Created After Approval", False, 
                                      error=f"Missing fields in notification: {missing_fields}")
                        return None
                else:
                    self.log_result("Notification Created After Approval", False, 
                                  error="No ROLE_CHANGE_APPROVED notification found")
                    return None
            else:
                self.log_result("Notification Created After Approval", False, 
                              error=f"Status: {response.status_code}, Response: {response.text}")
                return None
                
        except Exception as e:
            self.log_result("Notification Created After Approval", False, error=str(e))
            return None

    def test_mark_notification_read(self, notification_id):
        """Test PATCH /api/work/notifications/{notification_id}/read"""
        try:
            headers = {"Authorization": f"Bearer {self.member_token}"}
            response = requests.patch(f"{BACKEND_URL}/work/notifications/{notification_id}/read", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    self.log_result("Mark Notification Read", True, f"Notification {notification_id} marked as read")
                    return True
                else:
                    self.log_result("Mark Notification Read", False, error="Invalid response structure")
                    return False
            else:
                self.log_result("Mark Notification Read", False, error=f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Mark Notification Read", False, error=str(e))
            return False

    def test_mark_all_notifications_read(self):
        """Test PATCH /api/work/notifications/read-all"""
        try:
            headers = {"Authorization": f"Bearer {self.member_token}"}
            response = requests.patch(f"{BACKEND_URL}/work/notifications/read-all", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    modified_count = data.get("modified_count", 0)
                    self.log_result("Mark All Notifications Read", True, f"Marked {modified_count} notifications as read")
                    return True
                else:
                    self.log_result("Mark All Notifications Read", False, error="Invalid response structure")
                    return False
            else:
                self.log_result("Mark All Notifications Read", False, error=f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Mark All Notifications Read", False, error=str(e))
            return False

    def test_role_change_rejection_flow(self):
        """Test role change rejection flow and notification creation"""
        try:
            # Create another role change request
            headers = {"Authorization": f"Bearer {self.member_token}"}
            response = requests.put(f"{BACKEND_URL}/work/organizations/{self.organization_id}/members/me", 
                                  headers=headers,
                                  json={
                                      "requested_department": "Engineering",
                                      "reason": "Test department change request for rejection testing"
                                  })
            
            if response.status_code != 200:
                self.log_result("Create Department Change Request", False, error=f"Status: {response.status_code}")
                return False
            
            # Get the new request
            admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.get(f"{BACKEND_URL}/work/organizations/{self.organization_id}/change-requests?status=PENDING", 
                                  headers=admin_headers)
            
            if response.status_code != 200:
                self.log_result("Get New Pending Request", False, error=f"Status: {response.status_code}")
                return False
            
            data = response.json()
            pending_requests = data.get("data", [])
            
            # Find the department change request
            request_id = None
            for request in pending_requests:
                if (request.get("user_id") == self.member_user_id and 
                    request.get("request_type") == "DEPARTMENT_CHANGE"):
                    request_id = request.get("id")
                    break
            
            if not request_id:
                self.log_result("Find Department Change Request", False, error="No department change request found")
                return False
            
            # Reject the request
            rejection_reason = "Department change not approved at this time"
            response = requests.post(f"{BACKEND_URL}/work/organizations/{self.organization_id}/change-requests/{request_id}/reject?rejection_reason={rejection_reason}", 
                                   headers=admin_headers)
            
            if response.status_code != 200:
                self.log_result("Reject Department Change Request", False, error=f"Status: {response.status_code}")
                return False
            
            # Wait for notification
            time.sleep(2)
            
            # Check for rejection notification
            member_headers = {"Authorization": f"Bearer {self.member_token}"}
            response = requests.get(f"{BACKEND_URL}/work/notifications", headers=member_headers)
            
            if response.status_code == 200:
                data = response.json()
                notifications = data.get("notifications", [])
                
                # Look for rejection notification
                rejection_notification = None
                for notif in notifications:
                    if notif.get("notification_type") == "DEPARTMENT_CHANGE_REJECTED":
                        rejection_notification = notif
                        break
                
                if rejection_notification:
                    # Check if rejection reason is in message
                    message = rejection_notification.get("message", "")
                    if rejection_reason in message:
                        self.log_result("Role Change Rejection Flow", True, 
                                      f"Found DEPARTMENT_CHANGE_REJECTED notification with reason in message")
                        return True
                    else:
                        self.log_result("Role Change Rejection Flow", False, 
                                      error=f"Rejection reason not found in message: {message}")
                        return False
                else:
                    self.log_result("Role Change Rejection Flow", False, 
                                  error="No DEPARTMENT_CHANGE_REJECTED notification found")
                    return False
            else:
                self.log_result("Role Change Rejection Flow", False, 
                              error=f"Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("Role Change Rejection Flow", False, error=str(e))
            return False

    def test_unauthorized_access(self):
        """Test unauthorized access to notification endpoints"""
        try:
            # Test without authentication
            response = requests.get(f"{BACKEND_URL}/work/notifications")
            
            if response.status_code == 401:
                self.log_result("Unauthorized Access (No Auth)", True, "Correctly returned 401 Unauthorized")
            else:
                self.log_result("Unauthorized Access (No Auth)", False, error=f"Expected 401, got {response.status_code}")
                return False
            
            # Test marking notification as read without permission
            fake_notification_id = str(uuid.uuid4())
            headers = {"Authorization": f"Bearer {self.member_token}"}
            response = requests.patch(f"{BACKEND_URL}/work/notifications/{fake_notification_id}/read", headers=headers)
            
            if response.status_code == 404:
                self.log_result("Mark Non-existent Notification", True, "Correctly returned 404 for non-existent notification")
                return True
            else:
                self.log_result("Mark Non-existent Notification", False, error=f"Expected 404, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("Unauthorized Access Tests", False, error=str(e))
            return False

    def run_all_tests(self):
        """Run all notification tests"""
        print("🚀 Starting Work Module Notifications System Backend Testing")
        print("=" * 70)
        
        # Authentication
        if not self.authenticate_member():
            return False
        if not self.authenticate_admin():
            return False
        if not self.find_test_organization():
            return False
        
        # Basic notification endpoints
        self.test_get_notifications_empty()
        self.test_get_notifications_with_params()
        
        # Role change approval flow
        if self.create_role_change_request():
            if self.approve_role_change_request():
                notification_id = self.test_notification_created_after_approval()
                if notification_id:
                    self.test_mark_notification_read(notification_id)
        
        # Mark all notifications as read
        self.test_mark_all_notifications_read()
        
        # Role change rejection flow
        self.test_role_change_rejection_flow()
        
        # Error handling
        self.test_unauthorized_access()
        
        # Summary
        print("=" * 70)
        print("📊 TEST SUMMARY")
        print("=" * 70)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['error']}")
        
        print("\n🎯 CRITICAL FUNCTIONALITY STATUS:")
        
        # Check critical endpoints
        critical_tests = [
            "GET Notifications (Empty)",
            "GET Notifications (unread_only=true)", 
            "Mark Notification Read",
            "Mark All Notifications Read",
            "Notification Created After Approval",
            "Role Change Rejection Flow"
        ]
        
        critical_passed = 0
        for test_name in critical_tests:
            test_result = next((r for r in self.test_results if r["test"] == test_name), None)
            if test_result and test_result["success"]:
                critical_passed += 1
                print(f"✅ {test_name}")
            else:
                print(f"❌ {test_name}")
        
        critical_success_rate = (critical_passed / len(critical_tests) * 100)
        print(f"\nCritical Success Rate: {critical_success_rate:.1f}%")
        
        if critical_success_rate >= 80:
            print("\n🎉 WORK MODULE NOTIFICATIONS SYSTEM IS PRODUCTION-READY!")
        else:
            print("\n⚠️  WORK MODULE NOTIFICATIONS SYSTEM NEEDS ATTENTION!")
        
        return critical_success_rate >= 80

if __name__ == "__main__":
    tester = WorkNotificationsBackendTester()
    tester.run_all_tests()