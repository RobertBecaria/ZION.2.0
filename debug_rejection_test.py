#!/usr/bin/env python3

import requests
import json
import time

def test_rejection_status():
    base_url = "https://goodwill-events.preview.emergentagent.com"
    
    # Login as admin
    login_data = {"email": "admintest@example.com", "password": "admin123"}
    response = requests.post(f"{base_url}/api/auth/login", json=login_data)
    admin_token = response.json()["access_token"]
    
    headers = {'Authorization': f'Bearer {admin_token}', 'Content-Type': 'application/json'}
    org_id = "7a1968de-4575-46ef-8d99-7650fd522a2b"
    
    # Get all change requests
    response = requests.get(f"{base_url}/api/work/organizations/{org_id}/change-requests", headers=headers)
    data = response.json()
    
    print("All change requests:")
    for req in data.get("data", []):
        print(f"ID: {req.get('id')}")
        print(f"Type: {req.get('request_type')}")
        print(f"Status: {req.get('status')}")
        print(f"User: {req.get('user_first_name')} {req.get('user_last_name')}")
        print(f"Rejection reason: {req.get('rejection_reason')}")
        print("-" * 40)

if __name__ == "__main__":
    test_rejection_status()