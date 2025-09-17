import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Plus, Image, Smile, Heart, MessageCircle, Share2, 
  MoreHorizontal, User, Calendar, Clock, MapPin, Paperclip, X,
  FileText, Upload
} from 'lucide-react';

function UniversalWall({ 
  activeGroup, 
  moduleColor = "#059669",
  moduleName = "Family",
  user 
}) {
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadedMediaIds, setUploadedMediaIds] = useState([]);
  const fileInputRef = useRef(null);
  const backendUrl = import.meta.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_BACKEND_URL;

  // Mock posts data for now - will be replaced with API calls
  const mockPosts = [
    {
      id: '1',
      user_id: user?.id || '1',
      author: {
        id: user?.id || '1',
        first_name: user?.first_name || 'Анна',
        last_name: user?.last_name || 'Петрова'
      },
      content: 'Отличная погода сегодня! Идем всей семьей в парк 🌞',
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      likes_count: 5,
      comments_count: 2,
      is_liked: true,
      images: []
    },
    {
      id: '2',
      user_id: '2',
      author: {
        id: '2',
        first_name: 'Максим',
        last_name: 'Иванов'
      },
      content: 'Готовлю ужин на всю семью. Что думаете о новом рецепте?',
      created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
      likes_count: 3,
      comments_count: 4,
      is_liked: false,
      images: []
    },
    {
      id: '3',
      user_id: '3',
      author: {
        id: '3',
        first_name: 'Елена',
        last_name: 'Сидорова'
      },
      content: 'Дети справились с домашним заданием! Гордимся успехами 📚✨',
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      likes_count: 8,
      comments_count: 1,
      is_liked: true,
      images: []
    }
  ];

  // Fetch posts from API
  const fetchPosts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${backendUrl}/api/posts`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setPosts(data);
      } else {
        console.error('Failed to fetch posts');
        // Fallback to mock data for now
        setPosts(mockPosts);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
      // Fallback to mock data
      setPosts(mockPosts);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [activeGroup]);

  const handlePostSubmit = async (e) => {
    e.preventDefault();
    if (!newPost.trim() || loading) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // Create FormData for post creation
      const formData = new FormData();
      formData.append('content', newPost);
      
      // Add uploaded media file IDs
      uploadedMediaIds.forEach(id => {
        formData.append('media_file_ids', id);
      });

      const response = await fetch(`${backendUrl}/api/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const newPostData = await response.json();
        setPosts([newPostData, ...posts]);
        setNewPost('');
        setSelectedFiles([]);
        setUploadedMediaIds([]);
        document.querySelector('.post-form').style.display = 'none';
      } else {
        throw new Error('Failed to create post');
      }
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Failed to create post. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (postId) => {
    // TODO: Implement like functionality
    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          is_liked: !post.is_liked,
          likes_count: post.is_liked ? post.likes_count - 1 : post.likes_count + 1
        };
      }
      return post;
    }));
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

    // Upload files immediately
    try {
      const token = localStorage.getItem('token');
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${backendUrl}/api/media/upload`, {
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
      
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('Some files failed to upload. Please try again.');
    } finally {
      setUploadingFiles([]);
    }
  };

  const removeSelectedFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setUploadedMediaIds(prev => prev.filter((_, i) => i !== index));
  };

  const extractYouTubeId = (url) => {
    const patterns = [
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
      /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]+)/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const handleFileInputClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="universal-wall-full">
      {/* Wall Header */}
      <div className="wall-header">
        <h2>Лента Новостей</h2>
      </div>

      {/* Post Creation Section */}
      <div className="post-creation-section">
        <div className="post-creator">
          <div className="creator-header">
            <div className="user-avatar" style={{ backgroundColor: moduleColor }}>
              <User size={24} color="white" />
            </div>
            <input
              type="text"
              placeholder="Что у Вас нового?"
              className="post-input-placeholder"
              onClick={() => {
                const textarea = document.querySelector('.post-textarea');
                if (textarea) {
                  textarea.style.display = 'block';
                  textarea.focus();
                }
                document.querySelector('.post-form').style.display = 'block';
              }}
              readOnly
            />
          </div>

          <form onSubmit={handlePostSubmit} className="post-form" style={{ display: 'none' }}>
            <textarea
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder="Поделитесь новостями... (можно добавить YouTube ссылки)"
              className="post-textarea"
              rows={3}
              disabled={loading}
            />
            
            {/* File Previews */}
            {selectedFiles.length > 0 && (
              <div className="file-previews">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="file-preview">
                    <div className="file-info">
                      {file.type.startsWith('image/') ? (
                        <Image size={16} />
                      ) : (
                        <FileText size={16} />
                      )}
                      <span className="file-name">{file.name}</span>
                      <span className="file-size">
                        ({(file.size / (1024 * 1024)).toFixed(1)}MB)
                      </span>
                    </div>
                    <button
                      type="button"
                      className="remove-file-btn"
                      onClick={() => removeSelectedFile(index)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Progress */}
            {uploadingFiles.length > 0 && (
              <div className="upload-progress">
                <Upload size={16} />
                <span>Загрузка файлов...</span>
              </div>
            )}
            
            <div className="post-actions">
              <div className="post-tools">
                <button 
                  type="button" 
                  className="post-tool-btn"
                  onClick={handleFileInputClick}
                  title="Добавить изображение"
                >
                  <Image size={18} />
                </button>
                <button 
                  type="button" 
                  className="post-tool-btn"
                  onClick={handleFileInputClick}
                  title="Добавить файл"
                >
                  <Paperclip size={18} />
                </button>
                <button 
                  type="button" 
                  className="post-tool-btn"
                  title="Эмодзи"
                >
                  <Smile size={18} />
                </button>
              </div>

              <div className="post-submit-actions">
                <button 
                  type="button" 
                  className="post-cancel-btn"
                  onClick={() => {
                    setNewPost('');
                    document.querySelector('.post-form').style.display = 'none';
                  }}
                >
                  Отмена
                </button>
                <button 
                  type="submit" 
                  className="post-submit-btn"
                  style={{ backgroundColor: moduleColor }}
                  disabled={!newPost.trim() || loading}
                >
                  {loading ? 'Публикуем...' : 'Опубликовать'}
                </button>
              </div>
            </div>
          </form>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>
      </div>

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
            <div key={post.id} className="post-item">
              <div className="post-header">
                <div className="post-author">
                  <div className="author-avatar" style={{ backgroundColor: moduleColor }}>
                    <User size={20} color="white" />
                  </div>
                  <div className="author-info">
                    <h5>{post.author.first_name} {post.author.last_name}</h5>
                    <span className="post-time">{formatTime(post.created_at)}</span>
                  </div>
                </div>
                <button className="post-menu-btn">
                  <MoreHorizontal size={20} />
                </button>
              </div>

              <div className="post-content">
                <p>{post.content}</p>
                {post.images && post.images.length > 0 && (
                  <div className="post-images">
                    {/* TODO: Display images */}
                  </div>
                )}
              </div>

              <div className="post-stats">
                <span className="stat-item">
                  <Heart size={16} />
                  {post.likes_count} отметок "Нравится"
                </span>
                <span className="stat-item">
                  <MessageCircle size={16} />
                  {post.comments_count} комментариев
                </span>
              </div>

              <div className="post-actions-bar">
                <button 
                  className={`post-action-btn ${post.is_liked ? 'liked' : ''}`}
                  onClick={() => handleLike(post.id)}
                  style={{ color: post.is_liked ? moduleColor : undefined }}
                >
                  <Heart size={18} fill={post.is_liked ? moduleColor : 'none'} />
                  <span>Нравится</span>
                </button>
                <button className="post-action-btn">
                  <MessageCircle size={18} />
                  <span>Комментировать</span>
                </button>
                <button className="post-action-btn">
                  <Share2 size={18} />
                  <span>Поделиться</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default UniversalWall;