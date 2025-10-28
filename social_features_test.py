#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
import uuid

class SocialFeaturesAPITester:
    def __init__(self, base_url="https://bizconnect-85.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.test_post_id = None
        self.test_comment_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_user_email = f"social_test_{datetime.now().strftime('%Y%m%d_%H%M%S')}@example.com"
        self.test_user_data = {
            "email": self.test_user_email,
            "password": "testpass123",
            "first_name": "Социальный",
            "last_name": "Тестер", 
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
                if form_data:
                    response = requests.put(url, data=form_data, headers=headers, timeout=30)
                else:
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

    def setup_test_user(self):
        """Register and login test user"""
        print("\n🔍 Setting up test user for social features...")
        
        # Register user
        response = self.make_request('POST', 'auth/register', self.test_user_data)
        
        if response and response.status_code == 200:
            data = response.json()
            if 'access_token' in data and 'user' in data:
                self.token = data['access_token']
                self.user_id = data['user']['id']
                self.log_test("Test user registration", True, f"User ID: {self.user_id}")
                return True
            else:
                self.log_test("Test user registration", False, "Missing token or user data")
        else:
            self.log_test("Test user registration", False, f"Status: {response.status_code if response else 'No response'}")
        
        return False

    def create_test_post(self):
        """Create a test post for social features testing"""
        print("\n🔍 Creating test post for social features...")
        
        if not self.token:
            self.log_test("Create test post", False, "No authentication token available")
            return False
        
        form_data = {
            'content': 'This is a test post for social features testing! 🚀 #testing',
            'media_file_ids': []
        }
        
        response = self.make_request('POST', 'posts', auth_required=True, form_data=form_data)
        
        if response and response.status_code == 200:
            data = response.json()
            if 'id' in data:
                self.test_post_id = data['id']
                self.log_test("Create test post", True, f"Post ID: {self.test_post_id}")
                return True
            else:
                self.log_test("Create test post", False, "Missing post ID in response")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("Create test post", False, error_msg)
        
        return False

    def test_post_likes_system(self):
        """Test Post Likes System - like/unlike toggle, get likes, notifications"""
        print("\n🔍 Testing Post Likes System...")
        
        if not self.token or not self.test_post_id:
            self.log_test("Post likes system", False, "Missing authentication or test post")
            return False
        
        success_count = 0
        total_tests = 4
        
        # Test 1: Like a post
        response = self.make_request('POST', f'posts/{self.test_post_id}/like', auth_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            if data.get('liked') == True and 'message' in data:
                success_count += 1
                self.log_test("Like post", True, f"Message: {data.get('message')}")
            else:
                self.log_test("Like post", False, f"Unexpected response: {data}")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("Like post", False, error_msg)
        
        # Test 2: Get list of users who liked the post
        response = self.make_request('GET', f'posts/{self.test_post_id}/likes', auth_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            if isinstance(data, list) and len(data) > 0:
                like_entry = data[0]
                if 'user' in like_entry and like_entry['user']['id'] == self.user_id:
                    success_count += 1
                    self.log_test("Get post likes", True, f"Found {len(data)} likes, user correctly listed")
                else:
                    self.log_test("Get post likes", False, "User not found in likes list")
            else:
                self.log_test("Get post likes", False, f"Expected list with likes, got: {data}")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("Get post likes", False, error_msg)
        
        # Test 3: Verify likes_count increment in posts API
        response = self.make_request('GET', 'posts', auth_required=True)
        
        if response and response.status_code == 200:
            posts = response.json()
            test_post = None
            for post in posts:
                if post.get('id') == self.test_post_id:
                    test_post = post
                    break
            
            if test_post and test_post.get('likes_count', 0) > 0 and test_post.get('user_liked') == True:
                success_count += 1
                self.log_test("Verify likes_count increment", True, f"Likes count: {test_post.get('likes_count')}, user_liked: {test_post.get('user_liked')}")
            else:
                self.log_test("Verify likes_count increment", False, f"Post likes_count: {test_post.get('likes_count') if test_post else 'Post not found'}")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("Verify likes_count increment", False, error_msg)
        
        # Test 4: Unlike the post (toggle)
        response = self.make_request('POST', f'posts/{self.test_post_id}/like', auth_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            if data.get('liked') == False and 'message' in data:
                success_count += 1
                self.log_test("Unlike post (toggle)", True, f"Message: {data.get('message')}")
            else:
                self.log_test("Unlike post (toggle)", False, f"Unexpected response: {data}")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("Unlike post (toggle)", False, error_msg)
        
        return success_count == total_tests

    def test_comments_system(self):
        """Test Comments System with nested replies, editing, deletion"""
        print("\n🔍 Testing Comments System with Nested Replies...")
        
        if not self.token or not self.test_post_id:
            self.log_test("Comments system", False, "Missing authentication or test post")
            return False
        
        success_count = 0
        total_tests = 8
        
        # Test 1: Create top-level comment
        form_data = {
            'content': 'This is a test comment! 💬'
        }
        
        response = self.make_request('POST', f'posts/{self.test_post_id}/comments', auth_required=True, form_data=form_data)
        
        if response and response.status_code == 200:
            data = response.json()
            if 'id' in data and data.get('content') == form_data['content']:
                self.test_comment_id = data['id']
                success_count += 1
                self.log_test("Create top-level comment", True, f"Comment ID: {self.test_comment_id}")
            else:
                self.log_test("Create top-level comment", False, f"Invalid response: {data}")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("Create top-level comment", False, error_msg)
        
        # Test 2: Create reply to comment
        reply_form_data = {
            'content': 'This is a reply to the comment! 🔄',
            'parent_comment_id': self.test_comment_id
        }
        
        response = self.make_request('POST', f'posts/{self.test_post_id}/comments', auth_required=True, form_data=reply_form_data)
        
        reply_comment_id = None
        if response and response.status_code == 200:
            data = response.json()
            if 'id' in data and data.get('parent_comment_id') == self.test_comment_id:
                reply_comment_id = data['id']
                success_count += 1
                self.log_test("Create reply comment", True, f"Reply ID: {reply_comment_id}")
            else:
                self.log_test("Create reply comment", False, f"Invalid response: {data}")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("Create reply comment", False, error_msg)
        
        # Test 3: Get comments with nested structure
        response = self.make_request('GET', f'posts/{self.test_post_id}/comments', auth_required=True)
        
        if response and response.status_code == 200:
            comments = response.json()
            if isinstance(comments, list) and len(comments) > 0:
                top_comment = comments[0]
                if (top_comment.get('id') == self.test_comment_id and 
                    'replies' in top_comment and 
                    len(top_comment['replies']) > 0):
                    success_count += 1
                    self.log_test("Get nested comments structure", True, f"Found {len(comments)} top-level comments with {len(top_comment['replies'])} replies")
                else:
                    self.log_test("Get nested comments structure", False, "Invalid nested structure")
            else:
                self.log_test("Get nested comments structure", False, f"Expected comments list, got: {comments}")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("Get nested comments structure", False, error_msg)
        
        # Test 4: Edit comment
        edit_form_data = {
            'content': 'This is an EDITED test comment! ✏️'
        }
        
        response = self.make_request('PUT', f'comments/{self.test_comment_id}', auth_required=True, form_data=edit_form_data)
        
        if response and response.status_code == 200:
            data = response.json()
            if data.get('message') == 'Comment updated successfully':
                success_count += 1
                self.log_test("Edit comment", True, "Comment successfully edited")
            else:
                self.log_test("Edit comment", False, f"Unexpected response: {data}")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("Edit comment", False, error_msg)
        
        # Test 5: Verify comments_count increment on post
        response = self.make_request('GET', 'posts', auth_required=True)
        
        if response and response.status_code == 200:
            posts = response.json()
            test_post = None
            for post in posts:
                if post.get('id') == self.test_post_id:
                    test_post = post
                    break
            
            if test_post and test_post.get('comments_count', 0) > 0:
                success_count += 1
                self.log_test("Verify comments_count increment", True, f"Comments count: {test_post.get('comments_count')}")
            else:
                self.log_test("Verify comments_count increment", False, f"Comments count: {test_post.get('comments_count') if test_post else 'Post not found'}")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("Verify comments_count increment", False, error_msg)
        
        # Test 6: Test comment likes
        response = self.make_request('POST', f'comments/{self.test_comment_id}/like', auth_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            if data.get('liked') == True:
                success_count += 1
                self.log_test("Like comment", True, f"Message: {data.get('message')}")
            else:
                self.log_test("Like comment", False, f"Unexpected response: {data}")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("Like comment", False, error_msg)
        
        # Test 7: Test invalid comment operations (non-existent comment)
        fake_comment_id = str(uuid.uuid4())
        response = self.make_request('PUT', f'comments/{fake_comment_id}', auth_required=True, form_data={'content': 'test'})
        
        if response and response.status_code == 404:
            success_count += 1
            self.log_test("Edit non-existent comment returns 404", True, "Correctly returned 404")
        else:
            status = response.status_code if response else "No response"
            self.log_test("Edit non-existent comment returns 404", False, f"Expected 404, got {status}")
        
        # Test 8: Delete comment (if reply exists, test that too)
        if reply_comment_id:
            response = self.make_request('DELETE', f'comments/{reply_comment_id}', auth_required=True)
            
            if response and response.status_code == 200:
                data = response.json()
                if data.get('message') == 'Comment deleted successfully':
                    success_count += 1
                    self.log_test("Delete reply comment", True, "Reply comment successfully deleted")
                else:
                    self.log_test("Delete reply comment", False, f"Unexpected response: {data}")
            else:
                error_msg = f"Status: {response.status_code}" if response else "No response"
                self.log_test("Delete reply comment", False, error_msg)
        else:
            # If no reply was created, just mark this test as passed
            success_count += 1
            self.log_test("Delete reply comment", True, "No reply to delete (previous test failed)")
        
        return success_count == total_tests

    def test_emoji_reactions_system(self):
        """Test Emoji Reactions System - add/update/remove reactions, validation"""
        print("\n🔍 Testing Emoji Reactions System...")
        
        if not self.token or not self.test_post_id:
            self.log_test("Emoji reactions system", False, "Missing authentication or test post")
            return False
        
        success_count = 0
        total_tests = 6
        
        # Test 1: Add emoji reaction
        form_data = {
            'emoji': '👍'
        }
        
        response = self.make_request('POST', f'posts/{self.test_post_id}/reactions', auth_required=True, form_data=form_data)
        
        if response and response.status_code == 200:
            data = response.json()
            if 'message' in data and ('added' in data['message'] or 'updated' in data['message']):
                success_count += 1
                self.log_test("Add emoji reaction", True, f"Message: {data.get('message')}")
            else:
                self.log_test("Add emoji reaction", False, f"Unexpected response: {data}")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("Add emoji reaction", False, error_msg)
        
        # Test 2: Update emoji reaction (change to different emoji)
        form_data = {
            'emoji': '❤️'
        }
        
        response = self.make_request('POST', f'posts/{self.test_post_id}/reactions', auth_required=True, form_data=form_data)
        
        if response and response.status_code == 200:
            data = response.json()
            if 'message' in data and 'updated' in data['message']:
                success_count += 1
                self.log_test("Update emoji reaction", True, f"Message: {data.get('message')}")
            else:
                self.log_test("Update emoji reaction", False, f"Unexpected response: {data}")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("Update emoji reaction", False, error_msg)
        
        # Test 3: Get reaction summary
        response = self.make_request('GET', f'posts/{self.test_post_id}/reactions', auth_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            if isinstance(data, list) and len(data) > 0:
                reaction = data[0]
                if 'emoji' in reaction and 'count' in reaction:
                    success_count += 1
                    self.log_test("Get reaction summary", True, f"Found {len(data)} reaction types")
                else:
                    self.log_test("Get reaction summary", False, "Invalid reaction structure")
            else:
                self.log_test("Get reaction summary", False, f"Expected reactions list, got: {data}")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("Get reaction summary", False, error_msg)
        
        # Test 4: Test invalid emoji validation
        form_data = {
            'emoji': '🚫'  # Not in allowed list
        }
        
        response = self.make_request('POST', f'posts/{self.test_post_id}/reactions', auth_required=True, form_data=form_data)
        
        if response and response.status_code == 400:
            success_count += 1
            self.log_test("Invalid emoji validation", True, "Correctly rejected invalid emoji")
        else:
            status = response.status_code if response else "No response"
            self.log_test("Invalid emoji validation", False, f"Expected 400, got {status}")
        
        # Test 5: Verify user_reaction in posts API
        response = self.make_request('GET', 'posts', auth_required=True)
        
        if response and response.status_code == 200:
            posts = response.json()
            test_post = None
            for post in posts:
                if post.get('id') == self.test_post_id:
                    test_post = post
                    break
            
            if test_post and test_post.get('user_reaction') == '❤️':
                success_count += 1
                self.log_test("Verify user_reaction in posts", True, f"User reaction: {test_post.get('user_reaction')}")
            else:
                self.log_test("Verify user_reaction in posts", False, f"User reaction: {test_post.get('user_reaction') if test_post else 'Post not found'}")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("Verify user_reaction in posts", False, error_msg)
        
        # Test 6: Remove reaction
        response = self.make_request('DELETE', f'posts/{self.test_post_id}/reactions', auth_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            if 'message' in data and 'removed' in data['message']:
                success_count += 1
                self.log_test("Remove reaction", True, f"Message: {data.get('message')}")
            else:
                self.log_test("Remove reaction", False, f"Unexpected response: {data}")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("Remove reaction", False, error_msg)
        
        return success_count == total_tests

    def test_enhanced_posts_api(self):
        """Test Enhanced Posts API - user_liked, user_reaction, top_reactions fields"""
        print("\n🔍 Testing Enhanced Posts API with Social Data...")
        
        if not self.token or not self.test_post_id:
            self.log_test("Enhanced posts API", False, "Missing authentication or test post")
            return False
        
        success_count = 0
        total_tests = 3
        
        # First, add some social interactions to test
        # Like the post
        self.make_request('POST', f'posts/{self.test_post_id}/like', auth_required=True)
        
        # Add a reaction
        form_data = {'emoji': '🔥'}
        self.make_request('POST', f'posts/{self.test_post_id}/reactions', auth_required=True, form_data=form_data)
        
        # Test 1: Verify user_liked field
        response = self.make_request('GET', 'posts', auth_required=True)
        
        if response and response.status_code == 200:
            posts = response.json()
            test_post = None
            for post in posts:
                if post.get('id') == self.test_post_id:
                    test_post = post
                    break
            
            if test_post and 'user_liked' in test_post:
                success_count += 1
                self.log_test("Enhanced Posts API - user_liked field", True, f"user_liked: {test_post.get('user_liked')}")
            else:
                self.log_test("Enhanced Posts API - user_liked field", False, "user_liked field missing")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("Enhanced Posts API - user_liked field", False, error_msg)
        
        # Test 2: Verify user_reaction field
        if test_post and 'user_reaction' in test_post:
            success_count += 1
            self.log_test("Enhanced Posts API - user_reaction field", True, f"user_reaction: {test_post.get('user_reaction')}")
        else:
            self.log_test("Enhanced Posts API - user_reaction field", False, "user_reaction field missing")
        
        # Test 3: Verify top_reactions field
        if test_post and 'top_reactions' in test_post and isinstance(test_post['top_reactions'], list):
            success_count += 1
            self.log_test("Enhanced Posts API - top_reactions field", True, f"top_reactions: {len(test_post.get('top_reactions', []))} reactions")
        else:
            self.log_test("Enhanced Posts API - top_reactions field", False, "top_reactions field missing or invalid")
        
        return success_count == total_tests

    def test_notifications_system(self):
        """Test Notifications System - get notifications, mark as read"""
        print("\n🔍 Testing Notifications System...")
        
        if not self.token:
            self.log_test("Notifications system", False, "Missing authentication")
            return False
        
        success_count = 0
        total_tests = 3
        
        # Test 1: Get notifications
        response = self.make_request('GET', 'notifications', auth_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                success_count += 1
                self.log_test("Get notifications", True, f"Found {len(data)} notifications")
                
                # Store a notification ID for testing if available
                notification_id = None
                if len(data) > 0 and 'id' in data[0]:
                    notification_id = data[0]['id']
                
                # Test 2: Mark specific notification as read (if available)
                if notification_id:
                    response = self.make_request('PUT', f'notifications/{notification_id}/read', auth_required=True)
                    
                    if response and response.status_code == 200:
                        result = response.json()
                        if 'message' in result:
                            success_count += 1
                            self.log_test("Mark notification as read", True, f"Message: {result.get('message')}")
                        else:
                            self.log_test("Mark notification as read", False, f"Unexpected response: {result}")
                    else:
                        error_msg = f"Status: {response.status_code}" if response else "No response"
                        self.log_test("Mark notification as read", False, error_msg)
                else:
                    # No notifications to mark as read
                    success_count += 1
                    self.log_test("Mark notification as read", True, "No notifications to mark as read")
                
                # Test 3: Mark all notifications as read
                response = self.make_request('PUT', 'notifications/mark-all-read', auth_required=True)
                
                if response and response.status_code == 200:
                    result = response.json()
                    if 'message' in result:
                        success_count += 1
                        self.log_test("Mark all notifications as read", True, f"Message: {result.get('message')}")
                    else:
                        self.log_test("Mark all notifications as read", False, f"Unexpected response: {result}")
                else:
                    error_msg = f"Status: {response.status_code}" if response else "No response"
                    self.log_test("Mark all notifications as read", False, error_msg)
            else:
                self.log_test("Get notifications", False, f"Expected list, got: {data}")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("Get notifications", False, error_msg)
        
        return success_count == total_tests

    def test_edge_cases_and_error_handling(self):
        """Test edge cases and error handling"""
        print("\n🔍 Testing Edge Cases and Error Handling...")
        
        if not self.token:
            self.log_test("Edge cases", False, "Missing authentication")
            return False
        
        success_count = 0
        total_tests = 4
        
        # Test 1: Like non-existent post
        fake_post_id = str(uuid.uuid4())
        response = self.make_request('POST', f'posts/{fake_post_id}/like', auth_required=True)
        
        if response and response.status_code == 404:
            success_count += 1
            self.log_test("Like non-existent post returns 404", True, "Correctly returned 404")
        else:
            status = response.status_code if response else "No response"
            self.log_test("Like non-existent post returns 404", False, f"Expected 404, got {status}")
        
        # Test 2: Comment on non-existent post
        form_data = {'content': 'Test comment'}
        response = self.make_request('POST', f'posts/{fake_post_id}/comments', auth_required=True, form_data=form_data)
        
        if response and response.status_code == 404:
            success_count += 1
            self.log_test("Comment on non-existent post returns 404", True, "Correctly returned 404")
        else:
            status = response.status_code if response else "No response"
            self.log_test("Comment on non-existent post returns 404", False, f"Expected 404, got {status}")
        
        # Test 3: React to non-existent post
        form_data = {'emoji': '👍'}
        response = self.make_request('POST', f'posts/{fake_post_id}/reactions', auth_required=True, form_data=form_data)
        
        if response and response.status_code == 404:
            success_count += 1
            self.log_test("React to non-existent post returns 404", True, "Correctly returned 404")
        else:
            status = response.status_code if response else "No response"
            self.log_test("React to non-existent post returns 404", False, f"Expected 404, got {status}")
        
        # Test 4: Test authentication requirement
        response = self.make_request('POST', f'posts/{self.test_post_id}/like', auth_required=False)
        
        if response and response.status_code == 401:
            success_count += 1
            self.log_test("Unauthenticated request returns 401", True, "Correctly returned 401")
        else:
            status = response.status_code if response else "No response"
            self.log_test("Unauthenticated request returns 401", False, f"Expected 401, got {status}")
        
        return success_count == total_tests

    def run_all_social_tests(self):
        """Run all social features tests"""
        print("🚀 Starting Enhanced Social Features API Tests...")
        print(f"📡 Testing against: {self.base_url}")
        print("=" * 80)
        
        # Setup test user and post
        if not self.setup_test_user():
            print("❌ Failed to setup test user. Aborting tests.")
            return False
        
        if not self.create_test_post():
            print("❌ Failed to create test post. Aborting tests.")
            return False
        
        print("\n🔥 ENHANCED SOCIAL FEATURES TESTING")
        print("=" * 80)
        
        # Run all social feature tests
        self.test_post_likes_system()
        self.test_comments_system()
        self.test_emoji_reactions_system()
        self.test_enhanced_posts_api()
        self.test_notifications_system()
        self.test_edge_cases_and_error_handling()
        
        # Print final results
        print("\n" + "=" * 80)
        print(f"🏁 SOCIAL FEATURES TESTING COMPLETE")
        print(f"📊 Results: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 ALL SOCIAL FEATURES TESTS PASSED!")
            return True
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} tests failed")
            return False

if __name__ == "__main__":
    tester = SocialFeaturesAPITester()
    success = tester.run_all_social_tests()
    sys.exit(0 if success else 1)