# API Contracts: Departments & Announcements System

## Overview
This document defines the API contracts for the Departments and Announcements features in the Organizations module.

---

## 1. DEPARTMENTS API

### 1.1 Create Department
**Endpoint:** `POST /api/organizations/{org_id}/departments`

**Authentication:** Required (JWT)

**Authorization:** User must be OWNER or ADMIN of the organization

**Request Body:**
```json
{
  "name": "Engineering",
  "description": "Software development and technical infrastructure",
  "color": "#1D4ED8",
  "head_id": "user-uuid-here" // Optional
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "dept-uuid",
    "organization_id": "org-uuid",
    "name": "Engineering",
    "description": "Software development and technical infrastructure",
    "color": "#1D4ED8",
    "head_id": "user-uuid-here",
    "member_count": 0,
    "created_at": "2024-03-20T10:00:00Z",
    "updated_at": "2024-03-20T10:00:00Z"
  }
}
```

**Error Responses:**
- 401: Unauthorized (no valid token)
- 403: Forbidden (not OWNER/ADMIN)
- 404: Organization not found
- 400: Validation error (missing name, invalid color format, etc.)

---

### 1.2 List Departments
**Endpoint:** `GET /api/organizations/{org_id}/departments`

**Authentication:** Required (JWT)

**Authorization:** User must be a member of the organization

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "dept-uuid-1",
      "organization_id": "org-uuid",
      "name": "Engineering",
      "description": "Software development",
      "color": "#1D4ED8",
      "head_id": "user-uuid",
      "head_name": "John Doe",
      "member_count": 12,
      "created_at": "2024-03-20T10:00:00Z",
      "updated_at": "2024-03-20T10:00:00Z"
    }
  ]
}
```

---

### 1.3 Update Department
**Endpoint:** `PUT /api/organizations/{org_id}/departments/{dept_id}`

**Authentication:** Required (JWT)

**Authorization:** OWNER, ADMIN, or DEPARTMENT_HEAD

**Request Body:**
```json
{
  "name": "Engineering & Tech",
  "description": "Updated description",
  "color": "#2563EB",
  "head_id": "new-user-uuid"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "dept-uuid",
    "organization_id": "org-uuid",
    "name": "Engineering & Tech",
    "description": "Updated description",
    "color": "#2563EB",
    "head_id": "new-user-uuid",
    "member_count": 12,
    "created_at": "2024-03-20T10:00:00Z",
    "updated_at": "2024-03-21T14:30:00Z"
  }
}
```

---

### 1.4 Delete Department
**Endpoint:** `DELETE /api/organizations/{org_id}/departments/{dept_id}`

**Authentication:** Required (JWT)

**Authorization:** OWNER or ADMIN only

**Response (200):**
```json
{
  "success": true,
  "message": "Department deleted successfully"
}
```

**Note:** This will also remove all department member assignments.

---

### 1.5 Add Member to Department
**Endpoint:** `POST /api/organizations/{org_id}/departments/{dept_id}/members`

**Authentication:** Required (JWT)

**Authorization:** OWNER, ADMIN, or DEPARTMENT_HEAD

**Request Body:**
```json
{
  "user_id": "user-uuid",
  "role": "MEMBER" // DEPARTMENT_HEAD, LEAD, MEMBER, CLIENT
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "member-assignment-uuid",
    "department_id": "dept-uuid",
    "user_id": "user-uuid",
    "user_name": "Jane Smith",
    "role": "MEMBER",
    "joined_at": "2024-03-20T10:00:00Z"
  }
}
```

---

### 1.6 List Department Members
**Endpoint:** `GET /api/organizations/{org_id}/departments/{dept_id}/members`

**Authentication:** Required (JWT)

**Authorization:** Organization member

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "member-assignment-uuid",
      "department_id": "dept-uuid",
      "user_id": "user-uuid",
      "user_name": "Jane Smith",
      "user_email": "jane@example.com",
      "user_avatar": "https://...",
      "role": "MEMBER",
      "joined_at": "2024-03-20T10:00:00Z"
    }
  ]
}
```

---

### 1.7 Remove Member from Department
**Endpoint:** `DELETE /api/organizations/{org_id}/departments/{dept_id}/members/{user_id}`

**Authentication:** Required (JWT)

**Authorization:** OWNER, ADMIN, or DEPARTMENT_HEAD

**Response (200):**
```json
{
  "success": true,
  "message": "Member removed from department"
}
```

---

