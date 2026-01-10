import React, { memo, useCallback, lazy, Suspense } from 'react';
import { ErrorBoundary } from '../components/auth';

// Lazy load heavy components
const UniversalWall = lazy(() => import('../components/UniversalWall'));
const UniversalChatLayout = lazy(() => import('../components/UniversalChatLayout'));
const MyFamilyProfile = lazy(() => import('../components/MyFamilyProfile'));
const PublicFamilyProfile = lazy(() => import('../components/PublicFamilyProfile'));
const FamilySetupPage = lazy(() => import('../components/FamilySetupPage'));

const LoadingFallback = () => <div className="module-loading"><div className="loading-spinner" /><p>Загрузка...</p></div>;

/**
 * Family Module Content - Optimized with memoization and lazy loading
 */
const FamilyModuleContent = memo(function FamilyModuleContent({
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
  const { color: moduleColor, name: moduleName } = currentModule;
  const userFamilyId = userFamily?.id;

  // Memoized callbacks
  const handleBackToWall = useCallback(() => setActiveView('wall'), [setActiveView]);
  const handleBackToProfile = useCallback(() => setActiveView('my-family-profile'), [setActiveView]);
  
  const handleFamilySetupComplete = useCallback(async (newFamily) => {
    setUserFamily(newFamily);
    await refreshProfile();
    setActiveView('my-family-profile');
  }, [setUserFamily, refreshProfile, setActiveView]);

  // View renderer map for cleaner code
  const renderContent = () => {
    switch (activeView) {
      case 'wall':
      case 'feed':
        return (
          <UniversalWall
            activeGroup={activeGroup}
            moduleColor={moduleColor}
            moduleName={moduleName}
            activeModule="family"
            user={user}
            activeFilters={activeFilters}
            userFamilyId={userFamilyId}
          />
        );

      case 'my-family-profile':
        return (
          <ErrorBoundary>
            {userFamily ? (
              <MyFamilyProfile
                user={user}
                familyData={userFamily}
                moduleColor={moduleColor}
              />
            ) : (
              <FamilySetupPage
                user={user}
                onBack={handleBackToWall}
                onComplete={handleFamilySetupComplete}
              />
            )}
          </ErrorBoundary>
        );

      case 'family-public-view':
        return (
          <ErrorBoundary>
            <PublicFamilyProfile
              user={user}
              familyId={userFamilyId}
              onBack={handleBackToProfile}
              moduleColor={moduleColor}
            />
          </ErrorBoundary>
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
    <Suspense fallback={<LoadingFallback />}>
      {renderContent()}
    </Suspense>
  );
});

export default FamilyModuleContent;
