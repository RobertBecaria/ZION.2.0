/**
 * Centralized Authentication Utilities for ZION.CITY
 *
 * This module provides centralized token management to avoid
 * scattered localStorage calls throughout the codebase.
 */

const TOKEN_KEY = 'zion_token';

/**
 * Get the stored authentication token
 * @returns {string|null} The token or null if not found
 */
export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch (error) {
    console.error('Error accessing localStorage:', error);
    return null;
  }
};

/**
 * Store the authentication token
 * @param {string} token - The token to store
 */
export const setToken = (token) => {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch (error) {
    console.error('Error storing token:', error);
  }
};

/**
 * Remove the stored authentication token
 */
export const removeToken = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (error) {
    console.error('Error removing token:', error);
  }
};

/**
 * Check if user is authenticated (has a token)
 * @returns {boolean} True if token exists
 */
export const isAuthenticated = () => {
  return !!getToken();
};

/**
 * Get authorization headers for API requests
 * @returns {Object} Headers object with Authorization if token exists
 */
export const getAuthHeaders = () => {
  const token = getToken();
  if (!token) {
    return {};
  }
  return {
    'Authorization': `Bearer ${token}`,
  };
};

/**
 * Decode JWT token payload (without verification)
 * @returns {Object|null} Decoded payload or null if invalid
 */
export const getTokenPayload = () => {
  const token = getToken();
  if (!token) {
    return null;
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
};

/**
 * Get the current user ID from the token
 * @returns {string|null} User ID or null if not found
 */
export const getCurrentUserId = () => {
  const payload = getTokenPayload();
  return payload?.sub || null;
};

/**
 * Check if the token is expired
 * @returns {boolean} True if token is expired or invalid
 */
export const isTokenExpired = () => {
  const payload = getTokenPayload();
  if (!payload || !payload.exp) {
    return true;
  }

  // exp is in seconds, Date.now() is in milliseconds
  return Date.now() >= payload.exp * 1000;
};

/**
 * Clear all authentication data (logout)
 */
export const clearAuth = () => {
  removeToken();
};

export default {
  getToken,
  setToken,
  removeToken,
  isAuthenticated,
  getAuthHeaders,
  getTokenPayload,
  getCurrentUserId,
  isTokenExpired,
  clearAuth,
};
