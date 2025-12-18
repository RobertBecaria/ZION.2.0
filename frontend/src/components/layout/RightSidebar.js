/**
 * RightSidebar / WorldZone Component
 * Right sidebar with context-specific widgets and filters
 * Refactored from App.js to improve code organization
 */
import React from 'react';
import { Eye } from 'lucide-react';
import { getModuleByKey, getSidebarTintStyle } from '../../config/moduleConfig';

// World Zone Components
import JournalWorldZone from '../JournalWorldZone';
import NewsWorldZone from '../NewsWorldZone';
import FamilyWorldZone from '../FamilyWorldZone';
import MediaWorldZone from '../MediaWorldZone';
import FamilyProfileWorldZone from '../FamilyProfileWorldZone';
import ChatWorldZone from '../ChatWorldZone';
import WorkWorldZone from '../WorkWorldZone';
import InfoWorldZone from '../InfoWorldZone';

// Work/Organization Widgets
import WorkNextEventWidget from '../WorkNextEventWidget';
import WorkUpcomingEventsList from '../WorkUpcomingEventsList';
import WorkCalendarWidget from '../WorkCalendarWidget';
import WorkDepartmentNavigator from '../WorkDepartmentNavigator';
import WorkAnnouncementsWidget from '../WorkAnnouncementsWidget';

