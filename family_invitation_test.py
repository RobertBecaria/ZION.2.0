#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timedelta, timezone
import uuid

class FamilyInvitationSystemTester:
    def __init__(self, base_url="https://connect-news.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.second_token = None
        self.second_user_id = None
        self.family_id = None
        self.invitation_id = None
        self.tests_run = 0
        self.tests_passed = 0
        
        # Test users for cross-user invitation testing
        self.test_user_email = "test@example.com"
        self.test_user_password = "password123"
        self.second_user_email = "30new18@gmail.com"
        self.second_user_password = "password123"

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        if details:
            print(f"   Details: {details}")

    def make_request(self, method, endpoint, data=None, auth_required=False, token=None, retries=2):
        """Make HTTP request to API with retry logic"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if auth_required:
            auth_token = token or self.token
            if auth_token:
                headers['Authorization'] = f'Bearer {auth_token}'
        
        for attempt in range(retries + 1):
            try:
                if method == 'GET':
                    response = requests.get(url, headers=headers, timeout=15)
                elif method == 'POST':
                    response = requests.post(url, json=data, headers=headers, timeout=15)
                elif method == 'PUT':
                    response = requests.put(url, json=data, headers=headers, timeout=15)
                elif method == 'DELETE':
                    response = requests.delete(url, headers=headers, timeout=15)
                
                print(f"   Request: {method} {url} -> Status: {response.status_code}")
                
                if response.status_code == 422:
                    try:
                        error_data = response.json()
                        print(f"   422 Error Details: {error_data}")
                    except:
                        print(f"   422 Error Text: {response.text}")
                
                return response
            except requests.exceptions.RequestException as e:
                if attempt < retries:
                    print(f"   Retry {attempt + 1}/{retries} for {method} {url}: {str(e)}")
                    import time
                    time.sleep(1)
                else:
                    print(f"❌ Network error for {method} {url} after {retries + 1} attempts: {str(e)}")
                    return None

    def test_user_authentication(self):
        """Test authentication for both test users"""
        print("\n🔍 Testing User Authentication...")
        
        # Login first user
        login_data = {
            "email": self.test_user_email,
            "password": self.test_user_password
        }
        
        response = self.make_request('POST', 'auth/login', login_data)
        
        if response and response.status_code == 200:
            data = response.json()
            if 'access_token' in data and 'user' in data:
                self.token = data['access_token']
                self.user_id = data['user']['id']
                self.log_test("First user authentication", True, f"User ID: {self.user_id}")
                first_auth_success = True
            else:
                self.log_test("First user authentication", False, "Missing token or user data")
                first_auth_success = False
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("First user authentication", False, error_msg)
            first_auth_success = False
        
        # Login second user
        login_data = {
            "email": self.second_user_email,
            "password": self.second_user_password
        }
        
        response = self.make_request('POST', 'auth/login', login_data)
        
        if response and response.status_code == 200:
            data = response.json()
            if 'access_token' in data and 'user' in data:
                self.second_token = data['access_token']
                self.second_user_id = data['user']['id']
                self.log_test("Second user authentication", True, f"User ID: {self.second_user_id}")
                second_auth_success = True
            else:
                self.log_test("Second user authentication", False, "Missing token or user data")
                second_auth_success = False
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("Second user authentication", False, error_msg)
            second_auth_success = False
        
        return first_auth_success and second_auth_success

    def test_family_profile_creation(self):
        """Test family profile creation"""
        print("\n🔍 Testing Family Profile Creation...")
        
        if not self.token:
            self.log_test("Family profile creation", False, "No authentication token available")
            return False
        
        family_data = {
            "family_name": "The Smith Family",
            "family_surname": "Smith",
            "description": "A loving family from the suburbs",
            "public_bio": "We love spending time together and sharing our adventures",
            "primary_address": "123 Main Street",
            "city": "Springfield",
            "state": "Illinois",
            "country": "USA",
            "established_date": "2020-01-01T00:00:00Z",
            "is_private": True,
            "allow_public_discovery": False
        }
        
        response = self.make_request('POST', 'family-profiles', family_data, auth_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            success = (
                'id' in data and
                'family_name' in data and
                'creator_id' in data and
                'is_user_member' in data and
                'user_role' in data and
                data['family_name'] == family_data['family_name'] and
                data['creator_id'] == self.user_id and
                data['is_user_member'] == True and
                data['user_role'] == 'CREATOR'
            )
            
            if success:
                self.family_id = data['id']
                self.log_test("Family profile creation", True, f"Family ID: {self.family_id}, Role: {data['user_role']}")
                return True
            else:
                self.log_test("Family profile creation", False, "Invalid response structure")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            if response:
                try:
                    error_data = response.json()
                    error_msg += f", Details: {error_data.get('detail', '')}"
                except:
                    pass
            self.log_test("Family profile creation", False, error_msg)
        
        return False

    def test_family_invitation_sending(self):
        """Test sending family invitations with different roles"""
        print("\n🔍 Testing Family Invitation Sending...")
        
        if not self.token or not self.family_id:
            self.log_test("Family invitation sending", False, "No authentication token or family ID available")
            return False
        
        # Test 1: Send invitation to second user as MEMBER
        invitation_data = {
            "invited_user_email": self.second_user_email,
            "invitation_type": "MEMBER",
            "relationship_to_family": "Friend",
            "message": "Welcome to our family! We'd love to have you join us."
        }
        
        response = self.make_request('POST', f'family-profiles/{self.family_id}/invite', invitation_data, auth_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            success = (
                'message' in data and
                'invitation_id' in data and
                data['message'] == 'Invitation sent successfully'
            )
            
            if success:
                self.invitation_id = data['invitation_id']
                self.log_test("Send MEMBER invitation", True, f"Invitation ID: {self.invitation_id}")
                member_invite_success = True
            else:
                self.log_test("Send MEMBER invitation", False, "Invalid response structure")
                member_invite_success = False
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            if response:
                try:
                    error_data = response.json()
                    error_msg += f", Details: {error_data.get('detail', '')}"
                except:
                    pass
            self.log_test("Send MEMBER invitation", False, error_msg)
            member_invite_success = False
        
        # Test 2: Send invitation to a different email as ADMIN
        admin_invitation_data = {
            "invited_user_email": "admin@example.com",
            "invitation_type": "ADMIN",
            "relationship_to_family": "Spouse",
            "message": "Join as family admin"
        }
        
        response = self.make_request('POST', f'family-profiles/{self.family_id}/invite', admin_invitation_data, auth_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            admin_invite_success = (
                'message' in data and
                'invitation_id' in data and
                data['message'] == 'Invitation sent successfully'
            )
            self.log_test("Send ADMIN invitation", admin_invite_success, f"Admin invitation ID: {data.get('invitation_id')}")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("Send ADMIN invitation", False, error_msg)
            admin_invite_success = False
        
        # Test 3: Test duplicate invitation prevention
        duplicate_response = self.make_request('POST', f'family-profiles/{self.family_id}/invite', invitation_data, auth_required=True)
        
        if duplicate_response and duplicate_response.status_code == 400:
            try:
                error_data = duplicate_response.json()
                duplicate_success = "already sent" in error_data.get('detail', '').lower()
                self.log_test("Duplicate invitation prevention", duplicate_success, f"Error: {error_data.get('detail')}")
            except:
                self.log_test("Duplicate invitation prevention", True, "Got 400 status as expected")
                duplicate_success = True
        else:
            status = duplicate_response.status_code if duplicate_response else "No response"
            self.log_test("Duplicate invitation prevention", False, f"Expected 400, got {status}")
            duplicate_success = False
        
        return member_invite_success and admin_invite_success and duplicate_success

    def test_invitation_management_endpoints(self):
        """Test invitation retrieval endpoints"""
        print("\n🔍 Testing Invitation Management Endpoints...")
        
        if not self.token or not self.second_token:
            self.log_test("Invitation management", False, "Authentication tokens not available")
            return False
        
        # Test 1: Get received invitations (second user)
        response = self.make_request('GET', 'family-invitations/received', auth_required=True, token=self.second_token)
        
        if response and response.status_code == 200:
            data = response.json()
            invitations = data.get('invitations', [])
            
            # Look for our invitation
            our_invitation = None
            for invitation in invitations:
                if invitation.get('id') == self.invitation_id:
                    our_invitation = invitation
                    break
            
            if our_invitation:
                received_success = (
                    'family_name' in our_invitation and
                    'invited_by_name' in our_invitation and
                    'status' in our_invitation and
                    'invitation_type' in our_invitation and
                    our_invitation['status'] == 'PENDING' and
                    our_invitation['invitation_type'] == 'MEMBER'
                )
                
                details = f"Found invitation from {our_invitation.get('invited_by_name')} for {our_invitation.get('family_name')}"
                self.log_test("Get received invitations", received_success, details)
            else:
                self.log_test("Get received invitations", False, f"Our invitation not found in {len(invitations)} invitations")
                received_success = False
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("Get received invitations", False, error_msg)
            received_success = False
        
        # Test 2: Get sent invitations (first user)
        response = self.make_request('GET', 'family-invitations/sent', auth_required=True, token=self.token)
        
        if response and response.status_code == 200:
            data = response.json()
            invitations = data.get('invitations', [])
            
            # Should have at least 2 invitations (MEMBER and ADMIN)
            sent_success = len(invitations) >= 2
            
            if sent_success:
                # Check data enrichment
                first_invitation = invitations[0]
                enrichment_success = (
                    'family_name' in first_invitation and
                    'invited_user_email' in first_invitation and
                    'status' in first_invitation
                )
                
                details = f"Found {len(invitations)} sent invitations with proper enrichment"
                self.log_test("Get sent invitations", enrichment_success, details)
                sent_success = enrichment_success
            else:
                self.log_test("Get sent invitations", False, f"Expected at least 2 invitations, got {len(invitations)}")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            self.log_test("Get sent invitations", False, error_msg)
            sent_success = False
        
        return received_success and sent_success

    def test_invitation_response_workflow(self):
        """Test invitation acceptance and decline workflow"""
        print("\n🔍 Testing Invitation Response Workflow...")
        
        if not self.second_token or not self.invitation_id:
            self.log_test("Invitation response workflow", False, "Second user token or invitation ID not available")
            return False
        
        # Test 1: Accept invitation
        response = self.make_request('POST', f'family-invitations/{self.invitation_id}/accept', auth_required=True, token=self.second_token)
        
        if response and response.status_code == 200:
            data = response.json()
            accept_success = data.get('message') == 'Invitation accepted successfully'
            self.log_test("Accept family invitation", accept_success, f"Response: {data.get('message')}")
        else:
            error_msg = f"Status: {response.status_code}" if response else "No response"
            if response:
                try:
                    error_data = response.json()
                    error_msg += f", Details: {error_data.get('detail', '')}"
                except:
                    pass
            self.log_test("Accept family invitation", False, error_msg)
            accept_success = False
        
        # Test 2: Verify family membership was created
        if accept_success:
            response = self.make_request('GET', f'family-profiles/{self.family_id}/members', auth_required=True, token=self.token)
            
            if response and response.status_code == 200:
                data = response.json()
                members = data.get('family_members', [])
                
                # Should have 2 members now (creator + accepted member)
                member_count_success = len(members) == 2
                
                if member_count_success:
                    # Find the new member
                    new_member = None
                    for member in members:
                        if member.get('user_id') == self.second_user_id:
                            new_member = member
                            break
                    
                    if new_member:
                        membership_success = (
                            new_member.get('family_role') == 'ADULT_MEMBER' and
                            new_member.get('invitation_accepted') == True and
                            new_member.get('relationship_to_family') == 'Friend'
                        )
                        details = f"New member role: {new_member.get('family_role')}, Relationship: {new_member.get('relationship_to_family')}"
                        self.log_test("Verify family membership creation", membership_success, details)
                    else:
                        self.log_test("Verify family membership creation", False, "New member not found in family members list")
                        membership_success = False
                else:
                    self.log_test("Verify family membership creation", False, f"Expected 2 members, got {len(members)}")
                    membership_success = False
            else:
                error_msg = f"Status: {response.status_code}" if response else "No response"
                self.log_test("Verify family membership creation", False, error_msg)
                membership_success = False
        else:
            membership_success = False
        
        # Test 3: Test decline workflow with a new invitation
        decline_invitation_data = {
            "invited_user_email": "decline@example.com",
            "invitation_type": "MEMBER",
            "relationship_to_family": "Neighbor",
            "message": "This invitation will be declined"
        }
        
        response = self.make_request('POST', f'family-profiles/{self.family_id}/invite', decline_invitation_data, auth_required=True)
        
        if response and response.status_code == 200:
            data = response.json()
            decline_invitation_id = data.get('invitation_id')
            
            if decline_invitation_id:
                # Since we don't have a third user, we'll test the decline endpoint with wrong user
                decline_response = self.make_request('POST', f'family-invitations/{decline_invitation_id}/decline', auth_required=True, token=self.second_token)
                
                if decline_response and decline_response.status_code == 403:
                    # This should fail because the invitation is not for the second user
                    self.log_test("Decline invitation authorization", True, "Correctly blocked unauthorized decline")
                    decline_success = True
                else:
                    status = decline_response.status_code if decline_response else "No response"
                    self.log_test("Decline invitation authorization", False, f"Expected 403, got {status}")
                    decline_success = False
            else:
                self.log_test("Create decline test invitation", False, "No invitation ID returned")
                decline_success = False
        else:
            self.log_test("Create decline test invitation", False, "Failed to create test invitation")
            decline_success = False
        
        return accept_success and membership_success and decline_success

    def test_role_based_permissions(self):
        """Test role-based permissions and validation"""
        print("\n🔍 Testing Role-Based Permissions & Validation...")
        
        if not self.token or not self.second_token or not self.family_id:
            self.log_test("Role-based permissions", False, "Required tokens or family ID not available")
            return False
        
        # Test 1: Only family admins/creators can send invitations
        # Try to send invitation as regular member (second user)
        unauthorized_invitation = {
            "invited_user_email": "unauthorized@example.com",
            "invitation_type": "MEMBER",
            "relationship_to_family": "Friend",
            "message": "This should fail"
        }
        
        response = self.make_request('POST', f'family-profiles/{self.family_id}/invite', unauthorized_invitation, auth_required=True, token=self.second_token)
        
        if response and response.status_code == 403:
            try:
                error_data = response.json()
                admin_only_success = "only family admins" in error_data.get('detail', '').lower()
                self.log_test("Admin-only invitation sending", admin_only_success, f"Error: {error_data.get('detail')}")
            except:
                self.log_test("Admin-only invitation sending", True, "Got 403 status as expected")
                admin_only_success = True
        else:
            status = response.status_code if response else "No response"
            self.log_test("Admin-only invitation sending", False, f"Expected 403, got {status}")
            admin_only_success = False
        
        # Test 2: Email validation
        invalid_email_invitation = {
            "invited_user_email": "invalid-email",
            "invitation_type": "MEMBER",
            "relationship_to_family": "Friend",
            "message": "Invalid email test"
        }
        
        response = self.make_request('POST', f'family-profiles/{self.family_id}/invite', invalid_email_invitation, auth_required=True, token=self.token)
        
        if response and response.status_code == 422:
            try:
                error_data = response.json()
                email_validation_success = True
                self.log_test("Email validation", True, "Invalid email correctly rejected")
            except:
                self.log_test("Email validation", True, "Got 422 validation error as expected")
                email_validation_success = True
        else:
            status = response.status_code if response else "No response"
            self.log_test("Email validation", False, f"Expected 422, got {status}")
            email_validation_success = False
        
        # Test 3: Test invitation expiration (7-day expiry)
        # Create invitation and check expires_at field
        test_invitation = {
            "invited_user_email": "expiry@example.com",
            "invitation_type": "MEMBER",
            "relationship_to_family": "Friend",
            "message": "Testing expiry"
        }
        
        response = self.make_request('POST', f'family-profiles/{self.family_id}/invite', test_invitation, auth_required=True, token=self.token)
        
        if response and response.status_code == 200:
            # Check sent invitations to verify expiry date
            sent_response = self.make_request('GET', 'family-invitations/sent', auth_required=True, token=self.token)
            
            if sent_response and sent_response.status_code == 200:
                sent_data = sent_response.json()
                invitations = sent_data.get('invitations', [])
                
                # Find the expiry test invitation
                expiry_invitation = None
                for invitation in invitations:
                    if invitation.get('invited_user_email') == 'expiry@example.com':
                        expiry_invitation = invitation
                        break
                
                if expiry_invitation and 'expires_at' in expiry_invitation:
                    # Check if expires_at is approximately 7 days from now
                    expires_at = datetime.fromisoformat(expiry_invitation['expires_at'].replace('Z', '+00:00'))
                    sent_at = datetime.fromisoformat(expiry_invitation['sent_at'].replace('Z', '+00:00'))
                    expiry_delta = expires_at - sent_at
                    
                    # Should be close to 7 days (allow some tolerance)
                    expiry_success = abs(expiry_delta.days - 7) <= 1
                    self.log_test("Invitation expiration handling", expiry_success, f"Expires in {expiry_delta.days} days")
                else:
                    self.log_test("Invitation expiration handling", False, "Expiry invitation not found or missing expires_at")
                    expiry_success = False
            else:
                self.log_test("Invitation expiration handling", False, "Could not retrieve sent invitations")
                expiry_success = False
        else:
            self.log_test("Invitation expiration handling", False, "Could not create expiry test invitation")
            expiry_success = False
        
        return admin_only_success and email_validation_success and expiry_success

    def test_database_integration(self):
        """Test database integration and data flow"""
        print("\n🔍 Testing Database Integration & Data Flow...")
        
        if not self.token or not self.family_id:
            self.log_test("Database integration", False, "Required tokens or family ID not available")
            return False
        
        # Test 1: Verify family_invitations collection operations
        response = self.make_request('GET', 'family-invitations/sent', auth_required=True, token=self.token)
        
        if response and response.status_code == 200:
            data = response.json()
            invitations = data.get('invitations', [])
            
            if invitations:
                # Check invitation data structure
                first_invitation = invitations[0]
                invitation_structure_success = all(field in first_invitation for field in [
                    'id', 'family_id', 'invited_by_user_id', 'invited_user_email',
                    'invitation_type', 'status', 'sent_at', 'expires_at'
                ])
                
                self.log_test("Family invitations collection structure", invitation_structure_success, 
                             f"Verified {len(invitations)} invitations with proper structure")
            else:
                self.log_test("Family invitations collection structure", False, "No invitations found")
                invitation_structure_success = False
        else:
            self.log_test("Family invitations collection structure", False, "Could not retrieve invitations")
            invitation_structure_success = False
        
        # Test 2: Verify family_members collection updates
        response = self.make_request('GET', f'family-profiles/{self.family_id}/members', auth_required=True, token=self.token)
        
        if response and response.status_code == 200:
            data = response.json()
            members = data.get('family_members', [])
            
            if members:
                # Check member data structure
                first_member = members[0]
                member_structure_success = all(field in first_member for field in [
                    'id', 'user_id', 'family_role', 'invitation_accepted', 'joined_at',
                    'user_first_name', 'user_last_name'
                ])
                
                self.log_test("Family members collection structure", member_structure_success,
                             f"Verified {len(members)} members with proper structure")
            else:
                self.log_test("Family members collection structure", False, "No members found")
                member_structure_success = False
        else:
            self.log_test("Family members collection structure", False, "Could not retrieve members")
            member_structure_success = False
        
        # Test 3: Verify family_profiles member count updates
        response = self.make_request('GET', f'family-profiles/{self.family_id}', auth_required=True, token=self.token)
        
        if response and response.status_code == 200:
            data = response.json()
            member_count = data.get('member_count', 0)
            
            # Should be 2 (creator + accepted member)
            count_success = member_count == 2
            self.log_test("Family profile member count update", count_success, f"Member count: {member_count}")
        else:
            self.log_test("Family profile member count update", False, "Could not retrieve family profile")
            count_success = False
        
        # Test 4: Test status tracking (PENDING, ACCEPTED, DECLINED)
        response = self.make_request('GET', 'family-invitations/sent', auth_required=True, token=self.token)
        
        if response and response.status_code == 200:
            data = response.json()
            invitations = data.get('invitations', [])
            
            # Check for different statuses
            statuses = set(invitation.get('status') for invitation in invitations)
            status_tracking_success = 'ACCEPTED' in statuses and 'PENDING' in statuses
            
            self.log_test("Invitation status tracking", status_tracking_success, f"Found statuses: {list(statuses)}")
        else:
            self.log_test("Invitation status tracking", False, "Could not retrieve invitations for status check")
            status_tracking_success = False
        
        return invitation_structure_success and member_structure_success and count_success and status_tracking_success

    def test_error_cases(self):
        """Test error cases and edge scenarios"""
        print("\n🔍 Testing Error Cases & Edge Scenarios...")
        
        if not self.token:
            self.log_test("Error cases", False, "No authentication token available")
            return False
        
        # Test 1: Non-existent family invitation
        fake_invitation_id = str(uuid.uuid4())
        response = self.make_request('POST', f'family-invitations/{fake_invitation_id}/accept', auth_required=True, token=self.token)
        
        if response and response.status_code == 404:
            self.log_test("Non-existent invitation handling", True, "Correctly returned 404 for non-existent invitation")
            nonexistent_success = True
        else:
            status = response.status_code if response else "No response"
            self.log_test("Non-existent invitation handling", False, f"Expected 404, got {status}")
            nonexistent_success = False
        
        # Test 2: Unauthorized access to family
        fake_family_id = str(uuid.uuid4())
        response = self.make_request('GET', f'family-profiles/{fake_family_id}', auth_required=True, token=self.token)
        
        if response and response.status_code == 404:
            self.log_test("Non-existent family access", True, "Correctly returned 404 for non-existent family")
            unauthorized_family_success = True
        else:
            status = response.status_code if response else "No response"
            self.log_test("Non-existent family access", False, f"Expected 404, got {status}")
            unauthorized_family_success = False
        
        # Test 3: User can only respond to their own invitations
        # This was already tested in the response workflow, but let's verify again
        if self.invitation_id:
            # Try to accept invitation with wrong user (first user trying to accept invitation meant for second user)
            response = self.make_request('POST', f'family-invitations/{self.invitation_id}/accept', auth_required=True, token=self.token)
            
            if response and response.status_code == 403:
                self.log_test("Own invitation only access", True, "Correctly blocked access to other user's invitation")
                own_invitation_success = True
            elif response and response.status_code == 400:
                # Might be already accepted
                try:
                    error_data = response.json()
                    if "no longer valid" in error_data.get('detail', '').lower():
                        self.log_test("Own invitation only access", True, "Invitation already processed (expected)")
                        own_invitation_success = True
                    else:
                        self.log_test("Own invitation only access", False, f"Unexpected 400 error: {error_data.get('detail')}")
                        own_invitation_success = False
                except:
                    self.log_test("Own invitation only access", False, "Could not parse 400 error")
                    own_invitation_success = False
            else:
                status = response.status_code if response else "No response"
                self.log_test("Own invitation only access", False, f"Expected 403 or 400, got {status}")
                own_invitation_success = False
        else:
            self.log_test("Own invitation only access", False, "No invitation ID available for testing")
            own_invitation_success = False
        
        return nonexistent_success and unauthorized_family_success and own_invitation_success

    def run_comprehensive_family_invitation_tests(self):
        """Run comprehensive Family Invitation System tests"""
        print("🚀 Starting Family Invitation System Comprehensive Tests...")
        print(f"📡 Testing against: {self.base_url}")
        print("=" * 80)
        
        # Phase 1: Authentication Setup
        print("\n🔐 PHASE 1: USER AUTHENTICATION SETUP")
        print("=" * 60)
        auth_success = self.test_user_authentication()
        
        if not auth_success:
            print("❌ Authentication failed. Cannot proceed with family invitation tests.")
            return False
        
        # Phase 2: Family Profile Creation & Invitation Sending
        print("\n👨‍👩‍👧‍👦 PHASE 2: FAMILY PROFILE CREATION & INVITATION SENDING")
        print("=" * 60)
        family_creation_success = self.test_family_profile_creation()
        
        if family_creation_success:
            invitation_sending_success = self.test_family_invitation_sending()
        else:
            print("❌ Family profile creation failed. Cannot proceed with invitation tests.")
            return False
        
        # Phase 3: Invitation Management Endpoints
        print("\n📋 PHASE 3: INVITATION MANAGEMENT ENDPOINTS")
        print("=" * 60)
        invitation_management_success = self.test_invitation_management_endpoints()
        
        # Phase 4: Invitation Response Workflow
        print("\n✅ PHASE 4: INVITATION RESPONSE WORKFLOW")
        print("=" * 60)
        response_workflow_success = self.test_invitation_response_workflow()
        
        # Phase 5: Role-Based Permissions & Validation
        print("\n🔒 PHASE 5: ROLE-BASED PERMISSIONS & VALIDATION")
        print("=" * 60)
        permissions_success = self.test_role_based_permissions()
        
        # Phase 6: Database Integration & Data Flow
        print("\n💾 PHASE 6: DATABASE INTEGRATION & DATA FLOW")
        print("=" * 60)
        database_success = self.test_database_integration()
        
        # Phase 7: Error Cases & Edge Scenarios
        print("\n⚠️ PHASE 7: ERROR CASES & EDGE SCENARIOS")
        print("=" * 60)
        error_cases_success = self.test_error_cases()
        
        # Final Results
        print("\n" + "=" * 80)
        print("🎯 FAMILY INVITATION SYSTEM TEST RESULTS")
        print("=" * 80)
        print(f"Total Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed / self.tests_run * 100):.1f}%")
        
        # Phase Results Summary
        phases = [
            ("Authentication Setup", auth_success),
            ("Family Profile Creation & Invitation Sending", family_creation_success and invitation_sending_success),
            ("Invitation Management Endpoints", invitation_management_success),
            ("Invitation Response Workflow", response_workflow_success),
            ("Role-Based Permissions & Validation", permissions_success),
            ("Database Integration & Data Flow", database_success),
            ("Error Cases & Edge Scenarios", error_cases_success)
        ]
        
        print("\n📊 PHASE RESULTS:")
        for phase_name, phase_success in phases:
            status = "✅ PASSED" if phase_success else "❌ FAILED"
            print(f"  {phase_name}: {status}")
        
        overall_success = all(phase_success for _, phase_success in phases)
        
        if overall_success:
            print("\n🎉 ALL FAMILY INVITATION SYSTEM TESTS PASSED!")
            print("The Family Invitation System is production-ready.")
        else:
            print("\n⚠️ SOME TESTS FAILED!")
            print("Please review the failed tests and fix the issues before production deployment.")
        
        return overall_success

if __name__ == "__main__":
    tester = FamilyInvitationSystemTester()
    success = tester.run_comprehensive_family_invitation_tests()
    sys.exit(0 if success else 1)