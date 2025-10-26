#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
import uuid

class PostCreationTester:
    def __init__(self, base_url="https://orgrole-manager.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        
        # Test with the specific user mentioned in the review request
        self.test_user_email = "30new18@gmail.com"
        self.test_user_password = "password123"  # From investigation results in test_result.md

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

    def make_request(self, method, endpoint, data=None, auth_required=False, files=None, form_data=None):
        """Make HTTP request to API"""
        url = f"{self.base_url}/{endpoint}"
        headers = {}
        
        if auth_required and self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        # Only set Content-Type for JSON requests
        if not files and not form_data:
            headers['Content-Type'] = 'application/json'
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files, headers=headers, timeout=30)
                elif form_data:
                    response = requests.post(url, data=form_data, headers=headers, timeout=30)
                else:
                    response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)
            
            print(f"   Request: {method} {url} -> Status: {response.status_code}")
            
            # Print response details for debugging errors
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
        """Test login with the specific user from the review request"""
        print("\n🔍 Testing User Login (30new18@gmail.com)...")
        
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
                success = (
                    data['user']['email'] == self.test_user_email and
                    'affiliations' in data['user']
                )
                self.log_test("User login", success, f"User ID: {self.user_id}, Token received")
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

    def test_get_existing_posts(self):
        """Test getting existing posts to see current state"""
        print("\n🔍 Testing Get Existing Posts...")
        
        if not self.token:
            self.log_test("Get existing posts", False, "No authentication token available")
            return False
        
        # Test different modules
        modules = ["family", "news", "organizations", "journal", "services"]
        
        for module in modules:
            response = self.make_request('GET', f'posts?module={module}', auth_required=True)
            
            if response and response.status_code == 200:
                posts = response.json()
                post_count = len(posts) if isinstance(posts, list) else 0
                self.log_test(f"Get {module} posts", True, f"Found {post_count} posts")
                
                # Print some details about the posts
                if post_count > 0:
                    print(f"   Recent posts in {module}:")
                    for i, post in enumerate(posts[:3]):  # Show first 3 posts
                        author = post.get('author', {})
                        content_preview = post.get('content', '')[:50] + "..." if len(post.get('content', '')) > 50 else post.get('content', '')
                        print(f"     {i+1}. {author.get('first_name', 'Unknown')} {author.get('last_name', '')}: {content_preview}")
            else:
                error_msg = f"Status: {response.status_code}" if response else "No response"
                self.log_test(f"Get {module} posts", False, error_msg)
        
        return True

    def test_post_creation_simple_text(self):
        """Test creating a simple text post"""
        print("\n🔍 Testing Simple Text Post Creation...")
        
        if not self.token:
            self.log_test("Simple text post creation", False, "No authentication token available")
            return False
        
        # Test with different modules
        test_cases = [
            {
                "module": "family",
                "content": f"🔍 TEST POST: Simple family post created at {datetime.now().strftime('%H:%M:%S')} - investigating post creation issue"
            },
            {
                "module": "news", 
                "content": f"📰 TEST POST: News post created at {datetime.now().strftime('%H:%M:%S')} - checking if posts appear in feed"
            },
            {
                "module": "organizations",
                "content": f"🏢 TEST POST: Organization post created at {datetime.now().strftime('%H:%M:%S')} - verifying post functionality"
            }
        ]
        
        success_count = 0
        
        for test_case in test_cases:
            form_data = {
                'content': test_case['content'],
                'source_module': test_case['module'],
                'target_audience': 'module'
            }
            
            response = self.make_request('POST', 'posts', auth_required=True, form_data=form_data)
            
            if response and response.status_code == 200:
                data = response.json()
                post_success = (
                    'id' in data and
                    'content' in data and
                    'author' in data and
                    data['content'] == test_case['content']
                )
                
                if post_success:
                    success_count += 1
                    post_id = data.get('id')
                    self.log_test(f"Create {test_case['module']} post", True, f"Post ID: {post_id}")
                    
                    # Immediately check if the post appears in the feed
                    self.verify_post_in_feed(post_id, test_case['module'])
                else:
                    self.log_test(f"Create {test_case['module']} post", False, "Invalid response structure")
            else:
                error_msg = f"Status: {response.status_code}" if response else "No response"
                self.log_test(f"Create {test_case['module']} post", False, error_msg)
        
        return success_count == len(test_cases)

    def verify_post_in_feed(self, post_id, module):
        """Verify that a created post appears in the feed"""
        print(f"   🔍 Verifying post {post_id[:8]}... appears in {module} feed...")
        
        response = self.make_request('GET', f'posts?module={module}', auth_required=True)
        
        if response and response.status_code == 200:
            posts = response.json()
            
            # Look for our post
            found_post = None
            for post in posts:
                if post.get('id') == post_id:
                    found_post = post
                    break
            
            if found_post:
                self.log_test(f"Post appears in {module} feed", True, f"Post found in feed with content: {found_post.get('content', '')[:50]}...")
                return True
            else:
                self.log_test(f"Post appears in {module} feed", False, f"Post not found in feed (checked {len(posts)} posts)")
                
                # Debug: Show what posts are in the feed
                print(f"   Debug: Current posts in {module} feed:")
                for i, post in enumerate(posts[:5]):
                    author = post.get('author', {})
                    content_preview = post.get('content', '')[:30] + "..." if len(post.get('content', '')) > 30 else post.get('content', '')
                    print(f"     {i+1}. ID: {post.get('id', 'Unknown')[:8]}... - {author.get('first_name', 'Unknown')}: {content_preview}")
                
                return False
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test(f"Post appears in {module} feed", False, f"Could not retrieve feed: {error_msg}")
            return False

    def test_post_creation_with_media(self):
        """Test creating posts with media files"""
        print("\n🔍 Testing Post Creation with Media...")
        
        if not self.token:
            self.log_test("Post creation with media", False, "No authentication token available")
            return False
        
        # First, upload a test file
        png_content = b'\x89PNG\r\n\x1a\n\rIHDR\x01\x01\x08\x02\x90wS\xde\tpHYs\x0b\x13\x0b\x13\x01\x9a\x9c\x18\nIDATx\x9cc\xf8\x01\x01IEND\xaeB`\x82'
        
        import tempfile
        import os
        
        # Create temporary file
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
        temp_file.write(png_content)
        temp_file.close()
        
        try:
            # Upload the file
            url = f"{self.base_url}/media/upload"
            headers = {'Authorization': f'Bearer {self.token}'}
            
            with open(temp_file.name, 'rb') as f:
                files = {'file': ('test_image.png', f, 'image/png')}
                upload_response = requests.post(url, files=files, headers=headers, timeout=30)
            
            print(f"   Media upload: Status {upload_response.status_code}")
            
            if upload_response.status_code == 200:
                upload_data = upload_response.json()
                file_id = upload_data.get('id')
                self.log_test("Media file upload", True, f"File ID: {file_id}")
                
                # Now create a post with this media
                form_data = {
                    'content': f"📸 TEST POST WITH MEDIA: Created at {datetime.now().strftime('%H:%M:%S')} - testing media upload functionality",
                    'source_module': 'family',
                    'target_audience': 'module',
                    'media_file_ids': [file_id]
                }
                
                response = self.make_request('POST', 'posts', auth_required=True, form_data=form_data)
                
                if response and response.status_code == 200:
                    data = response.json()
                    media_success = (
                        'id' in data and
                        'media_files' in data and
                        len(data['media_files']) > 0
                    )
                    
                    if media_success:
                        post_id = data.get('id')
                        media_count = len(data.get('media_files', []))
                        self.log_test("Create post with media", True, f"Post ID: {post_id}, Media files: {media_count}")
                        
                        # Verify post appears in feed
                        self.verify_post_in_feed(post_id, 'family')
                        return True
                    else:
                        self.log_test("Create post with media", False, "Post created but no media files attached")
                else:
                    error_msg = f"Status: {response.status_code}" if response else "No response"
                    self.log_test("Create post with media", False, error_msg)
            else:
                error_msg = f"Status: {upload_response.status_code}"
                try:
                    error_data = upload_response.json()
                    error_msg += f", Details: {error_data}"
                except:
                    pass
                self.log_test("Media file upload", False, error_msg)
        
        finally:
            os.unlink(temp_file.name)
        
        return False

    def test_post_creation_with_youtube(self):
        """Test creating posts with YouTube URLs"""
        print("\n🔍 Testing Post Creation with YouTube URLs...")
        
        if not self.token:
            self.log_test("Post creation with YouTube", False, "No authentication token available")
            return False
        
        youtube_content = f"🎥 TEST POST WITH YOUTUBE: Check out this video https://www.youtube.com/watch?v=dQw4w9WgXcQ created at {datetime.now().strftime('%H:%M:%S')}"
        
        form_data = {
            'content': youtube_content,
            'source_module': 'family',
            'target_audience': 'module'
        }
        
        response = self.make_request('POST', 'posts', auth_required=True, form_data=form_data)
        
        if response and response.status_code == 200:
            data = response.json()
            youtube_success = (
                'id' in data and
                'youtube_urls' in data and
                len(data['youtube_urls']) > 0
            )
            
            if youtube_success:
                post_id = data.get('id')
                youtube_urls = data.get('youtube_urls', [])
                self.log_test("Create post with YouTube", True, f"Post ID: {post_id}, YouTube URLs: {youtube_urls}")
                
                # Verify post appears in feed
                self.verify_post_in_feed(post_id, 'family')
                return True
            else:
                self.log_test("Create post with YouTube", False, f"Post created but no YouTube URLs detected: {data.get('youtube_urls', [])}")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("Create post with YouTube", False, error_msg)
        
        return False

    def test_post_creation_edge_cases(self):
        """Test edge cases that might cause post creation to fail"""
        print("\n🔍 Testing Post Creation Edge Cases...")
        
        if not self.token:
            self.log_test("Post creation edge cases", False, "No authentication token available")
            return False
        
        edge_cases = [
            {
                "name": "Empty content",
                "form_data": {
                    'content': '',
                    'source_module': 'family',
                    'target_audience': 'module'
                },
                "should_succeed": False
            },
            {
                "name": "Very long content",
                "form_data": {
                    'content': 'A' * 5000,  # Very long content
                    'source_module': 'family',
                    'target_audience': 'module'
                },
                "should_succeed": True
            },
            {
                "name": "Invalid module",
                "form_data": {
                    'content': 'Test post with invalid module',
                    'source_module': 'invalid_module',
                    'target_audience': 'module'
                },
                "should_succeed": True  # Should default to a valid module
            },
            {
                "name": "Missing source_module",
                "form_data": {
                    'content': 'Test post without source_module',
                    'target_audience': 'module'
                },
                "should_succeed": True  # Should use default
            },
            {
                "name": "Special characters",
                "form_data": {
                    'content': 'Test with special chars: 🎉 ñáéíóú @#$%^&*()_+ 中文 العربية',
                    'source_module': 'family',
                    'target_audience': 'module'
                },
                "should_succeed": True
            }
        ]
        
        success_count = 0
        
        for case in edge_cases:
            response = self.make_request('POST', 'posts', auth_required=True, form_data=case['form_data'])
            
            if case['should_succeed']:
                if response and response.status_code == 200:
                    data = response.json()
                    if 'id' in data:
                        success_count += 1
                        self.log_test(f"Edge case: {case['name']}", True, f"Post created successfully")
                    else:
                        self.log_test(f"Edge case: {case['name']}", False, "Invalid response structure")
                else:
                    error_msg = f"Status: {response.status_code}" if response else "No response"
                    self.log_test(f"Edge case: {case['name']}", False, f"Expected success but got: {error_msg}")
            else:
                if response and response.status_code >= 400:
                    success_count += 1
                    self.log_test(f"Edge case: {case['name']}", True, f"Correctly rejected with status {response.status_code}")
                else:
                    status = response.status_code if response else "No response"
                    self.log_test(f"Edge case: {case['name']}", False, f"Expected error but got: {status}")
        
        return success_count == len(edge_cases)

    def test_database_persistence(self):
        """Test that posts are actually saved to database and persist"""
        print("\n🔍 Testing Database Persistence...")
        
        if not self.token:
            self.log_test("Database persistence", False, "No authentication token available")
            return False
        
        # Create a unique test post
        unique_content = f"🔍 PERSISTENCE TEST: Unique post {uuid.uuid4().hex[:8]} created at {datetime.now().isoformat()}"
        
        form_data = {
            'content': unique_content,
            'source_module': 'family',
            'target_audience': 'module'
        }
        
        # Create the post
        response = self.make_request('POST', 'posts', auth_required=True, form_data=form_data)
        
        if response and response.status_code == 200:
            data = response.json()
            post_id = data.get('id')
            self.log_test("Create persistence test post", True, f"Post ID: {post_id}")
            
            # Wait a moment and then check if it's still there
            import time
            time.sleep(2)
            
            # Check multiple times to ensure persistence
            for attempt in range(3):
                feed_response = self.make_request('GET', 'posts?module=family', auth_required=True)
                
                if feed_response and feed_response.status_code == 200:
                    posts = feed_response.json()
                    
                    # Look for our unique post
                    found = False
                    for post in posts:
                        if post.get('content') == unique_content:
                            found = True
                            break
                    
                    if found:
                        self.log_test(f"Persistence check #{attempt + 1}", True, "Post found in database")
                    else:
                        self.log_test(f"Persistence check #{attempt + 1}", False, "Post not found in database")
                        return False
                else:
                    self.log_test(f"Persistence check #{attempt + 1}", False, "Could not retrieve posts")
                    return False
                
                time.sleep(1)  # Wait between checks
            
            return True
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("Create persistence test post", False, error_msg)
            return False

    def run_post_creation_investigation(self):
        """Run comprehensive post creation investigation"""
        print("🔍 INVESTIGATING POST CREATION FUNCTIONALITY ISSUE")
        print("=" * 60)
        print(f"📡 Testing against: {self.base_url}")
        print(f"👤 Testing with user: {self.test_user_email}")
        print("=" * 60)
        
        # Step 1: Login with the specific user
        if not self.test_user_login():
            print("\n❌ CRITICAL: Cannot login with user 30new18@gmail.com")
            print("   This might be the root cause of the post creation issue.")
            return False
        
        # Step 2: Check existing posts state
        self.test_get_existing_posts()
        
        # Step 3: Test simple text post creation
        print("\n🎯 CORE FUNCTIONALITY TESTS")
        print("=" * 40)
        
        simple_success = self.test_post_creation_simple_text()
        
        # Step 4: Test post creation with media
        media_success = self.test_post_creation_with_media()
        
        # Step 5: Test post creation with YouTube URLs
        youtube_success = self.test_post_creation_with_youtube()
        
        # Step 6: Test edge cases
        edge_success = self.test_post_creation_edge_cases()
        
        # Step 7: Test database persistence
        persistence_success = self.test_database_persistence()
        
        # Summary
        print("\n" + "=" * 60)
        print("🔍 POST CREATION INVESTIGATION SUMMARY")
        print("=" * 60)
        print(f"Tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        print("\n📊 FUNCTIONALITY STATUS:")
        print(f"✅ User Login: {'WORKING' if self.token else 'FAILED'}")
        print(f"✅ Simple Text Posts: {'WORKING' if simple_success else 'FAILED'}")
        print(f"✅ Media Posts: {'WORKING' if media_success else 'FAILED'}")
        print(f"✅ YouTube Posts: {'WORKING' if youtube_success else 'FAILED'}")
        print(f"✅ Edge Cases: {'WORKING' if edge_success else 'FAILED'}")
        print(f"✅ Database Persistence: {'WORKING' if persistence_success else 'FAILED'}")
        
        if self.tests_passed == self.tests_run:
            print("\n🎉 CONCLUSION: Post creation functionality appears to be WORKING correctly!")
            print("   The user's issue might be:")
            print("   1. Frontend-backend communication problem")
            print("   2. User interface not updating after post creation")
            print("   3. Caching issues in the browser")
            print("   4. Network connectivity issues")
        else:
            print(f"\n⚠️  CONCLUSION: Found {self.tests_run - self.tests_passed} issues with post creation functionality")
            print("   These issues need to be addressed to resolve the user's problem.")
        
        return self.tests_passed == self.tests_run

if __name__ == "__main__":
    tester = PostCreationTester()
    success = tester.run_post_creation_investigation()
    sys.exit(0 if success else 1)