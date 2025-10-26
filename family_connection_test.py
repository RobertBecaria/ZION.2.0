#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class FamilyConnectionTester:
    def __init__(self, base_url="https://org-posts-fixed.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        
        # Test with the specific user mentioned in the review request
        self.test_user_email = "30new18@gmail.com"
        self.test_user_password = "password123"

    def make_request(self, method, endpoint, data=None, auth_required=False):
        """Make HTTP request to API"""
        url = f"{self.base_url}/{endpoint}"
        headers = {}
        
        if auth_required and self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        if not data:
            headers['Content-Type'] = 'application/json'
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            
            print(f"   Request: {method} {url} -> Status: {response.status_code}")
            
            if response.status_code >= 400:
                try:
                    error_data = response.json()
                    print(f"   Error Details: {error_data}")
                except:
                    print(f"   Error Text: {response.text}")
            
            return response
        except requests.exceptions.RequestException as e:
            print(f"❌ Network error for {method} {url}: {str(e)}")
            return None

    def test_user_login(self):
        """Test login with the specific user"""
        print("🔍 Testing User Login...")
        
        login_data = {
            "email": self.test_user_email,
            "password": self.test_user_password
        }
        
        response = self.make_request('POST', 'auth/login', login_data)
        
        if response and response.status_code == 200:
            data = response.json()
            if 'access_token' in data and 'user' in data:
                self.token = data['access_token']
                self.user_id = data['user']['id']
                print(f"✅ Login successful - User ID: {self.user_id}")
                return True
        
        print("❌ Login failed")
        return False

    def test_family_profiles(self):
        """Test family profiles for the user"""
        print("\n🔍 Testing Family Profiles...")
        
        response = self.make_request('GET', 'family-profiles', auth_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            family_profiles = data.get('family_profiles', [])
            print(f"✅ User has {len(family_profiles)} family profiles")
            
            for i, profile in enumerate(family_profiles):
                print(f"   {i+1}. {profile.get('family_name')} (ID: {profile.get('id')})")
                print(f"      Role: {profile.get('user_role')}")
                print(f"      Member: {profile.get('is_user_member')}")
            
            return len(family_profiles) > 0
        else:
            print("❌ Could not get family profiles")
            return False

    def test_chat_groups(self):
        """Test chat groups for the user"""
        print("\n🔍 Testing Chat Groups...")
        
        response = self.make_request('GET', 'chat-groups', auth_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            chat_groups = data.get('chat_groups', [])
            print(f"✅ User has {len(chat_groups)} chat groups")
            
            for i, group_data in enumerate(chat_groups):
                group = group_data.get('group', {})
                print(f"   {i+1}. {group.get('name')} (Type: {group.get('group_type')})")
                print(f"      ID: {group.get('id')}")
                print(f"      Admin: {group.get('admin_id')}")
                print(f"      User Role: {group_data.get('user_role')}")
            
            return len(chat_groups) > 0
        else:
            print("❌ Could not get chat groups")
            return False

    def run_investigation(self):
        """Run family connection investigation"""
        print("🔍 INVESTIGATING FAMILY CONNECTION ISSUE")
        print("=" * 50)
        print(f"👤 Testing with user: {self.test_user_email}")
        print("=" * 50)
        
        if not self.test_user_login():
            return False
        
        has_family_profiles = self.test_family_profiles()
        has_chat_groups = self.test_chat_groups()
        
        print("\n" + "=" * 50)
        print("🔍 FAMILY CONNECTION ANALYSIS")
        print("=" * 50)
        
        if not has_family_profiles and not has_chat_groups:
            print("❌ CRITICAL ISSUE FOUND:")
            print("   User has NO family profiles and NO chat groups!")
            print("   This explains why family posts don't appear in the feed.")
            print("   The get_user_family_connections() function returns empty list.")
            print("   Posts are filtered by connected users, so no posts show up.")
            print("\n💡 SOLUTION:")
            print("   1. User needs to create a family profile, OR")
            print("   2. User needs to be added to existing family groups, OR") 
            print("   3. The posts API should include user's own posts even without family connections")
        elif not has_family_profiles:
            print("⚠️  PARTIAL ISSUE:")
            print("   User has chat groups but no family profiles.")
            print("   This might still cause issues with family post filtering.")
        else:
            print("✅ User has proper family connections.")
            print("   The issue might be elsewhere in the post creation flow.")
        
        return True

if __name__ == "__main__":
    tester = FamilyConnectionTester()
    tester.run_investigation()