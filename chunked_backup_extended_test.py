#!/usr/bin/env python3
"""
Extended Chunked Database Backup Testing - Edge Cases and Error Scenarios
Additional tests for error handling and edge cases.
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

class ExtendedChunkedBackupTester:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
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
    
    def setup_admin_auth(self):
        """Setup admin authentication"""
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
            self.admin_token = data["access_token"]
            self.session.headers.update({
                "Authorization": f"Bearer {self.admin_token}"
            })
            return True
        return False
    
    def test_invalid_backup_id_status(self):
        """Test: Get status with invalid backup ID"""
        print("🔍 Testing Invalid Backup ID Status...")
        
        try:
            response = self.session.get(
                f"{BACKEND_URL}/admin/database/backup/chunked/invalid-backup-id/status"
            )
            
            if response.status_code == 404:
                self.log_test(
                    "Invalid Backup ID Status", 
                    True, 
                    "Correctly returned 404 for invalid backup ID"
                )
                return True
            else:
                self.log_test(
                    "Invalid Backup ID Status", 
                    False, 
                    f"Expected 404, got HTTP {response.status_code}", 
                    response.text
                )
        except Exception as e:
            self.log_test("Invalid Backup ID Status", False, f"Exception: {str(e)}")
        
        return False
    
    def test_invalid_chunk_index(self):
        """Test: Download chunk with invalid index"""
        print("🔍 Testing Invalid Chunk Index...")
        
        # First create a backup
        init_response = self.session.post(
            f"{BACKEND_URL}/admin/database/backup/chunked/init",
            json={"chunk_size_mb": 5},
            headers={"Content-Type": "application/json"}
        )
        
        if init_response.status_code != 200:
            self.log_test("Invalid Chunk Index", False, "Failed to create backup for test")
            return False
        
        backup_id = init_response.json()["backup_id"]
        total_chunks = init_response.json()["total_chunks"]
        
        try:
            # Test negative chunk index
            response = self.session.get(
                f"{BACKEND_URL}/admin/database/backup/chunked/{backup_id}/chunk/-1"
            )
            
            negative_index_ok = response.status_code == 400
            
            # Test chunk index beyond total chunks
            response = self.session.get(
                f"{BACKEND_URL}/admin/database/backup/chunked/{backup_id}/chunk/{total_chunks + 10}"
            )
            
            beyond_index_ok = response.status_code == 400
            
            # Cleanup
            self.session.delete(f"{BACKEND_URL}/admin/database/backup/chunked/{backup_id}")
            
            if negative_index_ok and beyond_index_ok:
                self.log_test(
                    "Invalid Chunk Index", 
                    True, 
                    "Correctly returned 400 for both negative and beyond-range chunk indices"
                )
                return True
            else:
                self.log_test(
                    "Invalid Chunk Index", 
                    False, 
                    f"Negative index result: {negative_index_ok}, Beyond range result: {beyond_index_ok}"
                )
        except Exception as e:
            self.log_test("Invalid Chunk Index", False, f"Exception: {str(e)}")
        
        return False
    
    def test_unauthorized_access(self):
        """Test: Access without admin token"""
        print("🔍 Testing Unauthorized Access...")
        
        # Remove authorization header temporarily
        original_headers = self.session.headers.copy()
        if "Authorization" in self.session.headers:
            del self.session.headers["Authorization"]
        
        try:
            # Test init without auth
            response = self.session.post(
                f"{BACKEND_URL}/admin/database/backup/chunked/init",
                json={"chunk_size_mb": 5},
                headers={"Content-Type": "application/json"}
            )
            
            init_unauthorized = response.status_code in [401, 403]
            
            # Test list without auth
            response = self.session.get(
                f"{BACKEND_URL}/admin/database/backup/chunked/list"
            )
            
            list_unauthorized = response.status_code in [401, 403]
            
            # Restore headers
            self.session.headers.update(original_headers)
            
            if init_unauthorized and list_unauthorized:
                self.log_test(
                    "Unauthorized Access", 
                    True, 
                    "Correctly blocked unauthorized access to backup endpoints"
                )
                return True
            else:
                self.log_test(
                    "Unauthorized Access", 
                    False, 
                    f"Init unauthorized: {init_unauthorized}, List unauthorized: {list_unauthorized}"
                )
        except Exception as e:
            # Restore headers in case of exception
            self.session.headers.update(original_headers)
            self.log_test("Unauthorized Access", False, f"Exception: {str(e)}")
        
        return False
    
    def test_large_chunk_size(self):
        """Test: Initialize backup with large chunk size"""
        print("🔍 Testing Large Chunk Size...")
        
        try:
            response = self.session.post(
                f"{BACKEND_URL}/admin/database/backup/chunked/init",
                json={"chunk_size_mb": 50},  # 50MB chunks
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                backup_id = data["backup_id"]
                
                # Verify chunk size is correctly set
                chunk_size_mb = data["chunk_size"] / (1024 * 1024)
                
                # Cleanup
                self.session.delete(f"{BACKEND_URL}/admin/database/backup/chunked/{backup_id}")
                
                if abs(chunk_size_mb - 50) < 0.1:  # Allow small floating point difference
                    self.log_test(
                        "Large Chunk Size", 
                        True, 
                        f"Successfully created backup with 50MB chunks (actual: {chunk_size_mb:.1f}MB)"
                    )
                    return True
                else:
                    self.log_test(
                        "Large Chunk Size", 
                        False, 
                        f"Chunk size mismatch: expected ~50MB, got {chunk_size_mb:.1f}MB"
                    )
            else:
                self.log_test(
                    "Large Chunk Size", 
                    False, 
                    f"HTTP {response.status_code}", 
                    response.text
                )
        except Exception as e:
            self.log_test("Large Chunk Size", False, f"Exception: {str(e)}")
        
        return False
    
    def test_small_chunk_size(self):
        """Test: Initialize backup with small chunk size"""
        print("🔍 Testing Small Chunk Size...")
        
        try:
            response = self.session.post(
                f"{BACKEND_URL}/admin/database/backup/chunked/init",
                json={"chunk_size_mb": 1},  # 1MB chunks
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                backup_id = data["backup_id"]
                total_chunks = data["total_chunks"]
                
                # With 1MB chunks, we should have more chunks than with 5MB
                # Database is ~112MB, so expect around 112 chunks
                
                # Cleanup
                self.session.delete(f"{BACKEND_URL}/admin/database/backup/chunked/{backup_id}")
                
                if total_chunks > 50:  # Should be significantly more chunks
                    self.log_test(
                        "Small Chunk Size", 
                        True, 
                        f"Successfully created backup with 1MB chunks ({total_chunks} total chunks)"
                    )
                    return True
                else:
                    self.log_test(
                        "Small Chunk Size", 
                        False, 
                        f"Expected more chunks with 1MB size, got {total_chunks}"
                    )
            else:
                self.log_test(
                    "Small Chunk Size", 
                    False, 
                    f"HTTP {response.status_code}", 
                    response.text
                )
        except Exception as e:
            self.log_test("Small Chunk Size", False, f"Exception: {str(e)}")
        
        return False
    
    def test_multiple_backups(self):
        """Test: Create multiple backups and verify isolation"""
        print("🔍 Testing Multiple Backups...")
        
        backup_ids = []
        
        try:
            # Create 3 backups
            for i in range(3):
                response = self.session.post(
                    f"{BACKEND_URL}/admin/database/backup/chunked/init",
                    json={"chunk_size_mb": 5},
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code == 200:
                    backup_ids.append(response.json()["backup_id"])
                else:
                    self.log_test("Multiple Backups", False, f"Failed to create backup {i+1}")
                    return False
            
            # Verify all backups are listed
            list_response = self.session.get(
                f"{BACKEND_URL}/admin/database/backup/chunked/list"
            )
            
            if list_response.status_code == 200:
                data = list_response.json()
                listed_backup_ids = [b["backup_id"] for b in data["backups"]]
                
                all_found = all(bid in listed_backup_ids for bid in backup_ids)
                
                # Cleanup all backups
                for backup_id in backup_ids:
                    self.session.delete(f"{BACKEND_URL}/admin/database/backup/chunked/{backup_id}")
                
                if all_found:
                    self.log_test(
                        "Multiple Backups", 
                        True, 
                        f"Successfully created and listed {len(backup_ids)} backups"
                    )
                    return True
                else:
                    missing = [bid for bid in backup_ids if bid not in listed_backup_ids]
                    self.log_test(
                        "Multiple Backups", 
                        False, 
                        f"Missing backups in list: {missing}"
                    )
            else:
                self.log_test("Multiple Backups", False, "Failed to list backups")
        except Exception as e:
            # Cleanup in case of exception
            for backup_id in backup_ids:
                try:
                    self.session.delete(f"{BACKEND_URL}/admin/database/backup/chunked/{backup_id}")
                except:
                    pass
            self.log_test("Multiple Backups", False, f"Exception: {str(e)}")
        
        return False
    
    def run_all_tests(self):
        """Run all extended tests"""
        print("🚀 Starting Extended Chunked Database Backup Testing")
        print(f"Backend URL: {BACKEND_URL}")
        print("=" * 60)
        
        # Setup authentication
        if not self.setup_admin_auth():
            print("❌ Failed to authenticate admin user")
            return False
        
        # Test sequence
        tests = [
            self.test_invalid_backup_id_status,
            self.test_invalid_chunk_index,
            self.test_unauthorized_access,
            self.test_large_chunk_size,
            self.test_small_chunk_size,
            self.test_multiple_backups
        ]
        
        for test_func in tests:
            test_func()
            time.sleep(0.5)  # Small delay between tests
        
        # Summary
        print("=" * 60)
        print("📊 EXTENDED TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if passed == total:
            print("\n🎉 ALL EXTENDED TESTS PASSED! Chunked backup system handles edge cases correctly.")
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
    tester = ExtendedChunkedBackupTester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()