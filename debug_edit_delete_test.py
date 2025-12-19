#!/usr/bin/env python3
"""
Debug Edit and Delete Message Features
Detailed testing to understand why edit and delete are not working correctly.
"""

import requests
import json
import time
from datetime import datetime

# Get backend URL from environment
BACKEND_URL = "https://altyn-finance.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

# Test credentials and data
USER_EMAIL = "admin@test.com"
USER_PASSWORD = "testpassword123"
EXISTING_CHAT_ID = "ee009e25-edc0-4da6-8848-f108993abc5f"

def authenticate_user():
    """Authenticate user and return token and user info"""
    try:
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

def create_test_message(token):
    """Create a test message and return its ID"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        
        message_data = {
            "content": "DEBUG TEST MESSAGE - " + datetime.now().isoformat(),
            "message_type": "TEXT"
        }
        
        response = requests.post(f"{API_BASE}/direct-chats/{EXISTING_CHAT_ID}/messages", 
                               json=message_data, headers=headers)
        
        print(f"Create message response status: {response.status_code}")
        print(f"Create message response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            message_id = result.get("message_id")
            print(f"✅ Created test message with ID: {message_id}")
            return message_id
        else:
            print(f"❌ Failed to create test message")
            return None
            
    except Exception as e:
        print(f"Error creating test message: {e}")
        return None

def get_message_details(token, message_id):
    """Get message details to verify current state"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get all messages and find our specific message
        response = requests.get(f"{API_BASE}/direct-chats/{EXISTING_CHAT_ID}/messages", headers=headers)
        
        if response.status_code == 200:
            messages_data = response.json()
            messages = messages_data.get("messages", [])
            
            for message in messages:
                if message.get("id") == message_id:
                    print(f"📋 Message details:")
                    print(f"   ID: {message.get('id')}")
                    print(f"   Content: {message.get('content')}")
                    print(f"   is_edited: {message.get('is_edited')}")
                    print(f"   is_deleted: {message.get('is_deleted')}")
                    print(f"   created_at: {message.get('created_at')}")
                    print(f"   updated_at: {message.get('updated_at')}")
                    return message
            
            print(f"❌ Message {message_id} not found in chat messages")
            return None
        else:
            print(f"❌ Failed to get messages: {response.status_code}")
            return None
            
    except Exception as e:
        print(f"Error getting message details: {e}")
        return None

def test_edit_message_debug(token, message_id):
    """Test editing a message with detailed debugging"""
    print(f"\n=== DEBUG: Testing Edit Message ===")
    
    # Get message details before edit
    print("Before edit:")
    before_message = get_message_details(token, message_id)
    
    if not before_message:
        print("❌ Cannot proceed without message details")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        
        edit_data = {"content": "EDITED CONTENT - " + datetime.now().isoformat()}
        
        print(f"Sending edit request to: {API_BASE}/messages/{message_id}")
        print(f"Edit data: {edit_data}")
        
        response = requests.put(f"{API_BASE}/messages/{message_id}", 
                              json=edit_data, headers=headers)
        
        print(f"Edit response status: {response.status_code}")
        print(f"Edit response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Edit API returned success")
            print(f"Response data: {json.dumps(result, indent=2)}")
            
            # Wait a moment for database update
            time.sleep(1)
            
            # Get message details after edit
            print("\nAfter edit:")
            after_message = get_message_details(token, message_id)
            
            if after_message:
                if after_message.get("is_edited") == True:
                    print("✅ is_edited flag is correctly set to True")
                else:
                    print(f"❌ is_edited flag is {after_message.get('is_edited')}, expected True")
                
                if "EDITED CONTENT" in after_message.get("content", ""):
                    print("✅ Content was updated correctly")
                else:
                    print(f"❌ Content was not updated. Current: {after_message.get('content')}")
            
            return True
        else:
            print(f"❌ Edit failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"Error testing edit: {e}")
        return False

def test_delete_message_debug(token, message_id):
    """Test deleting a message with detailed debugging"""
    print(f"\n=== DEBUG: Testing Delete Message ===")
    
    # Get message details before delete
    print("Before delete:")
    before_message = get_message_details(token, message_id)
    
    if not before_message:
        print("❌ Cannot proceed without message details")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        
        print(f"Sending delete request to: {API_BASE}/messages/{message_id}")
        
        response = requests.delete(f"{API_BASE}/messages/{message_id}", headers=headers)
        
        print(f"Delete response status: {response.status_code}")
        print(f"Delete response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Delete API returned success")
            print(f"Response: {result}")
            
            # Wait a moment for database update
            time.sleep(1)
            
            # Get message details after delete
            print("\nAfter delete:")
            after_message = get_message_details(token, message_id)
            
            if after_message:
                if after_message.get("is_deleted") == True:
                    print("✅ is_deleted flag is correctly set to True")
                else:
                    print(f"❌ is_deleted flag is {after_message.get('is_deleted')}, expected True")
                
                content = after_message.get("content", "")
                if content == "" or content is None:
                    print("✅ Content was cleared correctly")
                else:
                    print(f"❌ Content was not cleared. Current: '{content}'")
            else:
                print("❌ Message not found after delete (this might be expected if filtered out)")
            
            return True
        else:
            print(f"❌ Delete failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"Error testing delete: {e}")
        return False

def main():
    print("🔍 Starting Debug Test for Edit and Delete Message Features")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test Time: {datetime.now().isoformat()}")
    
    # Authenticate
    token, user_id, user_info = authenticate_user()
    
    if not token:
        print("❌ Authentication failed")
        return
    
    print(f"✅ Authenticated as user {user_id}")
    
    # Test Edit Message
    print("\n" + "="*50)
    print("TESTING EDIT MESSAGE")
    print("="*50)
    
    edit_message_id = create_test_message(token)
    if edit_message_id:
        test_edit_message_debug(token, edit_message_id)
    
    # Test Delete Message
    print("\n" + "="*50)
    print("TESTING DELETE MESSAGE")
    print("="*50)
    
    delete_message_id = create_test_message(token)
    if delete_message_id:
        test_delete_message_debug(token, delete_message_id)

if __name__ == "__main__":
    main()