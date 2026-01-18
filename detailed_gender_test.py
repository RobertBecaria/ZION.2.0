#!/usr/bin/env python3
"""
Detailed Gender Update API Response Verification
Shows the exact API responses for verification
"""

import requests
import json
import uuid

# Backend URL from environment
BACKEND_URL = "https://dbfix-social.preview.emergentagent.com/api"

def test_detailed_responses():
    """Test and show detailed API responses"""
    print("🔍 DETAILED GENDER UPDATE API RESPONSE VERIFICATION")
    print("=" * 60)
    
    # Register a new user
    test_email = f"detailtest_{uuid.uuid4().hex[:8]}@test.com"
    registration_data = {
        "email": test_email,
        "password": "testpassword123",
        "first_name": "Detail",
        "last_name": "Tester",
        "gender": "MALE"
    }
    
    print(f"\n1. Registering user: {test_email}")
    response = requests.post(f"{BACKEND_URL}/auth/register", json=registration_data)
    print(f"   Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        access_token = data.get("access_token")
        print(f"   ✅ Registration successful, token received")
        
        # Test gender update with detailed response
        print(f"\n2. Testing gender update to FEMALE")
        headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
        gender_response = requests.put(f"{BACKEND_URL}/users/gender", json={"gender": "FEMALE"}, headers=headers)
        
        print(f"   Status: {gender_response.status_code}")
        print(f"   Response: {json.dumps(gender_response.json(), indent=2)}")
        
        # Test without token
        print(f"\n3. Testing gender update without token")
        no_token_response = requests.put(f"{BACKEND_URL}/users/gender", json={"gender": "MALE"})
        print(f"   Status: {no_token_response.status_code}")
        print(f"   Response: {no_token_response.text}")
        
        # Test all gender options
        print(f"\n4. Testing all gender options:")
        for gender in ["MALE", "FEMALE", "IT"]:
            print(f"\n   Testing {gender}:")
            resp = requests.put(f"{BACKEND_URL}/users/gender", json={"gender": gender}, headers=headers)
            print(f"   Status: {resp.status_code}")
            if resp.status_code == 200:
                print(f"   Response: {json.dumps(resp.json(), indent=2)}")
            else:
                print(f"   Error: {resp.text}")
    else:
        print(f"   ❌ Registration failed: {response.text}")

if __name__ == "__main__":
    test_detailed_responses()