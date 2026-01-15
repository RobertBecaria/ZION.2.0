import React, { useState, useEffect, useMemo } from 'react';
import { 
  User, MapPin, Phone, Calendar, Heart, Edit2, Save, X, Lock, 
  AlertTriangle, Upload, Mail, Image as ImageIcon, CheckCircle2,
  Sparkles
} from 'lucide-react';
import HouseholdSection from './HouseholdSection';
import ChildrenSection from './ChildrenSection';

// Profile Completion Progress Bar Component
const ProfileCompletionBar = ({ percentage, animate }) => {
  const [displayPercentage, setDisplayPercentage] = useState(0);
  
  useEffect(() => {
    if (animate) {
      const timer = setTimeout(() => {
        setDisplayPercentage(percentage);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setDisplayPercentage(percentage);
    }
  }, [percentage, animate]);

  const getProgressColor = () => {
    if (percentage >= 80) return 'from-emerald-400 to-emerald-600';
    if (percentage >= 50) return 'from-amber-400 to-amber-600';
    return 'from-rose-400 to-rose-600';
  };

  const getStatusText = () => {
    if (percentage >= 80) return 'Отличный профиль!';
    if (percentage >= 50) return 'Хороший прогресс';
    return 'Заполните профиль';
  };

  const getStatusIcon = () => {
    if (percentage >= 80) return <Sparkles size={16} className="text-emerald-500" />;
    return <CheckCircle2 size={16} className="text-gray-400" />;
  };

  return (
    <div 
      className="profile-completion-card"
      data-testid="profile-completion-bar"
    >
      <div className="completion-header">
        <div className="completion-title">
          {getStatusIcon()}
          <span>{getStatusText()}</span>
        </div>
        <div className="completion-percentage">
          <span className="percentage-value">{Math.round(displayPercentage)}%</span>
          <span className="percentage-label">заполнено</span>
        </div>
      </div>
      <div className="progress-bar-container">
        <div 
          className={`progress-bar-fill bg-gradient-to-r ${getProgressColor()}`}
          style={{ 
            width: `${displayPercentage}%`,
            transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        />
      </div>
      <div className="completion-tips">
        {percentage < 100 && (
          <span className="tip-text">
            Добавьте больше информации для улучшения вашего профиля
          </span>
        )}
      </div>
    </div>
  );
};

// Section Card Component
const SectionCard = ({ 
  icon: Icon, 
  title, 
  children, 
  isEditing, 
  onEdit, 
  onSave, 
  onCancel, 
  saving,
  accentColor = '#059669',
  testId
}) => (
  <div 
    className="section-card" 
    data-testid={testId}
    style={{
      background: 'white',
      borderRadius: '16px',
      padding: '24px',
      marginBottom: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.1)',
      border: '1px solid #E5E7EB'
    }}
  >
    <div 
      className="section-card-header"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        paddingBottom: '16px',
        borderBottom: '1px solid #F3F4F6'
      }}
    >
      <div className="section-title-group" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div 
          className="section-icon" 
          style={{ 
            backgroundColor: `${accentColor}15`, 
            color: accentColor,
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Icon size={20} />
        </div>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#111827', margin: 0 }}>{title}</h2>
      </div>
      <div className="section-actions" style={{ display: 'flex', gap: '8px' }}>
        {!isEditing ? (
          <button 
            className="btn-edit" 
            onClick={onEdit}
            data-testid={`${testId}-edit-btn`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              background: '#F3F4F6',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              color: '#374151',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            <Edit2 size={16} />
            <span>Редактировать</span>
          </button>
        ) : (
          <div className="edit-action-group" style={{ display: 'flex', gap: '8px' }}>
            <button 
              className="btn-save" 
              onClick={onSave} 
              disabled={saving}
              data-testid={`${testId}-save-btn`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontSize: '0.85rem',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              <Save size={16} />
              <span>{saving ? 'Сохранение...' : 'Сохранить'}</span>
            </button>
            <button 
              className="btn-cancel" 
              onClick={onCancel} 
              disabled={saving}
              data-testid={`${testId}-cancel-btn`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                background: '#F3F4F6',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                color: '#6B7280',
                cursor: 'pointer'
              }}
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
    <div className="section-card-content">
      {children}
    </div>
  </div>
);

// Form Field Component
const FormField = ({ label, hint, icon: Icon, children, fullWidth, testId }) => (
  <div className={`form-field ${fullWidth ? 'full-width' : ''}`} data-testid={testId}>
    <label className="field-label">
      {Icon && <Icon size={14} />}
      <span>{label}</span>
      {hint && <span className="field-hint">{hint}</span>}
    </label>
    {children}
  </div>
);

// Display Value Component  
const DisplayValue = ({ value, placeholder = 'Не указано', highlight }) => (
  <div className={`display-value ${highlight ? 'highlight' : ''} ${!value ? 'empty' : ''}`}>
    {value || placeholder}
  </div>
);

const MyInfoPage = ({ user, moduleColor = '#059669', onProfileUpdate }) => {
  const [myInfo, setMyInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingSection, setEditingSection] = useState(null);
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

  // Calculate profile completion percentage
  const profileCompletion = useMemo(() => {
    if (!myInfo) return 0;
    
    const fields = [
      { key: 'first_name', weight: 10 },
      { key: 'last_name', weight: 10 },
      { key: 'email', weight: 10 },
      { key: 'phone', weight: 8 },
      { key: 'gender', weight: 5 },
      { key: 'date_of_birth', weight: 8 },
      { key: 'profile_picture', weight: 15 },
      { key: 'address_city', weight: 8 },
      { key: 'address_country', weight: 7 },
      { key: 'address_street', weight: 5 },
      { key: 'marriage_status', weight: 7 },
      { key: 'middle_name', weight: 4 },
      { key: 'name_alias', weight: 3 },
    ];
    
    let totalWeight = 0;
    let completedWeight = 0;
    
    fields.forEach(({ key, weight }) => {
      totalWeight += weight;
      if (myInfo[key] && myInfo[key] !== '' && myInfo[key] !== 'SINGLE') {
        completedWeight += weight;
      }
    });
    
    // Special handling for required fields that are always filled
    if (myInfo.first_name) completedWeight = Math.max(completedWeight, 10);
    if (myInfo.last_name) completedWeight = Math.max(completedWeight, 20);
    if (myInfo.email) completedWeight = Math.max(completedWeight, 30);
    
    return Math.min(100, Math.round((completedWeight / totalWeight) * 100));
  }, [myInfo]);

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
      gender: data.gender || '',
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
          gender: formData.gender || null,
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

  const handleProfilePictureUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      setError('Пожалуйста, выберите изображение');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      setError('Размер файла не должен превышать 10MB');
      return;
    }
    
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
  };

  const handleDeleteProfilePicture = async () => {
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
      <div className="my-info-page-v2" data-testid="my-info-loading">
        <div className="loading-container">
          <div className="loading-spinner-modern" />
          <p>Загрузка данных...</p>
        </div>
      </div>
    );
  }

  if (!myInfo) {
    return (
      <div className="my-info-page-v2" data-testid="my-info-error">
        <div className="error-container">
          <AlertTriangle size={48} className="error-icon" />
          <p>Не удалось загрузить данные</p>
        </div>
      </div>
    );
  }

  return (
    <div className="my-info-page-v2" data-testid="my-info-page">
      {/* Page Header */}
      <header className="page-header-v2">
        <div className="header-content">
          <h1>
            <User size={28} />
            Мой Профиль
          </h1>
          <p className="subtitle">Управление персональными данными</p>
        </div>
      </header>

      {/* Alerts */}
      {success && (
        <div className="alert-v2 alert-success" data-testid="success-alert">
          <CheckCircle2 size={18} />
          {success}
        </div>
      )}
      {error && (
        <div className="alert-v2 alert-error" data-testid="error-alert">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      {/* Profile Completion Progress */}
      <ProfileCompletionBar percentage={profileCompletion} animate={true} />

      {/* Profile Picture Section */}
      <SectionCard
        icon={ImageIcon}
        title="Фото профиля"
        isEditing={false}
        onEdit={() => document.getElementById('profile-pic-input-v2').click()}
        accentColor={moduleColor}
        testId="profile-picture-section"
      >
        <div className="profile-picture-container">
          <div className="avatar-wrapper">
            {myInfo.profile_picture ? (
              <img 
                src={myInfo.profile_picture} 
                alt="Profile" 
                className="avatar-image"
                data-testid="profile-avatar-image"
              />
            ) : (
              <div className="avatar-placeholder-v2" data-testid="profile-avatar-placeholder">
                <User size={48} />
              </div>
            )}
            <div className="avatar-overlay">
              <Upload size={24} />
            </div>
          </div>
          
          <div className="picture-actions">
            <input
              type="file"
              id="profile-pic-input-v2"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleProfilePictureUpload}
              data-testid="profile-picture-input"
            />
            <button 
              className="btn-upload"
              onClick={() => document.getElementById('profile-pic-input-v2').click()}
              disabled={saving}
              data-testid="upload-photo-btn"
            >
              <Upload size={16} />
              {saving ? 'Загрузка...' : 'Загрузить фото'}
            </button>
            
            {myInfo.profile_picture && (
              <button 
                className="btn-remove"
                onClick={handleDeleteProfilePicture}
                disabled={saving}
                data-testid="delete-photo-btn"
              >
                <X size={16} />
                Удалить
              </button>
            )}
          </div>
          <p className="upload-hint">PNG, JPG или GIF до 10MB</p>
        </div>
      </SectionCard>

      {/* Basic Information Section */}
      <SectionCard
        icon={User}
        title="Основная информация"
        isEditing={editingSection === 'basic'}
        onEdit={() => handleEdit('basic')}
        onSave={() => handleSave('basic')}
        onCancel={handleCancel}
        saving={saving}
        accentColor={moduleColor}
        testId="basic-info-section"
      >
        <div className="form-grid">
          <FormField label="Имя" icon={User} testId="first-name-field">
            {editingSection === 'basic' ? (
              <input
                type="text"
                className="input-field"
                value={formData.first_name}
                onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                placeholder="Введите имя"
                data-testid="first-name-input"
              />
            ) : (
              <DisplayValue value={myInfo.first_name} />
            )}
          </FormField>

          <FormField label="Фамилия" icon={User} testId="last-name-field">
            {editingSection === 'basic' ? (
              <input
                type="text"
                className="input-field"
                value={formData.last_name}
                onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                placeholder="Введите фамилию"
                data-testid="last-name-input"
              />
            ) : (
              <DisplayValue value={myInfo.last_name} />
            )}
          </FormField>

          <FormField label="Отчество" testId="middle-name-field">
            {editingSection === 'basic' ? (
              <input
                type="text"
                className="input-field"
                value={formData.middle_name}
                onChange={(e) => setFormData({...formData, middle_name: e.target.value})}
                placeholder="Введите отчество"
                data-testid="middle-name-input"
              />
            ) : (
              <DisplayValue value={myInfo.middle_name} />
            )}
          </FormField>

          <FormField 
            label="Псевдоним" 
            hint="Для удобства произношения"
            testId="alias-field"
          >
            {editingSection === 'basic' ? (
              <input
                type="text"
                className="input-field"
                value={formData.name_alias}
                onChange={(e) => setFormData({...formData, name_alias: e.target.value})}
                placeholder="Например: ROBERT"
                data-testid="alias-input"
              />
            ) : (
              <DisplayValue value={myInfo.name_alias} highlight={!!myInfo.name_alias} />
            )}
          </FormField>

          <FormField label="Email" icon={Mail} testId="email-field">
            {editingSection === 'basic' ? (
              <input
                type="email"
                className="input-field"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="email@example.com"
                data-testid="email-input"
              />
            ) : (
              <DisplayValue value={myInfo.email} />
            )}
          </FormField>

          <FormField label="Телефон" icon={Phone} testId="phone-field">
            {editingSection === 'basic' ? (
              <input
                type="tel"
                className="input-field"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                placeholder="+7 (XXX) XXX-XX-XX"
                data-testid="phone-input"
              />
            ) : (
              <DisplayValue value={myInfo.phone} />
            )}
          </FormField>

          <FormField 
            label="Пол" 
            icon={User}
            hint="Для корректного отображения текста"
            testId="gender-field"
          >
            {editingSection === 'basic' ? (
              <select
                className="input-field select-field"
                value={formData.gender || ''}
                onChange={(e) => setFormData({...formData, gender: e.target.value})}
                data-testid="gender-select"
              >
                <option value="">Не указано</option>
                <option value="MALE">Мужской</option>
                <option value="FEMALE">Женский</option>
              </select>
            ) : (
              <DisplayValue 
                value={myInfo.gender === 'MALE' ? 'Мужской' : myInfo.gender === 'FEMALE' ? 'Женский' : null} 
              />
            )}
          </FormField>

          <FormField label="Дата рождения" icon={Calendar} testId="dob-field">
            {editingSection === 'basic' ? (
              <input
                type="date"
                className="input-field"
                value={formData.date_of_birth}
                onChange={(e) => setFormData({...formData, date_of_birth: e.target.value})}
                data-testid="dob-input"
              />
            ) : (
              <DisplayValue value={formatDate(myInfo.date_of_birth)} />
            )}
          </FormField>
        </div>
      </SectionCard>

      {/* Address Section */}
      <SectionCard
        icon={MapPin}
        title="Адрес"
        isEditing={editingSection === 'address'}
        onEdit={() => handleEdit('address')}
        onSave={() => handleSave('address')}
        onCancel={handleCancel}
        saving={saving}
        accentColor="#3B82F6"
        testId="address-section"
      >
        <div className="form-grid">
          <FormField label="Улица, дом" fullWidth testId="street-field">
            {editingSection === 'address' ? (
              <input
                type="text"
                className="input-field"
                value={formData.address_street}
                onChange={(e) => setFormData({...formData, address_street: e.target.value})}
                placeholder="Введите адрес"
                data-testid="street-input"
              />
            ) : (
              <DisplayValue value={myInfo.address_street} />
            )}
          </FormField>

          <FormField label="Город" testId="city-field">
            {editingSection === 'address' ? (
              <input
                type="text"
                className="input-field"
                value={formData.address_city}
                onChange={(e) => setFormData({...formData, address_city: e.target.value})}
                placeholder="Введите город"
                data-testid="city-input"
              />
            ) : (
              <DisplayValue value={myInfo.address_city} />
            )}
          </FormField>

          <FormField label="Регион/Область" testId="state-field">
            {editingSection === 'address' ? (
              <input
                type="text"
                className="input-field"
                value={formData.address_state}
                onChange={(e) => setFormData({...formData, address_state: e.target.value})}
                placeholder="Введите регион"
                data-testid="state-input"
              />
            ) : (
              <DisplayValue value={myInfo.address_state} />
            )}
          </FormField>

          <FormField label="Страна" testId="country-field">
            {editingSection === 'address' ? (
              <input
                type="text"
                className="input-field"
                value={formData.address_country}
                onChange={(e) => setFormData({...formData, address_country: e.target.value})}
                placeholder="Введите страну"
                data-testid="country-input"
              />
            ) : (
              <DisplayValue value={myInfo.address_country} />
            )}
          </FormField>

          <FormField label="Почтовый индекс" testId="postal-field">
            {editingSection === 'address' ? (
              <input
                type="text"
                className="input-field"
                value={formData.address_postal_code}
                onChange={(e) => setFormData({...formData, address_postal_code: e.target.value})}
                placeholder="Введите индекс"
                data-testid="postal-input"
              />
            ) : (
              <DisplayValue value={myInfo.address_postal_code} />
            )}
          </FormField>
        </div>
      </SectionCard>

      {/* Marriage Section */}
      <SectionCard
        icon={Heart}
        title="Семейное положение"
        isEditing={editingSection === 'marriage'}
        onEdit={() => handleEdit('marriage')}
        onSave={() => handleSave('marriage')}
        onCancel={handleCancel}
        saving={saving}
        accentColor="#EC4899"
        testId="marriage-section"
      >
        <div className="form-grid">
          <FormField label="Статус" testId="marriage-status-field">
            {editingSection === 'marriage' ? (
              <select
                className="input-field select-field"
                value={formData.marriage_status}
                onChange={(e) => setFormData({...formData, marriage_status: e.target.value})}
                data-testid="marriage-status-select"
              >
                {getMarriageStatusOptions().map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <DisplayValue value={getMarriageStatusLabel(myInfo.marriage_status)} />
            )}
          </FormField>

          {((editingSection === 'marriage' && formData.marriage_status === 'MARRIED') || 
            (editingSection !== 'marriage' && myInfo.marriage_status === 'MARRIED')) && (
            <>
              <FormField label={getSpouseLabel()} testId="spouse-name-field">
                {editingSection === 'marriage' ? (
                  <input
                    type="text"
                    className="input-field"
                    value={formData.spouse_name}
                    onChange={(e) => setFormData({...formData, spouse_name: e.target.value})}
                    placeholder={`Имя ${getSpouseLabel().toLowerCase()}`}
                    data-testid="spouse-name-input"
                  />
                ) : (
                  <DisplayValue value={myInfo.spouse_name} />
                )}
              </FormField>

              <FormField label={getSpousePhoneLabel()} testId="spouse-phone-field">
                {editingSection === 'marriage' ? (
                  <input
                    type="tel"
                    className="input-field"
                    value={formData.spouse_phone}
                    onChange={(e) => setFormData({...formData, spouse_phone: e.target.value})}
                    placeholder="+7 (XXX) XXX-XX-XX"
                    data-testid="spouse-phone-input"
                  />
                ) : (
                  <DisplayValue value={myInfo.spouse_phone} />
                )}
              </FormField>
            </>
          )}
        </div>
      </SectionCard>

      {/* Household Section */}
      <HouseholdSection user={user} moduleColor={moduleColor} />

      {/* Children Section */}
      <ChildrenSection user={user} moduleColor="#1E40AF" />

      {/* Security Section */}
      <SectionCard
        icon={Lock}
        title="Безопасность"
        isEditing={showPasswordSection}
        onEdit={() => setShowPasswordSection(true)}
        onSave={handlePasswordChange}
        onCancel={() => {
          setShowPasswordSection(false);
          setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
        }}
        saving={saving}
        accentColor="#6366F1"
        testId="security-section"
      >
        {showPasswordSection ? (
          <div className="password-form">
            <FormField label="Текущий пароль" testId="current-password-field">
              <input
                type="password"
                className="input-field"
                value={passwordData.current_password}
                onChange={(e) => setPasswordData({...passwordData, current_password: e.target.value})}
                placeholder="Введите текущий пароль"
                data-testid="current-password-input"
              />
            </FormField>

            <FormField label="Новый пароль" hint="Минимум 6 символов" testId="new-password-field">
              <input
                type="password"
                className="input-field"
                value={passwordData.new_password}
                onChange={(e) => setPasswordData({...passwordData, new_password: e.target.value})}
                placeholder="Введите новый пароль"
                data-testid="new-password-input"
              />
            </FormField>

            <FormField label="Подтвердите пароль" testId="confirm-password-field">
              <input
                type="password"
                className="input-field"
                value={passwordData.confirm_password}
                onChange={(e) => setPasswordData({...passwordData, confirm_password: e.target.value})}
                placeholder="Повторите новый пароль"
                data-testid="confirm-password-input"
              />
            </FormField>
          </div>
        ) : (
          <div className="security-info">
            <p>Нажмите "Редактировать" чтобы изменить пароль</p>
          </div>
        )}
      </SectionCard>

      {/* Danger Zone */}
      <div className="danger-zone-card" data-testid="danger-zone">
        <div className="danger-header" onClick={() => setShowDangerZone(!showDangerZone)}>
          <div className="danger-title">
            <AlertTriangle size={20} />
            <h2>Опасная зона</h2>
          </div>
          <button className="btn-toggle-danger" data-testid="toggle-danger-zone-btn">
            {showDangerZone ? 'Скрыть' : 'Показать'}
          </button>
        </div>

        {showDangerZone && (
          <div className="danger-content">
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
              </div>
            </div>

            <div className="delete-form">
              <label>Введите <strong>УДАЛИТЬ</strong> для подтверждения:</label>
              <input
                type="text"
                className="input-field input-danger"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="УДАЛИТЬ"
                data-testid="delete-confirmation-input"
              />
              <button 
                className="btn-delete-account" 
                onClick={handleDeleteAccount}
                disabled={saving || deleteConfirmation !== 'УДАЛИТЬ'}
                data-testid="delete-account-btn"
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
