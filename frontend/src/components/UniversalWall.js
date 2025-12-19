import React, { useState, useEffect, useCallback } from 'react';
import { MessageCircle } from 'lucide-react';
import { useLightbox } from '../hooks/useLightbox';
import LightboxModal from './LightboxModal';
import WorkUniversalFeed from './WorkUniversalFeed';
import JournalUniversalFeed from './JournalUniversalFeed';
import PostComposer from './wall/PostComposer';
import PostItem from './wall/PostItem';

function UniversalWall({ 
  activeGroup, 
  moduleColor = "#059669",
  moduleName = "Family",
  user,
  activeModule = 'family',
  activeFilters = [],
  userFamilyId = null,
  schoolRoles = null,
  journalSchoolFilter = 'all',
  journalAudienceFilter = 'all'
}) {
  // State
  const [posts, setPosts] = useState([]);
  const [showComments, setShowComments] = useState({});
  const [comments, setComments] = useState({});
  const [newComment, setNewComment] = useState({});
  
  // Lightbox hook
  const {
    lightboxImage,
    lightboxImages,
    lightboxIndex,
    openLightbox,
    closeLightbox,
    nextImage,
    prevImage
  } = useLightbox();
  
  const backendUrl = process.env.REACT_APP_BACKEND_URL;

  // Fetch posts (memoized to avoid re-creation)
  const fetchPosts = useCallback(async () => {
    try {
      const token = localStorage.getItem('zion_token');
      let url = `${backendUrl}/api/posts?module=${activeModule}`;
      
      if (activeModule === 'family' && activeFilters.length > 0) {
        activeFilters.forEach(filter => {
          if (filter === 'my-family' && userFamilyId) {
            url += `&family_id=${userFamilyId}`;
          } else if (filter === 'subscribed') {
            url += `&filter=subscribed`;
          } else if (filter === 'public') {
            url += `&visibility=PUBLIC`;
          } else if (filter === 'household') {
            url += `&visibility=HOUSEHOLD_ONLY`;
          } else if (filter === 'gender-male') {
            url += `&visibility=GENDER_MALE`;
          } else if (filter === 'gender-female') {
            url += `&visibility=GENDER_FEMALE`;
          } else if (filter === 'gender-it') {
            url += `&visibility=GENDER_IT`;
          }
        });
      }
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const postsData = await response.json();
        setPosts(postsData);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    }
  }, [backendUrl, activeModule, activeFilters, userFamilyId]);

  // Fetch comments for a post
  const fetchComments = async (postId) => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${backendUrl}/api/posts/${postId}/comments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const commentsData = await response.json();
        setComments(prev => ({ ...prev, [postId]: commentsData }));
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  // Main data fetching effect
  useEffect(() => {
    if (activeModule === 'organizations' || activeModule === 'journal') return;
    
    fetchPosts();
    
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        const modal = document.querySelector('.post-composer-modal');
        if (modal && modal.style.display === 'flex') {
          modal.style.display = 'none';
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeGroup, activeModule, activeFilters, backendUrl, userFamilyId]);

  // Conditional returns for other modules
  if (activeModule === 'organizations') {
    return <WorkUniversalFeed currentUserId={user?.id} />;
  }
  
  if (activeModule === 'journal') {
    return (
      <JournalUniversalFeed 
        currentUserId={user?.id} 
        schoolRoles={schoolRoles} 
        user={user}
        schoolFilter={journalSchoolFilter}
        audienceFilter={journalAudienceFilter}
      />
    );
  }

  // Handle like
  const handleLike = async (postId) => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${backendUrl}/api/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const result = await response.json();
        setPosts(posts.map(post => {
          if (post.id === postId) {
            return {
              ...post,
              user_liked: result.liked,
              likes_count: result.liked ? post.likes_count + 1 : post.likes_count - 1
            };
          }
          return post;
        }));
      }
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  // Handle reaction
  const handleReaction = async (postId, emoji) => {
    try {
      const token = localStorage.getItem('zion_token');
      const formData = new FormData();
      formData.append('emoji', emoji);

      const response = await fetch(`${backendUrl}/api/posts/${postId}/reactions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        fetchPosts();
      }
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  // Toggle comments visibility
  const toggleComments = (postId) => {
    setShowComments(prev => ({ ...prev, [postId]: !prev[postId] }));
    if (!comments[postId]) {
      fetchComments(postId);
    }
  };

  // Handle new comment change
  const handleNewCommentChange = (postId, value) => {
    setNewComment(prev => ({ ...prev, [postId]: value }));
  };

  // Handle comment submit
  const handleCommentSubmit = async (postId, content, parentCommentId = null) => {
    if (!content.trim()) return;

    try {
      const token = localStorage.getItem('zion_token');
      const formData = new FormData();
      formData.append('content', content);
      if (parentCommentId) {
        formData.append('parent_comment_id', parentCommentId);
      }

      const response = await fetch(`${backendUrl}/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        await fetchComments(postId);
        fetchPosts();
        setNewComment(prev => ({ ...prev, [postId]: '' }));
      }
    } catch (error) {
      console.error('Error creating comment:', error);
    }
  };

  // Handle comment like
  const handleCommentLike = async (commentId) => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${backendUrl}/api/comments/${commentId}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        Object.keys(comments).forEach(postId => fetchComments(postId));
      }
    } catch (error) {
      console.error('Error liking comment:', error);
    }
  };

  // Handle comment edit
  const handleCommentEdit = async (commentId, newContent) => {
    try {
      const token = localStorage.getItem('zion_token');
      const formData = new FormData();
      formData.append('content', newContent);

      const response = await fetch(`${backendUrl}/api/comments/${commentId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        Object.keys(comments).forEach(postId => fetchComments(postId));
      }
    } catch (error) {
      console.error('Error editing comment:', error);
    }
  };

  // Handle comment delete
  const handleCommentDelete = async (commentId) => {
    if (!window.confirm('Удалить комментарий?')) return;

    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${backendUrl}/api/comments/${commentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        Object.keys(comments).forEach(postId => fetchComments(postId));
        fetchPosts();
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  return (
    <div className="universal-wall">
      {/* Post Composer */}
      <PostComposer
        user={user}
        moduleColor={moduleColor}
        moduleName={moduleName}
        backendUrl={backendUrl}
        onPostCreated={fetchPosts}
      />

      {/* Posts Feed */}
      <div className="posts-feed">
        {posts.length === 0 ? (
          <div className="empty-feed">
            <div className="empty-content">
              <MessageCircle size={48} color="#9ca3af" />
              <h4>Пока нет записей</h4>
              <p>Станьте первым, кто поделится новостями!</p>
            </div>
          </div>
        ) : (
          posts.map((post) => (
            <PostItem
              key={post.id}
              post={post}
              moduleColor={moduleColor}
              user={user}
              backendUrl={backendUrl}
              showComments={showComments[post.id]}
              comments={comments[post.id]}
              newComment={newComment[post.id]}
              onLike={handleLike}
              onReaction={handleReaction}
              onToggleComments={toggleComments}
              onNewCommentChange={handleNewCommentChange}
              onCommentSubmit={handleCommentSubmit}
              onCommentLike={handleCommentLike}
              onCommentEdit={handleCommentEdit}
              onCommentDelete={handleCommentDelete}
              onImageClick={openLightbox}
            />
          ))
        )}
      </div>

      {/* Lightbox Modal */}
      <LightboxModal
        lightboxImage={lightboxImage}
        lightboxImages={lightboxImages}
        lightboxIndex={lightboxIndex}
        closeLightbox={closeLightbox}
        nextImage={nextImage}
        prevImage={prevImage}
      />
    </div>
  );
}

export default UniversalWall;
