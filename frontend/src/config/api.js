/**
 * API Configuration
 * Centralized configuration for backend API URL
 */

// Default to localhost:8001 for development if not configured
const DEFAULT_BACKEND_URL = 'http://localhost:8001';

/**
 * Get the backend API URL from environment variables
 * Falls back to default localhost URL if not configured
 */
export const getBackendUrl = () => {
  const backendUrl = process.env.REACT_APP_BACKEND_URL;

  if (!backendUrl) {
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
 */
export const BACKEND_URL = getBackendUrl();

/**
 * Get WebSocket URL based on backend URL
 * Converts http:// to ws:// and https:// to wss://
 */
export const getWebSocketUrl = () => {
  const url = BACKEND_URL;
  if (url.startsWith('https://')) {
    return url.replace('https://', 'wss://');
  }
  return url.replace('http://', 'ws://');
};

export const WS_URL = getWebSocketUrl();

export default BACKEND_URL;
