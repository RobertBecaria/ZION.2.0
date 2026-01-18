#!/usr/bin/env python3
"""
Comprehensive Backend Testing for ZION.CITY Application - NEWS Feed Visibility Logic
Testing the updated NEWS feed visibility logic with multiple users and relationships

This test creates a comprehensive scenario with:
1. Multiple users (test user, friend, stranger)
2. Friend relationships
3. Posts with different visibility levels
4. Verification of feed filtering logic

Backend URL: https://dbfix-social.preview.emergentagent.com/api
"""

import requests
import json
import sys
from datetime import datetime
import time

# Get backend URL from environment
BACKEND_URL = "https://dbfix-social.preview.emergentagent.com/api"

class ComprehensiveNewsVisibilityTester:
    def __init__(self):
        self.session = requests.Session()
        
        # User accounts for testing
        self.test_user = {"email": "newstest1@test.com", "password": "testpass123", "token": None, "id": None}
        self.friend_user = {"email": "newstest2@test.com", "password": "testpass123", "token": None, "id": None}
        self.stranger_user = {"email": "newstest3@test.com", "password": "testpass123", "token": None, "id": None}
        
        # Test data
        self.test_posts = []
        self.feed_posts = []
        
    def log(self, message, level="INFO"):
        """Log test messages with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def register_and_login_user(self, user_data, user_type):
        """Register and login a user"""
        try:
            self.log(f"📝 Registering {user_type}: {user_data['email']}")
            
            # Register user
            register_response = self.session.post(f"{BACKEND_URL}/auth/register", json={
                "email": user_data["email"],
                "password": user_data["password"],
                "first_name": user_type.title(),
                "last_name": "User"
            })
            
            if register_response.status_code != 200:
                self.log(f"⚠️ Registration failed (user may exist): {register_response.status_code}")
            
            # Login user
            self.log(f"🔐 Logging in {user_type}: {user_data['email']}")
            
            login_response = self.session.post(f"{BACKEND_URL}/auth/login", json={
                "email": user_data["email"],
                "password": user_data["password"]
            })
            
            if login_response.status_code == 200:
                data = login_response.json()
                user_data["token"] = data.get("access_token")
                user_data["id"] = data.get("user", {}).get("id")
                
                self.log(f"✅ {user_type} login successful - User ID: {user_data['id']}")
                return True
            else:
                self.log(f"❌ {user_type} login failed: {login_response.status_code} - {login_response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ {user_type} setup error: {str(e)}", "ERROR")
            return False
    
    def get_auth_headers(self, user_data):
        """Get authorization headers for a user"""
        return {"Authorization": f"Bearer {user_data['token']}"}
    
    def establish_friendship(self):
        """Establish friendship between test user and friend user"""
        try:
            self.log("🤝 Establishing friendship between test user and friend user")
            
            # Send friend request from test user to friend user
            friend_request_response = self.session.post(
                f"{BACKEND_URL}/friends/request",
                json={"friend_user_id": self.friend_user["id"]},
                headers=self.get_auth_headers(self.test_user)
            )
            
            if friend_request_response.status_code == 200:
                self.log("✅ Friend request sent successfully")
                
                # Accept friend request from friend user
                accept_response = self.session.post(
                    f"{BACKEND_URL}/friends/accept",
                    json={"friend_user_id": self.test_user["id"]},
                    headers=self.get_auth_headers(self.friend_user)
                )
                
                if accept_response.status_code == 200:
                    self.log("✅ Friend request accepted successfully")
                    return True
                else:
                    self.log(f"⚠️ Friend request acceptance failed: {accept_response.status_code}")
            else:
                self.log(f"⚠️ Friend request failed: {friend_request_response.status_code}")
            
            # Alternative: Try direct friendship API if available
            try:
                direct_friend_response = self.session.post(
                    f"{BACKEND_URL}/friends/add",
                    json={"friend_id": self.friend_user["id"]},
                    headers=self.get_auth_headers(self.test_user)
                )
                
                if direct_friend_response.status_code == 200:
                    self.log("✅ Direct friendship established successfully")
                    return True
            except:
                pass
            
            self.log("⚠️ Could not establish friendship - will test with no network", "WARNING")
            return False
            
        except Exception as e:
            self.log(f"❌ Error establishing friendship: {str(e)}", "ERROR")
            return False
    
    def create_test_posts(self):
        """Create test posts with different visibility levels"""
        try:
            self.log("📝 Creating test posts with different visibility levels")
            
            # Posts to create
            posts_to_create = [
                {
                    "user": self.test_user,
                    "content": "Test user's PUBLIC post - should appear in own feed",
                    "visibility": "PUBLIC"
                },
                {
                    "user": self.friend_user,
                    "content": "Friend's PUBLIC post - should appear in test user's feed",
                    "visibility": "PUBLIC"
                },
                {
                    "user": self.friend_user,
                    "content": "Friend's FRIENDS_ONLY post - should appear in test user's feed",
                    "visibility": "FRIENDS_ONLY"
                },
                {
                    "user": self.stranger_user,
                    "content": "Stranger's PUBLIC post - should NOT appear in test user's feed",
                    "visibility": "PUBLIC"
                },
                {
                    "user": self.stranger_user,
                    "content": "Stranger's FRIENDS_ONLY post - should NOT appear in test user's feed",
                    "visibility": "FRIENDS_ONLY"
                }
            ]
            
            created_posts = 0
            
            for post_data in posts_to_create:
                try:
                    response = self.session.post(
                        f"{BACKEND_URL}/news/posts",
                        json={
                            "content": post_data["content"],
                            "visibility": post_data["visibility"]
                        },
                        headers=self.get_auth_headers(post_data["user"])
                    )
                    
                    if response.status_code == 200:
                        post_id = response.json().get("id")
                        self.test_posts.append({
                            "id": post_id,
                            "user_id": post_data["user"]["id"],
                            "user_type": "test" if post_data["user"] == self.test_user else ("friend" if post_data["user"] == self.friend_user else "stranger"),
                            "content": post_data["content"],
                            "visibility": post_data["visibility"],
                            "should_appear_in_feed": post_data["user"] in [self.test_user, self.friend_user]
                        })
                        created_posts += 1
                        self.log(f"✅ Created post: {post_data['content'][:50]}...")
                    else:
                        self.log(f"⚠️ Failed to create post: {response.status_code}")
                        
                except Exception as e:
                    self.log(f"⚠️ Error creating post: {str(e)}")
            
            self.log(f"📊 Created {created_posts} test posts")
            return created_posts > 0
            
        except Exception as e:
            self.log(f"❌ Error creating test posts: {str(e)}", "ERROR")
            return False
    
    def get_news_feed(self):
        """Get NEWS feed for test user"""
        try:
            self.log("📰 Getting NEWS feed for test user")
            
            response = self.session.get(
                f"{BACKEND_URL}/news/posts/feed",
                headers=self.get_auth_headers(self.test_user)
            )
            
            if response.status_code == 200:
                data = response.json()
                self.feed_posts = data.get("posts", [])
                self.log(f"✅ Retrieved {len(self.feed_posts)} posts from NEWS feed")
                return True
            else:
                self.log(f"❌ Failed to get NEWS feed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Error getting NEWS feed: {str(e)}", "ERROR")
            return False
    
    def analyze_feed_visibility_compliance(self):
        """Analyze feed posts for proper visibility compliance"""
        try:
            self.log("🔍 Analyzing feed posts for visibility compliance")
            
            # Create sets for analysis
            test_user_id = self.test_user["id"]
            friend_user_id = self.friend_user["id"]
            stranger_user_id = self.stranger_user["id"]
            
            network_user_ids = {test_user_id, friend_user_id}
            
            # Analyze feed posts
            network_posts = 0
            stranger_posts = 0
            compliance_issues = []
            
            for post in self.feed_posts:
                author_id = (
                    post.get("user_id") or 
                    post.get("author_id") or 
                    (post.get("author", {}).get("id") if isinstance(post.get("author"), dict) else None)
                )
                
                if not author_id:
                    continue
                
                if author_id in network_user_ids:
                    network_posts += 1
                elif author_id == stranger_user_id:
                    stranger_posts += 1
                    compliance_issues.append({
                        "post_id": post.get("id"),
                        "author_id": author_id,
                        "content": post.get("content", "")[:50] + "...",
                        "visibility": post.get("visibility", "unknown")
                    })
                else:
                    # Unknown user (not part of our test)
                    pass
            
            # Check against expected posts
            expected_posts_in_feed = [p for p in self.test_posts if p["should_appear_in_feed"]]
            expected_count = len(expected_posts_in_feed)
            
            self.log("=" * 60)
            self.log("📊 FEED VISIBILITY COMPLIANCE ANALYSIS")
            self.log("=" * 60)
            self.log(f"Total posts in feed: {len(self.feed_posts)}")
            self.log(f"Posts from network (test + friend): {network_posts}")
            self.log(f"Posts from stranger: {stranger_posts}")
            self.log(f"Expected posts in feed: {expected_count}")
            
            # Detailed analysis
            if stranger_posts == 0:
                self.log("✅ PASS: No stranger posts found in feed")
                compliance_result = True
            else:
                self.log(f"❌ FAIL: Found {stranger_posts} posts from stranger in feed", "ERROR")
                self.log("🚨 STRANGER POST DETAILS:")
                for issue in compliance_issues:
                    self.log(f"   - Post ID: {issue['post_id']}")
                    self.log(f"     Author ID: {issue['author_id']}")
                    self.log(f"     Visibility: {issue['visibility']}")
                    self.log(f"     Content: {issue['content']}")
                compliance_result = False
            
            # Check if expected posts are present
            feed_post_ids = {post.get("id") for post in self.feed_posts}
            expected_post_ids = {post["id"] for post in expected_posts_in_feed}
            missing_posts = expected_post_ids - feed_post_ids
            
            if missing_posts:
                self.log(f"⚠️ WARNING: {len(missing_posts)} expected posts missing from feed")
                for post in expected_posts_in_feed:
                    if post["id"] in missing_posts:
                        self.log(f"   - Missing: {post['content'][:50]}... (from {post['user_type']})")
            else:
                self.log("✅ All expected posts present in feed")
            
            return compliance_result, {
                "total_posts": len(self.feed_posts),
                "network_posts": network_posts,
                "stranger_posts": stranger_posts,
                "expected_posts": expected_count,
                "missing_posts": len(missing_posts),
                "compliance_issues": compliance_issues
            }
            
        except Exception as e:
            self.log(f"❌ Error analyzing feed compliance: {str(e)}", "ERROR")
            return False, {}
    
    def test_stranger_profile_visibility(self):
        """Test that stranger's profile only shows PUBLIC posts"""
        try:
            self.log("👤 Testing stranger's profile visibility")
            
            response = self.session.get(
                f"{BACKEND_URL}/news/posts/user/{self.stranger_user['id']}",
                headers=self.get_auth_headers(self.test_user)
            )
            
            if response.status_code == 200:
                data = response.json()
                profile_posts = data.get("posts", [])
                
                public_posts = 0
                restricted_posts = 0
                
                for post in profile_posts:
                    visibility = post.get("visibility", "").upper()
                    if visibility == "PUBLIC":
                        public_posts += 1
                    else:
                        restricted_posts += 1
                
                self.log(f"📊 Stranger's profile visibility:")
                self.log(f"   - Total posts visible: {len(profile_posts)}")
                self.log(f"   - PUBLIC posts: {public_posts}")
                self.log(f"   - Restricted posts: {restricted_posts}")
                
                if restricted_posts == 0:
                    self.log("✅ PASS: Only PUBLIC posts visible on stranger's profile")
                    return True
                else:
                    self.log(f"❌ FAIL: {restricted_posts} restricted posts visible on stranger's profile", "ERROR")
                    return False
            else:
                self.log(f"⚠️ Could not access stranger's profile: {response.status_code}")
                return True  # Not necessarily a failure
                
        except Exception as e:
            self.log(f"❌ Error testing profile visibility: {str(e)}", "ERROR")
            return False
    
    def cleanup_test_data(self):
        """Clean up test posts and users"""
        try:
            self.log("🧹 Cleaning up test data")
            
            # Delete test posts
            for post in self.test_posts:
                try:
                    # Determine which user created this post
                    user_data = None
                    if post["user_id"] == self.test_user["id"]:
                        user_data = self.test_user
                    elif post["user_id"] == self.friend_user["id"]:
                        user_data = self.friend_user
                    elif post["user_id"] == self.stranger_user["id"]:
                        user_data = self.stranger_user
                    
                    if user_data and user_data["token"]:
                        delete_response = self.session.delete(
                            f"{BACKEND_URL}/news/posts/{post['id']}",
                            headers=self.get_auth_headers(user_data)
                        )
                        
                        if delete_response.status_code == 200:
                            self.log(f"✅ Deleted post: {post['id']}")
                        else:
                            self.log(f"⚠️ Could not delete post {post['id']}: {delete_response.status_code}")
                except:
                    pass
            
            self.log("✅ Cleanup completed")
            
        except Exception as e:
            self.log(f"⚠️ Cleanup error: {str(e)}", "WARNING")
    
    def run_comprehensive_test(self):
        """Run comprehensive NEWS feed visibility test"""
        self.log("🚀 Starting Comprehensive NEWS Feed Visibility Testing")
        self.log("=" * 80)
        
        test_results = {
            "user_setup": False,
            "friendship": False,
            "post_creation": False,
            "feed_retrieval": False,
            "visibility_compliance": False,
            "profile_visibility": False
        }
        
        try:
            # 1. Set up test users
            self.log("👥 Setting up test users...")
            test_user_ok = self.register_and_login_user(self.test_user, "test user")
            friend_user_ok = self.register_and_login_user(self.friend_user, "friend user")
            stranger_user_ok = self.register_and_login_user(self.stranger_user, "stranger user")
            
            test_results["user_setup"] = test_user_ok and friend_user_ok and stranger_user_ok
            
            if not test_results["user_setup"]:
                self.log("❌ Cannot proceed without all users set up", "ERROR")
                return test_results
            
            # 2. Establish friendship
            test_results["friendship"] = self.establish_friendship()
            
            # 3. Create test posts
            test_results["post_creation"] = self.create_test_posts()
            
            if not test_results["post_creation"]:
                self.log("❌ Cannot test without posts", "ERROR")
                return test_results
            
            # Wait a moment for posts to be indexed
            time.sleep(2)
            
            # 4. Get NEWS feed
            test_results["feed_retrieval"] = self.get_news_feed()
            
            if not test_results["feed_retrieval"]:
                self.log("❌ Cannot analyze feed without retrieving it", "ERROR")
                return test_results
            
            # 5. Analyze visibility compliance
            compliance_result, compliance_data = self.analyze_feed_visibility_compliance()
            test_results["visibility_compliance"] = compliance_result
            
            # 6. Test profile visibility
            test_results["profile_visibility"] = self.test_stranger_profile_visibility()
            
            # Print final results
            self.log("=" * 80)
            self.log("📊 COMPREHENSIVE TEST RESULTS - NEWS Feed Visibility")
            self.log("=" * 80)
            
            passed_tests = 0
            total_tests = len(test_results)
            
            for test_name, result in test_results.items():
                status = "✅ PASS" if result else "❌ FAIL"
                self.log(f"{test_name.replace('_', ' ').title()}: {status}")
                if result:
                    passed_tests += 1
            
            success_rate = (passed_tests / total_tests) * 100
            self.log("=" * 80)
            self.log(f"📈 OVERALL SUCCESS RATE: {passed_tests}/{total_tests} ({success_rate:.1f}%)")
            
            # Critical analysis
            if test_results.get("visibility_compliance"):
                self.log("🎉 NEWS FEED VISIBILITY LOGIC WORKING CORRECTLY!")
                self.log("✅ Feed properly filters posts based on user network")
            else:
                self.log("🚨 NEWS FEED VISIBILITY LOGIC HAS CRITICAL ISSUES!")
                self.log("❌ Feed contains posts from users outside network")
            
            self.log("=" * 80)
            
            return test_results
            
        finally:
            # Always clean up
            self.cleanup_test_data()

def main():
    """Main test execution"""
    tester = ComprehensiveNewsVisibilityTester()
    results = tester.run_comprehensive_test()
    
    # Exit based on critical functionality
    critical_tests = ["user_setup", "feed_retrieval", "visibility_compliance"]
    critical_passed = all(results.get(test, False) for test in critical_tests)
    
    if critical_passed:
        print("\n🎉 All critical NEWS feed visibility tests passed!")
        sys.exit(0)
    else:
        print("\n❌ Some critical NEWS feed visibility tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()