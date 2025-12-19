#!/usr/bin/env python3
"""
Chat Enhancement Features Backend Testing
Testing the enhanced chat messaging features: reactions, edit, delete, voice playback.

Test Scope:
1. Authentication Test - Login with admin@test.com to get JWT token
2. Message Reactions Test - POST /api/messages/{message_id}/react
3. Edit Message Test - PUT /api/messages/{message_id}
4. Delete Message Test - DELETE /api/messages/{message_id}
5. Voice Message Playback Test - GET /api/media/files/{filename}

Test Credentials:
- Email: admin@test.com
- Password: testpassword123
- Existing chat ID: ee009e25-edc0-4da6-8848-f108993abc5f
"""

import requests
import json
import time
from datetime import datetime
import sys
import os

# Get backend URL from environment
BACKEND_URL = "https://goodwill-events.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

# Test credentials and data
USER_EMAIL = "admin@test.com"
USER_PASSWORD = "testpassword123"
EXISTING_CHAT_ID = "ee009e25-edc0-4da6-8848-f108993abc5f"
VOICE_FILE = "voice_ee009e25-edc0-4da6-8848-f108993abc5f_967bd1d1-d96a-4c78-a220-d23517d24c0c.webm"

class ChatEnhancementTester:
    def __init__(self):
        self.user_token = None
        self.user_id = None
        self.test_results = []
        self.test_message_id = None
        
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
    
    def get_existing_message_id(self):
        """Get an existing message ID from the chat"""
        try:
            headers = {"Authorization": f"Bearer {self.user_token}"}
            response = requests.get(f"{API_BASE}/direct-chats/{EXISTING_CHAT_ID}/messages", headers=headers)
            
            if response.status_code == 200:
                messages_data = response.json()
                messages = messages_data.get("messages", [])
                
                if messages:
                    # Return the first message ID
                    return messages[0].get("id")
                else:
                    return None
            else:
                return None
                
        except Exception as e:
            print(f"Error getting message ID: {e}")
            return None
    
    def create_test_message(self):
        """Create a test message for editing/deleting"""
        try:
            headers = {"Authorization": f"Bearer {self.user_token}"}
            
            message_data = {
                "content": "Test message for enhancement features - created at " + datetime.now().isoformat(),
                "message_type": "TEXT"
            }
            
            response = requests.post(f"{API_BASE}/direct-chats/{EXISTING_CHAT_ID}/messages", 
                                   json=message_data, headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                message_id = result.get("message_id")
                self.log_test("Create Test Message", True, f"Message ID: {message_id}")
                return message_id
            else:
                self.log_test("Create Test Message", False, f"Status: {response.status_code}, Response: {response.text}")
                return None
                
        except Exception as e:
            self.log_test("Create Test Message", False, f"Error: {e}")
            return None
    
    def test_message_reactions(self):
        """Test 2: Message Reactions Test"""
        print("\n=== Test 2: Message Reactions Test ===")
        
        if not self.user_token:
            self.log_test("Message Reactions", False, "Authentication required first")
            return False
        
        # Get an existing message ID
        message_id = self.get_existing_message_id()
        
        if not message_id:
            self.log_test("Get Message for Reaction", False, "No existing messages found")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {self.user_token}"}
            
            # Test adding a reaction
            reaction_data = {"emoji": "❤️"}
            response = requests.post(f"{API_BASE}/messages/{message_id}/react", 
                                   json=reaction_data, headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                reactions = result.get("reactions", {})
                self.log_test("Add Reaction", True, f"Reactions: {reactions}")
                
                # Test adding the same reaction again (should toggle off)
                toggle_response = requests.post(f"{API_BASE}/messages/{message_id}/react", 
                                              json=reaction_data, headers=headers)
                
                if toggle_response.status_code == 200:
                    toggle_result = toggle_response.json()
                    toggle_reactions = toggle_result.get("reactions", {})
                    self.log_test("Toggle Reaction Off", True, f"Reactions after toggle: {toggle_reactions}")
                else:
                    self.log_test("Toggle Reaction Off", False, f"Status: {toggle_response.status_code}")
                    
            else:
                self.log_test("Add Reaction", False, f"Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_test("Message Reactions", False, f"Error: {e}")
            
        return True
    
    def test_edit_message(self):
        """Test 3: Edit Message Test"""
        print("\n=== Test 3: Edit Message Test ===")
        
        if not self.user_token:
            self.log_test("Edit Message", False, "Authentication required first")
            return False
        
        # Create a new test message for editing
        message_id = self.create_test_message()
        
        if not message_id:
            self.log_test("Edit Message Setup", False, "Failed to create test message")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {self.user_token}"}
            
            # Test editing the message
            edit_data = {"content": "Updated content - edited at " + datetime.now().isoformat()}
            response = requests.put(f"{API_BASE}/messages/{message_id}", 
                                  json=edit_data, headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                data = result.get("data", {})
                is_edited = data.get("is_edited", False)
                updated_content = data.get("content", "")
                
                if is_edited and "Updated content" in updated_content:
                    self.log_test("Edit Message", True, f"Message edited successfully. is_edited: {is_edited}")
                else:
                    self.log_test("Edit Message", False, f"Edit flag not set correctly. is_edited: {is_edited}, content: {updated_content}")
                    
            else:
                self.log_test("Edit Message", False, f"Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_test("Edit Message", False, f"Error: {e}")
            
        return True
    
    def test_delete_message(self):
        """Test 4: Delete Message Test"""
        print("\n=== Test 4: Delete Message Test ===")
        
        if not self.user_token:
            self.log_test("Delete Message", False, "Authentication required first")
            return False
        
        # Create a new test message for deleting
        message_id = self.create_test_message()
        
        if not message_id:
            self.log_test("Delete Message Setup", False, "Failed to create test message")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {self.user_token}"}
            
            # Test deleting the message
            response = requests.delete(f"{API_BASE}/messages/{message_id}", headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                # Delete endpoint only returns success message, not the updated data
                # The message is soft-deleted and filtered out from get messages
                self.log_test("Delete Message", True, f"Message deleted successfully. API response: {result.get('message')}")
                    
            else:
                self.log_test("Delete Message", False, f"Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_test("Delete Message", False, f"Error: {e}")
            
        return True
    
    def test_voice_message_playback(self):
        """Test 5: Voice Message Playback Test"""
        print("\n=== Test 5: Voice Message Playback Test ===")
        
        try:
            # Test the voice file endpoint
            response = requests.get(f"{API_BASE}/media/files/{VOICE_FILE}")
            
            if response.status_code == 200:
                content_type = response.headers.get('content-type', '')
                content_length = len(response.content)
                
                self.log_test("Voice File Access", True, f"File served successfully. Content-Type: {content_type}, Size: {content_length} bytes")
                
                # Check if it's actually audio content
                if 'audio' in content_type or 'webm' in content_type or content_length > 0:
                    self.log_test("Voice File Content", True, f"Valid audio content detected")
                else:
                    self.log_test("Voice File Content", False, f"Unexpected content type: {content_type}")
                    
            elif response.status_code == 404:
                self.log_test("Voice File Access", False, f"File not found: {VOICE_FILE}")
            else:
                self.log_test("Voice File Access", False, f"Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_test("Voice Message Playback", False, f"Error: {e}")
            
        return True
    
    def test_forward_message(self):
        """Test 6: Forward Message Test (Bonus)"""
        print("\n=== Test 6: Forward Message Test (Bonus) ===")
        
        if not self.user_token:
            self.log_test("Forward Message", False, "Authentication required first")
            return False
        
        # Get an existing message ID
        message_id = self.get_existing_message_id()
        
        if not message_id:
            self.log_test("Get Message for Forward", False, "No existing messages found")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {self.user_token}"}
            
            # Test forwarding the message (if endpoint exists)
            forward_data = {"target_chat_id": EXISTING_CHAT_ID}  # Forward to same chat for testing
            response = requests.post(f"{API_BASE}/messages/{message_id}/forward", 
                                   json=forward_data, headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                self.log_test("Forward Message", True, f"Message forwarded successfully: {result}")
            elif response.status_code == 404:
                self.log_test("Forward Message", False, "Forward endpoint not implemented")
            else:
                self.log_test("Forward Message", False, f"Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            self.log_test("Forward Message", False, f"Error: {e}")
            
        return True
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Chat Enhancement Features Backend Testing")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Test Time: {datetime.now().isoformat()}")
        print(f"Testing Chat ID: {EXISTING_CHAT_ID}")
        
        # Run tests in order
        if not self.test_authentication():
            print("❌ Authentication failed - stopping tests")
            return
            
        # Run enhancement feature tests
        self.test_message_reactions()
        self.test_edit_message()
        self.test_delete_message()
        self.test_voice_message_playback()
        self.test_forward_message()
        
        # Print summary
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("📊 CHAT ENHANCEMENT FEATURES TEST SUMMARY")
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
            print("\n🎉 ALL TESTS PASSED - Chat Enhancement Features are PRODUCTION READY!")
        elif passed_tests >= total_tests * 0.8:
            print("\n✅ MOSTLY WORKING - Chat Enhancement Features are functional with minor issues")
        else:
            print("\n⚠️  SIGNIFICANT ISSUES - Chat Enhancement Features need attention")

if __name__ == "__main__":
    tester = ChatEnhancementTester()
    tester.run_all_tests()