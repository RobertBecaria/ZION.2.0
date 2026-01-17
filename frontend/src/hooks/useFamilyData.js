import { useEffect, useCallback } from 'react';
import { BACKEND_URL } from '../config/api';

/**
 * Custom hook for loading family data
 */
export const useFamilyData = (user, activeModule, setUserFamily, setLoadingFamily) => {
  const loadUserFamily = useCallback(async () => {
    if (!user || activeModule !== 'family') {
      setLoadingFamily(false);
      return;
    }

    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/family-profiles`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
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
  }, [user, activeModule, setUserFamily, setLoadingFamily]);

  useEffect(() => {
    loadUserFamily();
  }, [loadUserFamily]);

  return { loadUserFamily };
};

export default useFamilyData;
