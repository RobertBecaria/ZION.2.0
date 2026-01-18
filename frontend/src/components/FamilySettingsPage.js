import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Trash2, Users, Search, X, Plus, Shield, Eye, MessageCircle, Globe } from 'lucide-react';

function FamilySettingsPage({ user, family, onBack, onFamilyUpdated, moduleColor = '#059669' }) {
  const [activeTab, setActiveTab] = useState('basic'); // 'basic' | 'members' | 'privacy' | 'danger'
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Basic Info State
  const [basicInfo, setBasicInfo] = useState({
    family_name: family?.family_name || '',
    description: family?.description || '',
    city: family?.city || '',
    location: family?.location || ''
  });

  // Members State
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Privacy State
  const [privacySettings, setPrivacySettings] = useState({
    is_private: family?.is_private || false,
    allow_public_discovery: family?.allow_public_discovery || true,
    who_can_see_posts: family?.who_can_see_posts || 'family', // 'family', 'household', 'public'
    who_can_comment: family?.who_can_comment || 'family', // 'family', 'household', 'public', 'none'
    profile_searchability: family?.profile_searchability || 'public' // 'public', 'users_only', 'none'
  });

  // Load family members on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadFamilyMembers();
  }, [family?.id]);


  // Load family members from database
  const loadFamilyMembers = async () => {
    if (!family?.id) return;
    
    setLoadingMembers(true);
    try {
      const token = localStorage.getItem('zion_token');
      const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
      
      
      const response = await fetch(`${backendUrl}/api/family/${family.id}/members`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setMembers(data.members || []);
      }
    } catch (error) {
      console.error('Error loading members:', error);
    } finally {
      setLoadingMembers(false);
    }
  };

  // Search for users to add as members
  const searchUsers = async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const token = localStorage.getItem('zion_token');
      const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
      
      
      const response = await fetch(`${backendUrl}/api/users/search?query=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.users || []);
      }
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Add member to family
  const addMember = async (userData, relationship) => {
    try {
      const token = localStorage.getItem('zion_token');
      const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
      
      
      const response = await fetch(`${backendUrl}/api/family/${family.id}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userData.id,
          relationship: relationship
        })
      });

      if (response.ok) {
        // Reload members list from server
        await loadFamilyMembers();
        setSearchQuery('');
        setSearchResults([]);
        showMessage('Член семьи добавлен', 'success');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to add member');
      }
    } catch (error) {
      console.error('Error adding member:', error);
      showMessage(error.message || 'Ошибка добавления члена семьи', 'error');
    }
  };

  // Remove member from family
  const removeMember = async (memberId) => {
    if (!window.confirm('Вы уверены, что хотите удалить этого члена семьи?')) {
      return;
    }

    try {
      const token = localStorage.getItem('zion_token');
      const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
      
      
      const response = await fetch(`${backendUrl}/api/family/${family.id}/members/${memberId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        // Reload members list from server
        await loadFamilyMembers();
        showMessage('Член семьи удален', 'success');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to remove member');
      }
    } catch (error) {
      console.error('Error removing member:', error);
      showMessage(error.message || 'Ошибка удаления члена семьи', 'error');
    }
  };

  // Update basic info
  const updateBasicInfo = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('zion_token');
      const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
      
      
      const response = await fetch(`${backendUrl}/api/family/${family.id}/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(basicInfo)
      });

      if (response.ok) {
        const data = await response.json();
        if (onFamilyUpdated) {
          onFamilyUpdated(data.family);
        }
        showMessage('Информация обновлена', 'success');
      } else {
        throw new Error('Failed to update basic info');
      }
    } catch (error) {
      console.error('Error updating basic info:', error);
      showMessage('Ошибка обновления информации', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Update privacy settings
  const updatePrivacySettings = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('zion_token');
      const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
      
      
      const response = await fetch(`${backendUrl}/api/family/${family.id}/privacy`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(privacySettings)
      });

      if (response.ok) {
        const data = await response.json();
        if (onFamilyUpdated) {
          onFamilyUpdated(data.family);
        }
        showMessage('Настройки приватности обновлены', 'success');
      } else {
        throw new Error('Failed to update privacy settings');
      }
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      showMessage('Ошибка обновления настроек', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Delete family
  const deleteFamily = async () => {
    const confirmText = 'УДАЛИТЬ';
    const userInput = prompt(`Это действие необратимо. Введите "${confirmText}" для подтверждения удаления семьи.`);
    
    if (userInput !== confirmText) {
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('zion_token');
      const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
      
      
      const response = await fetch(`${backendUrl}/api/family/${family.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        showMessage('Семья удалена', 'success');
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        throw new Error('Failed to delete family');
      }
    } catch (error) {
      console.error('Error deleting family:', error);
      showMessage('Ошибка удаления семьи', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Show message helper
  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div className="family-settings-page" style={{ '--module-color': moduleColor }}>
      {/* Header */}
      <div className="settings-header">
        <button className="back-button" onClick={onBack}>
          <ArrowLeft size={20} />
          Назад к профилю
        </button>
        <h1>Настройки семьи</h1>
      </div>

      {/* Message Toast */}
      {message && (
        <div className={`settings-message ${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="settings-tabs">
        <button 
          className={`settings-tab ${activeTab === 'basic' ? 'active' : ''}`}
          onClick={() => setActiveTab('basic')}
          style={{ borderBottomColor: activeTab === 'basic' ? moduleColor : 'transparent' }}
        >
          <Users size={18} />
          Основная информация
        </button>
        <button 
          className={`settings-tab ${activeTab === 'members' ? 'active' : ''}`}
          onClick={() => setActiveTab('members')}
          style={{ borderBottomColor: activeTab === 'members' ? moduleColor : 'transparent' }}
        >
          <Users size={18} />
          Члены семьи
        </button>
        <button 
          className={`settings-tab ${activeTab === 'privacy' ? 'active' : ''}`}
          onClick={() => setActiveTab('privacy')}
          style={{ borderBottomColor: activeTab === 'privacy' ? moduleColor : 'transparent' }}
        >
          <Shield size={18} />
          Приватность
        </button>
        <button 
          className={`settings-tab ${activeTab === 'danger' ? 'active' : ''}`}
          onClick={() => setActiveTab('danger')}
          style={{ borderBottomColor: activeTab === 'danger' ? moduleColor : 'transparent' }}
        >
          <Trash2 size={18} />
          Опасная зона
        </button>
      </div>

      {/* Tab Content */}
      <div className="settings-content">
        {/* Basic Info Tab */}
        {activeTab === 'basic' && (
          <div className="settings-section">
            <h2>Основная информация</h2>
            <div className="form-group">
              <label>Название семьи *</label>
              <input
                type="text"
                value={basicInfo.family_name}
                onChange={(e) => setBasicInfo({ ...basicInfo, family_name: e.target.value })}
                placeholder="Например: Семья Ивановых"
              />
            </div>
            <div className="form-group">
              <label>Описание</label>
              <textarea
                value={basicInfo.description}
                onChange={(e) => setBasicInfo({ ...basicInfo, description: e.target.value })}
                placeholder="Расскажите о вашей семье..."
                rows={4}
              />
            </div>
            <div className="form-group">
              <label>Город</label>
              <input
                type="text"
                value={basicInfo.city}
                onChange={(e) => setBasicInfo({ ...basicInfo, city: e.target.value })}
                placeholder="Например: Москва"
              />
            </div>
            <div className="form-group">
              <label>Адрес (необязательно)</label>
              <input
                type="text"
                value={basicInfo.location}
                onChange={(e) => setBasicInfo({ ...basicInfo, location: e.target.value })}
                placeholder="Например: ул. Ленина, 10"
              />
            </div>
            <button 
              className="save-button"
              onClick={updateBasicInfo}
              disabled={loading || !basicInfo.family_name}
              style={{ backgroundColor: moduleColor }}
            >
              <Save size={18} />
              {loading ? 'Сохранение...' : 'Сохранить изменения'}
            </button>
          </div>
        )}

        {/* Members Tab */}
        {activeTab === 'members' && (
          <div className="settings-section">
            <h2>Члены семьи</h2>
            
            {/* Search to add members */}
            <div className="member-search-section">
              <h3>Добавить члена семьи</h3>
              <div className="search-box">
                <Search size={18} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск пользователей по имени..."
                />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(''); setSearchResults([]); }}>
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="search-results">
                  {searchResults.map(user => (
                    <div key={user.id} className="search-result-item">
                      <div className="user-info">
                        <div className="user-avatar" style={{ backgroundColor: moduleColor }}>
                          {user.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="user-name">{user.name} {user.surname}</div>
                          <div className="user-email">{user.email}</div>
                        </div>
                      </div>
                      <select 
                        className="relationship-select"
                        onChange={(e) => {
                          if (e.target.value) {
                            addMember(user, e.target.value);
                          }
                        }}
                        defaultValue=""
                      >
                        <option value="" disabled>Добавить как...</option>
                        <option value="spouse">Супруг(а)</option>
                        <option value="child">Ребенок</option>
                        <option value="parent">Родитель</option>
                        <option value="sibling">Брат/Сестра</option>
                        <option value="other">Другое</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}

              {isSearching && (
                <div className="searching-indicator">Поиск...</div>
              )}

              {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
                <div className="no-results">Пользователи не найдены</div>
              )}
            </div>

            {/* Current Members List */}
            <div className="members-list-section">
              <h3>Текущие члены ({members.length})</h3>
              {loadingMembers ? (
                <div className="searching-indicator">Загрузка...</div>
              ) : members.length === 0 ? (
                <div className="empty-members">
                  <Users size={48} color="#9ca3af" />
                  <p>Пока нет членов семьи</p>
                </div>
              ) : (
                <div className="members-list">
                  {members.map(member => (
                    <div key={member.id} className="member-item">
                      <div className="member-info">
                        <div className="member-avatar" style={{ backgroundColor: moduleColor }}>
                          {member.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="member-name">
                            {member.name} {member.surname}
                            {member.is_creator && <span style={{ 
                              marginLeft: '0.5rem', 
                              fontSize: '0.75rem', 
                              color: moduleColor,
                              fontWeight: 'bold'
                            }}>• Создатель</span>}
                          </div>
                          <div className="member-relationship">
                            {member.relationship || member.family_role}
                          </div>
                        </div>
                      </div>
                      {!member.is_creator && (
                        <button 
                          className="remove-member-btn"
                          onClick={() => removeMember(member.id)}
                          title="Удалить из семьи"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Privacy Tab */}
        {activeTab === 'privacy' && (
          <div className="settings-section">
            <h2>Настройки приватности</h2>
            
            <div className="privacy-setting">
              <div className="setting-icon">
                <Eye size={24} color={moduleColor} />
              </div>
              <div className="setting-content">
                <h3>Кто может видеть посты</h3>
                <p>Выберите, кто может видеть публикации вашей семьи</p>
                <select 
                  value={privacySettings.who_can_see_posts}
                  onChange={(e) => setPrivacySettings({ ...privacySettings, who_can_see_posts: e.target.value })}
                >
                  <option value="family">Только семья</option>
                  <option value="household">Домохозяйство</option>
                  <option value="public">Публично</option>
                </select>
              </div>
            </div>

            <div className="privacy-setting">
              <div className="setting-icon">
                <MessageCircle size={24} color={moduleColor} />
              </div>
              <div className="setting-content">
                <h3>Кто может комментировать</h3>
                <p>Выберите, кто может оставлять комментарии</p>
                <select 
                  value={privacySettings.who_can_comment}
                  onChange={(e) => setPrivacySettings({ ...privacySettings, who_can_comment: e.target.value })}
                >
                  <option value="family">Только семья</option>
                  <option value="household">Домохозяйство</option>
                  <option value="public">Все пользователи</option>
                  <option value="none">Никто</option>
                </select>
              </div>
            </div>

            <div className="privacy-setting">
              <div className="setting-icon">
                <Globe size={24} color={moduleColor} />
              </div>
              <div className="setting-content">
                <h3>Поиск профиля</h3>
                <p>Определите, кто может найти ваш профиль в поиске</p>
                <select 
                  value={privacySettings.profile_searchability}
                  onChange={(e) => setPrivacySettings({ ...privacySettings, profile_searchability: e.target.value })}
                >
                  <option value="public">Все (публично)</option>
                  <option value="users_only">Только пользователи платформы</option>
                  <option value="none">Никто</option>
                </select>
              </div>
            </div>

            <div className="privacy-setting">
              <div className="setting-content">
                <label className="toggle-setting">
                  <input
                    type="checkbox"
                    checked={privacySettings.is_private}
                    onChange={(e) => setPrivacySettings({ ...privacySettings, is_private: e.target.checked })}
                  />
                  <span className="toggle-label">
                    <strong>Приватный профиль</strong>
                    <p>Только члены семьи могут видеть профиль</p>
                  </span>
                </label>
              </div>
            </div>

            <div className="privacy-setting">
              <div className="setting-content">
                <label className="toggle-setting">
                  <input
                    type="checkbox"
                    checked={privacySettings.allow_public_discovery}
                    onChange={(e) => setPrivacySettings({ ...privacySettings, allow_public_discovery: e.target.checked })}
                  />
                  <span className="toggle-label">
                    <strong>Разрешить публичное обнаружение</strong>
                    <p>Ваша семья может быть найдена другими пользователями</p>
                  </span>
                </label>
              </div>
            </div>

            <button 
              className="save-button"
              onClick={updatePrivacySettings}
              disabled={loading}
              style={{ backgroundColor: moduleColor }}
            >
              <Save size={18} />
              {loading ? 'Сохранение...' : 'Сохранить настройки'}
            </button>
          </div>
        )}

        {/* Danger Zone Tab */}
        {activeTab === 'danger' && (
          <div className="settings-section danger-zone">
            <h2>Опасная зона</h2>
            <div className="danger-warning">
              <Trash2 size={48} color="#EF4444" />
              <h3>Удалить семью</h3>
              <p>После удаления семьи все данные, посты, фотографии и связи будут безвозвратно удалены. Это действие не может быть отменено.</p>
              <button 
                className="delete-button"
                onClick={deleteFamily}
                disabled={loading}
              >
                <Trash2 size={18} />
                {loading ? 'Удаление...' : 'Удалить семью навсегда'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default FamilySettingsPage;