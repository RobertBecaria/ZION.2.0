/**
 * ChannelsPage Component
 * News channels listing and management
 */
import React, { useState, useEffect } from 'react';
import { 
  Tv, Plus, Search, Users, Hash, Check, Bell, 
  ChevronRight, Star, Building2, Globe, Lock
} from 'lucide-react';

// Channel categories with Russian labels
const CHANNEL_CATEGORIES = [
  { id: 'WORLD_NEWS', label: 'Мировые новости', icon: '🌍' },
  { id: 'POLITICS', label: 'Политика', icon: '🏛️' },
  { id: 'ECONOMY', label: 'Экономика и Бизнес', icon: '📈' },
  { id: 'TECHNOLOGY', label: 'Технологии', icon: '💻' },
  { id: 'SCIENCE', label: 'Наука', icon: '🔬' },
  { id: 'SPORTS', label: 'Спорт', icon: '⚽' },
  { id: 'CULTURE', label: 'Культура и Искусство', icon: '🎭' },
  { id: 'ENTERTAINMENT', label: 'Развлечения', icon: '🎬' },
  { id: 'HEALTH', label: 'Здоровье', icon: '💊' },
  { id: 'EDUCATION', label: 'Образование', icon: '📚' },
  { id: 'LOCAL_NEWS', label: 'Местные новости', icon: '📍' },
  { id: 'AUTO', label: 'Авто', icon: '🚗' },
  { id: 'TRAVEL', label: 'Путешествия', icon: '✈️' },
  { id: 'FOOD', label: 'Кулинария', icon: '🍳' },
  { id: 'FASHION', label: 'Мода и Стиль', icon: '👗' }
];

const getCategoryLabel = (categoryId) => {
  const cat = CHANNEL_CATEGORIES.find(c => c.id === categoryId);
  return cat ? cat.label : categoryId;
};

const getCategoryIcon = (categoryId) => {
  const cat = CHANNEL_CATEGORIES.find(c => c.id === categoryId);
  return cat ? cat.icon : '📰';
};

