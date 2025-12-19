/**
 * NewsWorldZone Component
 * Right sidebar for News module with Friends, Followers, and social features
 */
import React, { useState, useEffect } from 'react';
import { 
  Users, UserPlus, UserCheck, Bell, Search, TrendingUp,
  MessageCircle, ChevronRight, Check, X, Clock
} from 'lucide-react';

const NewsWorldZone = ({ 
  user, 
  moduleColor = '#1D4ED8',
  onViewFriends,
  onViewFollowers,
  onViewFollowing 
}) => {
  const [socialStats, setSocialStats] = useState({
    friends_count: 0,
    followers_count: 0,
    following_count: 0,
    pending_friend_requests: 0
  });
  const [friendRequests, setFriendRequests] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadSocialData();
  }, []);

  const loadSocialData = async () => {
    try {
      const token = localStorage.getItem('zion_token');
      const headers = { 'Authorization': `Bearer ${token}` };

      // Load all data in parallel
      const [statsRes, requestsRes, suggestionsRes, friendsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/users/me/social-stats`, { headers }),
        fetch(`${BACKEND_URL}/api/friends/requests/incoming`, { headers }),
        fetch(`${BACKEND_URL}/api/users/suggestions?limit=5`, { headers }),
        fetch(`${BACKEND_URL}/api/friends`, { headers })
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        setSocialStats(data);
      }

      if (requestsRes.ok) {
        const data = await requestsRes.json();
        setFriendRequests(data.requests || []);
      }

      if (suggestionsRes.ok) {
        const data = await suggestionsRes.json();
        setSuggestions(data.suggestions || []);
      }

      if (friendsRes.ok) {
        const data = await friendsRes.json();
        setFriends(data.friends?.slice(0, 5) || []);
      }
    } catch (error) {
      console.error('Error loading social data:', error);
    } finally {
      setLoading(false);
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
        // Refresh data
        loadSocialData();
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
        loadSocialData();
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
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
        // Remove from suggestions
        setSuggestions(prev => prev.filter(s => s.id !== userId));
      }
    } catch (error) {
      console.error('Error sending request:', error);
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
        loadSocialData();
      }
    } catch (error) {
      console.error('Error following user:', error);
    }
  };

  return (
    <div className="news-world-zone">
      {/* Social Stats Summary */}
      <div className="widget social-stats-widget">
        <div className="widget-header">
          <Users size={16} color={moduleColor} />
          <span>МОИ СВЯЗИ</span>
        </div>
        <div className="stats-grid">
          <div 
            className="stat-item clickable" 
            onClick={onViewFriends}
            style={{ cursor: 'pointer' }}
          >
            <span className="stat-number" style={{ color: moduleColor }}>
              {socialStats.friends_count}
            </span>
            <span className="stat-label">Друзей</span>
          </div>
          <div 
            className="stat-item clickable" 
            onClick={onViewFollowers}
            style={{ cursor: 'pointer' }}
          >
            <span className="stat-number" style={{ color: moduleColor }}>
              {socialStats.followers_count}
            </span>
            <span className="stat-label">Подписчиков</span>
          </div>
          <div 
            className="stat-item clickable" 
            onClick={onViewFollowing}
            style={{ cursor: 'pointer' }}
          >
            <span className="stat-number" style={{ color: moduleColor }}>
              {socialStats.following_count}
            </span>
            <span className="stat-label">Подписок</span>
          </div>
        </div>
      </div>

      {/* Friend Requests */}
      {friendRequests.length > 0 && (
        <div className="widget friend-requests-widget">
          <div className="widget-header">
            <UserPlus size={16} color={moduleColor} />
            <span>ЗАЯВКИ В ДРУЗЬЯ</span>
            <span className="badge" style={{ backgroundColor: moduleColor }}>
              {friendRequests.length}
            </span>
          </div>
          <div className="requests-list">
            {friendRequests.slice(0, 3).map(request => (
              <div key={request.id} className="request-item">
                <div className="request-avatar">
                  {request.sender?.profile_picture ? (
                    <img src={request.sender.profile_picture} alt="" />
                  ) : (
                    <div 
                      className="avatar-placeholder"
                      style={{ backgroundColor: moduleColor }}
                    >
                      {request.sender?.first_name?.[0] || '?'}
                    </div>
                  )}
                </div>
                <div className="request-info">
                  <span className="request-name">
                    {request.sender?.first_name} {request.sender?.last_name}
                  </span>
                  {request.message && (
                    <span className="request-message">{request.message}</span>
                  )}
                </div>
                <div className="request-actions">
                  <button 
                    className="btn-accept"
                    onClick={() => handleAcceptRequest(request.id)}
                    title="Принять"
                  >
                    <Check size={16} />
                  </button>
                  <button 
                    className="btn-reject"
                    onClick={() => handleRejectRequest(request.id)}
                    title="Отклонить"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {friendRequests.length > 3 && (
            <button className="view-all-btn" onClick={onViewFriends}>
              Показать все ({friendRequests.length})
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      )}

      {/* Online Friends */}
      {friends.length > 0 && (
        <div className="widget online-friends-widget">
          <div className="widget-header">
            <UserCheck size={16} color={moduleColor} />
            <span>ДРУЗЬЯ</span>
          </div>
          <div className="friends-list">
            {friends.map(friend => (
              <div key={friend.id} className="friend-item">
                <div className="friend-avatar">
                  {friend.profile_picture ? (
                    <img src={friend.profile_picture} alt="" />
                  ) : (
                    <div 
                      className="avatar-placeholder"
                      style={{ backgroundColor: moduleColor }}
                    >
                      {friend.first_name?.[0] || '?'}
                    </div>
                  )}
                  {friend.is_online && <div className="online-dot"></div>}
                </div>
                <div className="friend-info">
                  <span className="friend-name">
                    {friend.first_name} {friend.last_name}
                  </span>
                </div>
                <button 
                  className="message-btn"
                  title="Написать сообщение"
                >
                  <MessageCircle size={14} />
                </button>
              </div>
            ))}
          </div>
          <button className="view-all-btn" onClick={onViewFriends}>
            Все друзья
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* People Suggestions */}
      {suggestions.length > 0 && (
        <div className="widget suggestions-widget">
          <div className="widget-header">
            <TrendingUp size={16} color={moduleColor} />
            <span>ВОЗМОЖНЫЕ ДРУЗЬЯ</span>
          </div>
          <div className="suggestions-list">
            {suggestions.map(suggestion => (
              <div key={suggestion.id} className="suggestion-item">
                <div className="suggestion-avatar">
                  {suggestion.profile_picture ? (
                    <img src={suggestion.profile_picture} alt="" />
                  ) : (
                    <div 
                      className="avatar-placeholder"
                      style={{ backgroundColor: moduleColor }}
                    >
                      {suggestion.first_name?.[0] || '?'}
                    </div>
                  )}
                </div>
                <div className="suggestion-info">
                  <span className="suggestion-name">
                    {suggestion.first_name} {suggestion.last_name}
                  </span>
                  {suggestion.mutual_friends_count > 0 && (
                    <span className="mutual-count">
                      {suggestion.mutual_friends_count} общих друзей
                    </span>
                  )}
                </div>
                <div className="suggestion-actions">
                  <button 
                    className="btn-add-friend"
                    onClick={() => handleSendRequest(suggestion.id)}
                    style={{ backgroundColor: moduleColor }}
                  >
                    <UserPlus size={14} />
                  </button>
                  <button 
                    className="btn-follow"
                    onClick={() => handleFollow(suggestion.id)}
                  >
                    Подписаться
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search People */}
      <div className="widget search-people-widget">
        <div className="widget-header">
          <Search size={16} color={moduleColor} />
          <span>ПОИСК ЛЮДЕЙ</span>
        </div>
        <input 
          type="text" 
          placeholder="Найти друзей..." 
          className="search-input"
        />
      </div>
    </div>
  );
};

export default NewsWorldZone;
