import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
// Auth Components - Extracted
import { AuthProvider, useAuth, ErrorBoundary, LoginForm, RegistrationForm, OnboardingWizard } from './components/auth';
// Layout Components
import { ModuleNavigation, LeftSidebar, RightSidebar } from './components/layout';
// Config
import { MODULES, getModuleByKey, getSidebarTintStyle, MODULE_DEFAULT_VIEWS, FAMILY_FILTER_OPTIONS } from './config/moduleConfig';
// Hooks
import { useJournalModule } from './hooks';
// Feature Components
import UniversalChatLayout from './components/UniversalChatLayout';
import ChatGroupList from './components/ChatGroupList';
import UniversalCalendar from './components/UniversalCalendar';
import UniversalWall from './components/UniversalWall';
import ContentNavigation from './components/ContentNavigation';
import UniversalEventsPanel from './components/UniversalEventsPanel';
import NewsEventsPanel from './components/NewsEventsPanel';
import MediaStorage from './components/MediaStorage';
import MyProfile from './components/MyProfile';
// NEW FAMILY SYSTEM COMPONENTS
import ProfileCompletionModal from './components/ProfileCompletionModal';
import FamilyTriggerFlow from './components/FamilyTriggerFlow';
import MyFamilyProfile from './components/MyFamilyProfile';
import PublicFamilyProfile from './components/PublicFamilyProfile';
import GenderUpdateModal from './components/GenderUpdateModal';
import FamilyProfileList from './components/FamilyProfileList';
import FamilyProfileCreation from './components/FamilyProfileCreation';
import FamilyProfilePage from './components/FamilyProfilePage';
import FamilyInvitationModal from './components/FamilyInvitationModal';
import InvitationManager from './components/InvitationManager';
// MY INFO MODULE COMPONENTS
import MyInfoPage from './components/MyInfoPage';
import MyDocumentsPage from './components/MyDocumentsPage';
import FamilySetupPage from './components/FamilySetupPage';
// PEOPLE DISCOVERY
import PeopleDiscovery from './components/PeopleDiscovery';
// SCHOOL MODULE COMPONENTS
import SchoolDashboard from './components/SchoolDashboard';
import ParentChildrenDashboard from './components/ParentChildrenDashboard';
import SchoolEnrollment from './components/SchoolEnrollment';
import SchoolFinder from './components/SchoolFinder';
import MySchoolsList from './components/MySchoolsList';
import SchoolTiles from './components/SchoolTiles';
// WorldZone components are now imported inside RightSidebar
import AcademicCalendar from './components/AcademicCalendar';
import EventPlanner from './components/EventPlanner';
import ClassSchedule from './components/ClassSchedule';
import StudentGradebook from './components/StudentGradebook';
import MyClassesList from './components/MyClassesList';
import StudentsList from './components/StudentsList';
// WORK MODULE COMPONENTS
import WorkTriggerFlow from './components/WorkTriggerFlow';
import WorkSetupPage from './components/WorkSetupPage';
import WorkOrganizationList from './components/WorkOrganizationList';
import WorkOrganizationProfile from './components/WorkOrganizationProfile';
import WorkSearchOrganizations from './components/WorkSearchOrganizations';
import WorkJoinRequests from './components/WorkJoinRequests';
import WorkOrganizationPublicProfile from './components/WorkOrganizationPublicProfile';
// WorkDepartmentNavigator and WorkAnnouncementsWidget are now imported inside RightSidebar
// SCHOOL/TEACHER COMPONENTS
import TeacherProfileForm from './components/TeacherProfileForm';
import TeacherDirectory from './components/TeacherDirectory';
import WorkAnnouncementsList from './components/WorkAnnouncementsList';
import WorkDepartmentManager from './components/WorkDepartmentManager';
import WorkDepartmentManagementPage from './components/WorkDepartmentManagementPage';
// WorkNextEventWidget, WorkUpcomingEventsList, WorkCalendarWidget are now imported inside RightSidebar
// NEWS MODULE COMPONENTS
import FriendsPage from './components/FriendsPage';
import ChannelsPage from './components/ChannelsPage';
import NewsFeed from './components/NewsFeed';
import ChannelView from './components/ChannelView';
import NewsUserProfile from './components/NewsUserProfile';  // NEW: User profile in News context
// SERVICES MODULE COMPONENTS
import { 
  ServicesSearch, 
  ServiceProviderProfile, 
  ServiceBookingModal,
  ServicesMyProfile,
  ServicesBookings,
  ServiceBookingCalendar,
  ServicesReviews
} from './components/services';
// MARKETPLACE MODULE COMPONENTS (ВЕЩИ)
import {
  MarketplaceSearch,
  MarketplaceProductCard,
  MarketplaceProductDetail,
  MarketplaceListingForm,
  MyListings,
  MarketplaceFavorites,
  MyThings,
  MyThingsItemForm
} from './components/marketplace';
// FINANCES MODULE COMPONENTS (ФИНАНСЫ)
import { WalletDashboard } from './components/finances';
// GOOD WILL MODULE COMPONENTS (ДОБРАЯ ВОЛЯ)
import {
  GoodWillSearch,
  GoodWillEventCard,
  GoodWillEventDetail,
  GoodWillEventForm,
  GoodWillCalendar,
  GoodWillOrganizerProfile,
  GoodWillMyEvents,
  GoodWillInvitations,
  GoodWillGroups
} from './components/goodwill';
// ERIC AI ASSISTANT
import { ERICChatWidget, ERICProfile } from './components/eric';
import { 
  Search, Bell, ChevronRight, Plus, GraduationCap, Briefcase
} from 'lucide-react';
// Auth components moved to ./components/auth