const ChannelsPage = ({ 
  user, 
  moduleColor = '#1D4ED8',
  onViewChannel,
  onCreateChannel 
}) => {
  const [activeTab, setActiveTab] = useState('discover');
  const [channels, setChannels] = useState([]);
  const [myChannels, setMyChannels] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    loadChannels();
  }, [selectedCategory]);

  const loadChannels = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('zion_token');
      const headers = { 'Authorization': `Bearer ${token}` };

      // Load all channels, my channels, and subscriptions in parallel
      const categoryParam = selectedCategory ? `?category=${selectedCategory}` : '';
      
      const [allChannelsRes, myChannelsRes, subscriptionsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/news/channels${categoryParam}`, { headers }),
        fetch(`${BACKEND_URL}/api/news/channels/my`, { headers }),
        fetch(`${BACKEND_URL}/api/news/channels/subscriptions`, { headers })
      ]);

      if (allChannelsRes.ok) {
        const data = await allChannelsRes.json();
        setChannels(data.channels || []);
      }
      if (myChannelsRes.ok) {
        const data = await myChannelsRes.json();
        setMyChannels(data.channels || []);
      }
      if (subscriptionsRes.ok) {
        const data = await subscriptionsRes.json();
        setSubscriptions(data.subscriptions || []);
      }
    } catch (error) {
      console.error('Error loading channels:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (channelId) => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/news/channels/${channelId}/subscribe`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        loadChannels();
      }
    } catch (error) {
      console.error('Error subscribing:', error);
    }
  };

  const handleUnsubscribe = async (channelId) => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/news/channels/${channelId}/subscribe`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        loadChannels();
      }
    } catch (error) {
      console.error('Error unsubscribing:', error);
    }
  };

  const isSubscribed = (channelId) => {
    return subscriptions.some(s => s.channel_id === channelId);
  };

  const filteredChannels = channels.filter(channel => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      channel.name?.toLowerCase().includes(query) ||
      channel.description?.toLowerCase().includes(query)
    );
  });

  const tabs = [
    { id: 'discover', label: 'Обзор', icon: Globe },
    { id: 'subscriptions', label: 'Мои подписки', icon: Bell, count: subscriptions.length },
    { id: 'my-channels', label: 'Мои каналы', icon: Tv, count: myChannels.length }
  ];

  const renderChannelCard = (channel, showSubscribeBtn = true) => (
    <div 
      key={channel.id} 
      className="channel-card"
      onClick={() => onViewChannel?.(channel)}
    >
      <div className="channel-avatar">
        {channel.avatar_url ? (
          <img src={channel.avatar_url} alt="" />
        ) : (
          <div 
            className="avatar-placeholder"
            style={{ backgroundColor: moduleColor }}
          >
            <Tv size={24} />
          </div>
        )}
        {channel.is_verified && (
          <div className="verified-badge" title="Верифицированный канал">
            <Check size={12} />
          </div>
        )}
      </div>
      
      <div className="channel-info">
        <div className="channel-header">
          <h3 className="channel-name">
            {channel.name}
            {channel.is_official && (
              <Building2 size={14} className="official-icon" title="Официальный канал" />
            )}
          </h3>
        </div>
        
        {channel.description && (
          <p className="channel-description">{channel.description}</p>
        )}
        
        <div className="channel-meta">
          <span className="subscribers-count">
            <Users size={14} />
            {channel.subscribers_count || 0} подписчиков
          </span>
          {channel.categories?.length > 0 && (
            <div className="channel-categories">
              {channel.categories.slice(0, 2).map(cat => (
                <span key={cat} className="category-tag">
                  {getCategoryIcon(cat)} {getCategoryLabel(cat)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {showSubscribeBtn && (
        <div className="channel-actions" onClick={(e) => e.stopPropagation()}>
          {isSubscribed(channel.id) ? (
            <button 
              className="subscribe-btn subscribed"
              onClick={() => handleUnsubscribe(channel.id)}
            >
              <Check size={16} />
              <span>Подписан</span>
            </button>
          ) : (
            <button 
              className="subscribe-btn"
              onClick={() => handleSubscribe(channel.id)}
              style={{ backgroundColor: moduleColor }}
            >
              <Plus size={16} />
              <span>Подписаться</span>
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="channels-page">
      {/* Header */}
      <div className="channels-header">
        <h1>Каналы</h1>
        <button 
          className="create-channel-btn"
          onClick={() => setShowCreateModal(true)}
          style={{ backgroundColor: moduleColor }}
        >
          <Plus size={18} />
          Создать канал
        </button>
      </div>

      {/* Tabs */}
      <div className="channels-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            style={activeTab === tab.id ? { 
              borderBottomColor: moduleColor,
              color: moduleColor 
            } : {}}
          >
            <tab.icon size={18} />
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span 
                className="tab-count"
                style={activeTab === tab.id ? { backgroundColor: moduleColor } : {}}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="channels-content">
        {/* Discover Tab */}
        {activeTab === 'discover' && (
          <>
            {/* Search & Filter */}
            <div className="channels-filters">
              <div className="search-input-wrapper">
                <Search size={20} color="#9CA3AF" />
                <input
                  type="text"
                  placeholder="Поиск каналов..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input-large"
                />
              </div>
              
              {/* Categories */}
              <div className="categories-filter">
                <button
                  className={`category-btn ${!selectedCategory ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(null)}
                  style={!selectedCategory ? { backgroundColor: moduleColor, color: 'white' } : {}}
                >
                  Все
                </button>
                {CHANNEL_CATEGORIES.slice(0, 8).map(cat => (
                  <button
                    key={cat.id}
                    className={`category-btn ${selectedCategory === cat.id ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(cat.id)}
                    style={selectedCategory === cat.id ? { backgroundColor: moduleColor, color: 'white' } : {}}
                  >
                    {cat.icon} {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Channels List */}
            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Загрузка каналов...</p>
              </div>
            ) : filteredChannels.length === 0 ? (
              <div className="empty-state">
                <Tv size={48} color="#9CA3AF" />
                <h3>Каналы не найдены</h3>
                <p>Попробуйте изменить фильтры или создайте свой канал</p>
              </div>
            ) : (
              <div className="channels-grid">
                {filteredChannels.map(channel => renderChannelCard(channel))}
              </div>
            )}
          </>
        )}

        {/* Subscriptions Tab */}
        {activeTab === 'subscriptions' && (
          <>
            {subscriptions.length === 0 ? (
              <div className="empty-state">
                <Bell size={48} color="#9CA3AF" />
                <h3>Нет подписок</h3>
                <p>Подпишитесь на интересные каналы, чтобы видеть их публикации</p>
                <button 
                  className="cta-btn"
                  onClick={() => setActiveTab('discover')}
                  style={{ backgroundColor: moduleColor }}
                >
                  Найти каналы
                </button>
              </div>
            ) : (
              <div className="channels-grid">
                {subscriptions.map(sub => renderChannelCard(sub.channel))}
              </div>
            )}
          </>
        )}

        {/* My Channels Tab */}
        {activeTab === 'my-channels' && (
          <>
            {myChannels.length === 0 ? (
              <div className="empty-state">
                <Tv size={48} color="#9CA3AF" />
                <h3>У вас пока нет каналов</h3>
                <p>Создайте свой канал и делитесь новостями</p>
                <button 
                  className="cta-btn"
                  onClick={() => setShowCreateModal(true)}
                  style={{ backgroundColor: moduleColor }}
                >
                  <Plus size={18} />
                  Создать канал
                </button>
              </div>
            ) : (
              <div className="channels-grid">
                {myChannels.map(channel => renderChannelCard(channel, false))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Channel Modal */}
      {showCreateModal && (
        <CreateChannelModal
          moduleColor={moduleColor}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            loadChannels();
            setActiveTab('my-channels');
          }}
        />
      )}
    </div>
  );
};

// Create Channel Modal Component
const CreateChannelModal = ({ moduleColor, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedOrganization, setSelectedOrganization] = useState('');
  const [adminOrganizations, setAdminOrganizations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [error, setError] = useState('');

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  // Load organizations where user is admin
  useEffect(() => {
    const loadAdminOrgs = async () => {
      try {
        const token = localStorage.getItem('zion_token');
        const response = await fetch(`${BACKEND_URL}/api/users/me/admin-organizations`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setAdminOrganizations(data.organizations || []);
        }
      } catch (err) {
        console.error('Error loading organizations:', err);
      } finally {
        setLoadingOrgs(false);
      }
    };
    loadAdminOrgs();
  }, [BACKEND_URL]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Введите название канала');
      return;
    }
    if (selectedCategories.length === 0) {
      setError('Выберите хотя бы одну категорию');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/news/channels`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          categories: selectedCategories,
          organization_id: selectedOrganization || null
        })
      });

      if (response.ok) {
        onCreated();
      } else {
        const data = await response.json();
        setError(data.detail || 'Ошибка при создании канала');
      }
    } catch (err) {
      setError('Ошибка сети. Попробуйте снова.');
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (catId) => {
    setSelectedCategories(prev => 
      prev.includes(catId) 
        ? prev.filter(c => c !== catId)
        : [...prev, catId]
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content channel-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Создать канал</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Название канала *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Введите название"
              maxLength={100}
            />
          </div>

          <div className="form-group">
            <label>Описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="О чём ваш канал?"
              rows={3}
              maxLength={500}
            />
          </div>

          {/* Official Organization Selection */}
          {!loadingOrgs && adminOrganizations.length > 0 && (
            <div className="form-group">
              <label>
                <Building2 size={16} className="label-icon" />
                Официальный канал организации
              </label>
              <select
                value={selectedOrganization}
                onChange={(e) => setSelectedOrganization(e.target.value)}
                className="org-select"
              >
                <option value="">Личный канал (без организации)</option>
                {adminOrganizations.map(org => (
                  <option key={org.id} value={org.id}>
                    ✓ {org.name}
                  </option>
                ))}
              </select>
              {selectedOrganization && (
                <p className="form-hint official-hint">
                  <Check size={14} /> Канал будет отмечен как официальный и верифицированный
                </p>
              )}
            </div>
          )}

          <div className="form-group">
            <label>Категории * (выберите минимум одну)</label>
            <div className="categories-grid">
              {CHANNEL_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  className={`category-checkbox ${selectedCategories.includes(cat.id) ? 'selected' : ''}`}
                  onClick={() => toggleCategory(cat.id)}
                  style={selectedCategories.includes(cat.id) ? { 
                    backgroundColor: moduleColor,
                    borderColor: moduleColor,
                    color: 'white'
                  } : {}}
                >
                  <span className="cat-icon">{cat.icon}</span>
                  <span className="cat-label">{cat.label}</span>
                  {selectedCategories.includes(cat.id) && <Check size={14} />}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Отмена
            </button>
            <button 
              type="submit" 
              className="submit-btn"
              disabled={loading}
              style={{ backgroundColor: selectedOrganization ? '#B45309' : moduleColor }}
            >
              {loading ? 'Создание...' : (selectedOrganization ? 'Создать официальный канал' : 'Создать канал')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChannelsPage;
