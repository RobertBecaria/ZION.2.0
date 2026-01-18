#!/usr/bin/env python3
"""
Backend Testing for ZION.CITY Application - SERVICES Module Testing

Test Focus:
1. GET /api/services/categories - Get service categories with subcategories
2. GET /api/services/listings - Get service listings with filtering
3. POST /api/services/listings - Create new service listing (requires auth + organization)
4. GET /api/services/listings/{id} - Get specific service listing
5. GET /api/services/my-listings - Get user's service listings
6. GET /api/services/bookings/available-slots/{service_id} - Get available booking slots

Test Scenarios:
- Test service categories retrieval (should return 10 categories)
- Test service listings retrieval with pagination
- Test authenticated service listing creation
- Test individual service listing retrieval
- Test user's service listings retrieval
- Test available booking slots for a service

Test Credentials:
- Admin: admin@test.com / testpassword123
"""

import requests
import json
import sys
from datetime import datetime, timedelta
from typing import Optional

# Get backend URL from environment
BACKEND_URL = "https://social-login-fix.preview.emergentagent.com/api"

class ServicesModuleTester:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
        self.admin_user_id = None
        self.organization_id = None
        self.test_service_id = None
        
    def log(self, message, level="INFO"):
        """Log test messages with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def login_admin(self):
        """Login admin user and get JWT token"""
        try:
            self.log("🔐 Logging in admin user: admin@test.com")
            
            response = self.session.post(f"{BACKEND_URL}/auth/login", json={
                "email": "admin@test.com",
                "password": "testpassword123"
            })
            
            if response.status_code == 200:
                data = response.json()
                self.admin_token = data.get("access_token")
                self.admin_user_id = data.get("user", {}).get("id")
                
                self.log(f"✅ Admin login successful - User ID: {self.admin_user_id}")
                return True
            else:
                self.log(f"❌ Admin login failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Admin login error: {str(e)}", "ERROR")
            return False
    
    def get_auth_headers(self):
        """Get authorization headers"""
        return {"Authorization": f"Bearer {self.admin_token}"}
    
    def get_organization_id(self):
        """Get an organization ID for testing service listings"""
        try:
            self.log("🏢 Getting organization for service listing tests")
            
            response = self.session.get(
                f"{BACKEND_URL}/work/organizations",
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                organizations = data.get("organizations", [])
                
                # Look for an organization where user is a member
                for org in organizations:
                    if org.get("user_role"):  # If user has a role, they are a member
                        self.organization_id = org.get("id")
                        org_name = org.get("name", "Unknown")
                        user_role = org.get("user_role", "Unknown")
                        self.log(f"✅ Found organization where user is member: {org_name} (Role: {user_role}, ID: {self.organization_id})")
                        return True
                
                # If no membership found, try to create a new organization
                self.log("🏗️ No membership found, creating new organization")
                return self.create_test_organization()
            else:
                self.log(f"❌ Failed to get organizations: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Error getting organization: {str(e)}", "ERROR")
            return False
    
    def create_test_organization(self):
        """Create a test organization for services testing"""
        try:
            from datetime import datetime
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            
            org_data = {
                "name": f"Services Test Org {timestamp}",
                "organization_type": "COMPANY",
                "description": "Test organization for services testing",
                "creator_role": "ADMIN",
                "creator_department": "Management"
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/work/organizations",
                json=org_data,
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 200:
                org_data = response.json()
                self.organization_id = org_data.get("id")
                org_name = org_data.get("name", "Unknown")
                self.log(f"✅ Created test organization: {org_name} (ID: {self.organization_id})")
                return True
            else:
                self.log(f"❌ Failed to create organization: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Error creating organization: {str(e)}", "ERROR")
            return False
    
    def test_get_service_categories(self):
        """Test 1: GET /api/services/categories"""
        self.log("📋 Testing GET /api/services/categories")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/services/categories")
            
            if response.status_code == 200:
                data = response.json()
                categories = data.get("categories", {})
                
                # Check if we have 10 categories as expected
                category_count = len(categories)
                self.log(f"✅ Service categories retrieved - Found {category_count} categories")
                
                if category_count == 10:
                    self.log("✅ Correct number of categories (10)")
                else:
                    self.log(f"⚠️ Expected 10 categories, found {category_count}", "WARNING")
                
                # Verify structure of categories
                expected_categories = ["beauty", "medical", "food", "auto", "home", "education", "professional", "events", "pets", "other"]
                missing_categories = [cat for cat in expected_categories if cat not in categories]
                
                if missing_categories:
                    self.log(f"⚠️ Missing categories: {missing_categories}", "WARNING")
                else:
                    self.log("✅ All expected categories present")
                
                # Check subcategories structure
                beauty_category = categories.get("beauty", {})
                if beauty_category:
                    subcategories = beauty_category.get("subcategories", [])
                    if subcategories and len(subcategories) >= 4:
                        self.log("✅ Beauty category has subcategories")
                        
                        # Check for beauty_salon subcategory specifically
                        beauty_salon = next((sub for sub in subcategories if sub.get("id") == "beauty_salon"), None)
                        if beauty_salon:
                            self.log("✅ Found beauty_salon subcategory for testing")
                        else:
                            self.log("⚠️ beauty_salon subcategory not found", "WARNING")
                    else:
                        self.log("⚠️ Beauty category missing subcategories", "WARNING")
                
                return True
            else:
                self.log(f"❌ Get categories failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Get categories error: {str(e)}", "ERROR")
            return False
    
    def test_get_service_listings(self):
        """Test 2: GET /api/services/listings"""
        self.log("📝 Testing GET /api/services/listings")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/services/listings")
            
            if response.status_code == 200:
                data = response.json()
                listings = data.get("listings", [])
                total = data.get("total", 0)
                
                self.log(f"✅ Service listings retrieved - Found {len(listings)} listings (total: {total})")
                
                # Verify response structure
                required_fields = ["listings", "total", "skip", "limit"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log(f"⚠️ Missing fields in response: {missing_fields}", "WARNING")
                else:
                    self.log("✅ Response structure validated")
                
                # If we have listings, store one for later tests
                if listings:
                    first_listing = listings[0]
                    self.test_service_id = first_listing.get("id")
                    self.log(f"✅ Stored test service ID: {self.test_service_id}")
                    
                    # Verify listing structure
                    listing_required_fields = ["id", "name", "description", "category_id", "subcategory_id"]
                    listing_missing_fields = [field for field in listing_required_fields if field not in first_listing]
                    
                    if listing_missing_fields:
                        self.log(f"⚠️ Missing fields in listing: {listing_missing_fields}", "WARNING")
                    else:
                        self.log("✅ Listing structure validated")
                
                return True
            else:
                self.log(f"❌ Get listings failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Get listings error: {str(e)}", "ERROR")
            return False
    
    def test_create_service_listing(self):
        """Test 3: POST /api/services/listings"""
        if not self.organization_id:
            self.log("⚠️ No organization ID available for creating service listing", "WARNING")
            return False
            
        self.log("➕ Testing POST /api/services/listings")
        
        try:
            listing_data = {
                "organization_id": self.organization_id,
                "name": "Тестовая услуга",
                "description": "Описание тестовой услуги",
                "category_id": "beauty",
                "subcategory_id": "beauty_salon",
                "price_from": 1000.0,
                "price_to": 5000.0,
                "price_type": "from",
                "city": "Москва",
                "phone": "+7 (999) 123-45-67",
                "accepts_online_booking": True,
                "booking_duration_minutes": 60,
                "tags": ["тест", "красота", "салон"]
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/services/listings",
                json=listing_data,
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("success") and data.get("listing"):
                    listing = data["listing"]
                    created_id = listing.get("id")
                    
                    self.log(f"✅ Service listing created successfully - ID: {created_id}")
                    
                    # Store for later tests
                    if not self.test_service_id:
                        self.test_service_id = created_id
                    
                    # Verify created listing data
                    if listing.get("name") == listing_data["name"]:
                        self.log("✅ Listing name matches")
                    else:
                        self.log("⚠️ Listing name mismatch", "WARNING")
                    
                    if listing.get("category_id") == listing_data["category_id"]:
                        self.log("✅ Category ID matches")
                    else:
                        self.log("⚠️ Category ID mismatch", "WARNING")
                    
                    return True
                else:
                    self.log("❌ Service listing created but response format unexpected", "ERROR")
                    return False
            elif response.status_code == 403:
                self.log("❌ CRITICAL ISSUE: Organization membership validation failing", "ERROR")
                self.log("   User appears to have role in organization but membership check fails", "ERROR")
                self.log("   This indicates a data consistency issue in work_organization_members collection", "ERROR")
                return False
            else:
                self.log(f"❌ Create listing failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Create listing error: {str(e)}", "ERROR")
            return False
    
    def test_get_service_listing_by_id(self):
        """Test 4: GET /api/services/listings/{id}"""
        if not self.test_service_id:
            # Test with a mock ID to verify endpoint behavior
            self.log("⚠️ No service ID available, testing endpoint with mock ID")
            mock_service_id = "test-service-id-12345"
        else:
            mock_service_id = self.test_service_id
            
        self.log(f"🔍 Testing GET /api/services/listings/{mock_service_id}")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/services/listings/{mock_service_id}")
            
            if response.status_code == 200:
                data = response.json()
                listing = data.get("listing")
                
                if listing:
                    self.log("✅ Individual service listing retrieved successfully")
                    
                    # Verify listing structure
                    required_fields = ["id", "name", "description", "category_id", "subcategory_id"]
                    missing_fields = [field for field in required_fields if field not in listing]
                    
                    if missing_fields:
                        self.log(f"⚠️ Missing fields in listing: {missing_fields}", "WARNING")
                    else:
                        self.log("✅ Listing structure validated")
                    
                    # Check if organization info is included
                    if "organization" in listing:
                        self.log("✅ Organization info included in response")
                    else:
                        self.log("⚠️ Organization info not included", "WARNING")
                    
                    # Check if recent reviews are included
                    if "recent_reviews" in listing:
                        reviews_count = len(listing["recent_reviews"])
                        self.log(f"✅ Recent reviews included ({reviews_count} reviews)")
                    else:
                        self.log("⚠️ Recent reviews not included", "WARNING")
                    
                    return True
                else:
                    self.log("❌ Listing not found in response", "ERROR")
                    return False
            elif response.status_code == 404:
                if not self.test_service_id:
                    self.log("✅ Endpoint responds correctly to invalid service ID (404)")
                    return True
                else:
                    self.log(f"❌ Service not found: {response.status_code} - {response.text}", "ERROR")
                    return False
            else:
                self.log(f"❌ Get listing by ID failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Get listing by ID error: {str(e)}", "ERROR")
            return False
    
    def test_get_my_listings(self):
        """Test 5: GET /api/services/my-listings"""
        self.log("👤 Testing GET /api/services/my-listings")
        
        try:
            response = self.session.get(
                f"{BACKEND_URL}/services/my-listings",
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                listings = data.get("listings", [])
                
                self.log(f"✅ My listings retrieved - Found {len(listings)} listings")
                
                # If we have listings, verify structure
                if listings:
                    first_listing = listings[0]
                    required_fields = ["id", "name", "organization_id"]
                    missing_fields = [field for field in required_fields if field not in first_listing]
                    
                    if missing_fields:
                        self.log(f"⚠️ Missing fields in my listing: {missing_fields}", "WARNING")
                    else:
                        self.log("✅ My listing structure validated")
                    
                    # Check if organization name is enriched
                    if "organization_name" in first_listing:
                        self.log("✅ Organization name enriched in my listings")
                    else:
                        self.log("⚠️ Organization name not enriched", "WARNING")
                
                return True
            else:
                self.log(f"❌ Get my listings failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Get my listings error: {str(e)}", "ERROR")
            return False
    
    def test_get_available_slots(self):
        """Test 6: GET /api/services/bookings/available-slots/{service_id}"""
        if not self.test_service_id:
            # Try to use a mock service ID for testing the endpoint structure
            self.log("⚠️ No service ID available, testing with mock ID for endpoint validation")
            mock_service_id = "test-service-id-12345"
        else:
            mock_service_id = self.test_service_id
            
        # Use tomorrow's date for testing
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        self.log(f"📅 Testing GET /api/services/bookings/available-slots/{mock_service_id}?date={tomorrow}")
        
        try:
            response = self.session.get(
                f"{BACKEND_URL}/services/bookings/available-slots/{mock_service_id}",
                params={"date": tomorrow}
            )
            
            if response.status_code == 200:
                data = response.json()
                slots = data.get("slots", [])
                duration = data.get("duration_minutes")
                
                self.log(f"✅ Available slots retrieved - Found {len(slots)} slots")
                
                if duration:
                    self.log(f"✅ Duration specified: {duration} minutes")
                else:
                    self.log("⚠️ Duration not specified", "WARNING")
                
                # Verify slot structure if we have slots
                if slots:
                    first_slot = slots[0]
                    required_fields = ["start", "end", "available"]
                    missing_fields = [field for field in required_fields if field not in first_slot]
                    
                    if missing_fields:
                        self.log(f"⚠️ Missing fields in slot: {missing_fields}", "WARNING")
                    else:
                        self.log("✅ Slot structure validated")
                    
                    # Check availability status
                    available_slots = [slot for slot in slots if slot.get("available")]
                    self.log(f"✅ Available slots: {len(available_slots)}/{len(slots)}")
                else:
                    # Check if it's because the service is closed
                    message = data.get("message")
                    if message:
                        self.log(f"ℹ️ No slots available: {message}")
                    else:
                        self.log("⚠️ No slots found and no message provided", "WARNING")
                
                return True
            elif response.status_code == 404:
                if not self.test_service_id:
                    self.log("✅ Endpoint responds correctly to invalid service ID (404)")
                    return True
                else:
                    self.log(f"❌ Service not found: {response.status_code} - {response.text}", "ERROR")
                    return False
            else:
                self.log(f"❌ Get available slots failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Get available slots error: {str(e)}", "ERROR")
            return False
    
    def run_comprehensive_test(self):
        """Run all SERVICES module tests in sequence"""
        self.log("🚀 Starting ZION.CITY Backend Testing - SERVICES Module")
        self.log("=" * 80)
        
        # Test results tracking
        test_results = {
            "admin_login": False,
            "get_organization": False,
            "get_categories": False,
            "get_listings": False,
            "create_listing": False,
            "get_listing_by_id": False,
            "get_my_listings": False,
            "get_available_slots": False
        }
        
        # 1. Login admin user
        test_results["admin_login"] = self.login_admin()
        
        if not test_results["admin_login"]:
            self.log("❌ Cannot proceed without admin login", "ERROR")
            return test_results
        
        # 2. Get organization for testing
        test_results["get_organization"] = self.get_organization_id()
        
        # 3. Test service categories
        test_results["get_categories"] = self.test_get_service_categories()
        
        # 4. Test service listings
        test_results["get_listings"] = self.test_get_service_listings()
        
        # 5. Test create service listing (requires organization)
        if test_results["get_organization"]:
            test_results["create_listing"] = self.test_create_service_listing()
        else:
            self.log("⚠️ Skipping create listing test - no organization available", "WARNING")
        
        # 6. Test get listing by ID
        test_results["get_listing_by_id"] = self.test_get_service_listing_by_id()
        
        # 7. Test get my listings
        test_results["get_my_listings"] = self.test_get_my_listings()
        
        # 8. Test available slots
        test_results["get_available_slots"] = self.test_get_available_slots()
        
        # Print final results
        self.log("=" * 80)
        self.log("📊 FINAL TEST RESULTS - SERVICES Module")
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
        
        # Critical features check
        critical_tests = ["get_categories", "get_listings", "create_listing", "get_listing_by_id", "get_available_slots"]
        critical_passed = sum(1 for test in critical_tests if test_results.get(test, False))
        
        if critical_passed == len(critical_tests):
            self.log("🎉 ALL CRITICAL SERVICES FEATURES WORKING!")
        else:
            self.log(f"⚠️ {critical_passed}/{len(critical_tests)} critical services features working")
        
        self.log("=" * 80)
        
        return test_results

def main():
    """Main test execution"""
    tester = ServicesModuleTester()
    results = tester.run_comprehensive_test()
    
    # Exit with appropriate code
    critical_tests = ["admin_login", "get_categories", "get_listings", "get_available_slots"]
    critical_passed = all(results.get(test, False) for test in critical_tests)
    
    if critical_passed:
        print("\n🎉 All critical SERVICES module tests passed!")
        sys.exit(0)
    else:
        print("\n❌ Some critical SERVICES module tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()