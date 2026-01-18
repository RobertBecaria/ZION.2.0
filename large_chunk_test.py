#!/usr/bin/env python3
"""
Test for verifying the 500MB body size limit for chunked uploads
"""

import requests
import json
import io
from datetime import datetime

# Configuration
BACKEND_URL = "https://dbfix-social.preview.emergentagent.com/api"
ADMIN_USERNAME = "Architect"
ADMIN_PASSWORD = "X17resto1!X21resto1!"

def test_large_chunk_upload():
    """Test uploading a larger chunk to verify body size limits"""
    print("🧪 Testing Large Chunk Upload (Body Size Limit)")
    print("=" * 60)
    
    session = requests.Session()
    
    # Login first
    print("🔐 Logging in as admin...")
    login_response = session.post(
        f"{BACKEND_URL}/admin/login",
        json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD},
        timeout=30
    )
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.status_code}")
        return False
    
    token = login_response.json().get("access_token")
    session.headers.update({"Authorization": f"Bearer {token}"})
    print("✅ Login successful")
    
    # Initialize chunked upload
    print("\n🚀 Initializing chunked upload...")
    init_data = {
        "filename": "large_test_backup.json",
        "total_size": 100 * 1024 * 1024,  # 100MB total
        "total_chunks": 1,  # Single large chunk
        "mode": "merge"
    }
    
    init_response = session.post(
        f"{BACKEND_URL}/admin/database/restore/chunked/init",
        json=init_data,
        timeout=30
    )
    
    if init_response.status_code != 200:
        print(f"❌ Init failed: {init_response.status_code}")
        return False
    
    upload_id = init_response.json().get("upload_id")
    print(f"✅ Upload initialized: {upload_id}")
    
    # Create a large chunk (10MB test chunk)
    print("\n📤 Creating 10MB test chunk...")
    chunk_size = 10 * 1024 * 1024  # 10MB
    test_data = {
        "metadata": {"created_at": datetime.now().isoformat(), "version": "1.0"},
        "data": {"test": "x" * (chunk_size - 200)}  # Fill with data to reach ~10MB
    }
    
    chunk_content = json.dumps(test_data).encode('utf-8')
    actual_size = len(chunk_content)
    print(f"   Actual chunk size: {actual_size / (1024*1024):.2f} MB")
    
    # Upload the large chunk
    print("\n📤 Uploading large chunk...")
    chunk_file = io.BytesIO(chunk_content)
    chunk_file.name = "large_chunk_0.json"
    
    files = {'chunk': ('large_chunk_0.json', chunk_file, 'application/json')}
    data = {'chunk_index': 0}
    
    try:
        upload_response = session.post(
            f"{BACKEND_URL}/admin/database/restore/chunked/upload/{upload_id}",
            files=files,
            data=data,
            timeout=60  # Longer timeout for large upload
        )
        
        if upload_response.status_code == 200:
            print("✅ Large chunk uploaded successfully")
            print(f"   Response: {upload_response.json()}")
            
            # Check status
            status_response = session.get(
                f"{BACKEND_URL}/admin/database/restore/chunked/{upload_id}/status",
                timeout=30
            )
            if status_response.status_code == 200:
                status = status_response.json()
                print(f"   Upload progress: {status.get('progress', 0)}%")
            
            # Cleanup
            session.delete(f"{BACKEND_URL}/admin/database/restore/chunked/{upload_id}")
            print("   ✅ Cleanup completed")
            return True
        else:
            print(f"❌ Large chunk upload failed: {upload_response.status_code}")
            print(f"   Response: {upload_response.text}")
            
            # Cleanup on failure
            session.delete(f"{BACKEND_URL}/admin/database/restore/chunked/{upload_id}")
            return False
            
    except Exception as e:
        print(f"❌ Upload error: {str(e)}")
        # Cleanup on error
        session.delete(f"{BACKEND_URL}/admin/database/restore/chunked/{upload_id}")
        return False

if __name__ == "__main__":
    success = test_large_chunk_upload()
    print(f"\n{'✅ Test completed successfully' if success else '❌ Test failed'}")
    exit(0 if success else 1)