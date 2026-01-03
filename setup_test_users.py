#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class TestUserSetup:
    def __init__(self, base_url="https://personal-ai-chat-24.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.member_token = None
        self.organization_id = None

    def make_request(self, method, endpoint, data=None, expected_status=200, token=None):
        """Make API request with error handling"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                return False, {"error": f"Unsupported method: {method}"}

            success = response.status_code == expected_status
            try:
                response_data = response.json() if response.content else {}
            except:
                response_data = {"raw_response": response.text}
            
            if not success:
                response_data["status_code"] = response.status_code
                response_data["expected_status"] = expected_status
            
            return success, response_data

        except Exception as e:
            return False, {"error": str(e)}

    def create_admin_user(self):
        """Create admin test user"""
        admin_data = {
            "email": "admintest@example.com",
            "password": "admin123",
            "first_name": "Admin",
            "last_name": "Test",
            "phone": "+1234567890"
        }
        
        print("Creating admin user...")
        success, response = self.make_request("POST", "auth/register", admin_data, 200)
        
        if success and "access_token" in response:
            self.admin_token = response["access_token"]
            print(f"✅ Admin user created: {response['user']['id']}")
            return response["user"]["id"]
        else:
            print(f"❌ Failed to create admin user: {response}")
            return None

    def create_member_user(self):
        """Create member test user"""
        member_data = {
            "email": "membertest@example.com",
            "password": "test123",
            "first_name": "Member",
            "last_name": "Test",
            "phone": "+1234567891"
        }
        
        print("Creating member user...")
        success, response = self.make_request("POST", "auth/register", member_data, 200)
        
        if success and "access_token" in response:
            self.member_token = response["access_token"]
            print(f"✅ Member user created: {response['user']['id']}")
            return response["user"]["id"]
        else:
            print(f"❌ Failed to create member user: {response}")
            return None

    def create_test_organization(self, admin_user_id):
        """Create test organization"""
        org_data = {
            "name": "ТестКомпания для Member Settings",
            "organization_type": "COMPANY",
            "description": "Test organization for change request management testing",
            "industry": "Technology",
            "creator_role": "ADMIN",
            "creator_department": "Management",
            "creator_job_title": "Administrator"
        }
        
        print("Creating test organization...")
        success, response = self.make_request("POST", "work/organizations", org_data, 200, self.admin_token)
        
        if success and response.get("id"):
            self.organization_id = response["id"]
            print(f"✅ Organization created: {self.organization_id}")
            return self.organization_id
        else:
            print(f"❌ Failed to create organization: {response}")
            return None

    def add_member_to_organization(self, member_user_id):
        """Add member user to organization"""
        member_data = {
            "user_email": "membertest@example.com",
            "role": "MEMBER",
            "department": "General",
            "job_title": "Team Member"
        }
        
        print("Adding member to organization...")
        success, response = self.make_request(
            "POST", 
            f"work/organizations/{self.organization_id}/members", 
            member_data, 
            200, 
            self.admin_token
        )
        
        if success:
            print(f"✅ Member added to organization")
            return True
        else:
            print(f"❌ Failed to add member to organization: {response}")
            return False

    def setup_all(self):
        """Set up all test data"""
        print("🚀 Setting up test users and organization...")
        print(f"📍 Backend URL: {self.base_url}")
        print("-" * 60)
        
        # Create users
        admin_user_id = self.create_admin_user()
        if not admin_user_id:
            return False
        
        member_user_id = self.create_member_user()
        if not member_user_id:
            return False
        
        # Create organization
        org_id = self.create_test_organization(admin_user_id)
        if not org_id:
            return False
        
        # Add member to organization
        if not self.add_member_to_organization(member_user_id):
            return False
        
        print("-" * 60)
        print("🎉 Test setup completed successfully!")
        print(f"📧 Admin: admintest@example.com / admin123")
        print(f"📧 Member: membertest@example.com / test123")
        print(f"🏢 Organization ID: {self.organization_id}")
        
        # Save setup info
        setup_info = {
            "admin_email": "admintest@example.com",
            "admin_password": "admin123",
            "admin_user_id": admin_user_id,
            "member_email": "membertest@example.com",
            "member_password": "test123",
            "member_user_id": member_user_id,
            "organization_id": self.organization_id,
            "setup_timestamp": datetime.now().isoformat()
        }
        
        try:
            with open('/app/test_setup_info.json', 'w') as f:
                json.dump(setup_info, f, indent=2)
            print(f"📄 Setup info saved to: /app/test_setup_info.json")
        except Exception as e:
            print(f"⚠️  Could not save setup info: {e}")
        
        return True

def main():
    """Main setup execution"""
    setup = TestUserSetup()
    success = setup.setup_all()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())