const RightSidebar = ({
  // Core state
  activeModule,
  activeView,
  user,
  currentModule,
  sidebarTintStyle,
  
  // Family module
  activeFilters,
  setActiveFilters,
  userFamily,
  setActiveView,
  
  // Journal module
  schoolRoles,
  journalSchoolFilter,
  setJournalSchoolFilter,
  journalAudienceFilter,
  setJournalAudienceFilter,
  selectedSchool,
  setSelectedSchool,
  schoolRole,
  
  // Organizations module
  selectedOrganizationId,
  setSelectedOrganizationId,
  activeDepartmentId,
  setActiveDepartmentId,
  setShowDepartmentManager,
  departmentRefreshTrigger,
  myOrganizations,
  
  // Media module
  mediaStats,
  selectedModuleFilter,
  setSelectedModuleFilter,
  
  // Chat
  chatGroups,
  activeGroup,
  handleGroupSelect,
  handleCreateGroup,
  activeDirectChat,
  setActiveDirectChat,
  fetchChatGroups
}) => {
  // Use provided currentModule or get it from activeModule
  const moduleData = currentModule || getModuleByKey(activeModule);
  const tintStyle = sidebarTintStyle || getSidebarTintStyle(moduleData.color);

  return (
    <aside className="right-sidebar" style={tintStyle}>
      {/* Hide default header for Chat module - it has its own header */}
      {activeView !== 'chat' && (
        <div className="sidebar-header">
          <h3>Мировая Зона</h3>
        </div>
      )}
      
      {/* JOURNAL Module - Feed View Filters */}
      {activeModule === 'journal' && (activeView === 'wall' || activeView === 'feed') && (
        <JournalWorldZone
          inFeedView={true}
          schoolRoles={schoolRoles}
          schoolFilter={journalSchoolFilter}
          onSchoolFilterChange={setJournalSchoolFilter}
          audienceFilter={journalAudienceFilter}
          onAudienceFilterChange={setJournalAudienceFilter}
          onOpenEventPlanner={() => setActiveView('event-planner')}
        />
      )}
      
      {/* JOURNAL Module - School Selected Navigation */}
      {activeModule === 'journal' && selectedSchool && (
        <JournalWorldZone
          selectedSchool={selectedSchool}
          role={schoolRole}
          onNavigate={(view) => {
            if (view === 'school-list') {
              setSelectedSchool(null);
              setActiveView('journal-school-tiles');
            } else {
              setActiveView(`journal-${view}`);
            }
          }}
        />
      )}
      
      {/* WALL and FEED Views - Wall-specific widgets (Family module only) */}
      {activeModule === 'family' && (activeView === 'wall' || activeView === 'feed') && (
        <FamilyWorldZone
          moduleColor={moduleData.color}
          activeFilters={activeFilters}
          setActiveFilters={setActiveFilters}
          user={user}
        />
      )}

      {/* NEWS Module - Social World Zone */}
      {activeModule === 'news' && (
        <NewsWorldZone
          user={user}
          moduleColor={moduleData.color}
          onViewFriends={() => setActiveView('friends')}
          onViewFollowers={() => setActiveView('followers')}
          onViewFollowing={() => setActiveView('following')}
        />
      )}

      {/* Public View Button - Only when viewing "МОЯ СЕМЬЯ" */}
      {activeModule === 'family' && userFamily && activeView === 'my-family-profile' && (
        <div className="widget public-view-widget">
          <div className="widget-header">
            <Eye size={16} />
            <span>Публичный просмотр</span>
          </div>
          <button 
            className="public-view-button"
            onClick={() => setActiveView('family-public-view')}
            style={{ 
              backgroundColor: activeView === 'family-public-view' ? moduleData.color : 'white',
              color: activeView === 'family-public-view' ? 'white' : moduleData.color,
              borderColor: moduleData.color
            }}
          >
            <Eye size={18} />
            Как видят другие
          </button>
          <p className="widget-hint">Посмотрите, как ваша семья отображается для других пользователей</p>
        </div>
      )}

      {/* ORGANIZATIONS Module - Department & Announcements Widgets */}
      {/* Only show when viewing a specific organization profile, not in general feed */}
      {activeModule === 'organizations' && selectedOrganizationId && activeView === 'work-org-profile' && (
        <>
          {/* Next Event Countdown Widget */}
          <WorkNextEventWidget
            organizationId={selectedOrganizationId}
          />

          {/* Upcoming Events List Widget */}
          <WorkUpcomingEventsList
            organizationId={selectedOrganizationId}
            maxEvents={5}
          />

          {/* Calendar Widget */}
          <WorkCalendarWidget
            organizationId={selectedOrganizationId}
          />

          {/* Department Navigator Widget */}
          <WorkDepartmentNavigator
            organizationId={selectedOrganizationId}
            activeDepartmentId={activeDepartmentId}
            onDepartmentSelect={setActiveDepartmentId}
            onCreateDepartment={() => setShowDepartmentManager(true)}
            moduleColor={moduleData.color}
            refreshTrigger={departmentRefreshTrigger}
          />

          {/* Announcements Widget */}
          <WorkAnnouncementsWidget
            organizationId={selectedOrganizationId}
            departmentId={activeDepartmentId}
            onViewAll={() => {
              setActiveView('work-announcements');
            }}
            moduleColor={moduleData.color}
          />
        </>
      )}

      {/* MEDIA Views - Media-specific controls */}
      {(activeView === 'media-photos' || activeView === 'media-documents' || activeView === 'media-videos') && (
        <MediaWorldZone
          activeView={activeView}
          moduleColor={moduleData.color}
          mediaStats={mediaStats}
          selectedModuleFilter={selectedModuleFilter}
          setSelectedModuleFilter={setSelectedModuleFilter}
        />
      )}

      {/* FAMILY PROFILE Views - Family-specific controls */}
      {(activeView === 'family-profiles' || activeView === 'family-create' || activeView === 'family-view' || activeView === 'family-invitations') && (
        <FamilyProfileWorldZone
          moduleColor={moduleData.color}
          setActiveView={setActiveView}
        />
      )}

      {/* CHAT View - Chat-specific widgets */}
      {activeView === 'chat' && (
        <ChatWorldZone
          moduleColor={moduleData.color}
          chatGroups={chatGroups}
          activeGroup={activeGroup}
          handleGroupSelect={handleGroupSelect}
          handleCreateGroup={handleCreateGroup}
          user={user}
          activeDirectChat={activeDirectChat}
          setActiveDirectChat={setActiveDirectChat}
          onRefreshGroups={fetchChatGroups}
        />
      )}

      {/* ORGANIZATIONS Module - Work WorldZone */}
      {activeModule === 'organizations' && (
        <WorkWorldZone
          organizations={myOrganizations}
          selectedOrg={selectedOrganizationId}
          onOrgChange={setSelectedOrganizationId}
          moduleColor={moduleData?.color || '#C2410C'}
        />
      )}

      {/* MY DOCUMENTS & MY INFO Views - Info widgets */}
      {(activeView === 'my-documents' || activeView === 'my-info') && (
        <InfoWorldZone activeView={activeView} />
      )}
    </aside>
  );
};

export default RightSidebar;
