"""
Unit tests for organization/work endpoints.
Tests organization CRUD, member management, departments, and roles.
"""
import pytest
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any


# ============================================================
# Organization Model Tests
# ============================================================

class TestOrganizationModel:
    """Test WorkOrganization model validation and defaults."""

    def test_organization_has_required_fields(self, test_organization_data):
        """Test that organization has all required fields."""
        required_fields = [
            "id", "name", "organization_type", "owner_id",
            "is_active", "created_at"
        ]

        for field in required_fields:
            assert field in test_organization_data, f"Missing required field: {field}"

    def test_organization_type_is_valid(self, test_organization_data):
        """Test that organization type is valid."""
        valid_types = [
            "COMPANY", "STARTUP", "NGO", "NON_PROFIT",
            "GOVERNMENT", "EDUCATIONAL", "HEALTHCARE", "OTHER"
        ]
        assert test_organization_data["organization_type"] in valid_types


# ============================================================
# Organization Creation Tests
# ============================================================

class TestOrganizationCreation:
    """Test organization creation functionality."""

    VALID_ORG_TYPES = ["COMPANY", "STARTUP", "NGO", "NON_PROFIT", "EDUCATIONAL"]
    VALID_SIZES = ["1-10", "11-50", "51-200", "201-500", "500+"]

    def create_organization(self, name: str, owner_id: str,
                          org_type: str = "COMPANY", **kwargs) -> dict:
        """Create a new organization."""
        import uuid

        if org_type not in self.VALID_ORG_TYPES:
            raise ValueError(f"Invalid organization type: {org_type}")

        size = kwargs.get("size", "1-10")
        if size and size not in self.VALID_SIZES:
            raise ValueError(f"Invalid organization size: {size}")

        return {
            "id": str(uuid.uuid4()),
            "name": name,
            "organization_type": org_type,
            "description": kwargs.get("description"),
            "size": size,
            "industry": kwargs.get("industry"),
            "website": kwargs.get("website"),
            "email": kwargs.get("email"),
            "phone": kwargs.get("phone"),
            "address": kwargs.get("address"),
            "city": kwargs.get("city"),
            "country": kwargs.get("country"),
            "owner_id": owner_id,
            "member_count": 1,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "is_active": True
        }

    def test_create_company(self, test_user_data):
        """Test creating a company organization."""
        org = self.create_organization(
            "Test Company",
            test_user_data["id"],
            org_type="COMPANY"
        )

        assert org["name"] == "Test Company"
        assert org["organization_type"] == "COMPANY"
        assert org["owner_id"] == test_user_data["id"]

    def test_create_startup(self, test_user_data):
        """Test creating a startup organization."""
        org = self.create_organization(
            "Cool Startup",
            test_user_data["id"],
            org_type="STARTUP",
            description="An innovative startup"
        )

        assert org["organization_type"] == "STARTUP"
        assert org["description"] == "An innovative startup"

    def test_create_ngo(self, test_user_data):
        """Test creating an NGO organization."""
        org = self.create_organization(
            "Charity Org",
            test_user_data["id"],
            org_type="NGO"
        )

        assert org["organization_type"] == "NGO"

    def test_invalid_org_type_raises_error(self, test_user_data):
        """Test that invalid organization type raises error."""
        with pytest.raises(ValueError) as exc_info:
            self.create_organization(
                "Invalid Org",
                test_user_data["id"],
                org_type="INVALID_TYPE"
            )

        assert "Invalid organization type" in str(exc_info.value)

    def test_invalid_size_raises_error(self, test_user_data):
        """Test that invalid size raises error."""
        with pytest.raises(ValueError) as exc_info:
            self.create_organization(
                "Test Org",
                test_user_data["id"],
                size="invalid-size"
            )

        assert "Invalid organization size" in str(exc_info.value)


# ============================================================
# Work Role Tests
# ============================================================

