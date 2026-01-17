/**
 * useJournalModule Hook
 * Manages all state and logic for the Journal module
 */
import { useState, useEffect, useCallback } from 'react';
import { BACKEND_URL } from '../config/api';

const useJournalModule = (user, activeModule) => {
  // School roles state
  const [schoolRoles, setSchoolRoles] = useState(null);
  const [loadingSchoolRoles, setLoadingSchoolRoles] = useState(true);
  
  // Selection state
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [schoolRole, setSchoolRole] = useState(null); // 'parent' or 'teacher'
  
  // Filter state for feed
  const [journalSchoolFilter, setJournalSchoolFilter] = useState('all');
  const [journalAudienceFilter, setJournalAudienceFilter] = useState('all');

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
        
        // Reset selection when switching to journal
        setSelectedSchool(null);
        setSchoolRole(null);
      }
    } catch (error) {
      console.error('Error fetching school roles:', error);
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

  // Helper to get all schools
  const getAllSchools = useCallback(() => {
    const schools = [];
    if (schoolRoles) {
      if (schoolRoles.schools_as_teacher) {
        schools.push(...schoolRoles.schools_as_teacher.map(s => ({ ...s, role: 'teacher' })));
      }
      if (schoolRoles.schools_as_parent) {
        schools.push(...schoolRoles.schools_as_parent.map(s => ({ ...s, role: 'parent' })));
      }
    }
    return Array.from(new Map(schools.map(s => [s.organization_id, s])).values());
  }, [schoolRoles]);

  // Reset filters when module changes
  useEffect(() => {
    if (activeModule !== 'journal') {
      setJournalSchoolFilter('all');
      setJournalAudienceFilter('all');
    }
  }, [activeModule]);

  return {
    // State
    schoolRoles,
    loadingSchoolRoles,
    selectedSchool,
    schoolRole,
    journalSchoolFilter,
    journalAudienceFilter,
    
    // Setters
    setSchoolRoles,
    setSelectedSchool,
    setSchoolRole,
    setJournalSchoolFilter,
    setJournalAudienceFilter,
    
    // Helpers
    getAllSchools,
    fetchSchoolRoles
  };
};

export default useJournalModule;
