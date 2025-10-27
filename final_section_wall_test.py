#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class FinalSectionWallTester:
    def __init__(self, base_url="https://zion-collab.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        if details and success:
            print(f"   Details: {details}")

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
            
            print(f"   Request: {method} {url} -> Status: {response.status_code}")
            return response
        except requests.exceptions.RequestException as e:
            print(f"❌ Network error for {method} {url}: {str(e)}")
            return None

    def setup_authentication(self):
        """Setup authentication with test user"""
        print("\n🔍 Setting up Authentication...")
        
        login_data = {
            "email": "test@example.com",
            "password": "password123"
        }
        
        response = self.make_request('POST', 'auth/login', login_data)
        
        if response and response.status_code == 200:
            data = response.json()
            self.token = data['access_token']
            self.user_id = data['user']['id']
            self.log_test("Authentication setup", True, f"User ID: {self.user_id}")
            return True
        else:
            self.log_test("Authentication setup", False, "Could not authenticate test user")
            return False

    def test_critical_scenario_1_family_module_filtering(self):
        """CRITICAL TEST 1: Family module posts - should return only family posts"""
        print("\n🎯 CRITICAL TEST 1: Family Module Post Filtering")
        
        response = self.make_request('GET', 'posts?module=family', auth_required=True)
        
        if response and response.status_code == 200:
            posts = response.json()
            
            # Verify we got posts
            if len(posts) == 0:
                self.log_test("Family module returns posts", False, "No posts returned")
                return False
            
            # Verify all posts are family posts
            family_posts = [p for p in posts if p.get('source_module') == 'family']
            non_family_posts = [p for p in posts if p.get('source_module') != 'family']
            
            if len(non_family_posts) == 0:
                self.log_test("Family module filtering", True, f"Found {len(family_posts)} family posts, no cross-module leakage")
                
                # Verify posts have proper structure
                valid_posts = 0
                for post in posts:
                    if all(field in post for field in ['id', 'content', 'source_module', 'author']):
                        valid_posts += 1
                
                if valid_posts == len(posts):
                    self.log_test("Family posts structure", True, f"All {len(posts)} posts have proper structure")
                    return True
                else:
                    self.log_test("Family posts structure", False, f"Only {valid_posts}/{len(posts)} posts have proper structure")
                    return False
            else:
                self.log_test("Family module filtering", False, f"Found {len(non_family_posts)} non-family posts in family module")
                return False
        else:
            self.log_test("Family module filtering", False, f"API error: {response.status_code if response else 'No response'}")
            return False

    def test_critical_scenario_2_organizations_module_filtering(self):
        """CRITICAL TEST 2: Organizations module posts - should return organization posts"""
        print("\n🎯 CRITICAL TEST 2: Organizations Module Post Filtering")
        
        response = self.make_request('GET', 'posts?module=organizations', auth_required=True)
        
        if response and response.status_code == 200:
            posts = response.json()
            
            # Verify we got posts
            if len(posts) == 0:
                self.log_test("Organizations module returns posts", False, "No posts returned")
                return False
            
            # Verify all posts are organization posts
            org_posts = [p for p in posts if p.get('source_module') == 'organizations']
            non_org_posts = [p for p in posts if p.get('source_module') != 'organizations']
            
            if len(non_org_posts) == 0:
                self.log_test("Organizations module filtering", True, f"Found {len(org_posts)} organization posts, no cross-module leakage")
                return True
            else:
                self.log_test("Organizations module filtering", False, f"Found {len(non_org_posts)} non-organization posts in organizations module")
                return False
        else:
            self.log_test("Organizations module filtering", False, f"API error: {response.status_code if response else 'No response'}")
            return False

    def test_critical_scenario_3_cross_module_isolation(self):
        """CRITICAL TEST 3: Cross-module isolation - verify no post leakage"""
        print("\n🎯 CRITICAL TEST 3: Cross-Module Isolation")
        
        # Get family posts
        family_response = self.make_request('GET', 'posts?module=family', auth_required=True)
        org_response = self.make_request('GET', 'posts?module=organizations', auth_required=True)
        
        if not (family_response and family_response.status_code == 200):
            self.log_test("Cross-module isolation", False, "Could not get family posts")
            return False
        
        if not (org_response and org_response.status_code == 200):
            self.log_test("Cross-module isolation", False, "Could not get organization posts")
            return False
        
        family_posts = family_response.json()
        org_posts = org_response.json()
        
        # Check for cross-contamination
        family_post_ids = {p['id'] for p in family_posts}
        org_post_ids = {p['id'] for p in org_posts}
        
        # Posts should not appear in both modules
        overlap = family_post_ids.intersection(org_post_ids)
        
        if len(overlap) == 0:
            self.log_test("Cross-module isolation", True, f"No post overlap between modules (Family: {len(family_posts)}, Org: {len(org_posts)})")
            return True
        else:
            self.log_test("Cross-module isolation", False, f"Found {len(overlap)} posts appearing in both modules")
            return False

    def test_critical_scenario_4_module_aware_post_creation(self):
        """CRITICAL TEST 4: Module-aware post creation"""
        print("\n🎯 CRITICAL TEST 4: Module-Aware Post Creation")
        
        # Create a family post
        form_data = {
            'content': 'CRITICAL TEST: New family post for module-aware testing!',
            'source_module': 'family',
            'target_audience': 'module',
            'media_file_ids': []
        }
        
        response = self.make_request('POST', 'posts', auth_required=True, form_data=form_data)
        
        if response and response.status_code == 200:
            data = response.json()
            
            # Verify post metadata
            if (data.get('source_module') == 'family' and 
                data.get('target_audience') == 'module' and
                data.get('content') == form_data['content']):
                
                post_id = data['id']
                self.log_test("Module-aware post creation", True, f"Post created with correct metadata: {post_id}")
                
                # Verify post appears in family feed
                feed_response = self.make_request('GET', 'posts?module=family', auth_required=True)
                
                if feed_response and feed_response.status_code == 200:
                    posts = feed_response.json()
                    found_post = any(p['id'] == post_id for p in posts)
                    
                    if found_post:
                        self.log_test("New post in correct module feed", True, "Post appears in family module feed")
                        return True
                    else:
                        self.log_test("New post in correct module feed", False, "Post not found in family module feed")
                        return False
                else:
                    self.log_test("New post in correct module feed", False, "Could not verify post in feed")
                    return False
            else:
                self.log_test("Module-aware post creation", False, f"Post metadata incorrect: {data}")
                return False
        else:
            self.log_test("Module-aware post creation", False, f"Post creation failed: {response.status_code if response else 'No response'}")
            return False

    def test_critical_scenario_5_api_response_format(self):
        """CRITICAL TEST 5: API responses include proper author and module information"""
        print("\n🎯 CRITICAL TEST 5: API Response Format and Information")
        
        response = self.make_request('GET', 'posts?module=family', auth_required=True)
        
        if response and response.status_code == 200:
            posts = response.json()
            
            if len(posts) == 0:
                self.log_test("API response format", False, "No posts to validate")
                return False
            
            # Check first post structure
            post = posts[0]
            
            # Required fields from PostResponse model
            required_fields = [
                'id', 'user_id', 'content', 'source_module', 'target_audience',
                'author', 'media_files', 'youtube_urls', 'likes_count', 
                'comments_count', 'is_published', 'created_at'
            ]
            
            missing_fields = [field for field in required_fields if field not in post]
            
            if len(missing_fields) == 0:
                # Check author structure
                author = post.get('author', {})
                author_fields = ['id', 'first_name', 'last_name']
                missing_author_fields = [field for field in author_fields if field not in author]
                
                if len(missing_author_fields) == 0:
                    self.log_test("API response format", True, f"All required fields present, author info complete")
                    
                    # Verify module information is correct
                    if post.get('source_module') == 'family':
                        self.log_test("Module information accuracy", True, "Source module correctly set to 'family'")
                        return True
                    else:
                        self.log_test("Module information accuracy", False, f"Expected 'family', got '{post.get('source_module')}'")
                        return False
                else:
                    self.log_test("API response format", False, f"Missing author fields: {missing_author_fields}")
                    return False
            else:
                self.log_test("API response format", False, f"Missing required fields: {missing_fields}")
                return False
        else:
            self.log_test("API response format", False, f"API error: {response.status_code if response else 'No response'}")
            return False

    def run_critical_tests(self):
        """Run all critical section-specific Universal Wall tests"""
        print("🚀 CRITICAL SECTION-SPECIFIC UNIVERSAL WALL TESTS")
        print("📡 Testing against:", self.base_url)
        print("=" * 80)
        
        # Setup
        if not self.setup_authentication():
            print("❌ Authentication failed. Cannot proceed with tests.")
            return False
        
        # Run critical test scenarios
        print("\n🔥 RUNNING CRITICAL TEST SCENARIOS")
        print("=" * 80)
        
        test_results = []
        
        # Critical Test 1: Family Module Filtering
        test_results.append(self.test_critical_scenario_1_family_module_filtering())
        
        # Critical Test 2: Organizations Module Filtering
        test_results.append(self.test_critical_scenario_2_organizations_module_filtering())
        
        # Critical Test 3: Cross-Module Isolation
        test_results.append(self.test_critical_scenario_3_cross_module_isolation())
        
        # Critical Test 4: Module-Aware Post Creation
        test_results.append(self.test_critical_scenario_4_module_aware_post_creation())
        
        # Critical Test 5: API Response Format
        test_results.append(self.test_critical_scenario_5_api_response_format())
        
        # Results summary
        print("\n" + "=" * 80)
        print("🏁 CRITICAL TEST RESULTS SUMMARY")
        print("=" * 80)
        print(f"📊 Total Tests: {self.tests_run}")
        print(f"✅ Tests Passed: {self.tests_passed}")
        print(f"❌ Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"📈 Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%" if self.tests_run > 0 else "No tests run")
        
        critical_scenarios_passed = sum(test_results)
        total_critical_scenarios = len(test_results)
        
        print(f"\n🎯 CRITICAL SCENARIOS: {critical_scenarios_passed}/{total_critical_scenarios} PASSED")
        
        if critical_scenarios_passed == total_critical_scenarios:
            print("\n🎉 ALL CRITICAL TESTS PASSED!")
            print("✅ Section-specific Universal Wall implementation is working correctly")
            print("✅ Module-based post filtering is functional")
            print("✅ Cross-module isolation is working")
            print("✅ Post creation with module metadata is working")
            print("✅ API responses include proper information")
            return True
        else:
            print(f"\n⚠️  {total_critical_scenarios - critical_scenarios_passed} critical scenarios failed")
            print("❌ Section-specific Universal Wall needs attention")
            return False

if __name__ == "__main__":
    tester = FinalSectionWallTester()
    success = tester.run_critical_tests()
    sys.exit(0 if success else 1)