## 2. ANNOUNCEMENTS API

### 2.1 Create Announcement
**Endpoint:** `POST /api/organizations/{org_id}/announcements`

**Authentication:** Required (JWT)

**Authorization:** OWNER, ADMIN, or DEPARTMENT_HEAD

**Request Body:**
```json
{
  "title": "Q1 All Hands Meeting",
  "content": "Join us this Friday at 3 PM for quarterly review...",
  "priority": "URGENT", // NORMAL, IMPORTANT, URGENT
  "target_type": "ALL", // ALL or DEPARTMENTS
  "target_departments": [], // Array of dept IDs if target_type is DEPARTMENTS
  "department_id": null, // Optional: which department is making this announcement
  "is_pinned": true
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "announcement-uuid",
    "organization_id": "org-uuid",
    "department_id": null,
    "title": "Q1 All Hands Meeting",
    "content": "Join us this Friday at 3 PM for quarterly review...",
    "priority": "URGENT",
    "author_id": "user-uuid",
    "author_name": "John Doe",
    "target_type": "ALL",
    "target_departments": [],
    "is_pinned": true,
    "views": 0,
    "reactions": {},
    "created_at": "2024-03-20T09:00:00Z",
    "updated_at": "2024-03-20T09:00:00Z"
  }
}
```

---

### 2.2 List Announcements
**Endpoint:** `GET /api/organizations/{org_id}/announcements`

**Authentication:** Required (JWT)

**Authorization:** Organization member

