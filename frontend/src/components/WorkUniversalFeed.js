import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, FileText, Building2, Plus, Calendar, CheckCircle2 } from 'lucide-react';
import WorkPostCard from './WorkPostCard';
import WorkTasksPanel from './work/WorkTasksPanel';
import WorkTaskCreateModal from './work/WorkTaskCreateModal';

const WorkUniversalFeed = ({ currentUserId }) => {
  const [posts, setPosts] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [postContent, setPostContent] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    loadFeed();
    loadOrganizations();
  }, []);

  const loadFeed = async () => {
    setLoading(true);
    setError(null);

    try {
      const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem('zion_token');

      const response = await fetch(`${BACKEND_URL}/api/work/posts/feed`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Не удалось загрузить ленту');
      }

      const data = await response.json();
      setPosts(data.posts || []);
    } catch (error) {
      console.error('Load feed error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadOrganizations = async () => {
    try {
      const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem('zion_token');

      const response = await fetch(`${BACKEND_URL}/api/work/organizations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        const orgs = data.organizations || [];
        setOrganizations(orgs);
        // Select first org by default
        if (orgs.length > 0) {
          setSelectedOrg(orgs[0].id);
        }
      }
    } catch (error) {
      console.error('Load organizations error:', error);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!postContent.trim() || !selectedOrg) return;

    setPosting(true);
    try {
      const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem('zion_token');

      const response = await fetch(`${BACKEND_URL}/api/work/organizations/${selectedOrg}/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: postContent })
      });

      if (response.ok) {
        const data = await response.json();
        // Add organization info to the new post
        const org = organizations.find(o => o.id === selectedOrg);
        if (org) {
          data.post.organization_name = org.name;
          data.post.organization_logo = org.logo_url;
        }
        setPosts(prev => [data.post, ...prev]);
        setPostContent('');
      }
    } catch (error) {
      console.error('Create post error:', error);
      alert('Не удалось создать пост');
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (postId) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот пост?')) return;

    try {
      const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem('zion_token');

      const response = await fetch(`${BACKEND_URL}/api/work/posts/${postId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setPosts(prev => prev.filter(p => p.id !== postId));
      }
    } catch (error) {
      console.error('Delete post error:', error);
      alert('Не удалось удалить пост');
    }
  };

  const handleLike = async (postId) => {
    try {
      const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem('zion_token');

      const response = await fetch(`${BACKEND_URL}/api/work/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setPosts(prev => prev.map(post => 
          post.id === postId
            ? { ...post, user_has_liked: data.liked, likes_count: data.likes_count }
            : post
        ));
      }
    } catch (error) {
      console.error('Like post error:', error);
    }
  };

  const handleComment = (postId, newCommentsCount) => {
    setPosts(prev => prev.map(post => 
      post.id === postId
        ? { ...post, comments_count: newCommentsCount }
        : post
    ));
  };

  const moduleColor = '#C2410C';

  const handleTaskDiscuss = (postId) => {
    // Refresh feed to show the new discussion post
    loadFeed();
  };

  const refreshFeed = useCallback(() => {
    loadFeed();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка ленты...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Ошибка загрузки</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadFeed}
            className="px-6 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors duration-200 font-semibold"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="work-universal-feed-layout">
      {/* Left Column - Feed */}
      <div className="work-feed-main">
      {/* Post Composer */}
      {organizations.length > 0 && (
        <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100 mb-6">
          <form onSubmit={handleCreatePost}>
            {/* Organization Selector */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Опубликовать в:</label>
              <select
                value={selectedOrg}
                onChange={(e) => setSelectedOrg(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>

            <textarea
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              placeholder="Что у вас нового?..."
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
            />

            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                {postContent.length} / 5000 символов
              </p>
              <button
                type="submit"
                disabled={!postContent.trim() || !selectedOrg || posting}
                className="px-6 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-200 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {posting ? 'Публикация...' : 'Опубликовать'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Posts Feed */}
      {posts.length > 0 ? (
        <div className="space-y-4">
          {posts.map(post => (
            <div key={post.id}>
              {/* Organization Header */}
              <div className="flex items-center gap-2 mb-2 px-2">
                <div className="w-6 h-6 rounded bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-semibold text-orange-600">{post.organization_name}</span>
              </div>
              
              {/* Post Card */}
              <WorkPostCard
                post={post}
                currentUserId={currentUserId}
                isAdmin={false}
                onDelete={handleDelete}
                onLike={handleLike}
                onComment={handleComment}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-md p-12 border border-gray-100 text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Пока нет постов</h3>
          <p className="text-gray-600">
            {organizations.length > 0
              ? 'Станьте первым, кто опубликует что-то!'
              : 'Присоединитесь к организации, чтобы видеть посты'
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default WorkUniversalFeed;