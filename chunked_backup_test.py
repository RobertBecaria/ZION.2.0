#!/usr/bin/env python3
"""
Chunked Database Backup/Download Endpoints Testing
Test the chunked database backup/download endpoints for large database exports.

Test Scenarios:
1. Admin Login - Get admin token
2. Initialize Chunked Backup - Create backup with chunks
3. Get Backup Status - Verify backup information
4. Download a Chunk - Test chunk download with proper headers
5. List Backups - Verify backup listing
6. Cleanup Backup - Test backup cleanup

Backend URL: https://dbfix-social.preview.emergentagent.com/api
Admin Credentials: Architect / X17resto1!X21resto1!
"""

import requests
import json
import sys
import time
from datetime import datetime

# Configuration
BACKEND_URL = "https://dbfix-social.preview.emergentagent.com/api"
ADMIN_USERNAME = "Architect"
ADMIN_PASSWORD = "X17resto1!X21resto1!"

class ChunkedBackupTester:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
        self.backup_id = None
        self.test_results = []
        
    def log_test(self, test_name, success, details="", response_data=None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        if response_data and not success:
            print(f"   Response: {response_data}")
        print()
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "response": response_data
        })
    
    def test_admin_login(self):
        """Test 1: Admin Login"""
        print("🔐 Testing Admin Login...")
        
        try:
            response = self.session.post(
                f"{BACKEND_URL}/admin/login",
                json={
                    "username": ADMIN_USERNAME,
                    "password": ADMIN_PASSWORD
                },
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if "access_token" in data:
                    self.admin_token = data["access_token"]
                    self.session.headers.update({
                        "Authorization": f"Bearer {self.admin_token}"
                    })
                    self.log_test(
                        "Admin Login", 
                        True, 
                        f"Successfully logged in as {ADMIN_USERNAME}"
                    )
                    return True
                else:
                    self.log_test(
                        "Admin Login", 
                        False, 
                        "No access token in response", 
                        data
                    )
            else:
                self.log_test(
                    "Admin Login", 
                    False, 
                    f"HTTP {response.status_code}", 
                    response.text
                )
        except Exception as e:
            self.log_test("Admin Login", False, f"Exception: {str(e)}")
        
        return False
    
    def test_initialize_chunked_backup(self):
        """Test 2: Initialize Chunked Backup"""
        print("📦 Testing Initialize Chunked Backup...")
        
        try:
            response = self.session.post(
                f"{BACKEND_URL}/admin/database/backup/chunked/init",
                json={"chunk_size_mb": 5},
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["backup_id", "total_chunks", "total_size", "filename"]
                
                if all(field in data for field in required_fields):
                    self.backup_id = data["backup_id"]
                    self.log_test(
                        "Initialize Chunked Backup", 
                        True, 
                        f"Backup created: ID={self.backup_id}, Size={data['total_size']} bytes, Chunks={data['total_chunks']}, File={data['filename']}"
                    )
                    return True
                else:
                    missing_fields = [f for f in required_fields if f not in data]
                    self.log_test(
                        "Initialize Chunked Backup", 
                        False, 
                        f"Missing required fields: {missing_fields}", 
                        data
                    )
            else:
                self.log_test(
                    "Initialize Chunked Backup", 
                    False, 
                    f"HTTP {response.status_code}", 
                    response.text
                )
        except Exception as e:
            self.log_test("Initialize Chunked Backup", False, f"Exception: {str(e)}")
        
        return False
    
    def test_get_backup_status(self):
        """Test 3: Get Backup Status"""
        print("📊 Testing Get Backup Status...")
        
        if not self.backup_id:
            self.log_test("Get Backup Status", False, "No backup_id available")
            return False
        
        try:
            response = self.session.get(
                f"{BACKEND_URL}/admin/database/backup/chunked/{self.backup_id}/status"
            )
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["backup_id", "total_size", "total_chunks", "filename"]
                
                if all(field in data for field in required_fields):
                    self.log_test(
                        "Get Backup Status", 
                        True, 
                        f"Status retrieved: Size={data['total_size']} bytes, Chunks={data['total_chunks']}, Created={data.get('created_at', 'N/A')}"
                    )
                    return True
                else:
                    missing_fields = [f for f in required_fields if f not in data]
                    self.log_test(
                        "Get Backup Status", 
                        False, 
                        f"Missing required fields: {missing_fields}", 
                        data
                    )
            else:
                self.log_test(
                    "Get Backup Status", 
                    False, 
                    f"HTTP {response.status_code}", 
                    response.text
                )
        except Exception as e:
            self.log_test("Get Backup Status", False, f"Exception: {str(e)}")
        
        return False
    
    def test_download_chunk(self):
        """Test 4: Download a Chunk"""
        print("⬇️ Testing Download Chunk...")
        
        if not self.backup_id:
            self.log_test("Download Chunk", False, "No backup_id available")
            return False
        
        try:
            # Download chunk 0
            response = self.session.get(
                f"{BACKEND_URL}/admin/database/backup/chunked/{self.backup_id}/chunk/0"
            )
            
            if response.status_code == 200:
                # Check headers
                required_headers = ["X-Chunk-Index", "X-Total-Chunks", "X-Chunk-Size"]
                headers_present = all(header in response.headers for header in required_headers)
                
                if headers_present:
                    chunk_index = response.headers.get("X-Chunk-Index")
                    total_chunks = response.headers.get("X-Total-Chunks")
                    chunk_size = response.headers.get("X-Chunk-Size")
                    content_length = len(response.content)
                    
                    self.log_test(
                        "Download Chunk", 
                        True, 
                        f"Chunk downloaded: Index={chunk_index}, Total={total_chunks}, Size={chunk_size} bytes, Content={content_length} bytes"
                    )
                    return True
                else:
                    missing_headers = [h for h in required_headers if h not in response.headers]
                    self.log_test(
                        "Download Chunk", 
                        False, 
                        f"Missing required headers: {missing_headers}"
                    )
            else:
                self.log_test(
                    "Download Chunk", 
                    False, 
                    f"HTTP {response.status_code}", 
                    response.text
                )
        except Exception as e:
            self.log_test("Download Chunk", False, f"Exception: {str(e)}")
        
        return False
    
    def test_list_backups(self):
        """Test 5: List Backups"""
        print("📋 Testing List Backups...")
        
        try:
            response = self.session.get(
                f"{BACKEND_URL}/admin/database/backup/chunked/list"
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if "backups" in data and "total" in data:
                    backups_count = len(data["backups"])
                    total_count = data["total"]
                    
                    # Check if our backup is in the list
                    backup_found = False
                    if self.backup_id:
                        backup_found = any(b.get("backup_id") == self.backup_id for b in data["backups"])
                    
                    self.log_test(
                        "List Backups", 
                        True, 
                        f"Found {backups_count} backups (total: {total_count}), Our backup found: {backup_found}"
                    )
                    return True
                else:
                    self.log_test(
                        "List Backups", 
                        False, 
                        "Missing 'backups' or 'total' field", 
                        data
                    )
            else:
                self.log_test(
                    "List Backups", 
                    False, 
                    f"HTTP {response.status_code}", 
                    response.text
                )
        except Exception as e:
            self.log_test("List Backups", False, f"Exception: {str(e)}")
        
        return False
    
    def test_cleanup_backup(self):
        """Test 6: Cleanup Backup"""
        print("🗑️ Testing Cleanup Backup...")
        
        if not self.backup_id:
            self.log_test("Cleanup Backup", False, "No backup_id available")
            return False
        
        try:
            response = self.session.delete(
                f"{BACKEND_URL}/admin/database/backup/chunked/{self.backup_id}"
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("success") == True:
                    self.log_test(
                        "Cleanup Backup", 
                        True, 
                        f"Backup cleaned up successfully: {data.get('message', '')}"
                    )
                    
                    # Verify backup is no longer accessible
                    verify_response = self.session.get(
                        f"{BACKEND_URL}/admin/database/backup/chunked/{self.backup_id}/status"
                    )
                    
                    if verify_response.status_code == 404:
                        self.log_test(
                            "Cleanup Verification", 
                            True, 
                            "Backup properly removed (404 on status check)"
                        )
                    else:
                        self.log_test(
                            "Cleanup Verification", 
                            False, 
                            f"Backup still accessible after cleanup (HTTP {verify_response.status_code})"
                        )
                    
                    return True
                else:
                    self.log_test(
                        "Cleanup Backup", 
                        False, 
                        "Success field not true", 
                        data
                    )
            else:
                self.log_test(
                    "Cleanup Backup", 
                    False, 
                    f"HTTP {response.status_code}", 
                    response.text
                )
        except Exception as e:
            self.log_test("Cleanup Backup", False, f"Exception: {str(e)}")
        
        return False
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Chunked Database Backup/Download Endpoints Testing")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Admin User: {ADMIN_USERNAME}")
        print("=" * 60)
        
        # Test sequence
        tests = [
            self.test_admin_login,
            self.test_initialize_chunked_backup,
            self.test_get_backup_status,
            self.test_download_chunk,
            self.test_list_backups,
            self.test_cleanup_backup
        ]
        
        for test_func in tests:
            test_func()
            time.sleep(0.5)  # Small delay between tests
        
        # Summary
        print("=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if passed == total:
            print("\n🎉 ALL TESTS PASSED! Chunked backup system is working correctly.")
        else:
            print(f"\n⚠️ {total - passed} test(s) failed. Please review the issues above.")
            
            # Show failed tests
            failed_tests = [r for r in self.test_results if not r["success"]]
            if failed_tests:
                print("\nFailed Tests:")
                for test in failed_tests:
                    print(f"  - {test['test']}: {test['details']}")
        
        return passed == total

def main():
    """Main function"""
    tester = ChunkedBackupTester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()