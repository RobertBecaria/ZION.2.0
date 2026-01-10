import React from 'react';
import { ErrorBoundary } from '../components/auth';
import UniversalWall from '../components/UniversalWall';
import UniversalChatLayout from '../components/UniversalChatLayout';
import WorkOrganizationList from '../components/WorkOrganizationList';
import WorkOrganizationProfile from '../components/WorkOrganizationProfile';
import WorkSearchOrganizations from '../components/WorkSearchOrganizations';
import WorkJoinRequests from '../components/WorkJoinRequests';
import WorkSetupPage from '../components/WorkSetupPage';
import WorkTriggerFlow from '../components/WorkTriggerFlow';
import WorkOrganizationPublicProfile from '../components/WorkOrganizationPublicProfile';
import WorkAnnouncementsList from '../components/WorkAnnouncementsList';
import WorkDepartmentManagementPage from '../components/WorkDepartmentManagementPage';
import SchoolDashboard from '../components/SchoolDashboard';
import ParentChildrenDashboard from '../components/ParentChildrenDashboard';
import SchoolFinder from '../components/SchoolFinder';
import SchoolEnrollment from '../components/SchoolEnrollment';
import MySchoolsList from '../components/MySchoolsList';

/**
 * Work/Organizations Module Content - Extracted from App.js
 * Handles all work organization-related views
 */
function WorkModuleContent({
  activeView,
  setActiveView,
  user,
  currentModule,
  selectedOrganizationId,
  setSelectedOrganizationId,
  workSetupMode,
  setWorkSetupMode,
  viewingPublicOrgId,
  setViewingPublicOrgId,
  activeGroup,
  activeDirectChat,
  chatGroups,
  handleGroupSelect,
  handleCreateGroup,
}) {
  // MY WORK View
  if (activeView === 'my-work') {
    return (
      <ErrorBoundary>
        <WorkOrganizationList
          onOrgClick={(orgId) => {
            setSelectedOrganizationId(orgId);
            setActiveView('work-org-profile');
          }}
          onCreateNew={() => {
            setWorkSetupMode('choice');
            setActiveView('work-setup');
          }}
          onJoinOrg={() => setActiveView('work-search')}
          onViewRequests={() => setActiveView('work-requests')}
          onExploreFeed={() => setActiveView('feed')}
        />
      </ErrorBoundary>
    );
  }

  if (activeView === 'work-search') {
    return (
      <ErrorBoundary>
        <WorkSearchOrganizations
          onBack={() => setActiveView('my-work')}
          onViewProfile={(orgId) => {
            setViewingPublicOrgId(orgId);
            setActiveView('work-org-public-view');
          }}
          onJoinSuccess={(orgId) => {
            setSelectedOrganizationId(orgId);
            setActiveView('work-org-profile');
          }}
        />
      </ErrorBoundary>
    );
  }

  if (activeView === 'work-org-public-view') {
    return (
      <ErrorBoundary>
        <WorkOrganizationPublicProfile
          organizationId={viewingPublicOrgId}
          currentUserId={user?.id}
          onBack={() => setActiveView('work-search')}
          moduleColor={currentModule.color}
        />
      </ErrorBoundary>
    );
  }

  if (activeView === 'work-requests') {
    return (
      <ErrorBoundary>
        <WorkJoinRequests
          onBack={() => setActiveView('my-work')}
          onViewProfile={(orgId) => {
            setSelectedOrganizationId(orgId);
            setActiveView('work-org-profile');
          }}
        />
      </ErrorBoundary>
    );
  }

  if (activeView === 'work-setup') {
    return (
      <ErrorBoundary>
        <WorkSetupPage
          initialMode={workSetupMode}
          onBack={() => setActiveView('my-work')}
          onComplete={() => setActiveView('my-work')}
          onJoinRequest={(orgId) => {
            setSelectedOrganizationId(orgId);
            setActiveView('my-work');
          }}
        />
      </ErrorBoundary>
    );
  }

  if (activeView === 'work-trigger') {
    return (
      <ErrorBoundary>
        <WorkTriggerFlow
          onCreateOrg={() => {
            setWorkSetupMode('create');
            setActiveView('work-setup');
          }}
          onJoinOrg={() => setActiveView('work-search')}
        />
      </ErrorBoundary>
    );
  }

  if (activeView === 'work-org-profile') {
    return (
      <ErrorBoundary>
        <WorkOrganizationProfile
          organizationId={selectedOrganizationId}
          onBack={() => setActiveView('my-work')}
          onInviteMember={(orgId, orgName) => {
            alert(`Invite members to ${orgName} (Coming soon)`);
          }}
          onSettings={(orgId) => {
            alert('Organization settings (Coming soon)');
          }}
        />
      </ErrorBoundary>
    );
  }

  if (activeView === 'work-announcements') {
    return (
      <ErrorBoundary>
        <WorkAnnouncementsList
          organizationId={selectedOrganizationId}
          onBack={() => setActiveView('wall')}
          currentUserId={user?.id}
          moduleColor={currentModule.color}
        />
      </ErrorBoundary>
    );
  }

  if (activeView === 'work-department-management') {
    return (
      <ErrorBoundary>
        <WorkDepartmentManagementPage
          organizationId={selectedOrganizationId}
          onBack={() => setActiveView('wall')}
          moduleColor={currentModule.color}
        />
      </ErrorBoundary>
    );
  }

  // School views (part of organizations)
  if (activeView === 'my-school' || activeView === 'my-school-admin') {
    return (
      <ErrorBoundary>
        <SchoolDashboard
          onViewChildren={() => setActiveView('school-my-children')}
          onFindSchool={() => setActiveView('school-find')}
          onEnrollmentRequest={() => setActiveView('school-enrollment')}
          onViewMySchools={() => setActiveView('school-my-schools')}
        />
      </ErrorBoundary>
    );
  }

  if (activeView === 'school-my-children') {
    return (
      <ErrorBoundary>
        <ParentChildrenDashboard />
      </ErrorBoundary>
    );
  }

  if (activeView === 'school-find') {
    return (
      <ErrorBoundary>
        <SchoolFinder />
      </ErrorBoundary>
    );
  }

  if (activeView === 'school-enrollment') {
    return (
      <ErrorBoundary>
        <SchoolEnrollment />
      </ErrorBoundary>
    );
  }

  if (activeView === 'school-my-schools') {
    return (
      <ErrorBoundary>
        <MySchoolsList
          onBack={() => setActiveView('my-school')}
          onSchoolClick={(schoolId) => console.log('School clicked:', schoolId)}
        />
      </ErrorBoundary>
    );
  }

  // Wall/Feed view
  if (activeView === 'wall' || activeView === 'feed') {
    return (
      <UniversalWall
        activeGroup={activeGroup}
        moduleColor={currentModule.color}
        moduleName={currentModule.name}
        activeModule="organizations"
        user={user}
      />
    );
  }

  // Default: Chat view
  return (
    <UniversalChatLayout
      activeGroup={activeGroup}
      activeDirectChat={activeDirectChat}
      chatGroups={chatGroups}
      onGroupSelect={handleGroupSelect}
      moduleColor={currentModule.color}
      onCreateGroup={handleCreateGroup}
      user={user}
    />
  );
}

export default WorkModuleContent;
