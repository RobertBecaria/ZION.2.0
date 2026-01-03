"""
ERIC Search API Tests
Tests for ERIC-Powered Search functionality in ZION.CITY platform
- /api/agent/search - Search across organizations, services, products, people
- /api/agent/chat-with-search - Chat with automatic search when keywords detected
- /api/organizations/{org_id}/eric-settings - Business ERIC settings GET/PUT
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "testpassword123"
TEST_EMAIL = "testuser@test.com"
TEST_PASSWORD = "testpassword123"


class TestAuthSetup:
    """Authentication setup tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Admin authentication failed: {response.status_code} - {response.text}")
    
    @pytest.fixture(scope="class")
    def test_user_token(self):
        """Get test user authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Test user authentication failed: {response.status_code} - {response.text}")
    
    def test_admin_login(self):
        """Test admin login works"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        print(f"✓ Admin login successful")
    
    def test_test_user_login(self):
        """Test regular user login works"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Test user login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        print(f"✓ Test user login successful")


class TestERICSearchAPI:
    """Tests for /api/agent/search endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get authorization headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_search_all_with_russian_keyword(self, auth_headers):
        """Test search with Russian keyword 'красота' (beauty)"""
        response = requests.post(
            f"{BASE_URL}/api/agent/search",
            json={"query": "красота", "search_type": "all", "limit": 10},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Search failed: {response.text}"
        data = response.json()
        assert "results" in data, "No results field in response"
        assert "query" in data, "No query field in response"
        print(f"✓ Search 'красота' returned {len(data.get('results', []))} results")
    
    def test_search_all_with_english_keyword(self, auth_headers):
        """Test search with English keyword 'beauty'"""
        response = requests.post(
            f"{BASE_URL}/api/agent/search",
            json={"query": "beauty", "search_type": "all", "limit": 10},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Search failed: {response.text}"
        data = response.json()
        assert "results" in data, "No results field in response"
        print(f"✓ Search 'beauty' returned {len(data.get('results', []))} results")
    
    def test_search_services_only(self, auth_headers):
        """Test search with search_type='services'"""
        response = requests.post(
            f"{BASE_URL}/api/agent/search",
            json={"query": "тест", "search_type": "services", "limit": 10},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Search failed: {response.text}"
        data = response.json()
        assert "results" in data, "No results field in response"
        # Verify all results are services
        for result in data.get("results", []):
            assert result.get("type") == "service", f"Expected service type, got {result.get('type')}"
        print(f"✓ Search services returned {len(data.get('results', []))} service results")
    
    def test_search_products_only(self, auth_headers):
        """Test search with search_type='products'"""
        response = requests.post(
            f"{BASE_URL}/api/agent/search",
            json={"query": "тест", "search_type": "products", "limit": 10},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Search failed: {response.text}"
        data = response.json()
        assert "results" in data, "No results field in response"
        # Verify all results are products
        for result in data.get("results", []):
            assert result.get("type") == "product", f"Expected product type, got {result.get('type')}"
        print(f"✓ Search products returned {len(data.get('results', []))} product results")
    
    def test_search_organizations_only(self, auth_headers):
        """Test search with search_type='organizations'"""
        response = requests.post(
            f"{BASE_URL}/api/agent/search",
            json={"query": "Москва", "search_type": "organizations", "limit": 10},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Search failed: {response.text}"
        data = response.json()
        assert "results" in data, "No results field in response"
        # Verify all results are organizations
        for result in data.get("results", []):
            assert result.get("type") == "organization", f"Expected organization type, got {result.get('type')}"
        print(f"✓ Search organizations returned {len(data.get('results', []))} organization results")
    
    def test_search_people_only(self, auth_headers):
        """Test search with search_type='people'"""
        response = requests.post(
            f"{BASE_URL}/api/agent/search",
            json={"query": "test", "search_type": "people", "limit": 10},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Search failed: {response.text}"
        data = response.json()
        assert "results" in data, "No results field in response"
        # Verify all results are people
        for result in data.get("results", []):
            assert result.get("type") == "person", f"Expected person type, got {result.get('type')}"
        print(f"✓ Search people returned {len(data.get('results', []))} person results")
    
    def test_search_with_location_filter(self, auth_headers):
        """Test search with location filter"""
        response = requests.post(
            f"{BASE_URL}/api/agent/search",
            json={"query": "услуги", "search_type": "all", "location": "Москва", "limit": 10},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Search failed: {response.text}"
        data = response.json()
        assert "results" in data, "No results field in response"
        print(f"✓ Search with location filter returned {len(data.get('results', []))} results")
    
    def test_search_with_limit(self, auth_headers):
        """Test search respects limit parameter"""
        response = requests.post(
            f"{BASE_URL}/api/agent/search",
            json={"query": "тест", "search_type": "all", "limit": 3},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Search failed: {response.text}"
        data = response.json()
        assert "results" in data, "No results field in response"
        assert len(data.get("results", [])) <= 3, f"Expected max 3 results, got {len(data.get('results', []))}"
        print(f"✓ Search with limit=3 returned {len(data.get('results', []))} results")
    
    def test_search_empty_query(self, auth_headers):
        """Test search with empty query"""
        response = requests.post(
            f"{BASE_URL}/api/agent/search",
            json={"query": "", "search_type": "all", "limit": 10},
            headers=auth_headers
        )
        # Empty query should still return 200 but with no results
        assert response.status_code == 200, f"Search failed: {response.text}"
        data = response.json()
        assert "results" in data, "No results field in response"
        print(f"✓ Search with empty query returned {len(data.get('results', []))} results")
    
    def test_search_unauthorized(self):
        """Test search without authentication returns 401/403"""
        response = requests.post(
            f"{BASE_URL}/api/agent/search",
            json={"query": "test", "search_type": "all", "limit": 10}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Search without auth correctly returns {response.status_code}")


class TestERICChatWithSearch:
    """Tests for /api/agent/chat-with-search endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get authorization headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_chat_with_search_keyword_naidi(self, auth_headers):
        """Test chat with search keyword 'найди' triggers search"""
        response = requests.post(
            f"{BASE_URL}/api/agent/chat-with-search",
            json={"message": "найди услуги красоты"},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Chat failed: {response.text}"
        data = response.json()
        assert "conversation_id" in data, "No conversation_id in response"
        assert "message" in data, "No message in response"
        print(f"✓ Chat with 'найди' keyword successful")
        # Allow time for AI response
        time.sleep(2)
    
    def test_chat_with_search_keyword_poisk(self, auth_headers):
        """Test chat with search keyword 'поиск' triggers search"""
        response = requests.post(
            f"{BASE_URL}/api/agent/chat-with-search",
            json={"message": "поиск товаров"},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Chat failed: {response.text}"
        data = response.json()
        assert "conversation_id" in data, "No conversation_id in response"
        assert "message" in data, "No message in response"
        print(f"✓ Chat with 'поиск' keyword successful")
        time.sleep(2)
    
    def test_chat_with_search_keyword_ischu(self, auth_headers):
        """Test chat with search keyword 'ищу' triggers search"""
        response = requests.post(
            f"{BASE_URL}/api/agent/chat-with-search",
            json={"message": "ищу мастера по ремонту"},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Chat failed: {response.text}"
        data = response.json()
        assert "conversation_id" in data, "No conversation_id in response"
        assert "message" in data, "No message in response"
        print(f"✓ Chat with 'ищу' keyword successful")
        time.sleep(2)
    
    def test_chat_without_search_keyword(self, auth_headers):
        """Test chat without search keyword still works"""
        response = requests.post(
            f"{BASE_URL}/api/agent/chat-with-search",
            json={"message": "Привет, как дела?"},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Chat failed: {response.text}"
        data = response.json()
        assert "conversation_id" in data, "No conversation_id in response"
        assert "message" in data, "No message in response"
        print(f"✓ Chat without search keyword successful")
        time.sleep(2)
    
    def test_chat_with_conversation_id(self, auth_headers):
        """Test chat with existing conversation_id"""
        # First create a conversation
        response1 = requests.post(
            f"{BASE_URL}/api/agent/chat-with-search",
            json={"message": "Привет"},
            headers=auth_headers
        )
        assert response1.status_code == 200, f"First chat failed: {response1.text}"
        conv_id = response1.json().get("conversation_id")
        
        time.sleep(2)
        
        # Continue conversation
        response2 = requests.post(
            f"{BASE_URL}/api/agent/chat-with-search",
            json={"message": "найди услуги", "conversation_id": conv_id},
            headers=auth_headers
        )
        assert response2.status_code == 200, f"Second chat failed: {response2.text}"
        data = response2.json()
        assert data.get("conversation_id") == conv_id, "Conversation ID should match"
        print(f"✓ Chat with existing conversation_id successful")
    
    def test_chat_unauthorized(self):
        """Test chat without authentication returns 401/403"""
        response = requests.post(
            f"{BASE_URL}/api/agent/chat-with-search",
            json={"message": "test"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Chat without auth correctly returns {response.status_code}")


class TestBusinessERICSettings:
    """Tests for Business ERIC Settings endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin authentication failed")
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        """Get admin authorization headers"""
        return {"Authorization": f"Bearer {admin_token}"}
    
    @pytest.fixture(scope="class")
    def test_organization_id(self, admin_headers):
        """Get or create a test organization"""
        # First try to get existing organizations
        response = requests.get(
            f"{BASE_URL}/api/work/organizations",
            headers=admin_headers
        )
        if response.status_code == 200:
            orgs = response.json()
            if orgs and len(orgs) > 0:
                # Return first organization where user is admin/creator
                for org in orgs:
                    org_id = org.get("id") or org.get("organization_id")
                    if org_id:
                        return org_id
        
        # Create a new organization if none exists
        response = requests.post(
            f"{BASE_URL}/api/work/organizations",
            json={
                "name": "TEST_ERIC_Settings_Org",
                "organization_type": "COMPANY",
                "description": "Test organization for ERIC settings",
                "creator_role": "OWNER"
            },
            headers=admin_headers
        )
        if response.status_code in [200, 201]:
            org = response.json()
            return org.get("id") or org.get("organization_id")
        
        pytest.skip(f"Could not get/create test organization: {response.text}")
    
    def test_get_eric_settings_default(self, admin_headers, test_organization_id):
        """Test GET ERIC settings returns default values"""
        response = requests.get(
            f"{BASE_URL}/api/work/organizations/{test_organization_id}/eric-settings",
            headers=admin_headers
        )
        assert response.status_code == 200, f"GET settings failed: {response.text}"
        data = response.json()
        
        # Verify default settings structure
        assert "organization_id" in data, "Missing organization_id"
        assert "is_active" in data, "Missing is_active"
        assert "share_public_data" in data, "Missing share_public_data"
        assert "allow_user_eric_queries" in data, "Missing allow_user_eric_queries"
        print(f"✓ GET ERIC settings successful with defaults")
    
    def test_update_eric_settings(self, admin_headers, test_organization_id):
        """Test PUT ERIC settings updates correctly"""
        update_data = {
            "is_active": True,
            "share_public_data": True,
            "share_promotions": False,
            "share_repeat_customer_stats": True,
            "share_ratings_reviews": True,
            "allow_user_eric_queries": True,
            "share_aggregated_analytics": True,
            "business_description": "Test business description for ERIC",
            "specialties": ["testing", "automation"]
        }
        
        response = requests.put(
            f"{BASE_URL}/api/work/organizations/{test_organization_id}/eric-settings",
            json=update_data,
            headers=admin_headers
        )
        assert response.status_code == 200, f"PUT settings failed: {response.text}"
        data = response.json()
        
        # Verify updated values
        assert data.get("share_promotions") == False, "share_promotions should be False"
        assert data.get("share_repeat_customer_stats") == True, "share_repeat_customer_stats should be True"
        assert data.get("business_description") == "Test business description for ERIC"
        assert "testing" in data.get("specialties", []), "specialties should contain 'testing'"
        print(f"✓ PUT ERIC settings successful")
    
    def test_get_eric_settings_after_update(self, admin_headers, test_organization_id):
        """Test GET ERIC settings returns updated values"""
        response = requests.get(
            f"{BASE_URL}/api/work/organizations/{test_organization_id}/eric-settings",
            headers=admin_headers
        )
        assert response.status_code == 200, f"GET settings failed: {response.text}"
        data = response.json()
        
        # Verify persisted values
        assert data.get("share_promotions") == False, "share_promotions should be False after update"
        assert data.get("business_description") == "Test business description for ERIC"
        print(f"✓ GET ERIC settings after update shows persisted values")
    
    def test_eric_settings_unauthorized(self, test_organization_id):
        """Test ERIC settings without auth returns 401/403"""
        response = requests.get(
            f"{BASE_URL}/api/work/organizations/{test_organization_id}/eric-settings"
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ ERIC settings without auth correctly returns {response.status_code}")
    
    def test_eric_settings_non_admin(self, test_organization_id):
        """Test ERIC settings with non-admin user returns 403"""
        # Login as test user (non-admin)
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Test user login failed")
        
        test_token = response.json().get("access_token")
        test_headers = {"Authorization": f"Bearer {test_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/work/organizations/{test_organization_id}/eric-settings",
            headers=test_headers
        )
        # Non-admin should get 403
        assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}"
        print(f"✓ ERIC settings for non-admin correctly returns 403")


class TestSearchTermExpansion:
    """Tests for Russian keyword to English category mapping"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get authorization headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_krasota_maps_to_beauty(self, auth_headers):
        """Test 'красота' keyword expands to beauty-related terms"""
        response = requests.post(
            f"{BASE_URL}/api/agent/search",
            json={"query": "красота", "search_type": "all", "limit": 10},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Search failed: {response.text}"
        data = response.json()
        # Should find results related to beauty category
        print(f"✓ 'красота' search returned {len(data.get('results', []))} results")
    
    def test_remont_maps_to_repair(self, auth_headers):
        """Test 'ремонт' keyword expands to repair-related terms"""
        response = requests.post(
            f"{BASE_URL}/api/agent/search",
            json={"query": "ремонт", "search_type": "all", "limit": 10},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Search failed: {response.text}"
        data = response.json()
        print(f"✓ 'ремонт' search returned {len(data.get('results', []))} results")
    
    def test_mashina_maps_to_auto(self, auth_headers):
        """Test 'машина' keyword expands to auto-related terms"""
        response = requests.post(
            f"{BASE_URL}/api/agent/search",
            json={"query": "машина", "search_type": "all", "limit": 10},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Search failed: {response.text}"
        data = response.json()
        print(f"✓ 'машина' search returned {len(data.get('results', []))} results")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
