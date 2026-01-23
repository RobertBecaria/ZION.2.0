import React, { memo, useCallback, lazy, Suspense, useMemo } from 'react';
import { ErrorBoundary } from '../components/auth';

// Lazy load all components for better code splitting
const UniversalWall = lazy(() => import('../components/UniversalWall'));
const UniversalChatLayout = lazy(() => import('../components/UniversalChatLayout'));
const WorkOrganizationList = lazy(() => import('../components/WorkOrganizationList'));
const WorkOrganizationProfile = lazy(() => import('../components/WorkOrganizationProfile'));
const WorkSearchOrganizations = lazy(() => import('../components/WorkSearchOrganizations'));
const WorkJoinRequests = lazy(() => import('../components/WorkJoinRequests'));
const WorkSetupPage = lazy(() => import('../components/WorkSetupPage'));
const WorkTriggerFlow = lazy(() => import('../components/WorkTriggerFlow'));
const WorkOrganizationPublicProfile = lazy(() => import('../components/WorkOrganizationPublicProfile'));
const WorkAnnouncementsList = lazy(() => import('../components/WorkAnnouncementsList'));
const WorkDepartmentManagementPage = lazy(() => import('../components/WorkDepartmentManagementPage'));
const SchoolDashboard = lazy(() => import('../components/SchoolDashboard'));
const ParentChildrenDashboard = lazy(() => import('../components/ParentChildrenDashboard'));
const SchoolFinder = lazy(() => import('../components/SchoolFinder'));
const SchoolEnrollment = lazy(() => import('../components/SchoolEnrollment'));
const MySchoolsList = lazy(() => import('../components/MySchoolsList'));

const LoadingFallback = () => <div className="module-loading"><div className="loading-spinner" /><p>Загрузка...</p></div>;

/**
 * Work/Organizations Module Content - Optimized with memoization and lazy loading
 */
const WorkModuleContent = memo(function WorkModuleContent({
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
  const { color: moduleColor, name: moduleName } = currentModule;

  // Memoized navigation callbacks
  const nav = useMemo(() => ({
    toMyWork: () => setActiveView('my-work'),
    toWall: () => setActiveView('wall'),
    toFeed: () => setActiveView('feed'),
    toWorkSearch: () => setActiveView('work-search'),
    toWorkRequests: () => setActiveView('work-requests'),
    toWorkSetup: () => setActiveView('work-setup'),
    toWorkOrgProfile: () => setActiveView('work-org-profile'),
    toWorkOrgPublicView: () => setActiveView('work-org-public-view'),
    toSchoolChildren: () => setActiveView('school-my-children'),
    toSchoolFind: () => setActiveView('school-find'),
    toSchoolEnrollment: () => setActiveView('school-enrollment'),
    toSchoolMySchools: () => setActiveView('school-my-schools'),
    toMySchool: () => setActiveView('my-school'),
  }), [setActiveView]);

  // Handler for org selection
  const handleOrgClick = useCallback((orgId) => {
    setSelectedOrganizationId(orgId);
    setActiveView('work-org-profile');
  }, [setSelectedOrganizationId, setActiveView]);

  const handleViewPublicProfile = useCallback((orgId) => {
    setViewingPublicOrgId(orgId);
    setActiveView('work-org-public-view');
  }, [setViewingPublicOrgId, setActiveView]);

  const handleJoinSuccess = useCallback((orgId) => {
    setSelectedOrganizationId(orgId);
    setActiveView('work-org-profile');
  }, [setSelectedOrganizationId, setActiveView]);

  const handleCreateNew = useCallback(() => {
    setWorkSetupMode('choice');
    setActiveView('work-setup');
  }, [setWorkSetupMode, setActiveView]);

  const handleCreateOrg = useCallback(() => {
    setWorkSetupMode('create');
    setActiveView('work-setup');
  }, [setWorkSetupMode, setActiveView]);

  // View renderer
  const renderContent = () => {
    switch (activeView) {
      case 'my-work':
        return (
          <WorkOrganizationList
            onOrgClick={handleOrgClick}
            onCreateNew={handleCreateNew}
            onJoinOrg={nav.toWorkSearch}
            onViewRequests={nav.toWorkRequests}
            onExploreFeed={nav.toFeed}
          />
        );

      case 'work-search':
        return (
          <WorkSearchOrganizations
            onBack={nav.toMyWork}
            onViewProfile={handleViewPublicProfile}
            onJoinSuccess={handleJoinSuccess}
          />
        );

      case 'work-org-public-view':
        return (
          <WorkOrganizationPublicProfile
            organizationId={viewingPublicOrgId}
            currentUserId={user?.id}
            onBack={nav.toWorkSearch}
            moduleColor={moduleColor}
          />
        );

      case 'work-requests':
        return (
          <WorkJoinRequests
            onBack={nav.toMyWork}
            onViewProfile={handleOrgClick}
          />
        );

      case 'work-setup':
        return (
          <WorkSetupPage
            initialMode={workSetupMode}
            onBack={nav.toMyWork}
            onComplete={nav.toMyWork}
            onJoinRequest={handleOrgClick}
          />
        );

      case 'work-trigger':
        return (
          <WorkTriggerFlow
            onCreateOrg={handleCreateOrg}
            onJoinOrg={nav.toWorkSearch}
          />
        );

      case 'work-org-profile':
        return (
          <WorkOrganizationProfile
            organizationId={selectedOrganizationId}
            onBack={nav.toMyWork}
            onInviteMember={(orgId, orgName) => alert(`Invite members to ${orgName} (Coming soon)`)}
            onSettings={() => alert('Organization settings (Coming soon)')}
          />
        );

      case 'work-announcements':
        return (
          <WorkAnnouncementsList
            organizationId={selectedOrganizationId}
            onBack={nav.toWall}
            currentUserId={user?.id}
            moduleColor={moduleColor}
          />
        );

      case 'work-department-management':
        return (
          <WorkDepartmentManagementPage
            organizationId={selectedOrganizationId}
            onBack={nav.toWall}
            moduleColor={moduleColor}
          />
        );

      case 'my-school':
      case 'my-school-admin':
        return (
          <SchoolDashboard
            onViewChildren={nav.toSchoolChildren}
            onFindSchool={nav.toSchoolFind}
            onEnrollmentRequest={nav.toSchoolEnrollment}
            onViewMySchools={nav.toSchoolMySchools}
          />
        );

      case 'school-my-children':
        return <ParentChildrenDashboard />;

      case 'school-find':
        return <SchoolFinder />;

      case 'school-enrollment':
        return <SchoolEnrollment />;

      case 'school-my-schools':
        return (
          <MySchoolsList
            onBack={nav.toMySchool}
            onSchoolClick={(schoolId) => { /* TODO: Implement school navigation */ }}
          />
        );

      case 'wall':
      case 'feed':
        return (
          <UniversalWall
            activeGroup={activeGroup}
            moduleColor={moduleColor}
            moduleName={moduleName}
            activeModule="organizations"
            user={user}
          />
        );

      default:
        return (
          <UniversalChatLayout
            activeGroup={activeGroup}
            activeDirectChat={activeDirectChat}
            chatGroups={chatGroups}
            onGroupSelect={handleGroupSelect}
            moduleColor={moduleColor}
            onCreateGroup={handleCreateGroup}
            user={user}
          />
        );
    }
  };

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        {renderContent()}
      </Suspense>
    </ErrorBoundary>
  );
});

export default WorkModuleContent;
