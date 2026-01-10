import React from 'react';
import { ErrorBoundary } from '../components/auth';
import UniversalWall from '../components/UniversalWall';
import UniversalChatLayout from '../components/UniversalChatLayout';
import MyFamilyProfile from '../components/MyFamilyProfile';
import PublicFamilyProfile from '../components/PublicFamilyProfile';
import FamilySetupPage from '../components/FamilySetupPage';

/**
 * Family Module Content - Extracted from App.js
 * Handles all family-related views
 */
function FamilyModuleContent({
  activeView,
  setActiveView,
  user,
  currentModule,
  userFamily,
  setUserFamily,
  activeFilters,
  activeGroup,
  activeDirectChat,
  chatGroups,
  handleGroupSelect,
  handleCreateGroup,
  refreshProfile,
}) {
  // Feed and Wall views
  if (activeView === 'wall' || activeView === 'feed') {
    return (
      <UniversalWall
        activeGroup={activeGroup}
        moduleColor={currentModule.color}
        moduleName={currentModule.name}
        activeModule="family"
        user={user}
        activeFilters={activeFilters}
        userFamilyId={userFamily?.id}
      />
    );
  }

  // My Family Profile view
  if (activeView === 'my-family-profile') {
    return (
      <ErrorBoundary>
        {userFamily ? (
          <MyFamilyProfile
            user={user}
            familyData={userFamily}
            moduleColor={currentModule.color}
          />
        ) : (
          <FamilySetupPage
            user={user}
            onBack={() => setActiveView('wall')}
            onComplete={async (newFamily) => {
              setUserFamily(newFamily);
              await refreshProfile();
              setActiveView('my-family-profile');
            }}
          />
        )}
      </ErrorBoundary>
    );
  }

  // Public Family Profile view
  if (activeView === 'family-public-view') {
    return (
      <ErrorBoundary>
        <PublicFamilyProfile
          user={user}
          familyId={userFamily?.id}
          onBack={() => setActiveView('my-family-profile')}
          moduleColor={currentModule.color}
        />
      </ErrorBoundary>
    );
  }

  // Chat view (default)
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

export default FamilyModuleContent;
