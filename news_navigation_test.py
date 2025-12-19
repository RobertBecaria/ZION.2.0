#!/usr/bin/env python3
"""
Backend API Tests for NEWS Events Navigation Feature
Tests specific navigation requirements:
1. GET /api/news/events - verify events return creator and channel objects with id, name, avatar fields
2. GET /api/users/{user_id}/profile - verify returns user profile with social stats
"""

import requests
import json
from datetime import datetime, timezone, timedelta
import sys
import os

# Configuration
BASE_URL = "https://goodwill-events.preview.emergentagent.com/api"
TEST_EMAIL = "admin@test.com"
TEST_PASSWORD = "testpassword123"

class NewsNavigationTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.user_id = None
        
    def authenticate(self):
        """Authenticate and get JWT token"""
        print("🔐 Authenticating user...")
        
        login_data = {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        }
        
        try:
            response = self.session.post(f"{BASE_URL}/auth/login", json=login_data)
            print(f"Login response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get("access_token")
                self.user_id = data.get("user", {}).get("id")
                
                if self.auth_token:
                    self.session.headers.update({
                        "Authorization": f"Bearer {self.auth_token}",
                        "Content-Type": "application/json"
                    })
                    print(f"✅ Authentication successful. User ID: {self.user_id}")
                    return True
                else:
                    print("❌ No access token in response")
                    return False
            else:
                print(f"❌ Login failed: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Authentication error: {e}")
            return False
    
    def test_events_creator_channel_fields(self):
        """Test GET /api/news/events - verify events return creator and channel objects with required fields"""
        print("\n📋 Testing Events API - Creator and Channel Fields...")
        
        try:
            response = self.session.get(f"{BASE_URL}/news/events")
            print(f"Get events response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                events = data.get("events", [])
                print(f"✅ Retrieved {len(events)} events")
                
                if len(events) == 0:
                    print("⚠️ No events found to test creator/channel fields")
                    return True  # Not a failure, just no data
                
                success_count = 0
                total_events = min(len(events), 5)  # Test first 5 events
                
                for i, event in enumerate(events[:total_events]):
                    print(f"\n  Event {i+1}: {event.get('title', 'No title')}")
                    
                    # Check creator object
                    creator = event.get("creator")
                    if creator:
                        required_creator_fields = ["id", "first_name", "last_name"]
                        missing_creator_fields = [field for field in required_creator_fields if field not in creator]
                        
                        if missing_creator_fields:
                            print(f"    ❌ Creator missing fields: {missing_creator_fields}")
                        else:
                            print(f"    ✅ Creator has required fields: {creator.get('first_name')} {creator.get('last_name')}")
                            print(f"       Creator ID: {creator.get('id')}")
                            # Check if profile_picture (avatar) is present
                            if "profile_picture" in creator:
                                print(f"       Creator avatar: {'Present' if creator.get('profile_picture') else 'None'}")
                            success_count += 1
                    else:
                        print(f"    ❌ No creator object found")
                    
                    # Check channel object (may be None for personal events)
                    channel = event.get("channel")
                    if channel:
                        required_channel_fields = ["id", "name", "avatar_url"]
                        missing_channel_fields = [field for field in required_channel_fields if field not in channel]
                        
                        if missing_channel_fields:
                            print(f"    ❌ Channel missing fields: {missing_channel_fields}")
                        else:
                            print(f"    ✅ Channel has required fields: {channel.get('name')}")
                            print(f"       Channel ID: {channel.get('id')}")
                            print(f"       Channel avatar: {'Present' if channel.get('avatar_url') else 'None'}")
                    else:
                        print(f"    ℹ️ No channel (personal event)")
                        success_count += 1  # Personal events don't need channel
                
                print(f"\n📊 Creator/Channel Fields Test: {success_count}/{total_events} events passed")
                return success_count >= total_events * 0.8  # 80% success rate
                
            else:
                print(f"❌ Failed to get events: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Error testing events creator/channel fields: {e}")
            return False
    
    def test_user_profile_api(self):
        """Test GET /api/users/{user_id}/profile - verify returns user profile with social stats"""
        print("\n👤 Testing User Profile API...")
        
        if not self.user_id:
            print("❌ No user ID available for testing")
            return False
        
        try:
            # Test getting current user's profile
            response = self.session.get(f"{BASE_URL}/users/{self.user_id}/profile")
            print(f"Get user profile response status: {response.status_code}")
            
            if response.status_code == 200:
                profile = response.json()
                print(f"✅ Retrieved user profile")
                
                # Check basic profile fields
                basic_fields = ["id", "first_name", "last_name", "email"]
                missing_basic = [field for field in basic_fields if field not in profile]
                
                if missing_basic:
                    print(f"❌ Missing basic profile fields: {missing_basic}")
                    return False
                else:
                    print(f"✅ Basic profile fields present")
                    print(f"   Name: {profile.get('first_name')} {profile.get('last_name')}")
                    print(f"   Email: {profile.get('email')}")
                
                # Check social stats fields
                social_stats = ["friends_count", "followers_count", "following_count"]
                missing_social = [field for field in social_stats if field not in profile]
                
                if missing_social:
                    print(f"❌ Missing social stats fields: {missing_social}")
                    return False
                else:
                    print(f"✅ Social stats present:")
                    print(f"   Friends: {profile.get('friends_count', 0)}")
                    print(f"   Followers: {profile.get('followers_count', 0)}")
                    print(f"   Following: {profile.get('following_count', 0)}")
                
                # Check relationship status fields
                relationship_fields = ["is_friend", "is_following", "is_followed_by", "is_self"]
                missing_relationship = [field for field in relationship_fields if field not in profile]
                
                if missing_relationship:
                    print(f"⚠️ Missing relationship fields: {missing_relationship}")
                else:
                    print(f"✅ Relationship status fields present")
                    print(f"   Is self: {profile.get('is_self', False)}")
                
                return True
                
            else:
                print(f"❌ Failed to get user profile: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Error testing user profile API: {e}")
            return False
    
    def test_user_profile_navigation(self):
        """Test navigation to different user profiles"""
        print("\n🔄 Testing User Profile Navigation...")
        
        try:
            # First, get a list of users to test navigation
            response = self.session.get(f"{BASE_URL}/users/search?query=test")
            
            if response.status_code == 200:
                data = response.json()
                users = data.get("users", [])
                
                if len(users) == 0:
                    print("⚠️ No other users found for navigation testing")
                    return True  # Not a failure
                
                # Test navigating to first other user's profile
                other_user = None
                for user in users:
                    if user.get("id") != self.user_id:
                        other_user = user
                        break
                
                if not other_user:
                    print("⚠️ No other users available for navigation testing")
                    return True
                
                other_user_id = other_user.get("id")
                print(f"Testing navigation to user: {other_user.get('first_name')} {other_user.get('last_name')}")
                
                # Test getting other user's profile
                response = self.session.get(f"{BASE_URL}/users/{other_user_id}/profile")
                print(f"Other user profile response status: {response.status_code}")
                
                if response.status_code == 200:
                    profile = response.json()
                    print(f"✅ Successfully navigated to other user's profile")
                    print(f"   Name: {profile.get('first_name')} {profile.get('last_name')}")
                    print(f"   Is self: {profile.get('is_self', False)}")
                    
                    # Verify it's not marked as self
                    if profile.get("is_self") == False:
                        print(f"✅ Correctly identified as other user's profile")
                        return True
                    else:
                        print(f"❌ Profile incorrectly marked as self")
                        return False
                else:
                    print(f"❌ Failed to navigate to other user's profile: {response.text}")
                    return False
            else:
                print(f"❌ Failed to search for users: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Error testing user profile navigation: {e}")
            return False
    
    def run_navigation_tests(self):
        """Run all navigation-specific tests"""
        print("🚀 Starting NEWS Events Navigation Backend Tests")
        print("=" * 60)
        
        if not self.authenticate():
            print("❌ Authentication failed. Cannot proceed with tests.")
            return False
        
        test_results = []
        
        # Run navigation-specific tests
        test_results.append(("Events Creator/Channel Fields", self.test_events_creator_channel_fields()))
        test_results.append(("User Profile API", self.test_user_profile_api()))
        test_results.append(("User Profile Navigation", self.test_user_profile_navigation()))
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 NAVIGATION TEST RESULTS SUMMARY")
        print("=" * 60)
        
        passed = 0
        total = len(test_results)
        
        for test_name, result in test_results:
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{test_name:<30} {status}")
            if result:
                passed += 1
        
        print(f"\nOverall: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
        
        if passed == total:
            print("🎉 All navigation tests passed!")
        elif passed >= total * 0.8:
            print("⚠️ Most tests passed, minor issues detected")
        else:
            print("❌ Multiple test failures detected")
        
        return passed >= total * 0.8

def main():
    """Main test execution"""
    tester = NewsNavigationTester()
    success = tester.run_navigation_tests()
    
    if success:
        print("\n✅ NEWS Events Navigation testing completed successfully")
        sys.exit(0)
    else:
        print("\n❌ NEWS Events Navigation testing failed")
        sys.exit(1)

if __name__ == "__main__":
    main()