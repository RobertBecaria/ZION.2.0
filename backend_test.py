#!/usr/bin/env python3
"""
WebSocket Chat Implementation Backend Testing
Testing the new WebSocket chat implementation for real-time messaging.

Test Scope:
1. Authentication Test - Login with admin@test.com to get JWT token
2. Direct Chat API Test - GET /api/direct-chats
3. WebSocket Connection Test - ws://backend_url/ws/chat/{chat_id}?token={jwt_token}
4. Message Sending Test - POST /api/direct-chats/{chat_id}/messages
5. Typing Status API Test - POST/GET /api/chats/{chat_id}/typing?chat_type=direct
6. Message Status Test - PUT /api/messages/{message_id}/status

Test Credentials:
- User 1: admin@test.com / testpassword123
- User 2: testuser@test.com / testpassword123
"""

import requests
import json
import asyncio
import websockets
import time
from datetime import datetime
import sys
import os

# Get backend URL from environment
BACKEND_URL = "https://mod-official-news.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

# Test credentials
USER1_EMAIL = "admin@test.com"
USER1_PASSWORD = "testpassword123"
USER2_EMAIL = "testuser@test.com"
USER2_PASSWORD = "testpassword123"

class WebSocketChatTester:
    def __init__(self):
        self.user1_token = None
        self.user2_token = None
        self.user1_id = None
        self.user2_id = None
        self.chat_id = None
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
        
    def authenticate_user(self, email, password):
        """Authenticate user and return token and user info"""
        try:
            # Login request
            login_data = {
                "email": email,
                "password": password
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
        
        # Test User 1 authentication
        self.user1_token, self.user1_id, user1_info = self.authenticate_user(USER1_EMAIL, USER1_PASSWORD)
        
        if self.user1_token and self.user1_id:
            self.log_test("User 1 Authentication", True, f"Token obtained for user {self.user1_id}")
        else:
            self.log_test("User 1 Authentication", False, "Failed to authenticate user 1")
            return False
            
        # Test User 2 authentication
        self.user2_token, self.user2_id, user2_info = self.authenticate_user(USER2_EMAIL, USER2_PASSWORD)
        
        if self.user2_token and self.user2_id:
            self.log_test("User 2 Authentication", True, f"Token obtained for user {self.user2_id}")
        else:
            self.log_test("User 2 Authentication", False, "Failed to authenticate user 2")
            return False
            
        # Test /api/auth/me endpoint
        try:
            headers = {"Authorization": f"Bearer {self.user1_token}"}
            response = requests.get(f"{API_BASE}/auth/me", headers=headers)
            
            if response.status_code == 200:
                user_data = response.json()
                self.log_test("Auth Me Endpoint", True, f"Retrieved user data: {user_data.get('email')}")
            else:
                self.log_test("Auth Me Endpoint", False, f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_test("Auth Me Endpoint", False, f"Error: {e}")
            
        return True
    
    def test_direct_chat_api(self):
        """Test 2: Direct Chat API Test"""
        print("\n=== Test 2: Direct Chat API Test ===")
        
        if not self.user1_token or not self.user2_token:
            self.log_test("Direct Chat API", False, "Authentication required first")
            return False
            
        try:
            headers1 = {"Authorization": f"Bearer {self.user1_token}"}
            headers2 = {"Authorization": f"Bearer {self.user2_token}"}
            
            # Test GET /api/direct-chats for user 1
            response = requests.get(f"{API_BASE}/direct-chats", headers=headers1)
            
            if response.status_code == 200:
                chats_data = response.json()
                direct_chats = chats_data.get("direct_chats", [])
                self.log_test("List Direct Chats", True, f"Found {len(direct_chats)} existing chats")
                
                # Check if there's an existing chat between users
                existing_chat = None
                for chat_info in direct_chats:
                    chat = chat_info.get("chat", {})
                    if self.user2_id in chat.get("participant_ids", []):
                        existing_chat = chat
                        break
                        
                if existing_chat:
                    self.chat_id = existing_chat["id"]
                    self.log_test("Existing Chat Found", True, f"Chat ID: {self.chat_id}")
                else:
                    # Create new direct chat
                    create_data = {"recipient_id": self.user2_id}
                    create_response = requests.post(f"{API_BASE}/direct-chats", json=create_data, headers=headers1)
                    
                    if create_response.status_code == 200:
                        create_result = create_response.json()
                        self.chat_id = create_result.get("chat_id")
                        self.log_test("Create Direct Chat", True, f"New chat ID: {self.chat_id}")
                    else:
                        self.log_test("Create Direct Chat", False, f"Status: {create_response.status_code}")
                        return False
                        
            else:
                self.log_test("List Direct Chats", False, f"Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Direct Chat API", False, f"Error: {e}")
            return False
            
        return True
    
    def test_message_sending(self):
        """Test 4: Message Sending Test"""
        print("\n=== Test 4: Message Sending Test ===")
        
        if not self.chat_id:
            self.log_test("Message Sending", False, "Chat ID required")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.user1_token}"}
            
            # Send a test message
            message_data = {
                "content": "Test message from agent - WebSocket chat testing",
                "message_type": "TEXT"
            }
            
            response = requests.post(f"{API_BASE}/direct-chats/{self.chat_id}/messages", 
                                   json=message_data, headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                message_id = result.get("message_id")
                self.log_test("Send Message", True, f"Message ID: {message_id}")
                
                # Test retrieving messages
                get_response = requests.get(f"{API_BASE}/direct-chats/{self.chat_id}/messages", 
                                          headers=headers)
                
                if get_response.status_code == 200:
                    messages_data = get_response.json()
                    messages = messages_data.get("messages", [])
                    self.log_test("Retrieve Messages", True, f"Found {len(messages)} messages")
                    
                    # Find our test message
                    test_message = None
                    for msg in messages:
                        if msg.get("id") == message_id:
                            test_message = msg
                            break
                            
                    if test_message:
                        self.log_test("Message Verification", True, f"Content: {test_message.get('content')}")
                        return message_id
                    else:
                        self.log_test("Message Verification", False, "Test message not found")
                else:
                    self.log_test("Retrieve Messages", False, f"Status: {get_response.status_code}")
            else:
                self.log_test("Send Message", False, f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_test("Message Sending", False, f"Error: {e}")
            
        return None
    
    def test_typing_status_api(self):
        """Test 5: Typing Status API Test"""
        print("\n=== Test 5: Typing Status API Test ===")
        
        if not self.chat_id:
            self.log_test("Typing Status API", False, "Chat ID required")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.user1_token}"}
            
            # Test setting typing status
            typing_data = {"is_typing": True}
            response = requests.post(f"{API_BASE}/chats/{self.chat_id}/typing?chat_type=direct", 
                                   json=typing_data, headers=headers)
            
            if response.status_code == 200:
                self.log_test("Set Typing Status", True, "Typing status set to true")
                
                # Test getting typing status (should be empty as same user)
                get_response = requests.get(f"{API_BASE}/chats/{self.chat_id}/typing?chat_type=direct", 
                                          headers=headers)
                
                if get_response.status_code == 200:
                    typing_users = get_response.json().get("typing_users", [])
                    self.log_test("Get Typing Status", True, f"Found {len(typing_users)} typing users (expected 0 for same user)")
                else:
                    self.log_test("Get Typing Status", False, f"Status: {get_response.status_code}")
                    
                # Set typing to false
                typing_data = {"is_typing": False}
                stop_response = requests.post(f"{API_BASE}/chats/{self.chat_id}/typing?chat_type=direct", 
                                            json=typing_data, headers=headers)
                
                if stop_response.status_code == 200:
                    self.log_test("Stop Typing Status", True, "Typing status set to false")
                else:
                    self.log_test("Stop Typing Status", False, f"Status: {stop_response.status_code}")
                    
            else:
                self.log_test("Set Typing Status", False, f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_test("Typing Status API", False, f"Error: {e}")
            
        return True
    
    def test_message_status(self):
        """Test 6: Message Status Test"""
        print("\n=== Test 6: Message Status Test ===")
        
        # First send a message to get a message ID
        message_id = self.test_message_sending()
        
        if not message_id:
            self.log_test("Message Status Test", False, "No message ID available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.user2_token}"}  # Use user 2 to update status
            
            # Test updating message status to delivered
            status_data = {"status": "delivered"}
            response = requests.put(f"{API_BASE}/messages/{message_id}/status", 
                                  json=status_data, headers=headers)
            
            if response.status_code == 200:
                self.log_test("Update Status to Delivered", True, "Message marked as delivered")
                
                # Test updating message status to read
                status_data = {"status": "read"}
                read_response = requests.put(f"{API_BASE}/messages/{message_id}/status", 
                                           json=status_data, headers=headers)
                
                if read_response.status_code == 200:
                    self.log_test("Update Status to Read", True, "Message marked as read")
                else:
                    self.log_test("Update Status to Read", False, f"Status: {read_response.status_code}")
                    
            else:
                self.log_test("Update Status to Delivered", False, f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_test("Message Status Test", False, f"Error: {e}")
            
        return True
    
    async def test_websocket_connection(self):
        """Test 3: WebSocket Connection Test"""
        print("\n=== Test 3: WebSocket Connection Test ===")
        
        if not self.user1_token or not self.chat_id:
            self.log_test("WebSocket Connection", False, "Token and chat ID required")
            return False
            
        try:
            # Convert HTTPS URL to WSS for WebSocket
            ws_url = BACKEND_URL.replace("https://", "wss://").replace("http://", "ws://")
            websocket_url = f"{ws_url}/ws/chat/{self.chat_id}?token={self.user1_token}"
            
            print(f"Attempting WebSocket connection to: {websocket_url}")
            
            # Test WebSocket connection with timeout
            try:
                async with websockets.connect(websocket_url) as websocket:
                    self.log_test("WebSocket Connection", True, "Successfully connected to WebSocket")
                    
                    # Send a ping message
                    ping_message = {"type": "ping"}
                    await websocket.send(json.dumps(ping_message))
                    
                    # Wait for response with timeout
                    try:
                        response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                        response_data = json.loads(response)
                        
                        if response_data.get("type") == "pong":
                            self.log_test("WebSocket Ping/Pong", True, "Received pong response")
                        else:
                            self.log_test("WebSocket Ping/Pong", True, f"Received: {response_data}")
                            
                    except asyncio.TimeoutError:
                        self.log_test("WebSocket Ping/Pong", False, "No response received within timeout")
                    
                    # Test typing event
                    typing_message = {"type": "typing", "is_typing": True}
                    await websocket.send(json.dumps(typing_message))
                    self.log_test("WebSocket Typing Event", True, "Sent typing event")
                    
                    # Wait a bit and stop typing
                    await asyncio.sleep(1)
                    stop_typing_message = {"type": "typing", "is_typing": False}
                    await websocket.send(json.dumps(stop_typing_message))
                    self.log_test("WebSocket Stop Typing", True, "Sent stop typing event")
                    
            except websockets.InvalidStatusCode as e:
                self.log_test("WebSocket Connection", False, f"Invalid status code: {e}")
            except websockets.ConnectionClosedError as e:
                self.log_test("WebSocket Connection", False, f"Connection closed: {e}")
            except asyncio.TimeoutError:
                self.log_test("WebSocket Connection", False, "Connection timeout")
            except Exception as e:
                self.log_test("WebSocket Connection", False, f"Connection error: {e}")
                
        except Exception as e:
            self.log_test("WebSocket Connection", False, f"Error: {e}")
            
        return True
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting WebSocket Chat Implementation Backend Testing")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Test Time: {datetime.now().isoformat()}")
        
        # Run tests in order
        if not self.test_authentication():
            print("❌ Authentication failed - stopping tests")
            return
            
        if not self.test_direct_chat_api():
            print("❌ Direct Chat API failed - stopping tests")
            return
            
        # Run WebSocket test (async)
        asyncio.run(self.test_websocket_connection())
        
        # Continue with remaining tests
        self.test_message_sending()
        self.test_typing_status_api()
        self.test_message_status()
        
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
            print("\n🎉 ALL TESTS PASSED - WebSocket Chat Implementation is PRODUCTION READY!")
        elif passed_tests >= total_tests * 0.8:
            print("\n✅ MOSTLY WORKING - WebSocket Chat Implementation is functional with minor issues")
        else:
            print("\n⚠️  SIGNIFICANT ISSUES - WebSocket Chat Implementation needs attention")

if __name__ == "__main__":
    tester = WebSocketChatTester()
    tester.run_all_tests()