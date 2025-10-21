import React, { useState, useEffect } from 'react';
import { ChevronLeft, Users, Home, MapPin, Heart, Lock, CheckCircle } from 'lucide-react';

const FamilySetupPage = ({ user, onBack, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [profileData, setProfileData] = useState({
    address_street: user?.address_street || '',
    address_city: user?.address_city || '',
    address_state: user?.address_state || '',
    address_country: user?.address_country || '',
    address_postal_code: user?.address_postal_code || '',
    marriage_status: user?.marriage_status || 'SINGLE'
  });
  
  const [familyData, setFamilyData] = useState({
    family_name: '',
    family_surname: '',
    description: '',
    public_bio: '',
    primary_address: '',
    city: '',
    state: '',
    country: '',
    established_date: '',
    is_private: true,
    allow_public_discovery: false
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Check if profile is already completed
  const isProfileCompleted = user?.profile_completed !== false && 
    user?.address_street && 
    user?.address_city && 
    user?.address_country && 
    user?.marriage_status;
  
  useEffect(() => {
    // If profile is already completed, skip to family creation
    if (isProfileCompleted) {
      setCurrentStep(2);
    }
  }, [isProfileCompleted]);

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFamilyChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFamilyData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/users/profile/complete`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profileData)
      });

      if (!response.ok) {
        throw new Error('Не удалось обновить профиль');
      }

      // Move to family creation step
      setCurrentStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFamilySubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/family-profiles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(familyData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Не удалось создать семейный профиль');
      }

      const newFamily = await response.json();
      
      // Call onComplete to refresh and navigate
      if (onComplete) {
        onComplete(newFamily);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderProfileStep = () => (
    <div className="family-setup-container">
      <div className="setup-header">
        <button onClick={onBack} className="back-button">
          <ChevronLeft size={20} />
          <span>Назад</span>
        </button>
      </div>

      <div className="setup-content">
        <div className="setup-hero">
          <div className="hero-icon">
            <Home size={48} style={{ color: '#059669' }} />
          </div>
          <h1>Завершите свой профиль</h1>
          <p>Чтобы создать семейный профиль, пожалуйста, заполните информацию о себе</p>
        </div>

        <form onSubmit={handleProfileSubmit} className="setup-form">
          {/* Address Section */}
          <div className="form-section">
            <h3>📍 Адрес проживания</h3>
            
            <div className="form-group">
              <label>Улица и номер дома *</label>
              <input
                type="text"
                name="address_street"
                value={profileData.address_street}
                onChange={handleProfileChange}
                placeholder="Например: ул. Ленина, д. 10, кв. 5"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Город *</label>
                <input
                  type="text"
                  name="address_city"
                  value={profileData.address_city}
                  onChange={handleProfileChange}
                  placeholder="Херсон"
                  required
                />
              </div>

              <div className="form-group">
                <label>Регион/Область</label>
                <input
                  type="text"
                  name="address_state"
                  value={profileData.address_state}
                  onChange={handleProfileChange}
                  placeholder="Херсонская область"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Страна *</label>
                <input
                  type="text"
                  name="address_country"
                  value={profileData.address_country}
                  onChange={handleProfileChange}
                  placeholder="Украина"
                  required
                />
              </div>

              <div className="form-group">
                <label>Почтовый индекс</label>
                <input
                  type="text"
                  name="address_postal_code"
                  value={profileData.address_postal_code}
                  onChange={handleProfileChange}
                  placeholder="73000"
                />
              </div>
            </div>
          </div>

          {/* Marriage Status Section */}
          <div className="form-section">
            <h3>💑 Семейное положение</h3>
            
            <div className="form-group">
              <label>Статус *</label>
              <select
                name="marriage_status"
                value={profileData.marriage_status}
                onChange={handleProfileChange}
                required
              >
                <option value="SINGLE">Холост / Не замужем</option>
                <option value="MARRIED">Женат / Замужем</option>
                <option value="DIVORCED">Разведен(а)</option>
                <option value="WIDOWED">Вдовец / Вдова</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="form-actions">
            <button 
              type="submit" 
              className="btn-primary"
              disabled={loading}
              style={{ backgroundColor: '#059669' }}
            >
              {loading ? 'Сохранение...' : 'Продолжить →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const renderFamilyStep = () => (
    <div className="family-setup-container">
      <div className="setup-header">
        <button onClick={onBack} className="back-button">
          <ChevronLeft size={20} />
          <span>Назад</span>
        </button>
      </div>

      <div className="setup-content">
        <div className="setup-hero">
          <div className="hero-icon">
            <Users size={48} style={{ color: '#059669' }} />
          </div>
          <h1>Создайте семейный профиль</h1>
          <p>Семейный профиль позволяет вам делиться новостями и событиями с близкими</p>
        </div>

        <form onSubmit={handleFamilySubmit} className="setup-form">
          {/* Basic Info Section */}
          <div className="form-section">
            <h3>👨‍👩‍👧‍👦 Основная информация</h3>
            
            <div className="form-group">
              <label>Название семьи *</label>
              <input
                type="text"
                name="family_name"
                value={familyData.family_name}
                onChange={handleFamilyChange}
                placeholder="Например: Семья Смирновых"
                required
              />
            </div>

            <div className="form-group">
              <label>Фамилия семьи</label>
              <input
                type="text"
                name="family_surname"
                value={familyData.family_surname}
                onChange={handleFamilyChange}
                placeholder="Смирновы"
              />
            </div>

            <div className="form-group">
              <label>Описание семьи</label>
              <textarea
                name="description"
                value={familyData.description}
                onChange={handleFamilyChange}
                placeholder="Расскажите немного о вашей семье..."
                rows={3}
              />
            </div>

            <div className="form-group">
              <label>Дата создания семьи</label>
              <input
                type="date"
                name="established_date"
                value={familyData.established_date}
                onChange={handleFamilyChange}
              />
            </div>
          </div>

          {/* Address Section */}
          <div className="form-section">
            <h3>📍 Адрес семьи</h3>
            
            <div className="form-group">
              <label>Адрес</label>
              <input
                type="text"
                name="primary_address"
                value={familyData.primary_address}
                onChange={handleFamilyChange}
                placeholder="ул. Ленина, д. 10"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Город</label>
                <input
                  type="text"
                  name="city"
                  value={familyData.city}
                  onChange={handleFamilyChange}
                  placeholder="Херсон"
                />
              </div>

              <div className="form-group">
                <label>Регион</label>
                <input
                  type="text"
                  name="state"
                  value={familyData.state}
                  onChange={handleFamilyChange}
                  placeholder="Херсонская область"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Страна</label>
              <input
                type="text"
                name="country"
                value={familyData.country}
                onChange={handleFamilyChange}
                placeholder="Украина"
              />
            </div>
          </div>

          {/* Public Bio Section */}
          <div className="form-section">
            <h3>🌐 Публичная информация</h3>
            
            <div className="form-group">
              <label>Публичное описание</label>
              <textarea
                name="public_bio"
                value={familyData.public_bio}
                onChange={handleFamilyChange}
                placeholder="Краткая информация о семье для публичного просмотра..."
                rows={3}
              />
              <small style={{ color: '#65676B', fontSize: '0.85rem' }}>
                Это описание увидят подписчики вашего семейного профиля
              </small>
            </div>
          </div>

          {/* Privacy Section */}
          <div className="form-section">
            <h3>🔒 Настройки приватности</h3>
            
            <div className="privacy-options">
              <label className="privacy-option">
                <input
                  type="checkbox"
                  name="is_private"
                  checked={familyData.is_private}
                  onChange={handleFamilyChange}
                />
                <div className="privacy-option-content">
                  <strong>Приватный профиль</strong>
                  <p>Только приглашенные семьи смогут видеть ваш профиль</p>
                </div>
              </label>

              <label className="privacy-option">
                <input
                  type="checkbox"
                  name="allow_public_discovery"
                  checked={familyData.allow_public_discovery}
                  onChange={handleFamilyChange}
                  disabled={familyData.is_private}
                />
                <div className="privacy-option-content">
                  <strong>Публичное обнаружение</strong>
                  <p>Семьи могут найти ваш профиль через поиск</p>
                </div>
              </label>
            </div>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="form-actions">
            {!isProfileCompleted && (
              <button 
                type="button"
                className="btn-secondary"
                onClick={() => setCurrentStep(1)}
                disabled={loading}
              >
                ← Назад
              </button>
            )}
            <button 
              type="submit" 
              className="btn-primary"
              disabled={loading}
              style={{ backgroundColor: '#059669' }}
            >
              {loading ? 'Создание...' : 'Создать семейный профиль ✓'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <div className="family-setup-page">
      {currentStep === 1 ? renderProfileStep() : renderFamilyStep()}
    </div>
  );
};

export default FamilySetupPage;
