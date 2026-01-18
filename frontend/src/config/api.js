/**
 * API Configuration
 * Centralized configuration for backend API URL
 */

// Default to localhost:8001 for development if not configured
const DEFAULT_BACKEND_URL = 'http://localhost:8001';

/**
 * Get the backend API URL from environment variables
 * - Empty string '' = use relative URLs (production same-domain)
 * - Undefined = use default localhost URL (development)
 * - Any URL = use that URL explicitly
 */
export const getBackendUrl = () => {
  const backendUrl = process.env.REACT_APP_BACKEND_URL || '';

  // Empty string is valid - means use relative URLs for production
  if (backendUrl === '') {
    return '';
  }

  // Undefined means not configured - use default for development
  if (backendUrl === undefined) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        'REACT_APP_BACKEND_URL is not configured. Using default: ' + DEFAULT_BACKEND_URL + '\n' +
        'To fix this, create a .env file in the frontend directory with:\n' +
        'REACT_APP_BACKEND_URL=http://localhost:8001'
      );
    }
    return DEFAULT_BACKEND_URL;
  }

  return backendUrl;
};

/**
 * The backend API URL
 * Use this constant for all API calls
 * - '' (empty) for production same-domain relative URLs
 * - 'http://localhost:8001' for development
 */
export const BACKEND_URL = getBackendUrl();

/**
 * Get WebSocket URL based on backend URL
 * Converts http:// to ws:// and https:// to wss://
 * For relative URLs (empty string), uses current page protocol/host
 */
export const getWebSocketUrl = () => {
  const url = BACKEND_URL;

  // For relative URLs, construct WebSocket URL from current location
  if (!url) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  }

  if (url.startsWith('https://')) {
    return url.replace('https://', 'wss://');
  }
  return url.replace('http://', 'ws://');
};

export const WS_URL = getWebSocketUrl();

export default BACKEND_URL;
