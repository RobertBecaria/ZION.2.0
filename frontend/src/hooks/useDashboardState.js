import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../components/auth';
import { getModuleByKey, getSidebarTintStyle } from '../config/moduleConfig';

/**
 * Custom hook for managing all Dashboard state
 * Extracted from App.js to reduce complexity
 */
export const useDashboardState = () => {
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
  const [selectedFamilyId, setSelectedFamilyId] = useState(null);
  const [selectedFamilyForInvitation, setSelectedFamilyForInvitation] = useState(null);
  const [showInvitationModal, setShowInvitationModal] = useState(false);
  
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

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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

  return {
    // Auth
    user,
    logout,
    refreshProfile,
    
    // Navigation
    activeModule,
    setActiveModule,
    activeView,
    setActiveView: handleSetActiveView,
    moduleViewHistory,
    
    // UI
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
    
    // Family
    userFamily,
    setUserFamily,
    loadingFamily,
    setLoadingFamily,
    activeFilters,
    setActiveFilters,
    selectedFamilyId,
    setSelectedFamilyId,
    selectedFamilyForInvitation,
    setSelectedFamilyForInvitation,
    showInvitationModal,
    setShowInvitationModal,
    
    // Work
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
    
    // News
    selectedChannelId,
    setSelectedChannelId,
    selectedNewsUserId,
    setSelectedNewsUserId,
    
    // Services
    selectedServiceListing,
    setSelectedServiceListing,
    
    // Marketplace
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
    
    // Good Will
    selectedGoodWillEventId,
    setSelectedGoodWillEventId,
    
    // Media
    mediaStats,
    setMediaStats,
    selectedModuleFilter,
    setSelectedModuleFilter,
    
    // Chat
    chatGroups,
    setChatGroups,
    activeGroup,
    setActiveGroup,
    activeDirectChat,
    setActiveDirectChat,
    loadingGroups,
    setLoadingGroups,
    
    // Module config
    currentModule,
    sidebarTintStyle,
  };
};

export default useDashboardState;
