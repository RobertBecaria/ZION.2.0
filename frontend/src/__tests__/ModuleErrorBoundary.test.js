/**
 * Tests for ModuleErrorBoundary Component
 * Tests error catching, display, and recovery functionality
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ModuleErrorBoundary from '../components/ModuleErrorBoundary';

// Mock the logger
jest.mock('../utils/logger', () => ({
  default: {
    error: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
  },
}));

// Component that throws an error
const ErrorThrowingComponent = ({ shouldThrow = true }) => {
  if (shouldThrow) {
    throw new Error('Test error from component');
  }
  return <div data-testid="success-content">Content loaded successfully</div>;
};

// Component that throws on second render
const ConditionalErrorComponent = ({ throwError }) => {
  if (throwError) {
    throw new Error('Conditional error');
  }
  return <div data-testid="conditional-content">No error</div>;
};

describe('ModuleErrorBoundary', () => {
  // Suppress console.error for these tests since we're testing error handling
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('Normal Rendering', () => {
    test('renders children when no error occurs', () => {
      render(
        <ModuleErrorBoundary moduleName="TestModule">
          <div data-testid="child-content">Child Content</div>
        </ModuleErrorBoundary>
      );

      expect(screen.getByTestId('child-content')).toBeInTheDocument();
      expect(screen.getByText('Child Content')).toBeInTheDocument();
    });

    test('renders multiple children', () => {
      render(
        <ModuleErrorBoundary moduleName="TestModule">
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
        </ModuleErrorBoundary>
      );

      expect(screen.getByTestId('child-1')).toBeInTheDocument();
      expect(screen.getByTestId('child-2')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    test('catches errors and displays error UI', () => {
      render(
        <ModuleErrorBoundary moduleName="TestModule">
          <ErrorThrowingComponent />
        </ModuleErrorBoundary>
      );

      // Should show error message instead of the component
      expect(screen.queryByTestId('success-content')).not.toBeInTheDocument();
      expect(screen.getByText(/что-то пошло не так/i)).toBeInTheDocument();
    });

    test('displays module name in error message', () => {
      render(
        <ModuleErrorBoundary moduleName="FamilyModule">
          <ErrorThrowingComponent />
        </ModuleErrorBoundary>
      );

      expect(screen.getByText(/FamilyModule/)).toBeInTheDocument();
    });

    test('displays retry button', () => {
      render(
        <ModuleErrorBoundary moduleName="TestModule">
          <ErrorThrowingComponent />
        </ModuleErrorBoundary>
      );

      expect(screen.getByText(/попробовать снова/i)).toBeInTheDocument();
    });

    test('displays reload button', () => {
      render(
        <ModuleErrorBoundary moduleName="TestModule">
          <ErrorThrowingComponent />
        </ModuleErrorBoundary>
      );

      expect(screen.getByText(/обновить страницу/i)).toBeInTheDocument();
    });

    test('logs error to logger', () => {
      const logger = require('../utils/logger').default;

      render(
        <ModuleErrorBoundary moduleName="TestModule">
          <ErrorThrowingComponent />
        </ModuleErrorBoundary>
      );

      expect(logger.error).toHaveBeenCalledWith(
        'Module error caught:',
        expect.objectContaining({
          moduleName: 'TestModule',
          error: 'Test error from component',
        })
      );
    });
  });

  describe('Recovery', () => {
    test('retry button resets error state', () => {
      const { rerender } = render(
        <ModuleErrorBoundary moduleName="TestModule">
          <ConditionalErrorComponent throwError={true} />
        </ModuleErrorBoundary>
      );

      // Should show error UI
      expect(screen.getByText(/что-то пошло не так/i)).toBeInTheDocument();

      // Click retry - this resets the error state
      fireEvent.click(screen.getByText(/попробовать снова/i));

      // Re-render with no error (simulating the component fixing itself)
      rerender(
        <ModuleErrorBoundary moduleName="TestModule">
          <ConditionalErrorComponent throwError={false} />
        </ModuleErrorBoundary>
      );

      // Should show normal content now
      expect(screen.getByTestId('conditional-content')).toBeInTheDocument();
    });

    test('reload button triggers page reload', () => {
      // Mock window.location.reload
      const reloadMock = jest.fn();
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { reload: reloadMock },
      });

      render(
        <ModuleErrorBoundary moduleName="TestModule">
          <ErrorThrowingComponent />
        </ModuleErrorBoundary>
      );

      fireEvent.click(screen.getByText(/обновить страницу/i));

      expect(reloadMock).toHaveBeenCalled();
    });
  });

  describe('Styling', () => {
    test('applies module color to retry button', () => {
      const moduleColor = '#FF0000';

      render(
        <ModuleErrorBoundary moduleName="TestModule" moduleColor={moduleColor}>
          <ErrorThrowingComponent />
        </ModuleErrorBoundary>
      );

      const retryButton = screen.getByText(/попробовать снова/i);
      expect(retryButton).toHaveStyle({ backgroundColor: moduleColor });
    });

    test('uses default color when moduleColor not provided', () => {
      render(
        <ModuleErrorBoundary moduleName="TestModule">
          <ErrorThrowingComponent />
        </ModuleErrorBoundary>
      );

      const retryButton = screen.getByText(/попробовать снова/i);
      expect(retryButton).toHaveStyle({ backgroundColor: '#059669' });
    });
  });

  describe('Development Mode', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    test('shows error details in development mode', () => {
      process.env.NODE_ENV = 'development';

      render(
        <ModuleErrorBoundary moduleName="TestModule">
          <ErrorThrowingComponent />
        </ModuleErrorBoundary>
      );

      // Look for the details element
      expect(screen.getByText(/детали ошибки/i)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    test('handles errors in deeply nested components', () => {
      const DeepComponent = () => {
        const Inner = () => {
          throw new Error('Deep nested error');
        };
        return <Inner />;
      };

      render(
        <ModuleErrorBoundary moduleName="TestModule">
          <DeepComponent />
        </ModuleErrorBoundary>
      );

      expect(screen.getByText(/что-то пошло не так/i)).toBeInTheDocument();
    });

    test('handles missing moduleName prop', () => {
      render(
        <ModuleErrorBoundary>
          <ErrorThrowingComponent />
        </ModuleErrorBoundary>
      );

      // Should still show error UI
      expect(screen.getByText(/что-то пошло не так/i)).toBeInTheDocument();
    });

    test('handles multiple consecutive errors', () => {
      const { rerender } = render(
        <ModuleErrorBoundary moduleName="TestModule">
          <ErrorThrowingComponent shouldThrow={true} />
        </ModuleErrorBoundary>
      );

      // First error
      expect(screen.getByText(/что-то пошло не так/i)).toBeInTheDocument();

      // Click retry
      fireEvent.click(screen.getByText(/попробовать снова/i));

      // Rerender with another error
      rerender(
        <ModuleErrorBoundary moduleName="TestModule">
          <ErrorThrowingComponent shouldThrow={true} />
        </ModuleErrorBoundary>
      );

      // Should still show error UI
      expect(screen.getByText(/что-то пошло не так/i)).toBeInTheDocument();
    });
  });
});