class TestWorkRoles:
    """Test work role validation and hierarchy."""

    VALID_ROLES = [
        "OWNER", "ADMIN", "CEO", "CTO", "CFO", "COO",
        "FOUNDER", "CO_FOUNDER", "PRESIDENT", "VICE_PRESIDENT",
        "DIRECTOR", "MANAGER", "SENIOR_MANAGER", "TEAM_LEAD",
        "EMPLOYEE", "SENIOR_EMPLOYEE", "MEMBER",
        "CONTRACTOR", "INTERN", "CONSULTANT", "CLIENT", "CUSTOM"
    ]

    EXECUTIVE_ROLES = ["OWNER", "CEO", "CTO", "CFO", "COO", "FOUNDER", "CO_FOUNDER"]
    MANAGEMENT_ROLES = ["PRESIDENT", "VICE_PRESIDENT", "DIRECTOR", "MANAGER", "SENIOR_MANAGER", "TEAM_LEAD"]
    STAFF_ROLES = ["EMPLOYEE", "SENIOR_EMPLOYEE", "MEMBER", "CONTRACTOR", "INTERN", "CONSULTANT"]

    def is_valid_role(self, role: str) -> bool:
        """Check if role is valid."""
        return role in self.VALID_ROLES

    def can_manage_members(self, role: str) -> bool:
        """Check if role can manage other members."""
        management_capable = self.EXECUTIVE_ROLES + self.MANAGEMENT_ROLES + ["ADMIN"]
        return role in management_capable

    def can_edit_org(self, role: str) -> bool:
        """Check if role can edit organization settings."""
        return role in ["OWNER", "ADMIN", "CEO", "FOUNDER"]

    @pytest.mark.parametrize("role", [
        "OWNER", "CEO", "EMPLOYEE", "INTERN", "CONSULTANT"
    ])
    def test_valid_roles(self, role):
        """Test that standard roles are valid."""
        assert self.is_valid_role(role) is True

    def test_invalid_role(self):
        """Test that invalid role is rejected."""
        assert self.is_valid_role("INVALID_ROLE") is False

    @pytest.mark.parametrize("role,can_manage", [
        ("OWNER", True),
        ("ADMIN", True),
        ("CEO", True),
        ("MANAGER", True),
        ("EMPLOYEE", False),
        ("INTERN", False),
        ("CLIENT", False),
    ])
    def test_can_manage_members(self, role, can_manage):
        """Test member management permissions."""
        assert self.can_manage_members(role) == can_manage

    @pytest.mark.parametrize("role,can_edit", [
        ("OWNER", True),
        ("ADMIN", True),
        ("CEO", True),
        ("MANAGER", False),
        ("EMPLOYEE", False),
    ])
    def test_can_edit_org(self, role, can_edit):
        """Test organization edit permissions."""
        assert self.can_edit_org(role) == can_edit


# ============================================================
# Organization Member Tests
# ============================================================

class TestOrganizationMembers:
    """Test organization member management."""

    def add_member(self, org_id: str, user_id: str, role: str = "EMPLOYEE",
                  department_id: str = None, team_id: str = None) -> dict:
        """Add a member to an organization."""
        import uuid

        return {
            "id": str(uuid.uuid4()),
            "organization_id": org_id,
            "user_id": user_id,
            "work_role": role,
            "department_id": department_id,
            "team_id": team_id,
            "job_title": None,
            "start_date": datetime.now(timezone.utc),
            "is_active": True,
            "joined_at": datetime.now(timezone.utc)
        }

    def test_add_member(self, test_organization_data, test_user_data):
        """Test adding a member to organization."""
        member = self.add_member(
            test_organization_data["id"],
            test_user_data["id"],
            role="EMPLOYEE"
        )

        assert member["organization_id"] == test_organization_data["id"]
        assert member["user_id"] == test_user_data["id"]
        assert member["work_role"] == "EMPLOYEE"
        assert member["is_active"] is True

    def test_add_member_with_department(self, test_organization_data, test_user_data):
        """Test adding a member with department assignment."""
        member = self.add_member(
            test_organization_data["id"],
            test_user_data["id"],
            department_id="dept-123"
        )

        assert member["department_id"] == "dept-123"

    def test_add_member_with_team(self, test_organization_data, test_user_data):
        """Test adding a member with team assignment."""
        member = self.add_member(
            test_organization_data["id"],
            test_user_data["id"],
            team_id="team-456"
        )

        assert member["team_id"] == "team-456"


# ============================================================
# Department Tests
# ============================================================

