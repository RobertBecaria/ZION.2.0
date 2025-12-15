#!/usr/bin/env python3

import requests
import sys
from datetime import datetime

class FinalVerificationTest:
    def __init__(self, base_url="https://mod-official-news.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        
        # Test with the specific user mentioned in the review request
        self.test_user_email = "30new18@gmail.com"
        self.test_user_password = "password123"

    def make_request(self, method, endpoint, data=None, auth_required=False, form_data=None):
        """Make HTTP request to API"""
        url = f"{self.base_url}/{endpoint}"
        headers = {}
        
        if auth_required and self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        if not form_data:
            headers['Content-Type'] = 'application/json'
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                if form_data:
                    response = requests.post(url, data=form_data, headers=headers, timeout=30)
                else:
                    response = requests.post(url, json=data, headers=headers, timeout=30)
            
            return response
        except requests.exceptions.RequestException as e:
            print(f"❌ Network error: {str(e)}")
            return None

    def test_login(self):
        """Test login"""
        login_data = {
            "email": self.test_user_email,
            "password": self.test_user_password
        }
        
        response = self.make_request('POST', 'auth/login', login_data)
        
        if response and response.status_code == 200:
            data = response.json()
            self.token = data['access_token']
            print("✅ Login successful")
            return True
        
        print("❌ Login failed")
        return False

    def test_post_creation_and_visibility(self):
        """Test the complete post creation and visibility workflow"""
        print("\n🔍 Testing Complete Post Creation Workflow...")
        
        # Create a unique test post
        test_content = f"🎉 FINAL VERIFICATION: Post creation fix working! Created at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        
        form_data = {
            'content': test_content,
            'source_module': 'family',
            'target_audience': 'module'
        }
        
        # Step 1: Create the post
        print("   Step 1: Creating post...")
        response = self.make_request('POST', 'posts', auth_required=True, form_data=form_data)
        
        if not (response and response.status_code == 200):
            print("   ❌ Post creation failed")
            return False
        
        data = response.json()
        post_id = data.get('id')
        print(f"   ✅ Post created successfully (ID: {post_id})")
        
        # Step 2: Verify post appears in family feed
        print("   Step 2: Checking if post appears in family feed...")
        response = self.make_request('GET', 'posts?module=family', auth_required=True)
        
        if not (response and response.status_code == 200):
            print("   ❌ Could not retrieve family feed")
            return False
        
        posts = response.json()
        
        # Look for our post
        found_post = None
        for post in posts:
            if post.get('content') == test_content:
                found_post = post
                break
        
        if found_post:
            print(f"   ✅ Post found in family feed!")
            print(f"   📝 Content: {found_post.get('content')[:50]}...")
            print(f"   👤 Author: {found_post.get('author', {}).get('first_name')} {found_post.get('author', {}).get('last_name')}")
            return True
        else:
            print("   ❌ Post not found in family feed")
            print(f"   📊 Total posts in feed: {len(posts)}")
            return False

    def run_final_verification(self):
        """Run final verification test"""
        print("🔍 FINAL VERIFICATION TEST")
        print("=" * 40)
        print(f"👤 Testing with user: {self.test_user_email}")
        print("🎯 Verifying post creation fix is working")
        print("=" * 40)
        
        if not self.test_login():
            return False
        
        success = self.test_post_creation_and_visibility()
        
        print("\n" + "=" * 40)
        if success:
            print("🎉 FINAL VERIFICATION: SUCCESS!")
            print("✅ Post creation functionality is working correctly")
            print("✅ User can create posts and see them in the feed")
            print("✅ The reported issue has been resolved")
        else:
            print("❌ FINAL VERIFICATION: FAILED!")
            print("❌ Post creation issue still exists")
        
        print("=" * 40)
        return success

if __name__ == "__main__":
    tester = FinalVerificationTest()
    success = tester.run_final_verification()
    sys.exit(0 if success else 1)