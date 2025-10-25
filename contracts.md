# Work Module API Integration Contracts

## Overview
This document defines the integration contracts between the Work Module frontend and backend API. The backend API endpoints are already implemented and documented in `/app/WORK_MODULE_API.md`.

---

## 1. API Endpoints to Integrate

### 1.1 Search Organizations
**Endpoint:** `POST /api/work/organizations/search`

**Frontend Usage:** `WorkSetupPage.js` - Search view

**Request:**
```json
{
  "query": "string",
  "organization_type": "COMPANY" // optional
}
```

**Response:**
```json
{
  "organizations": [
    {
      "id": "uuid",
      "name": "string",
      "organization_type": "COMPANY",
      "industry": "string",
      "member_count": 0,
      "logo_url": "string",
      "is_member": false
    }
  ],
  "count": 0
}
```

---

### 1.2 Create Organization
**Endpoint:** `POST /api/work/organizations`

**Frontend Usage:** `WorkSetupPage.js` - Create view (Step 3 completion)

**Request:** Full organization data from form
```json
{
  "name": "string",
  "organization_type": "COMPANY",
  "description": "string",
  "industry": "string",
  "organization_size": "11-50",
  "founded_year": 2024,
  "website": "string",
  "official_email": "string",
  "address_street": "string",
  "address_city": "string",
  "address_state": "string",
  "address_country": "string",
  "address_postal_code": "string",
  "is_private": false,
  "allow_public_discovery": true,
  "creator_role": "CEO",
  "custom_role_name": null,
  "creator_department": "string",
  "creator_team": "string",
  "creator_job_title": "string"
}
```

**Response:** Full organization object with user membership details

---

### 1.3 Get User's Organizations
**Endpoint:** `GET /api/work/organizations`

**Frontend Usage:** `WorkOrganizationList.js` - Load user's organizations

**Request:** None (uses JWT token)

**Response:**
```json
{
  "organizations": [
    {
      "id": "uuid",
      "name": "string",
      "organization_type": "COMPANY",
      "industry": "string",
      "member_count": 0,
      "logo_url": "string",
      "banner_url": "string",
      "address_city": "string",
      "address_country": "string",
      "user_role": "CEO",
      "user_department": "string",
      "user_team": "string",
      "user_job_title": "string",
      "user_is_admin": true,
      "user_can_invite": true,
      "user_can_post": true
    }
  ],
  "count": 0
}
```

---

### 1.4 Get Organization Details
**Endpoint:** `GET /api/work/organizations/{organization_id}`

**Frontend Usage:** `WorkOrganizationProfile.js` - Load organization profile

**Request:** None (organization_id in URL)

**Response:** Full organization object with user membership details

---

### 1.5 Get Organization Members
**Endpoint:** `GET /api/work/organizations/{organization_id}/members`

**Frontend Usage:** `WorkOrganizationProfile.js` - Members tab

**Request:** None

**Response:**
```json
{
  "members": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "role": "CEO",
      "department": "string",
      "team": "string",
      "job_title": "string",
      "user_first_name": "string",
      "user_last_name": "string",
      "user_email": "string",
      "user_avatar_url": "string",
      "is_admin": true,
      "can_invite": true,
      "can_post": true
    }
  ],
  "count": 0,
  "departments": {
    "Executive": [...],
    "Engineering": [...]
  }
}
```

---

### 1.6 Add Member to Organization
**Endpoint:** `POST /api/work/organizations/{organization_id}/members`

**Frontend Usage:** Future - Invite modal (not yet implemented in Phase A)

**Request:**
```json
{
  "user_email": "string",
  "role": "EMPLOYEE",
  "department": "string",
  "team": "string",
  "job_title": "string",
  "can_invite": false,
  "is_admin": false
}
```

**Response:**
```json
{
  "message": "Member added successfully",
  "member_id": "uuid"
}
```

---

## 2. Mock Data to Replace

### In `mock-work.js`:

**To be removed/replaced:**
- `mockOrganizations` → API call to `/api/work/organizations`
- `mockMembers` → API call to `/api/work/organizations/{id}/members`
- `mockWorkPosts` → Will be handled by UniversalWall component
- Helper functions like `getUserOrganizations()`, `getOrganizationMembers()`, etc.

### Components to Update:

#### 2.1 **WorkOrganizationList.js**
**Current:** Uses `getUserOrganizations(currentUserId)` from mock-work.js

**Update to:**
```javascript
const [organizations, setOrganizations] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  const loadOrganizations = async () => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/work/organizations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setOrganizations(data.organizations || []);
    } catch (error) {
      console.error('Error loading organizations:', error);
    } finally {
      setLoading(false);
    }
  };
  loadOrganizations();
}, []);
```

