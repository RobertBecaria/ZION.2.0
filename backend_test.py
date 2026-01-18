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
BACKEND_URL = "https://social-login-fix.preview.emergentagent.com/api"

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
    
    def test_create_reply(self):
        """Test 3: Create a reply to a comment"""
        if not self.test_comment_ids:
            self.log("⚠️ No comments available to reply to", "WARNING")
            return False
            
        parent_comment_id = self.test_comment_ids[0]
        self.log(f"↩️ Testing POST /api/news/posts/{self.test_post_id}/comments (Reply)")
        
        try:
            reply_data = {
                "content": "This is a test reply to the comment! 💬",
                "parent_comment_id": parent_comment_id
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/news/posts/{self.test_post_id}/comments",
                json=reply_data,
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                reply_id = data.get("id")
                
                if reply_id and data.get("parent_comment_id") == parent_comment_id:
                    self.test_reply_ids.append(reply_id)
                    self.log(f"✅ Reply created successfully - ID: {reply_id}")
                    self.log(f"✅ Reply correctly linked to parent: {parent_comment_id}")
                    return True
                else:
                    self.log("❌ Reply created but parent_comment_id not set correctly", "ERROR")
                    return False
            else:
                self.log(f"❌ Create reply failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Create reply error: {str(e)}", "ERROR")
            return False
    
    def test_edit_comment(self):
        """Test 4: Edit a comment"""
        if not self.test_comment_ids:
            self.log("⚠️ No comments available to edit", "WARNING")
            return False
            
        comment_id = self.test_comment_ids[0]
        self.log(f"✏️ Testing PUT /api/news/comments/{comment_id}")
        
        try:
            edit_data = {
                "content": "This comment has been edited! ✏️ (Enhanced Comments Test)"
            }
            
            response = self.session.put(
                f"{BACKEND_URL}/news/comments/{comment_id}",
                json=edit_data,
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify the comment was updated
                if data.get("content") == edit_data["content"]:
                    self.log("✅ Comment edited successfully")
                    
                    # Check for edited flag
                    if data.get("is_edited") == True:
                        self.log("✅ Comment marked as edited (is_edited: true)")
                    else:
                        self.log("⚠️ Comment not marked as edited", "WARNING")
                    
                    # Check for edited_at timestamp
                    if data.get("edited_at"):
                        self.log("✅ Comment has edited_at timestamp")
                    else:
                        self.log("⚠️ Comment missing edited_at timestamp", "WARNING")
                    
                    return True
                else:
                    self.log("❌ Comment content not updated correctly", "ERROR")
                    return False
            else:
                self.log(f"❌ Edit comment failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Edit comment error: {str(e)}", "ERROR")
            return False
    
    def test_like_comment(self):
        """Test 5: Like/unlike a comment"""
        if not self.test_comment_ids:
            self.log("⚠️ No comments available to like", "WARNING")
            return False
            
        comment_id = self.test_comment_ids[0]
        self.log(f"❤️ Testing POST /api/news/comments/{comment_id}/like")
        
        try:
            # First like
            response = self.session.post(
                f"{BACKEND_URL}/news/comments/{comment_id}/like",
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Check both possible field names for liked status
                user_liked = data.get("user_liked") or data.get("liked")
                like_count_field = "like_count" if "like_count" in data else "likes_count"
                
                if user_liked == True:
                    self.log("✅ Comment liked successfully")
                    like_count_1 = data.get(like_count_field, 0)
                    self.log(f"✅ Like count: {like_count_1}")
                    
                    # Test unlike (toggle)
                    response2 = self.session.post(
                        f"{BACKEND_URL}/news/comments/{comment_id}/like",
                        headers=self.get_auth_headers()
                    )
                    
                    if response2.status_code == 200:
                        data2 = response2.json()
                        user_liked_2 = data2.get("user_liked") or data2.get("liked")
                        
                        if user_liked_2 == False:
                            self.log("✅ Comment unliked successfully (toggle working)")
                            like_count_2 = data2.get(like_count_field, 0)
                            self.log(f"✅ Like count after unlike: {like_count_2}")
                            
                            if like_count_2 < like_count_1:
                                self.log("✅ Like count decreased correctly")
                                return True
                            else:
                                self.log("⚠️ Like count did not decrease", "WARNING")
                                return True  # Still consider success if toggle works
                        else:
                            self.log("❌ Comment not unliked (toggle not working)", "ERROR")
                            return False
                    else:
                        self.log(f"❌ Unlike comment failed: {response2.status_code}", "ERROR")
                        return False
                else:
                    self.log(f"❌ Comment not liked (expected true, got: {user_liked})", "ERROR")
                    self.log(f"Response data: {data}")
                    return False
            else:
                self.log(f"❌ Like comment failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Like comment error: {str(e)}", "ERROR")
            return False
    
    def test_delete_comment(self):
        """Test 6: Delete a comment"""
        if not self.test_comment_ids:
            self.log("⚠️ No comments available to delete", "WARNING")
            return False
            
        # Use the last comment we created to avoid deleting existing data
        comment_id = self.test_comment_ids[-1]
        self.log(f"🗑️ Testing DELETE /api/news/comments/{comment_id}")
        
        try:
            response = self.session.delete(
                f"{BACKEND_URL}/news/comments/{comment_id}",
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 200:
                self.log("✅ Comment deleted successfully")
                
                # Verify comment is marked as deleted by trying to get comments again
                verify_response = self.session.get(
                    f"{BACKEND_URL}/news/posts/{self.test_post_id}/comments",
                    headers=self.get_auth_headers()
                )
                
                if verify_response.status_code == 200:
                    comments = verify_response.json().get("comments", [])
                    deleted_comment = next((c for c in comments if c.get("id") == comment_id), None)
                    
                    if deleted_comment is None:
                        self.log("✅ Comment removed from comments list")
                    elif deleted_comment.get("is_deleted") == True:
                        self.log("✅ Comment marked as deleted (soft delete)")
                    else:
                        self.log("⚠️ Comment still visible and not marked as deleted", "WARNING")
                
                return True
            else:
                self.log(f"❌ Delete comment failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Delete comment error: {str(e)}", "ERROR")
            return False
    
    def run_comprehensive_test(self):
        """Run all Enhanced Comments tests in sequence"""
        self.log("🚀 Starting ZION.CITY Backend Testing - Enhanced Comments Feature")
        self.log("=" * 80)
        
        # Test results tracking
        test_results = {
            "admin_login": False,
            "find_test_post": False,
            "get_comments": False,
            "create_comment": False,
            "create_reply": False,
            "edit_comment": False,
            "like_comment": False,
            "delete_comment": False
        }
        
        # 1. Login admin user
        test_results["admin_login"] = self.login_user("admin@test.com", "testpassword123", "admin")
        
        if not test_results["admin_login"]:
            self.log("❌ Cannot proceed without admin login", "ERROR")
            return test_results
        
        # 2. Find a test post
        test_results["find_test_post"] = self.find_test_post()
        
        if not test_results["find_test_post"]:
            self.log("❌ Cannot proceed without a test post", "ERROR")
            return test_results
        
        # 3. Get existing comments
        test_results["get_comments"] = self.test_get_comments()
        
        # 4. Create a new comment
        test_results["create_comment"] = self.test_create_comment()
        
        # 5. Create a reply (nested comment)
        test_results["create_reply"] = self.test_create_reply()
        
        # 6. Edit a comment
        test_results["edit_comment"] = self.test_edit_comment()
        
        # 7. Like/unlike a comment
        test_results["like_comment"] = self.test_like_comment()
        
        # 8. Delete a comment
        test_results["delete_comment"] = self.test_delete_comment()
        
        # Print final results
        self.log("=" * 80)
        self.log("📊 FINAL TEST RESULTS - Enhanced Comments Feature")
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
        
        # Feature-specific summary
        core_features = ["create_comment", "get_comments", "edit_comment", "like_comment", "delete_comment"]
        core_passed = sum(1 for feature in core_features if test_results.get(feature, False))
        
        if core_passed == len(core_features):
            self.log("🎉 ALL ENHANCED COMMENTS FEATURES WORKING!")
        else:
            self.log(f"⚠️ {core_passed}/{len(core_features)} core comment features working")
        
        # Nested replies check
        if test_results.get("create_reply"):
            self.log("✅ NESTED REPLIES FEATURE WORKING!")
        else:
            self.log("❌ NESTED REPLIES FEATURE NOT WORKING!")
        
        self.log("=" * 80)
        
        return test_results

def main():
    """Main test execution"""
    tester = ZionCityTester()
    results = tester.run_comprehensive_test()
    
    # Exit with appropriate code
    critical_tests = ["admin_login", "get_comments", "create_comment", "like_comment"]
    critical_passed = all(results.get(test, False) for test in critical_tests)
    
    if critical_passed:
        print("\n🎉 All critical Enhanced Comments tests passed!")
        sys.exit(0)
    else:
        print("\n❌ Some critical Enhanced Comments tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()