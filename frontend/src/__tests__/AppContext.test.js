/**
 * Tests for AppContext
 * Tests the global application state management
 */
import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { AppContextProvider, useAppContext } from '../context/AppContext';

// Mock the config files
jest.mock('../config/api', () => ({
  BACKEND_URL: 'http://localhost:8000',
}));

jest.mock('../config/moduleConfig', () => ({
  getModuleByKey: jest.fn((key) => ({
    key,
    name: key.charAt(0).toUpperCase() + key.slice(1),
    color: '#059669',
  })),
  getSidebarTintStyle: jest.fn(() => ({})),
}));

// Test component that uses the context
const TestConsumer = ({ onContextReady }) => {
  const context = useAppContext();
  React.useEffect(() => {
    if (onContextReady) {
      onContextReady(context);
    }
  }, [context, onContextReady]);

  return (
    <div>
      <span data-testid="activeModule">{context.activeModule}</span>
      <span data-testid="activeView">{context.activeView}</span>
      <button
        data-testid="setModule"
        onClick={() => context.setActiveModule('work')}
      >
        Set Work Module
      </button>
      <button
        data-testid="setView"
        onClick={() => context.setActiveView('chat')}
      >
        Set Chat View
      </button>
    </div>
  );
};

describe('AppContext', () => {
  const mockUser = {
    id: 'test-user-123',
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    gender: 'MALE',
    role: 'ADULT',
  };

  const mockRefreshProfile = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.getItem.mockReturnValue('test-token');
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });

  describe('Provider Setup', () => {
    test('provides default values', () => {
      let contextValue;

      render(
        <AppContextProvider user={mockUser} refreshProfile={mockRefreshProfile}>
          <TestConsumer onContextReady={(ctx) => { contextValue = ctx; }} />
        </AppContextProvider>
      );

      expect(contextValue.activeModule).toBe('family');
      expect(contextValue.activeView).toBe('wall');
      expect(contextValue.user).toEqual(mockUser);
    });

    test('throws error when useAppContext is used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestConsumer />);
      }).toThrow('useAppContext must be used within an AppContextProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('Navigation State', () => {
    test('setActiveModule updates the active module', () => {
      render(
        <AppContextProvider user={mockUser} refreshProfile={mockRefreshProfile}>
          <TestConsumer />
        </AppContextProvider>
      );

      expect(screen.getByTestId('activeModule')).toHaveTextContent('family');

      act(() => {
        screen.getByTestId('setModule').click();
      });

      expect(screen.getByTestId('activeModule')).toHaveTextContent('work');
    });

    test('setActiveView updates the active view', () => {
      render(
        <AppContextProvider user={mockUser} refreshProfile={mockRefreshProfile}>
          <TestConsumer />
        </AppContextProvider>
      );

      expect(screen.getByTestId('activeView')).toHaveTextContent('wall');

      act(() => {
        screen.getByTestId('setView').click();
      });

      expect(screen.getByTestId('activeView')).toHaveTextContent('chat');
    });
  });

  describe('Module View History', () => {
    test('tracks view history per module', () => {
      let contextValue;

      render(
        <AppContextProvider user={mockUser} refreshProfile={mockRefreshProfile}>
          <TestConsumer onContextReady={(ctx) => { contextValue = ctx; }} />
        </AppContextProvider>
      );

      // Set view in family module
      act(() => {
        contextValue.setActiveView('my-family-profile');
      });

      expect(contextValue.moduleViewHistory.family).toBe('my-family-profile');

      // Switch module and set different view
      act(() => {
        contextValue.setActiveModule('work');
        contextValue.setActiveView('my-work');
      });

      // Family history should be preserved
      expect(contextValue.moduleViewHistory.family).toBe('my-family-profile');
    });
  });

  describe('UI State', () => {
    test('manages calendar visibility', () => {
      let contextValue;

      render(
        <AppContextProvider user={mockUser} refreshProfile={mockRefreshProfile}>
          <TestConsumer onContextReady={(ctx) => { contextValue = ctx; }} />
        </AppContextProvider>
      );

      expect(contextValue.showCalendar).toBe(false);

      act(() => {
        contextValue.setShowCalendar(true);
      });

      expect(contextValue.showCalendar).toBe(true);
    });

    test('manages notifications visibility', () => {
      let contextValue;

      render(
        <AppContextProvider user={mockUser} refreshProfile={mockRefreshProfile}>
          <TestConsumer onContextReady={(ctx) => { contextValue = ctx; }} />
        </AppContextProvider>
      );

      expect(contextValue.showNotifications).toBe(false);

      act(() => {
        contextValue.setShowNotifications(true);
      });

      expect(contextValue.showNotifications).toBe(true);
    });

    test('manages ERIC widget visibility', () => {
      let contextValue;

      render(
        <AppContextProvider user={mockUser} refreshProfile={mockRefreshProfile}>
          <TestConsumer onContextReady={(ctx) => { contextValue = ctx; }} />
        </AppContextProvider>
      );

      expect(contextValue.showERICWidget).toBe(false);

      act(() => {
        contextValue.setShowERICWidget(true);
      });

      expect(contextValue.showERICWidget).toBe(true);
    });
  });

  describe('Family Module State', () => {
    test('initializes with loading family state', () => {
      let contextValue;

      render(
        <AppContextProvider user={mockUser} refreshProfile={mockRefreshProfile}>
          <TestConsumer onContextReady={(ctx) => { contextValue = ctx; }} />
        </AppContextProvider>
      );

      expect(contextValue.userFamily).toBeNull();
      // loadingFamily starts true
      expect(contextValue.loadingFamily).toBeDefined();
    });

    test('manages active filters', () => {
      let contextValue;

      render(
        <AppContextProvider user={mockUser} refreshProfile={mockRefreshProfile}>
          <TestConsumer onContextReady={(ctx) => { contextValue = ctx; }} />
        </AppContextProvider>
      );

      expect(contextValue.activeFilters).toEqual([]);

      act(() => {
        contextValue.setActiveFilters(['FATHERS_ONLY']);
      });

      expect(contextValue.activeFilters).toEqual(['FATHERS_ONLY']);
    });
  });

  describe('Work Module State', () => {
    test('manages selected organization', () => {
      let contextValue;

      render(
        <AppContextProvider user={mockUser} refreshProfile={mockRefreshProfile}>
          <TestConsumer onContextReady={(ctx) => { contextValue = ctx; }} />
        </AppContextProvider>
      );

      expect(contextValue.selectedOrganizationId).toBeNull();

      act(() => {
        contextValue.setSelectedOrganizationId('org-123');
      });

      expect(contextValue.selectedOrganizationId).toBe('org-123');
    });

    test('manages work setup mode', () => {
      let contextValue;

      render(
        <AppContextProvider user={mockUser} refreshProfile={mockRefreshProfile}>
          <TestConsumer onContextReady={(ctx) => { contextValue = ctx; }} />
        </AppContextProvider>
      );

      expect(contextValue.workSetupMode).toBe('choice');

      act(() => {
        contextValue.setWorkSetupMode('create');
      });

      expect(contextValue.workSetupMode).toBe('create');
    });

    test('manages active department', () => {
      let contextValue;

      render(
        <AppContextProvider user={mockUser} refreshProfile={mockRefreshProfile}>
          <TestConsumer onContextReady={(ctx) => { contextValue = ctx; }} />
        </AppContextProvider>
      );

      expect(contextValue.activeDepartmentId).toBeNull();

      act(() => {
        contextValue.setActiveDepartmentId('dept-123');
      });

      expect(contextValue.activeDepartmentId).toBe('dept-123');
    });
  });

  describe('Chat State', () => {
    test('initializes with empty chat groups', () => {
      let contextValue;

      render(
        <AppContextProvider user={mockUser} refreshProfile={mockRefreshProfile}>
          <TestConsumer onContextReady={(ctx) => { contextValue = ctx; }} />
        </AppContextProvider>
      );

      expect(contextValue.chatGroups).toEqual([]);
      expect(contextValue.activeGroup).toBeNull();
      expect(contextValue.activeDirectChat).toBeNull();
    });

    test('manages active group selection', () => {
      let contextValue;

      render(
        <AppContextProvider user={mockUser} refreshProfile={mockRefreshProfile}>
          <TestConsumer onContextReady={(ctx) => { contextValue = ctx; }} />
        </AppContextProvider>
      );

      const mockGroup = { id: 'group-123', name: 'Test Group' };

      act(() => {
        contextValue.handleGroupSelect(mockGroup);
      });

      expect(contextValue.activeGroup).toEqual(mockGroup);
    });
  });

  describe('Media State', () => {
    test('initializes with empty media stats', () => {
      let contextValue;

      render(
        <AppContextProvider user={mockUser} refreshProfile={mockRefreshProfile}>
          <TestConsumer onContextReady={(ctx) => { contextValue = ctx; }} />
        </AppContextProvider>
      );

      expect(contextValue.mediaStats).toEqual({});
      expect(contextValue.selectedModuleFilter).toBe('all');
    });

    test('manages module filter selection', () => {
      let contextValue;

      render(
        <AppContextProvider user={mockUser} refreshProfile={mockRefreshProfile}>
          <TestConsumer onContextReady={(ctx) => { contextValue = ctx; }} />
        </AppContextProvider>
      );

      act(() => {
        contextValue.setSelectedModuleFilter('family');
      });

      expect(contextValue.selectedModuleFilter).toBe('family');
    });
  });

  describe('Gender Modal', () => {
    test('shows gender modal for user without gender set', () => {
      const userWithoutGender = { ...mockUser, gender: null };
      localStorage.getItem.mockImplementation((key) => {
        if (key === `gender_asked_${mockUser.id}`) return null;
        return 'test-token';
      });

      let contextValue;

      render(
        <AppContextProvider user={userWithoutGender} refreshProfile={mockRefreshProfile}>
          <TestConsumer onContextReady={(ctx) => { contextValue = ctx; }} />
        </AppContextProvider>
      );

      expect(contextValue.showGenderModal).toBe(true);
    });

    test('hides gender modal for user with gender set', () => {
      let contextValue;

      render(
        <AppContextProvider user={mockUser} refreshProfile={mockRefreshProfile}>
          <TestConsumer onContextReady={(ctx) => { contextValue = ctx; }} />
        </AppContextProvider>
      );

      expect(contextValue.showGenderModal).toBe(false);
    });
  });

  describe('Module Config', () => {
    test('provides current module config', () => {
      let contextValue;

      render(
        <AppContextProvider user={mockUser} refreshProfile={mockRefreshProfile}>
          <TestConsumer onContextReady={(ctx) => { contextValue = ctx; }} />
        </AppContextProvider>
      );

      expect(contextValue.currentModule).toBeDefined();
      expect(contextValue.currentModule.key).toBe('family');
      expect(contextValue.sidebarTintStyle).toBeDefined();
    });
  });

  describe('Journal Module State', () => {
    test('manages journal filters', () => {
      let contextValue;

      render(
        <AppContextProvider user={mockUser} refreshProfile={mockRefreshProfile}>
          <TestConsumer onContextReady={(ctx) => { contextValue = ctx; }} />
        </AppContextProvider>
      );

      expect(contextValue.journalSchoolFilter).toBe('all');
      expect(contextValue.journalAudienceFilter).toBe('all');

      act(() => {
        contextValue.setJournalSchoolFilter('school-123');
        contextValue.setJournalAudienceFilter('teachers');
      });

      expect(contextValue.journalSchoolFilter).toBe('school-123');
      expect(contextValue.journalAudienceFilter).toBe('teachers');
    });
  });
});
