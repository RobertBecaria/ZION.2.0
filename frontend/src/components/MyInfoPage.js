import React, { useState, useEffect } from 'react';
import { User, MapPin, Phone, Calendar, Heart, Edit2, Save, X, Lock, AlertTriangle, Upload, Mail, Image as ImageIcon } from 'lucide-react';
import HouseholdSection from './HouseholdSection';

const MyInfoPage = ({ user, moduleColor = '#059669', onProfileUpdate }) => {
  const [myInfo, setMyInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingSection, setEditingSection] = useState(null); // 'basic', 'address', 'marriage', null
  const [formData, setFormData] = useState({});
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [showDangerZone, setShowDangerZone] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    fetchMyInfo();
  }, []);

  const fetchMyInfo = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/my-info`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMyInfo(data);
        resetFormData(data);
      }
    } catch (error) {
      console.error('Error fetching MY INFO:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetFormData = (data) => {
    // Format date_of_birth to YYYY-MM-DD for input type="date"
    let formattedDate = '';
    if (data.date_of_birth) {
      try {
        const date = new Date(data.date_of_birth);
        if (!isNaN(date.getTime())) {
          formattedDate = date.toISOString().split('T')[0];
        }
      } catch (e) {
        console.error('Error formatting date:', e);
      }
    }
    
    setFormData({
      first_name: data.first_name || '',
      last_name: data.last_name || '',
      middle_name: data.middle_name || '',
      name_alias: data.name_alias || '',
      phone: data.phone || '',
      email: data.email || '',
      date_of_birth: formattedDate,
      address_street: data.address_street || '',
      address_city: data.address_city || '',
      address_state: data.address_state || '',
      address_country: data.address_country || '',
      address_postal_code: data.address_postal_code || '',
      marriage_status: data.marriage_status || 'SINGLE',
      spouse_name: data.spouse_name || '',
      spouse_phone: data.spouse_phone || ''
    });
  };

  const handleEdit = (section) => {
    setEditingSection(section);
    setError('');
    setSuccess('');
  };

  const handleCancel = () => {
    resetFormData(myInfo);
    setEditingSection(null);
    setError('');
  };

  const handleSave = async (section) => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      const token = localStorage.getItem('zion_token');
      
      let endpoint = `${BACKEND_URL}/api/my-info`;
      let payload = {};
      
      if (section === 'basic') {
        payload = {
          first_name: formData.first_name,
          last_name: formData.last_name,
          middle_name: formData.middle_name || null,
          name_alias: formData.name_alias || null,
          phone: formData.phone || null,
          email: formData.email,
          date_of_birth: formData.date_of_birth || null
        };
      } else if (section === 'address') {
        payload = {
          address_street: formData.address_street || null,
          address_city: formData.address_city || null,
          address_state: formData.address_state || null,
          address_country: formData.address_country || null,
          address_postal_code: formData.address_postal_code || null
        };
      } else if (section === 'marriage') {
        payload = {
          marriage_status: formData.marriage_status,
          spouse_name: formData.spouse_name || null,
          spouse_phone: formData.spouse_phone || null
        };
      }

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const updated = await response.json();
        setMyInfo(updated);
        setEditingSection(null);
        setSuccess('Изменения успешно сохранены');
        setTimeout(() => setSuccess(''), 3000);
        
        // Notify parent if email changed
        if (payload.email && payload.email !== myInfo.email && onProfileUpdate) {
          onProfileUpdate();
        }
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Не удалось сохранить изменения');
      }
    } catch (error) {
      console.error('Error saving:', error);
      setError('Произошла ошибка при сохранении');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    try {
      if (passwordData.new_password !== passwordData.confirm_password) {
        setError('Новые пароли не совпадают');
        return;
      }
      
      if (passwordData.new_password.length < 6) {
        setError('Новый пароль должен содержать минимум 6 символов');
        return;
      }

      setSaving(true);
      setError('');
      const token = localStorage.getItem('zion_token');
      
      const response = await fetch(`${BACKEND_URL}/api/auth/change-password`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          current_password: passwordData.current_password,
          new_password: passwordData.new_password
        })
      });

      if (response.ok) {
        setSuccess('Пароль успешно изменен');
        setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
        setShowPasswordSection(false);
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Не удалось изменить пароль');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      setError('Произошла ошибка при изменении пароля');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'УДАЛИТЬ') {
      setError('Введите "УДАЛИТЬ" для подтверждения');
      return;
    }

    try {
      setSaving(true);
      setError('');
      const token = localStorage.getItem('zion_token');
      
      const response = await fetch(`${BACKEND_URL}/api/auth/delete-account`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        // Logout user
        localStorage.removeItem('zion_token');
        window.location.reload();
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Не удалось удалить аккаунт');
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      setError('Произошла ошибка при удалении аккаунта');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Не указано';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const getMarriageStatusLabel = (status) => {
    const gender = myInfo?.gender;
    
    // Gender-aware labels
    const labelsForMale = {
      'SINGLE': 'Не женат',
      'MARRIED': 'Женат',
      'DIVORCED': 'Разведён',
      'WIDOWED': 'Вдовец'
    };
    
    const labelsForFemale = {
      'SINGLE': 'Не замужем',
      'MARRIED': 'Замужем',
      'DIVORCED': 'Разведена',
      'WIDOWED': 'Вдова'
    };
    
    const labelsDefault = {
      'SINGLE': 'Не женат/Не замужем',
      'MARRIED': 'Женат/Замужем',
      'DIVORCED': 'Разведён/Разведена',
      'WIDOWED': 'Вдовец/Вдова'
    };
    
    // Choose labels based on gender
    let labels;
    if (gender === 'MALE') {
      labels = labelsForMale;
    } else if (gender === 'FEMALE') {
      labels = labelsForFemale;
    } else {
      labels = labelsDefault;
    }
    
    return labels[status] || 'Не указано';
  };
  
  const getMarriageStatusOptions = () => {
    const gender = myInfo?.gender;
    
    // Gender-aware options for dropdown
    if (gender === 'MALE') {
      return [
        { value: 'SINGLE', label: 'Не женат' },
        { value: 'MARRIED', label: 'Женат' },
        { value: 'DIVORCED', label: 'Разведён' },
        { value: 'WIDOWED', label: 'Вдовец' }
      ];
    } else if (gender === 'FEMALE') {
      return [
        { value: 'SINGLE', label: 'Не замужем' },
        { value: 'MARRIED', label: 'Замужем' },
        { value: 'DIVORCED', label: 'Разведена' },
        { value: 'WIDOWED', label: 'Вдова' }
      ];
    } else {
      // For IT or unknown gender, use neutral/both forms
      return [
        { value: 'SINGLE', label: 'Не женат/Не замужем' },
        { value: 'MARRIED', label: 'Женат/Замужем' },
        { value: 'DIVORCED', label: 'Разведён/Разведена' },
        { value: 'WIDOWED', label: 'Вдовец/Вдова' }
      ];
    }
  };
  
  const getSpouseLabel = () => {
    const gender = myInfo?.gender;
    if (gender === 'MALE') return 'Супруга';
    if (gender === 'FEMALE') return 'Супруг';
    return 'Супруг(а)';
  };
  
  const getSpousePhoneLabel = () => {
    const gender = myInfo?.gender;
    if (gender === 'MALE') return 'Телефон супруги';
    if (gender === 'FEMALE') return 'Телефон супруга';
    return 'Телефон супруга(и)';
  };

  if (loading) {
    return (
      <div className="my-info-page">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Загрузка данных...</p>
        </div>
      </div>
    );
  }

  if (!myInfo) {
    return (
      <div className="my-info-page">
        <div className="error-message">
          <p>Не удалось загрузить данные</p>
        </div>
      </div>
    );
  }

  return (
    <div className="my-info-page">
      <div className="page-header">
        <h1>
          <User size={28} />
          МОЯ ИНФОРМАЦИЯ
        </h1>
        <p className="page-subtitle">Централизованное хранилище ваших персональных данных</p>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="alert alert-success">
          {success}
        </div>
      )}
      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {/* Profile Picture Section */}
      <div className="info-section">
        <div className="section-header">
          <h2>
            <ImageIcon size={20} />
            Фото профиля
          </h2>
        </div>
        
        <div className="profile-picture-section">
          <div className="profile-picture-preview">
            {myInfo.profile_picture ? (
              <img src={myInfo.profile_picture} alt="Profile" className="profile-pic" />
            ) : (
              <div className="profile-pic-placeholder">
                <User size={48} />
              </div>
            )}
          </div>
          
          <div className="profile-picture-actions">
            <input
              type="file"
              id="profile-pic-input"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                // Validate file type
                if (!file.type.startsWith('image/')) {
                  setError('Пожалуйста, выберите изображение');
                  return;
                }
                
                // Validate file size (10MB)
                if (file.size > 10 * 1024 * 1024) {
                  setError('Размер файла не должен превышать 10MB');
                  return;
                }
                
                // Convert to base64
                const reader = new FileReader();
                reader.onload = async (event) => {
                  try {
                    setSaving(true);
                    setError('');
                    const token = localStorage.getItem('zion_token');
                    
                    const response = await fetch(`${BACKEND_URL}/api/users/profile-picture`, {
                      method: 'PUT',
                      headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({
                        profile_picture: event.target.result
                      })
                    });
                    
                    if (response.ok) {
                      await fetchMyInfo();
                      // Refresh parent user state
                      if (onProfileUpdate) {
                        onProfileUpdate();
                      }
                      setSuccess('Фото профиля обновлено');
                      setTimeout(() => setSuccess(''), 3000);
                    } else {
                      setError('Не удалось загрузить фото');
                    }
                  } catch (error) {
                    console.error('Error uploading:', error);
                    setError('Ошибка при загрузке фото');
                  } finally {
                    setSaving(false);
                  }
                };
                reader.readAsDataURL(file);
              }}
            />
            <button 
              className="btn-primary"
              onClick={() => document.getElementById('profile-pic-input').click()}
              disabled={saving}
            >
              <Upload size={18} />
              {saving ? 'Загрузка...' : 'Загрузить фото'}
            </button>
            
            {myInfo.profile_picture && (
              <button 
                className="btn-secondary"
                onClick={async () => {
                  if (!window.confirm('Удалить фото профиля?')) return;
                  
                  try {
                    setSaving(true);
                    const token = localStorage.getItem('zion_token');
                    
                    const response = await fetch(`${BACKEND_URL}/api/users/profile-picture`, {
                      method: 'DELETE',
                      headers: {
                        'Authorization': `Bearer ${token}`
                      }
                    });
                    
                    if (response.ok) {
                      await fetchMyInfo();
                      // Refresh parent user state
                      if (onProfileUpdate) {
                        onProfileUpdate();
                      }
                      setSuccess('Фото профиля удалено');
                      setTimeout(() => setSuccess(''), 3000);
                    }
                  } catch (error) {
                    console.error('Error deleting:', error);
                    setError('Ошибка при удалении фото');
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
              >
                <X size={18} />
                Удалить
              </button>
            )}
            
            <p className="hint">PNG, JPG, GIF до 10MB</p>
          </div>
        </div>
      </div>

      {/* Basic Information Section */}
      <div className="info-section">
        <div className="section-header">
          <h2>Основная информация</h2>
          {editingSection !== 'basic' ? (
            <button className="btn-icon" onClick={() => handleEdit('basic')}>
              <Edit2 size={18} />
              Редактировать
            </button>
          ) : (
            <div className="edit-actions">
              <button className="btn-icon btn-success" onClick={() => handleSave('basic')} disabled={saving}>
                <Save size={18} />
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button className="btn-icon btn-secondary" onClick={handleCancel} disabled={saving}>
                <X size={18} />
                Отмена
              </button>
            </div>
          )}
        </div>

        <div className="info-grid">
          <div className="info-item">
            <label>Имя *</label>
            {editingSection === 'basic' ? (
              <input
                type="text"
                className="form-input"
                value={formData.first_name}
                onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                required
              />
            ) : (
              <div className="info-value">{myInfo.first_name}</div>
            )}
          </div>

          <div className="info-item">
            <label>Фамилия *</label>
            {editingSection === 'basic' ? (
              <input
                type="text"
                className="form-input"
                value={formData.last_name}
                onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                required
              />
            ) : (
              <div className="info-value">{myInfo.last_name}</div>
            )}
          </div>

          <div className="info-item">
            <label>Отчество</label>
            {editingSection === 'basic' ? (
              <input
                type="text"
                className="form-input"
                value={formData.middle_name}
                onChange={(e) => setFormData({...formData, middle_name: e.target.value})}
              />
            ) : (
              <div className="info-value">{myInfo.middle_name || 'Не указано'}</div>
            )}
          </div>

          <div className="info-item">
            <label>
              Отображаемое имя (Псевдоним)
              <span className="info-hint">Используется для облегчения произношения</span>
            </label>
            {editingSection === 'basic' ? (
              <input
                type="text"
                className="form-input"
                placeholder="Например: ROBERT ORLANDO"
                value={formData.name_alias}
                onChange={(e) => setFormData({...formData, name_alias: e.target.value})}
              />
            ) : (
              <div className="info-value name-alias">
                {myInfo.name_alias || <span className="empty-value">Не указано</span>}
              </div>
            )}
          </div>

          <div className="info-item">
            <label>
              <Mail size={16} />
              Email *
            </label>
            {editingSection === 'basic' ? (
              <input
                type="email"
                className="form-input"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
              />
            ) : (
              <div className="info-value">{myInfo.email}</div>
            )}
          </div>

          <div className="info-item">
            <label>
              <Phone size={16} />
              Телефон
            </label>
            {editingSection === 'basic' ? (
              <input
                type="tel"
                className="form-input"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
              />
            ) : (
              <div className="info-value">{myInfo.phone || 'Не указано'}</div>
            )}
          </div>

          <div className="info-item">
            <label>
              <User size={16} />
              Пол
              <span className="info-hint">Для корректного отображения текста</span>
            </label>
            {editingSection === 'basic' ? (
              <select
                className="form-input"
                value={formData.gender || ''}
                onChange={(e) => setFormData({...formData, gender: e.target.value})}
              >
                <option value="">Не указано</option>
                <option value="MALE">Мужской</option>
                <option value="FEMALE">Женский</option>
              </select>
            ) : (
              <div className="info-value">
                {myInfo.gender === 'MALE' ? 'Мужской' : 
                 myInfo.gender === 'FEMALE' ? 'Женский' : 
                 'Не указано'}
              </div>
            )}
          </div>

          <div className="info-item">
            <label>
              <Calendar size={16} />
              Дата рождения
            </label>
            {editingSection === 'basic' ? (
              <input
                type="date"
                className="form-input"
                value={formData.date_of_birth}
                onChange={(e) => setFormData({...formData, date_of_birth: e.target.value})}
              />
            ) : (
              <div className="info-value">{formatDate(myInfo.date_of_birth)}</div>
            )}
          </div>
        </div>
      </div>

      {/* Address Information */}
      <div className="info-section">
        <div className="section-header">
          <h2>
            <MapPin size={20} />
            Адрес
          </h2>
          {editingSection !== 'address' ? (
            <button className="btn-icon" onClick={() => handleEdit('address')}>
              <Edit2 size={18} />
              Редактировать
            </button>
          ) : (
            <div className="edit-actions">
              <button className="btn-icon btn-success" onClick={() => handleSave('address')} disabled={saving}>
                <Save size={18} />
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button className="btn-icon btn-secondary" onClick={handleCancel} disabled={saving}>
                <X size={18} />
                Отмена
              </button>
            </div>
          )}
        </div>

        <div className="info-grid">
          <div className="info-item full-width">
            <label>Адрес (Улица, дом)</label>
            {editingSection === 'address' ? (
              <input
                type="text"
                className="form-input"
                value={formData.address_street}
                onChange={(e) => setFormData({...formData, address_street: e.target.value})}
              />
            ) : (
              <div className="info-value">{myInfo.address_street || 'Не указано'}</div>
            )}
          </div>

          <div className="info-item">
            <label>Город</label>
            {editingSection === 'address' ? (
              <input
                type="text"
                className="form-input"
                value={formData.address_city}
                onChange={(e) => setFormData({...formData, address_city: e.target.value})}
              />
            ) : (
              <div className="info-value">{myInfo.address_city || 'Не указано'}</div>
            )}
          </div>

          <div className="info-item">
            <label>Регион/Область</label>
            {editingSection === 'address' ? (
              <input
                type="text"
                className="form-input"
                value={formData.address_state}
                onChange={(e) => setFormData({...formData, address_state: e.target.value})}
              />
            ) : (
              <div className="info-value">{myInfo.address_state || 'Не указано'}</div>
            )}
          </div>

          <div className="info-item">
            <label>Страна</label>
            {editingSection === 'address' ? (
              <input
                type="text"
                className="form-input"
                value={formData.address_country}
                onChange={(e) => setFormData({...formData, address_country: e.target.value})}
              />
            ) : (
              <div className="info-value">{myInfo.address_country || 'Не указано'}</div>
            )}
          </div>

          <div className="info-item">
            <label>Почтовый индекс</label>
            {editingSection === 'address' ? (
              <input
                type="text"
                className="form-input"
                value={formData.address_postal_code}
                onChange={(e) => setFormData({...formData, address_postal_code: e.target.value})}
              />
            ) : (
              <div className="info-value">{myInfo.address_postal_code || 'Не указано'}</div>
            )}
          </div>
        </div>
      </div>

      {/* Marriage Information */}
      <div className="info-section">
        <div className="section-header">
          <h2>
            <Heart size={20} />
            Семейное Положение
          </h2>
          {editingSection !== 'marriage' ? (
            <button className="btn-icon" onClick={() => handleEdit('marriage')}>
              <Edit2 size={18} />
              Редактировать
            </button>
          ) : (
            <div className="edit-actions">
              <button className="btn-icon btn-success" onClick={() => handleSave('marriage')} disabled={saving}>
                <Save size={18} />
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button className="btn-icon btn-secondary" onClick={handleCancel} disabled={saving}>
                <X size={18} />
                Отмена
              </button>
            </div>
          )}
        </div>

        <div className="info-grid">
          <div className="info-item">
            <label>Статус</label>
            {editingSection === 'marriage' ? (
              <select
                className="form-input"
                value={formData.marriage_status}
                onChange={(e) => setFormData({...formData, marriage_status: e.target.value})}
              >
                {getMarriageStatusOptions().map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <div className="info-value">{getMarriageStatusLabel(myInfo.marriage_status)}</div>
            )}
          </div>

          {((editingSection === 'marriage' && formData.marriage_status === 'MARRIED') || 
            (editingSection !== 'marriage' && myInfo.marriage_status === 'MARRIED')) && (
            <>
              <div className="info-item">
                <label>{getSpouseLabel()}</label>
                {editingSection === 'marriage' ? (
                  <input
                    type="text"
                    className="form-input"
                    value={formData.spouse_name}
                    onChange={(e) => setFormData({...formData, spouse_name: e.target.value})}
                  />
                ) : (
                  <div className="info-value">{myInfo.spouse_name || 'Не указано'}</div>
                )}
              </div>

              <div className="info-item">
                <label>{getSpousePhoneLabel()}</label>
                {editingSection === 'marriage' ? (
                  <input
                    type="tel"
                    className="form-input"
                    value={formData.spouse_phone}
                    onChange={(e) => setFormData({...formData, spouse_phone: e.target.value})}
                  />
                ) : (
                  <div className="info-value">{myInfo.spouse_phone || 'Не указано'}</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Household Section */}
      <HouseholdSection user={user} moduleColor={moduleColor} />

      {/* Password Change Section */}
      <div className="info-section security-section">
        <div className="section-header">
          <h2>
            <Lock size={20} />
            Безопасность
          </h2>
          <button 
            className="btn-icon" 
            onClick={() => setShowPasswordSection(!showPasswordSection)}
          >
            {showPasswordSection ? <X size={18} /> : <Edit2 size={18} />}
            {showPasswordSection ? 'Закрыть' : 'Изменить пароль'}
          </button>
        </div>

        {showPasswordSection && (
          <div className="password-change-form">
            <div className="form-group">
              <label>Текущий пароль *</label>
              <input
                type="password"
                className="form-input"
                value={passwordData.current_password}
                onChange={(e) => setPasswordData({...passwordData, current_password: e.target.value})}
                placeholder="Введите текущий пароль"
              />
            </div>

            <div className="form-group">
              <label>Новый пароль * (минимум 6 символов)</label>
              <input
                type="password"
                className="form-input"
                value={passwordData.new_password}
                onChange={(e) => setPasswordData({...passwordData, new_password: e.target.value})}
                placeholder="Введите новый пароль"
              />
            </div>

            <div className="form-group">
              <label>Подтвердите новый пароль *</label>
              <input
                type="password"
                className="form-input"
                value={passwordData.confirm_password}
                onChange={(e) => setPasswordData({...passwordData, confirm_password: e.target.value})}
                placeholder="Повторите новый пароль"
              />
            </div>

            <button 
              className="btn-primary" 
              onClick={handlePasswordChange}
              disabled={saving || !passwordData.current_password || !passwordData.new_password}
            >
              {saving ? 'Изменение...' : 'Изменить пароль'}
            </button>
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="info-section danger-section">
        <div className="section-header">
          <h2>
            <AlertTriangle size={20} />
            Опасная зона
          </h2>
          <button 
            className="btn-icon btn-danger" 
            onClick={() => setShowDangerZone(!showDangerZone)}
          >
            {showDangerZone ? <X size={18} /> : <AlertTriangle size={18} />}
            {showDangerZone ? 'Закрыть' : 'Показать'}
          </button>
        </div>

        {showDangerZone && (
          <div className="danger-zone-content">
            <div className="danger-warning">
              <AlertTriangle size={24} />
              <div>
                <h3>Удаление аккаунта</h3>
                <p>Это действие необратимо. Все ваши данные будут удалены:</p>
                <ul>
                  <li>Личная информация и профиль</li>
                  <li>Все посты и комментарии</li>
                  <li>Семейный профиль (если вы создатель)</li>
                  <li>Членство во всех группах и чатах</li>
                </ul>
                <p><strong>Важно:</strong> Если вы создали семейный профиль, система автоматически создаст новый профиль для взрослых членов вашей семьи и уведомит их.</p>
              </div>
            </div>

            <div className="delete-confirmation">
              <label>Введите <strong>УДАЛИТЬ</strong> для подтверждения:</label>
              <input
                type="text"
                className="form-input"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="УДАЛИТЬ"
              />
              <button 
                className="btn-danger" 
                onClick={handleDeleteAccount}
                disabled={saving || deleteConfirmation !== 'УДАЛИТЬ'}
              >
                {saving ? 'Удаление...' : 'Удалить мой аккаунт навсегда'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyInfoPage;
