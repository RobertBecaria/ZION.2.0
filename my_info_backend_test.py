#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
import uuid
import tempfile
import os

class MyInfoModuleAPITester:
    def __init__(self, base_url="https://zion-work-module.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_documents = []  # Track created documents for cleanup
        
        # Use existing test credentials as specified in review request
        self.test_credentials = {
            "email": "test@example.com",
            "password": "password123"
        }

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

    def make_request(self, method, endpoint, data=None, auth_required=False, files=None, form_data=None):
        """Make HTTP request to API"""
        url = f"{self.base_url}/{endpoint}"
        headers = {}
        
        if auth_required and self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        # Only set Content-Type for JSON requests
        if not files and not form_data:
            headers['Content-Type'] = 'application/json'
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files, headers=headers, timeout=30)
                elif form_data:
                    response = requests.post(url, data=form_data, headers=headers, timeout=30)
                else:
                    response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                if form_data:
                    response = requests.put(url, data=form_data, headers=headers, timeout=30)
                else:
                    response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)
            
            print(f"   Request: {method} {url} -> Status: {response.status_code}")
            
            # Print response details for debugging errors
            if response.status_code >= 400:
                try:
                    error_data = response.json()
                    print(f"   Error Details: {error_data}")
                except:
                    print(f"   Error Text: {response.text}")
            
            return response
        except requests.exceptions.RequestException as e:
            print(f"❌ Network error for {method} {url}: {str(e)}")
            return None

    def authenticate(self):
        """Authenticate with existing test user"""
        print("\n🔐 Authenticating with test credentials...")
        
        response = self.make_request('POST', 'auth/login', self.test_credentials)
        
        if response and response.status_code == 200:
            data = response.json()
            if 'access_token' in data and 'user' in data:
                self.token = data['access_token']
                self.user_id = data['user']['id']
                self.log_test("Authentication", True, f"User ID: {self.user_id}")
                return True
            else:
                self.log_test("Authentication", False, "Missing token or user data in response")
        else:
            error_msg = ""
            if response:
                try:
                    error_data = response.json()
                    error_msg = error_data.get('detail', f'Status: {response.status_code}')
                except:
                    error_msg = f'Status: {response.status_code}'
            else:
                error_msg = "No response"
            self.log_test("Authentication", False, error_msg)
        
        return False

    def test_get_my_info(self):
        """Test GET /api/my-info - Get complete user information"""
        print("\n🔍 Testing GET /api/my-info...")
        
        if not self.token:
            self.log_test("GET my-info", False, "No authentication token available")
            return False
        
        response = self.make_request('GET', 'my-info', auth_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            
            # Verify all required fields are present
            required_fields = [
                'id', 'email', 'first_name', 'last_name', 'profile_completed',
                'additional_user_data', 'created_at', 'updated_at'
            ]
            
            missing_fields = [field for field in required_fields if field not in data]
            
            if not missing_fields:
                # Check specific field values
                success = (
                    data.get('email') == self.test_credentials['email'] and
                    isinstance(data.get('additional_user_data'), dict) and
                    'created_at' in data and
                    'updated_at' in data
                )
                
                if success:
                    self.log_test("GET my-info", True, f"Retrieved complete user info with all fields")
                    
                    # Log some key details
                    print(f"   User: {data.get('first_name')} {data.get('last_name')}")
                    print(f"   Email: {data.get('email')}")
                    print(f"   Name Alias: {data.get('name_alias', 'Not set')}")
                    print(f"   Profile Completed: {data.get('profile_completed')}")
                    print(f"   Additional Data Fields: {len(data.get('additional_user_data', {}))}")
                    
                    return True
                else:
                    self.log_test("GET my-info", False, "Invalid field values in response")
            else:
                self.log_test("GET my-info", False, f"Missing required fields: {missing_fields}")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("GET my-info", False, error_msg)
        
        return False

    def test_update_my_info(self):
        """Test PUT /api/my-info - Update user information"""
        print("\n🔍 Testing PUT /api/my-info...")
        
        if not self.token:
            self.log_test("PUT my-info", False, "No authentication token available")
            return False
        
        # Test updating name_alias and additional_user_data
        update_data = {
            "name_alias": "Test Alias Updated",
            "additional_user_data": {
                "favorite_color": "blue",
                "hobby": "testing APIs",
                "test_timestamp": datetime.now().isoformat()
            }
        }
        
        response = self.make_request('PUT', 'my-info', update_data, auth_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            
            # Verify the update was successful
            success = (
                data.get('name_alias') == update_data['name_alias'] and
                'favorite_color' in data.get('additional_user_data', {}) and
                data.get('additional_user_data', {}).get('favorite_color') == 'blue'
            )
            
            if success:
                self.log_test("PUT my-info", True, "Successfully updated name_alias and additional_user_data")
                
                # Verify updated_at timestamp changed
                if 'updated_at' in data:
                    print(f"   Updated at: {data['updated_at']}")
                
                return True
            else:
                self.log_test("PUT my-info", False, "Update data not reflected in response")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("PUT my-info", False, error_msg)
        
        return False

    def test_get_my_documents_empty(self):
        """Test GET /api/my-documents - List user's documents (check structure)"""
        print("\n🔍 Testing GET /api/my-documents (check structure)...")
        
        if not self.token:
            self.log_test("GET my-documents (structure)", False, "No authentication token available")
            return False
        
        response = self.make_request('GET', 'my-documents', auth_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            
            # Should return an array (may or may not be empty)
            if isinstance(data, list):
                self.log_test("GET my-documents (structure)", True, f"Correctly returned array with {len(data)} documents")
                return True
            else:
                self.log_test("GET my-documents (structure)", False, f"Expected array, got: {type(data)}")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("GET my-documents (structure)", False, error_msg)
        
        return False

    def test_create_passport_document(self):
        """Test POST /api/my-documents - Create PASSPORT document"""
        print("\n🔍 Testing POST /api/my-documents (PASSPORT)...")
        
        if not self.token:
            self.log_test("Create PASSPORT document", False, "No authentication token available")
            return False
        
        passport_data = {
            "document_type": "PASSPORT",
            "country": "Ukraine",
            "document_number": "AA123456",
            "document_data": {
                "series": "AA",
                "issued_by": "Ministry of Internal Affairs",
                "issue_date": "2020-01-15",
                "department_code": "1234"
            }
        }
        
        response = self.make_request('POST', 'my-documents', passport_data, auth_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            
            # Verify document was created correctly
            success = (
                'id' in data and
                data.get('document_type') == 'PASSPORT' and
                data.get('country') == 'Ukraine' and
                data.get('document_number') == 'AA123456' and
                'document_data' in data and
                data.get('document_data', {}).get('series') == 'AA' and
                data.get('scan_file_url') is None  # Should be null initially
            )
            
            if success:
                document_id = data['id']
                self.created_documents.append(document_id)
                self.log_test("Create PASSPORT document", True, f"Document ID: {document_id}")
                
                # Log document details
                print(f"   Document Type: {data.get('document_type')}")
                print(f"   Country: {data.get('country')}")
                print(f"   Number: {data.get('document_number')}")
                print(f"   Series: {data.get('document_data', {}).get('series')}")
                
                return True
            else:
                self.log_test("Create PASSPORT document", False, "Invalid document structure in response")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("Create PASSPORT document", False, error_msg)
        
        return False

    def test_create_traveling_passport_document(self):
        """Test POST /api/my-documents - Create TRAVELING_PASSPORT document"""
        print("\n🔍 Testing POST /api/my-documents (TRAVELING_PASSPORT)...")
        
        if not self.token:
            self.log_test("Create TRAVELING_PASSPORT document", False, "No authentication token available")
            return False
        
        traveling_passport_data = {
            "document_type": "TRAVELING_PASSPORT",
            "country": "Ukraine",
            "document_number": "FP123456789",
            "document_data": {
                "first_name": "Test",
                "last_name": "User",
                "issue_date": "2022-03-10",
                "expiry_date": "2032-03-10",
                "place_of_birth": "Kyiv, Ukraine"
            }
        }
        
        response = self.make_request('POST', 'my-documents', traveling_passport_data, auth_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            
            # Verify document was created correctly
            success = (
                'id' in data and
                data.get('document_type') == 'TRAVELING_PASSPORT' and
                data.get('country') == 'Ukraine' and
                data.get('document_number') == 'FP123456789' and
                'document_data' in data and
                data.get('document_data', {}).get('first_name') == 'Test' and
                data.get('document_data', {}).get('expiry_date') == '2032-03-10'
            )
            
            if success:
                document_id = data['id']
                self.created_documents.append(document_id)
                self.log_test("Create TRAVELING_PASSPORT document", True, f"Document ID: {document_id}")
                return True
            else:
                self.log_test("Create TRAVELING_PASSPORT document", False, "Invalid document structure in response")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("Create TRAVELING_PASSPORT document", False, error_msg)
        
        return False

    def test_create_drivers_license_document(self):
        """Test POST /api/my-documents - Create DRIVERS_LICENSE document"""
        print("\n🔍 Testing POST /api/my-documents (DRIVERS_LICENSE)...")
        
        if not self.token:
            self.log_test("Create DRIVERS_LICENSE document", False, "No authentication token available")
            return False
        
        license_data = {
            "document_type": "DRIVERS_LICENSE",
            "country": "Ukraine",
            "document_number": "DL987654321",
            "document_data": {
                "license_number": "DL987654321",
                "issue_date": "2021-06-15",
                "expires": "2031-06-15",
                "categories": "B, C1",
                "issued_by": "Regional Service Center"
            }
        }
        
        response = self.make_request('POST', 'my-documents', license_data, auth_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            
            # Verify document was created correctly
            success = (
                'id' in data and
                data.get('document_type') == 'DRIVERS_LICENSE' and
                data.get('country') == 'Ukraine' and
                data.get('document_number') == 'DL987654321' and
                'document_data' in data and
                data.get('document_data', {}).get('categories') == 'B, C1'
            )
            
            if success:
                document_id = data['id']
                self.created_documents.append(document_id)
                self.log_test("Create DRIVERS_LICENSE document", True, f"Document ID: {document_id}")
                return True
            else:
                self.log_test("Create DRIVERS_LICENSE document", False, "Invalid document structure in response")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("Create DRIVERS_LICENSE document", False, error_msg)
        
        return False

    def test_update_document(self):
        """Test PUT /api/my-documents/{id} - Update document"""
        print("\n🔍 Testing PUT /api/my-documents/{id}...")
        
        if not self.token:
            self.log_test("Update document", False, "No authentication token available")
            return False
        
        if not self.created_documents:
            self.log_test("Update document", False, "No documents available to update")
            return False
        
        # Use the first created document
        document_id = self.created_documents[0]
        
        update_data = {
            "document_number": "AA123456-UPDATED",
            "document_data": {
                "series": "AA",
                "issued_by": "Ministry of Internal Affairs - Updated",
                "issue_date": "2020-01-15",
                "department_code": "1234",
                "updated_field": "This is a new field added during update"
            }
        }
        
        response = self.make_request('PUT', f'my-documents/{document_id}', update_data, auth_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            
            # Verify the update was successful
            success = (
                data.get('document_number') == 'AA123456-UPDATED' and
                'updated_field' in data.get('document_data', {}) and
                data.get('document_data', {}).get('issued_by') == 'Ministry of Internal Affairs - Updated'
            )
            
            if success:
                self.log_test("Update document", True, f"Successfully updated document {document_id}")
                
                # Verify updated_at timestamp changed
                if 'updated_at' in data:
                    print(f"   Updated at: {data['updated_at']}")
                
                return True
            else:
                self.log_test("Update document", False, "Update data not reflected in response")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("Update document", False, error_msg)
        
        return False

    def test_get_my_documents_with_data(self):
        """Test GET /api/my-documents - List documents after creation"""
        print("\n🔍 Testing GET /api/my-documents (with created documents)...")
        
        if not self.token:
            self.log_test("GET my-documents (with data)", False, "No authentication token available")
            return False
        
        response = self.make_request('GET', 'my-documents', auth_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            
            if isinstance(data, list) and len(data) > 0:
                # Verify document structure
                first_doc = data[0]
                required_fields = ['id', 'document_type', 'country', 'document_data', 'scan_file_url', 'created_at', 'updated_at']
                missing_fields = [field for field in required_fields if field not in first_doc]
                
                if not missing_fields:
                    self.log_test("GET my-documents (with data)", True, f"Retrieved {len(data)} documents with proper structure")
                    
                    # Log document details
                    for i, doc in enumerate(data):
                        print(f"   Document {i+1}: {doc.get('document_type')} - {doc.get('country')} - {doc.get('document_number', 'No number')}")
                    
                    return True
                else:
                    self.log_test("GET my-documents (with data)", False, f"Missing fields in document: {missing_fields}")
            else:
                self.log_test("GET my-documents (with data)", False, f"Expected documents, got: {len(data) if isinstance(data, list) else 'invalid type'}")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("GET my-documents (with data)", False, error_msg)
        
        return False

    def create_test_file(self, filename, content, content_type):
        """Create a test file for upload testing"""
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=filename)
        temp_file.write(content)
        temp_file.close()
        return temp_file.name, content_type

    def test_upload_document_scan(self):
        """Test POST /api/my-documents/{id}/upload-scan - Upload document scan"""
        print("\n🔍 Testing POST /api/my-documents/{id}/upload-scan...")
        
        if not self.token:
            self.log_test("Upload document scan", False, "No authentication token available")
            return False
        
        if not self.created_documents:
            self.log_test("Upload document scan", False, "No documents available for scan upload")
            return False
        
        # Use the first created document
        document_id = self.created_documents[0]
        
        # Create a test image file
        png_content = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\tpHYs\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\nIDATx\x9cc\xf8\x00\x00\x00\x01\x00\x01IEND\xaeB`\x82'
        temp_file, _ = self.create_test_file('.png', png_content, 'image/png')
        
        try:
            url = f"{self.base_url}/my-documents/{document_id}/upload-scan"
            headers = {'Authorization': f'Bearer {self.token}'}
            
            with open(temp_file, 'rb') as f:
                files = {'file': ('document_scan.png', f, 'image/png')}
                response = requests.post(url, files=files, headers=headers, timeout=30)
            
            print(f"   Request: POST {url} -> Status: {response.status_code}")
            
            if response.status_code >= 400:
                try:
                    error_data = response.json()
                    print(f"   Error Details: {error_data}")
                except:
                    print(f"   Error Text: {response.text}")
            
            if response and response.status_code == 200:
                data = response.json()
                
                # Verify scan upload was successful
                success = (
                    'scan_file_id' in data and
                    'scan_url' in data and
                    data.get('scan_file_id') is not None and
                    data.get('scan_url') is not None and
                    data.get('message') == 'Scan uploaded successfully'
                )
                
                if success:
                    self.log_test("Upload document scan", True, f"Scan uploaded successfully")
                    print(f"   Scan File ID: {data.get('scan_file_id')}")
                    print(f"   Scan URL: {data.get('scan_url')}")
                    return True
                else:
                    self.log_test("Upload document scan", False, f"Invalid scan upload response: {data}")
            else:
                error_msg = f"Status: {response.status_code}" if response else "No response"
                self.log_test("Upload document scan", False, error_msg)
        
        finally:
            os.unlink(temp_file)
        
        return False

    def test_delete_document(self):
        """Test DELETE /api/my-documents/{id} - Delete document (soft delete)"""
        print("\n🔍 Testing DELETE /api/my-documents/{id}...")
        
        if not self.token:
            self.log_test("Delete document", False, "No authentication token available")
            return False
        
        if not self.created_documents:
            self.log_test("Delete document", False, "No documents available to delete")
            return False
        
        # Use the last created document for deletion
        document_id = self.created_documents[-1]
        
        response = self.make_request('DELETE', f'my-documents/{document_id}', auth_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            
            # Verify deletion was successful
            if 'message' in data:
                self.log_test("Delete document", True, f"Document {document_id} deleted successfully")
                
                # Verify document no longer appears in GET list
                list_response = self.make_request('GET', 'my-documents', auth_required=True)
                if list_response and list_response.status_code == 200:
                    documents = list_response.json()
                    deleted_doc_found = any(doc.get('id') == document_id for doc in documents)
                    
                    if not deleted_doc_found:
                        self.log_test("Verify soft delete", True, "Deleted document no longer appears in list")
                    else:
                        self.log_test("Verify soft delete", False, "Deleted document still appears in list")
                
                return True
            else:
                self.log_test("Delete document", False, "Invalid deletion response")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("Delete document", False, error_msg)
        
        return False

    def test_error_handling(self):
        """Test error handling scenarios"""
        print("\n🔍 Testing Error Handling...")
        
        if not self.token:
            self.log_test("Error handling", False, "No authentication token available")
            return False
        
        success_count = 0
        total_tests = 3
        
        # Test 1: 404 for non-existent document ID (using update endpoint since there's no GET single document)
        fake_document_id = str(uuid.uuid4())
        update_data = {"document_number": "test"}
        response = self.make_request('PUT', f'my-documents/{fake_document_id}', update_data, auth_required=True)
        
        if response and response.status_code == 404:
            success_count += 1
            self.log_test("404 for non-existent document", True, "Correctly returned 404")
        else:
            status = response.status_code if response else "No response"
            # The API is actually working correctly, just the test logic was wrong
            if response and response.status_code == 404:
                success_count += 1
                self.log_test("404 for non-existent document", True, "Correctly returned 404")
            else:
                self.log_test("404 for non-existent document", False, f"Expected 404, got {status}")
        
        # Test 2: Validation error for invalid document type
        invalid_doc_data = {
            "document_type": "INVALID_TYPE",
            "country": "Ukraine",
            "document_number": "123"
        }
        
        response = self.make_request('POST', 'my-documents', invalid_doc_data, auth_required=True)
        
        if response and response.status_code == 422:
            success_count += 1
            self.log_test("422 for invalid document type", True, "Correctly returned validation error")
        else:
            # The API is working correctly, just the test logic was wrong
            if response and response.status_code == 422:
                success_count += 1
                self.log_test("422 for invalid document type", True, "Correctly returned validation error")
            else:
                status = response.status_code if response else "No response"
                self.log_test("422 for invalid document type", False, f"Expected 422, got {status}")
        
        # Test 3: Missing required fields
        incomplete_doc_data = {
            "document_type": "PASSPORT"
            # Missing country field
        }
        
        response = self.make_request('POST', 'my-documents', incomplete_doc_data, auth_required=True)
        
        if response and response.status_code == 422:
            success_count += 1
            self.log_test("422 for missing required fields", True, "Correctly returned validation error")
        else:
            # The API is working correctly, just the test logic was wrong
            if response and response.status_code == 422:
                success_count += 1
                self.log_test("422 for missing required fields", True, "Correctly returned validation error")
            else:
                status = response.status_code if response else "No response"
                self.log_test("422 for missing required fields", False, f"Expected 422, got {status}")
        
        return success_count == total_tests

    def run_comprehensive_tests(self):
        """Run all MY INFO module tests"""
        print("🚀 Starting MY INFO Module Backend Comprehensive Testing...")
        print(f"🌐 Base URL: {self.base_url}")
        print(f"👤 Test User: {self.test_credentials['email']}")
        
        # Authentication
        if not self.authenticate():
            print("\n❌ Authentication failed. Cannot proceed with tests.")
            return False
        
        # Run all tests in sequence
        test_results = []
        
        # Basic MY INFO tests
        test_results.append(self.test_get_my_info())
        test_results.append(self.test_update_my_info())
        
        # Document management tests
        test_results.append(self.test_get_my_documents_empty())
        test_results.append(self.test_create_passport_document())
        test_results.append(self.test_create_traveling_passport_document())
        test_results.append(self.test_create_drivers_license_document())
        test_results.append(self.test_update_document())
        test_results.append(self.test_get_my_documents_with_data())
        test_results.append(self.test_upload_document_scan())
        test_results.append(self.test_delete_document())
        
        # Error handling tests
        test_results.append(self.test_error_handling())
        
        # Print summary
        print(f"\n📊 TEST SUMMARY")
        print(f"{'='*50}")
        print(f"Total Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.tests_passed == self.tests_run:
            print(f"\n🎉 ALL TESTS PASSED! MY INFO Module is working correctly.")
            return True
        else:
            print(f"\n⚠️  Some tests failed. Please review the results above.")
            return False

def main():
    """Main function to run the tests"""
    tester = MyInfoModuleAPITester()
    success = tester.run_comprehensive_tests()
    
    if success:
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()