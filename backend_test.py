#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
import uuid

class ZionCityAPITester:
    def __init__(self, base_url="https://zion-dashboard.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.custom_group_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_user_email = f"test_user_{datetime.now().strftime('%Y%m%d_%H%M%S')}@example.com"
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
            
            # Print response details for debugging 422 errors
            if response.status_code == 422:
                try:
                    error_data = response.json()
                    print(f"   422 Error Details: {error_data}")
                except:
                    print(f"   422 Error Text: {response.text}")
            
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
                    if response.status_code == 422:
                        # Handle validation errors
                        if 'detail' in error_data and isinstance(error_data['detail'], list):
                            validation_errors = []
                            for error in error_data['detail']:
                                field = error.get('loc', ['unknown'])[-1]
                                msg = error.get('msg', 'validation error')
                                validation_errors.append(f"{field}: {msg}")
                            error_msg = f"Validation errors: {', '.join(validation_errors)}"
                        else:
                            error_msg = error_data.get('detail', f'Status: {response.status_code}')
                    else:
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
        
        if response is not None and response.status_code == 400:
            try:
                data = response.json()
                success = "already registered" in data.get('detail', '').lower()
                self.log_test("Duplicate registration prevention", success, f"Error: {data.get('detail')}")
            except:
                self.log_test("Duplicate registration prevention", True, f"Got 400 status as expected")
        else:
            status = response.status_code if response is not None else "No response"
            self.log_test("Duplicate registration prevention", False, f"Expected 400, got {status}")

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
        
        if response is not None and response.status_code == 401:
            self.log_test("Invalid login rejection", True, "Correctly rejected invalid credentials")
        else:
            status = response.status_code if response is not None else "No response"
            self.log_test("Invalid login rejection", False, f"Expected 401, got {status}")

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

    def test_auto_family_groups_creation(self):
        """Test that auto family groups are created during registration"""
        print("\n🔍 Testing Auto Family Groups Creation...")
        
        if not self.token:
            self.log_test("Auto family groups creation", False, "No authentication token available")
            return False
        
        response = self.make_request('GET', 'chat-groups', auth_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            chat_groups = data.get('chat_groups', [])
            
            # Look for auto-created Family and Relatives groups
            family_group = None
            relatives_group = None
            
            for group_data in chat_groups:
                group = group_data.get('group', {})
                if group.get('group_type') == 'FAMILY':
                    family_group = group
                elif group.get('group_type') == 'RELATIVES':
                    relatives_group = group
            
            success = family_group is not None and relatives_group is not None
            
            if success:
                # Verify group properties
                family_valid = (
                    family_group.get('admin_id') == self.user_id and
                    'Family' in family_group.get('name', '') and
                    family_group.get('color_code') == '#059669'
                )
                
                relatives_valid = (
                    relatives_group.get('admin_id') == self.user_id and
                    'Relatives' in relatives_group.get('name', '') and
                    relatives_group.get('color_code') == '#047857'
                )
                
                success = family_valid and relatives_valid
                
                details = f"Family group: {family_group.get('name')}, Relatives group: {relatives_group.get('name')}"
            else:
                details = f"Found {len(chat_groups)} groups, but missing Family/Relatives auto-groups"
            
            self.log_test("Auto family groups creation", success, details)
            return success
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("Auto family groups creation", False, error_msg)
        
        return False

    def test_chat_groups_management(self):
        """Test chat groups management API"""
        print("\n🔍 Testing Chat Groups Management API...")
        
        if not self.token:
            self.log_test("Chat groups management", False, "No authentication token available")
            return False
        
        # Test GET /api/chat-groups
        response = self.make_request('GET', 'chat-groups', auth_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            chat_groups = data.get('chat_groups', [])
            
            # Should have at least 2 groups (Family and Relatives)
            get_success = len(chat_groups) >= 2
            self.log_test("Get chat groups", get_success, f"Found {len(chat_groups)} groups")
            
            # Test POST /api/chat-groups - Create custom group
            custom_group_data = {
                "name": "Test Custom Group",
                "description": "A test custom chat group",
                "group_type": "CUSTOM",
                "color_code": "#3B82F6",
                "member_ids": []
            }
            
            create_response = self.make_request('POST', 'chat-groups', custom_group_data, auth_required=True)
            
            if create_response and create_response.status_code == 200:
                create_data = create_response.json()
                create_success = (
                    'group_id' in create_data and
                    create_data.get('message') == 'Chat group created successfully'
                )
                self.log_test("Create custom chat group", create_success, f"Group ID: {create_data.get('group_id')}")
                
                # Store group ID for later tests
                if create_success:
                    self.custom_group_id = create_data['group_id']
                
                return get_success and create_success
            else:
                error_msg = f"Status: {create_response.status_code}" if create_response else "No response"
                self.log_test("Create custom chat group", False, error_msg)
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("Get chat groups", False, error_msg)
        
        return False

    def test_chat_messages_api(self):
        """Test chat messages API"""
        print("\n🔍 Testing Chat Messages API...")
        
        if not self.token:
            self.log_test("Chat messages API", False, "No authentication token available")
            return False
        
        # First get a group to test with
        response = self.make_request('GET', 'chat-groups', auth_required=True)
        
        if not (response and response.status_code == 200):
            self.log_test("Chat messages API", False, "Could not get chat groups")
            return False
        
        data = response.json()
        chat_groups = data.get('chat_groups', [])
        
        if not chat_groups:
            self.log_test("Chat messages API", False, "No chat groups available")
            return False
        
        # Use the first available group
        test_group_id = chat_groups[0]['group']['id']
        
        # Test GET messages (should be empty initially)
        get_response = self.make_request('GET', f'chat-groups/{test_group_id}/messages', auth_required=True)
        
        if get_response and get_response.status_code == 200:
            get_data = get_response.json()
            messages = get_data.get('messages', [])
            get_success = isinstance(messages, list)  # Should return a list (even if empty)
            self.log_test("Get chat messages", get_success, f"Found {len(messages)} messages")
            
            # Test POST message
            message_data = {
                "group_id": test_group_id,
                "content": "Hello! This is a test message from the API test suite.",
                "message_type": "TEXT"
            }
            
            post_response = self.make_request('POST', f'chat-groups/{test_group_id}/messages', message_data, auth_required=True)
            
            if post_response and post_response.status_code == 200:
                post_data = post_response.json()
                post_success = (
                    'message_id' in post_data and
                    post_data.get('message') == 'Message sent successfully'
                )
                self.log_test("Send chat message", post_success, f"Message ID: {post_data.get('message_id')}")
                
                # Test GET messages again to verify message was saved
                verify_response = self.make_request('GET', f'chat-groups/{test_group_id}/messages', auth_required=True)
                
                if verify_response and verify_response.status_code == 200:
                    verify_data = verify_response.json()
                    new_messages = verify_data.get('messages', [])
                    verify_success = len(new_messages) > len(messages)
                    
                    if verify_success and new_messages:
                        # Check message structure
                        latest_message = new_messages[-1]
                        verify_success = (
                            latest_message.get('content') == message_data['content'] and
                            latest_message.get('user_id') == self.user_id and
                            'sender' in latest_message
                        )
                    
                    self.log_test("Verify message saved", verify_success, f"Total messages: {len(new_messages)}")
                    return get_success and post_success and verify_success
                else:
                    self.log_test("Verify message saved", False, "Could not verify message was saved")
            else:
                error_msg = f"Status: {post_response.status_code}" if post_response else "No response"
                self.log_test("Send chat message", False, error_msg)
        else:
            error_msg = f"Status: {get_response.status_code}" if get_response else "No response"
            self.log_test("Get chat messages", False, error_msg)
        
        return False

    def test_scheduled_actions_api(self):
        """Test scheduled actions API"""
        print("\n🔍 Testing Scheduled Actions API...")
        
        if not self.token:
            self.log_test("Scheduled actions API", False, "No authentication token available")
            return False
        
        # First get a group to test with
        response = self.make_request('GET', 'chat-groups', auth_required=True)
        
        if not (response and response.status_code == 200):
            self.log_test("Scheduled actions API", False, "Could not get chat groups")
            return False
        
        data = response.json()
        chat_groups = data.get('chat_groups', [])
        
        if not chat_groups:
            self.log_test("Scheduled actions API", False, "No chat groups available")
            return False
        
        # Use the first available group
        test_group_id = chat_groups[0]['group']['id']
        
        # Test GET scheduled actions (should be empty initially)
        get_response = self.make_request('GET', f'chat-groups/{test_group_id}/scheduled-actions', auth_required=True)
        
        if get_response and get_response.status_code == 200:
            get_data = get_response.json()
            actions = get_data.get('scheduled_actions', [])
            get_success = isinstance(actions, list)
            self.log_test("Get scheduled actions", get_success, f"Found {len(actions)} actions")
            
            # Test POST scheduled action
            from datetime import datetime, timedelta, timezone
            future_date = datetime.now(timezone.utc) + timedelta(days=7)
            
            action_data = {
                "group_id": test_group_id,
                "title": "Test Family Meeting",
                "description": "Weekly family meeting to discuss plans",
                "action_type": "APPOINTMENT",
                "scheduled_date": future_date.isoformat(),
                "scheduled_time": "19:00",
                "color_code": "#059669",
                "invitees": [self.user_id],
                "location": "Living Room"
            }
            
            post_response = self.make_request('POST', f'chat-groups/{test_group_id}/scheduled-actions', action_data, auth_required=True)
            
            if post_response and post_response.status_code == 200:
                post_data = post_response.json()
                post_success = (
                    'action_id' in post_data and
                    post_data.get('message') == 'Scheduled action created successfully'
                )
                self.log_test("Create scheduled action", post_success, f"Action ID: {post_data.get('action_id')}")
                
                if post_success:
                    action_id = post_data['action_id']
                    
                    # Test PUT complete action
                    complete_response = self.make_request('PUT', f'scheduled-actions/{action_id}/complete', auth_required=True)
                    
                    if complete_response and complete_response.status_code == 200:
                        complete_data = complete_response.json()
                        complete_success = complete_data.get('message') == 'Scheduled action marked as completed'
                        self.log_test("Complete scheduled action", complete_success, "Action marked as completed")
                        
                        return get_success and post_success and complete_success
                    else:
                        error_msg = f"Status: {complete_response.status_code}" if complete_response else "No response"
                        self.log_test("Complete scheduled action", False, error_msg)
            else:
                error_msg = f"Status: {post_response.status_code}" if post_response else "No response"
                self.log_test("Create scheduled action", False, error_msg)
        else:
            error_msg = f"Status: {get_response.status_code}" if get_response else "No response"
            self.log_test("Get scheduled actions", False, error_msg)
        
        return False

    def test_chat_authorization(self):
        """Test chat group authorization and membership verification"""
        print("\n🔍 Testing Chat Authorization...")
        
        if not self.token:
            self.log_test("Chat authorization", False, "No authentication token available")
            return False
        
        # Try to access a non-existent group
        fake_group_id = str(uuid.uuid4())
        
        # Test unauthorized access to messages
        response = self.make_request('GET', f'chat-groups/{fake_group_id}/messages', auth_required=True)
        
        if response is not None and response.status_code == 403:
            self.log_test("Unauthorized message access blocked", True, "Correctly blocked access to non-member group")
            auth_success = True
        else:
            status = response.status_code if response is not None else "No response"
            self.log_test("Unauthorized message access blocked", False, f"Expected 403, got {status}")
            auth_success = False
        
        # Test unauthorized message sending
        message_data = {
            "group_id": fake_group_id,
            "content": "This should not work",
            "message_type": "TEXT"
        }
        
        send_response = self.make_request('POST', f'chat-groups/{fake_group_id}/messages', message_data, auth_required=True)
        
        if send_response is not None and send_response.status_code == 403:
            self.log_test("Unauthorized message sending blocked", True, "Correctly blocked message sending to non-member group")
            send_success = True
        else:
            status = send_response.status_code if send_response is not None else "No response"
            self.log_test("Unauthorized message sending blocked", False, f"Expected 403, got {status}")
            send_success = False
        
        return auth_success and send_success

    def create_test_file(self, filename, content, content_type):
        """Create a test file for upload testing"""
        import tempfile
        import os
        
        # Create temporary file
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=filename)
        temp_file.write(content)
        temp_file.close()
        
        return temp_file.name, content_type

    def make_file_upload_request(self, endpoint, file_path, filename, content_type, auth_required=False):
        """Make file upload request"""
        url = f"{self.base_url}/{endpoint}"
        headers = {}
        
        if auth_required and self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        try:
            with open(file_path, 'rb') as f:
                files = {'file': (filename, f, content_type)}
                response = requests.post(url, files=files, headers=headers, timeout=30)
            
            print(f"   Request: POST {url} -> Status: {response.status_code}")
            
            if response.status_code == 422:
                try:
                    error_data = response.json()
                    print(f"   422 Error Details: {error_data}")
                except:
                    print(f"   422 Error Text: {response.text}")
            
            return response
        except requests.exceptions.RequestException as e:
            print(f"❌ Network error for POST {url}: {str(e)}")
            return None

    def test_media_upload_api(self):
        """Test media upload API with different file types"""
        print("\n🔍 Testing Media Upload API...")
        
        if not self.token:
            self.log_test("Media upload API", False, "No authentication token available")
            return False
        
        uploaded_files = []
        
        # Test 1: Upload PNG image
        png_content = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\tpHYs\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\nIDATx\x9cc\xf8\x00\x00\x00\x01\x00\x01\x00\x00\x00\x00IEND\xaeB`\x82'
        png_file, _ = self.create_test_file('.png', png_content, 'image/png')
        
        try:
            response = self.make_file_upload_request('media/upload', png_file, 'test_image.png', 'image/png', auth_required=True)
            
            if response and response.status_code == 200:
                data = response.json()
                png_success = (
                    'id' in data and
                    'original_filename' in data and
                    'file_type' in data and
                    'file_url' in data and
                    data['file_type'] == 'image'
                )
                self.log_test("Upload PNG image", png_success, f"File ID: {data.get('id')}, Type: {data.get('file_type')}")
                if png_success:
                    uploaded_files.append(data['id'])
            else:
                error_msg = f"Status: {response.status_code}" if response else "No response"
                self.log_test("Upload PNG image", False, error_msg)
                png_success = False
        finally:
            import os
            os.unlink(png_file)
        
        # Test 2: Upload JPG image
        jpg_content = b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.\' ",#\x1c\x1c(7),01444\x1f\'9=82<.342\xff\xc0\x00\x11\x08\x00\x01\x00\x01\x01\x01\x11\x00\x02\x11\x01\x03\x11\x01\xff\xc4\x00\x14\x00\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x08\xff\xc4\x00\x14\x10\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xff\xda\x00\x0c\x03\x01\x00\x02\x11\x03\x11\x00\x3f\x00\xaa\xff\xd9'
        jpg_file, _ = self.create_test_file('.jpg', jpg_content, 'image/jpeg')
        
        try:
            response = self.make_file_upload_request('media/upload', jpg_file, 'test_image.jpg', 'image/jpeg', auth_required=True)
            
            if response and response.status_code == 200:
                data = response.json()
                jpg_success = (
                    'id' in data and
                    data['file_type'] == 'image' and
                    data['original_filename'] == 'test_image.jpg'
                )
                self.log_test("Upload JPG image", jpg_success, f"File ID: {data.get('id')}")
                if jpg_success:
                    uploaded_files.append(data['id'])
            else:
                error_msg = f"Status: {response.status_code}" if response else "No response"
                self.log_test("Upload JPG image", False, error_msg)
                jpg_success = False
        finally:
            import os
            os.unlink(jpg_file)
        
        # Test 3: Upload PDF document
        pdf_content = b'%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n174\n%%EOF'
        pdf_file, _ = self.create_test_file('.pdf', pdf_content, 'application/pdf')
        
        try:
            response = self.make_file_upload_request('media/upload', pdf_file, 'test_document.pdf', 'application/pdf', auth_required=True)
            
            if response and response.status_code == 200:
                data = response.json()
                pdf_success = (
                    'id' in data and
                    data['file_type'] == 'document' and
                    data['original_filename'] == 'test_document.pdf'
                )
                self.log_test("Upload PDF document", pdf_success, f"File ID: {data.get('id')}")
                if pdf_success:
                    uploaded_files.append(data['id'])
            else:
                error_msg = f"Status: {response.status_code}" if response else "No response"
                self.log_test("Upload PDF document", False, error_msg)
                pdf_success = False
        finally:
            import os
            os.unlink(pdf_file)
        
        # Test 4: Test invalid file type
        txt_content = b'This is a text file that should not be allowed'
        txt_file, _ = self.create_test_file('.txt', txt_content, 'text/plain')
        
        try:
            response = self.make_file_upload_request('media/upload', txt_file, 'test.txt', 'text/plain', auth_required=True)
            
            if response and response.status_code == 400:
                invalid_success = True
                self.log_test("Reject invalid file type", True, "Correctly rejected .txt file")
            else:
                status = response.status_code if response else "No response"
                self.log_test("Reject invalid file type", False, f"Expected 400, got {status}")
                invalid_success = False
        finally:
            import os
            os.unlink(txt_file)
        
        # Store uploaded file IDs for later tests
        self.uploaded_file_ids = uploaded_files
        
        return png_success and jpg_success and pdf_success and invalid_success

    def test_media_serving_api(self):
        """Test media file serving API"""
        print("\n🔍 Testing Media Serving API...")
        
        if not self.token:
            self.log_test("Media serving API", False, "No authentication token available")
            return False
        
        if not hasattr(self, 'uploaded_file_ids') or not self.uploaded_file_ids:
            self.log_test("Media serving API", False, "No uploaded files available for testing")
            return False
        
        success_count = 0
        total_tests = len(self.uploaded_file_ids)
        
        for file_id in self.uploaded_file_ids:
            response = self.make_request('GET', f'media/{file_id}', auth_required=True)
            
            if response and response.status_code == 200:
                # Check if we got file content
                content_type = response.headers.get('content-type', '')
                content_length = len(response.content)
                
                file_success = content_length > 0 and (
                    content_type.startswith('image/') or 
                    content_type.startswith('application/')
                )
                
                if file_success:
                    success_count += 1
                    self.log_test(f"Serve media file {file_id[:8]}...", True, f"Content-Type: {content_type}, Size: {content_length} bytes")
                else:
                    self.log_test(f"Serve media file {file_id[:8]}...", False, f"Invalid content or headers")
            else:
                error_msg = f"Status: {response.status_code}" if response else "No response"
                self.log_test(f"Serve media file {file_id[:8]}...", False, error_msg)
        
        # Test non-existent file
        fake_file_id = str(uuid.uuid4())
        response = self.make_request('GET', f'media/{fake_file_id}', auth_required=True)
        
        if response and response.status_code == 404:
            self.log_test("Non-existent file returns 404", True, "Correctly returned 404 for non-existent file")
            success_count += 1
            total_tests += 1
        else:
            status = response.status_code if response else "No response"
            self.log_test("Non-existent file returns 404", False, f"Expected 404, got {status}")
            total_tests += 1
        
        return success_count == total_tests

    def test_youtube_url_detection(self):
        """Test YouTube URL detection in posts"""
        print("\n🔍 Testing YouTube URL Detection...")
        
        if not self.token:
            self.log_test("YouTube URL detection", False, "No authentication token available")
            return False
        
        # Test different YouTube URL formats
        test_cases = [
            {
                "content": "Check out this video: https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                "expected_urls": ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"]
            },
            {
                "content": "Short link: https://youtu.be/dQw4w9WgXcQ and embed: https://www.youtube.com/embed/dQw4w9WgXcQ",
                "expected_urls": ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"]  # Should deduplicate
            },
            {
                "content": "No YouTube links here, just regular text.",
                "expected_urls": []
            }
        ]
        
        success_count = 0
        
        for i, test_case in enumerate(test_cases):
            # Use form data for posts API
            import requests
            
            url = f"{self.base_url}/posts"
            headers = {'Authorization': f'Bearer {self.token}'}
            
            # Send as form data with proper structure
            form_data = {
                'content': test_case["content"]
            }
            
            try:
                response = requests.post(url, data=form_data, headers=headers, timeout=30)
                print(f"   Request: POST {url} -> Status: {response.status_code}")
                
                if response.status_code == 200:
                    data = response.json()
                    youtube_urls = data.get('youtube_urls', [])
                    
                    # Check if detected URLs match expected (allowing for duplicates to be removed)
                    expected_unique = list(set(test_case["expected_urls"]))
                    detected_unique = list(set(youtube_urls))
                    
                    urls_match = sorted(expected_unique) == sorted(detected_unique)
                    
                    if urls_match:
                        success_count += 1
                        self.log_test(f"YouTube URL detection test {i+1}", True, f"Detected: {len(youtube_urls)} URLs")
                    else:
                        self.log_test(f"YouTube URL detection test {i+1}", False, f"Expected: {expected_unique}, Got: {detected_unique}")
                else:
                    error_msg = f"Status: {response.status_code}"
                    if response.status_code == 422:
                        try:
                            error_data = response.json()
                            error_msg += f", Details: {error_data}"
                        except:
                            pass
                    self.log_test(f"YouTube URL detection test {i+1}", False, error_msg)
            except Exception as e:
                self.log_test(f"YouTube URL detection test {i+1}", False, f"Request failed: {str(e)}")
        
        return success_count == len(test_cases)

    def test_posts_with_media_api(self):
        """Test posts API with media file attachments"""
        print("\n🔍 Testing Posts API with Media Support...")
        
        if not self.token:
            self.log_test("Posts with media API", False, "No authentication token available")
            return False
        
        # Test 1: Create post without media using form data
        import requests
        
        url = f"{self.base_url}/posts"
        headers = {'Authorization': f'Bearer {self.token}'}
        
        form_data = {
            'content': 'This is a test post without media files.'
        }
        
        try:
            response = requests.post(url, data=form_data, headers=headers, timeout=30)
            print(f"   Request: POST {url} -> Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                no_media_success = (
                    'id' in data and
                    'content' in data and
                    'author' in data and
                    'media_files' in data and
                    len(data['media_files']) == 0
                )
                self.log_test("Create post without media", no_media_success, f"Post ID: {data.get('id')}")
            else:
                error_msg = f"Status: {response.status_code}"
                if response.status_code == 422:
                    try:
                        error_data = response.json()
                        error_msg += f", Details: {error_data}"
                    except:
                        pass
                self.log_test("Create post without media", False, error_msg)
                no_media_success = False
        except Exception as e:
            self.log_test("Create post without media", False, f"Request failed: {str(e)}")
            no_media_success = False
        
        # Test 2: Create post with media (if we have uploaded files)
        media_success = True
        if hasattr(self, 'uploaded_file_ids') and self.uploaded_file_ids:
            form_data = {
                'content': 'This post has media attachments!',
                'media_file_ids': self.uploaded_file_ids[:2]  # Use first 2 uploaded files
            }
            
            try:
                response = requests.post(url, data=form_data, headers=headers, timeout=30)
                print(f"   Request: POST {url} -> Status: {response.status_code}")
                
                if response.status_code == 200:
                    data = response.json()
                    media_success = (
                        'id' in data and
                        'media_files' in data and
                        len(data['media_files']) > 0
                    )
                    self.log_test("Create post with media", media_success, f"Post has {len(data.get('media_files', []))} media files")
                else:
                    error_msg = f"Status: {response.status_code}"
                    if response.status_code == 422:
                        try:
                            error_data = response.json()
                            error_msg += f", Details: {error_data}"
                        except:
                            pass
                    self.log_test("Create post with media", False, error_msg)
                    media_success = False
            except Exception as e:
                self.log_test("Create post with media", False, f"Request failed: {str(e)}")
                media_success = False
        else:
            self.log_test("Create post with media", False, "No uploaded files available")
            media_success = False
        
        # Test 3: Get posts feed
        response = self.make_request('GET', 'posts', auth_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            posts = data if isinstance(data, list) else []
            
            feed_success = len(posts) > 0
            
            if feed_success and posts:
                # Check post structure
                first_post = posts[0]
                feed_success = (
                    'id' in first_post and
                    'content' in first_post and
                    'author' in first_post and
                    'media_files' in first_post and
                    'youtube_urls' in first_post
                )
            
            self.log_test("Get posts feed", feed_success, f"Retrieved {len(posts)} posts")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("Get posts feed", False, error_msg)
            feed_success = False
        
        return no_media_success and media_success and feed_success

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
            
            # Phase 1: Universal Chat Foundation Tests
            print("\n🔥 PHASE 1: UNIVERSAL CHAT FOUNDATION TESTS")
            print("=" * 60)
            
            # Test auto family groups creation (should happen during registration)
            self.test_auto_family_groups_creation()
            
            # Test chat groups management API
            self.test_chat_groups_management()
            
            # Test chat messages API
            self.test_chat_messages_api()
            
            # Test scheduled actions API
            self.test_scheduled_actions_api()
            
            # Test authorization and security
            self.test_chat_authorization()
            
            # Phase 2: Media Upload Functionality Tests
            print("\n🔥 PHASE 2: MEDIA UPLOAD FUNCTIONALITY TESTS")
            print("=" * 60)
            
            # Test media upload API with different file types
            self.test_media_upload_api()
            
            # Test media serving API
            self.test_media_serving_api()
            
            # Test YouTube URL detection
            self.test_youtube_url_detection()
            
            # Test posts API with media support
            self.test_posts_with_media_api()
            
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