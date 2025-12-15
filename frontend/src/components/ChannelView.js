/**
 * ChannelView Component
 * View a single channel with its posts and moderator management
 */
import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, Users, Check, Plus, Bell, BellOff, 
  Settings, Tv, Building2, Share2, UserPlus, X, Search,
  Shield, Trash2, Camera, Image, AlertTriangle, Copy, CheckCircle
} from 'lucide-react';
import NewsFeed from './NewsFeed';

const ChannelView = ({ 
  channelId,
  user, 
  moduleColor = '#1D4ED8',
  onBack
}) => {
  const [channel, setChannel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModeratorModal, setShowModeratorModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showShareToast, setShowShareToast] = useState(false);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    loadChannel();
  }, [channelId]);

  const loadChannel = async () => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/news/channels/${channelId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setChannel(data);
      }
    } catch (error) {
      console.error('Error loading channel:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/channel/${channelId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShowShareToast(true);
      setTimeout(() => setShowShareToast(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleSubscribe = async () => {
    try {
      const token = localStorage.getItem('zion_token');
      const method = channel.is_subscribed ? 'DELETE' : 'POST';
      
      const response = await fetch(`${BACKEND_URL}/api/news/channels/${channelId}/subscribe`, {
        method,
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setChannel(prev => ({
          ...prev,
          is_subscribed: !prev.is_subscribed,
          subscribers_count: prev.is_subscribed 
            ? prev.subscribers_count - 1 
            : prev.subscribers_count + 1
        }));
      }
    } catch (error) {
      console.error('Error toggling subscription:', error);
    }
  };

  // Determine accent color - amber/gold for official channels
  const accentColor = channel?.is_official ? '#B45309' : moduleColor;

  if (loading) {
    return (
      <div className="channel-view loading">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Загрузка канала...</p>
        </div>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="channel-view error">
        <div className="empty-state">
          <Tv size={48} color="#9CA3AF" />
          <h3>Канал не найден</h3>
          <button onClick={onBack}>Вернуться</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`channel-view ${channel.is_official ? 'official-channel-view' : ''}`}>
      {/* Channel Header */}
      <div className="channel-header-full">
        {/* Cover Image */}
        <div 
          className="channel-cover"
          style={{ 
            backgroundColor: channel.cover_url ? 'transparent' : accentColor,
            backgroundImage: channel.cover_url ? `url(${channel.cover_url})` : 'none'
          }}
        >
          <button className="back-btn-overlay" onClick={onBack}>
            <ChevronLeft size={24} />
          </button>
          
          {/* Official Badge Overlay */}
          {channel.is_official && (
            <div className="official-banner-badge">
              <Building2 size={16} />
              <span>Официальный канал</span>
              <Check size={14} />
            </div>
          )}
        </div>

        {/* Channel Info */}
        <div className="channel-info-full">
          <div className="channel-avatar-large">
            {channel.avatar_url ? (
              <img src={channel.avatar_url} alt="" />
            ) : (
              <div 
                className="avatar-placeholder"
                style={{ backgroundColor: accentColor }}
              >
                {channel.is_official ? <Building2 size={32} /> : <Tv size={32} />}
              </div>
            )}
            {channel.is_verified && (
              <div className="verified-badge-large" style={{ backgroundColor: accentColor }}>
                <Check size={16} />
              </div>
            )}
          </div>

          <div className="channel-details">
            <h1 className="channel-title">
              {channel.name}
              {channel.is_official && (
                <span className="official-title-badge" style={{ color: accentColor }}>
                  <Building2 size={20} />
                  <Check size={12} className="verified-check" />
                </span>
              )}
            </h1>
            
            {/* Organization Info for Official Channels */}
            {channel.organization && (
              <div className="channel-organization-info">
                <Building2 size={14} />
                <span>Канал организации: <strong>{channel.organization.name}</strong></span>
              </div>
            )}
            
            {channel.description && (
              <p className="channel-description-full">{channel.description}</p>
            )}

            <div className="channel-stats">
              <span className="stat">
                <Users size={16} />
                <strong>{channel.subscribers_count}</strong> подписчиков
              </span>
              <span className="stat">
                <strong>{channel.posts_count || 0}</strong> публикаций
              </span>
              {channel.is_owner && channel.moderators_count > 0 && (
                <span className="stat">
                  <Shield size={16} />
                  <strong>{channel.moderators_count}</strong> модераторов
                </span>
              )}
            </div>

            {channel.categories?.length > 0 && (
              <div className="channel-categories-full">
                {channel.categories.map(cat => (
                  <span 
                    key={cat} 
                    className="category-badge"
                    style={channel.is_official ? { borderColor: accentColor, color: accentColor } : {}}
                  >
                    {getCategoryLabel(cat)}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="channel-actions-full">
            {channel.is_owner ? (
              <>
                <button 
                  className="settings-btn"
                  onClick={() => setShowModeratorModal(true)}
                  style={{ borderColor: accentColor, color: accentColor }}
                >
                  <Shield size={18} />
                  Модераторы
                </button>
                <button 
                  className="settings-btn"
                  style={{ borderColor: accentColor, color: accentColor }}
                >
                  <Settings size={18} />
                  Настройки
                </button>
              </>
            ) : (
              <>
                <button 
                  className={`subscribe-btn-large ${channel.is_subscribed ? 'subscribed' : ''}`}
                  onClick={handleSubscribe}
                  style={!channel.is_subscribed ? { backgroundColor: accentColor } : {}}
                >
                  {channel.is_subscribed ? (
                    <>
                      <Check size={18} />
                      Вы подписаны
                    </>
                  ) : (
                    <>
                      <Plus size={18} />
                      Подписаться
                    </>
                  )}
                </button>
                
                {channel.is_subscribed && (
                  <button className="notification-btn" title="Уведомления">
                    <Bell size={18} />
                  </button>
                )}
              </>
            )}
            
            <button className="share-btn" title="Поделиться">
              <Share2 size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Channel Posts */}
      <div className="channel-content">
        <NewsFeed
          user={user}
          moduleColor={accentColor}
          channelId={channelId}
          channelName={channel.name}
        />
      </div>

      {/* Moderator Management Modal */}
      {showModeratorModal && (
        <ModeratorModal
          channelId={channelId}
          accentColor={accentColor}
          onClose={() => {
            setShowModeratorModal(false);
            loadChannel(); // Refresh channel data
          }}
        />
      )}
    </div>
  );
};

// Moderator Management Modal
const ModeratorModal = ({ channelId, accentColor, onClose }) => {
  const [moderators, setModerators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(null);
  const [error, setError] = useState('');

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    loadModerators();
  }, []);

  const loadModerators = async () => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/news/channels/${channelId}/moderators`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setModerators(data.moderators || []);
      }
    } catch (err) {
      console.error('Error loading moderators:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setSearching(true);
    setError('');
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/users/search?query=${encodeURIComponent(searchQuery)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        // Filter out users who are already moderators
        const modUserIds = moderators.map(m => m.user_id);
        setSearchResults((data.users || []).filter(u => !modUserIds.includes(u.id)));
      }
    } catch (err) {
      setError('Ошибка поиска');
    } finally {
      setSearching(false);
    }
  };

  const handleAddModerator = async (userId) => {
    setAdding(userId);
    setError('');
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/news/channels/${channelId}/moderators`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: userId,
          can_post: true,
          can_delete_posts: true,
          can_pin_posts: true
        })
      });

      if (response.ok) {
        loadModerators();
        setSearchResults(prev => prev.filter(u => u.id !== userId));
        setSearchQuery('');
      } else {
        const data = await response.json();
        setError(data.detail || 'Ошибка добавления модератора');
      }
    } catch (err) {
      setError('Ошибка сети');
    } finally {
      setAdding(null);
    }
  };

  const handleRemoveModerator = async (userId) => {
    if (!window.confirm('Удалить этого модератора?')) return;
    
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/news/channels/${channelId}/moderators/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        loadModerators();
      }
    } catch (err) {
      console.error('Error removing moderator:', err);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content moderator-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2><Shield size={20} /> Управление модераторами</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {/* Search for new moderators */}
          <div className="search-section">
            <label>Добавить модератора</label>
            <div className="search-input-row">
              <input
                type="text"
                placeholder="Поиск по имени..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button 
                onClick={handleSearch}
                disabled={searching}
                style={{ backgroundColor: accentColor }}
              >
                {searching ? '...' : <Search size={18} />}
              </button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map(user => (
                  <div key={user.id} className="search-result-item">
                    <div className="user-info">
                      <div className="user-avatar">
                        {user.profile_picture ? (
                          <img src={user.profile_picture} alt="" />
                        ) : (
                          <div className="avatar-placeholder" style={{ backgroundColor: accentColor }}>
                            {user.first_name?.[0]}
                          </div>
                        )}
                      </div>
                      <div>
                        <span className="user-name">{user.first_name} {user.last_name}</span>
                        <span className="user-email">{user.email}</span>
                      </div>
                    </div>
                    <button
                      className="add-mod-btn"
                      onClick={() => handleAddModerator(user.id)}
                      disabled={adding === user.id}
                      style={{ backgroundColor: accentColor }}
                    >
                      {adding === user.id ? '...' : <><UserPlus size={16} /> Добавить</>}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <div className="error-message">{error}</div>}

          {/* Current Moderators List */}
          <div className="moderators-section">
            <label>Текущие модераторы ({moderators.length})</label>
            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
              </div>
            ) : moderators.length === 0 ? (
              <div className="empty-state-small">
                <Shield size={24} color="#9CA3AF" />
                <p>Нет модераторов</p>
              </div>
            ) : (
              <div className="moderators-list">
                {moderators.map(mod => (
                  <div key={mod.id} className="moderator-item">
                    <div className="user-info">
                      <div className="user-avatar">
                        {mod.user?.profile_picture ? (
                          <img src={mod.user.profile_picture} alt="" />
                        ) : (
                          <div className="avatar-placeholder" style={{ backgroundColor: accentColor }}>
                            {mod.user?.first_name?.[0]}
                          </div>
                        )}
                      </div>
                      <div>
                        <span className="user-name">{mod.user?.first_name} {mod.user?.last_name}</span>
                        <div className="mod-permissions">
                          {mod.can_post && <span className="permission-badge">Публикации</span>}
                          {mod.can_delete_posts && <span className="permission-badge">Удаление</span>}
                          {mod.can_pin_posts && <span className="permission-badge">Закрепление</span>}
                        </div>
                      </div>
                    </div>
                    <button
                      className="remove-mod-btn"
                      onClick={() => handleRemoveModerator(mod.user_id)}
                      title="Удалить модератора"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="close-action-btn" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

// Category labels helper
const CATEGORY_LABELS = {
  'WORLD_NEWS': 'Мировые новости',
  'POLITICS': 'Политика',
  'ECONOMY': 'Экономика',
  'TECHNOLOGY': 'Технологии',
  'SCIENCE': 'Наука',
  'SPORTS': 'Спорт',
  'CULTURE': 'Культура',
  'ENTERTAINMENT': 'Развлечения',
  'HEALTH': 'Здоровье',
  'EDUCATION': 'Образование',
  'LOCAL_NEWS': 'Местные новости',
  'AUTO': 'Авто',
  'TRAVEL': 'Путешествия',
  'FOOD': 'Кулинария',
  'FASHION': 'Мода'
};

const getCategoryLabel = (cat) => CATEGORY_LABELS[cat] || cat;

export default ChannelView;