// Main Dashboard Component
function Dashboard() {
  const [activeModule, setActiveModule] = useState('family');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedModuleFilter, setSelectedModuleFilter] = useState('all');
  const [mediaStats, setMediaStats] = useState({});
  const [chatGroups, setChatGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [activeDirectChat, setActiveDirectChat] = useState(null); // For direct message chats
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [showCalendar, setShowCalendar] = useState(false);
  const [activeView, setActiveView] = useState('wall'); // 'wall' or 'chat'
  const [notifications, setNotifications] = useState([]); // For header notifications badge
  const [userFamily, setUserFamily] = useState(null); // User's primary family
  const [activeFilters, setActiveFilters] = useState([]); // Unified stacked filters array
  const [loadingFamily, setLoadingFamily] = useState(true);
  
  // Work Module State
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(null);
  const [workSetupMode, setWorkSetupMode] = useState('choice'); // 'choice', 'search', 'create'
  const [activeDepartmentId, setActiveDepartmentId] = useState(null);
  const [showDepartmentManager, setShowDepartmentManager] = useState(false);
  const [departmentRefreshTrigger, setDepartmentRefreshTrigger] = useState(0);
  const [myOrganizations, setMyOrganizations] = useState([]);
  
  // Good Will Module State (Добрая Воля)
  const [selectedGoodWillEventId, setSelectedGoodWillEventId] = useState(null);
  
  // Setup window function for opening full department management
  useEffect(() => {
    window.openDepartmentManagement = () => {
      setActiveView('work-department-management');
    };
    return () => {
      delete window.openDepartmentManagement;
    };
  }, []);
  const [viewingPublicOrgId, setViewingPublicOrgId] = useState(null); // For public profile view
  
  // News Module State
  const [selectedChannelId, setSelectedChannelId] = useState(null);
  const [selectedNewsUserId, setSelectedNewsUserId] = useState(null);  // NEW: For viewing user profiles in News
  
  // Services Module State
  const [selectedServiceListing, setSelectedServiceListing] = useState(null);
  
  // Marketplace Module State (ВЕЩИ)
  const [selectedMarketplaceProduct, setSelectedMarketplaceProduct] = useState(null);
  const [editMarketplaceProduct, setEditMarketplaceProduct] = useState(null);
  const [selectedInventoryCategory, setSelectedInventoryCategory] = useState(null);
  const [editInventoryItem, setEditInventoryItem] = useState(null);
  const [listForSaleItem, setListForSaleItem] = useState(null);
  
  // Track last active view per module to preserve navigation state
  const [moduleViewHistory, setModuleViewHistory] = useState({});
  
  // Removed showProfileCompletionModal state - now using full-page FamilySetupPage
  const [showGenderModal, setShowGenderModal] = useState(false);
  
  // Family Module State
  const [selectedFamilyId, setSelectedFamilyId] = useState(null);
  const [selectedFamilyForInvitation, setSelectedFamilyForInvitation] = useState(null);
  const [showInvitationModal, setShowInvitationModal] = useState(false);
  
  const { user, logout, refreshProfile } = useAuth();

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

  // Get current module config
  const currentModule = getModuleByKey(activeModule);
  const sidebarTintStyle = getSidebarTintStyle(currentModule.color);

  // Load user's primary family
  useEffect(() => {
    const loadUserFamily = async () => {
      console.log('[DEBUG] loadUserFamily called', { user: !!user, activeModule });
      
      if (!user || activeModule !== 'family') {
        console.log('[DEBUG] Skipping family load:', { user: !!user, activeModule });
        setLoadingFamily(false);
        return;
      }
      
      try {
        const token = localStorage.getItem('zion_token');
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/family-profiles`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        console.log('[DEBUG] Family API response status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('[DEBUG] Family data received:', data);
          const families = data.family_profiles || [];
          console.log('[DEBUG] Families count:', families.length);
          // Find primary family (where user is creator or first family)
          const primaryFamily = families.find(f => f.user_role === 'PARENT' || f.is_user_member) || families[0];
          console.log('[DEBUG] Primary family selected:', primaryFamily);
          setUserFamily(primaryFamily);
        }
      } catch (error) {
        console.error('[DEBUG] Error loading family:', error);
      } finally {
        setLoadingFamily(false);
      }
    };
    
    loadUserFamily();
  }, [user, activeModule]);

  // Removed automatic profile completion modal - user will access via МОЯ СЕМЬЯ button
  // Family profile creation now happens on-demand when clicking МОЯ СЕМЬЯ

  // Check if user needs to set gender (MANDATORY first time, never again after set)
  useEffect(() => {
    if (user) {
      const hasAskedGender = localStorage.getItem(`gender_asked_${user.id}`);
      
      // Only show modal if gender is not set AND we haven't asked before
      // Once user sets gender, user.gender will exist and modal never shows again
      if (!user.gender && !hasAskedGender) {
        setShowGenderModal(true);
      } else {
        setShowGenderModal(false);
      }
    }
  }, [user]);

  // Check if user needs onboarding (no affiliations and not yet completed)
  // TEMPORARILY DISABLED - Will re-enable later
  useEffect(() => {
    if (user) {
      // ONBOARDING DISABLED FOR NOW
      setShowOnboarding(false);
      
      // Original logic (commented out for now):
      // const onboardingCompleted = localStorage.getItem(`onboarding_completed_${user.id}`);
      // if (!onboardingCompleted && (!user.affiliations || user.affiliations.length === 0)) {
      //   setShowOnboarding(true);
      // } else {
      //   setShowOnboarding(false);
      // }
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

  // Fetch media statistics for right sidebar
  const fetchMediaStats = async () => {
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
        
        // Convert nested structure to simple counts
        const simpleCounts = {};
        let totalCount = 0;
        
        // Backend to Frontend module mapping
        const backendToFrontendModuleMap = {
          'family': 'family',
          'community': 'news',
          'personal': 'journal',
          'business': 'services',
          'work': 'organizations',
          'education': 'journal',
          'health': 'journal',
          'government': 'organizations'
        };
        
        // Initialize all frontend modules with 0
        const frontendModules = ['family', 'news', 'journal', 'services', 'organizations', 'marketplace', 'finance', 'events'];
        frontendModules.forEach(module => {
          simpleCounts[module] = 0;
        });
        
        // Count files from backend modules
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
        
        // Set total count
        simpleCounts['all'] = totalCount;
        
        setMediaStats(simpleCounts);
      }
    } catch (error) {
      console.error('Error fetching media stats:', error);
    }
  };

  const fetchChatGroups = async () => {
    setLoadingGroups(true);
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/chat-groups`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setChatGroups(data.chat_groups || []);
        
        // Auto-select first family group if available
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
  };

  // Load chat groups and fetch media stats when dashboard loads
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (user) {
      fetchChatGroups();
      fetchMediaStats();
    }
  }, [user]);

  const handleGroupSelect = (groupData) => {
    setActiveGroup(groupData);
  };

  const handleCreateGroup = () => {
    fetchChatGroups(); // Refresh groups after creation
  };

  const handleUpdateUser = (updatedUserData) => {
    // Update user context with new data
    // This would be handled by your auth context
  };

  if (showOnboarding) {
    return <OnboardingWizard onComplete={async () => {
      // Mark onboarding as completed for this user
      if (user?.id) {
        localStorage.setItem(`onboarding_completed_${user.id}`, 'true');
      }
      // Wait a tick to ensure localStorage is written
      await new Promise(resolve => setTimeout(resolve, 100));
      setShowOnboarding(false);
    }} />;
  }

  const getUserAffiliationsByType = (type) => {
    if (!user.affiliations) return [];
    return user.affiliations.filter(a => a.affiliation.type === type);
  };

  // Custom setActiveView that also tracks module history
  const handleSetActiveView = (view) => {
    setActiveView(view);
    // Save this view for the current module
    setModuleViewHistory(prev => ({
      ...prev,
      [activeModule]: view
    }));
  };

  return (
    <div className="app">
      {/* Top Navigation Bar - Using extracted component */}
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
        {/* Left Sidebar - Using extracted component */}
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
          {/* Show Calendar when active */}
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
                  {/* Modern Pill Badge for Module */}
                  <span 
                    className="module-pill" 
                    style={{ 
                      background: `linear-gradient(135deg, ${currentModule.color} 0%, ${currentModule.color}dd 100%)`,
                      boxShadow: `0 4px 12px ${currentModule.color}30, 0 1px 3px ${currentModule.color}20`
                    }}
                  >
                    {currentModule.name}
                  </span>
                  
                  {/* Current View with Arrow */}
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
                  {/* Quick Actions */}
                  <button 
                    className="header-action-btn"
                    onClick={() => {/* Add search functionality */}}
                    title="Поиск"
                  >
                    <Search size={18} />
                  </button>
                  <button 
                    className="header-action-btn primary"
                    onClick={() => {
                      // TODO: Open post creation modal
                      console.log('Create post clicked');
                    }}
                    title="Создать пост"
                    style={{ 
                      background: `linear-gradient(135deg, ${currentModule.color} 0%, ${currentModule.color}dd 100%)`,
                      color: 'white'
                    }}
                  >
                    <Plus size={18} />
                  </button>
                  <button 
                    className="header-action-btn"
                    onClick={() => {/* Show notifications */}}
                    title="Уведомления"
                  >
                    <Bell size={18} />
                    {notifications.length > 0 && (
                      <span className="notification-badge">{notifications.length}</span>
                    )}
                  </button>
                </div>
              </div>
              
              <div className="content-body">
                {/* Content Navigation - Hide for special views that have their own navigation */}
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

                {/* Content Area with Split Layout */}
                <div className="split-content-layout">
                  {/* Main Content Area */}
                  <div className={`main-content-area ${(activeView === 'my-profile' || activeView === 'media-photos' || activeView === 'media-documents' || activeView === 'media-videos' || activeView === 'school-my-children' || activeView === 'school-enrollment' || activeView === 'school-find' || activeView === 'family-profiles' || activeView === 'family-create' || activeView === 'family-view' || activeView === 'family-invitations' || activeView === 'my-info' || activeView === 'my-documents' || activeModule === 'organizations' || (activeModule === 'news' && activeView !== 'wall' && activeView !== 'feed') || (activeModule === 'services' && activeView !== 'services-feed') || (activeModule === 'marketplace' && activeView !== 'wall' && activeView !== 'feed') || activeModule === 'finance' || activeModule === 'events' || (activeModule === 'journal' && selectedSchool) || activeView === 'event-planner' || activeView === 'journal-calendar') ? 'full-width' : ''}`}>
                    
                    {/* Family Profile Views - Full Width */}
                    {activeView === 'family-profiles' ? (
                      <FamilyProfileList
                        onCreateFamily={() => setActiveView('family-create')}
                        onViewFamily={(familyId) => {
                          setSelectedFamilyId(familyId);
                          setActiveView('family-view');
                        }}
                        onManageFamily={(familyId) => {
                          setSelectedFamilyId(familyId);
                          setActiveView('family-manage');
                        }}
                      />
                    ) : activeView === 'family-create' ? (
                      <FamilyProfileCreation
                        onBack={() => setActiveView('family-profiles')}
                        onFamilyCreated={() => setActiveView('family-profiles')}
                      />
                    ) : activeView === 'family-view' ? (
                      <FamilyProfilePage
                        familyId={selectedFamilyId}
                        currentUser={user}
                        onBack={() => setActiveView('family-profiles')}
                        onInviteMember={(familyId, familyName) => {
                          setSelectedFamilyForInvitation({ id: familyId, name: familyName });
                          setShowInvitationModal(true);
                        }}
                      />
                    ) : activeView === 'family-invitations' ? (
                      <InvitationManager
                        currentUser={user}
                      />
                    ) : /* MY PROFILE - Dynamic Profile View */
                    activeView === 'my-profile' ? (
                      <MyProfile 
                        user={user} 
                        activeModule={activeModule}
                        moduleColor={currentModule.color}
                      />
                    ) : /* Media Storage Views - Full Width */
                    (activeView === 'media-photos' || activeView === 'media-documents' || activeView === 'media-videos') ? (
                      <MediaStorage
                        mediaType={activeView === 'media-photos' ? 'photos' : 
                                   activeView === 'media-documents' ? 'documents' : 'videos'}
                        user={user}
                        activeModule={activeModule}
                        moduleColor={currentModule.color}
                        selectedModuleFilter={selectedModuleFilter}
                        onModuleFilterChange={setSelectedModuleFilter}
                        onModuleCountsUpdate={setMediaStats}
                      />
                    ) : /* SCHOOL Module Views - Full Width */
                    activeView === 'school-my-children' ? (
                      <ParentChildrenDashboard />
                    ) : activeView === 'school-enrollment' ? (
                      <SchoolEnrollment />
                    ) : activeView === 'school-find' ? (
                      <SchoolFinder />
                    ) : /* MY INFO Module Views */
                    activeView === 'my-info' ? (
                      <MyInfoPage 
                        user={user} 
                        moduleColor={currentModule.color} 
                        onProfileUpdate={refreshProfile}
                      />
                    ) : activeView === 'my-documents' ? (
                      <MyDocumentsPage />
                    ) : (
                      <>
                        {activeModule === 'family' && (
                          <>
                            {/* Feed and Wall views - show UniversalWall only */}
                            {(activeView === 'wall' || activeView === 'feed') ? (
                              <UniversalWall
                                activeGroup={activeGroup}
                                moduleColor={currentModule.color}
                                moduleName={currentModule.name}
                                activeModule={activeModule}
                                user={user}
                                activeFilters={activeFilters}
                                userFamilyId={userFamily?.id}
                              />
                            ) : activeView === 'my-family-profile' ? (
                              /* My Family Profile view - or setup if no family */
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
                                      // Refresh family data
                                      setUserFamily(newFamily);
                                      // Refresh user profile
                                      await refreshProfile();
                                      // Stay on family profile view
                                      setActiveView('my-family-profile');
                                    }}
                                  />
                                )}
                              </ErrorBoundary>
                            ) : activeView === 'family-public-view' ? (
                              /* Public Family Profile view */
                              <ErrorBoundary>
                                <PublicFamilyProfile
                                  user={user}
                                  familyId={userFamily?.id}
                                  onBack={() => setActiveView('my-family-profile')}
                                  moduleColor={currentModule.color}
                                />
                              </ErrorBoundary>
                            ) : (
                              /* Chat view */
                              <UniversalChatLayout
                                activeGroup={activeGroup}
                                activeDirectChat={activeDirectChat}
                                chatGroups={chatGroups}
                                onGroupSelect={handleGroupSelect}
                                moduleColor={currentModule.color}
                                onCreateGroup={handleCreateGroup}
                                user={user}
                              />
                            )}
                          </>
                        )}

                        {activeModule === 'organizations' && (
                          <>
                            {/* MY WORK View */}
                            {activeView === 'my-work' ? (
                              <ErrorBoundary>
                                <WorkOrganizationList
                                  onOrgClick={(orgId) => {
                                    console.log('WorkOrganizationList onOrgClick called with orgId:', orgId);
                                    setSelectedOrganizationId(orgId);
                                    setActiveView('work-org-profile');
                                  }}
                                  onCreateNew={() => {
                                    setWorkSetupMode('choice');
                                    setActiveView('work-setup');
                                  }}
                                  onJoinOrg={() => {
                                    setActiveView('work-search');
                                  }}
                                  onViewRequests={() => {
                                    setActiveView('work-requests');
                                  }}
                                  onExploreFeed={() => setActiveView('feed')}
                                />
                              </ErrorBoundary>
                            ) : activeView === 'work-search' ? (
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
                            ) : activeView === 'work-org-public-view' ? (
                              <ErrorBoundary>
                                <WorkOrganizationPublicProfile
                                  organizationId={viewingPublicOrgId}
                                  currentUserId={user?.id}
                                  onBack={() => setActiveView('work-search')}
                                  moduleColor={currentModule.color}
                                />
                              </ErrorBoundary>
                            ) : activeView === 'work-requests' ? (
                              <ErrorBoundary>
                                <WorkJoinRequests
                                  onBack={() => setActiveView('my-work')}
                                  onViewProfile={(orgId) => {
                                    setSelectedOrganizationId(orgId);
                                    setActiveView('work-org-profile');
                                  }}
                                />
                              </ErrorBoundary>
                            ) : activeView === 'work-setup' ? (
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
                            ) : activeView === 'work-trigger' ? (
                              <ErrorBoundary>
                                <WorkTriggerFlow
                                  onCreateOrg={() => {
                                    setWorkSetupMode('create');
                                    setActiveView('work-setup');
                                  }}
                                  onJoinOrg={() => {
                                    setActiveView('work-search');
                                  }}
                                />
                              </ErrorBoundary>
                            ) : activeView === 'work-org-profile' ? (
                              <ErrorBoundary>
                                <WorkOrganizationProfile
                                  organizationId={selectedOrganizationId}
                                  onBack={() => setActiveView('my-work')}
                                  onInviteMember={(orgId, orgName) => {
                                    // TODO: Open invite modal
                                    alert(`Invite members to ${orgName} (Coming soon)`);
                                  }}
                                  onSettings={(orgId) => {
                                    // TODO: Navigate to settings
                                    alert('Organization settings (Coming soon)');
                                  }}
                                />
                              </ErrorBoundary>
                            ) : activeView === 'work-announcements' ? (
                              <ErrorBoundary>
                                <WorkAnnouncementsList
                                  organizationId={selectedOrganizationId}
                                  onBack={() => setActiveView('wall')}
                                  currentUserId={user?.id}
                                  moduleColor={currentModule.color}
                                />
                              </ErrorBoundary>
                            ) : activeView === 'work-department-management' ? (
                              <ErrorBoundary>
                                <WorkDepartmentManagementPage
                                  organizationId={selectedOrganizationId}
                                  onBack={() => setActiveView('wall')}
                                  moduleColor={currentModule.color}
                                />
                              </ErrorBoundary>
                            ) : activeView === 'my-school' ? (
                              <ErrorBoundary>
                                <SchoolDashboard
                                  onViewChildren={() => setActiveView('school-my-children')}
                                  onFindSchool={() => setActiveView('school-find')}
                                  onEnrollmentRequest={() => setActiveView('school-enrollment')}
                                  onViewMySchools={() => setActiveView('school-my-schools')}
                                />
                              </ErrorBoundary>
                            ) : activeView === 'school-my-children' ? (
                              <ErrorBoundary>
                                <ParentChildrenDashboard />
                              </ErrorBoundary>
                            ) : activeView === 'school-find' ? (
                              <ErrorBoundary>
                                <SchoolFinder />
                              </ErrorBoundary>
                            ) : activeView === 'school-enrollment' ? (
                              <ErrorBoundary>
                                <SchoolEnrollment />
                              </ErrorBoundary>
                            ) : activeView === 'school-my-schools' ? (
                              <ErrorBoundary>
                                <MySchoolsList 
                                  onBack={() => setActiveView('my-school')}
                                  onSchoolClick={(schoolId) => {
                                    // Future: Navigate to school details
                                    console.log('School clicked:', schoolId);
                                  }}
                                />
                              </ErrorBoundary>
                            ) : activeView === 'my-school-admin' ? (
                              <ErrorBoundary>
                                <SchoolDashboard
                                  onViewChildren={() => setActiveView('school-my-children')}
                                  onFindSchool={() => setActiveView('school-find')}
                                  onEnrollmentRequest={() => setActiveView('school-enrollment')}
                                  onViewMySchools={() => setActiveView('school-my-schools')}
                                />
                              </ErrorBoundary>
                            ) : activeView === 'school-my-children' ? (
                              <ErrorBoundary>
                                <ParentChildrenDashboard />
                              </ErrorBoundary>
                            ) : activeView === 'school-find' ? (
                              <ErrorBoundary>
                                <SchoolFinder />
                              </ErrorBoundary>
                            ) : activeView === 'school-enrollment' ? (
                              <ErrorBoundary>
                                <SchoolEnrollment />
                              </ErrorBoundary>
                            ) : (activeView === 'wall' || activeView === 'feed') ? (
                              <UniversalWall
                                activeGroup={activeGroup}
                                moduleColor={currentModule.color}
                                moduleName={currentModule.name}
                                activeModule={activeModule}
                                user={user}
                              />
                            ) : (
                              <UniversalChatLayout
                                activeGroup={activeGroup}
                                activeDirectChat={activeDirectChat}
                                chatGroups={chatGroups}
                                onGroupSelect={handleGroupSelect}
                                moduleColor={currentModule.color}
                                onCreateGroup={handleCreateGroup}
                                user={user}
                              />
                            )}
                          </>
                        )}

                        {(activeModule === 'news') && (
                          <>
                            {/* News Feed View */}
                            {(activeView === 'wall' || activeView === 'feed') && !selectedChannelId && (
                              <NewsFeed
                                user={user}
                                moduleColor={currentModule.color}
                              />
                            )}

                            {/* Channel View */}
                            {activeView === 'channel-view' && selectedChannelId && (
                              <ChannelView
                                channelId={selectedChannelId}
                                user={user}
                                moduleColor={currentModule.color}
                                onBack={() => {
                                  setSelectedChannelId(null);
                                  setActiveView('channels');
                                }}
                              />
                            )}

                            {/* User Profile View in News */}
                            {activeView === 'news-user-profile' && selectedNewsUserId && (
                              <NewsUserProfile
                                userId={selectedNewsUserId}
                                user={user}
                                moduleColor={currentModule.color}
                                onBack={() => {
                                  setSelectedNewsUserId(null);
                                  setActiveView('feed');
                                }}
                                onOpenChat={(person) => {
                                  // TODO: Open chat with person
                                  console.log('Open chat with', person);
                                }}
                              />
                            )}
                            
                            {/* Friends Page */}
                            {(activeView === 'friends' || activeView === 'followers' || activeView === 'following') && (
                              <FriendsPage
                                user={user}
                                moduleColor={currentModule.color}
                                initialTab={activeView === 'followers' ? 'followers' : activeView === 'following' ? 'following' : 'friends'}
                                onBack={() => setActiveView('feed')}
                                onOpenChat={(person) => {
                                  // TODO: Open chat with person
                                  console.log('Open chat with', person);
                                }}
                              />
                            )}
                            
                            {/* Channels Page */}
                            {activeView === 'channels' && !selectedChannelId && (
                              <ChannelsPage
                                user={user}
                                moduleColor={currentModule.color}
                                onViewChannel={(channel) => {
                                  setSelectedChannelId(channel.id);
                                  setActiveView('channel-view');
                                }}
                              />
                            )}
                            
                            {/* People Discovery Page */}
                            {activeView === 'people-discovery' && (
                              <PeopleDiscovery
                                user={user}
                                moduleColor={currentModule.color}
                                onNavigateToProfile={(person) => {
                                  setSelectedNewsUserId(person.id);
                                  setActiveView('news-user-profile');
                                }}
                                onClose={() => setActiveView('feed')}
                              />
                            )}
                            
                            {/* Chat View */}
                            {activeView === 'chat' && (
                              <UniversalChatLayout
                                activeGroup={activeGroup}
                                activeDirectChat={activeDirectChat}
                                chatGroups={chatGroups}
                                onGroupSelect={handleGroupSelect}
                                moduleColor={currentModule.color}
                                onCreateGroup={handleCreateGroup}
                                user={user}
                              />
                            )}
                          </>
                        )}

                        {/* SERVICES MODULE */}
                        {activeModule === 'services' && (
                          <>
                            {activeView === 'services-search' || activeView === 'wall' || activeView === 'feed' ? (
                              <ServicesSearch
                                user={user}
                                moduleColor={currentModule.color}
                                onViewListing={(listing) => {
                                  setSelectedServiceListing(listing);
                                  setActiveView('services-listing-detail');
                                }}
                              />
                            ) : activeView === 'services-listing-detail' && selectedServiceListing ? (
                              <ServiceProviderProfile
                                listing={selectedServiceListing}
                                onBack={() => setActiveView('services-search')}
                                onBookAppointment={(listing) => {
                                  setSelectedServiceListing(listing);
                                  setActiveView('services-booking-calendar');
                                }}
                                onViewReviews={(listing) => {
                                  setSelectedServiceListing(listing);
                                  setActiveView('services-reviews');
                                }}
                                moduleColor={currentModule.color}
                                user={user}
                              />
                            ) : activeView === 'services-my-profile' ? (
                              <ServicesMyProfile
                                user={user}
                                moduleColor={currentModule.color}
                                onViewListing={(listing) => {
                                  setSelectedServiceListing(listing);
                                  setActiveView('services-listing-detail');
                                }}
                              />
                            ) : activeView === 'services-bookings' ? (
                              <ServicesBookings
                                user={user}
                                moduleColor={currentModule.color}
                              />
                            ) : activeView === 'services-calendar' ? (
                              <ServiceBookingCalendar
                                user={user}
                                isProvider={true}
                                moduleColor={currentModule.color}
                                onBack={() => setActiveView('services-my-profile')}
                              />
                            ) : activeView === 'services-booking-calendar' && selectedServiceListing ? (
                              <ServiceBookingCalendar
                                user={user}
                                serviceId={selectedServiceListing.id}
                                serviceName={selectedServiceListing.name}
                                isProvider={false}
                                moduleColor={currentModule.color}
                                onBack={() => setActiveView('services-listing-detail')}
                                onBookingCreated={() => {
                                  // Show success feedback
                                }}
                              />
                            ) : activeView === 'services-reviews' && selectedServiceListing ? (
                              <ServicesReviews
                                serviceId={selectedServiceListing.id}
                                serviceName={selectedServiceListing.name}
                                user={user}
                                isProvider={false}
                                moduleColor={currentModule.color}
                                onBack={() => setActiveView('services-listing-detail')}
                              />
                            ) : activeView === 'services-feed' ? (
                              <UniversalWall
                                activeGroup={activeGroup}
                                moduleColor={currentModule.color}
                                moduleName={currentModule.name}
                                activeModule={activeModule}
                                user={user}
                              />
                            ) : (
                              <div className="coming-soon-section">
                                <h3>🚧 В разработке</h3>
                                <p>Этот раздел скоро будет доступен</p>
                              </div>
                            )}
                          </>
                        )}

                        {/* MARKETPLACE MODULE (ВЕЩИ) */}
                        {activeModule === 'marketplace' && (
                          <>
                            {/* Marketplace Search/Browse */}
                            {(activeView === 'marketplace-search' || activeView === 'wall' || activeView === 'feed') && !selectedMarketplaceProduct && (
                              <MarketplaceSearch
                                user={user}
                                token={localStorage.getItem('zion_token')}
                                moduleColor={currentModule.color}
                                onViewProduct={(product) => {
                                  setSelectedMarketplaceProduct(product);
                                  setActiveView('marketplace-product-detail');
                                }}
                                onCreateListing={() => {
                                  setEditMarketplaceProduct(null);
                                  setActiveView('marketplace-create-listing');
                                }}
                              />
                            )}

                            {/* Product Detail */}
                            {activeView === 'marketplace-product-detail' && selectedMarketplaceProduct && (
                              <MarketplaceProductDetail
                                productId={selectedMarketplaceProduct.id}
                                token={localStorage.getItem('zion_token')}
                                moduleColor={currentModule.color}
                                onBack={() => {
                                  setSelectedMarketplaceProduct(null);
                                  setActiveView('marketplace-search');
                                }}
                                onContactSeller={(product) => {
                                  // TODO: Open chat with seller
                                  console.log('Contact seller:', product.seller_id);
                                }}
                              />
                            )}

                            {/* Create/Edit Listing */}
                            {activeView === 'marketplace-create-listing' && (
                              <MarketplaceListingForm
                                user={user}
                                token={localStorage.getItem('zion_token')}
                                moduleColor={currentModule.color}
                                editProduct={editMarketplaceProduct}
                                onBack={() => {
                                  setEditMarketplaceProduct(null);
                                  setActiveView('marketplace-my-listings');
                                }}
                                onSuccess={() => {
                                  setEditMarketplaceProduct(null);
                                  setActiveView('marketplace-my-listings');
                                }}
                              />
                            )}

                            {/* My Listings */}
                            {activeView === 'marketplace-my-listings' && (
                              <MyListings
                                token={localStorage.getItem('zion_token')}
                                moduleColor={currentModule.color}
                                onCreateNew={() => {
                                  setEditMarketplaceProduct(null);
                                  setActiveView('marketplace-create-listing');
                                }}
                                onEdit={(product) => {
                                  setEditMarketplaceProduct(product);
                                  setActiveView('marketplace-create-listing');
                                }}
                                onViewProduct={(product) => {
                                  setSelectedMarketplaceProduct(product);
                                  setActiveView('marketplace-product-detail');
                                }}
                              />
                            )}

                            {/* Favorites */}
                            {activeView === 'marketplace-favorites' && (
                              <MarketplaceFavorites
                                token={localStorage.getItem('zion_token')}
                                moduleColor={currentModule.color}
                                onViewProduct={(product) => {
                                  setSelectedMarketplaceProduct(product);
                                  setActiveView('marketplace-product-detail');
                                }}
                              />
                            )}

                            {/* ERIC AI Assistant */}
                            {activeView === 'eric-ai' && (
                              <ERICProfile user={user} />
                            )}

                            {/* My Things - Main Dashboard or Category View */}
                            {(activeView === 'my-things' || 
                              activeView === 'my-things-smart' || 
                              activeView === 'my-things-wardrobe' ||
                              activeView === 'my-things-garage' ||
                              activeView === 'my-things-home' ||
                              activeView === 'my-things-electronics' ||
                              activeView === 'my-things-collection') && !editInventoryItem && !listForSaleItem && (
                              <MyThings
                                user={user}
                                token={localStorage.getItem('zion_token')}
                                moduleColor={currentModule.color}
                                selectedCategory={
                                  activeView === 'my-things-smart' ? 'smart_things' :
                                  activeView === 'my-things-wardrobe' ? 'wardrobe' :
                                  activeView === 'my-things-garage' ? 'garage' :
                                  activeView === 'my-things-home' ? 'home' :
                                  activeView === 'my-things-electronics' ? 'electronics' :
                                  activeView === 'my-things-collection' ? 'collection' :
                                  selectedInventoryCategory
                                }
                                onCategoryChange={(category) => {
                                  setSelectedInventoryCategory(category);
                                  if (category) {
                                    const viewMap = {
                                      smart_things: 'my-things-smart',
                                      wardrobe: 'my-things-wardrobe',
                                      garage: 'my-things-garage',
                                      home: 'my-things-home',
                                      electronics: 'my-things-electronics',
                                      collection: 'my-things-collection'
                                    };
                                    setActiveView(viewMap[category] || 'my-things');
                                  } else {
                                    setActiveView('my-things');
                                  }
                                }}
                                onAddItem={() => {
                                  setEditInventoryItem(null);
                                  setActiveView('my-things-add-item');
                                }}
                                onViewItem={(item) => {
                                  setEditInventoryItem(item);
                                  setActiveView('my-things-add-item');
                                }}
                                onEditItem={(item) => {
                                  setEditInventoryItem(item);
                                  setActiveView('my-things-add-item');
                                }}
                                onListForSale={(item) => {
                                  setListForSaleItem(item);
                                }}
                              />
                            )}

                            {/* Add/Edit Inventory Item */}
                            {activeView === 'my-things-add-item' && (
                              <MyThingsItemForm
                                token={localStorage.getItem('zion_token')}
                                moduleColor={currentModule.color}
                                editItem={editInventoryItem}
                                defaultCategory={selectedInventoryCategory}
                                onBack={() => {
                                  setEditInventoryItem(null);
                                  const viewMap = {
                                    smart_things: 'my-things-smart',
                                    wardrobe: 'my-things-wardrobe',
                                    garage: 'my-things-garage',
                                    home: 'my-things-home',
                                    electronics: 'my-things-electronics',
                                    collection: 'my-things-collection'
                                  };
                                  setActiveView(viewMap[selectedInventoryCategory] || 'my-things');
                                }}
                                onSuccess={() => {
                                  setEditInventoryItem(null);
                                  const viewMap = {
                                    smart_things: 'my-things-smart',
                                    wardrobe: 'my-things-wardrobe',
                                    garage: 'my-things-garage',
                                    home: 'my-things-home',
                                    electronics: 'my-things-electronics',
                                    collection: 'my-things-collection'
                                  };
                                  setActiveView(viewMap[selectedInventoryCategory] || 'my-things');
                                }}
                              />
                            )}
                          </>
                        )}

                        {/* FINANCE MODULE - ALTYN Banking System */}
                        {activeModule === 'finance' && (
                          <>
                            {(activeView === 'wallet' || activeView === 'wall' || activeView === 'feed') ? (
                              <WalletDashboard
                                user={user}
                                moduleColor={currentModule.color}
                              />
                            ) : (
                              <WalletDashboard
                                user={user}
                                moduleColor={currentModule.color}
                              />
                            )}
                          </>
                        )}

                        {activeModule === 'events' && (
                          <>
                            {/* Good Will Module - Добрая Воля */}
                            {activeView === 'goodwill-search' && (
                              <GoodWillSearch
                                token={localStorage.getItem('zion_token')}
                                moduleColor={currentModule.color}
                                onSelectEvent={(event) => {
                                  setSelectedGoodWillEventId(event.id);
                                  setActiveView('goodwill-event-detail');
                                }}
                              />
                            )}
                            
                            {activeView === 'goodwill-event-detail' && selectedGoodWillEventId && (
                              <GoodWillEventDetail
                                eventId={selectedGoodWillEventId}
                                token={localStorage.getItem('zion_token')}
                                moduleColor={currentModule.color}
                                onBack={() => setActiveView('goodwill-search')}
                                currentUser={user}
                              />
                            )}
                            
                            {activeView === 'goodwill-calendar' && (
                              <GoodWillCalendar
                                token={localStorage.getItem('zion_token')}
                                moduleColor={currentModule.color}
                                onSelectEvent={(event) => {
                                  setSelectedGoodWillEventId(event.id);
                                  setActiveView('goodwill-event-detail');
                                }}
                              />
                            )}
                            
                            {activeView === 'goodwill-my-events' && (
                              <GoodWillMyEvents
                                token={localStorage.getItem('zion_token')}
                                moduleColor={currentModule.color}
                                onSelectEvent={(event) => {
                                  setSelectedGoodWillEventId(event.id);
                                  setActiveView('goodwill-event-detail');
                                }}
                                onCreateEvent={() => setActiveView('goodwill-create-event')}
                              />
                            )}
                            
                            {activeView === 'goodwill-create-event' && (
                              <GoodWillEventForm
                                token={localStorage.getItem('zion_token')}
                                moduleColor={currentModule.color}
                                onBack={() => setActiveView('goodwill-my-events')}
                                onEventCreated={(event) => {
                                  setSelectedGoodWillEventId(event.id);
                                  setActiveView('goodwill-event-detail');
                                }}
                              />
                            )}
                            
                            {activeView === 'goodwill-invitations' && (
                              <GoodWillInvitations
                                token={localStorage.getItem('zion_token')}
                                moduleColor={currentModule.color}
                                onSelectEvent={(event) => {
                                  setSelectedGoodWillEventId(event.id);
                                  setActiveView('goodwill-event-detail');
                                }}
                              />
                            )}
                            
                            {activeView === 'goodwill-favorites' && (
                              <GoodWillSearch
                                token={localStorage.getItem('zion_token')}
                                moduleColor={currentModule.color}
                                onSelectEvent={(event) => {
                                  setSelectedGoodWillEventId(event.id);
                                  setActiveView('goodwill-event-detail');
                                }}
                              />
                            )}
                            
                            {activeView === 'goodwill-organizer-profile' && (
                              <GoodWillOrganizerProfile
                                token={localStorage.getItem('zion_token')}
                                moduleColor={currentModule.color}
                                onProfileCreated={() => setActiveView('goodwill-my-events')}
                              />
                            )}
                            
                            {activeView === 'goodwill-groups' && (
                              <GoodWillGroups
                                token={localStorage.getItem('zion_token')}
                                moduleColor={currentModule.color}
                              />
                            )}
                          </>
                        )}

                        {/* JOURNAL MODULE - School Management */}
                        {activeModule === 'journal' && (
                          <>
                            {loadingSchoolRoles ? (
                              <div className="loading-state">
                                <p>Загрузка информации о школах...</p>
                              </div>
                            ) : !schoolRoles ? (
                              <div className="empty-state-large">
                                <p>Не удалось загрузить информацию о школах</p>
                              </div>
                            ) : (activeView === 'wall' || activeView === 'feed') ? (
                              <UniversalWall
                                activeGroup={activeGroup}
                                moduleColor={currentModule.color}
                                moduleName={currentModule.name}
                                user={user}
                                activeModule="journal"
                                schoolRoles={schoolRoles}
                                journalSchoolFilter={journalSchoolFilter}
                                journalAudienceFilter={journalAudienceFilter}
                              />
                            ) : activeView === 'journal-role-select' ? (
                              <div className="journal-role-select">
                                <h2>Выберите Роль</h2>
                                <p>Вы являетесь и родителем, и учителем. Выберите роль для продолжения.</p>
                                <div className="role-selection-buttons">
                                  {schoolRoles.is_parent && (
                                    <button 
                                      className="role-select-btn"
                                      onClick={() => {
                                        setSchoolRole('parent');
                                        setActiveView('journal-school-tiles');
                                      }}
                                    >
                                      <GraduationCap size={32} />
                                      <h3>Как Родитель</h3>
                                      <p>{schoolRoles.schools_as_parent.length} {
                                        schoolRoles.schools_as_parent.length === 1 ? 'школа' : 'школы'
                                      }</p>
                                    </button>
                                  )}
                                  {schoolRoles.is_teacher && (
                                    <button 
                                      className="role-select-btn"
                                      onClick={() => {
                                        setSchoolRole('teacher');
                                        setActiveView('journal-school-tiles');
                                      }}
                                    >
                                      <Briefcase size={32} />
                                      <h3>Как Учитель</h3>
                                      <p>{schoolRoles.schools_as_teacher.length} {
                                        schoolRoles.schools_as_teacher.length === 1 ? 'школа' : 'школы'
                                      }</p>
                                    </button>
                                  )}
                                </div>
                              </div>
                            ) : activeView === 'journal-school-tiles' ? (
                              <ErrorBoundary>
                                <SchoolTiles
                                  schools={schoolRole === 'parent' ? schoolRoles.schools_as_parent : schoolRoles.schools_as_teacher}
                                  role={schoolRole}
                                  onSchoolSelect={(school) => {
                                    setSelectedSchool(school);
                                    setActiveView('journal-dashboard');
                                  }}
                                />
                              </ErrorBoundary>
                            ) : activeView === 'journal-dashboard' ? (
                              /* Show EventPlanner by default when school is selected */
                              <ErrorBoundary>
                                <EventPlanner
                                  organizationId={selectedSchool?.organization_id}
                                  schoolRoles={schoolRoles}
                                  user={user}
                                  moduleColor={currentModule.color}
                                  viewType="full"
                                />
                              </ErrorBoundary>
                            ) : activeView === 'journal-schedule' ? (
                              <ErrorBoundary>
                                <ClassSchedule
                                  selectedSchool={selectedSchool}
                                  role={schoolRole}
                                  onBack={() => setActiveView('journal-dashboard')}
                                />
                              </ErrorBoundary>
                            ) : activeView === 'journal-journal' || activeView === 'journal-gradebook' ? (
                              <ErrorBoundary>
                                <StudentGradebook
                                  selectedSchool={selectedSchool}
                                  role={schoolRole}
                                  onBack={() => setActiveView('journal-dashboard')}
                                />
                              </ErrorBoundary>
                            ) : activeView === 'journal-calendar' || activeView === 'event-planner' ? (
                              <ErrorBoundary>
                                <EventPlanner
                                  organizationId={selectedSchool?.organization_id || (schoolRoles?.schools_as_teacher?.[0]?.organization_id) || (schoolRoles?.schools_as_parent?.[0]?.organization_id)}
                                  schoolRoles={schoolRoles}
                                  user={user}
                                  moduleColor={currentModule.color}
                                  viewType="full"
                                />
                              </ErrorBoundary>
                            ) : activeView === 'journal-classes' ? (
                              <ErrorBoundary>
                                <MyClassesList
                                  selectedSchool={selectedSchool}
                                  role={schoolRole}
                                  onBack={() => setActiveView('journal-dashboard')}
                                  moduleColor={currentModule.color}
                                />
                              </ErrorBoundary>
                            ) : activeView === 'journal-students' ? (
                              <ErrorBoundary>
                                <StudentsList
                                  selectedSchool={selectedSchool}
                                  role={schoolRole}
                                  onBack={() => setActiveView('journal-dashboard')}
                                  moduleColor={currentModule.color}
                                />
                              </ErrorBoundary>
                            ) : (
                              <div className="journal-content-placeholder">
                                <p>Выберите раздел из WORLD ZONE</p>
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>

                  {/* Right Events Panel (not for journal with school selected - that uses World Zone, also not for chat view, also not for news/services/marketplace/finance/events module except feed view) */}
                  {!(activeModule === 'journal' && selectedSchool) && !(activeModule === 'news' && activeView !== 'wall' && activeView !== 'feed') && !(activeModule === 'services' && activeView !== 'services-feed') && !(activeModule === 'marketplace' && activeView !== 'wall' && activeView !== 'feed') && activeModule !== 'finance' && activeModule !== 'events' && !(activeView === 'chat' || activeView === 'my-profile' || activeView === 'media-photos' || activeView === 'media-documents' || activeView === 'media-videos' || activeView === 'family-profiles' || activeView === 'family-create' || activeView === 'family-view' || activeView === 'family-invitations' || activeView === 'my-info' || activeView === 'my-documents' || activeModule === 'organizations' || activeView === 'event-planner' || activeView === 'journal-calendar') && (
                    <div className="events-panel-area">
                      {/* News Events Panel for News module */}
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
                        /* Regular Events Panel for other views */
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

        {/* Right Sidebar - "World" Zone - Context-Specific */}
        <RightSidebar
          activeModule={activeModule}
          activeView={activeView}
          user={user}
          currentModule={currentModule}
          sidebarTintStyle={sidebarTintStyle}
          // Family module
          activeFilters={activeFilters}
          setActiveFilters={setActiveFilters}
          userFamily={userFamily}
          setActiveView={setActiveView}
          // Journal module
          schoolRoles={schoolRoles}
          journalSchoolFilter={journalSchoolFilter}
          setJournalSchoolFilter={setJournalSchoolFilter}
          journalAudienceFilter={journalAudienceFilter}
          setJournalAudienceFilter={setJournalAudienceFilter}
          selectedSchool={selectedSchool}
          setSelectedSchool={setSelectedSchool}
          schoolRole={schoolRole}
          // Organizations module
          selectedOrganizationId={selectedOrganizationId}
          setSelectedOrganizationId={setSelectedOrganizationId}
          activeDepartmentId={activeDepartmentId}
          setActiveDepartmentId={setActiveDepartmentId}
          setShowDepartmentManager={setShowDepartmentManager}
          departmentRefreshTrigger={departmentRefreshTrigger}
          myOrganizations={myOrganizations}
          // Media module
          mediaStats={mediaStats}
          selectedModuleFilter={selectedModuleFilter}
          setSelectedModuleFilter={setSelectedModuleFilter}
          // Chat
          chatGroups={chatGroups}
          activeGroup={activeGroup}
          handleGroupSelect={handleGroupSelect}
          handleCreateGroup={handleCreateGroup}
          activeDirectChat={activeDirectChat}
          setActiveDirectChat={setActiveDirectChat}
          fetchChatGroups={fetchChatGroups}
        />
      </div>

      {/* Gender Update Modal - MANDATORY on First Login if no gender */}
      {showGenderModal && user && (
        <GenderUpdateModal
          isOpen={showGenderModal}
          onClose={() => {
            // Modal is MANDATORY - user cannot close without selecting gender
            // Do nothing on close attempt - user MUST select gender to continue
          }}
          onUpdate={async (gender) => {
            // Mark that we've asked this user for gender
            if (user?.id) {
              localStorage.setItem(`gender_asked_${user.id}`, 'true');
            }
            // Refresh user profile to get updated gender
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
            // Trigger refresh in department navigator
            setDepartmentRefreshTrigger(prev => prev + 1);
          }}
          moduleColor={currentModule.color}
        />
      )}
    </div>
  );
}

// Main App Component
function App() {
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  
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