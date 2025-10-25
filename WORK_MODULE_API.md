# WORK Module API Documentation

## Overview
The WORK module enables users to create and manage work organization profiles, similar to the FAMILY module but designed for professional/organizational contexts.

## Database Collections

### work_organizations
Stores organization/company profiles
- `id` (organization_id): Unique identifier
- `name`: Organization name
- `organization_type`: COMPANY, STARTUP, NGO, etc.
- `description`, `industry`, `organization_size`, `founded_year`
- `website`, `official_email`
- Address fields
- `logo_url`, `banner_url`
- Privacy settings
- `member_count`, `creator_id`
- Timestamps

### work_members
Stores organization memberships
- `id` (member_id): Unique identifier
- `organization_id`, `user_id`
- `role`: CEO, Manager, Employee, CUSTOM, etc.
- `custom_role_name`: If role is CUSTOM
- `department`, `team`, `job_title`
- `start_date`, `end_date`, `is_current`
- Permissions: `can_post`, `can_invite`, `is_admin`
- `status`, timestamps

### work_posts
Posts created by organizations (reuses Post model with source_module: 'work')

---

## API Endpoints

### 1. Search Organizations
**POST** `/api/work/organizations/search`

Search for existing work organizations by name.

**Request Body:**
```json
{
  "query": "ZION.CITY",
  "organization_type": "COMPANY"  // optional
}
```

**Response:**
```json
{
  "organizations": [
    {
      "id": "uuid",
      "name": "ZION.CITY",
      "organization_type": "COMPANY",
      "industry": "Technology",
      "member_count": 5,
      "logo_url": "...",
      "is_member": false
    }
  ],
  "count": 1
}
```

---

### 2. Create Organization
**POST** `/api/work/organizations`

Create a new work organization. Creator becomes first member with admin privileges.

**Request Body:**
```json
{
  "name": "ZION.CITY",
  "organization_type": "COMPANY",
  "description": "A digital ecosystem platform",
  "industry": "Technology",
  "organization_size": "11-50",
  "founded_year": 2024,
  "website": "https://zion.city",
  "official_email": "info@zion.city",
  "address_street": "123 Main St",
  "address_city": "City",
  "address_state": "State",
  "address_country": "Country",
  "address_postal_code": "12345",
  "is_private": false,
  "allow_public_discovery": true,
  "creator_role": "CEO",
  "custom_role_name": null,
  "creator_department": "Executive",
  "creator_team": null,
  "creator_job_title": "Chief Executive Officer"
}
```

**Response:** `WorkOrganizationResponse` with user membership details

---

### 3. Get User's Organizations
**GET** `/api/work/organizations`

Get all organizations where current user is a member.

**Response:**
```json
{
  "organizations": [
    {
      "id": "uuid",
      "name": "ZION.CITY",
      "organization_type": "COMPANY",
      ...organization fields...,
      "user_role": "CEO",
      "user_custom_role_name": null,
      "user_department": "Executive",
      "user_team": null,
      "user_is_admin": true
    }
  ],
  "count": 1
}
```

---

### 4. Get Organization Details
**GET** `/api/work/organizations/{organization_id}`

Get specific organization details. Includes user's membership details if member.

**Response:** `WorkOrganizationResponse`

---

### 5. Add Member to Organization
**POST** `/api/work/organizations/{organization_id}/members`

Add a new member to the organization. Requires `can_invite` permission.

**Request Body:**
```json
{
  "user_email": "john@example.com",
  "role": "EMPLOYEE",
  "custom_role_name": null,
  "department": "Engineering",
  "team": "Backend Team",
  "job_title": "Senior Software Engineer",
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

### 6. Get Organization Members
**GET** `/api/work/organizations/{organization_id}/members`

Get all members of an organization, grouped by department.

**Response:**
```json
{
  "members": [
    {
      "id": "uuid",
      "organization_id": "uuid",
      "user_id": "uuid",
      "role": "CEO",
      "department": "Executive",
      "team": null,
      "job_title": "Chief Executive Officer",
      "user_first_name": "John",
      "user_last_name": "Doe",
      "user_email": "john@example.com",
      "user_avatar_url": "...",
      ...other fields...
    }
  ],
  "count": 5,
  "departments": {
    "Executive": [...],
    "Engineering": [...],
    "No Department": [...]
  }
}
```

---

### 7. Update Organization
**PUT** `/api/work/organizations/{organization_id}`

Update organization details. Admin only.

**Request Body:** Partial update object with any organization fields

**Response:**
```json
{
  "message": "Organization updated successfully"
}
```

---

## Enums

### WorkRole
- CEO, CTO, CFO, COO
- FOUNDER, CO_FOUNDER
- PRESIDENT, VICE_PRESIDENT
- DIRECTOR, MANAGER, SENIOR_MANAGER, TEAM_LEAD
- EMPLOYEE, SENIOR_EMPLOYEE
- CONTRACTOR, INTERN, CONSULTANT
- CUSTOM (requires custom_role_name)

### OrganizationType
- COMPANY, STARTUP
- NGO, NON_PROFIT
- GOVERNMENT
- EDUCATIONAL, HEALTHCARE
- OTHER

### OrganizationSize
- "1-10", "11-50", "51-200", "201-500", "500+"

---

## Permissions

### Role Hierarchy
- **Admin** (`is_admin: true`): Full control, can update organization, add/remove members
- **Can Invite** (`can_invite: true`): Can add new members
- **Regular Member** (`can_post: true`): Can create posts

### Access Control
- Private organizations: Only members can view
- Public organizations: Anyone can view, only members can post

---

## Next Steps (Phase 2-5)

1. **Phase 2**: Organization Creation Flow UI
2. **Phase 3**: MY WORK Section (organization tiles)
3. **Phase 4**: Organization Profile Page
4. **Phase 5**: ORGANIZATIONS Universal Feed

---

## Testing

Test endpoints using credentials:
- Email: `test@zion.city`
- Password: `testpass123`

Example curl request:
```bash
# Login first
TOKEN=$(curl -X POST https://your-domain/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@zion.city","password":"testpass123"}' \
  | jq -r '.access_token')

# Search organizations
curl -X POST https://your-domain/api/work/organizations/search \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"ZION"}'
```
