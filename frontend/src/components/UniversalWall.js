import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Plus, Image, Smile, Heart, MessageCircle, Share2, 
  MoreHorizontal, User, Calendar, Clock, MapPin, Paperclip
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
  const [showImageUpload, setShowImageUpload] = useState(false);
  const fileInputRef = useRef(null);

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

  useEffect(() => {
    // For now, use mock data
    setPosts(mockPosts);
    // TODO: Replace with actual API call
    // fetchPosts();
  }, [activeGroup]);

  const handlePostSubmit = async (e) => {
    e.preventDefault();
    if (!newPost.trim() || loading) return;

    setLoading(true);
    try {
      // TODO: Replace with actual API call
      const newPostObj = {
        id: Date.now().toString(),
        user_id: user.id,
        author: {
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name
        },
        content: newPost,
        created_at: new Date().toISOString(),
        likes_count: 0,
        comments_count: 0,
        is_liked: false,
        images: []
      };

      setPosts([newPostObj, ...posts]);
      setNewPost('');
    } catch (error) {
      console.error('Error creating post:', error);
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

  const handleImageUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // TODO: Handle file upload
      console.log('Files selected:', files);
      setShowImageUpload(false);
    }
  };

  return (
    <div className="universal-wall">
      {/* Post Creation Section */}
      <div className="post-creation-section">
        <div className="post-creator">
          <div className="creator-header">
            <div className="user-avatar" style={{ backgroundColor: moduleColor }}>
              <User size={24} color="white" />
            </div>
            <div className="creator-info">
              <h4>{user?.first_name} {user?.last_name}</h4>
              <p>Поделитесь новостями с {moduleName.toLowerCase()}</p>
            </div>
          </div>

          <form onSubmit={handlePostSubmit} className="post-form">
            <textarea
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder={`Что нового в ${moduleName.toLowerCase()}?`}
              className="post-textarea"
              rows={3}
              disabled={loading}
            />
            
            <div className="post-actions">
              <div className="post-tools">
                <button 
                  type="button" 
                  className="post-tool-btn"
                  onClick={handleImageUpload}
                  title="Добавить изображение"
                >
                  <Image size={20} />
                  <span>Фото</span>
                </button>
                <button 
                  type="button" 
                  className="post-tool-btn"
                  title="Добавить файл"
                >
                  <Paperclip size={20} />
                  <span>Файл</span>
                </button>
                <button 
                  type="button" 
                  className="post-tool-btn"
                  title="Эмодзи"
                >
                  <Smile size={20} />
                  <span>Эмодзи</span>
                </button>
              </div>

              <button 
                type="submit" 
                className="post-submit-btn"
                style={{ backgroundColor: moduleColor }}
                disabled={!newPost.trim() || loading}
              >
                {loading ? 'Публикуем...' : 'Опубликовать'}
              </button>
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