class TestDepartments:
    """Test department management functionality."""

    def create_department(self, org_id: str, name: str,
                         parent_id: str = None, manager_id: str = None) -> dict:
        """Create a department within an organization."""
        import uuid

        return {
            "id": str(uuid.uuid4()),
            "organization_id": org_id,
            "name": name,
            "description": None,
            "parent_department_id": parent_id,
            "manager_id": manager_id,
            "member_count": 0,
            "created_at": datetime.now(timezone.utc),
            "is_active": True
        }

    def test_create_department(self, test_organization_data):
        """Test creating a department."""
        dept = self.create_department(
            test_organization_data["id"],
            "Engineering"
        )

        assert dept["name"] == "Engineering"
        assert dept["organization_id"] == test_organization_data["id"]
        assert dept["is_active"] is True

    def test_create_subdepartment(self, test_organization_data):
        """Test creating a subdepartment."""
        parent_dept = self.create_department(
            test_organization_data["id"],
            "Engineering"
        )

        sub_dept = self.create_department(
            test_organization_data["id"],
            "Backend Team",
            parent_id=parent_dept["id"]
        )

        assert sub_dept["parent_department_id"] == parent_dept["id"]

    def test_department_with_manager(self, test_organization_data, test_user_data):
        """Test creating a department with a manager."""
        dept = self.create_department(
            test_organization_data["id"],
            "HR",
            manager_id=test_user_data["id"]
        )

        assert dept["manager_id"] == test_user_data["id"]


# ============================================================
# Organization Invitation Tests
# ============================================================

class TestOrganizationInvitations:
    """Test organization invitation functionality."""

    def create_invitation(self, org_id: str, inviter_id: str,
                         invitee_email: str, role: str = "EMPLOYEE") -> dict:
        """Create an organization invitation."""
        import uuid

        return {
            "id": str(uuid.uuid4()),
            "organization_id": org_id,
            "invited_by_user_id": inviter_id,
            "invited_user_email": invitee_email,
            "invited_user_id": None,
            "role": role,
            "status": "PENDING",
            "sent_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            "is_active": True
        }

    def test_create_employee_invitation(self, test_organization_data, test_user_data):
        """Test creating an employee invitation."""
        invitation = self.create_invitation(
            test_organization_data["id"],
            test_user_data["id"],
            "newemployee@test.com"
        )

        assert invitation["invited_user_email"] == "newemployee@test.com"
        assert invitation["role"] == "EMPLOYEE"
        assert invitation["status"] == "PENDING"

    def test_invitation_has_expiration(self, test_organization_data, test_user_data):
        """Test that invitation has expiration date."""
        invitation = self.create_invitation(
            test_organization_data["id"],
            test_user_data["id"],
            "test@test.com"
        )

        assert invitation["expires_at"] > invitation["sent_at"]


# ============================================================
# Organization Search Tests
# ============================================================

class TestOrganizationSearch:
    """Test organization search functionality."""

    def search_organizations(self, organizations: List[dict], query: str,
                           filters: dict = None) -> List[dict]:
        """Search organizations by name or type."""
        query_lower = query.lower()
        results = []

        for org in organizations:
            if not org.get("is_active", True):
                continue

            # Search in name and description
            name = org.get("name", "").lower()
            description = (org.get("description") or "").lower()

            if query_lower in name or query_lower in description:
                # Apply filters
                if filters:
                    if filters.get("type") and org.get("organization_type") != filters["type"]:
                        continue
                    if filters.get("city") and org.get("city") != filters["city"]:
                        continue

                results.append(org)

        return results

    def test_search_by_name(self):
        """Test searching organizations by name."""
        orgs = [
            {"id": "1", "name": "Tech Company", "is_active": True},
            {"id": "2", "name": "Finance Corp", "is_active": True},
            {"id": "3", "name": "Tech Startup", "is_active": True},
        ]

        results = self.search_organizations(orgs, "tech")
        assert len(results) == 2

    def test_search_by_description(self):
        """Test searching organizations by description."""
        orgs = [
            {"id": "1", "name": "Company A", "description": "We build software", "is_active": True},
            {"id": "2", "name": "Company B", "description": "We sell hardware", "is_active": True},
        ]

        results = self.search_organizations(orgs, "software")
        assert len(results) == 1
        assert results[0]["id"] == "1"

    def test_search_excludes_inactive(self):
        """Test that search excludes inactive organizations."""
        orgs = [
            {"id": "1", "name": "Active Company", "is_active": True},
            {"id": "2", "name": "Inactive Company", "is_active": False},
        ]

        results = self.search_organizations(orgs, "company")
        assert len(results) == 1
        assert results[0]["id"] == "1"

    def test_search_with_type_filter(self):
        """Test searching with organization type filter."""
        orgs = [
            {"id": "1", "name": "Tech Startup", "organization_type": "STARTUP", "is_active": True},
            {"id": "2", "name": "Tech Company", "organization_type": "COMPANY", "is_active": True},
        ]

        results = self.search_organizations(orgs, "tech", filters={"type": "STARTUP"})
        assert len(results) == 1
        assert results[0]["organization_type"] == "STARTUP"


