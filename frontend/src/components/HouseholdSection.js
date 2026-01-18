import React, { useState, useEffect } from 'react';
import { Home, Users, MapPin, Plus, X, Search, Save, Trash2 } from 'lucide-react';

function HouseholdSection({ user, moduleColor = '#059669' }) {
  const [household, setHousehold] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    household_name: '',
    address_street: '',
    address_city: '',
    address_state: '',
    address_country: '',
    address_postal_code: ''
  });

  // Member search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    loadHousehold();
  }, []);

  const loadHousehold = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('zion_token');
      const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
      
      
      const response = await fetch(`${backendUrl}/api/household`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setHousehold(data.household);
        setMembers(data.members || []);
      }
    } catch (error) {
      console.error('Error loading household:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateHousehold = async (e) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('zion_token');
      const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
      
      
      const response = await fetch(`${backendUrl}/api/household/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ...formData, members: [] })
      });

      if (response.ok) {
        const data = await response.json();
        setHousehold(data.household);
        setShowCreateForm(false);
        loadHousehold();
        alert('✅ Домохозяйство создано!');
      } else {
        alert('Ошибка создания домохозяйства');
      }
    } catch (error) {
      console.error('Error creating household:', error);
      alert('Ошибка создания домохозяйства');
    }
  };

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

  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const addMember = async (userData, relationship) => {
    try {
      const token = localStorage.getItem('zion_token');
      const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
      
      
      const response = await fetch(`${backendUrl}/api/household/${household.id}/members`, {
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
        loadHousehold();
        setSearchQuery('');
        setSearchResults([]);
        setShowAddMember(false);
        alert('✅ Член домохозяйства добавлен');
      }
    } catch (error) {
      console.error('Error adding member:', error);
      alert('Ошибка добавления члена');
    }
  };

  const removeMember = async (memberId) => {
    if (!window.confirm('Удалить этого члена из домохозяйства?')) return;

    try {
      const token = localStorage.getItem('zion_token');
      const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
      
      
      const response = await fetch(`${backendUrl}/api/household/${household.id}/members/${memberId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        loadHousehold();
        alert('✅ Член домохозяйства удален');
      }
    } catch (error) {
      console.error('Error removing member:', error);
      alert('Ошибка удаления члена');
    }
  };

  if (loading) {
    return (
      <div className="household-section" style={{ '--module-color': moduleColor }}>
        <div className="loading-message">Загрузка...</div>
      </div>
    );
  }

  if (!household && !showCreateForm) {
    return (
      <div className="household-section" style={{ '--module-color': moduleColor }}>
        <div className="household-header">
          <div className="header-icon">
            <Home size={32} color={moduleColor} />
          </div>
          <h2>Домохозяйство</h2>
          <p className="household-description">
            Домохозяйство — это люди, живущие по одному адресу (соседи по квартире, 
            члены расширенной семьи в одном доме и т.д.). Это отличается от вашего 
            семейного профиля, который представляет биологические/юридические отношения.
          </p>
        </div>

        <button 
          className="create-household-btn"
          onClick={() => setShowCreateForm(true)}
          style={{ backgroundColor: moduleColor }}
        >
          <Plus size={20} />
          Создать домохозяйство
        </button>
      </div>
    );
  }

  if (showCreateForm) {
    return (
      <div className="household-section" style={{ '--module-color': moduleColor }}>
        <div className="household-header">
          <h2>Создать домохозяйство</h2>
        </div>

        <form onSubmit={handleCreateHousehold} className="household-form">
          <div className="form-group">
            <label>Название домохозяйства *</label>
            <input
              type="text"
              value={formData.household_name}
              onChange={(e) => setFormData({ ...formData, household_name: e.target.value })}
              placeholder="Например: Квартира 42"
              required
            />
          </div>

          <div className="form-group">
            <label>Улица и номер дома *</label>
            <input
              type="text"
              value={formData.address_street}
              onChange={(e) => setFormData({ ...formData, address_street: e.target.value })}
              placeholder="Например: ул. Ленина, 10, кв. 5"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Город *</label>
              <input
                type="text"
                value={formData.address_city}
                onChange={(e) => setFormData({ ...formData, address_city: e.target.value })}
                placeholder="Москва"
                required
              />
            </div>

            <div className="form-group">
              <label>Регион/Область</label>
              <input
                type="text"
                value={formData.address_state}
                onChange={(e) => setFormData({ ...formData, address_state: e.target.value })}
                placeholder="Московская обл."
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Страна *</label>
              <input
                type="text"
                value={formData.address_country}
                onChange={(e) => setFormData({ ...formData, address_country: e.target.value })}
                placeholder="Россия"
                required
              />
            </div>

            <div className="form-group">
              <label>Индекс</label>
              <input
                type="text"
                value={formData.address_postal_code}
                onChange={(e) => setFormData({ ...formData, address_postal_code: e.target.value })}
                placeholder="123456"
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" onClick={() => setShowCreateForm(false)} className="cancel-btn">
              Отмена
            </button>
            <button type="submit" className="submit-btn" style={{ backgroundColor: moduleColor }}>
              <Save size={18} />
              Создать
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="household-section" style={{ '--module-color': moduleColor }}>
      <div className="household-header">
        <div className="header-icon">
          <Home size={32} color={moduleColor} />
        </div>
        <div>
          <h2>{household.household_name}</h2>
          <div className="household-address">
            <MapPin size={16} />
            <span>
              {household.address_street}, {household.address_city}
              {household.address_state && `, ${household.address_state}`}
              {household.address_country && `, ${household.address_country}`}
            </span>
          </div>
        </div>
      </div>

      {/* Members Section */}
      <div className="household-members">
        <div className="members-header">
          <h3>
            <Users size={20} />
            Жильцы ({members.length})
          </h3>
          {!showAddMember && (
            <button 
              className="add-member-btn"
              onClick={() => setShowAddMember(true)}
              style={{ color: moduleColor }}
            >
              <Plus size={18} />
              Добавить
            </button>
          )}
        </div>

        {showAddMember && (
          <div className="member-search-box">
            <div className="search-input-wrapper">
              <Search size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск пользователей..."
              />
              <button onClick={() => { setShowAddMember(false); setSearchQuery(''); }}>
                <X size={16} />
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="search-results-list">
                {searchResults.map(user => (
                  <div key={user.id} className="search-result-item">
                    <div className="user-info">
                      <div className="user-avatar" style={{ backgroundColor: moduleColor }}>
                        {user.name?.charAt(0)}
                      </div>
                      <div>
                        <div className="user-name">{user.name} {user.surname}</div>
                        <div className="user-email">{user.email}</div>
                      </div>
                    </div>
                    <select 
                      className="relationship-select"
                      onChange={(e) => {
                        if (e.target.value) addMember(user, e.target.value);
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>Добавить как...</option>
                      <option value="roommate">Сосед по квартире</option>
                      <option value="tenant">Арендатор</option>
                      <option value="family_member">Член семьи</option>
                      <option value="other">Другое</option>
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="members-list">
          {members.map(member => (
            <div key={member.id} className="member-item">
              <div className="member-info">
                <div className="member-avatar" style={{ backgroundColor: moduleColor }}>
                  {member.name?.charAt(0)}
                </div>
                <div>
                  <div className="member-name">
                    {member.name} {member.surname}
                    {member.is_creator && (
                      <span className="creator-badge" style={{ color: moduleColor }}>
                        • Владелец
                      </span>
                    )}
                  </div>
                  <div className="member-relationship">{member.relationship}</div>
                </div>
              </div>
              {!member.is_creator && (
                <button 
                  className="remove-member-btn"
                  onClick={() => removeMember(member.id)}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default HouseholdSection;