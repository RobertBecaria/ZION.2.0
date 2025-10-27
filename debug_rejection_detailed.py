#!/usr/bin/env python3

import requests
import json
import time
from datetime import datetime

def debug_rejection():
    base_url = "https://zion-collab.preview.emergentagent.com"
    timestamp = datetime.now().strftime('%H%M%S')
    
    print("=== DEBUGGING REJECTION FLOW ===")
    
    # Create fresh users
    admin_data = {
        "email": f"debugadmin{timestamp}@example.com",
        "password": "admin123",
        "first_name": "Debug",
        "last_name": "Admin"
    }
    
    response = requests.post(f"{base_url}/api/auth/register", json=admin_data)
    admin_token = response.json()["access_token"]
    admin_user_id = response.json()["user"]["id"]
    
    member_data = {
        "email": f"debugmember{timestamp}@example.com",
        "password": "test123",
        "first_name": "Debug",
        "last_name": "Member"
    }
    
    response = requests.post(f"{base_url}/api/auth/register", json=member_data)
    member_token = response.json()["access_token"]
    member_user_id = response.json()["user"]["id"]
    
    # Create organization
    org_data = {
        "name": f"Debug Org {timestamp}",
        "organization_type": "COMPANY",
        "creator_role": "ADMIN"
    }
    
    headers_admin = {'Authorization': f'Bearer {admin_token}', 'Content-Type': 'application/json'}
    headers_member = {'Authorization': f'Bearer {member_token}', 'Content-Type': 'application/json'}
    
    response = requests.post(f"{base_url}/api/work/organizations", json=org_data, headers=headers_admin)
    org_id = response.json()["id"]
    
    # Add member
    member_add_data = {
        "user_email": f"debugmember{timestamp}@example.com",
        "role": "MEMBER",
        "department": "General"
    }
    
    response = requests.post(f"{base_url}/api/work/organizations/{org_id}/members", json=member_add_data, headers=headers_admin)
    print(f"Add member response: {response.status_code}")
    
    # Member creates department change request
    request_data = {
        "requested_department": "Engineering",
        "reason": "Debug test for rejection"
    }
    
    response = requests.put(f"{base_url}/api/work/organizations/{org_id}/members/me", json=request_data, headers=headers_member)
    print(f"Create request response: {response.status_code} - {response.json()}")
    
    time.sleep(1)
    
    # Get pending requests
    response = requests.get(f"{base_url}/api/work/organizations/{org_id}/change-requests?status=PENDING", headers=headers_admin)
    pending_data = response.json()
    print(f"Pending requests: {json.dumps(pending_data, indent=2)}")
    
    if pending_data.get("data"):
        request_id = pending_data["data"][0]["id"]
        print(f"Found request ID: {request_id}")
        
        # Try rejection with query parameter
        rejection_reason = "Debug rejection test"
        response = requests.post(
            f"{base_url}/api/work/organizations/{org_id}/change-requests/{request_id}/reject?rejection_reason={rejection_reason}", 
            json={}, 
            headers=headers_admin
        )
        print(f"Rejection response: {response.status_code} - {response.json()}")
        
        time.sleep(1)
        
        # Check all requests after rejection (without status filter to get all)
        # But since the endpoint defaults to PENDING, let's try REJECTED specifically
        response = requests.get(f"{base_url}/api/work/organizations/{org_id}/change-requests?status=REJECTED", headers=headers_admin)
        all_data = response.json()
        print(f"All requests after rejection: {json.dumps(all_data, indent=2)}")
        
        # Check specifically for our request
        for req in all_data.get("data", []):
            if req.get("id") == request_id:
                print(f"Found our request: Status={req.get('status')}, Reason={req.get('rejection_reason')}")
                break
        else:
            print("Our request not found in all requests!")

if __name__ == "__main__":
    debug_rejection()