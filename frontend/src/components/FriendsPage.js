/**
 * FriendsPage Component
 * Full friends management page with tabs for Friends, Followers, Following, and Requests
 */
import React, { useState, useEffect } from 'react';
import { 
  Users, UserPlus, UserCheck, UserMinus, Search, 
  MessageCircle, Check, X, Clock, ChevronLeft,
  UserX, Bell, BellOff
} from 'lucide-react';

const FriendsPage = ({ 
  user, 
  moduleColor = '#1D4ED8',
  initialTab = 'friends',
  onBack,
  onOpenChat
}) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [friends, setFriends] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    friends_count: 0,
    followers_count: 0,
    following_count: 0,
    pending_friend_requests: 0
  });

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchUsers();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('zion_token');
      const headers = { 'Authorization': `Bearer ${token}` };

      const [
        friendsRes, 
        followersRes, 
        followingRes, 
        incomingRes, 
        outgoingRes,
        statsRes
      ] = await Promise.all([
        fetch(`${BACKEND_URL}/api/friends`, { headers }),
        fetch(`${BACKEND_URL}/api/users/me/followers`, { headers }),
        fetch(`${BACKEND_URL}/api/users/me/following`, { headers }),
        fetch(`${BACKEND_URL}/api/friends/requests/incoming`, { headers }),
        fetch(`${BACKEND_URL}/api/friends/requests/outgoing`, { headers }),
        fetch(`${BACKEND_URL}/api/users/me/social-stats`, { headers })
      ]);

      if (friendsRes.ok) {
        const data = await friendsRes.json();
        setFriends(data.friends || []);
      }
      if (followersRes.ok) {
        const data = await followersRes.json();
        setFollowers(data.followers || []);
      }
      if (followingRes.ok) {
        const data = await followingRes.json();
        setFollowing(data.following || []);
      }
      if (incomingRes.ok) {
        const data = await incomingRes.json();
        setIncomingRequests(data.requests || []);
      }
      if (outgoingRes.ok) {
        const data = await outgoingRes.json();
        setOutgoingRequests(data.requests || []);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async () => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${BACKEND_URL}/api/users/search?query=${encodeURIComponent(searchQuery)}&limit=20`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.users || []);
      }
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/friends/request/${requestId}/accept`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        loadAllData();
      }
    } catch (error) {
      console.error('Error accepting request:', error);
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/friends/request/${requestId}/reject`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        loadAllData();
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
    }
  };

  const handleCancelRequest = async (requestId) => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/friends/request/${requestId}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        loadAllData();
      }
    } catch (error) {
      console.error('Error cancelling request:', error);
    }
  };

  const handleRemoveFriend = async (friendId) => {
    if (!window.confirm('Вы уверены, что хотите удалить этого друга?')) return;
    
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/friends/${friendId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        loadAllData();
      }
    } catch (error) {
      console.error('Error removing friend:', error);
    }
  };

  const handleFollow = async (userId) => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/users/${userId}/follow`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        loadAllData();
      }
    } catch (error) {
      console.error('Error following user:', error);
    }
  };

  const handleUnfollow = async (userId) => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/users/${userId}/follow`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        loadAllData();
      }
    } catch (error) {
      console.error('Error unfollowing user:', error);
    }
  };

  const handleSendRequest = async (userId) => {
    try {
      const token = localStorage.getItem('zion_token');
      const formData = new FormData();
      formData.append('receiver_id', userId);

      const response = await fetch(`${BACKEND_URL}/api/friends/request`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (response.ok) {
        loadAllData();
        // Update search results to reflect the change
        setSearchResults(prev => prev.map(u => 
          u.id === userId ? { ...u, request_sent: true } : u
        ));
      }
    } catch (error) {
      console.error('Error sending request:', error);
    }
  };

  const tabs = [
    { id: 'friends', label: 'Друзья', count: stats.friends_count, icon: Users },
    { id: 'followers', label: 'Подписчики', count: stats.followers_count, icon: UserCheck },
    { id: 'following', label: 'Подписки', count: stats.following_count, icon: UserPlus },
    { id: 'requests', label: 'Заявки', count: stats.pending_friend_requests, icon: Clock },
    { id: 'search', label: 'Поиск', icon: Search }
  ];

  const renderUserCard = (person, type) => {
    const isFriend = friends.some(f => f.id === person.id);
    const isFollowing = following.some(f => f.id === person.id);
    
    return (
      <div key={person.id} className="friend-card">
        <div className="friend-card-avatar">
          {person.profile_picture || person.avatar_url ? (
            <img src={person.profile_picture || person.avatar_url} alt="" />
          ) : (
            <div 
              className="avatar-placeholder"
              style={{ backgroundColor: moduleColor }}
            >
              {person.first_name?.[0] || '?'}
            </div>
          )}
          {person.is_online && <div className="online-indicator"></div>}
        </div>
        
        <div className="friend-card-info">
          <h4 className="friend-name">{person.first_name} {person.last_name}</h4>
          {person.bio && <p className="friend-bio">{person.bio}</p>}
          {type === 'friend' && person.friends_since && (
            <span className="friend-since">
              Друзья с {new Date(person.friends_since).toLocaleDateString('ru-RU')}
            </span>
          )}
          {type === 'follower' && person.followed_at && (
            <span className="followed-since">
              Подписан с {new Date(person.followed_at).toLocaleDateString('ru-RU')}
            </span>
          )}
          {person.mutual_friends_count > 0 && (
            <span className="mutual-friends">
              {person.mutual_friends_count} общих друзей
            </span>
          )}
        </div>

        <div className="friend-card-actions">
          {type === 'friend' && (
            <>
              <button 
                className="action-btn message-btn"
                onClick={() => onOpenChat?.(person)}
                title="Написать сообщение"
              >
                <MessageCircle size={18} />
              </button>
              <button 
                className="action-btn remove-btn"
                onClick={() => handleRemoveFriend(person.id)}
                title="Удалить из друзей"
              >
                <UserMinus size={18} />
              </button>
            </>
          )}
          
          {type === 'follower' && (
            <>
              {!isFriend && (
                <button 
                  className="action-btn primary-btn"
                  onClick={() => handleSendRequest(person.id)}
                  style={{ backgroundColor: moduleColor }}
                  title="Добавить в друзья"
                >
                  <UserPlus size={18} />
                </button>
              )}
              {!isFollowing && (
                <button 
                  className="action-btn follow-btn"
                  onClick={() => handleFollow(person.id)}
                  title="Подписаться в ответ"
                >
                  Подписаться
                </button>
              )}
            </>
          )}
          
          {type === 'following' && (
            <button 
              className="action-btn unfollow-btn"
              onClick={() => handleUnfollow(person.id)}
              title="Отписаться"
            >
              Отписаться
            </button>
          )}

          {type === 'search' && (
            <>
              {isFriend ? (
                <span className="status-badge friend-badge">Друг</span>
              ) : person.request_sent ? (
                <span className="status-badge pending-badge">Заявка отправлена</span>
              ) : (
                <button 
                  className="action-btn primary-btn"
                  onClick={() => handleSendRequest(person.id)}
                  style={{ backgroundColor: moduleColor }}
                >
                  <UserPlus size={16} />
                  <span>В друзья</span>
                </button>
              )}
              {!isFollowing && !isFriend && (
                <button 
                  className="action-btn follow-btn"
                  onClick={() => handleFollow(person.id)}
                >
                  Подписаться
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  const renderRequestCard = (request, type) => {
    const person = type === 'incoming' ? request.sender : request.receiver;
    
    return (
      <div key={request.id} className="request-card">
        <div className="request-card-avatar">
          {person?.profile_picture ? (
            <img src={person.profile_picture} alt="" />
          ) : (
            <div 
              className="avatar-placeholder"
              style={{ backgroundColor: moduleColor }}
            >
              {person?.first_name?.[0] || '?'}
            </div>
          )}
        </div>
        
        <div className="request-card-info">
          <h4 className="request-name">{person?.first_name} {person?.last_name}</h4>
          {request.message && (
            <p className="request-message">"{request.message}"</p>
          )}
          <span className="request-date">
            {new Date(request.created_at).toLocaleDateString('ru-RU')}
          </span>
        </div>

        <div className="request-card-actions">
          {type === 'incoming' ? (
            <>
              <button 
                className="action-btn accept-btn"
                onClick={() => handleAcceptRequest(request.id)}
                style={{ backgroundColor: moduleColor }}
              >
                <Check size={18} />
                <span>Принять</span>
              </button>
              <button 
                className="action-btn reject-btn"
                onClick={() => handleRejectRequest(request.id)}
              >
                <X size={18} />
                <span>Отклонить</span>
              </button>
            </>
          ) : (
            <button 
              className="action-btn cancel-btn"
              onClick={() => handleCancelRequest(request.id)}
            >
              <X size={18} />
              <span>Отменить</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="friends-page">
      {/* Header */}
      <div className="friends-page-header">
        {onBack && (
          <button className="back-btn" onClick={onBack}>
            <ChevronLeft size={20} />
          </button>
        )}
        <h1>Мои связи</h1>
      </div>

      {/* Tabs */}
      <div className="friends-tabs">
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
      <div className="friends-content">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Загрузка...</p>
          </div>
        ) : (
          <>
            {/* Friends Tab */}
            {activeTab === 'friends' && (
              <div className="friends-list-container">
                {friends.length === 0 ? (
                  <div className="empty-state">
                    <Users size={48} color="#9CA3AF" />
                    <h3>Пока нет друзей</h3>
                    <p>Найдите друзей через поиск или примите заявки</p>
                    <button 
                      className="cta-btn"
                      onClick={() => setActiveTab('search')}
                      style={{ backgroundColor: moduleColor }}
                    >
                      Найти друзей
                    </button>
                  </div>
                ) : (
                  <div className="friends-grid">
                    {friends.map(friend => renderUserCard(friend, 'friend'))}
                  </div>
                )}
              </div>
            )}

            {/* Followers Tab */}
            {activeTab === 'followers' && (
              <div className="friends-list-container">
                {followers.length === 0 ? (
                  <div className="empty-state">
                    <UserCheck size={48} color="#9CA3AF" />
                    <h3>Пока нет подписчиков</h3>
                    <p>Когда кто-то подпишется на вас, они появятся здесь</p>
                  </div>
                ) : (
                  <div className="friends-grid">
                    {followers.map(follower => renderUserCard(follower, 'follower'))}
                  </div>
                )}
              </div>
            )}

            {/* Following Tab */}
            {activeTab === 'following' && (
              <div className="friends-list-container">
                {following.length === 0 ? (
                  <div className="empty-state">
                    <UserPlus size={48} color="#9CA3AF" />
                    <h3>Вы ни на кого не подписаны</h3>
                    <p>Подпишитесь на интересных людей</p>
                    <button 
                      className="cta-btn"
                      onClick={() => setActiveTab('search')}
                      style={{ backgroundColor: moduleColor }}
                    >
                      Найти людей
                    </button>
                  </div>
                ) : (
                  <div className="friends-grid">
                    {following.map(person => renderUserCard(person, 'following'))}
                  </div>
                )}
              </div>
            )}

            {/* Requests Tab */}
            {activeTab === 'requests' && (
              <div className="requests-container">
                {/* Incoming Requests */}
                <div className="requests-section">
                  <h3 className="section-title">
                    Входящие заявки
                    {incomingRequests.length > 0 && (
                      <span className="count-badge" style={{ backgroundColor: moduleColor }}>
                        {incomingRequests.length}
                      </span>
                    )}
                  </h3>
                  {incomingRequests.length === 0 ? (
                    <p className="no-requests">Нет входящих заявок</p>
                  ) : (
                    <div className="requests-list">
                      {incomingRequests.map(req => renderRequestCard(req, 'incoming'))}
                    </div>
                  )}
                </div>

                {/* Outgoing Requests */}
                <div className="requests-section">
                  <h3 className="section-title">Исходящие заявки</h3>
                  {outgoingRequests.length === 0 ? (
                    <p className="no-requests">Нет исходящих заявок</p>
                  ) : (
                    <div className="requests-list">
                      {outgoingRequests.map(req => renderRequestCard(req, 'outgoing'))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Search Tab */}
            {activeTab === 'search' && (
              <div className="search-container">
                <div className="search-input-wrapper">
                  <Search size={20} color="#9CA3AF" />
                  <input
                    type="text"
                    placeholder="Поиск по имени..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input-large"
                  />
                </div>

                {searchQuery.length < 2 ? (
                  <div className="search-hint">
                    <p>Введите минимум 2 символа для поиска</p>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="empty-state">
                    <Search size={48} color="#9CA3AF" />
                    <h3>Никого не найдено</h3>
                    <p>Попробуйте изменить запрос</p>
                  </div>
                ) : (
                  <div className="friends-grid">
                    {searchResults.map(person => renderUserCard(person, 'search'))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default FriendsPage;
