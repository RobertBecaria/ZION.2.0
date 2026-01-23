import React, { useState, useEffect, Suspense, lazy } from 'react';
import './App.css';
import './usability-fixes.css';
// Skin V5 - Ultimate Design System
import './skins/skin-v5-ultimate.css';
// Auth Components
import { AuthProvider, useAuth, ErrorBoundary, LoginForm, RegistrationForm, OnboardingWizard } from './components/auth';
// Layout Components
import { ModuleNavigation, LeftSidebar, RightSidebar } from './components/layout';
// Admin Components
import { AdminPanel } from './components/admin';
// Context
import { AppContextProvider, useAppContext } from './context/AppContext';
// Config
import { getModuleByKey, getSidebarTintStyle } from './config/moduleConfig';
// Core Components (always loaded)
import UniversalCalendar from './components/UniversalCalendar';
import ContentNavigation from './components/ContentNavigation';
import UniversalEventsPanel from './components/UniversalEventsPanel';
import NewsEventsPanel from './components/NewsEventsPanel';
import MediaStorage from './components/MediaStorage';
import MyProfile from './components/MyProfile';
import MyInfoPage from './components/MyInfoPage';
import GenderUpdateModal from './components/GenderUpdateModal';
import WorkDepartmentManager from './components/WorkDepartmentManager';
import NotificationDropdown from './components/NotificationDropdown';
import ModuleErrorBoundary from './components/ModuleErrorBoundary';
import { ERICChatWidget } from './components/eric';
import { Search, ChevronRight, Plus, X, FileText, Image, Calendar, MessageCircle, Users, Moon, Sun } from 'lucide-react';

// Lazy load module content for code splitting
const FamilyModuleContent = lazy(() => import('./pages/FamilyModuleContent'));
const WorkModuleContent = lazy(() => import('./pages/WorkModuleContent'));
const NewsModuleContent = lazy(() => import('./pages/NewsModuleContent'));
const ServicesModuleContent = lazy(() => import('./pages/ServicesModuleContent'));
const MarketplaceModuleContent = lazy(() => import('./pages/MarketplaceModuleContent'));
const FinanceModuleContent = lazy(() => import('./pages/FinanceModuleContent'));
const EventsModuleContent = lazy(() => import('./pages/EventsModuleContent'));
const JournalModuleContent = lazy(() => import('./pages/JournalModuleContent'));

// Loading fallback component
const ModuleLoading = () => (
  <div className="module-loading">
    <div className="loading-spinner"></div>
    <p>Загрузка...</p>
  </div>
);

