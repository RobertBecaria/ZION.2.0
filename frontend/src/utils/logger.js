/**
 * Logger Utility
 * Conditional logging that only outputs in development mode
 * Provides structured logging with different levels
 */

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Logger object with methods for different log levels
 * All methods are no-ops in production for performance
 */
const logger = {
  /**
   * Log debug information (only in development)
   * @param {string} message - Log message
   * @param {...any} args - Additional arguments to log
   */
  debug: (message, ...args) => {
    if (isDevelopment) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },

  /**
   * Log general information (only in development)
   * @param {string} message - Log message
   * @param {...any} args - Additional arguments to log
   */
  info: (message, ...args) => {
    if (isDevelopment) {
      console.info(`[INFO] ${message}`, ...args);
    }
  },

  /**
   * Log warnings (only in development)
   * @param {string} message - Warning message
   * @param {...any} args - Additional arguments to log
   */
  warn: (message, ...args) => {
    if (isDevelopment) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  },

  /**
   * Log errors (always logs, but with more detail in development)
   * @param {string} message - Error message
   * @param {...any} args - Additional arguments to log
   */
  error: (message, ...args) => {
    if (isDevelopment) {
      console.error(`[ERROR] ${message}`, ...args);
    } else {
      // In production, still log errors but with minimal info
      // This could be extended to send to an error tracking service
      console.error(`[ERROR] ${message}`);
    }
  },

  /**
   * Log API-related messages (only in development)
   * @param {string} endpoint - API endpoint
   * @param {string} method - HTTP method
   * @param {any} data - Optional data to log
   */
  api: (endpoint, method, data = null) => {
    if (isDevelopment) {
      console.log(`[API] ${method} ${endpoint}`, data ? data : '');
    }
  },

  /**
   * Log state changes (only in development)
   * @param {string} stateName - Name of the state variable
   * @param {any} oldValue - Previous value
   * @param {any} newValue - New value
   */
  state: (stateName, oldValue, newValue) => {
    if (isDevelopment) {
      console.log(`[STATE] ${stateName}:`, { from: oldValue, to: newValue });
    }
  },

  /**
   * Log component lifecycle events (only in development)
   * @param {string} componentName - Name of the component
   * @param {string} event - Lifecycle event (mount, unmount, update)
   * @param {any} data - Optional additional data
   */
  component: (componentName, event, data = null) => {
    if (isDevelopment) {
      console.log(`[COMPONENT] ${componentName} - ${event}`, data ? data : '');
    }
  },

  /**
   * Create a group of logs (only in development)
   * @param {string} label - Group label
   * @param {Function} callback - Function containing log statements
   */
  group: (label, callback) => {
    if (isDevelopment) {
      console.group(label);
      callback();
      console.groupEnd();
    }
  },

  /**
   * Log a table (only in development)
   * @param {any} data - Data to display in table format
   */
  table: (data) => {
    if (isDevelopment) {
      console.table(data);
    }
  },

  /**
   * Time a function execution (only in development)
   * @param {string} label - Timer label
   * @param {Function} callback - Function to time
   * @returns {any} Result of the callback
   */
  time: async (label, callback) => {
    if (isDevelopment) {
      console.time(label);
      const result = await callback();
      console.timeEnd(label);
      return result;
    }
    return callback();
  }
};

export default logger;
