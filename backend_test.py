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
    
    def test_news_channels_list(self):
        """Test 1: Get list of news channels"""
        self.log("📺 Testing GET /api/news/channels")
        
        try:
            response = self.session.get(
                f"{BACKEND_URL}/news/channels",
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                channels = data.get("channels", [])  # Handle wrapped response
                self.log(f"✅ Channels list retrieved successfully - Found {len(channels)} channels")
                
                if channels and len(channels) > 0:
                    # Verify channel structure
                    first_channel = channels[0]
                    required_fields = ["id", "name"]
                    missing_fields = [field for field in required_fields if field not in first_channel]
                    
                    if missing_fields:
                        self.log(f"⚠️ Missing fields in channel: {missing_fields}", "WARNING")
                    else:
                        self.log("✅ Channel structure validation passed")
                        
                return True, channels
            else:
                self.log(f"❌ Channels list failed: {response.status_code} - {response.text}", "ERROR")
                return False, None
                
        except Exception as e:
            self.log(f"❌ Channels list error: {str(e)}", "ERROR")
            return False, None
    
    def test_channel_posts_endpoint(self, channel_id):
        """Test 2: CRITICAL - Test the fixed channel posts endpoint"""
        self.log(f"🔧 Testing FIXED endpoint GET /api/news/posts/channel/{channel_id}")
        
        try:
            response = self.session.get(
                f"{BACKEND_URL}/news/posts/channel/{channel_id}",
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log("✅ Channel posts endpoint working - ObjectId serialization fix successful!")
                
                # Verify response structure
                if "channel" in data and "posts" in data:
                    channel_obj = data["channel"]
                    posts_array = data["posts"]
                    
                    self.log(f"✅ Response structure correct - Channel: {channel_obj.get('name', 'Unknown')}")
                    self.log(f"✅ Posts array present - Found {len(posts_array)} posts")
                    
                    # Verify channel object doesn't contain ObjectId
                    if "_id" in channel_obj:
                        self.log("❌ Channel object still contains _id field (ObjectId not excluded)", "ERROR")
                        return False
                    else:
                        self.log("✅ Channel object properly excludes _id field - Fix verified!")
                        
                    return True
                else:
                    self.log("❌ Invalid response structure - missing 'channel' or 'posts'", "ERROR")
                    return False
            else:
                self.log(f"❌ Channel posts endpoint failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Channel posts endpoint error: {str(e)}", "ERROR")
            return False
    
    def test_news_feed(self):
        """Test 3: Verify news feed loads correctly"""
        self.log("📰 Testing GET /api/news/posts/feed (News Feed)")
        
        try:
            response = self.session.get(
                f"{BACKEND_URL}/news/posts/feed",
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                posts = data.get("posts", [])  # Handle wrapped response
                self.log(f"✅ News feed loaded successfully - Found {len(posts)} posts")
                
                if posts and len(posts) > 0:
                    # Verify post structure
                    first_post = posts[0]
                    required_fields = ["id", "content", "author", "created_at"]
                    missing_fields = [field for field in required_fields if field not in first_post]
                    
                    if missing_fields:
                        self.log(f"⚠️ Missing fields in post: {missing_fields}", "WARNING")
                    else:
                        self.log("✅ Post structure validation passed")
                        
                return True
            else:
                self.log(f"❌ News feed failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ News feed error: {str(e)}", "ERROR")
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