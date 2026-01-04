import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Plus, Heart, MessageCircle, User, Calendar, Trash2,
  Image, Paperclip, X, FileText, MoreHorizontal, Smile, ChevronDown, Bot, Check, Copy, Sparkles
} from 'lucide-react';
import ERICAnalyzeButton from './eric/ERICAnalyzeButton';

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
  const [ericAnalysis, setEricAnalysis] = useState(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analysisCopied, setAnalysisCopied] = useState(false);
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
    if (ericAnalysis) setEricAnalysis(null);
  };

  const handleAnalysisComplete = (result) => {
    setEricAnalysis(result);
    setShowAnalysisModal(true);
  };

  const handleAnalysisError = (error) => {
    alert(error);
  };

  const copyAnalysis = () => {
    if (ericAnalysis?.analysis) {
      navigator.clipboard.writeText(ericAnalysis.analysis);
      setAnalysisCopied(true);
      setTimeout(() => setAnalysisCopied(false), 2000);
    }
  };

  const addAnalysisToPost = () => {
    if (ericAnalysis?.analysis) {
      setNewPost(prev => prev ? `${prev}\n\n📊 Анализ ERIC:\n${ericAnalysis.analysis}` : `📊 Анализ ERIC:\n${ericAnalysis.analysis}`);
      setShowAnalysisModal(false);
    }
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
          onClick={(e) => e.target === e.currentTarget && setShowPostModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16
          }}
        >
          <div style={{
            background: 'white',
            borderRadius: 16,
            width: '100%',
            maxWidth: 500,
            maxHeight: 'calc(100vh - 32px)',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            animation: 'modalIn 0.2s ease-out'
          }}>
            {/* Header - Fixed */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid #e5e7eb',
              flexShrink: 0
            }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Создать запись</h3>
              <button
                type="button"
                onClick={() => setShowPostModal(false)}
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: '#f3f4f6', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={20} color="#6b7280" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px 20px',
              minHeight: 0
            }}>
              {/* Author */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  backgroundColor: moduleColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <User size={22} color="white" />
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>{user?.first_name} {user?.last_name}</p>
                  <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Модуль «Журнал»</p>
                </div>
              </div>

              {/* School Selection */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: '#374151' }}>
                  Школа:
                </label>
                <select 
                  value={selectedOrg}
                  onChange={(e) => setSelectedOrg(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: `2px solid ${moduleColor}`,
                    fontSize: 14,
                    background: 'white',
                    cursor: 'pointer'
                  }}
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
                autoFocus
                style={{
                  width: '100%',
                  minHeight: 100,
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  fontSize: 16,
                  lineHeight: 1.5,
                  fontFamily: 'inherit'
                }}
              />

              {/* File Previews */}
              {selectedFiles.length > 0 && (
                <div style={{
                  marginTop: 12,
                  display: 'grid',
                  gridTemplateColumns: selectedFiles.length === 1 ? '1fr' : 'repeat(2, 1fr)',
                  gap: 8
                }}>
                  {selectedFiles.map((file, index) => (
                    <div key={index} style={{
                      position: 'relative',
                      borderRadius: 12,
                      overflow: 'hidden',
                      background: '#f3f4f6',
                      aspectRatio: file.type.startsWith('image/') ? 'auto' : '16/9'
                    }}>
                      {file.type.startsWith('image/') ? (
                        <img 
                          src={URL.createObjectURL(file)} 
                          alt="Preview" 
                          style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 200, objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{
                          height: '100%', minHeight: 80,
                          display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center',
                          padding: 16, 
                          background: 'linear-gradient(135deg, #6D28D9 0%, #8B5CF6 100%)'
                        }}>
                          <FileText size={24} color="white" />
                          <span style={{ 
                            fontSize: 12, marginTop: 8, textAlign: 'center',
                            maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap', color: 'white'
                          }}>
                            {file.name}
                          </span>
                        </div>
                      )}
                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => removeSelectedFile(index)}
                        style={{
                          position: 'absolute', top: 8, right: 8,
                          width: 28, height: 28, borderRadius: '50%',
                          background: 'rgba(0,0,0,0.6)', border: 'none',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        <X size={16} color="white" />
                      </button>
                      {/* ERIC Button */}
                      <div style={{ position: 'absolute', bottom: 8, right: 8 }}>
                        <ERICAnalyzeButton
                          file={file}
                          context="education"
                          contextData={{ module: 'journal' }}
                          onAnalysisComplete={handleAnalysisComplete}
                          onError={handleAnalysisError}
                          variant="icon-only"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload Progress */}
              {uploadingFiles.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, color: moduleColor }}>
                  <div style={{
                    width: 16, height: 16,
                    border: `2px solid ${moduleColor}`,
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <span style={{ fontSize: 14 }}>Загрузка...</span>
                </div>
              )}
            </div>

            {/* Footer - Fixed */}
            <div style={{
              padding: '12px 20px 16px',
              borderTop: '1px solid #e5e7eb',
              flexShrink: 0
            }}>
              {/* Action Buttons Row */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => {
                      fileInputRef.current.accept = "image/*,video/*";
                      fileInputRef.current?.click();
                    }}
                    style={{
                      width: 40, height: 40, borderRadius: 8,
                      background: 'transparent', border: 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', position: 'relative'
                    }}
                    title="Фото/видео"
                  >
                    <Image size={22} color="#10B981" />
                    {selectedFiles.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/')).length > 0 && (
                      <span style={{
                        position: 'absolute', top: 2, right: 2,
                        width: 16, height: 16, borderRadius: '50%',
                        background: '#10B981', color: 'white',
                        fontSize: 10, fontWeight: 600,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {selectedFiles.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/')).length}
                      </span>
                    )}
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      fileInputRef.current.accept = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt";
                      fileInputRef.current?.click();
                    }}
                    style={{
                      width: 40, height: 40, borderRadius: 8,
                      background: 'transparent', border: 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', position: 'relative'
                    }}
                    title="Документы"
                  >
                    <Paperclip size={22} color="#F59E0B" />
                    {selectedFiles.filter(f => !f.type.startsWith('image/') && !f.type.startsWith('video/')).length > 0 && (
                      <span style={{
                        position: 'absolute', top: 2, right: 2,
                        width: 16, height: 16, borderRadius: '50%',
                        background: '#F59E0B', color: 'white',
                        fontSize: 10, fontWeight: 600,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {selectedFiles.filter(f => !f.type.startsWith('image/') && !f.type.startsWith('video/')).length}
                      </span>
                    )}
                  </button>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                </div>

                {/* Audience Selector */}
                <select
                  value={selectedAudience}
                  onChange={(e) => setSelectedAudience(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    fontSize: 13,
                    background: 'white',
                    cursor: 'pointer'
                  }}
                >
                  {AUDIENCE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Publish Button */}
              <button
                type="button"
                onClick={handleCreatePost}
                disabled={loading || !newPost.trim() || selectedOrg === 'all'}
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  borderRadius: 10,
                  border: 'none',
                  background: loading || !newPost.trim() || selectedOrg === 'all'
                    ? '#e5e7eb' 
                    : moduleColor,
                  color: loading || !newPost.trim() || selectedOrg === 'all' ? '#9ca3af' : 'white',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: loading || !newPost.trim() || selectedOrg === 'all' ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {loading ? 'Публикация...' : 'Опубликовать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ERIC Analysis Modal */}
      {showAnalysisModal && ericAnalysis && (
        <div 
          onClick={(e) => e.target === e.currentTarget && setShowAnalysisModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001,
            padding: 16
          }}
        >
          <div style={{
            background: 'white',
            borderRadius: 16,
            padding: 24,
            maxWidth: 480,
            width: '100%',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'linear-gradient(135deg, #6D28D9 0%, #8B5CF6 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Bot size={22} color="white" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Анализ ERIC</h3>
                <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Образовательный контент</p>
              </div>
              <button
                onClick={() => setShowAnalysisModal(false)}
                style={{
                  marginLeft: 'auto',
                  background: '#f3f4f6',
                  border: 'none',
                  width: 32, height: 32, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={18} color="#6b7280" />
              </button>
            </div>

            <div style={{
              background: '#f8f9fa',
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
              fontSize: 14,
              lineHeight: 1.6,
              color: '#374151',
              whiteSpace: 'pre-wrap'
            }}>
              {ericAnalysis.analysis}
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={copyAnalysis}
                style={{
                  flex: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: '1px solid #e5e7eb',
                  background: 'white',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500,
                  color: analysisCopied ? '#10B981' : '#374151'
                }}
              >
                {analysisCopied ? <Check size={18} /> : <Copy size={18} />}
                {analysisCopied ? 'Скопировано' : 'Копировать'}
              </button>
              <button
                onClick={addAnalysisToPost}
                style={{
                  flex: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(135deg, #6D28D9 0%, #8B5CF6 100%)',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'white'
                }}
              >
                <Sparkles size={18} />
                В пост
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

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
