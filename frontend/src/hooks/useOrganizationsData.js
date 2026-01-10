import { useEffect, useCallback } from 'react';

/**
 * Custom hook for loading organizations data
 */
export const useOrganizationsData = (user, activeModule, setMyOrganizations) => {
  const fetchMyOrganizations = useCallback(async () => {
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
  }, [activeModule, user, setMyOrganizations]);

  useEffect(() => {
    fetchMyOrganizations();
  }, [fetchMyOrganizations]);

  return { fetchMyOrganizations };
};

export default useOrganizationsData;
