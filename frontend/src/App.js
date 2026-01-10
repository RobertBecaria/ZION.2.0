import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import './App.css';
// Auth Components
import { AuthProvider, useAuth, ErrorBoundary, LoginForm, RegistrationForm, OnboardingWizard } from './components/auth';
// Layout Components
import { ModuleNavigation, LeftSidebar, RightSidebar } from './components/layout';
// Config
import { getModuleByKey, getSidebarTintStyle } from './config/moduleConfig';
// Hooks
import { useJournalModule } from './hooks';
// Core Components (always loaded)
import UniversalCalendar from './components/UniversalCalendar';
import ContentNavigation from './components/ContentNavigation';
import UniversalEventsPanel from './components/UniversalEventsPanel';
import NewsEventsPanel from './components/NewsEventsPanel';
import MediaStorage from './components/MediaStorage';
import MyProfile from './components/MyProfile';
import GenderUpdateModal from './components/GenderUpdateModal';
import WorkDepartmentManager from './components/WorkDepartmentManager';
import NotificationDropdown from './components/NotificationDropdown';
import { ERICChatWidget } from './components/eric';
import { Search, ChevronRight, Plus } from 'lucide-react';

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

// Main Dashboard Component
function Dashboard() {
  const { user, logout, refreshProfile } = useAuth();
  
  // Core navigation state
  const [activeModule, setActiveModule] = useState('family');
  const [activeView, setActiveView] = useState('wall');
  const [moduleViewHistory, setModuleViewHistory] = useState({});
  
  // UI state
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showERICWidget, setShowERICWidget] = useState(false);
  const [showGenderModal, setShowGenderModal] = useState(false);
  
  // Family module state
  const [userFamily, setUserFamily] = useState(null);
  const [loadingFamily, setLoadingFamily] = useState(true);
  const [activeFilters, setActiveFilters] = useState([]);
  
  // Work module state
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(null);
  const [workSetupMode, setWorkSetupMode] = useState('choice');
  const [activeDepartmentId, setActiveDepartmentId] = useState(null);
  const [showDepartmentManager, setShowDepartmentManager] = useState(false);
  const [departmentRefreshTrigger, setDepartmentRefreshTrigger] = useState(0);
  const [myOrganizations, setMyOrganizations] = useState([]);
  const [viewingPublicOrgId, setViewingPublicOrgId] = useState(null);
  
  // News module state
  const [selectedChannelId, setSelectedChannelId] = useState(null);
  const [selectedNewsUserId, setSelectedNewsUserId] = useState(null);
  
  // Services module state
  const [selectedServiceListing, setSelectedServiceListing] = useState(null);
  
  // Marketplace module state
  const [selectedMarketplaceProduct, setSelectedMarketplaceProduct] = useState(null);
  const [editMarketplaceProduct, setEditMarketplaceProduct] = useState(null);
  const [selectedInventoryCategory, setSelectedInventoryCategory] = useState(null);
  const [editInventoryItem, setEditInventoryItem] = useState(null);
  const [listForSaleItem, setListForSaleItem] = useState(null);
  
  // Good Will module state
  const [selectedGoodWillEventId, setSelectedGoodWillEventId] = useState(null);
  
  // Media state
  const [mediaStats, setMediaStats] = useState({});
  const [selectedModuleFilter, setSelectedModuleFilter] = useState('all');
  
  // Chat state
  const [chatGroups, setChatGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [activeDirectChat, setActiveDirectChat] = useState(null);
  const [loadingGroups, setLoadingGroups] = useState(true);

  // Journal/School Module Hook
  const {
    schoolRoles,
    loadingSchoolRoles,
    selectedSchool,
    schoolRole,
    journalSchoolFilter,
    journalAudienceFilter,
    setSelectedSchool,
    setSchoolRole,
    setJournalSchoolFilter,
    setJournalAudienceFilter
  } = useJournalModule(user, activeModule);

  // Module config
  const currentModule = getModuleByKey(activeModule);
  const sidebarTintStyle = getSidebarTintStyle(currentModule.color);

  // Custom setActiveView that also tracks module history
  const handleSetActiveView = useCallback((view) => {
    setActiveView(view);
    setModuleViewHistory(prev => ({
      ...prev,
      [activeModule]: view
    }));
  }, [activeModule]);

  // Setup window function for opening full department management
  useEffect(() => {
    window.openDepartmentManagement = () => {
      setActiveView('work-department-management');
    };
    return () => {
      delete window.openDepartmentManagement;
    };
  }, []);

  // Load user's primary family
  useEffect(() => {
    const loadUserFamily = async () => {
      if (!user || activeModule !== 'family') {
        setLoadingFamily(false);
        return;
      }
      
      try {
        const token = localStorage.getItem('zion_token');
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/family-profiles`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          const families = data.family_profiles || [];
          const primaryFamily = families.find(f => f.user_role === 'PARENT' || f.is_user_member) || families[0];
          setUserFamily(primaryFamily);
        }
      } catch (error) {
        console.error('Error loading family:', error);
      } finally {
        setLoadingFamily(false);
      }
    };
    
    loadUserFamily();
  }, [user, activeModule]);

  // Check if user needs to set gender
  useEffect(() => {
    if (user) {
      const hasAskedGender = localStorage.getItem(`gender_asked_${user.id}`);
      if (!user.gender && !hasAskedGender) {
        setShowGenderModal(true);
      } else {
        setShowGenderModal(false);
      }
    }
  }, [user]);

  // Onboarding check (currently disabled)
  useEffect(() => {
    if (user) {
      setShowOnboarding(false);
    }
  }, [user]);

  // Set appropriate view when switching to Work module
  useEffect(() => {
    if (activeModule === 'organizations') {
      setActiveView('my-work');
    }
  }, [activeModule]);

  // Fetch user's organizations when organizations module is active
  useEffect(() => {
    const fetchMyOrganizations = async () => {
      if (activeModule !== 'organizations' || !user) return;
      
      try {
        const token = localStorage.getItem('zion_token');
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/work/organizations/my`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          setMyOrganizations(data.organizations || []);
        }
      } catch (error) {
        console.error('Error fetching organizations:', error);
      }
    };
    
    fetchMyOrganizations();
  }, [activeModule, user]);

  // Set default view when entering Journal module
  useEffect(() => {
    if (activeModule === 'journal' && !loadingSchoolRoles) {
      setActiveView('wall');
    }
  }, [activeModule, loadingSchoolRoles]);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch media statistics
  const fetchMediaStats = useCallback(async () => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/media/modules`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const simpleCounts = {};
        let totalCount = 0;
        
        const backendToFrontendModuleMap = {
          'family': 'family', 'community': 'news', 'personal': 'journal',
          'business': 'services', 'work': 'organizations', 'education': 'journal',
          'health': 'journal', 'government': 'organizations'
        };
        
        const frontendModules = ['family', 'news', 'journal', 'services', 'organizations', 'marketplace', 'finance', 'events'];
        frontendModules.forEach(module => { simpleCounts[module] = 0; });
        
        if (data.modules) {
          Object.entries(data.modules).forEach(([backendModule, moduleData]) => {
            const frontendModule = backendToFrontendModuleMap[backendModule] || backendModule;
            const moduleCount = (moduleData.images?.length || 0) + 
                              (moduleData.documents?.length || 0) + 
                              (moduleData.videos?.length || 0);
            if (simpleCounts.hasOwnProperty(frontendModule)) {
              simpleCounts[frontendModule] += moduleCount;
            }
            totalCount += moduleCount;
          });
        }
        simpleCounts['all'] = totalCount;
        setMediaStats(simpleCounts);
      }
    } catch (error) {
      console.error('Error fetching media stats:', error);
    }
  }, []);

  // Fetch chat groups
  const fetchChatGroups = useCallback(async () => {
    setLoadingGroups(true);
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/chat-groups`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setChatGroups(data.chat_groups || []);
        
        const familyGroup = data.chat_groups?.find(g => g.group.group_type === 'FAMILY');
        if (familyGroup && !activeGroup) {
          setActiveGroup(familyGroup);
        }
      }
    } catch (error) {
      console.error('Error fetching chat groups:', error);
    } finally {
      setLoadingGroups(false);
    }
  }, [activeGroup]);

  // Load chat groups and fetch media stats when dashboard loads
  useEffect(() => {
    if (user) {
      fetchChatGroups();
      fetchMediaStats();
    }
  }, [user, fetchChatGroups, fetchMediaStats]);

  const handleGroupSelect = (groupData) => {
    setActiveGroup(groupData);
  };

  const handleCreateGroup = () => {
    fetchChatGroups();
  };

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
      setActiveView: handleSetActiveView,
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
          <FamilyModuleContent
            {...commonProps}
            userFamily={userFamily}
            setUserFamily={setUserFamily}
            activeFilters={activeFilters}
            refreshProfile={refreshProfile}
          />
        );

      case 'organizations':
        return (
          <WorkModuleContent
            {...commonProps}
            selectedOrganizationId={selectedOrganizationId}
            setSelectedOrganizationId={setSelectedOrganizationId}
            workSetupMode={workSetupMode}
            setWorkSetupMode={setWorkSetupMode}
            viewingPublicOrgId={viewingPublicOrgId}
            setViewingPublicOrgId={setViewingPublicOrgId}
          />
        );

      case 'news':
        return (
          <NewsModuleContent
            {...commonProps}
            selectedChannelId={selectedChannelId}
            setSelectedChannelId={setSelectedChannelId}
            selectedNewsUserId={selectedNewsUserId}
            setSelectedNewsUserId={setSelectedNewsUserId}
          />
        );

      case 'services':
        return (
          <ServicesModuleContent
            {...commonProps}
            selectedServiceListing={selectedServiceListing}
            setSelectedServiceListing={setSelectedServiceListing}
          />
        );

      case 'marketplace':
        return (
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
        );

      case 'finance':
        return <FinanceModuleContent {...commonProps} />;

      case 'events':
        return (
          <EventsModuleContent
            {...commonProps}
            selectedGoodWillEventId={selectedGoodWillEventId}
            setSelectedGoodWillEventId={setSelectedGoodWillEventId}
          />
        );

      case 'journal':
        return (
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
        );

      default:
        return <div className="coming-soon-section"><h3>В разработке</h3></div>;
    }
  };

  return (
    <div className="app">
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
          setActiveView={handleSetActiveView}
          user={user}
          schoolRoles={schoolRoles}
          loadingSchoolRoles={loadingSchoolRoles}
          schoolRole={schoolRole}
          setSchoolRole={setSchoolRole}
          setSelectedSchool={setSelectedSchool}
          setSelectedChannelId={setSelectedChannelId}
        />

        {/* Central Content Area */}
        <main className="content-area">
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
                    className="module-pill" 
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
                  <button className="header-action-btn" title="Поиск">
                    <Search size={18} />
                  </button>
                  <button className="header-action-btn" title="Быстрое создание">
                    <Plus size={18} />
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
                    {!['my-profile', 'media-photos', 'media-documents', 'media-videos'].includes(activeView) && (
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

        {/* Right Sidebar */}
        <RightSidebar
          activeModule={activeModule}
          activeView={activeView}
          user={user}
          currentModule={currentModule}
          sidebarTintStyle={sidebarTintStyle}
          activeFilters={activeFilters}
          setActiveFilters={setActiveFilters}
          userFamily={userFamily}
          setActiveView={setActiveView}
          schoolRoles={schoolRoles}
          journalSchoolFilter={journalSchoolFilter}
          setJournalSchoolFilter={setJournalSchoolFilter}
          journalAudienceFilter={journalAudienceFilter}
          setJournalAudienceFilter={setJournalAudienceFilter}
          selectedSchool={selectedSchool}
          setSelectedSchool={setSelectedSchool}
          schoolRole={schoolRole}
          selectedOrganizationId={selectedOrganizationId}
          setSelectedOrganizationId={setSelectedOrganizationId}
          activeDepartmentId={activeDepartmentId}
          setActiveDepartmentId={setActiveDepartmentId}
          setShowDepartmentManager={setShowDepartmentManager}
          departmentRefreshTrigger={departmentRefreshTrigger}
          myOrganizations={myOrganizations}
          mediaStats={mediaStats}
          selectedModuleFilter={selectedModuleFilter}
          setSelectedModuleFilter={setSelectedModuleFilter}
          chatGroups={chatGroups}
          activeGroup={activeGroup}
          handleGroupSelect={handleGroupSelect}
          handleCreateGroup={handleCreateGroup}
          activeDirectChat={activeDirectChat}
          setActiveDirectChat={setActiveDirectChat}
          fetchChatGroups={fetchChatGroups}
        />
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
    </div>
  );
}

// Main App Component
function App() {
  const [authMode, setAuthMode] = useState('login');
  
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

  return <Dashboard />;
}

export default App;