# ============================================================
# Organization Statistics Tests
# ============================================================

class TestOrganizationStatistics:
    """Test organization statistics calculations."""

    def calculate_org_stats(self, members: List[dict], departments: List[dict]) -> dict:
        """Calculate organization statistics."""
        active_members = [m for m in members if m.get("is_active", True)]
        active_departments = [d for d in departments if d.get("is_active", True)]

        stats = {
            "total_members": len(active_members),
            "total_departments": len(active_departments),
            "roles_breakdown": {},
            "department_sizes": {}
        }

        # Count roles
        for member in active_members:
            role = member.get("work_role", "EMPLOYEE")
            stats["roles_breakdown"][role] = stats["roles_breakdown"].get(role, 0) + 1

        # Count department sizes
        for member in active_members:
            dept_id = member.get("department_id")
            if dept_id:
                stats["department_sizes"][dept_id] = stats["department_sizes"].get(dept_id, 0) + 1

        return stats

    def test_calculate_member_count(self):
        """Test calculating total member count."""
        members = [
            {"id": "1", "is_active": True, "work_role": "EMPLOYEE"},
            {"id": "2", "is_active": True, "work_role": "MANAGER"},
            {"id": "3", "is_active": False, "work_role": "EMPLOYEE"},
        ]

        stats = self.calculate_org_stats(members, [])
        assert stats["total_members"] == 2

    def test_roles_breakdown(self):
        """Test calculating roles breakdown."""
        members = [
            {"id": "1", "is_active": True, "work_role": "EMPLOYEE"},
            {"id": "2", "is_active": True, "work_role": "EMPLOYEE"},
            {"id": "3", "is_active": True, "work_role": "MANAGER"},
        ]

        stats = self.calculate_org_stats(members, [])
        assert stats["roles_breakdown"]["EMPLOYEE"] == 2
        assert stats["roles_breakdown"]["MANAGER"] == 1

    def test_department_sizes(self):
        """Test calculating department sizes."""
        members = [
            {"id": "1", "is_active": True, "department_id": "dept-1"},
            {"id": "2", "is_active": True, "department_id": "dept-1"},
            {"id": "3", "is_active": True, "department_id": "dept-2"},
        ]

        stats = self.calculate_org_stats(members, [])
        assert stats["department_sizes"]["dept-1"] == 2
        assert stats["department_sizes"]["dept-2"] == 1


# ============================================================
# Organization Announcement Tests
# ============================================================

class TestOrganizationAnnouncements:
    """Test organization announcement functionality."""

    def create_announcement(self, org_id: str, author_id: str, title: str,
                          content: str, target_audience: str = "ALL") -> dict:
        """Create an organization announcement."""
        import uuid

        return {
            "id": str(uuid.uuid4()),
            "organization_id": org_id,
            "author_id": author_id,
            "title": title,
            "content": content,
            "target_audience": target_audience,  # "ALL", "DEPARTMENT", "TEAM"
            "department_id": None,
            "is_pinned": False,
            "created_at": datetime.now(timezone.utc),
            "is_active": True
        }

    def test_create_announcement(self, test_organization_data, test_user_data):
        """Test creating an organization announcement."""
        announcement = self.create_announcement(
            test_organization_data["id"],
            test_user_data["id"],
            "Important Update",
            "Please read this important message."
        )

        assert announcement["title"] == "Important Update"
        assert announcement["target_audience"] == "ALL"
        assert announcement["is_pinned"] is False

    def test_announcement_for_department(self, test_organization_data, test_user_data):
        """Test creating an announcement for specific department."""
        announcement = self.create_announcement(
            test_organization_data["id"],
            test_user_data["id"],
            "Department Meeting",
            "Please attend the meeting.",
            target_audience="DEPARTMENT"
        )

        assert announcement["target_audience"] == "DEPARTMENT"
