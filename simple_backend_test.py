#!/usr/bin/env python3

import requests
import sys

def test_existing_user():
    """Test the existing test user that should already be created"""
    base_url = "https://org-posts-fixed.preview.emergentagent.com/api"
    
    print("🔍 Testing existing test user login...")
    
    login_data = {
        "email": "test@zioncity.example",
        "password": "testpass123"
    }
    
    try:
        response = requests.post(f"{base_url}/auth/login", json=login_data, timeout=30)
        print(f"Login response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Login successful!")
            print(f"User: {data['user']['first_name']} {data['user']['last_name']}")
            print(f"Affiliations: {len(data['user']['affiliations'])}")
            
            for aff in data['user']['affiliations']:
                org_name = aff.get('affiliation', {}).get('name', 'Unknown')
                org_type = aff.get('affiliation', {}).get('type', 'Unknown')
                role = aff.get('user_role_in_org', 'Unknown')
                print(f"  - {org_name} ({org_type}) - {role}")
            
            # Test profile endpoint
            token = data['access_token']
            headers = {'Authorization': f'Bearer {token}'}
            
            profile_response = requests.get(f"{base_url}/auth/me", headers=headers, timeout=30)
            print(f"Profile response status: {profile_response.status_code}")
            
            if profile_response.status_code == 200:
                profile_data = profile_response.json()
                print("✅ Profile retrieval successful!")
                print(f"Profile affiliations: {len(profile_data['affiliations'])}")
                return True
            else:
                print("❌ Profile retrieval failed")
                return False
        else:
            print(f"❌ Login failed: {response.status_code}")
            try:
                error_data = response.json()
                print(f"Error: {error_data}")
            except:
                print(f"Response text: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

def main():
    success = test_existing_user()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())