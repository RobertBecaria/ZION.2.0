import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Plus, Heart, MessageCircle, User, Calendar, Trash2,
  Image, Paperclip, X, FileText, MoreHorizontal, Smile
} from 'lucide-react';

const JournalUniversalFeed = ({ 
  currentUserId, 
  schoolRoles, 
  user,
  schoolFilter = 'all',  // External school filter from World Zone
  audienceFilter: externalAudienceFilter = 'all'  // External audience filter from World Zone
}) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newPost, setNewPost] = useState('');
  const [selectedOrg, setSelectedOrg] = useState('all');
  const [selectedAudience, setSelectedAudience] = useState('PUBLIC');
  const [showPostModal, setShowPostModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [uploadedMediaIds, setUploadedMediaIds] = useState([]);
  const [showComments, setShowComments] = useState({});
  const [comments, setComments] = useState({});
  const [newComment, setNewComment] = useState({});
  const fileInputRef = useRef(null);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const moduleColor = '#6D28D9'; // Purple for Journal

  const AUDIENCE_OPTIONS = [
    { value: 'PUBLIC', label: '🌍 Публично (все)', icon: '🌍' },
    { value: 'TEACHERS', label: '👨‍🏫 Только учителя', icon: '👨‍🏫' },
    { value: 'PARENTS', label: '👨‍👩‍👧 Только родители', icon: '👨‍👩‍👧' },
    { value: 'STUDENTS_PARENTS', label: '📚 Ученики и родители', icon: '📚' }
  ];

  // Re-fetch posts when external filters change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchPosts();
  }, [schoolFilter, externalAudienceFilter]);


  const fetchPosts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('zion_token');
      
      // Get posts from all user's schools or filtered school
      const allPosts = [];
      
      if (schoolRoles) {
        // Fetch from schools where user is teacher
        if (schoolRoles.schools_as_teacher) {
          for (const school of schoolRoles.schools_as_teacher) {
            if (schoolFilter === 'all' || schoolFilter === school.organization_id) {
              let url = `${BACKEND_URL}/api/journal/organizations/${school.organization_id}/posts`;
              if (externalAudienceFilter !== 'all') {
                url += `?audience_filter=${externalAudienceFilter}`;
              }
              
              const response = await fetch(url, {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              });
              
              if (response.ok) {
                const data = await response.json();
                allPosts.push(...data);
              }
            }
          }
        }
        
        // Fetch from schools where user is parent
        if (schoolRoles.schools_as_parent) {
          for (const school of schoolRoles.schools_as_parent) {
            if (schoolFilter === 'all' || schoolFilter === school.organization_id) {
              let url = `${BACKEND_URL}/api/journal/organizations/${school.organization_id}/posts`;
              if (externalAudienceFilter !== 'all') {
                url += `?audience_filter=${externalAudienceFilter}`;
              }
              
              const response = await fetch(url, {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              });
              
              if (response.ok) {
                const data = await response.json();
                allPosts.push(...data);
              }
            }
          }
        }
      }
      
      // Remove duplicates and sort by date
      const uniquePosts = Array.from(new Map(allPosts.map(post => [post.post_id, post])).values());
      uniquePosts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      setPosts(uniquePosts);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async () => {
    if (!newPost.trim() || selectedOrg === 'all') {
      alert('Пожалуйста, выберите школу и введите текст поста');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${BACKEND_URL}/api/journal/organizations/${selectedOrg}/posts`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            content: newPost,
            audience_type: selectedAudience,
            media_file_ids: uploadedMediaIds,
            is_pinned: false
          })
        }
      );

      if (response.ok) {
        setNewPost('');
        setSelectedFiles([]);
        setUploadedMediaIds([]);
        setShowPostModal(false);
        fetchPosts();
      } else {
        const error = await response.json();
        alert(`Ошибка: ${error.detail || 'Не удалось создать пост'}`);
      }
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Произошла ошибка при создании поста');
    } finally {
      setLoading(false);
    }
  };

  const getAudienceLabel = (audienceType) => {
    const option = AUDIENCE_OPTIONS.find(o => o.value === audienceType);
    return option ? option.label : audienceType;
  };

  const getAllSchools = () => {
    const schools = [];
    if (schoolRoles) {
      if (schoolRoles.schools_as_teacher) {
        schools.push(...schoolRoles.schools_as_teacher.map(s => ({ ...s, role: 'teacher' })));
      }
      if (schoolRoles.schools_as_parent) {
        schools.push(...schoolRoles.schools_as_parent.map(s => ({ ...s, role: 'parent' })));
      }
    }
    return Array.from(new Map(schools.map(s => [s.organization_id, s])).values());
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60 * 1000) return 'только что';
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))} мин назад`;
    if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))} ч назад`;
    
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setSelectedFiles(prev => [...prev, ...files]);
    setUploadingFiles(files.map(f => f.name));

    try {
      const token = localStorage.getItem('zion_token');
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('source_module', 'personal');
        formData.append('privacy_level', selectedAudience);

        const response = await fetch(`${BACKEND_URL}/api/media/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (response.ok) {
          const result = await response.json();
          return result.id;
        } else {
          throw new Error(`Failed to upload ${file.name}`);
        }
      });

      const uploadedIds = await Promise.all(uploadPromises);
      setUploadedMediaIds(prev => [...prev, ...uploadedIds]);
      setUploadingFiles([]);
    } catch (error) {
      console.error('Error uploading files:', error);
      alert(`Ошибка загрузки: ${error.message}`);
      setUploadingFiles([]);
      setSelectedFiles(prev => prev.slice(0, -files.length));
    }
  };

  const removeSelectedFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setUploadedMediaIds(prev => prev.filter((_, i) => i !== index));
  };

  const showPostForm = () => {
    setShowPostModal(true);
  };

  const handleLike = async (postId) => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/journal/posts/${postId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        // Update post in local state
        setPosts(posts.map(post => {
          if (post.post_id === postId) {
            return {
              ...post,
              user_liked: result.liked,
              likes_count: result.likes_count
            };
          }
          return post;
        }));
      }
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const toggleComments = async (postId) => {
    const newShowState = !showComments[postId];
    setShowComments(prev => ({
      ...prev,
      [postId]: newShowState
    }));
    
    // Load comments if opening and not already loaded
    if (newShowState && !comments[postId]) {
      await fetchComments(postId);
    }
  };

  const fetchComments = async (postId) => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/journal/posts/${postId}/comments`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const commentsData = await response.json();
        setComments(prev => ({
          ...prev,
          [postId]: commentsData
        }));
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleCommentSubmit = async (postId, content) => {
    if (!content?.trim()) return;

    try {
      const token = localStorage.getItem('zion_token');
      const formData = new FormData();
      formData.append('content', content);

      const response = await fetch(`${BACKEND_URL}/api/journal/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        // Refresh comments and update post count
        await fetchComments(postId);
        
        // Update post comments count
        setPosts(posts.map(post => {
          if (post.post_id === postId) {
            return {
              ...post,
              comments_count: (post.comments_count || 0) + 1
            };
          }
          return post;
        }));
        
        // Clear comment input
        setNewComment(prev => ({
          ...prev,
          [postId]: ''
        }));
      }
    } catch (error) {
      console.error('Error creating comment:', error);
    }
  };

  const handleCommentLike = async (commentId, postId) => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/journal/comments/${commentId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        // Refresh comments to get updated like status
        await fetchComments(postId);
      }
    } catch (error) {
      console.error('Error liking comment:', error);
    }
  };

  return (
    <div className="universal-wall journal-wall">
      {/* Post Creation Form - FAMILY STYLE */}
      <div className="wall-header">
        <div className="post-composer">
          <div className="post-input-placeholder" onClick={showPostForm}>
            {user?.profile_picture ? (
              <img 
                src={user.profile_picture} 
                alt="Avatar" 
                className="composer-avatar"
                style={{ 
                  width: '40px', 
                  height: '40px', 
                  borderRadius: '50%', 
                  objectFit: 'cover' 
                }}
              />
            ) : (
              <div className="composer-avatar" style={{ backgroundColor: moduleColor }}>
                <User size={20} color="white" />
              </div>
            )}
            <div className="composer-placeholder">
              Что у Вас нового?
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Post Creation Modal */}
      {showPostModal && (
        <div 
          className="modal-overlay post-composer-modal" 
          style={{ display: 'flex' }}
          onClick={(e) => {
            if (e.target.classList.contains('modal-overlay')) {
              setShowPostModal(false);
            }
          }}
        >
          <div className="post-form">
            <form onSubmit={(e) => { e.preventDefault(); handleCreatePost(); }}>
              <div className="form-header">
                <h4>Создать запись</h4>
                <button 
                  type="button" 
                  className="close-btn"
                  onClick={() => setShowPostModal(false)}
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="form-body">
                {/* Author Section */}
                <div className="form-author-section">
                  <div className="form-author-avatar" style={{ backgroundColor: moduleColor }}>
                    <User size={20} color="white" />
                  </div>
                  <div className="form-author-info">
                    <h5>{user?.first_name} {user?.last_name}</h5>
                    <p>Публикуется в модуле «Журнал»</p>
                  </div>
                </div>

                {/* School Selection */}
                <div className="journal-select-group">
                  <label>Школа:</label>
                  <select 
                    value={selectedOrg}
                    onChange={(e) => setSelectedOrg(e.target.value)}
                    className="journal-select"
                    style={{ borderColor: moduleColor }}
                  >
                    <option value="all">Выберите школу</option>
                    {getAllSchools().map(school => (
                      <option key={school.organization_id} value={school.organization_id}>
                        {school.organization_name} ({school.role === 'teacher' ? 'Учитель' : 'Родитель'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Textarea */}
                <textarea
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  placeholder="Что у Вас нового?"
                  className="post-textarea"
                  rows="3"
                  autoFocus
                />
                
                {/* File Previews */}
                {selectedFiles.length > 0 && (
                  <div className="file-previews">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="file-preview">
                        {file.type.startsWith('image/') ? (
                          <img 
                            src={URL.createObjectURL(file)} 
                            alt="Preview" 
                            className="preview-image"
                          />
                        ) : (
                          <div className="preview-document">
                            <FileText size={32} />
                            <div className="document-name">{file.name}</div>
                          </div>
                        )}
                        <button 
                          type="button"
                          className="remove-file-btn"
                          onClick={() => removeSelectedFile(index)}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Upload Progress */}
                {uploadingFiles.length > 0 && (
                  <div className="upload-progress">
                    <p>Загружаем файлы...</p>
                    {uploadingFiles.map((filename, index) => (
                      <div key={index} className="uploading-file">
                        <div className="upload-spinner"></div>
                        {filename}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="form-actions">
                <div className="media-actions">
                  <span className="media-actions-label">Добавить:</span>
                  <button 
                    type="button" 
                    className="media-btn"
                    onClick={() => {
                      fileInputRef.current.accept = "image/jpeg,image/png,image/gif,video/mp4,video/webm";
                      fileInputRef.current?.click();
                    }}
                    title="Добавить фото/видео"
                  >
                    <Image size={24} />
                  </button>
                  
                  <button 
                    type="button" 
                    className="media-btn"
                    onClick={() => {
                      fileInputRef.current.accept = "application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt";
                      fileInputRef.current?.click();
                    }}
                    title="Добавить документы"
                  >
                    <Paperclip size={24} />
                  </button>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>
              
              <div className="form-footer">
                {/* Audience Selector - Journal Style */}
                <div className="visibility-selector">
                  <label htmlFor="post-audience" className="visibility-label">
                    Кому показать?
                  </label>
                  <select 
                    id="post-audience"
                    value={selectedAudience}
                    onChange={(e) => setSelectedAudience(e.target.value)}
                    className="visibility-dropdown"
                    style={{ borderColor: moduleColor }}
                  >
                    {AUDIENCE_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                <button 
                  type="submit" 
                  className="submit-btn"
                  disabled={loading || !newPost.trim() || selectedOrg === 'all'}
                  style={{ backgroundColor: loading ? undefined : moduleColor }}
                >
                  {loading ? 'Публикуем...' : 'Опубликовать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Posts Feed */}
      <div className="posts-feed">
        {loading ? (
          <div className="empty-feed">
            <div className="empty-content">
              <p>Загрузка постов...</p>
            </div>
          </div>
        ) : posts.length === 0 ? (
          <div className="empty-feed">
            <div className="empty-content">
              <MessageCircle size={48} color="#9ca3af" />
              <h4>Пока нет записей</h4>
              <p>Станьте первым, кто поделится новостями!</p>
            </div>
          </div>
        ) : (
          posts.map((post) => (
            <div key={post.post_id} className="post-item">
              <div className="post-header">
                <div className="post-author">
                  {post.author?.profile_picture ? (
                    <img 
                      src={post.author.profile_picture} 
                      alt={`${post.author.first_name} ${post.author.last_name}`}
                      className="author-avatar"
                      style={{ 
                        width: '40px', 
                        height: '40px', 
                        borderRadius: '50%', 
                        objectFit: 'cover' 
                      }}
                    />
                  ) : (
                    <div className="author-avatar" style={{ backgroundColor: moduleColor }}>
                      <User size={20} color="white" />
                    </div>
                  )}
                  <div className="author-info">
                    <h5>{post.author?.first_name} {post.author?.last_name}</h5>
                    <div className="post-meta-info">
                      <span className="post-role-badge" style={{ 
                        backgroundColor: post.posted_by_role === 'teacher' ? '#2563EB' : '#059669',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        marginRight: '8px'
                      }}>
                        {post.posted_by_role === 'teacher' ? 'Учитель' : 'Родитель'}
                      </span>
                      <span className="post-time">{formatTime(post.created_at)}</span>
                    </div>
                  </div>
                </div>
                <div className="post-header-right">
                  <span className="audience-badge" style={{
                    backgroundColor: `${moduleColor}15`,
                    color: moduleColor,
                    padding: '4px 10px',
                    borderRadius: '16px',
                    fontSize: '12px'
                  }}>
                    {getAudienceLabel(post.audience_type)}
                  </span>
                  <button className="post-menu-btn">
                    <MoreHorizontal size={20} />
                  </button>
                </div>
              </div>

              <div className="post-content">
                {post.title && <h4 className="post-title">{post.title}</h4>}
                <p>{post.content}</p>
              </div>

              {/* Post Stats */}
              <div className="post-stats">
                <div className="stats-left">
                  {(post.likes_count || 0) > 0 && (
                    <span className="stat-item">
                      <Heart size={16} />
                      {post.likes_count}
                    </span>
                  )}
                </div>
                <div className="stats-right">
                  {(post.comments_count || 0) > 0 && (
                    <span 
                      className="stat-item clickable"
                      onClick={() => toggleComments(post.post_id)}
                    >
                      {post.comments_count} комментариев
                    </span>
                  )}
                </div>
              </div>

              {/* Post Actions Bar */}
              <div className="post-actions-bar">
                <button 
                  className={`post-action-btn ${post.user_liked ? 'liked' : ''}`}
                  onClick={() => handleLike(post.post_id)}
                  style={{ color: post.user_liked ? moduleColor : undefined }}
                >
                  <Heart size={18} fill={post.user_liked ? moduleColor : 'none'} />
                  <span>Нравится</span>
                </button>
                
                <button 
                  className="post-action-btn"
                  onClick={() => toggleComments(post.post_id)}
                >
                  <MessageCircle size={18} />
                  <span>Комментировать</span>
                </button>
              </div>

              {/* Comments Section */}
              {showComments[post.post_id] && (
                <div className="comments-section">
                  <div className="comment-input-container">
                    <div className="comment-input-wrapper">
                      <div className="comment-avatar" style={{ backgroundColor: moduleColor }}>
                        <User size={16} color="white" />
                      </div>
                      <textarea
                        value={newComment[post.post_id] || ''}
                        onChange={(e) => setNewComment(prev => ({
                          ...prev,
                          [post.post_id]: e.target.value
                        }))}
                        placeholder="Напишите комментарий..."
                        className="comment-input"
                        rows="1"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleCommentSubmit(post.post_id, newComment[post.post_id]);
                          }
                        }}
                      />
                      <button 
                        className="comment-submit-btn"
                        onClick={() => handleCommentSubmit(post.post_id, newComment[post.post_id])}
                        disabled={!newComment[post.post_id]?.trim()}
                        style={{ color: moduleColor }}
                      >
                        <Send size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="comments-list">
                    {comments[post.post_id] ? (
                      comments[post.post_id].length > 0 ? (
                        comments[post.post_id].map(comment => (
                          <div key={comment.id} className="comment-item">
                            <div className="comment-header">
                              <div className="comment-author">
                                {comment.author?.profile_picture ? (
                                  <img 
                                    src={comment.author.profile_picture} 
                                    alt="Avatar"
                                    className="author-avatar"
                                    style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                                  />
                                ) : (
                                  <div className="author-avatar" style={{ backgroundColor: moduleColor, width: '32px', height: '32px' }}>
                                    <User size={16} color="white" />
                                  </div>
                                )}
                                <div className="comment-author-info">
                                  <span className="comment-author-name">
                                    {comment.author?.first_name} {comment.author?.last_name}
                                  </span>
                                  <span className="comment-time">{formatTime(comment.created_at)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="comment-content">
                              <p>{comment.content}</p>
                            </div>
                            <div className="comment-stats">
                              <button 
                                className={`comment-stat-btn ${comment.user_liked ? 'liked' : ''}`}
                                onClick={() => handleCommentLike(comment.id, post.post_id)}
                              >
                                <Heart size={14} fill={comment.user_liked ? moduleColor : 'none'} />
                                {comment.likes_count > 0 && <span>{comment.likes_count}</span>}
                              </button>
                            </div>
                            
                            {/* Replies */}
                            {comment.replies && comment.replies.length > 0 && (
                              <div className="comment-replies" style={{ marginLeft: '20px', marginTop: '10px' }}>
                                {comment.replies.map(reply => (
                                  <div key={reply.id} className="comment-item comment-reply">
                                    <div className="comment-header">
                                      <div className="comment-author">
                                        <div className="author-avatar" style={{ backgroundColor: moduleColor, width: '28px', height: '28px' }}>
                                          <User size={14} color="white" />
                                        </div>
                                        <div className="comment-author-info">
                                          <span className="comment-author-name">
                                            {reply.author?.first_name} {reply.author?.last_name}
                                          </span>
                                          <span className="comment-time">{formatTime(reply.created_at)}</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="comment-content">
                                      <p>{reply.content}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="no-comments">
                          <MessageCircle size={24} color="#9ca3af" />
                          <p>Пока нет комментариев</p>
                        </div>
                      )
                    ) : (
                      <div className="loading-comments">
                        <p>Загружаем комментарии...</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default JournalUniversalFeed;
