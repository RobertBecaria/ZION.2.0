#!/usr/bin/env python3
"""
Backend Test for Chunked Database Restore Endpoints
Tests the chunked upload functionality for large database backup files
"""

import requests
import json
import io
import time
from datetime import datetime

# Configuration
BACKEND_URL = "https://dbfix-social.preview.emergentagent.com/api"
ADMIN_USERNAME = "Architect"
ADMIN_PASSWORD = "X17resto1!X21resto1!"

class ChunkedRestoreTest:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
        self.upload_id = None
        
    def log(self, message):
        """Log test messages with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {message}")
        
    def test_admin_login(self):
        """Test admin authentication"""
        self.log("🔐 Testing Admin Login...")
        
        try:
            response = self.session.post(
                f"{BACKEND_URL}/admin/login",
                json={
                    "username": ADMIN_USERNAME,
                    "password": ADMIN_PASSWORD
                },
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                self.admin_token = data.get("access_token")
                if self.admin_token:
                    self.session.headers.update({
                        "Authorization": f"Bearer {self.admin_token}"
                    })
                    self.log("✅ Admin login successful")
                    return True
                else:
                    self.log("❌ Admin login failed: No access token in response")
                    return False
            else:
                self.log(f"❌ Admin login failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Admin login error: {str(e)}")
            return False
    
    def test_initialize_chunked_upload(self):
        """Test initializing chunked upload"""
        self.log("🚀 Testing Initialize Chunked Upload...")
        
        try:
            # Test data for initialization
            init_data = {
                "filename": "test_backup.json",
                "total_size": 1000000,  # 1MB
                "total_chunks": 5,
                "mode": "merge"
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/admin/database/restore/chunked/init",
                json=init_data,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and data.get("upload_id"):
                    self.upload_id = data["upload_id"]
                    self.log(f"✅ Chunked upload initialized successfully")
                    self.log(f"   Upload ID: {self.upload_id}")
                    self.log(f"   Message: {data.get('message', 'N/A')}")
                    return True
                else:
                    self.log(f"❌ Initialize failed: Invalid response format - {data}")
                    return False
            else:
                self.log(f"❌ Initialize failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Initialize chunked upload error: {str(e)}")
            return False
    
    def test_upload_status(self):
        """Test getting upload status"""
        self.log("📊 Testing Upload Status...")
        
        if not self.upload_id:
            self.log("❌ No upload ID available for status check")
            return False
            
        try:
            response = self.session.get(
                f"{BACKEND_URL}/admin/database/restore/chunked/{self.upload_id}/status",
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                expected_fields = ["upload_id", "filename", "total_size", "total_chunks", "received_chunks", "progress"]
                
                if all(field in data for field in expected_fields):
                    self.log("✅ Upload status retrieved successfully")
                    self.log(f"   Filename: {data.get('filename')}")
                    self.log(f"   Total Size: {data.get('total_size')} bytes")
                    self.log(f"   Total Chunks: {data.get('total_chunks')}")
                    self.log(f"   Received Chunks: {data.get('received_chunks')}")
                    self.log(f"   Progress: {data.get('progress')}%")
                    return True
                else:
                    missing_fields = [field for field in expected_fields if field not in data]
                    self.log(f"❌ Upload status failed: Missing fields {missing_fields}")
                    return False
            else:
                self.log(f"❌ Upload status failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Upload status error: {str(e)}")
            return False
    
    def test_upload_chunk(self):
        """Test uploading a single chunk"""
        self.log("📤 Testing Upload Chunk...")
        
        if not self.upload_id:
            self.log("❌ No upload ID available for chunk upload")
            return False
            
        try:
            # Create a test chunk (simulated JSON data)
            test_chunk_data = json.dumps({
                "metadata": {
                    "created_at": datetime.now().isoformat(),
                    "version": "1.0",
                    "chunk_index": 0
                },
                "data": {
                    "test_collection": [
                        {"id": "test1", "name": "Test Document 1"},
                        {"id": "test2", "name": "Test Document 2"}
                    ]
                }
            }).encode('utf-8')
            
            # Create file-like object
            chunk_file = io.BytesIO(test_chunk_data)
            chunk_file.name = "chunk_0.json"
            
            # Prepare multipart form data
            files = {
                'chunk': ('chunk_0.json', chunk_file, 'application/json')
            }
            data = {
                'chunk_index': 0
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/admin/database/restore/chunked/upload/{self.upload_id}",
                files=files,
                data=data,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get("success"):
                    self.log("✅ Chunk uploaded successfully")
                    self.log(f"   Message: {result.get('message', 'N/A')}")
                    self.log(f"   Chunk Index: {result.get('chunk_index', 'N/A')}")
                    return True
                else:
                    self.log(f"❌ Chunk upload failed: {result}")
                    return False
            else:
                self.log(f"❌ Chunk upload failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Chunk upload error: {str(e)}")
            return False
    
    def test_upload_status_after_chunk(self):
        """Test upload status after uploading a chunk"""
        self.log("📊 Testing Upload Status After Chunk Upload...")
        
        if not self.upload_id:
            self.log("❌ No upload ID available for status check")
            return False
            
        try:
            response = self.session.get(
                f"{BACKEND_URL}/admin/database/restore/chunked/{self.upload_id}/status",
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                received_chunks = data.get('received_chunks', 0)
                progress = data.get('progress', 0)
                
                if received_chunks > 0:
                    self.log("✅ Upload status shows chunk received")
                    self.log(f"   Received Chunks: {received_chunks}")
                    self.log(f"   Progress: {progress}%")
                    return True
                else:
                    self.log("❌ Upload status shows no chunks received")
                    return False
            else:
                self.log(f"❌ Upload status failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Upload status error: {str(e)}")
            return False
    
    def test_cancel_upload(self):
        """Test cancelling chunked upload"""
        self.log("🗑️ Testing Cancel Upload...")
        
        if not self.upload_id:
            self.log("❌ No upload ID available for cancellation")
            return False
            
        try:
            response = self.session.delete(
                f"{BACKEND_URL}/admin/database/restore/chunked/{self.upload_id}",
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    self.log("✅ Upload cancelled successfully")
                    self.log(f"   Message: {data.get('message', 'N/A')}")
                    return True
                else:
                    self.log(f"❌ Cancel upload failed: {data}")
                    return False
            else:
                self.log(f"❌ Cancel upload failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Cancel upload error: {str(e)}")
            return False
    
    def test_status_after_cancel(self):
        """Test that status returns 404 after cancellation"""
        self.log("🔍 Testing Status After Cancel (Should Return 404)...")
        
        if not self.upload_id:
            self.log("❌ No upload ID available for status check")
            return False
            
        try:
            response = self.session.get(
                f"{BACKEND_URL}/admin/database/restore/chunked/{self.upload_id}/status",
                timeout=30
            )
            
            if response.status_code == 404:
                self.log("✅ Status correctly returns 404 after cancellation")
                return True
            else:
                self.log(f"❌ Expected 404 but got: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Status after cancel error: {str(e)}")
            return False
    
    def test_large_file_support(self):
        """Test that the system can handle large file size declarations"""
        self.log("📏 Testing Large File Size Support (500MB)...")
        
        try:
            # Test with 500MB file size (nginx limit)
            large_file_data = {
                "filename": "large_backup.json",
                "total_size": 500 * 1024 * 1024,  # 500MB
                "total_chunks": 1000,  # Many small chunks
                "mode": "merge"
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/admin/database/restore/chunked/init",
                json=large_file_data,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and data.get("upload_id"):
                    large_upload_id = data["upload_id"]
                    self.log("✅ Large file size (500MB) accepted")
                    self.log(f"   Upload ID: {large_upload_id}")
                    
                    # Clean up the test upload
                    cleanup_response = self.session.delete(
                        f"{BACKEND_URL}/admin/database/restore/chunked/{large_upload_id}",
                        timeout=30
                    )
                    if cleanup_response.status_code == 200:
                        self.log("   ✅ Test upload cleaned up")
                    
                    return True
                else:
                    self.log(f"❌ Large file test failed: Invalid response - {data}")
                    return False
            else:
                self.log(f"❌ Large file test failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Large file test error: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all chunked restore tests"""
        self.log("🧪 Starting Chunked Database Restore Tests")
        self.log("=" * 60)
        
        tests = [
            ("Admin Login", self.test_admin_login),
            ("Initialize Chunked Upload", self.test_initialize_chunked_upload),
            ("Upload Status (Initial)", self.test_upload_status),
            ("Upload Single Chunk", self.test_upload_chunk),
            ("Upload Status (After Chunk)", self.test_upload_status_after_chunk),
            ("Cancel Upload", self.test_cancel_upload),
            ("Status After Cancel", self.test_status_after_cancel),
            ("Large File Support", self.test_large_file_support)
        ]
        
        results = []
        
        for test_name, test_func in tests:
            self.log(f"\n--- {test_name} ---")
            try:
                result = test_func()
                results.append((test_name, result))
                if result:
                    self.log(f"✅ {test_name}: PASSED")
                else:
                    self.log(f"❌ {test_name}: FAILED")
            except Exception as e:
                self.log(f"❌ {test_name}: ERROR - {str(e)}")
                results.append((test_name, False))
            
            # Small delay between tests
            time.sleep(1)
        
        # Summary
        self.log("\n" + "=" * 60)
        self.log("📊 TEST SUMMARY")
        self.log("=" * 60)
        
        passed = sum(1 for _, result in results if result)
        total = len(results)
        
        for test_name, result in results:
            status = "✅ PASSED" if result else "❌ FAILED"
            self.log(f"{test_name}: {status}")
        
        self.log(f"\nTotal: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
        
        if passed == total:
            self.log("🎉 ALL TESTS PASSED!")
        else:
            self.log(f"⚠️  {total - passed} test(s) failed")
        
        return passed == total

if __name__ == "__main__":
    tester = ChunkedRestoreTest()
    success = tester.run_all_tests()
    exit(0 if success else 1)