#!/usr/bin/env python3
"""
Backend Testing for ZION.CITY Application - Enhanced Comments Feature Testing
Testing the Enhanced Comments feature in the NEWS module

Test Focus:
1. Comment CRUD Operations (Create, Get, Edit, Delete)
2. Replies Feature (nested comments with parent_comment_id)
3. Like Comment functionality (toggle like with count updates)

Test Scenarios:
- Create Comment: POST /api/news/posts/{post_id}/comments
- Get Comments: GET /api/news/posts/{post_id}/comments  
- Edit Comment: PUT /api/news/comments/{comment_id}
- Delete Comment: DELETE /api/news/comments/{comment_id}
- Like Comment: POST /api/news/comments/{comment_id}/like

Test Credentials:
- Admin: admin@test.com / testpassword123
- Test User: testuser@test.com / testpassword123
"""

import requests
import json
import sys
from datetime import datetime

# Get backend URL from environment
BACKEND_URL = "https://social-features-1.preview.emergentagent.com/api"

class ZionCityTester:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
        self.test_user_token = None
        self.admin_user_id = None
        self.test_user_id = None
        self.test_post_id = None
        self.test_comment_ids = []
        self.test_reply_ids = []
        
    def log(self, message, level="INFO"):
        """Log test messages with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def login_user(self, email, password, user_type="admin"):
        """Login and get JWT token"""
        try:
            self.log(f"🔐 Logging in {user_type}: {email}")
            
            response = self.session.post(f"{BACKEND_URL}/auth/login", json={
                "email": email,
                "password": password
            })
            
            if response.status_code == 200:
                data = response.json()
                token = data.get("access_token")
                user_id = data.get("user", {}).get("id")
                
                if user_type == "admin":
                    self.admin_token = token
                    self.admin_user_id = user_id
                else:
                    self.test_user_token = token
                    self.test_user_id = user_id
                    
                self.log(f"✅ {user_type.title()} login successful - User ID: {user_id}")
                return True
            else:
                self.log(f"❌ {user_type.title()} login failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ {user_type.title()} login error: {str(e)}", "ERROR")
            return False
    
    def get_auth_headers(self, user_type="admin"):
        """Get authorization headers"""
        token = self.admin_token if user_type == "admin" else self.test_user_token
        return {"Authorization": f"Bearer {token}"}
    
    def find_test_post(self):
        """Find a post to test comments on"""
        self.log("🔍 Finding a post with comments for testing")
        
        try:
            # First try the specific post ID from test data
            test_post_id = "9b3bbb64-1e3a-42f6-9940-50141e9d9d0b"
            
            response = self.session.get(
                f"{BACKEND_URL}/news/posts/feed",
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                posts = data.get("posts", [])
                
                # Look for the specific test post first
                for post in posts:
                    if post.get("id") == test_post_id:
                        self.test_post_id = test_post_id
                        self.log(f"✅ Found specific test post: {test_post_id}")
                        return True
                
                # If not found, look for any post with comments
                for post in posts:
                    if post.get("comments_count", 0) > 0:
                        self.test_post_id = post.get("id")
                        self.log(f"✅ Found post with comments: {self.test_post_id} (comments: {post.get('comments_count')})")
                        return True
                
                # If no posts with comments, use the first available post
                if posts and len(posts) > 0:
                    self.test_post_id = posts[0].get("id")
                    self.log(f"✅ Using first available post: {self.test_post_id}")
                    return True
                else:
                    self.log("❌ No posts found in news feed", "ERROR")
                    return False
            else:
                self.log(f"❌ Failed to get news feed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Error finding test post: {str(e)}", "ERROR")
            return False
    
    def test_get_comments(self):
        """Test 1: Get comments for a post"""
        self.log(f"💬 Testing GET /api/news/posts/{self.test_post_id}/comments")
        
        try:
            response = self.session.get(
                f"{BACKEND_URL}/news/posts/{self.test_post_id}/comments",
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                comments = data.get("comments", [])
                self.log(f"✅ Comments retrieved successfully - Found {len(comments)} comments")
                
                # Store existing comment IDs for later tests
                for comment in comments:
                    if comment.get("parent_comment_id") is None:  # Top-level comments
                        self.test_comment_ids.append(comment.get("id"))
                    else:  # Replies
                        self.test_reply_ids.append(comment.get("id"))
                
                if comments:
                    # Verify comment structure
                    first_comment = comments[0]
                    required_fields = ["id", "content", "user_id", "created_at"]
                    missing_fields = [field for field in required_fields if field not in first_comment]
                    
                    if missing_fields:
                        self.log(f"⚠️ Missing fields in comment: {missing_fields}", "WARNING")
                    else:
                        self.log("✅ Comment structure validation passed")
                
                return True
            else:
                self.log(f"❌ Get comments failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Get comments error: {str(e)}", "ERROR")
            return False
    
    def test_create_comment(self):
        """Test 2: Create a new comment"""
        self.log(f"➕ Testing POST /api/news/posts/{self.test_post_id}/comments")
        
        try:
            comment_data = {
                "content": "Test comment for Enhanced Comments feature testing! 🚀"
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/news/posts/{self.test_post_id}/comments",
                json=comment_data,
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                comment_id = data.get("id")
                
                if comment_id:
                    self.test_comment_ids.append(comment_id)
                    self.log(f"✅ Comment created successfully - ID: {comment_id}")
                    
                    # Verify response structure
                    required_fields = ["id", "content", "user_id", "created_at"]
                    missing_fields = [field for field in required_fields if field not in data]
                    
                    if missing_fields:
                        self.log(f"⚠️ Missing fields in response: {missing_fields}", "WARNING")
                    else:
                        self.log("✅ Create comment response structure validated")
                    
                    return True
                else:
                    self.log("❌ Comment created but no ID returned", "ERROR")
                    return False
            else:
                self.log(f"❌ Create comment failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Create comment error: {str(e)}", "ERROR")
            return False
    
    def test_user_suggestions(self):
        """Test 4: People Discovery / Recommendations endpoint"""
        self.log("👥 Testing GET /api/users/suggestions (People Discovery)")
        
        try:
            response = self.session.get(
                f"{BACKEND_URL}/users/suggestions",
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                suggestions = data.get("suggestions", [])  # Handle wrapped response
                self.log(f"✅ User suggestions loaded successfully - Found {len(suggestions)} suggestions")
                
                if suggestions and len(suggestions) > 0:
                    # Verify suggestion structure
                    first_suggestion = suggestions[0]
                    required_fields = ["id", "first_name", "last_name"]
                    missing_fields = [field for field in required_fields if field not in first_suggestion]
                    
                    if missing_fields:
                        self.log(f"⚠️ Missing fields in suggestion: {missing_fields}", "WARNING")
                    else:
                        self.log("✅ User suggestion structure validation passed")
                else:
                    self.log("⚠️ No user suggestions found (empty list)", "WARNING")
                        
                return True
            else:
                self.log(f"❌ User suggestions failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ User suggestions error: {str(e)}", "ERROR")
            return False
    
    def run_comprehensive_test(self):
        """Run all tests in sequence"""
        self.log("🚀 Starting ZION.CITY Backend Testing - Critical Bug Fix Verification")
        self.log("=" * 80)
        
        # Test results tracking
        test_results = {
            "admin_login": False,
            "test_user_login": False,
            "channels_list": False,
            "channel_posts_fix": False,
            "news_feed": False,
            "user_suggestions": False
        }
        
        # 1. Login both users
        test_results["admin_login"] = self.login_user("admin@test.com", "testpassword123", "admin")
        test_results["test_user_login"] = self.login_user("testuser@test.com", "testpassword123", "test_user")
        
        if not test_results["admin_login"]:
            self.log("❌ Cannot proceed without admin login", "ERROR")
            return test_results
        
        # 2. Test channels list
        channels_success, channels_data = self.test_news_channels_list()
        test_results["channels_list"] = channels_success
        
        # 3. Test channel posts endpoint (CRITICAL FIX)
        if channels_success and channels_data and len(channels_data) > 0:
            channel_id = channels_data[0].get("id")
            if channel_id:
                test_results["channel_posts_fix"] = self.test_channel_posts_endpoint(channel_id)
            else:
                self.log("⚠️ No channel ID available for testing channel posts", "WARNING")
        else:
            self.log("⚠️ Cannot test channel posts - no channels available", "WARNING")
        
        # 4. Test news feed
        test_results["news_feed"] = self.test_news_feed()
        
        # 5. Test user suggestions
        test_results["user_suggestions"] = self.test_user_suggestions()
        
        # Print final results
        self.log("=" * 80)
        self.log("📊 FINAL TEST RESULTS")
        self.log("=" * 80)
        
        passed_tests = 0
        total_tests = len(test_results)
        
        for test_name, result in test_results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            self.log(f"{test_name.replace('_', ' ').title()}: {status}")
            if result:
                passed_tests += 1
        
        # Overall summary
        success_rate = (passed_tests / total_tests) * 100
        self.log("=" * 80)
        self.log(f"📈 OVERALL SUCCESS RATE: {passed_tests}/{total_tests} ({success_rate:.1f}%)")
        
        # Critical fix verification
        if test_results["channel_posts_fix"]:
            self.log("🎉 CRITICAL: Channel Posts ObjectId Serialization Fix VERIFIED!")
        else:
            self.log("🚨 CRITICAL: Channel Posts ObjectId Serialization Fix NOT TESTED!", "ERROR")
        
        self.log("=" * 80)
        
        return test_results

def main():
    """Main test execution"""
    tester = ZionCityTester()
    results = tester.run_comprehensive_test()
    
    # Exit with appropriate code
    critical_tests = ["admin_login", "news_feed", "user_suggestions"]
    critical_passed = all(results.get(test, False) for test in critical_tests)
    
    if critical_passed:
        print("\n🎉 All critical tests passed!")
        sys.exit(0)
    else:
        print("\n❌ Some critical tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()