**Query Parameters:**
- `department_id` (optional): Filter by department
- `priority` (optional): Filter by priority (NORMAL, IMPORTANT, URGENT)
- `pinned` (optional): Filter pinned (true/false)
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "announcement-uuid",
      "organization_id": "org-uuid",
      "department_id": "dept-uuid",
      "department_name": "Engineering",
      "department_color": "#1D4ED8",
      "title": "New Code Review Guidelines",
      "content": "We have updated our code review process...",
      "priority": "IMPORTANT",
      "author_id": "user-uuid",
      "author_name": "John Doe",
      "author_avatar": "https://...",
      "target_type": "DEPARTMENTS",
      "target_departments": ["dept-uuid"],
      "is_pinned": false,
      "views": 45,
      "reactions": {
        "thumbsup": 12,
        "heart": 5,
        "clap": 8
      },
      "created_at": "2024-03-20T09:00:00Z",
      "updated_at": "2024-03-20T09:00:00Z"
    }
  ],
  "total": 25,
  "limit": 50,
  "offset": 0
}
```

**Note:** Announcements are sorted by:
1. Pinned first
2. Then by created_at DESC

---

### 2.3 Update Announcement
**Endpoint:** `PUT /api/organizations/{org_id}/announcements/{announcement_id}`

**Authentication:** Required (JWT)

**Authorization:** Author, OWNER, or ADMIN

**Request Body:**
```json
{
  "title": "Updated Title",
  "content": "Updated content...",
  "priority": "IMPORTANT",
  "target_type": "DEPARTMENTS",
  "target_departments": ["dept-uuid-1", "dept-uuid-2"],
  "is_pinned": false
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    // Updated announcement object
  }
}
```

---

### 2.4 Delete Announcement
**Endpoint:** `DELETE /api/organizations/{org_id}/announcements/{announcement_id}`

**Authentication:** Required (JWT)

**Authorization:** Author, OWNER, or ADMIN

**Response (200):**
```json
{
  "success": true,
  "message": "Announcement deleted successfully"
}
```

---

### 2.5 Pin/Unpin Announcement
**Endpoint:** `PATCH /api/organizations/{org_id}/announcements/{announcement_id}/pin`

**Authentication:** Required (JWT)

**Authorization:** OWNER or ADMIN

**Request Body:**
```json
{
  "is_pinned": true
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "announcement-uuid",
    "is_pinned": true
  }
}
```

---

### 2.6 Track Announcement View
**Endpoint:** `POST /api/organizations/{org_id}/announcements/{announcement_id}/view`

**Authentication:** Required (JWT)

**Authorization:** Organization member

**Response (200):**
```json
{
  "success": true,
  "data": {
    "views": 46
  }
}
```

**Note:** This increments the view count. Can be called once per user per announcement.

---

### 2.7 React to Announcement
**Endpoint:** `POST /api/organizations/{org_id}/announcements/{announcement_id}/react`

**Authentication:** Required (JWT)

**Authorization:** Organization member

**Request Body:**
```json
{
  "reaction_type": "thumbsup" // thumbsup, heart, clap, fire
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "reactions": {
      "thumbsup": 13,
      "heart": 5,
      "clap": 8,
      "fire": 3
    }
  }
}
```

**Note:** User can only react once per type. Calling again with same type removes the reaction (toggle).

---

## 3. DATABASE MODELS

### 3.1 Department Model
```python
class Department(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    organization_id: str
    name: str
    description: Optional[str] = None
    color: str  # Hex color code
    head_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
```

**Collection:** `departments`

**Indexes:**
- `organization_id` (for querying all departments in an org)
- `id` (primary key)

---

### 3.2 Department Member Model
```python
class DepartmentRole(str, Enum):
    DEPARTMENT_HEAD = "DEPARTMENT_HEAD"
    LEAD = "LEAD"
    MEMBER = "MEMBER"
    CLIENT = "CLIENT"

class DepartmentMember(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    department_id: str
    user_id: str
    role: DepartmentRole
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
```

**Collection:** `department_members`

**Indexes:**
- `department_id` (for querying all members in a department)
- `user_id` (for querying all departments a user is in)
- Compound: `(department_id, user_id)` (unique constraint)

---

### 3.3 Announcement Model
```python
class AnnouncementPriority(str, Enum):
    NORMAL = "NORMAL"
    IMPORTANT = "IMPORTANT"
    URGENT = "URGENT"

class AnnouncementTargetType(str, Enum):
    ALL = "ALL"
    DEPARTMENTS = "DEPARTMENTS"

class Announcement(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    organization_id: str
    department_id: Optional[str] = None  # Which department created this
    title: str
    content: str
    priority: AnnouncementPriority
    author_id: str
    target_type: AnnouncementTargetType
    target_departments: List[str] = []  # Empty if target_type is ALL
    is_pinned: bool = False
    views: int = 0
    reactions: Dict[str, int] = {}  # {"thumbsup": 5, "heart": 3}
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
```

**Collection:** `announcements`

**Indexes:**
- `organization_id` (for querying all announcements in an org)
- `department_id` (for filtering by department)
- `is_pinned` (for filtering pinned announcements)
- `created_at` (for sorting)

---

### 3.4 Announcement Reaction Model
```python
class AnnouncementReaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    announcement_id: str
    user_id: str
    reaction_type: str  # thumbsup, heart, clap, fire
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
```

**Collection:** `announcement_reactions`

**Indexes:**
- `announcement_id` (for counting reactions per announcement)
- Compound: `(announcement_id, user_id, reaction_type)` (unique constraint)

---

## 4. FRONTEND INTEGRATION POINTS

### 4.1 Components to Update

**Replace Mock Data Imports:**
- `WorkDepartmentNavigator.js` → Call `GET /api/organizations/{org_id}/departments`
- `WorkAnnouncementsWidget.js` → Call `GET /api/organizations/{org_id}/announcements?limit=5`
- `WorkDepartmentManager.js` → Call department CRUD endpoints
- `WorkAnnouncementComposer.js` → Call `POST` or `PUT` announcement endpoints
- `WorkAnnouncementCard.js` → Call reaction and pin endpoints
- `WorkAnnouncementsList.js` → Call `GET` announcements with filters

### 4.2 API Call Pattern
```javascript
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const token = localStorage.getItem('zion_token');

const response = await fetch(`${BACKEND_URL}/api/organizations/${orgId}/departments`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

if (response.ok) {
  const data = await response.json();
  // Use data.data
}
```

---

## 5. AUTHORIZATION RULES SUMMARY

**Departments:**
- Create/Delete: OWNER or ADMIN
- Update: OWNER, ADMIN, or DEPARTMENT_HEAD
- Add/Remove Members: OWNER, ADMIN, or DEPARTMENT_HEAD
- View: Any organization member

**Announcements:**
- Create: OWNER, ADMIN, or DEPARTMENT_HEAD
- Update/Delete: Author, OWNER, or ADMIN
- Pin/Unpin: OWNER or ADMIN
- View/React: Any organization member

---

## 6. ERROR HANDLING

All endpoints return consistent error format:
```json
{
  "detail": "Error message here"
}
```

Common HTTP Status Codes:
- 200: Success
- 201: Created
- 400: Bad Request (validation error)
- 401: Unauthorized (no token or invalid token)
- 403: Forbidden (insufficient permissions)
- 404: Not Found
- 500: Internal Server Error
