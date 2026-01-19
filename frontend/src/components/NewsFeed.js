/**
 * NewsFeed Component (Refactored)
 * News feed with post creation and visibility options
 * Uses shared wall components for post display and interactions
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Users, Globe, Lock, UserCheck, Image, Link2, 
  MessageCircle, Send, ChevronDown, X, Loader2,
  Plus, Smile
} from 'lucide-react';
import { PostItem } from './wall';
import { toast } from '../utils/animations';

// Visibility options specific to News feed
const VISIBILITY_OPTIONS = [
  { 
    id: 'PUBLIC', 
    label: 'Публичный', 
    icon: Globe, 
    description: 'Все могут видеть'
  },
  { 
    id: 'FRIENDS_AND_FOLLOWERS', 
    label: 'Друзья и подписчики', 
    icon: UserCheck, 
    description: 'Друзья и те, кто подписан на вас'
  },
  { 
    id: 'FRIENDS_ONLY', 
    label: 'Только друзья', 
    icon: Users, 
    description: 'Только ваши друзья'
  }
];

// Common emojis for quick access
const QUICK_EMOJIS = ['😀', '😂', '❤️', '👍', '🎉', '🔥', '✨', '🙌', '💪', '🤔', '👏', '💯'];

const NewsFeed = ({ 
  user, 
  moduleColor = '#1D4ED8',
  channelId = null,
  channelName = null
}) => {
  // Posts state
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  
  // Composer state
  const [newPostContent, setNewPostContent] = useState('');
  const [postVisibility, setPostVisibility] = useState('PUBLIC');
  const [showVisibilityMenu, setShowVisibilityMenu] = useState(false);
  const [posting, setPosting] = useState(false);
  
  // Media and link states
  const [selectedImages, setSelectedImages] = useState([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [youtubeLinks, setYoutubeLinks] = useState([]);
  const [linkPreviews, setLinkPreviews] = useState([]);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkInputValue, setLinkInputValue] = useState('');
  const [fetchingPreview, setFetchingPreview] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  // Comments state (per-post)
  const [expandedComments, setExpandedComments] = useState({});
  const [postComments, setPostComments] = useState({});
  const [newComments, setNewComments] = useState({});
  
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const LIMIT = 20;

  // Load posts
  const loadPosts = useCallback(async (reset = false) => {
    try {
      const token = localStorage.getItem('zion_token');
      const currentOffset = reset ? 0 : offset;
      
      const endpoint = channelId 
        ? `${BACKEND_URL}/api/news/posts/channel/${channelId}?limit=${LIMIT}&offset=${currentOffset}`
        : `${BACKEND_URL}/api/news/posts/feed?limit=${LIMIT}&offset=${currentOffset}`;
      
      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (reset) {
          setPosts(data.posts || []);
          setOffset(LIMIT);
        } else {
          setPosts(prev => [...prev, ...(data.posts || [])]);
          setOffset(prev => prev + LIMIT);
        }
        setHasMore(data.has_more || false);
      }
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
    }
  }, [BACKEND_URL, channelId, offset]);

  // Load posts on mount and channel change
  useEffect(() => {
    loadPosts(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  // Load comments for a post
  const loadComments = async (postId) => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/news/posts/${postId}/comments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setPostComments(prev => ({ ...prev, [postId]: data.comments || [] }));
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  // Toggle comments visibility
  const handleToggleComments = (postId) => {
    const isExpanded = expandedComments[postId];
    setExpandedComments(prev => ({ ...prev, [postId]: !isExpanded }));
    
    if (!isExpanded && !postComments[postId]) {
      loadComments(postId);
    }
  };

  // Handle image selection
  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    const remainingSlots = 10 - selectedImages.length;
    const newFiles = files.slice(0, remainingSlots);
    
    const newImages = newFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      id: Math.random().toString(36).substr(2, 9)
    }));
    
    setSelectedImages(prev => [...prev, ...newImages]);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (imageId) => {
    setSelectedImages(prev => {
      const updated = prev.filter(img => img.id !== imageId);
      const removed = prev.find(img => img.id === imageId);
      if (removed) URL.revokeObjectURL(removed.preview);
      return updated;
    });
  };

  const uploadImages = async () => {
    if (selectedImages.length === 0) return [];
    
    setUploadingImages(true);
    const uploadedIds = [];
    
    try {
      const token = localStorage.getItem('zion_token');
      
      for (const img of selectedImages) {
        const formData = new FormData();
        formData.append('file', img.file);
        formData.append('source_module', 'community');
        
        const response = await fetch(`${BACKEND_URL}/api/media/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        
        if (response.ok) {
          const data = await response.json();
          uploadedIds.push(data.id || data.file_id);
        }
      }
    } catch (error) {
      console.error('Error uploading images:', error);
    } finally {
      setUploadingImages(false);
    }
    
    return uploadedIds;
  };

  const handleAddLink = async () => {
    if (!linkInputValue.trim()) return;
    
    setFetchingPreview(true);
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/utils/link-preview`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: linkInputValue.trim() })
      });
      
      if (response.ok) {
        const preview = await response.json();
        
        if (preview.is_youtube && preview.youtube_id) {
          setYoutubeLinks(prev => [...prev, {
            id: preview.youtube_id,
            url: linkInputValue.trim(),
            thumbnail: preview.image
          }]);
        } else if (preview.title || preview.image) {
          setLinkPreviews(prev => [...prev, {
            ...preview,
            localId: Math.random().toString(36).substr(2, 9)
          }]);
        }
        
        setLinkInputValue('');
        setShowLinkInput(false);
      }
    } catch (error) {
      console.error('Error fetching link preview:', error);
    } finally {
      setFetchingPreview(false);
    }
  };

  const removeYoutubeLink = (youtubeId) => {
    setYoutubeLinks(prev => prev.filter(link => link.id !== youtubeId));
  };

  const removeLinkPreview = (localId) => {
    setLinkPreviews(prev => prev.filter(link => link.localId !== localId));
  };

  const addEmoji = (emoji) => {
    setNewPostContent(prev => prev + emoji);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim() && selectedImages.length === 0 && youtubeLinks.length === 0) return;
    
    setPosting(true);
    try {
      const mediaIds = await uploadImages();
      
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/news/posts`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: newPostContent,
          visibility: postVisibility,
          channel_id: channelId,
          media_files: mediaIds,
          youtube_urls: youtubeLinks.map(l => l.url),
          link_previews: linkPreviews.map(l => ({ url: l.url, title: l.title, image: l.image }))
        })
      });

      if (response.ok) {
        setNewPostContent('');
        setSelectedImages([]);
        setYoutubeLinks([]);
        setLinkPreviews([]);
        loadPosts(true);
      }
    } catch (error) {
      console.error('Error creating post:', error);
    } finally {
      setPosting(false);
    }
  };

  // Post interaction handlers
  const handleLike = async (postId) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    
    try {
      const token = localStorage.getItem('zion_token');
      const method = post.is_liked ? 'DELETE' : 'POST';
      
      await fetch(`${BACKEND_URL}/api/news/posts/${postId}/like`, {
        method,
        headers: { 'Authorization': `Bearer ${token}` }
      });

      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            is_liked: !p.is_liked,
            likes_count: p.is_liked ? p.likes_count - 1 : p.likes_count + 1
          };
        }
        return p;
      }));
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleReaction = async (postId, emoji) => {
    try {
      const token = localStorage.getItem('zion_token');
      
      await fetch(`${BACKEND_URL}/api/news/posts/${postId}/reaction`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ emoji })
      });

      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            user_reaction: emoji,
            reactions_count: (post.reactions_count || 0) + 1
          };
        }
        return post;
      }));
    } catch (error) {
      console.error('Error adding reaction:', error);
      // Optimistic UI update even on error
      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          return { ...post, user_reaction: emoji };
        }
        return post;
      }));
    }
  };

  const handleDelete = async (postId) => {
    if (!window.confirm('Удалить этот пост?')) return;
    
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/news/posts/${postId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setPosts(prev => prev.filter(p => p.id !== postId));
      } else {
        const data = await response.json();
        toast.error(data.detail || 'Не удалось удалить пост');
      }
    } catch (error) {
      console.error('Error deleting post:', error);
      toast.error('Ошибка при удалении поста');
    }
  };

  const handleEdit = async (post) => {
    const newContent = window.prompt('Редактировать пост:', post.content);
    if (newContent === null || newContent === post.content) return;
    
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/news/posts/${post.id}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: newContent,
          visibility: post.visibility
        })
      });

      if (response.ok) {
        const updatedPost = await response.json();
        setPosts(prev => prev.map(p => {
          if (p.id === post.id) {
            return { ...p, content: updatedPost.content };
          }
          return p;
        }));
      }
    } catch (error) {
      console.error('Error editing post:', error);
    }
  };

  // Comment handlers
  const handleNewCommentChange = (postId, value) => {
    setNewComments(prev => ({ ...prev, [postId]: value }));
  };

  const handleCommentSubmit = async (postId, content, parentId = null) => {
    if (!content?.trim()) return;
    
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/news/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content,
          parent_comment_id: parentId
        })
      });
      
      if (response.ok) {
        const newComment = await response.json();
        
        if (parentId) {
          // Add reply to parent comment
          setPostComments(prev => ({
            ...prev,
            [postId]: prev[postId]?.map(c => {
              if (c.id === parentId) {
                return { ...c, replies: [...(c.replies || []), newComment] };
              }
              return c;
            }) || []
          }));
        } else {
          // Add as top-level comment
          setPostComments(prev => ({
            ...prev,
            [postId]: [...(prev[postId] || []), newComment]
          }));
          
          // Update post comments count
          setPosts(prev => prev.map(p => {
            if (p.id === postId) {
              return { ...p, comments_count: (p.comments_count || 0) + 1 };
            }
            return p;
          }));
        }
        
        setNewComments(prev => ({ ...prev, [postId]: '' }));
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
    }
  };

  const handleCommentLike = async (commentId) => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/news/comments/${commentId}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Update comment in state
        setPostComments(prev => {
          const updated = { ...prev };
          Object.keys(updated).forEach(postId => {
            updated[postId] = updated[postId]?.map(c => {
              if (c.id === commentId) {
                return { ...c, user_liked: data.liked, likes_count: data.likes_count };
              }
              if (c.replies) {
                c.replies = c.replies.map(r => {
                  if (r.id === commentId) {
                    return { ...r, user_liked: data.liked, likes_count: data.likes_count };
                  }
                  return r;
                });
              }
              return c;
            });
          });
          return updated;
        });
      }
    } catch (error) {
      console.error('Error liking comment:', error);
    }
  };

  const handleCommentEdit = async (commentId, newContent) => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/news/comments/${commentId}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: newContent })
      });
      
      if (response.ok) {
        setPostComments(prev => {
          const updated = { ...prev };
          Object.keys(updated).forEach(postId => {
            updated[postId] = updated[postId]?.map(c => {
              if (c.id === commentId) {
                return { ...c, content: newContent, is_edited: true };
              }
              if (c.replies) {
                c.replies = c.replies.map(r => {
                  if (r.id === commentId) {
                    return { ...r, content: newContent, is_edited: true };
                  }
                  return r;
                });
              }
              return c;
            });
          });
          return updated;
        });
      }
    } catch (error) {
      console.error('Error editing comment:', error);
    }
  };

  const handleCommentDelete = async (commentId) => {
    if (!window.confirm('Удалить комментарий?')) return;
    
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/news/comments/${commentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        setPostComments(prev => {
          const updated = { ...prev };
          Object.keys(updated).forEach(postId => {
            updated[postId] = updated[postId]?.filter(c => c.id !== commentId).map(c => {
              if (c.replies) {
                c.replies = c.replies.filter(r => r.id !== commentId);
              }
              return c;
            });
          });
          return updated;
        });
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  // Utility functions
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин. назад`;
    if (diffHours < 24) return `${diffHours} ч. назад`;
    if (diffDays < 7) return `${diffDays} дн. назад`;
    
    return date.toLocaleDateString('ru-RU');
  };

  const getVisibilityOption = (id) => {
    return VISIBILITY_OPTIONS.find(v => v.id === id) || VISIBILITY_OPTIONS[0];
  };

  const selectedVisibility = getVisibilityOption(postVisibility);
  const hasContent = newPostContent.trim() || selectedImages.length > 0 || youtubeLinks.length > 0;

  return (
    <div className="news-feed">
      {/* Post Composer */}
      <div className="post-composer enhanced">
        <div className="composer-header">
          <div className="composer-avatar">
            {user?.profile_picture ? (
              <img src={user.profile_picture} alt="" />
            ) : (
              <div 
                className="avatar-placeholder"
                style={{ backgroundColor: moduleColor }}
              >
                {user?.first_name?.[0] || '?'}
              </div>
            )}
          </div>
          <div className="composer-input-wrapper">
            <textarea
              ref={textareaRef}
              placeholder={channelId ? `Написать в ${channelName || 'канал'}...` : "Что нового?"}
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        {/* Selected Images Preview */}
        {selectedImages.length > 0 && (
          <div className="composer-images-preview">
            {selectedImages.map(img => (
              <div key={img.id} className="image-preview-item">
                <img src={img.preview} alt="Preview" />
                <button 
                  className="remove-image-btn"
                  onClick={() => removeImage(img.id)}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {selectedImages.length < 10 && (
              <button 
                className="add-more-images-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <Plus size={20} />
              </button>
            )}
          </div>
        )}

        {/* YouTube Previews */}
        {youtubeLinks.length > 0 && (
          <div className="composer-youtube-preview">
            {youtubeLinks.map(link => (
              <div key={link.id} className="youtube-preview-item">
                <div className="youtube-thumbnail">
                  <img src={link.thumbnail} alt="YouTube" />
                </div>
                <button 
                  className="remove-youtube-btn"
                  onClick={() => removeYoutubeLink(link.id)}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Link Previews */}
        {linkPreviews.length > 0 && (
          <div className="composer-link-previews">
            {linkPreviews.map(link => (
              <div key={link.localId} className="link-preview-item">
                {link.image && (
                  <div className="link-preview-image">
                    <img src={link.image} alt="" />
                  </div>
                )}
                <div className="link-preview-content">
                  <div className="link-preview-site">{link.site_name || new URL(link.url).hostname}</div>
                  <div className="link-preview-title">{link.title || link.url}</div>
                  {link.description && (
                    <div className="link-preview-desc">{link.description}</div>
                  )}
                </div>
                <button 
                  className="remove-link-btn"
                  onClick={() => removeLinkPreview(link.localId)}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Link Input Field */}
        {showLinkInput && (
          <div className="link-input-wrapper">
            <input
              type="url"
              placeholder="Вставьте ссылку (YouTube, веб-сайт)..."
              value={linkInputValue}
              onChange={(e) => setLinkInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddLink()}
              autoFocus
            />
            <button 
              className="add-link-btn"
              onClick={handleAddLink}
              disabled={fetchingPreview || !linkInputValue.trim()}
            >
              {fetchingPreview ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
            </button>
            <button 
              className="cancel-link-btn"
              onClick={() => {
                setShowLinkInput(false);
                setLinkInputValue('');
              }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div className="emoji-picker">
            {QUICK_EMOJIS.map(emoji => (
              <button 
                key={emoji}
                className="emoji-btn"
                onClick={() => addEmoji(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <div className="composer-footer">
          <div className="composer-attachments">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageSelect}
              style={{ display: 'none' }}
            />
            <button 
              className={`attachment-btn ${selectedImages.length > 0 ? 'active' : ''}`}
              title="Добавить фото"
              onClick={() => fileInputRef.current?.click()}
              style={selectedImages.length > 0 ? { color: moduleColor } : {}}
            >
              <Image size={20} />
              {selectedImages.length > 0 && (
                <span className="attachment-count">{selectedImages.length}</span>
              )}
            </button>
            <button 
              className={`attachment-btn ${youtubeLinks.length > 0 || linkPreviews.length > 0 ? 'active' : ''}`}
              title="Добавить ссылку"
              onClick={() => setShowLinkInput(!showLinkInput)}
              style={youtubeLinks.length > 0 || linkPreviews.length > 0 ? { color: moduleColor } : {}}
            >
              <Link2 size={20} />
            </button>
            <button 
              className="attachment-btn"
              title="Добавить эмодзи"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              <Smile size={20} />
            </button>
          </div>

          <div className="composer-actions">
            {!channelId && (
              <div className="visibility-selector">
                <button 
                  className="visibility-btn"
                  onClick={() => setShowVisibilityMenu(!showVisibilityMenu)}
                >
                  <selectedVisibility.icon size={16} />
                  <span>{selectedVisibility.label}</span>
                  <ChevronDown size={14} />
                </button>
                
                {showVisibilityMenu && (
                  <div className="visibility-menu">
                    {VISIBILITY_OPTIONS.map(option => (
                      <button
                        key={option.id}
                        className={`visibility-option ${postVisibility === option.id ? 'selected' : ''}`}
                        onClick={() => {
                          setPostVisibility(option.id);
                          setShowVisibilityMenu(false);
                        }}
                      >
                        <option.icon size={18} />
                        <div className="option-text">
                          <span className="option-label">{option.label}</span>
                          <span className="option-desc">{option.description}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button 
              className="post-btn"
              onClick={handleCreatePost}
              disabled={!hasContent || posting || uploadingImages}
              style={{ backgroundColor: moduleColor }}
            >
              {posting || uploadingImages ? (
                <>
                  <Loader2 size={16} className="spin" />
                  {uploadingImages ? 'Загрузка...' : 'Публикация...'}
                </>
              ) : (
                'Опубликовать'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Posts List - Using shared PostItem component */}
      <div className="posts-list">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Загрузка ленты...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="empty-state">
            <MessageCircle size={48} color="#9CA3AF" />
            <h3>Пока нет публикаций</h3>
            <p>{channelId ? 'В этом канале пока нет записей' : 'Будьте первым, кто что-то напишет!'}</p>
          </div>
        ) : (
          <>
            {posts.map(post => (
              <PostItem
                key={post.id}
                post={post}
                user={user}
                moduleColor={moduleColor}
                backendUrl={BACKEND_URL}
                showComments={expandedComments[post.id]}
                comments={postComments[post.id]}
                newComment={newComments[post.id] || ''}
                onLike={handleLike}
                onReaction={handleReaction}
                onToggleComments={handleToggleComments}
                onNewCommentChange={handleNewCommentChange}
                onCommentSubmit={handleCommentSubmit}
                onCommentLike={handleCommentLike}
                onCommentEdit={handleCommentEdit}
                onCommentDelete={handleCommentDelete}
                onPostEdit={handleEdit}
                onPostDelete={handleDelete}
                formatDate={formatDate}
                visibilityOptions={{
                  'PUBLIC': { icon: Globe, label: 'Публичный' },
                  'FRIENDS_AND_FOLLOWERS': { icon: UserCheck, label: 'Друзья и подписчики' },
                  'FRIENDS_ONLY': { icon: Users, label: 'Только друзья' }
                }}
              />
            ))}
            
            {hasMore && (
              <button 
                className="load-more-btn"
                onClick={() => loadPosts()}
              >
                Загрузить ещё
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default NewsFeed;
