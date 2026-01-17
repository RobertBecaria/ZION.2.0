/**
 * usePosts Hook
 * Manages post fetching, reactions, and comments
 * Centralizes post-related API logic for reuse across components
 */
import { useState, useCallback, useRef } from 'react';
import { BACKEND_URL } from '../config/api';

const usePosts = (options = {}) => {
  const {
    feedType = 'family', // 'family', 'news', 'channel', 'profile'
    familyId = null,
    channelId = null,
    userId = null,
    pageSize = 10
  } = options;

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(1);

  // Get token from localStorage
  const getToken = () => localStorage.getItem('zion_token');

  // Build API URL based on feed type
  const buildUrl = useCallback((page = 1) => {
    const baseParams = `?page=${page}&per_page=${pageSize}`;

    switch (feedType) {
      case 'family':
        return familyId
          ? `${BACKEND_URL}/api/family/${familyId}/posts${baseParams}`
          : null;
      case 'channel':
        return channelId
          ? `${BACKEND_URL}/api/channels/${channelId}/posts${baseParams}`
          : null;
      case 'profile':
        return userId
          ? `${BACKEND_URL}/api/wall/user/${userId}${baseParams}`
          : null;
      case 'news':
        return `${BACKEND_URL}/api/wall/feed${baseParams}`;
      default:
        return null;
    }
  }, [feedType, familyId, channelId, userId, pageSize]);

  // Fetch posts
  const fetchPosts = useCallback(async (reset = false) => {
    const url = buildUrl(reset ? 1 : pageRef.current);
    if (!url) return;

    setLoading(true);
    setError(null);

    try {
      const token = getToken();
      const response = await fetch(url, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      if (!response.ok) throw new Error('Failed to fetch posts');

      const data = await response.json();
      const newPosts = data.posts || data.data || [];

      if (reset) {
        setPosts(newPosts);
        pageRef.current = 2;
      } else {
        setPosts(prev => [...prev, ...newPosts]);
        pageRef.current += 1;
      }

      setHasMore(newPosts.length === pageSize);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [buildUrl, pageSize]);

  // Handle post like/reaction
  const handleReaction = useCallback(async (postId, reactionType = 'LIKE') => {
    const token = getToken();
    if (!token) return { success: false, error: 'Not authenticated' };

    try {
      const response = await fetch(`${BACKEND_URL}/api/wall/posts/${postId}/react`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reaction_type: reactionType })
      });

      if (!response.ok) throw new Error('Failed to react to post');

      const data = await response.json();

      // Update local state
      setPosts(prev => prev.map(post =>
        post.id === postId
          ? {
              ...post,
              like_count: data.like_count ?? post.like_count,
              my_reaction: data.my_reaction ?? post.my_reaction
            }
          : post
      ));

      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  // Add comment to post
  const addComment = useCallback(async (postId, content, parentId = null) => {
    const token = getToken();
    if (!token) return { success: false, error: 'Not authenticated' };

    try {
      const response = await fetch(`${BACKEND_URL}/api/wall/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content, parent_id: parentId })
      });

      if (!response.ok) throw new Error('Failed to add comment');

      const data = await response.json();

      // Update comment count in local state
      setPosts(prev => prev.map(post =>
        post.id === postId
          ? { ...post, comment_count: (post.comment_count || 0) + 1 }
          : post
      ));

      return { success: true, comment: data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  // Fetch comments for a post
  const fetchComments = useCallback(async (postId) => {
    const token = getToken();

    try {
      const response = await fetch(`${BACKEND_URL}/api/wall/posts/${postId}/comments`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      if (!response.ok) throw new Error('Failed to fetch comments');

      const data = await response.json();
      return { success: true, comments: data.comments || [] };
    } catch (err) {
      return { success: false, error: err.message, comments: [] };
    }
  }, []);

  // Create new post
  const createPost = useCallback(async (postData) => {
    const token = getToken();
    if (!token) return { success: false, error: 'Not authenticated' };

    try {
      const response = await fetch(`${BACKEND_URL}/api/wall/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(postData)
      });

      if (!response.ok) throw new Error('Failed to create post');

      const data = await response.json();

      // Add new post to beginning of list
      setPosts(prev => [data.post || data, ...prev]);

      return { success: true, post: data.post || data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  // Delete post
  const deletePost = useCallback(async (postId) => {
    const token = getToken();
    if (!token) return { success: false, error: 'Not authenticated' };

    try {
      const response = await fetch(`${BACKEND_URL}/api/wall/posts/${postId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to delete post');

      // Remove post from local state
      setPosts(prev => prev.filter(post => post.id !== postId));

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  // Reset and refresh posts
  const refresh = useCallback(() => {
    pageRef.current = 1;
    fetchPosts(true);
  }, [fetchPosts]);

  return {
    posts,
    loading,
    error,
    hasMore,
    fetchPosts,
    refresh,
    handleReaction,
    addComment,
    fetchComments,
    createPost,
    deletePost
  };
};

export default usePosts;
