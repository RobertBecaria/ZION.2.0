import React, { useState, useEffect } from 'react';
import { Users, MapPin, Calendar, Lock, Eye, Globe, Shield, ArrowLeft } from 'lucide-react';

function PublicFamilyProfile({ user, familyId, onBack, moduleColor = '#059669' }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (familyId) {
      loadPublicProfile();
    } else {
      setError('Семейный профиль не найден. Пожалуйста, создайте семью сначала.');
      setLoading(false);
    }
  }, [familyId]);

  const loadPublicProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('zion_token');
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
      
      const response = await fetch(`${backendUrl}/api/family/${familyId}/public`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data.profile);
      } else if (response.status === 403) {
        setError('Этот профиль семьи приватный и недоступен для просмотра.');
      } else {
        setError('Не удалось загрузить профиль семьи.');
      }
    } catch (error) {
      console.error('Error loading public profile:', error);
      setError('Ошибка загрузки профиля.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="public-profile-container" style={{ '--module-color': moduleColor }}>
        <div className="loading-state">Загрузка...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="public-profile-container" style={{ '--module-color': moduleColor }}>
        <div className="error-state">
          <Lock size={48} color="#65676B" />
          <h3>{error}</h3>
          {onBack && (
            <button onClick={onBack} className="back-button">
              <ArrowLeft size={18} />
              Назад
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="public-profile-container" style={{ '--module-color': moduleColor }}>
        <div className="error-state">Профиль не найден</div>
      </div>
    );
  }

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div className="public-profile-container" style={{ '--module-color': moduleColor }}>
      {/* Preview Mode Banner */}
      {profile.is_preview_mode && (
        <div className="preview-banner" style={{ backgroundColor: moduleColor }}>
          <Eye size={20} />
          <span>Режим предварительного просмотра - так вашу семью видят другие пользователи</span>
        </div>
      )}

      {/* Header with Banner & Avatar */}
      <div className="public-profile-header">
        <div 
          className="profile-banner" 
          style={{ 
            backgroundImage: profile.banner_url ? `url(${profile.banner_url})` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            backgroundColor: profile.banner_url ? 'transparent' : moduleColor
          }}
        >
          {onBack && (
            <button onClick={onBack} className="back-button-overlay">
              <ArrowLeft size={20} />
            </button>
          )}
        </div>

        <div className="profile-info-section">
          <div className="profile-avatar-wrapper">
            {profile.family_photo_url ? (
              <img src={profile.family_photo_url} alt="Family" className="profile-avatar-large" />
            ) : (
              <div className="profile-avatar-large placeholder" style={{ backgroundColor: moduleColor }}>
                <Users size={48} color="white" />
              </div>
            )}
          </div>

          <div className="profile-details">
            <h1 className="family-name">
              {profile.family_name} {profile.family_surname}
              {profile.is_private && (
                <span className="privacy-badge private">
                  <Lock size={16} />
                  Приватный
                </span>
              )}
            </h1>

            <div className="profile-meta">
              {profile.city && (
                <div className="meta-item">
                  <MapPin size={16} />
                  <span>{profile.city}</span>
                </div>
              )}
              <div className="meta-item">
                <Users size={16} />
                <span>{profile.member_count} {profile.member_count === 1 ? 'член' : profile.member_count < 5 ? 'члена' : 'членов'}</span>
              </div>
              <div className="meta-item">
                <Calendar size={16} />
                <span>Создана {formatDate(profile.created_at)}</span>
              </div>
            </div>

            {profile.description && (
              <p className="profile-description">{profile.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Privacy Notice */}
      <div className="privacy-notice">
        <Shield size={20} color={moduleColor} />
        <div>
          <strong>Настройки приватности:</strong>
          <div className="privacy-settings-display">
            {profile.who_can_see_posts === 'family' && (
              <span className="privacy-tag">Посты: Только семья</span>
            )}
            {profile.who_can_see_posts === 'household' && (
              <span className="privacy-tag">Посты: Домохозяйство</span>
            )}
            {profile.who_can_see_posts === 'public' && (
              <span className="privacy-tag public"><Globe size={14} />Посты: Публично</span>
            )}
          </div>
        </div>
      </div>

      {/* Members Section */}
      {profile.members && profile.members.length > 0 && (
        <div className="public-section">
          <h2 className="section-title">
            <Users size={24} />
            Члены семьи
          </h2>
          <div className="members-grid">
            {profile.members.map((member, index) => (
              <div key={index} className="member-card">
                <div className="member-avatar" style={{ backgroundColor: moduleColor }}>
                  {member.name?.charAt(0).toUpperCase()}
                </div>
                <div className="member-info">
                  <div className="member-name">
                    {member.name} {member.surname}
                    {member.is_creator && (
                      <span className="creator-badge" style={{ color: moduleColor }}>
                        • Создатель
                      </span>
                    )}
                  </div>
                  <div className="member-relationship">{member.relationship}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Posts Section */}
      {profile.posts_visible ? (
        <div className="public-section">
          <h2 className="section-title">Последние публикации</h2>
          {profile.posts && profile.posts.length > 0 ? (
            <div className="posts-list">
              {profile.posts.map(post => (
                <div key={post.id} className="post-card">
                  <div className="post-header">
                    <div className="post-author">
                      <div className="author-avatar" style={{ backgroundColor: moduleColor }}>
                        {post.author_name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="author-name">{post.author_name}</div>
                        <div className="post-date">{formatDate(post.created_at)}</div>
                      </div>
                    </div>
                  </div>
                  <p className="post-content">{post.content}</p>
                  <div className="post-stats">
                    <span>❤️ {post.like_count}</span>
                    <span>💬 {post.comment_count}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>Пока нет публикаций</p>
            </div>
          )}
        </div>
      ) : (
        <div className="public-section">
          <div className="private-content-notice">
            <Lock size={32} color="#65676B" />
            <h3>Публикации скрыты</h3>
            <p>Эта семья делится публикациями только с членами семьи.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default PublicFamilyProfile;