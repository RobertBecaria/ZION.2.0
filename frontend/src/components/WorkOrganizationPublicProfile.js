import React, { useState, useEffect } from 'react';
import { Building2, Users, MapPin, Globe, Calendar, UserPlus, Heart, ArrowLeft, Briefcase } from 'lucide-react';


import { BACKEND_URL } from '../config/api';
function WorkOrganizationPublicProfile({ organizationId, onBack, currentUserId, moduleColor = '#C2410C' }) {
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [hasJoinRequest, setHasJoinRequest] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (organizationId) {
      fetchOrganizationPublicProfile();
      if (currentUserId) {
        checkFollowStatus();
        checkJoinRequestStatus();
      }
    }
  }, [organizationId, currentUserId]);

  const fetchOrganizationPublicProfile = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/organizations/${organizationId}/public`);

      if (response.ok) {
        const data = await response.json();
        setOrganization(data.data);
      } else {
        console.error('Failed to fetch organization public profile');
      }
    } catch (error) {
      console.error('Error fetching organization:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkFollowStatus = async () => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/organizations/${organizationId}/follow/status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setIsFollowing(data.is_following);
      }
    } catch (error) {
      console.error('Error checking follow status:', error);
    }
  };

  const checkJoinRequestStatus = async () => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/work/organizations/${organizationId}/join-requests/my-status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setHasJoinRequest(data.has_pending_request);
      }
    } catch (error) {
      console.error('Error checking join request status:', error);
    }
  };

  const handleFollow = async () => {
    try {
      setActionLoading(true);
      const token = localStorage.getItem('zion_token');
      
      const endpoint = isFollowing 
        ? `${BACKEND_URL}/api/organizations/${organizationId}/follow`
        : `${BACKEND_URL}/api/organizations/${organizationId}/follow`;
      
      const method = isFollowing ? 'DELETE' : 'POST';

      const response = await fetch(endpoint, {
        method: method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setIsFollowing(!isFollowing);
        alert(data.message);
        // Update follower count
        setOrganization(prev => ({
          ...prev,
          follower_count: isFollowing ? prev.follower_count - 1 : prev.follower_count + 1
        }));
      } else {
        const error = await response.json();
        alert(error.detail || 'Ошибка');
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      alert('Произошла ошибка');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestToJoin = async () => {
    try {
      setActionLoading(true);
      const token = localStorage.getItem('zion_token');

      const response = await fetch(`${BACKEND_URL}/api/organizations/${organizationId}/join-request`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setHasJoinRequest(true);
        alert(data.message || 'Запрос отправлен!');
      } else {
        const error = await response.json();
        alert(error.detail || 'Ошибка при отправке запроса');
      }
    } catch (error) {
      console.error('Error sending join request:', error);
      alert('Произошла ошибка');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="public-profile-loading">
        <Building2 size={48} style={{ color: moduleColor }} />
        <p>Загрузка...</p>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="public-profile-error">
        <Building2 size={48} style={{ color: '#BCC0C4' }} />
        <p>Организация не найдена</p>
        <button onClick={onBack} className="back-btn">
          <ArrowLeft size={18} />
          Назад
        </button>
      </div>
    );
  }

  return (
    <div className="work-organization-public-profile">
      {/* Header with Back Button */}
      <div className="profile-header-nav">
        <button onClick={onBack} className="back-button">
          <ArrowLeft size={20} />
          <span>Назад</span>
        </button>
      </div>

      {/* Banner */}
      <div 
        className="profile-banner" 
        style={{ 
          backgroundImage: organization.banner_url ? `url(${organization.banner_url})` : 'none',
          background: organization.banner_url ? undefined : `linear-gradient(135deg, ${moduleColor}15 0%, ${moduleColor}05 100%)`
        }}
      />

      {/* Logo and Basic Info */}
      <div className="profile-main-info">
        <div className="profile-logo-section">
          {organization.logo_url ? (
            <img src={organization.logo_url} alt={organization.name} className="profile-logo" />
          ) : (
            <div className="profile-logo-placeholder" style={{ background: moduleColor }}>
              <Building2 size={48} color="white" />
            </div>
          )}

          <div className="profile-name-section">
            <h1 className="profile-name">{organization.name}</h1>
            <div className="profile-meta">
              {organization.organization_type && (
                <span className="meta-item">
                  <Briefcase size={14} />
                  {organization.organization_type}
                </span>
              )}
              {organization.location && (
                <span className="meta-item">
                  <MapPin size={14} />
                  {organization.location}
                </span>
              )}
              {organization.founded_year && (
                <span className="meta-item">
                  <Calendar size={14} />
                  Основана в {organization.founded_year}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="profile-actions">
          <button
            className="action-btn follow-btn"
            onClick={handleFollow}
            disabled={actionLoading}
            style={{
              background: isFollowing ? '#F0F2F5' : moduleColor,
              color: isFollowing ? '#050505' : 'white'
            }}
          >
            <Heart size={18} fill={isFollowing ? moduleColor : 'none'} />
            {isFollowing ? 'Отписаться' : 'Подписаться'}
          </button>

          <button
            className="action-btn join-btn"
            onClick={handleRequestToJoin}
            disabled={actionLoading || hasJoinRequest}
            style={{ background: hasJoinRequest ? '#059669' : moduleColor }}
          >
            <UserPlus size={18} />
            {hasJoinRequest ? 'Запрос отправлен' : 'Запрос на вступление'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="profile-stats">
        <div className="stat-item">
          <div className="stat-number">{organization.member_count}</div>
          <div className="stat-label">Сотрудников</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">{organization.follower_count}</div>
          <div className="stat-label">Подписчиков</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">{organization.department_count}</div>
          <div className="stat-label">Отделов</div>
        </div>
      </div>

      {/* Description */}
      {organization.description && (
        <div className="profile-section">
          <h2 className="section-title">О компании</h2>
          <p className="profile-description">{organization.description}</p>
        </div>
      )}

      {/* Additional Info */}
      <div className="profile-section">
        <h2 className="section-title">Информация</h2>
        <div className="info-grid">
          {organization.industry && (
            <div className="info-item">
              <span className="info-label">Отрасль:</span>
              <span className="info-value">{organization.industry}</span>
            </div>
          )}
          {organization.website && (
            <div className="info-item">
              <span className="info-label">Веб-сайт:</span>
              <a href={organization.website} target="_blank" rel="noopener noreferrer" className="info-link">
                <Globe size={14} />
                {organization.website}
              </a>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .work-organization-public-profile {
          max-width: 1000px;
          margin: 0 auto;
          background: white;
          border-radius: 12px;
          overflow: hidden;
        }

        .profile-header-nav {
          padding: 1rem 1.5rem;
          border-bottom: 1px solid #E4E6EB;
        }

        .back-button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: none;
          border: none;
          color: #65676B;
          font-weight: 500;
          cursor: pointer;
          transition: color 0.2s;
        }

        .back-button:hover {
          color: #050505;
        }

        .profile-banner {
          height: 250px;
          background-size: cover;
          background-position: center;
        }

        .profile-main-info {
          padding: 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1.5rem;
          flex-wrap: wrap;
        }

        .profile-logo-section {
          display: flex;
          gap: 1.5rem;
          align-items: center;
          flex: 1;
        }

        .profile-logo,
        .profile-logo-placeholder {
          width: 120px;
          height: 120px;
          border-radius: 12px;
          object-fit: cover;
          border: 4px solid white;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          margin-top: -60px;
        }

        .profile-logo-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .profile-name-section {
          flex: 1;
        }

        .profile-name {
          margin: 0 0 0.5rem;
          font-size: 2rem;
          color: #050505;
        }

        .profile-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          color: #65676B;
          font-size: 0.9375rem;
        }

        .meta-item {
          display: flex;
          align-items: center;
          gap: 0.375rem;
        }

        .profile-actions {
          display: flex;
          gap: 0.75rem;
          margin-top: 0.5rem;
        }

        .action-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .action-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .action-btn:not(:disabled):hover {
          opacity: 0.9;
          transform: translateY(-1px);
        }

        .profile-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
          padding: 1.5rem;
          border-top: 1px solid #E4E6EB;
          border-bottom: 1px solid #E4E6EB;
        }

        .stat-item {
          text-align: center;
        }

        .stat-number {
          font-size: 2rem;
          font-weight: 700;
          color: #050505;
          margin-bottom: 0.25rem;
        }

        .stat-label {
          font-size: 0.875rem;
          color: #65676B;
        }

        .profile-section {
          padding: 1.5rem;
          border-bottom: 1px solid #E4E6EB;
        }

        .profile-section:last-child {
          border-bottom: none;
        }

        .section-title {
          margin: 0 0 1rem;
          font-size: 1.25rem;
          font-weight: 700;
          color: #050505;
        }

        .profile-description {
          margin: 0;
          color: #050505;
          line-height: 1.6;
          font-size: 0.9375rem;
        }

        .info-grid {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .info-item {
          display: flex;
          gap: 0.75rem;
        }

        .info-label {
          font-weight: 600;
          color: #65676B;
          min-width: 120px;
        }

        .info-value {
          color: #050505;
        }

        .info-link {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          color: #1877F2;
          text-decoration: none;
          transition: opacity 0.2s;
        }

        .info-link:hover {
          opacity: 0.8;
        }

        .public-profile-loading,
        .public-profile-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 4rem 2rem;
          text-align: center;
        }

        .public-profile-loading p,
        .public-profile-error p {
          margin: 1rem 0;
          color: #65676B;
        }

        @media (max-width: 768px) {
          .profile-main-info {
            flex-direction: column;
          }

          .profile-logo-section {
            flex-direction: column;
            align-items: flex-start;
          }

          .profile-actions {
            width: 100%;
            flex-direction: column;
          }

          .action-btn {
            width: 100%;
            justify-content: center;
          }

          .profile-stats {
            grid-template-columns: repeat(3, 1fr);
            gap: 1rem;
          }
        }
      `}</style>
    </div>
  );
}

export default WorkOrganizationPublicProfile;