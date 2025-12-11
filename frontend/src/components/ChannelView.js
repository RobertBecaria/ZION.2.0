/**
 * ChannelView Component
 * View a single channel with its posts
 */
import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, Users, Check, Plus, Bell, BellOff, 
  Settings, Tv, Building2, Share2
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
    <div className="channel-view">
      {/* Channel Header */}
      <div className="channel-header-full">
        {/* Cover Image */}
        <div 
          className="channel-cover"
          style={{ 
            backgroundColor: channel.cover_url ? 'transparent' : moduleColor,
            backgroundImage: channel.cover_url ? `url(${channel.cover_url})` : 'none'
          }}
        >
          <button className="back-btn-overlay" onClick={onBack}>
            <ChevronLeft size={24} />
          </button>
        </div>

        {/* Channel Info */}
        <div className="channel-info-full">
          <div className="channel-avatar-large">
            {channel.avatar_url ? (
              <img src={channel.avatar_url} alt="" />
            ) : (
              <div 
                className="avatar-placeholder"
                style={{ backgroundColor: moduleColor }}
              >
                <Tv size={32} />
              </div>
            )}
            {channel.is_verified && (
              <div className="verified-badge-large">
                <Check size={16} />
              </div>
            )}
          </div>

          <div className="channel-details">
            <h1 className="channel-title">
              {channel.name}
              {channel.is_official && (
                <Building2 size={20} className="official-icon" title="Официальный канал" />
              )}
            </h1>
            
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
            </div>

            {channel.categories?.length > 0 && (
              <div className="channel-categories-full">
                {channel.categories.map(cat => (
                  <span key={cat} className="category-badge">
                    {getCategoryLabel(cat)}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="channel-actions-full">
            {channel.is_owner ? (
              <button className="settings-btn">
                <Settings size={18} />
                Управление
              </button>
            ) : (
              <>
                <button 
                  className={`subscribe-btn-large ${channel.is_subscribed ? 'subscribed' : ''}`}
                  onClick={handleSubscribe}
                  style={!channel.is_subscribed ? { backgroundColor: moduleColor } : {}}
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
          moduleColor={moduleColor}
          channelId={channelId}
          channelName={channel.name}
        />
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
