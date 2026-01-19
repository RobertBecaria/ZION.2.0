import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Users, Calendar, Settings, Share2, Camera } from 'lucide-react';
import UniversalWall from './UniversalWall';
import UniversalChatLayout from './UniversalChatLayout';
import FamilyStatusForm from './FamilyStatusForm';
import ProfileImageUpload from './ProfileImageUpload';
import FamilySettingsPage from './FamilySettingsPage';
import { toast } from '../utils/animations';

function MyFamilyProfile({ user, familyData, moduleColor = '#059669' }) {
  const [activeTab, setActiveTab] = useState('wall'); // 'wall' | 'chat' | 'calendar'
  const [family, setFamily] = useState(familyData || null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const initializedRef = useRef(false);

  const handleBannerUpload = useCallback(async (base64Image) => {
    try {
      const token = localStorage.getItem('zion_token');
      const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
      
      
      const response = await fetch(`${backendUrl}/api/family-profiles/${family.id}/banner`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ banner_image: base64Image })
      });

      if (response.ok) {
        // Update local state
        setFamily(prev => ({ ...prev, banner_url: base64Image }));
        toast.success('Баннер обновлен!');
      } else {
        throw new Error('Failed to upload banner');
      }
    } catch (error) {
      console.error('Banner upload error:', error);
      throw error;
    }
  }, [family?.id]);

  const handleAvatarUpload = useCallback(async (base64Image) => {
    try {
      const token = localStorage.getItem('zion_token');
      const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
      
      
      const response = await fetch(`${backendUrl}/api/family-profiles/${family.id}/avatar`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ avatar_image: base64Image })
      });

      if (response.ok) {
        // Update local state
        setFamily(prev => ({ ...prev, family_photo_url: base64Image }));
        toast.success('Аватар обновлен!');
      } else {
        throw new Error('Failed to upload avatar');
      }
    } catch (error) {
      console.error('Avatar upload error:', error);
      throw error;
    }
  }, [family?.id]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Only run once on mount or when family ID changes
    if (!initializedRef.current || (familyData && family && familyData.id !== family.id)) {
      if (!familyData) {
        setLoading(true);
        loadFamilyData();
      } else {
        setFamily(familyData);
        setLoading(false);
      }
      initializedRef.current = true;
    }
  }, [familyData?.id]); // Only depend on family ID

  const loadFamilyData = async () => {
    try {
      const token = localStorage.getItem('zion_token');
      const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
      
      
      const response = await fetch(`${backendUrl}/api/family-profiles`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const families = data.family_profiles || [];
        // Get first family or primary family
        const primaryFamily = families.find(f => f.is_user_member) || families[0];
        setFamily(primaryFamily);
      }
    } catch (error) {
      console.error('Error loading family data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-loading">
        <div className="loading-spinner"></div>
        <p>Загружаем профиль семьи...</p>
      </div>
    );
  }

  if (!family) {
    return (
      <div className="profile-empty">
        <FamilyStatusForm 
          user={user}
          moduleColor={moduleColor}
          onFamilyCreated={(newFamily) => {
            setFamily(newFamily);
            setLoading(false);
          }}
        />
      </div>
    );
  }

  // Show settings page if active
  if (showSettings) {
    return (
      <FamilySettingsPage
        user={user}
        family={family}
        onBack={() => setShowSettings(false)}
        onFamilyUpdated={(updatedFamily) => {
          setFamily(updatedFamily);
        }}
        moduleColor={moduleColor}
      />
    );
  }

  return (
    <div className="family-profile-container">
      {/* Profile Header */}
      <div className="profile-header" style={{ '--module-color': moduleColor }}>
        {/* Banner */}
        <div className="profile-banner">
          <div className="banner-image" style={{ 
            background: family.banner_url 
              ? `url(${family.banner_url}) center/cover` 
              : `linear-gradient(135deg, ${moduleColor}20 0%, ${moduleColor}40 100%)`
          }}>
            {/* Banner upload button */}
            <ProfileImageUpload
              type="banner"
              currentImage={family.banner_url}
              onUploadComplete={handleBannerUpload}
              moduleColor={moduleColor}
            />
          </div>
        </div>

        {/* Profile Info Section */}
        <div className="profile-info-section">
          <div className="profile-main-info">
            {/* Avatar */}
            <div className="profile-avatar-container">
              <div className="profile-avatar" style={{ backgroundColor: moduleColor }}>
                {(family.family_photo_url || family.avatar_url) ? (
                  <img src={family.family_photo_url || family.avatar_url} alt={family.family_name || family.name} />
                ) : (
                  <Users size={48} color="white" />
                )}
              </div>
              <ProfileImageUpload
                type="avatar"
                currentImage={family.family_photo_url || family.avatar_url}
                onUploadComplete={handleAvatarUpload}
                moduleColor={moduleColor}
              />
            </div>

            {/* Family Name & Info */}
            <div className="profile-details">
              <h1 className="profile-name">{family.family_name || family.name}</h1>
              
              <div className="profile-meta">
                <div className="meta-item">
                  <Users size={16} />
                  <span>{family.member_count || 0} членов</span>
                </div>
                
                {(family.city || family.location) && (
                  <div className="meta-item">
                    <MapPin size={16} />
                    <span>{family.city || family.location}</span>
                  </div>
                )}
                
                <div className="meta-item">
                  <Calendar size={16} />
                  <span>Создана {new Date(family.created_at).toLocaleDateString('ru-RU')}</span>
                </div>
              </div>

              {family.description && (
                <p className="profile-description">{family.description}</p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="profile-actions">
            <button 
              className="action-btn primary" 
              style={{ backgroundColor: moduleColor }}
              onClick={() => setShowSettings(true)}
            >
              <Settings size={18} />
              Управление
            </button>
            <button className="action-btn secondary">
              <Share2 size={18} />
              Поделиться
            </button>
          </div>
        </div>

        {/* Profile Stats */}
        <div className="profile-stats">
          <div className="stat-item">
            <span className="stat-value">{family.posts_count || 0}</span>
            <span className="stat-label">Постов</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{family.followers_count || 0}</span>
            <span className="stat-label">Подписчиков</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{family.events_count || 0}</span>
            <span className="stat-label">Событий</span>
          </div>
        </div>
      </div>

      {/* Content Navigation Tabs */}
      <div className="profile-content-nav">
        <button 
          className={`nav-tab ${activeTab === 'wall' ? 'active' : ''}`}
          onClick={() => setActiveTab('wall')}
          style={{ 
            borderBottomColor: activeTab === 'wall' ? moduleColor : 'transparent',
            color: activeTab === 'wall' ? moduleColor : '#65676B'
          }}
        >
          Стена
        </button>
        <button 
          className={`nav-tab ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
          style={{ 
            borderBottomColor: activeTab === 'chat' ? moduleColor : 'transparent',
            color: activeTab === 'chat' ? moduleColor : '#65676B'
          }}
        >
          Чат
        </button>
        <button 
          className={`nav-tab ${activeTab === 'calendar' ? 'active' : ''}`}
          onClick={() => setActiveTab('calendar')}
          style={{ 
            borderBottomColor: activeTab === 'calendar' ? moduleColor : 'transparent',
            color: activeTab === 'calendar' ? moduleColor : '#65676B'
          }}
        >
          Календарь
        </button>
      </div>

      {/* Content Area */}
      <div className="profile-content">
        {activeTab === 'wall' && (
          <UniversalWall
            moduleColor={moduleColor}
            moduleName={family.family_name || family.name}
            activeModule="family"
            user={user}
          />
        )}

        {activeTab === 'chat' && (
          <UniversalChatLayout
            moduleColor={moduleColor}
            user={user}
          />
        )}

        {activeTab === 'calendar' && (
          <div className="calendar-placeholder">
            <Calendar size={48} color="#9ca3af" />
            <h3>Календарь семьи</h3>
            <p>Скоро здесь появится календарь событий</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default MyFamilyProfile;
