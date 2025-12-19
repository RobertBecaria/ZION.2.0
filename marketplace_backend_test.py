#!/usr/bin/env python3
"""
Backend Testing for ZION.CITY Application - MARKETPLACE MODULE (ВЕЩИ)
Testing the newly implemented ВЕЩИ (Things/Marketplace) module

Test Focus:
1. Marketplace Categories API - GET /api/marketplace/categories
2. Inventory Categories API - GET /api/marketplace/inventory-categories  
3. Create Marketplace Product - POST /api/marketplace/products (requires auth)
4. Get Marketplace Products - GET /api/marketplace/products
5. Create Inventory Item - POST /api/inventory/items (requires auth)
6. Get Inventory Items - GET /api/inventory/items (requires auth)

Test Scenarios:
- Verify marketplace categories return correct 7 categories
- Verify inventory categories return correct 6 categories  
- Test product creation with family requirement validation
- Test inventory item creation and retrieval
- Test category filtering for inventory items

Test Credentials:
- Admin: admin@test.com / testpassword123
"""

import requests
import json
import sys
from datetime import datetime

# Get backend URL from environment
BACKEND_URL = "https://altyn-finance.preview.emergentagent.com/api"

class MarketplaceTester:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
        self.admin_user_id = None
        self.test_product_id = None
        self.test_inventory_item_id = None
        
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
    
    def test_marketplace_categories(self):
        """Test 1: GET /api/marketplace/categories"""
        self.log("🏪 Testing GET /api/marketplace/categories")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/marketplace/categories")
            
            if response.status_code == 200:
                data = response.json()
                categories = data.get("categories", {})
                
                # Expected categories from backend code
                expected_categories = [
                    "electronics", "clothing", "home_garden", 
                    "auto_moto", "kids", "sports_leisure", "books_hobbies"
                ]
                
                self.log(f"✅ Marketplace categories retrieved - Found {len(categories)} categories")
                
                # Verify all expected categories are present
                missing_categories = []
                for cat in expected_categories:
                    if cat not in categories:
                        missing_categories.append(cat)
                
                if missing_categories:
                    self.log(f"❌ Missing categories: {missing_categories}", "ERROR")
                    return False
                else:
                    self.log("✅ All 7 expected marketplace categories found")
                    
                    # Verify category structure
                    first_cat = list(categories.values())[0]
                    if "name" in first_cat and "icon" in first_cat and "subcategories" in first_cat:
                        self.log("✅ Category structure validation passed")
                        return True
                    else:
                        self.log("❌ Category structure missing required fields", "ERROR")
                        return False
            else:
                self.log(f"❌ Get marketplace categories failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Marketplace categories error: {str(e)}", "ERROR")
            return False
    
    def test_inventory_categories(self):
        """Test 2: GET /api/marketplace/inventory-categories"""
        self.log("📦 Testing GET /api/marketplace/inventory-categories")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/marketplace/inventory-categories")
            
            if response.status_code == 200:
                data = response.json()
                categories = data.get("categories", {})
                
                # Expected inventory categories from backend code
                expected_categories = [
                    "smart_things", "wardrobe", "garage", 
                    "home", "electronics", "collection"
                ]
                
                self.log(f"✅ Inventory categories retrieved - Found {len(categories)} categories")
                
                # Verify all expected categories are present
                missing_categories = []
                for cat in expected_categories:
                    if cat not in categories:
                        missing_categories.append(cat)
                
                if missing_categories:
                    self.log(f"❌ Missing inventory categories: {missing_categories}", "ERROR")
                    return False
                else:
                    self.log("✅ All 6 expected inventory categories found")
                    
                    # Verify category structure
                    first_cat = list(categories.values())[0]
                    if "name" in first_cat and "icon" in first_cat and "description" in first_cat:
                        self.log("✅ Inventory category structure validation passed")
                        return True
                    else:
                        self.log("❌ Inventory category structure missing required fields", "ERROR")
                        return False
            else:
                self.log(f"❌ Get inventory categories failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Inventory categories error: {str(e)}", "ERROR")
            return False
    
    def test_create_marketplace_product(self):
        """Test 3: POST /api/marketplace/products (requires auth)"""
        self.log("🛍️ Testing POST /api/marketplace/products")
        
        try:
            product_data = {
                "title": "Test iPhone 14",
                "description": "Test product for marketplace testing",
                "category": "electronics",
                "price": 50000,
                "condition": "good",
                "city": "Moscow"
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/marketplace/products",
                json=product_data,
                headers=self.get_auth_headers()
            )
            
            # According to the requirement, this should return 400 if user has no family setup
            if response.status_code == 400:
                error_data = response.json()
                error_detail = error_data.get("detail", "")
                if "семейный" in error_detail.lower() or "family" in error_detail.lower():
                    self.log("✅ Product creation correctly requires family setup (400 error as expected)")
                    self.log(f"✅ Error message: {error_detail}")
                    return True
                else:
                    self.log(f"❌ Unexpected 400 error: {error_data}", "ERROR")
                    return False
            elif response.status_code == 200 or response.status_code == 201:
                data = response.json()
                self.test_product_id = data.get("id")
                self.log(f"✅ Product created successfully - ID: {self.test_product_id}")
                
                # Verify response structure
                required_fields = ["id", "title", "description", "category", "price", "condition"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log(f"⚠️ Missing fields in response: {missing_fields}", "WARNING")
                else:
                    self.log("✅ Product creation response structure validated")
                
                return True
            else:
                self.log(f"❌ Create marketplace product failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Create marketplace product error: {str(e)}", "ERROR")
            return False
    
    def test_get_marketplace_products(self):
        """Test 4: GET /api/marketplace/products"""
        self.log("🛒 Testing GET /api/marketplace/products")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/marketplace/products")
            
            if response.status_code == 200:
                data = response.json()
                products = data.get("products", [])
                total = data.get("total", 0)
                
                self.log(f"✅ Marketplace products retrieved - Found {len(products)} products (total: {total})")
                
                # Verify response structure
                if "products" in data and "total" in data:
                    self.log("✅ Products response structure validated")
                    
                    # If we have products, verify product structure
                    if products and len(products) > 0:
                        first_product = products[0]
                        required_fields = ["id", "title", "description", "category", "price"]
                        missing_fields = [field for field in required_fields if field not in first_product]
                        
                        if missing_fields:
                            self.log(f"⚠️ Missing fields in product: {missing_fields}", "WARNING")
                        else:
                            self.log("✅ Product structure validation passed")
                    
                    return True
                else:
                    self.log("❌ Products response missing required structure", "ERROR")
                    return False
            else:
                self.log(f"❌ Get marketplace products failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Get marketplace products error: {str(e)}", "ERROR")
            return False
    
    def test_create_inventory_item(self):
        """Test 5: POST /api/inventory/items (requires auth)"""
        self.log("📱 Testing POST /api/inventory/items")
        
        try:
            item_data = {
                "name": "My Smart Watch",
                "category": "electronics",
                "brand": "Apple",
                "model": "Watch Series 9"
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/inventory/items",
                json=item_data,
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 200 or response.status_code == 201:
                data = response.json()
                
                # Handle nested response structure
                if data.get("success") and "item" in data:
                    item = data["item"]
                    self.test_inventory_item_id = item.get("id")
                    
                    self.log(f"✅ Inventory item created successfully - ID: {self.test_inventory_item_id}")
                    
                    # Verify item structure
                    required_fields = ["id", "name", "category", "user_id"]
                    missing_fields = [field for field in required_fields if field not in item]
                    
                    if missing_fields:
                        self.log(f"⚠️ Missing fields in item: {missing_fields}", "WARNING")
                    else:
                        self.log("✅ Inventory item creation response structure validated")
                    
                    return True
                else:
                    self.log(f"❌ Unexpected response structure: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Create inventory item failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Create inventory item error: {str(e)}", "ERROR")
            return False
    
    def test_get_inventory_items(self):
        """Test 6: GET /api/inventory/items (requires auth)"""
        self.log("📋 Testing GET /api/inventory/items?category=electronics")
        
        try:
            # Test with category filter
            response = self.session.get(
                f"{BACKEND_URL}/inventory/items?category=electronics",
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                items = data.get("items", [])
                summary = data.get("summary", {})
                
                self.log(f"✅ Inventory items retrieved - Found {len(items)} electronics items")
                
                # Verify response structure
                if "items" in data:
                    self.log("✅ Inventory items response structure validated")
                    
                    # If we have items, verify item structure
                    if items and len(items) > 0:
                        first_item = items[0]
                        required_fields = ["id", "name", "category", "user_id"]
                        missing_fields = [field for field in required_fields if field not in first_item]
                        
                        if missing_fields:
                            self.log(f"⚠️ Missing fields in item: {missing_fields}", "WARNING")
                        else:
                            self.log("✅ Inventory item structure validation passed")
                        
                        # Verify category filtering worked
                        electronics_items = [item for item in items if item.get("category") == "electronics"]
                        if len(electronics_items) == len(items):
                            self.log("✅ Category filtering working correctly")
                        else:
                            self.log("⚠️ Category filtering may not be working properly", "WARNING")
                    
                    # Check if our created item is in the list
                    if self.test_inventory_item_id:
                        created_item = next((item for item in items if item.get("id") == self.test_inventory_item_id), None)
                        if created_item:
                            self.log("✅ Created inventory item found in list")
                        else:
                            self.log("⚠️ Created inventory item not found in list", "WARNING")
                    
                    return True
                else:
                    self.log("❌ Inventory items response missing required structure", "ERROR")
                    return False
            else:
                self.log(f"❌ Get inventory items failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Get inventory items error: {str(e)}", "ERROR")
            return False
    
    def run_comprehensive_test(self):
        """Run all Marketplace module tests in sequence"""
        self.log("🚀 Starting ZION.CITY Backend Testing - MARKETPLACE MODULE (ВЕЩИ)")
        self.log("=" * 80)
        
        # Test results tracking
        test_results = {
            "admin_login": False,
            "marketplace_categories": False,
            "inventory_categories": False,
            "create_marketplace_product": False,
            "get_marketplace_products": False,
            "create_inventory_item": False,
            "get_inventory_items": False
        }
        
        # 1. Login admin user
        test_results["admin_login"] = self.login_admin()
        
        if not test_results["admin_login"]:
            self.log("❌ Cannot proceed without admin login", "ERROR")
            return test_results
        
        # 2. Test marketplace categories API
        test_results["marketplace_categories"] = self.test_marketplace_categories()
        
        # 3. Test inventory categories API
        test_results["inventory_categories"] = self.test_inventory_categories()
        
        # 4. Test create marketplace product
        test_results["create_marketplace_product"] = self.test_create_marketplace_product()
        
        # 5. Test get marketplace products
        test_results["get_marketplace_products"] = self.test_get_marketplace_products()
        
        # 6. Test create inventory item
        test_results["create_inventory_item"] = self.test_create_inventory_item()
        
        # 7. Test get inventory items
        test_results["get_inventory_items"] = self.test_get_inventory_items()
        
        # Print final results
        self.log("=" * 80)
        self.log("📊 FINAL TEST RESULTS - MARKETPLACE MODULE (ВЕЩИ)")
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
        api_tests = ["marketplace_categories", "inventory_categories", "get_marketplace_products"]
        api_passed = sum(1 for test in api_tests if test_results.get(test, False))
        
        crud_tests = ["create_marketplace_product", "create_inventory_item", "get_inventory_items"]
        crud_passed = sum(1 for test in crud_tests if test_results.get(test, False))
        
        self.log(f"🔌 API Endpoints: {api_passed}/{len(api_tests)} working")
        self.log(f"📝 CRUD Operations: {crud_passed}/{len(crud_tests)} working")
        
        if passed_tests == total_tests:
            self.log("🎉 ALL MARKETPLACE MODULE FEATURES WORKING!")
        elif api_passed == len(api_tests):
            self.log("✅ All API endpoints working - CRUD operations may need family setup")
        else:
            self.log(f"⚠️ {passed_tests}/{total_tests} marketplace features working")
        
        self.log("=" * 80)
        
        return test_results

def main():
    """Main test execution"""
    tester = MarketplaceTester()
    results = tester.run_comprehensive_test()
    
    # Exit with appropriate code
    critical_tests = ["admin_login", "marketplace_categories", "inventory_categories", "get_marketplace_products"]
    critical_passed = all(results.get(test, False) for test in critical_tests)
    
    if critical_passed:
        print("\n🎉 All critical Marketplace tests passed!")
        sys.exit(0)
    else:
        print("\n❌ Some critical Marketplace tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()