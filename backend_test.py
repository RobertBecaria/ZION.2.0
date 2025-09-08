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
        self.custom_group_id = None
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
                    error_msg = error_data.get('detail', f'Status: {response.status_code}')
                    if response.status_code == 422:
                        # Handle validation errors
                        if 'detail' in error_data and isinstance(error_data['detail'], list):
                            validation_errors = []
                            for error in error_data['detail']:
                                field = error.get('loc', ['unknown'])[-1]
                                msg = error.get('msg', 'validation error')
                                validation_errors.append(f"{field}: {msg}")
                            error_msg = f"Validation errors: {', '.join(validation_errors)}"
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
        
        if response and response.status_code == 403:
            auth_success = True
            self.log_test("Unauthorized message access blocked", auth_success, "Correctly blocked access to non-member group")
        else:
            auth_success = False
            expected_status = 403
            actual_status = response.status_code if response else "No response"
            self.log_test("Unauthorized message access blocked", auth_success, f"Expected {expected_status}, got {actual_status}")
        
        # Test unauthorized message sending
        message_data = {
            "group_id": fake_group_id,
            "content": "This should not work",
            "message_type": "TEXT"
        }
        
        send_response = self.make_request('POST', f'chat-groups/{fake_group_id}/messages', message_data, auth_required=True)
        
        if send_response and send_response.status_code == 403:
            send_success = True
            self.log_test("Unauthorized message sending blocked", send_success, "Correctly blocked message sending to non-member group")
        else:
            send_success = False
            expected_status = 403
            actual_status = send_response.status_code if send_response else "No response"
            self.log_test("Unauthorized message sending blocked", send_success, f"Expected {expected_status}, got {actual_status}")
        
        return auth_success and send_success

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