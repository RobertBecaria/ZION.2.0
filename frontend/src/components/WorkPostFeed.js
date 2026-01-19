import React, { useState, useEffect } from 'react';
import { AlertCircle, FileText } from 'lucide-react';
import WorkPostComposer from './WorkPostComposer';
import WorkPostCard from './WorkPostCard';
import { toast } from '../utils/animations';

import { BACKEND_URL } from '../config/api';
const WorkPostFeed = ({ organizationId, organizationName, currentUserId, isAdmin, canPost }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (organizationId) {
      loadPosts();
    }
  }, [organizationId]);

  const loadPosts = async () => {
    setLoading(true);
    setError(null);

    try {
            const token = localStorage.getItem('zion_token');

      const response = await fetch(`${BACKEND_URL}/api/work/organizations/${organizationId}/posts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Не удалось загрузить посты');
      }

      const data = await response.json();
      setPosts(data.posts || []);
    } catch (error) {
      console.error('Load posts error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePostCreated = (newPost) => {
    setPosts(prev => [newPost, ...prev]);
  };

  const handleDelete = async (postId) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот пост?')) return;

    try {
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
      toast.error('Не удалось удалить пост');
    }
  };

  const handleLike = async (postId) => {
    try {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка постов...</p>
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
            onClick={loadPosts}
            className="px-6 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors duration-200 font-semibold"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Post Composer */}
      {canPost && (
        <WorkPostComposer
          organizationId={organizationId}
          organizationName={organizationName}
          onPostCreated={handlePostCreated}
        />
      )}

      {/* Posts Feed */}
      {posts.length > 0 ? (
        <div className="space-y-4">
          {posts.map(post => (
            <WorkPostCard
              key={post.id}
              post={post}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onDelete={handleDelete}
              onLike={handleLike}
              onComment={handleComment}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-md p-12 border border-gray-100 text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Пока нет постов</h3>
          <p className="text-gray-600">
            {canPost
              ? 'Станьте первым, кто опубликует что-то в этой организации!'
              : 'Посты появятся, когда участники начнут делиться обновлениями'
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default WorkPostFeed;