// Main Dashboard Component - Uses AppContext for state
function Dashboard() {
  const { user, logout, refreshProfile } = useAuth();

  // Theme state - persisted to localStorage
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('zion-theme');
    return saved === 'dark';
  });

  // Apply theme class to document
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
    localStorage.setItem('zion-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  // All state is now managed by AppContext
  const {
    // Core navigation
    activeModule,
    setActiveModule,
    activeView,
    setActiveView,
    moduleViewHistory,
    currentModule,

    // UI state
    showOnboarding,
    setShowOnboarding,
    currentTime,
    showCalendar,
    setShowCalendar,
    showNotifications,
    setShowNotifications,
    showERICWidget,
    setShowERICWidget,
    showGenderModal,
    setShowGenderModal,
    showGlobalSearch,
    setShowGlobalSearch,
    showQuickCreate,
    setShowQuickCreate,

    // Family module
    userFamily,
    setUserFamily,
    activeFilters,

    // Work module
    selectedOrganizationId,
    setSelectedOrganizationId,
    workSetupMode,
    setWorkSetupMode,
    viewingPublicOrgId,
    setViewingPublicOrgId,
    showDepartmentManager,
    setShowDepartmentManager,
    setDepartmentRefreshTrigger,

    // News module
    selectedChannelId,
    setSelectedChannelId,
    selectedNewsUserId,
    setSelectedNewsUserId,

    // Services module
    selectedServiceListing,
    setSelectedServiceListing,

    // Marketplace module
    selectedMarketplaceProduct,
    setSelectedMarketplaceProduct,
    editMarketplaceProduct,
    setEditMarketplaceProduct,
    selectedInventoryCategory,
    setSelectedInventoryCategory,
    editInventoryItem,
    setEditInventoryItem,
    listForSaleItem,
    setListForSaleItem,

    // Good Will module
    selectedGoodWillEventId,
    setSelectedGoodWillEventId,

    // Media
    selectedModuleFilter,
    setSelectedModuleFilter,

    // Chat
    chatGroups,
    activeGroup,
    activeDirectChat,
    handleGroupSelect,
    handleCreateGroup,

    // Journal/School module
    schoolRoles,
    loadingSchoolRoles,
    selectedSchool,
    setSelectedSchool,
    schoolRole,
    setSchoolRole,
    journalSchoolFilter,
    journalAudienceFilter,
  } = useAppContext();

  const sidebarTintStyle = getSidebarTintStyle(currentModule.color);

  if (showOnboarding) {
    return <OnboardingWizard onComplete={async () => {
      if (user?.id) {
        localStorage.setItem(`onboarding_completed_${user.id}`, 'true');
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      setShowOnboarding(false);
    }} />;
  }

  // Determine if content should be full width
  const isFullWidthView = () => {
    const fullWidthViews = [
      'my-profile', 'media-photos', 'media-documents', 'media-videos',
      'school-my-children', 'school-enrollment', 'school-find',
      'family-profiles', 'family-create', 'family-view', 'family-invitations',
      'my-info', 'my-documents', 'event-planner', 'journal-calendar'
    ];

    if (fullWidthViews.includes(activeView)) return true;
    if (activeModule === 'organizations') return true;
    if (activeModule === 'news' && activeView !== 'wall' && activeView !== 'feed') return true;
    if (activeModule === 'services' && activeView !== 'services-feed') return true;
    if (activeModule === 'marketplace' && activeView !== 'wall' && activeView !== 'feed') return true;
    if (activeModule === 'finance') return true;
    if (activeModule === 'events') return true;
    if (activeModule === 'journal' && selectedSchool) return true;

    return false;
  };

  // Determine if events panel should be shown
  const showEventsPanel = () => {
    if (activeModule === 'journal' && selectedSchool) return false;
    if (activeModule === 'news' && activeView !== 'wall' && activeView !== 'feed') return false;
    if (activeModule === 'services' && activeView !== 'services-feed') return false;
    if (activeModule === 'marketplace' && activeView !== 'wall' && activeView !== 'feed') return false;
    if (activeModule === 'finance') return false;
    if (activeModule === 'events') return false;

    const hiddenViews = [
      'chat', 'my-profile', 'media-photos', 'media-documents', 'media-videos',
      'family-profiles', 'family-create', 'family-view', 'family-invitations',
      'my-info', 'my-documents', 'event-planner', 'journal-calendar'
    ];
    if (hiddenViews.includes(activeView)) return false;
    if (activeModule === 'organizations') return false;

    return true;
  };

  // Render module content based on active module
  const renderModuleContent = () => {
    const commonProps = {
      activeView,
      setActiveView,
      user,
      currentModule,
      activeGroup,
      activeDirectChat,
      chatGroups,
      handleGroupSelect,
      handleCreateGroup,
    };

    switch (activeModule) {
      case 'family':
        return (
          <ModuleErrorBoundary moduleName="Family" moduleColor={currentModule.color}>
            <FamilyModuleContent
              {...commonProps}
              userFamily={userFamily}
              setUserFamily={setUserFamily}
              activeFilters={activeFilters}
              refreshProfile={refreshProfile}
            />
          </ModuleErrorBoundary>
        );

      case 'organizations':
        return (
          <ModuleErrorBoundary moduleName="Work" moduleColor={currentModule.color}>
            <WorkModuleContent
              {...commonProps}
              selectedOrganizationId={selectedOrganizationId}
              setSelectedOrganizationId={setSelectedOrganizationId}
              workSetupMode={workSetupMode}
              setWorkSetupMode={setWorkSetupMode}
              viewingPublicOrgId={viewingPublicOrgId}
              setViewingPublicOrgId={setViewingPublicOrgId}
            />
          </ModuleErrorBoundary>
        );

      case 'news':
        return (
          <ModuleErrorBoundary moduleName="News" moduleColor={currentModule.color}>
            <NewsModuleContent
              {...commonProps}
              selectedChannelId={selectedChannelId}
              setSelectedChannelId={setSelectedChannelId}
              selectedNewsUserId={selectedNewsUserId}
              setSelectedNewsUserId={setSelectedNewsUserId}
            />
          </ModuleErrorBoundary>
        );

      case 'services':
        return (
          <ModuleErrorBoundary moduleName="Services" moduleColor={currentModule.color}>
            <ServicesModuleContent
              {...commonProps}
              selectedServiceListing={selectedServiceListing}
              setSelectedServiceListing={setSelectedServiceListing}
            />
          </ModuleErrorBoundary>
        );

      case 'marketplace':
        return (
          <ModuleErrorBoundary moduleName="Marketplace" moduleColor={currentModule.color}>
            <MarketplaceModuleContent
              {...commonProps}
              selectedMarketplaceProduct={selectedMarketplaceProduct}
              setSelectedMarketplaceProduct={setSelectedMarketplaceProduct}
              editMarketplaceProduct={editMarketplaceProduct}
              setEditMarketplaceProduct={setEditMarketplaceProduct}
              selectedInventoryCategory={selectedInventoryCategory}
              setSelectedInventoryCategory={setSelectedInventoryCategory}
              editInventoryItem={editInventoryItem}
              setEditInventoryItem={setEditInventoryItem}
              listForSaleItem={listForSaleItem}
              setListForSaleItem={setListForSaleItem}
            />
          </ModuleErrorBoundary>
        );

      case 'finance':
        return (
          <ModuleErrorBoundary moduleName="Finance" moduleColor={currentModule.color}>
            <FinanceModuleContent {...commonProps} />
          </ModuleErrorBoundary>
        );

      case 'events':
        return (
          <ModuleErrorBoundary moduleName="Events" moduleColor={currentModule.color}>
            <EventsModuleContent
              {...commonProps}
              selectedGoodWillEventId={selectedGoodWillEventId}
              setSelectedGoodWillEventId={setSelectedGoodWillEventId}
            />
          </ModuleErrorBoundary>
        );

      case 'journal':
        return (
          <ModuleErrorBoundary moduleName="Journal" moduleColor={currentModule.color}>
            <JournalModuleContent
              {...commonProps}
              schoolRoles={schoolRoles}
              loadingSchoolRoles={loadingSchoolRoles}
              selectedSchool={selectedSchool}
              setSelectedSchool={setSelectedSchool}
              schoolRole={schoolRole}
              setSchoolRole={setSchoolRole}
              journalSchoolFilter={journalSchoolFilter}
              journalAudienceFilter={journalAudienceFilter}
            />
          </ModuleErrorBoundary>
        );

      default:
        return <div className="coming-soon-section"><h3>В разработке</h3></div>;
    }
  };

  return (
    <div className={`app module-${activeModule}`} data-module={activeModule}>
      {/* Top Navigation Bar */}
      <ModuleNavigation
        activeModule={activeModule}
        setActiveModule={setActiveModule}
        setActiveView={setActiveView}
        moduleViewHistory={moduleViewHistory}
        user={user}
        onLogout={logout}
        currentTime={currentTime}
        showCalendar={showCalendar}
        setShowCalendar={setShowCalendar}
        setShowOnboarding={setShowOnboarding}
      />

      <div className="main-container">
        {/* Left Sidebar */}
        <LeftSidebar
          activeModule={activeModule}
          activeView={activeView}
          setActiveView={setActiveView}
          user={user}
          schoolRoles={schoolRoles}
          loadingSchoolRoles={loadingSchoolRoles}
          schoolRole={schoolRole}
          setSchoolRole={setSchoolRole}
          setSelectedSchool={setSelectedSchool}
          setSelectedChannelId={setSelectedChannelId}
        />

        {/* Central Content Area */}
        <main className="content-area" data-module={activeModule}>
          {showCalendar ? (
            <UniversalCalendar
              user={user}
              activeModule={activeModule}
              moduleColor={currentModule.color}
              onClose={() => setShowCalendar(false)}
            />
          ) : (
            <>
              <div className="content-header">
                <div className="header-left">
                  <span
                    className={`module-pill pill-${activeModule}`}
                    data-module={activeModule}
                    style={{
                      background: `linear-gradient(135deg, ${currentModule.color} 0%, ${currentModule.color}dd 100%)`,
                      boxShadow: `0 4px 12px ${currentModule.color}30, 0 1px 3px ${currentModule.color}20`
                    }}
                  >
                    {currentModule.name}
                  </span>

                  {activeView && activeView !== 'wall' && activeView !== 'feed' && (
                    <>
                      <ChevronRight size={16} className="view-separator" />
                      <span className="current-view">
                        {activeView === 'photos' && 'Фото'}
                        {activeView === 'videos' && 'Видео'}
                        {activeView === 'documents' && 'Документы'}
                        {activeView === 'calendar' && 'Календарь'}
                        {activeView === 'my-info' && 'Моя Информация'}
                        {activeView === 'my-documents' && 'Мои Документы'}
                        {!['photos', 'videos', 'documents', 'calendar', 'my-info', 'my-documents', 'feed'].includes(activeView) && 'Стена'}
                      </span>
                    </>
                  )}
                  {(!activeView || activeView === 'wall') && (
                    <>
                      <ChevronRight size={16} className="view-separator" />
                      <span className="current-view">Стена</span>
                    </>
                  )}
                  {activeView === 'feed' && (
                    <>
                      <ChevronRight size={16} className="view-separator" />
                      <span className="current-view">Моя Лента</span>
                    </>
                  )}
                </div>

                <div className="header-right">
                  <button
                    className={`header-action-btn ${showGlobalSearch ? 'active' : ''}`}
                    title="Поиск"
                    onClick={() => setShowGlobalSearch(!showGlobalSearch)}
                  >
                    <Search size={18} />
                  </button>
                  <button
                    className={`header-action-btn ${showQuickCreate ? 'active' : ''}`}
                    title="Быстрое создание"
                    onClick={() => setShowQuickCreate(!showQuickCreate)}
                  >
                    <Plus size={18} />
                  </button>
                  <button
                    className="header-action-btn theme-toggle-btn"
                    title={isDarkMode ? 'Светлая тема' : 'Тёмная тема'}
                    onClick={toggleTheme}
                  >
                    {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                  </button>
                  <div style={{ position: 'relative' }}>
                    <NotificationDropdown
                      isOpen={showNotifications}
                      onClose={() => setShowNotifications(!showNotifications)}
                      onOpenEricChat={() => setShowERICWidget(true)}
                    />
                  </div>
                </div>
              </div>

              <div className="content-body">
                {!['my-family-profile', 'family-public-view', 'my-info', 'my-documents', 'media-photos', 'media-documents', 'media-videos'].includes(activeView) && (
                  <ContentNavigation
                    activeView={activeView}
                    onViewChange={setActiveView}
                    moduleColor={currentModule.color}
                    moduleName={currentModule.name}
                    showCalendar={showCalendar}
                    onCalendarToggle={() => setShowCalendar(!showCalendar)}
                  />
                )}

                <div className="split-content-layout">
                  <div className={`main-content-area ${isFullWidthView() ? 'full-width' : ''}`}>
                    {/* Media Storage Views */}
                    {activeView === 'my-profile' && (
                      <MyProfile user={user} moduleColor={currentModule.color} />
                    )}
                    {/* My Information Page - Personal Profile Edit Form */}
                    {activeView === 'my-info' && (
                      <MyInfoPage user={user} moduleColor={currentModule.color} onProfileUpdate={refreshProfile} />
                    )}
                    {(activeView === 'media-photos' || activeView === 'media-documents' || activeView === 'media-videos') && (
                      <MediaStorage
                        activeModule={activeModule}
                        moduleColor={currentModule.color}
                        selectedModuleFilter={selectedModuleFilter}
                        setSelectedModuleFilter={setSelectedModuleFilter}
                        defaultTab={activeView === 'media-videos' ? 'videos' : activeView === 'media-documents' ? 'documents' : 'photos'}
                      />
                    )}

                    {/* Module Content - Lazy Loaded */}
                    {!['my-profile', 'my-info', 'media-photos', 'media-documents', 'media-videos'].includes(activeView) && (
                      <Suspense fallback={<ModuleLoading />}>
                        {renderModuleContent()}
                      </Suspense>
                    )}
                  </div>

                  {/* Right Events Panel */}
                  {showEventsPanel() && (
                    <div className="events-panel-area">
                      {activeModule === 'news' ? (
                        <NewsEventsPanel
                          user={user}
                          moduleColor={currentModule.color}
                          onNavigateToChannel={(channel) => {
                            setSelectedChannelId(channel.id);
                            setActiveView('channel-view');
                          }}
                          onNavigateToProfile={(creator) => {
                            setSelectedNewsUserId(creator.id);
                            setActiveView('news-user-profile');
                          }}
                        />
                      ) : (
                        <UniversalEventsPanel
                          activeGroup={activeGroup}
                          moduleColor={currentModule.color}
                          moduleName={currentModule.name}
                          user={user}
                          context={activeView}
                          onOpenFullCalendar={activeModule === 'journal' ? () => setActiveView('event-planner') : null}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </main>

        {/* Right Sidebar - Now uses AppContext internally */}
        <RightSidebar />
      </div>

      {/* Gender Update Modal */}
      {showGenderModal && user && (
        <GenderUpdateModal
          isOpen={showGenderModal}
          onClose={() => {}}
          onUpdate={async (gender) => {
            if (user?.id) {
              localStorage.setItem(`gender_asked_${user.id}`, 'true');
            }
            await refreshProfile();
            setShowGenderModal(false);
          }}
        />
      )}

      {/* Department Manager Modal */}
      {showDepartmentManager && selectedOrganizationId && (
        <WorkDepartmentManager
          organizationId={selectedOrganizationId}
          onClose={() => {
            setShowDepartmentManager(false);
            setDepartmentRefreshTrigger(prev => prev + 1);
          }}
          moduleColor={currentModule.color}
        />
      )}

      {/* ERIC AI Chat Widget */}
      <ERICChatWidget user={user} />

      {/* Global Search Overlay */}
      {showGlobalSearch && (
        <div className="global-search-overlay" onClick={() => setShowGlobalSearch(false)}>
          <div className="global-search-container" onClick={(e) => e.stopPropagation()}>
            <div className="global-search-header">
              <Search size={20} />
              <input
                type="text"
                className="global-search-input"
                placeholder="Поиск по ZION.CITY..."
                autoFocus
              />
              <button className="global-search-close" onClick={() => setShowGlobalSearch(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="global-search-body">
              <p className="search-hint">Начните вводить для поиска</p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Create Menu */}
      {showQuickCreate && (
        <div className="quick-create-overlay">
          <div className="quick-create-backdrop" onClick={() => setShowQuickCreate(false)} />
          <div className="quick-create-menu">
            <div className="quick-create-header">Быстрое создание</div>
            <div className="quick-create-options">
              <button className="quick-create-option" onClick={() => { setActiveView('wall'); setShowQuickCreate(false); }}>
                <FileText size={18} />
                <span>Новый пост</span>
              </button>
              <button className="quick-create-option" onClick={() => { setActiveView('media-photos'); setShowQuickCreate(false); }}>
                <Image size={18} />
                <span>Загрузить фото</span>
              </button>
              <button className="quick-create-option" onClick={() => { setActiveView('event-planner'); setShowQuickCreate(false); }}>
                <Calendar size={18} />
                <span>Создать событие</span>
              </button>
              <button className="quick-create-option" onClick={() => { setActiveView('chat'); setShowQuickCreate(false); }}>
                <MessageCircle size={18} />
                <span>Написать сообщение</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Dashboard wrapper that provides the AppContext
function DashboardWithContext() {
  const { user, refreshProfile } = useAuth();

  return (
    <AppContextProvider user={user} refreshProfile={refreshProfile}>
      <Dashboard />
    </AppContextProvider>
  );
}

// Main App Component
function App() {
  const [authMode, setAuthMode] = useState('login');
  const [isAdminRoute, setIsAdminRoute] = useState(false);

  useEffect(() => {
    // Check if current path is admin
    const checkAdminRoute = () => {
      const path = window.location.pathname;
      setIsAdminRoute(path === '/admin' || path.startsWith('/admin/'));
    };

    checkAdminRoute();

    // Listen for popstate events (browser back/forward)
    window.addEventListener('popstate', checkAdminRoute);

    return () => {
      window.removeEventListener('popstate', checkAdminRoute);
    };
  }, []);

  // If admin route, render admin panel
  if (isAdminRoute) {
    return (
      <ErrorBoundary>
        <AdminPanel />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <div className="App">
          <AuthWrapper authMode={authMode} setAuthMode={setAuthMode} />
        </div>
      </AuthProvider>
    </ErrorBoundary>
  );
}

function AuthWrapper({ authMode, setAuthMode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Загрузка ZION.CITY...</p>
      </div>
    );
  }

  if (!user) {
    if (authMode === 'register') {
      return <RegistrationForm onSwitchToLogin={() => setAuthMode('login')} />;
    }
    return <LoginForm onSwitchToRegister={() => setAuthMode('register')} />;
  }

  return <DashboardWithContext />;
}

export default App;
