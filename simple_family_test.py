#!/usr/bin/env python3

import requests
import json

def test_family_profile_system():
    """Simple test of Family Profile System core functionality"""
    base_url = "https://upload-icon-repair.preview.emergentagent.com/api"
    
    # Login
    print("🔍 Testing login...")
    login_response = requests.post(f"{base_url}/auth/login", json={
        "email": "test@example.com",
        "password": "password123"
    })
    
    if login_response.status_code != 200:
        print("❌ Login failed")
        return False
    
    token = login_response.json()['access_token']
    user_id = login_response.json()['user']['id']
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    
    print("✅ Login successful")
    
    # Create family profile
    print("🔍 Testing family profile creation...")
    family_data = {
        "family_name": "Test Family API",
        "family_surname": "TestAPI",
        "description": "API test family",
        "is_private": True,
        "allow_public_discovery": False
    }
    
    family_response = requests.post(f"{base_url}/family-profiles", json=family_data, headers=headers)
    
    if family_response.status_code != 200:
        print(f"❌ Family creation failed: {family_response.status_code}")
        print(family_response.text)
        return False
    
    family_id = family_response.json()['id']
    print(f"✅ Family profile created: {family_id}")
    
    # Get family profiles
    print("🔍 Testing get family profiles...")
    get_families_response = requests.get(f"{base_url}/family-profiles", headers=headers)
    
    if get_families_response.status_code != 200:
        print("❌ Get families failed")
        return False
    
    families = get_families_response.json()['family_profiles']
    print(f"✅ Retrieved {len(families)} family profiles")
    
    # Create family post
    print("🔍 Testing family post creation...")
    post_data = {
        "title": "Test Post",
        "content": "This is a test family post",
        "content_type": "ANNOUNCEMENT",
        "privacy_level": "PUBLIC"
    }
    
    post_response = requests.post(f"{base_url}/family-profiles/{family_id}/posts", json=post_data, headers=headers)
    
    if post_response.status_code != 200:
        print(f"❌ Family post creation failed: {post_response.status_code}")
        print(post_response.text)
        return False
    
    post_id = post_response.json()['id']
    print(f"✅ Family post created: {post_id}")
    
    # Get family posts
    print("🔍 Testing get family posts...")
    get_posts_response = requests.get(f"{base_url}/family-profiles/{family_id}/posts", headers=headers)
    
    if get_posts_response.status_code != 200:
        print("❌ Get family posts failed")
        return False
    
    posts = get_posts_response.json()['family_posts']
    print(f"✅ Retrieved {len(posts)} family posts")
    
    # Send invitation
    print("🔍 Testing family invitation...")
    invitation_data = {
        "invited_user_email": "newmember@test.com",
        "invitation_type": "MEMBER",
        "relationship_to_family": "Friend",
        "message": "Join our family!"
    }
    
    invite_response = requests.post(f"{base_url}/family-profiles/{family_id}/invite", json=invitation_data, headers=headers)
    
    if invite_response.status_code != 200:
        print(f"❌ Family invitation failed: {invite_response.status_code}")
        print(invite_response.text)
        return False
    
    invitation_id = invite_response.json()['invitation_id']
    print(f"✅ Family invitation sent: {invitation_id}")
    
    # Get family members
    print("🔍 Testing get family members...")
    members_response = requests.get(f"{base_url}/family-profiles/{family_id}/members", headers=headers)
    
    if members_response.status_code != 200:
        print("❌ Get family members failed")
        return False
    
    members = members_response.json()['family_members']
    print(f"✅ Retrieved {len(members)} family members")
    
    print("\n🎉 ALL CORE FAMILY PROFILE SYSTEM TESTS PASSED!")
    return True

if __name__ == "__main__":
    success = test_family_profile_system()
    if not success:
        exit(1)