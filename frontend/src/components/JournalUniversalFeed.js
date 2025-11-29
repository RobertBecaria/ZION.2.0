import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Plus, Heart, MessageCircle, User, Calendar, Trash2,
  Image, Paperclip, X, FileText, MoreHorizontal, Smile
} from 'lucide-react';

const JournalUniversalFeed = ({ currentUserId, schoolRoles, user }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newPost, setNewPost] = useState('');
  const [selectedOrg, setSelectedOrg] = useState('all');
  const [selectedAudience, setSelectedAudience] = useState('PUBLIC');
  const [audienceFilter, setAudienceFilter] = useState('all');
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

  useEffect(() => {
    fetchPosts();
  }, [selectedOrg, audienceFilter]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('zion_token');
      
      // Get posts from all user's schools
      const allPosts = [];
      
      if (schoolRoles) {
        // Fetch from schools where user is teacher
        if (schoolRoles.schools_as_teacher) {
          for (const school of schoolRoles.schools_as_teacher) {
            if (selectedOrg === 'all' || selectedOrg === school.organization_id) {
              let url = `${BACKEND_URL}/api/journal/organizations/${school.organization_id}/posts`;
              if (audienceFilter !== 'all') {
                url += `?audience_filter=${audienceFilter}`;
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
            if (selectedOrg === 'all' || selectedOrg === school.organization_id) {
              let url = `${BACKEND_URL}/api/journal/organizations/${school.organization_id}/posts`;
              if (audienceFilter !== 'all') {
                url += `?audience_filter=${audienceFilter}`;
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
            media_file_ids: [],
            is_pinned: false
          })
        }
      );

      if (response.ok) {
        setNewPost('');
        setShowPostModal(false);
        fetchPosts();
        alert('Пост успешно создан!');
      } else {
        const error = await response.json();
        alert(`Ошибка: ${error.detail || 'Не удалось создать пост'}`);
      }
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Произошла ошибка при создании поста');
    }
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
    // Remove duplicates
    return Array.from(new Map(schools.map(s => [s.organization_id, s])).values());
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getAudienceLabel = (audienceType) => {
    const option = AUDIENCE_OPTIONS.find(o => o.value === audienceType);
    return option ? option.label : audienceType;
  };

  return (
    <div className="journal-feed-container">
      <div className="feed-header">
        <h1>МОЯ ЛЕНТА - Журнал</h1>
        <p className="feed-subtitle">Сообщения из школ</p>
      </div>

      {/* Filters */}
      <div className="feed-filters">
        <div className="filter-group">
          <label>Школа:</label>
          <select value={selectedOrg} onChange={(e) => setSelectedOrg(e.target.value)}>
            <option value="all">Все школы</option>
            {getAllSchools().map(school => (
              <option key={school.organization_id} value={school.organization_id}>
                {school.organization_name} ({school.role === 'teacher' ? 'Учитель' : 'Родитель'})
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Аудитория:</label>
          <select value={audienceFilter} onChange={(e) => setAudienceFilter(e.target.value)}>
            <option value="all">Все посты</option>
            {AUDIENCE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <button className="btn-primary" onClick={() => setShowPostModal(true)}>
          <Plus size={18} />
          Создать Пост
        </button>
      </div>

      {/* Posts Feed */}
      {loading ? (
        <div className="loading-state">
          <p>Загрузка постов...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="empty-state-large">
          <MessageCircle size={48} style={{ color: '#6D28D9', opacity: 0.5 }} />
          <h3>Постов Нет</h3>
          <p>Пока нет сообщений в ленте</p>
        </div>
      ) : (
        <div className="posts-list">
          {posts.map(post => (
            <div key={post.post_id} className="post-card">
              <div className="post-header">
                <div className="post-author">
                  <div className="author-avatar">
                    {post.author.profile_picture ? (
                      <img src={post.author.profile_picture} alt="Avatar" />
                    ) : (
                      <User size={24} />
                    )}
                  </div>
                  <div className="author-info">
                    <div className="author-name">
                      {post.author.first_name} {post.author.last_name}
                    </div>
                    <div className="post-meta">
                      <span className="post-role">{post.posted_by_role === 'teacher' ? 'Учитель' : post.posted_by_role === 'parent' ? 'Родитель' : 'Админ'}</span>
                      <span className="separator">•</span>
                      <span className="post-school">{post.organization_name}</span>
                      <span className="separator">•</span>
                      <Calendar size={14} />
                      <span>{formatDate(post.created_at)}</span>
                    </div>
                  </div>
                </div>
                <div className="post-audience-badge">
                  {getAudienceLabel(post.audience_type)}
                </div>
              </div>

              {post.title && <h3 className="post-title">{post.title}</h3>}
              <div className="post-content">{post.content}</div>

              <div className="post-actions">
                <button className="post-action-btn">
                  <Heart size={18} />
                  <span>{post.likes_count}</span>
                </button>
                <button className="post-action-btn">
                  <MessageCircle size={18} />
                  <span>{post.comments_count}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Post Modal */}
      {showPostModal && (
        <div className="modal-overlay" onClick={() => setShowPostModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Создать Пост</h2>
              <button className="modal-close" onClick={() => setShowPostModal(false)}>×</button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Школа:</label>
                <select 
                  value={selectedOrg}
                  onChange={(e) => setSelectedOrg(e.target.value)}
                >
                  <option value="all">Выберите школу</option>
                  {getAllSchools().map(school => (
                    <option key={school.organization_id} value={school.organization_id}>
                      {school.organization_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Аудитория:</label>
                <select 
                  value={selectedAudience}
                  onChange={(e) => setSelectedAudience(e.target.value)}
                >
                  {AUDIENCE_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Сообщение:</label>
                <textarea 
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  placeholder="Напишите сообщение..."
                  rows={6}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowPostModal(false)}>
                Отмена
              </button>
              <button 
                className="btn-primary" 
                onClick={handleCreatePost}
                disabled={!newPost.trim() || selectedOrg === 'all'}
              >
                <Send size={18} />
                Опубликовать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JournalUniversalFeed;
