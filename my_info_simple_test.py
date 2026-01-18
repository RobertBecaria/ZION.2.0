#!/usr/bin/env python3

import requests
import json

def test_my_info_endpoints():
    """Simple test of MY INFO module endpoints"""
    base_url = "https://social-login-fix.preview.emergentagent.com/api"
    
    # Login
    login_response = requests.post(f"{base_url}/auth/login", json={
        "email": "test@example.com",
        "password": "password123"
    })
    
    if login_response.status_code != 200:
        print("❌ Login failed")
        return False
    
    token = login_response.json()['access_token']
    headers = {'Authorization': f'Bearer {token}'}
    
    print("✅ Authentication successful")
    
    # Test GET /api/my-info
    response = requests.get(f"{base_url}/my-info", headers=headers)
    if response.status_code == 200:
        print("✅ GET /api/my-info - WORKING")
        data = response.json()
        print(f"   User: {data.get('first_name')} {data.get('last_name')}")
    else:
        print(f"❌ GET /api/my-info - FAILED ({response.status_code})")
        return False
    
    # Test PUT /api/my-info
    response = requests.put(f"{base_url}/my-info", headers=headers, json={
        "name_alias": "Test Alias",
        "additional_user_data": {"test_field": "test_value"}
    })
    if response.status_code == 200:
        print("✅ PUT /api/my-info - WORKING")
    else:
        print(f"❌ PUT /api/my-info - FAILED ({response.status_code})")
        return False
    
    # Test GET /api/my-documents
    response = requests.get(f"{base_url}/my-documents", headers=headers)
    if response.status_code == 200:
        print("✅ GET /api/my-documents - WORKING")
        docs = response.json()
        print(f"   Found {len(docs)} documents")
    else:
        print(f"❌ GET /api/my-documents - FAILED ({response.status_code})")
        return False
    
    # Test POST /api/my-documents
    response = requests.post(f"{base_url}/my-documents", headers=headers, json={
        "document_type": "PASSPORT",
        "country": "Ukraine",
        "document_number": "TEST123",
        "document_data": {"series": "TE", "issued_by": "Test Authority"}
    })
    if response.status_code == 200:
        print("✅ POST /api/my-documents - WORKING")
        doc_id = response.json()['id']
        
        # Test PUT /api/my-documents/{id}
        response = requests.put(f"{base_url}/my-documents/{doc_id}", headers=headers, json={
            "document_number": "TEST123-UPDATED"
        })
        if response.status_code == 200:
            print("✅ PUT /api/my-documents/{id} - WORKING")
        else:
            print(f"❌ PUT /api/my-documents/{{id}} - FAILED ({response.status_code})")
            return False
        
        # Test DELETE /api/my-documents/{id}
        response = requests.delete(f"{base_url}/my-documents/{doc_id}", headers=headers)
        if response.status_code == 200:
            print("✅ DELETE /api/my-documents/{id} - WORKING")
        else:
            print(f"❌ DELETE /api/my-documents/{{id}} - FAILED ({response.status_code})")
            return False
    else:
        print(f"❌ POST /api/my-documents - FAILED ({response.status_code})")
        return False
    
    print("\n🎉 ALL MY INFO MODULE ENDPOINTS ARE WORKING CORRECTLY!")
    return True

if __name__ == "__main__":
    test_my_info_endpoints()