#!/usr/bin/env python3
"""
Debug script to check teacher data structure
"""

import requests
import json

# Configuration
BASE_URL = "https://personal-ai-chat-24.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "admin123"

def debug_teachers():
    # Login as admin
    login_response = requests.post(f"{BASE_URL}/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    
    if login_response.status_code != 200:
        print("Failed to login")
        return
    
    token = login_response.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get organizations
    orgs_response = requests.get(f"{BASE_URL}/work/organizations", headers=headers)
    if orgs_response.status_code == 200:
        orgs = orgs_response.json().get("organizations", [])
        print(f"Found {len(orgs)} organizations:")
        for org in orgs:
            print(f"  - {org.get('name')} ({org.get('id')}) - Type: {org.get('organization_type')}")
            
            if org.get("organization_type") == "EDUCATIONAL":
                org_id = org.get("id")
                print(f"\nTesting teachers endpoint for {org.get('name')}...")
                
                # Try to get teachers
                teachers_response = requests.get(f"{BASE_URL}/work/organizations/{org_id}/teachers", headers=headers)
                print(f"Teachers endpoint status: {teachers_response.status_code}")
                if teachers_response.status_code != 200:
                    print(f"Error: {teachers_response.text}")
                else:
                    teachers = teachers_response.json()
                    print(f"Teachers response: {json.dumps(teachers, indent=2)}")
                
                # Try to get members to see structure
                members_response = requests.get(f"{BASE_URL}/work/organizations/{org_id}/members", headers=headers)
                print(f"\nMembers endpoint status: {members_response.status_code}")
                if members_response.status_code == 200:
                    members_data = members_response.json()
                    members = members_data.get("members", [])
                    print(f"Found {len(members)} members")
                    for member in members[:2]:  # Show first 2 members
                        print(f"Member structure: {json.dumps(member, indent=2, default=str)}")
                break

if __name__ == "__main__":
    debug_teachers()