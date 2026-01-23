/**
 * AppContext - Global Application State Management
 * Centralized state management for the ZION.CITY application
 * Replaces prop drilling with Context API for cleaner architecture
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { BACKEND_URL } from '../config/api';
import { getModuleByKey, getSidebarTintStyle } from '../config/moduleConfig';

// Create the context
const AppContext = createContext(null);

/**
 * AppContextProvider - Wraps the application with global state
 */
export function AppContextProvider({ children, user, refreshProfile }) {
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
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [showQuickCreate, setShowQuickCreate] = useState(false);

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

  // Journal/School module state
  const [schoolRoles, setSchoolRoles] = useState(null);
  const [loadingSchoolRoles, setLoadingSchoolRoles] = useState(true);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [schoolRole, setSchoolRole] = useState(null);
  const [journalSchoolFilter, setJournalSchoolFilter] = useState('all');
  const [journalAudienceFilter, setJournalAudienceFilter] = useState('all');

  // Module config (derived state)
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

  // Fetch media statistics
  const fetchMediaStats = useCallback(async () => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/media/modules`, {
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
      // Error handled silently in production
    }
  }, []);

  // Fetch chat groups
  const fetchChatGroups = useCallback(async () => {
    setLoadingGroups(true);
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/chat-groups`, {
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
      // Error handled silently in production
    } finally {
      setLoadingGroups(false);
    }
  }, [activeGroup]);

  // Handler functions
  const handleGroupSelect = useCallback((groupData) => {
    setActiveGroup(groupData);
  }, []);

  const handleCreateGroup = useCallback(() => {
    fetchChatGroups();
  }, [fetchChatGroups]);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
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
        const response = await fetch(`${BACKEND_URL}/api/family-profiles`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          const families = data.family_profiles || [];
          const primaryFamily = families.find(f => f.user_role === 'PARENT' || f.is_user_member) || families[0];
          setUserFamily(primaryFamily);
        }
      } catch (error) {
        // Error handled silently in production
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
        const response = await fetch(`${BACKEND_URL}/api/work/organizations`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          setMyOrganizations(data.organizations || []);
        }
      } catch (error) {
        // Error handled silently in production
      }
    };

    fetchMyOrganizations();
  }, [activeModule, user]);

  // Setup window function for opening full department management
  useEffect(() => {
    window.openDepartmentManagement = () => {
      setActiveView('work-department-management');
    };
    return () => {
      delete window.openDepartmentManagement;
    };
  }, []);

  // Load chat groups and fetch media stats when user loads
  useEffect(() => {
    if (user) {
      fetchChatGroups();
      fetchMediaStats();
    }
  }, [user, fetchChatGroups, fetchMediaStats]);

  // Fetch school roles when journal module is active
  const fetchSchoolRoles = useCallback(async () => {
    if (!user) return;

    try {
      setLoadingSchoolRoles(true);
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/users/me/school-roles`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const roles = await response.json();
        setSchoolRoles(roles);
        setSelectedSchool(null);
        setSchoolRole(null);
      }
    } catch (error) {
      // Error handled silently in production
    } finally {
      setLoadingSchoolRoles(false);
    }
  }, [user]);

  // Fetch roles when entering journal module
  useEffect(() => {
    if (activeModule === 'journal' && user) {
      fetchSchoolRoles();
    }
  }, [activeModule, user, fetchSchoolRoles]);

  // Set default view when entering Journal module
  useEffect(() => {
    if (activeModule === 'journal' && !loadingSchoolRoles) {
      setActiveView('wall');
    }
  }, [activeModule, loadingSchoolRoles]);

  // Reset journal filters when module changes
  useEffect(() => {
    if (activeModule !== 'journal') {
      setJournalSchoolFilter('all');
      setJournalAudienceFilter('all');
    }
  }, [activeModule]);

  // Context value - all state and handlers
  const value = {
    // User
    user,
    refreshProfile,

    // Core navigation
    activeModule,
    setActiveModule,
    activeView,
    setActiveView: handleSetActiveView,
    moduleViewHistory,
    setModuleViewHistory,

    // Module config
    currentModule,
    sidebarTintStyle,

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
    loadingFamily,
    activeFilters,
    setActiveFilters,

    // Work module
    selectedOrganizationId,
    setSelectedOrganizationId,
    workSetupMode,
    setWorkSetupMode,
    activeDepartmentId,
    setActiveDepartmentId,
    showDepartmentManager,
    setShowDepartmentManager,
    departmentRefreshTrigger,
    setDepartmentRefreshTrigger,
    myOrganizations,
    setMyOrganizations,
    viewingPublicOrgId,
    setViewingPublicOrgId,

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
    mediaStats,
    setMediaStats,
    selectedModuleFilter,
    setSelectedModuleFilter,
    fetchMediaStats,

    // Chat
    chatGroups,
    setChatGroups,
    activeGroup,
    setActiveGroup,
    activeDirectChat,
    setActiveDirectChat,
    loadingGroups,
    handleGroupSelect,
    handleCreateGroup,
    fetchChatGroups,

    // Journal/School module
    schoolRoles,
    setSchoolRoles,
    loadingSchoolRoles,
    selectedSchool,
    setSelectedSchool,
    schoolRole,
    setSchoolRole,
    journalSchoolFilter,
    setJournalSchoolFilter,
    journalAudienceFilter,
    setJournalAudienceFilter,
    fetchSchoolRoles,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

/**
 * useAppContext - Hook to consume the app context
 * @throws {Error} if used outside of AppContextProvider
 */
export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppContextProvider');
  }
  return context;
}

export default AppContext;
