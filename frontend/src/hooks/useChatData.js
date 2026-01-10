import { useEffect, useCallback } from 'react';

/**
 * Custom hook for loading chat groups and media stats
 */
export const useChatData = (user, setChatGroups, setActiveGroup, setLoadingGroups, setMediaStats) => {
  
  const fetchChatGroups = useCallback(async () => {
    if (!user) return;
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
        if (familyGroup) {
          setActiveGroup(prev => prev || familyGroup);
        }
      }
    } catch (error) {
      console.error('Error fetching chat groups:', error);
    } finally {
      setLoadingGroups(false);
    }
  }, [user, setChatGroups, setActiveGroup, setLoadingGroups]);

  const fetchMediaStats = useCallback(async () => {
    if (!user) return;
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
          'family': 'family',
          'community': 'news',
          'personal': 'journal',
          'business': 'services',
          'work': 'organizations',
          'education': 'journal',
          'health': 'journal',
          'government': 'organizations'
        };
        
        const frontendModules = ['family', 'news', 'journal', 'services', 'organizations', 'marketplace', 'finance', 'events'];
        frontendModules.forEach(module => {
          simpleCounts[module] = 0;
        });
        
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
  }, [user, setMediaStats]);

  useEffect(() => {
    if (user) {
      fetchChatGroups();
      fetchMediaStats();
    }
  }, [user, fetchChatGroups, fetchMediaStats]);

  return { fetchChatGroups, fetchMediaStats };
};

export default useChatData;
