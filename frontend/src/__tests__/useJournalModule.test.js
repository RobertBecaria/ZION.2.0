/**
 * Tests for useJournalModule Hook
 * Tests journal/school module state management
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import useJournalModule from '../hooks/useJournalModule';

// Mock the config
jest.mock('../config/api', () => ({
  BACKEND_URL: 'https://test-api.example.com',
}));

describe('useJournalModule', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
  };

  const mockSchoolRoles = {
    schools_as_teacher: [
      { organization_id: 'school-1', name: 'Test School 1' },
      { organization_id: 'school-2', name: 'Test School 2' },
    ],
    schools_as_parent: [
      { organization_id: 'school-3', name: 'Test School 3' },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.getItem.mockReturnValue('test-token');
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSchoolRoles),
    });
  });

  describe('Initial State', () => {
    test('initializes with null school roles', () => {
      const { result } = renderHook(() =>
        useJournalModule(mockUser, 'family')
      );

      expect(result.current.schoolRoles).toBeNull();
    });

    test('initializes with loading state', () => {
      const { result } = renderHook(() =>
        useJournalModule(mockUser, 'family')
      );

      expect(result.current.loadingSchoolRoles).toBe(true);
    });

    test('initializes with null selected school', () => {
      const { result } = renderHook(() =>
        useJournalModule(mockUser, 'family')
      );

      expect(result.current.selectedSchool).toBeNull();
    });

    test('initializes with null school role', () => {
      const { result } = renderHook(() =>
        useJournalModule(mockUser, 'family')
      );

      expect(result.current.schoolRole).toBeNull();
    });

    test('initializes filters to "all"', () => {
      const { result } = renderHook(() =>
        useJournalModule(mockUser, 'family')
      );

      expect(result.current.journalSchoolFilter).toBe('all');
      expect(result.current.journalAudienceFilter).toBe('all');
    });
  });

  describe('Fetching School Roles', () => {
    test('fetches school roles when journal module is active', async () => {
      const { result } = renderHook(() =>
        useJournalModule(mockUser, 'journal')
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          'https://test-api.example.com/api/users/me/school-roles',
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer test-token',
            }),
          })
        );
      });
    });

    test('does not fetch when module is not journal', () => {
      renderHook(() =>
        useJournalModule(mockUser, 'family')
      );

      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('does not fetch when user is null', () => {
      renderHook(() =>
        useJournalModule(null, 'journal')
      );

      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('sets school roles after successful fetch', async () => {
      const { result } = renderHook(() =>
        useJournalModule(mockUser, 'journal')
      );

      await waitFor(() => {
        expect(result.current.schoolRoles).toEqual(mockSchoolRoles);
      });
    });

    test('sets loading to false after fetch completes', async () => {
      const { result } = renderHook(() =>
        useJournalModule(mockUser, 'journal')
      );

      await waitFor(() => {
        expect(result.current.loadingSchoolRoles).toBe(false);
      });
    });

    test('handles fetch error gracefully', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() =>
        useJournalModule(mockUser, 'journal')
      );

      await waitFor(() => {
        expect(result.current.loadingSchoolRoles).toBe(false);
      });

      // School roles should remain null on error
      expect(result.current.schoolRoles).toBeNull();
    });

    test('resets selection when fetching new roles', async () => {
      const { result, rerender } = renderHook(
        ({ user, module }) => useJournalModule(user, module),
        { initialProps: { user: mockUser, module: 'journal' } }
      );

      await waitFor(() => {
        expect(result.current.schoolRoles).toEqual(mockSchoolRoles);
      });

      // Set a selected school
      act(() => {
        result.current.setSelectedSchool({ organization_id: 'school-1' });
        result.current.setSchoolRole('teacher');
      });

      expect(result.current.selectedSchool).toBeDefined();

      // Re-fetch (by switching modules and back)
      rerender({ user: mockUser, module: 'family' });
      rerender({ user: mockUser, module: 'journal' });

      await waitFor(() => {
        expect(result.current.selectedSchool).toBeNull();
        expect(result.current.schoolRole).toBeNull();
      });
    });
  });

  describe('State Setters', () => {
    test('setSchoolRoles updates school roles', () => {
      const { result } = renderHook(() =>
        useJournalModule(mockUser, 'family')
      );

      act(() => {
        result.current.setSchoolRoles(mockSchoolRoles);
      });

      expect(result.current.schoolRoles).toEqual(mockSchoolRoles);
    });

    test('setSelectedSchool updates selected school', () => {
      const { result } = renderHook(() =>
        useJournalModule(mockUser, 'family')
      );

      const school = { organization_id: 'school-1', name: 'Test School' };

      act(() => {
        result.current.setSelectedSchool(school);
      });

      expect(result.current.selectedSchool).toEqual(school);
    });

    test('setSchoolRole updates school role', () => {
      const { result } = renderHook(() =>
        useJournalModule(mockUser, 'family')
      );

      act(() => {
        result.current.setSchoolRole('teacher');
      });

      expect(result.current.schoolRole).toBe('teacher');
    });

    test('setJournalSchoolFilter updates school filter', () => {
      const { result } = renderHook(() =>
        useJournalModule(mockUser, 'family')
      );

      act(() => {
        result.current.setJournalSchoolFilter('school-1');
      });

      expect(result.current.journalSchoolFilter).toBe('school-1');
    });

    test('setJournalAudienceFilter updates audience filter', () => {
      const { result } = renderHook(() =>
        useJournalModule(mockUser, 'family')
      );

      act(() => {
        result.current.setJournalAudienceFilter('teachers');
      });

      expect(result.current.journalAudienceFilter).toBe('teachers');
    });
  });

  describe('getAllSchools Helper', () => {
    test('returns empty array when schoolRoles is null', () => {
      const { result } = renderHook(() =>
        useJournalModule(mockUser, 'family')
      );

      const schools = result.current.getAllSchools();
      expect(schools).toEqual([]);
    });

    test('combines schools from teacher and parent roles', async () => {
      const { result } = renderHook(() =>
        useJournalModule(mockUser, 'journal')
      );

      await waitFor(() => {
        expect(result.current.schoolRoles).toEqual(mockSchoolRoles);
      });

      const schools = result.current.getAllSchools();

      // Should have 3 schools (2 teacher + 1 parent)
      expect(schools.length).toBe(3);
    });

    test('adds role property to each school', async () => {
      const { result } = renderHook(() =>
        useJournalModule(mockUser, 'journal')
      );

      await waitFor(() => {
        expect(result.current.schoolRoles).toEqual(mockSchoolRoles);
      });

      const schools = result.current.getAllSchools();

      // Teacher schools should have role: 'teacher'
      const teacherSchools = schools.filter(s => s.role === 'teacher');
      expect(teacherSchools.length).toBe(2);

      // Parent schools should have role: 'parent'
      const parentSchools = schools.filter(s => s.role === 'parent');
      expect(parentSchools.length).toBe(1);
    });

    test('deduplicates schools by organization_id', async () => {
      const rolesWithDuplicate = {
        schools_as_teacher: [
          { organization_id: 'school-1', name: 'Test School 1' },
        ],
        schools_as_parent: [
          { organization_id: 'school-1', name: 'Test School 1' }, // Same school
          { organization_id: 'school-2', name: 'Test School 2' },
        ],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(rolesWithDuplicate),
      });

      const { result } = renderHook(() =>
        useJournalModule(mockUser, 'journal')
      );

      await waitFor(() => {
        expect(result.current.schoolRoles).toEqual(rolesWithDuplicate);
      });

      const schools = result.current.getAllSchools();

      // Should only have 2 unique schools
      expect(schools.length).toBe(2);
    });
  });

  describe('Filter Reset on Module Change', () => {
    test('resets filters when leaving journal module', () => {
      const { result, rerender } = renderHook(
        ({ user, module }) => useJournalModule(user, module),
        { initialProps: { user: mockUser, module: 'journal' } }
      );

      // Set some filters
      act(() => {
        result.current.setJournalSchoolFilter('school-1');
        result.current.setJournalAudienceFilter('teachers');
      });

      expect(result.current.journalSchoolFilter).toBe('school-1');
      expect(result.current.journalAudienceFilter).toBe('teachers');

      // Switch to different module
      rerender({ user: mockUser, module: 'family' });

      // Filters should reset to 'all'
      expect(result.current.journalSchoolFilter).toBe('all');
      expect(result.current.journalAudienceFilter).toBe('all');
    });

    test('preserves filters when staying in journal module', () => {
      const { result, rerender } = renderHook(
        ({ user, module }) => useJournalModule(user, module),
        { initialProps: { user: mockUser, module: 'journal' } }
      );

      act(() => {
        result.current.setJournalSchoolFilter('school-1');
        result.current.setJournalAudienceFilter('teachers');
      });

      // Rerender with same module
      rerender({ user: mockUser, module: 'journal' });

      // Filters should be preserved
      expect(result.current.journalSchoolFilter).toBe('school-1');
      expect(result.current.journalAudienceFilter).toBe('teachers');
    });
  });

  describe('fetchSchoolRoles Function', () => {
    test('provides fetchSchoolRoles for manual refresh', () => {
      const { result } = renderHook(() =>
        useJournalModule(mockUser, 'family')
      );

      expect(typeof result.current.fetchSchoolRoles).toBe('function');
    });

    test('fetchSchoolRoles can be called manually', async () => {
      const { result } = renderHook(() =>
        useJournalModule(mockUser, 'family')
      );

      // Clear initial fetch call count
      global.fetch.mockClear();

      await act(async () => {
        await result.current.fetchSchoolRoles();
      });

      expect(global.fetch).toHaveBeenCalled();
    });

    test('fetchSchoolRoles does nothing without user', async () => {
      const { result } = renderHook(() =>
        useJournalModule(null, 'journal')
      );

      global.fetch.mockClear();

      await act(async () => {
        await result.current.fetchSchoolRoles();
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
