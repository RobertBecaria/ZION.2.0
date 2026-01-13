/**
 * ZION.CITY API Client
 *
 * Centralized API client for all backend communication.
 * This module provides:
 * - Automatic token management
 * - Request/response interceptors
 * - Error handling
 * - Type-safe API methods
 *
 * Usage:
 *   import { auth, posts, chat } from '../lib/api';
 *
 *   // Login
 *   const { user, access_token } = await auth.login({ email, password });
 *
 *   // Get posts
 *   const posts = await posts.getFeed({ page: 1, limit: 20 });
 */

import axios from 'axios';

// Get backend URL from environment or default to localhost
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

// Create axios instance with default config
const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================================
// REQUEST INTERCEPTOR - Add auth token to all requests
// ============================================================
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('zion_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ============================================================
// RESPONSE INTERCEPTOR - Handle auth errors globally
// ============================================================
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 Unauthorized - redirect to login
    if (error.response?.status === 401) {
      localStorage.removeItem('zion_token');
      // Only redirect if not already on login page
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ============================================================
// AUTH ENDPOINTS
// ============================================================
export const auth = {
  /**
   * Login user
   * @param {{ email: string, password: string }} credentials
   * @returns {Promise<{ access_token: string, user: object }>}
   */
  login: (credentials) => api.post('/auth/login', credentials),

  /**
   * Register new user
   * @param {object} userData - User registration data
   * @returns {Promise<{ access_token: string, user: object }>}
   */
  register: (userData) => api.post('/auth/register', userData),

  /**
   * Get current user profile
   * @returns {Promise<object>} User profile
   */
  getProfile: () => api.get('/auth/me'),

  /**
   * Logout (client-side only)
   */
  logout: () => {
    localStorage.removeItem('zion_token');
  },
};

// ============================================================
// USER ENDPOINTS
// ============================================================
export const users = {
  /**
   * Get user by ID
   * @param {string} userId
   * @returns {Promise<object>} User data
   */
  getById: (userId) => api.get(`/users/${userId}`),

  /**
   * Update user profile
   * @param {object} userData
   * @returns {Promise<object>} Updated user
   */
  updateProfile: (userData) => api.put('/users/me', userData),

  /**
   * Search users
   * @param {string} query - Search query
   * @param {number} limit - Max results
   * @returns {Promise<object[]>} List of users
   */
  search: (query, limit = 20) => api.get('/users/search', { params: { query, limit } }),
};

// ============================================================
// POST ENDPOINTS
// ============================================================
export const posts = {
  /**
   * Get feed posts
   * @param {{ page?: number, limit?: number, visibility?: string }} params
   * @returns {Promise<object[]>} List of posts
   */
  getFeed: (params = {}) => api.get('/posts/feed', { params }),

  /**
   * Get single post
   * @param {string} postId
   * @returns {Promise<object>} Post data
   */
  getById: (postId) => api.get(`/posts/${postId}`),

  /**
   * Create new post
   * @param {FormData} formData - Post data with optional media
   * @returns {Promise<object>} Created post
   */
  create: (formData) => api.post('/posts', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),

  /**
   * Delete post
   * @param {string} postId
   * @returns {Promise<void>}
   */
  delete: (postId) => api.delete(`/posts/${postId}`),

  /**
   * Like/unlike a post
   * @param {string} postId
   * @returns {Promise<object>} Updated like status
   */
  toggleLike: (postId) => api.post(`/posts/${postId}/like`),

  /**
   * Get post likes
   * @param {string} postId
   * @returns {Promise<object[]>} List of users who liked
   */
  getLikes: (postId) => api.get(`/posts/${postId}/likes`),

  /**
   * Get post comments
   * @param {string} postId
   * @returns {Promise<object[]>} List of comments
   */
  getComments: (postId) => api.get(`/posts/${postId}/comments`),

  /**
   * Add comment to post
   * @param {string} postId
   * @param {FormData} formData - Comment data
   * @returns {Promise<object>} Created comment
   */
  addComment: (postId, formData) => api.post(`/posts/${postId}/comments`, formData),
};

// ============================================================
// CHAT ENDPOINTS
// ============================================================
export const chat = {
  /**
   * Get user's chat groups
   * @returns {Promise<object[]>} List of chat groups
   */
  getGroups: () => api.get('/chat-groups'),

  /**
   * Create chat group
   * @param {object} groupData
   * @returns {Promise<object>} Created group
   */
  createGroup: (groupData) => api.post('/chat-groups', groupData),

  /**
   * Get messages for a chat group
   * @param {string} groupId
   * @param {{ skip?: number, limit?: number }} params
   * @returns {Promise<object[]>} List of messages
   */
  getMessages: (groupId, params = {}) =>
    api.get(`/chat-groups/${groupId}/messages`, { params }),

  /**
   * Send message to group
   * @param {string} groupId
   * @param {object} messageData
   * @returns {Promise<object>} Sent message
   */
  sendMessage: (groupId, messageData) =>
    api.post(`/chat-groups/${groupId}/messages`, messageData),

  /**
   * Get direct chats
   * @returns {Promise<object[]>} List of direct chats
   */
  getDirectChats: () => api.get('/direct-chats'),

  /**
   * Get direct chat messages
   * @param {string} chatId
   * @param {{ skip?: number, limit?: number }} params
   * @returns {Promise<object[]>} List of messages
   */
  getDirectMessages: (chatId, params = {}) =>
    api.get(`/direct-chats/${chatId}/messages`, { params }),

  /**
   * Send direct message
   * @param {string} chatId
   * @param {object} messageData
   * @returns {Promise<object>} Sent message
   */
  sendDirectMessage: (chatId, messageData) =>
    api.post(`/direct-chats/${chatId}/messages`, messageData),
};

// ============================================================
// FAMILY ENDPOINTS
// ============================================================
export const family = {
  /**
   * Get user's family profiles
   * @returns {Promise<object[]>} List of family profiles
   */
  getProfiles: () => api.get('/family-profiles'),

  /**
   * Create family profile
   * @param {object} familyData
   * @returns {Promise<object>} Created family
   */
  create: (familyData) => api.post('/family-profiles', familyData),

  /**
   * Get family by ID
   * @param {string} familyId
   * @returns {Promise<object>} Family data
   */
  getById: (familyId) => api.get(`/family-profiles/${familyId}`),

  /**
   * Get family members
   * @param {string} familyId
   * @returns {Promise<object[]>} List of members
   */
  getMembers: (familyId) => api.get(`/family-profiles/${familyId}/members`),
};

// ============================================================
// ORGANIZATION (WORK) ENDPOINTS
// ============================================================
export const organizations = {
  /**
   * Get user's organizations
   * @returns {Promise<object[]>} List of organizations
   */
  getMyOrgs: () => api.get('/my-organizations'),

  /**
   * Search organizations
   * @param {object} searchData
   * @returns {Promise<object[]>} List of organizations
   */
  search: (searchData) => api.post('/organizations/search', searchData),

  /**
   * Get organization by ID
   * @param {string} orgId
   * @returns {Promise<object>} Organization data
   */
  getById: (orgId) => api.get(`/organizations/${orgId}`),

  /**
   * Create organization
   * @param {object} orgData
   * @returns {Promise<object>} Created organization
   */
  create: (orgData) => api.post('/organizations', orgData),
};

// ============================================================
// NOTIFICATION ENDPOINTS
// ============================================================
export const notifications = {
  /**
   * Get user notifications
   * @param {{ skip?: number, limit?: number, unread_only?: boolean }} params
   * @returns {Promise<object[]>} List of notifications
   */
  getAll: (params = {}) => api.get('/notifications', { params }),

  /**
   * Mark notification as read
   * @param {string} notificationId
   * @returns {Promise<void>}
   */
  markRead: (notificationId) => api.post(`/notifications/${notificationId}/read`),

  /**
   * Mark all notifications as read
   * @returns {Promise<void>}
   */
  markAllRead: () => api.post('/notifications/read-all'),

  /**
   * Get unread count
   * @returns {Promise<{ count: number }>}
   */
  getUnreadCount: () => api.get('/notifications/unread-count'),
};

// ============================================================
// MEDIA ENDPOINTS
// ============================================================
export const media = {
  /**
   * Upload media file
   * @param {FormData} formData
   * @returns {Promise<object>} Uploaded media info
   */
  upload: (formData) => api.post('/media/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),

  /**
   * Get user's media files
   * @param {{ media_type?: string }} params
   * @returns {Promise<object[]>} List of media files
   */
  getAll: (params = {}) => api.get('/media', { params }),
};

// ============================================================
// AI/AGENT ENDPOINTS
// ============================================================
export const ai = {
  /**
   * Chat with AI agent
   * @param {{ message: string, conversation_id?: string }} data
   * @returns {Promise<object>} AI response
   */
  chat: (data) => api.post('/agent/chat', data),

  /**
   * Analyze file with AI
   * @param {FormData} formData
   * @returns {Promise<object>} Analysis result
   */
  analyzeFile: (formData) => api.post('/agent/analyze-file-upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),

  /**
   * Get conversation history
   * @returns {Promise<object[]>} List of conversations
   */
  getConversations: () => api.get('/agent/conversations'),
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Set auth token (usually after login)
 * @param {string} token
 */
export const setAuthToken = (token) => {
  localStorage.setItem('zion_token', token);
};

/**
 * Get current auth token
 * @returns {string|null}
 */
export const getAuthToken = () => {
  return localStorage.getItem('zion_token');
};

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
export const isAuthenticated = () => {
  return !!localStorage.getItem('zion_token');
};

// Export the axios instance for custom requests
export default api;