#### 2.2 **WorkOrganizationProfile.js**
**Current:** Uses `mockOrganizations.find()` and `getOrganizationMembers()`

**Update to:**
```javascript
// Load organization details
const response = await fetch(`${BACKEND_URL}/api/work/organizations/${organizationId}`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const orgData = await response.json();

// Load members
const membersResponse = await fetch(`${BACKEND_URL}/api/work/organizations/${organizationId}/members`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const membersData = await membersResponse.json();
setMembers(membersData.members || []);
setMembersByDept(membersData.departments || {});
```

#### 2.3 **WorkSetupPage.js**
**Current (Search):** Uses `searchOrganizations()` from mock-work.js

**Update to:**
```javascript
const handleSearch = async () => {
  try {
    const token = localStorage.getItem('zion_token');
    const response = await fetch(`${BACKEND_URL}/api/work/organizations/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: searchQuery,
        organization_type: selectedOrgType || null
      })
    });
    const data = await response.json();
    setSearchResults(data.organizations || []);
  } catch (error) {
    console.error('Search error:', error);
  }
};
```

**Current (Create):** Mock alert on form submission

**Update to:**
```javascript
const handleCreateOrganization = async () => {
  try {
    const token = localStorage.getItem('zion_token');
    const response = await fetch(`${BACKEND_URL}/api/work/organizations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });
    
    if (response.ok) {
      const data = await response.json();
      alert('Организация успешно создана!');
      onComplete && onComplete();
    } else {
      const error = await response.json();
      alert(`Ошибка: ${error.detail || 'Не удалось создать организацию'}`);
    }
  } catch (error) {
    console.error('Create organization error:', error);
    alert('Ошибка при создании организации');
  }
};
```

---

## 3. Backend API Status

✅ **Already Implemented** (per WORK_MODULE_API.md):
- POST /api/work/organizations/search
- POST /api/work/organizations (create)
- GET /api/work/organizations (user's orgs)
- GET /api/work/organizations/{id}
- GET /api/work/organizations/{id}/members
- POST /api/work/organizations/{id}/members (invite)
- PUT /api/work/organizations/{id} (update)

**Backend is ready for integration!**

---

## 4. Environment Variables

**Frontend must use:**
```javascript
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
```

**Never hardcode URLs!**

---

## 5. Authentication

All API calls require JWT token:
```javascript
const token = localStorage.getItem('zion_token');

headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

---

## 6. Error Handling

**Standard error responses:**
- 401: Unauthorized (redirect to login)
- 403: Forbidden (insufficient permissions)
- 404: Not found
- 500: Server error

**Frontend should handle:**
```javascript
try {
  const response = await fetch(...);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Request failed');
  }
  const data = await response.json();
  // Handle success
} catch (error) {
  console.error('API Error:', error);
  // Show user-friendly error message
}
```

---

## 7. Integration Steps

### Step 1: Update WorkOrganizationList.js
- Remove mock data imports
- Add API call to fetch user's organizations
- Add loading states
- Add error handling

### Step 2: Update WorkOrganizationProfile.js
- Replace mock data with API calls
- Load organization details
- Load organization members
- Update members tab to use real data

### Step 3: Update WorkSetupPage.js
- Implement real search functionality
- Implement organization creation with API
- Add form validation
- Handle success/error states

### Step 4: Remove mock-work.js (after testing)
- Once all components use real API
- Keep file for reference during development
- Remove imports from all components

### Step 5: Testing
- Test organization creation flow
- Test search functionality
- Test organization profile loading
- Test member list display
- Verify all permissions work correctly

---

## 8. Testing Credentials

**Test User:**
- Email: `test@zion.city`
- Password: `Test123456`

**Or create new user via:**
```bash
curl -X POST http://localhost:8001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123","first_name":"First","last_name":"Last"}'
```

---

## 9. Next Features (Future)

**Not in Phase B, but documented for future:**
- Organization posts in wall feed
- Invite members modal (frontend)
- Organization settings page functionality
- Update organization details
- Remove members
- Role management
- Organization chat groups

---

## Summary

**Phase B Goal:** Replace all mock data with real API calls while maintaining the beautiful UI from Phase A.

**Priority Order:**
1. WorkOrganizationList (show real user orgs)
2. WorkOrganizationProfile (show real org details)
3. WorkSetupPage - Create (create real organizations)
4. WorkSetupPage - Search (search real organizations)
5. Testing and refinement

**Backend is ready. Let's connect the dots!**