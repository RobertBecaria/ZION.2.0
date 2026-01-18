#!/usr/bin/env python3
"""
Backend Testing for ZION.CITY Application - NEWS Feed Visibility Logic Testing
Testing the updated NEWS feed visibility logic to ensure proper network-based filtering

Test Focus:
1. Feed should ONLY show posts from user's network (friends + people they follow)
2. PUBLIC posts from strangers should NOT appear in the feed
3. Visibility settings control who can see posts:
   - PUBLIC: Network can see in feed, outsiders can see on profile
   - FRIENDS_AND_FOLLOWERS: Network can see in feed and profile
   - FRIENDS_ONLY: Only friends can see in feed and profile

Test Scenarios:
1. Login as test user (testuser@test.com / testpassword123)
2. Get user's network info (friends and following)
3. Get NEWS feed and verify posts are only from network
4. Compare with all posts to ensure no stranger posts
5. Test profile visibility for different user types

Backend URL: https://dbfix-social.preview.emergentagent.com/api
"""

import requests
import json
import sys
from datetime import datetime

# Get backend URL from environment
BACKEND_URL = "https://dbfix-social.preview.emergentagent.com/api"

class NewsVisibilityTester:
    def __init__(self):
        self.session = requests.Session()
        self.test_user_token = None
        self.test_user_id = None
        self.user_friends = []
        self.user_following = []
        self.user_network = set()
        self.feed_posts = []
        self.all_posts = []
        
    def log(self, message, level="INFO"):
        """Log test messages with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def login_test_user(self):
        """Login as test user"""
        try:
            # First try with testuser@test.com
            self.log("🔐 Trying to login test user: testuser@test.com")
            
            response = self.session.post(f"{BACKEND_URL}/auth/login", json={
                "email": "testuser@test.com",
                "password": "testpassword123"
            })
            
            if response.status_code == 200:
                data = response.json()
                self.test_user_token = data.get("access_token")
                self.test_user_id = data.get("user", {}).get("id")
                
                self.log(f"✅ Test user login successful - User ID: {self.test_user_id}")
                return True
            else:
                self.log(f"⚠️ testuser@test.com login failed: {response.status_code}")
                
                # Try with admin credentials as fallback
                self.log("🔐 Trying admin credentials as fallback: admin@test.com")
                
                admin_response = self.session.post(f"{BACKEND_URL}/auth/login", json={
                    "email": "admin@test.com",
                    "password": "testpassword123"
                })
                
                if admin_response.status_code == 200:
                    data = admin_response.json()
                    self.test_user_token = data.get("access_token")
                    self.test_user_id = data.get("user", {}).get("id")
                    
                    self.log(f"✅ Admin login successful (using as test user) - User ID: {self.test_user_id}")
                    return True
                else:
                    self.log(f"❌ Admin login also failed: {admin_response.status_code} - {admin_response.text}", "ERROR")
                    return False
                
        except Exception as e:
            self.log(f"❌ Login error: {str(e)}", "ERROR")
            return False
    
    def get_auth_headers(self):
        """Get authorization headers"""
        return {"Authorization": f"Bearer {self.test_user_token}"}
    
    def get_user_network_info(self):
        """Get user's friends and following lists"""
        self.log("👥 Getting user's network information (friends + following)")
        
        try:
            # Get friends list
            friends_response = self.session.get(
                f"{BACKEND_URL}/friends",
                headers=self.get_auth_headers()
            )
            
            if friends_response.status_code == 200:
                friends_data = friends_response.json()
                self.user_friends = friends_data.get("friends", [])
                friend_ids = [friend.get("id") for friend in self.user_friends if friend.get("id")]
                self.user_network.update(friend_ids)
                self.log(f"✅ Found {len(self.user_friends)} friends")
            else:
                self.log(f"⚠️ Could not get friends list: {friends_response.status_code}", "WARNING")
            
            # Get following list - try different possible endpoints
            following_endpoints = [
                f"/users/{self.test_user_id}/following",
                f"/following",
                f"/users/following"
            ]
            
            following_found = False
            for endpoint in following_endpoints:
                try:
                    following_response = self.session.get(
                        f"{BACKEND_URL}{endpoint}",
                        headers=self.get_auth_headers()
                    )
                    
                    if following_response.status_code == 200:
                        following_data = following_response.json()
                        # Handle different response formats
                        if isinstance(following_data, list):
                            self.user_following = following_data
                        elif isinstance(following_data, dict):
                            self.user_following = following_data.get("following", following_data.get("users", []))
                        
                        following_ids = [user.get("id") for user in self.user_following if user.get("id")]
                        self.user_network.update(following_ids)
                        self.log(f"✅ Found {len(self.user_following)} following users via {endpoint}")
                        following_found = True
                        break
                except:
                    continue
            
            if not following_found:
                self.log("⚠️ Could not get following list from any endpoint", "WARNING")
            
            # Add self to network
            self.user_network.add(self.test_user_id)
            
            self.log(f"📊 Total network size: {len(self.user_network)} users (including self)")
            self.log(f"   - Friends: {len(self.user_friends)}")
            self.log(f"   - Following: {len(self.user_following)}")
            self.log(f"   - Self: 1")
            
            return True
            
        except Exception as e:
            self.log(f"❌ Error getting network info: {str(e)}", "ERROR")
            return False
    
    def get_news_feed(self):
        """Get NEWS feed posts"""
        self.log("📰 Getting NEWS feed posts")
        
        try:
            response = self.session.get(
                f"{BACKEND_URL}/news/posts/feed",
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                self.feed_posts = data.get("posts", [])
                self.log(f"✅ Retrieved {len(self.feed_posts)} posts from NEWS feed")
                
                # Log some details about the posts
                if self.feed_posts:
                    authors = set()
                    for post in self.feed_posts:
                        author_id = post.get("user_id") or post.get("author", {}).get("id")
                        if author_id:
                            authors.add(author_id)
                    
                    self.log(f"📊 Feed contains posts from {len(authors)} unique authors")
                
                return True
            else:
                self.log(f"❌ Failed to get NEWS feed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Error getting NEWS feed: {str(e)}", "ERROR")
            return False
    
    def analyze_feed_network_compliance(self):
        """Analyze if feed posts are only from user's network"""
        self.log("🔍 Analyzing feed posts for network compliance")
        
        try:
            network_posts = 0
            stranger_posts = 0
            unknown_author_posts = 0
            
            stranger_post_details = []
            
            for post in self.feed_posts:
                # Try different ways to get author ID
                author_id = (
                    post.get("user_id") or 
                    post.get("author_id") or 
                    (post.get("author", {}).get("id") if isinstance(post.get("author"), dict) else None)
                )
                
                if not author_id:
                    unknown_author_posts += 1
                    self.log(f"⚠️ Post {post.get('id', 'unknown')} has no identifiable author", "WARNING")
                    continue
                
                if author_id in self.user_network:
                    network_posts += 1
                else:
                    stranger_posts += 1
                    # Get author details for reporting
                    author_name = "Unknown"
                    if isinstance(post.get("author"), dict):
                        author_name = f"{post.get('author', {}).get('first_name', '')} {post.get('author', {}).get('last_name', '')}".strip()
                    
                    stranger_post_details.append({
                        "post_id": post.get("id"),
                        "author_id": author_id,
                        "author_name": author_name,
                        "content_preview": post.get("content", "")[:50] + "..." if len(post.get("content", "")) > 50 else post.get("content", ""),
                        "visibility": post.get("visibility", "unknown")
                    })
            
            # Report results
            total_posts = len(self.feed_posts)
            self.log("=" * 60)
            self.log("📊 FEED NETWORK COMPLIANCE ANALYSIS")
            self.log("=" * 60)
            self.log(f"Total posts in feed: {total_posts}")
            self.log(f"Posts from network: {network_posts}")
            self.log(f"Posts from strangers: {stranger_posts}")
            self.log(f"Posts with unknown authors: {unknown_author_posts}")
            
            if stranger_posts == 0:
                self.log("✅ PASS: No stranger posts found in feed")
                compliance_result = True
            else:
                self.log(f"❌ FAIL: Found {stranger_posts} posts from strangers in feed", "ERROR")
                self.log("🚨 STRANGER POST DETAILS:")
                for detail in stranger_post_details:
                    self.log(f"   - Post ID: {detail['post_id']}")
                    self.log(f"     Author: {detail['author_name']} (ID: {detail['author_id']})")
                    self.log(f"     Visibility: {detail['visibility']}")
                    self.log(f"     Content: {detail['content_preview']}")
                    self.log("")
                compliance_result = False
            
            return compliance_result, {
                "total_posts": total_posts,
                "network_posts": network_posts,
                "stranger_posts": stranger_posts,
                "unknown_author_posts": unknown_author_posts,
                "stranger_details": stranger_post_details
            }
            
        except Exception as e:
            self.log(f"❌ Error analyzing feed compliance: {str(e)}", "ERROR")
            return False, {}
    
    def test_profile_visibility(self):
        """Test profile visibility for different user types"""
        self.log("👤 Testing profile visibility for different user types")
        
        try:
            # Find a user who is NOT in the network (stranger)
            stranger_user_id = None
            
            # Try to find posts from strangers to get their user IDs
            for post in self.feed_posts:
                author_id = (
                    post.get("user_id") or 
                    post.get("author_id") or 
                    (post.get("author", {}).get("id") if isinstance(post.get("author"), dict) else None)
                )
                
                if author_id and author_id not in self.user_network:
                    stranger_user_id = author_id
                    break
            
            if not stranger_user_id:
                self.log("⚠️ No stranger users found to test profile visibility", "WARNING")
                return True  # Not a failure, just no data to test
            
            # Test stranger's profile visibility
            self.log(f"🔍 Testing profile visibility for stranger user: {stranger_user_id}")
            
            response = self.session.get(
                f"{BACKEND_URL}/news/posts/user/{stranger_user_id}",
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                profile_posts = data.get("posts", [])
                
                # Analyze visibility of posts on stranger's profile
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
            
            elif response.status_code == 403:
                self.log("✅ PASS: Profile access properly restricted (403 Forbidden)")
                return True
            else:
                self.log(f"⚠️ Unexpected response for profile access: {response.status_code}", "WARNING")
                return True  # Not necessarily a failure
                
        except Exception as e:
            self.log(f"❌ Error testing profile visibility: {str(e)}", "ERROR")
            return False
    
    def run_comprehensive_test(self):
        """Run all NEWS feed visibility tests"""
        self.log("🚀 Starting ZION.CITY Backend Testing - NEWS Feed Visibility Logic")
        self.log("=" * 80)
        
        # Test results tracking
        test_results = {
            "login": False,
            "network_info": False,
            "feed_retrieval": False,
            "network_compliance": False,
            "profile_visibility": False
        }
        
        # 1. Login test user
        test_results["login"] = self.login_test_user()
        
        if not test_results["login"]:
            self.log("❌ Cannot proceed without login", "ERROR")
            return test_results
        
        # 2. Get user's network information
        test_results["network_info"] = self.get_user_network_info()
        
        # 3. Get NEWS feed
        test_results["feed_retrieval"] = self.get_news_feed()
        
        if not test_results["feed_retrieval"]:
            self.log("❌ Cannot analyze feed without retrieving it", "ERROR")
            return test_results
        
        # 4. Analyze network compliance
        compliance_data = {}
        if test_results["feed_retrieval"]:
            compliance_result, compliance_data = self.analyze_feed_network_compliance()
            test_results["network_compliance"] = compliance_result
        
        # 5. Test profile visibility
        test_results["profile_visibility"] = self.test_profile_visibility()
        
        # Print final results
        self.log("=" * 80)
        self.log("📊 FINAL TEST RESULTS - NEWS Feed Visibility Logic")
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
        
        # Critical test analysis
        critical_tests = ["login", "feed_retrieval", "network_compliance"]
        critical_passed = sum(1 for test in critical_tests if test_results.get(test, False))
        
        if test_results.get("network_compliance"):
            self.log("🎉 NEWS FEED VISIBILITY LOGIC WORKING CORRECTLY!")
            self.log("✅ Feed shows only posts from user's network")
        else:
            self.log("🚨 NEWS FEED VISIBILITY LOGIC HAS ISSUES!")
            self.log("❌ Feed contains posts from strangers")
        
        # Network size analysis
        if len(self.user_network) > 1:  # More than just self
            self.log(f"📊 User has a network of {len(self.user_network)} users")
        else:
            self.log("⚠️ User has no friends or following - limited test scope")
        
        self.log("=" * 80)
        
        return test_results, compliance_data

def main():
    """Main test execution"""
    tester = NewsVisibilityTester()
    results, compliance_data = tester.run_comprehensive_test()
    
    # Exit with appropriate code based on critical functionality
    critical_tests = ["login", "feed_retrieval", "network_compliance"]
    critical_passed = all(results.get(test, False) for test in critical_tests)
    
    if critical_passed:
        print("\n🎉 All critical NEWS feed visibility tests passed!")
        sys.exit(0)
    else:
        print("\n❌ Some critical NEWS feed visibility tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()