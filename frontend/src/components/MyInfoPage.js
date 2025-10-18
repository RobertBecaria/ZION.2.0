import React, { useState, useEffect } from 'react';
import { User, MapPin, Phone, Calendar, Heart, Edit2, Save, X } from 'lucide-react';
import HouseholdSection from './HouseholdSection';

const MyInfoPage = ({ user, moduleColor = '#059669' }) => {
  const [myInfo, setMyInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name_alias: ''
  });
  const [saving, setSaving] = useState(false);

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
        setFormData({
          name_alias: data.name_alias || ''
        });
      }
    } catch (error) {
      console.error('Error fetching MY INFO:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/my-info`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name_alias: formData.name_alias || null
        })
      });

      if (response.ok) {
        const updated = await response.json();
        setMyInfo(updated);
        setEditing(false);
      }
    } catch (error) {
      console.error('Error saving MY INFO:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name_alias: myInfo.name_alias || ''
    });
    setEditing(false);
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
    const labels = {
      'SINGLE': 'Не женат/Не замужем',
      'MARRIED': 'Женат/Замужем',
      'DIVORCED': 'Разведён/Разведена',
      'WIDOWED': 'Вдовец/Вдова'
    };
    return labels[status] || 'Не указано';
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

      {/* Name Section */}
      <div className="info-section">
        <div className="section-header">
          <h2>Имя и Отображение</h2>
          {!editing ? (
            <button className="btn-icon" onClick={() => setEditing(true)}>
              <Edit2 size={18} />
              Редактировать
            </button>
          ) : (
            <div className="edit-actions">
              <button className="btn-icon btn-success" onClick={handleSave} disabled={saving}>
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
            <label>Имя (Официальное)</label>
            <div className="info-value">{myInfo.first_name}</div>
          </div>

          <div className="info-item">
            <label>Фамилия (Официальная)</label>
            <div className="info-value">{myInfo.last_name}</div>
          </div>

          {myInfo.middle_name && (
            <div className="info-item">
              <label>Отчество</label>
              <div className="info-value">{myInfo.middle_name}</div>
            </div>
          )}

          <div className="info-item full-width">
            <label>
              Отображаемое имя (Псевдоним)
              <span className="info-hint">Используется для облегчения произношения</span>
            </label>
            {!editing ? (
              <div className="info-value name-alias">
                {myInfo.name_alias || (
                  <span className="empty-value">Не указано</span>
                )}
              </div>
            ) : (
              <input
                type="text"
                className="form-input"
                placeholder="Например: ROBERT ORLANDO"
                value={formData.name_alias}
                onChange={(e) => setFormData({...formData, name_alias: e.target.value})}
              />
            )}
          </div>
        </div>
      </div>

      {/* Personal Information */}
      <div className="info-section">
        <div className="section-header">
          <h2>Личная Информация</h2>
        </div>

        <div className="info-grid">
          <div className="info-item">
            <label>
              <Calendar size={16} />
              Дата рождения
            </label>
            <div className="info-value">{formatDate(myInfo.date_of_birth)}</div>
          </div>

          <div className="info-item">
            <label>
              <Phone size={16} />
              Телефон
            </label>
            <div className="info-value">{myInfo.phone || 'Не указано'}</div>
          </div>

          <div className="info-item">
            <label>Email</label>
            <div className="info-value">{myInfo.email}</div>
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
        </div>

        <div className="info-grid">
          {myInfo.address_street && (
            <div className="info-item full-width">
              <label>Адрес (Улица, дом)</label>
              <div className="info-value">{myInfo.address_street}</div>
            </div>
          )}

          {(myInfo.address_city || myInfo.address_state || myInfo.address_country) && (
            <div className="info-item full-width">
              <label>Город, Регион, Страна</label>
              <div className="info-value">
                {[myInfo.address_city, myInfo.address_state, myInfo.address_country]
                  .filter(Boolean)
                  .join(', ')}
              </div>
            </div>
          )}

          {myInfo.address_postal_code && (
            <div className="info-item">
              <label>Почтовый индекс</label>
              <div className="info-value">{myInfo.address_postal_code}</div>
            </div>
          )}

          {!myInfo.address_street && !myInfo.address_city && (
            <div className="info-item full-width">
              <div className="empty-state">
                <p>Адрес не указан</p>
                <p className="hint">Заполните профиль в модуле Семья для добавления адреса</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Marriage Information */}
      <div className="info-section">
        <div className="section-header">
          <h2>
            <Heart size={20} />
            Семейное Положение
          </h2>
        </div>

        <div className="info-grid">
          <div className="info-item">
            <label>Статус</label>
            <div className="info-value">{getMarriageStatusLabel(myInfo.marriage_status)}</div>
          </div>

          {myInfo.marriage_status === 'MARRIED' && myInfo.spouse_name && (
            <>
              <div className="info-item">
                <label>Супруг(а)</label>
                <div className="info-value">{myInfo.spouse_name}</div>
              </div>

              {myInfo.spouse_phone && (
                <div className="info-item">
                  <label>Телефон супруга(и)</label>
                  <div className="info-value">{myInfo.spouse_phone}</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

    </div>
  );
};

export default MyInfoPage;
