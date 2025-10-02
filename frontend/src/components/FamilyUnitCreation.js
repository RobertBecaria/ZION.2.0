import React, { useState } from 'react';
import { Home, Users } from 'lucide-react';

const FamilyUnitCreation = ({ user, onFamilyCreated, onCancel }) => {
  const [formData, setFormData] = useState({
    family_name: `Семья ${user.last_name}`,
    family_surname: user.last_name
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/family-units`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(formData)
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Не удалось создать семью');
      }

      const data = await response.json();
      onFamilyCreated(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="family-unit-creation">
      <div className="creation-header">
        <div className="creation-icon">
          <Home size={48} color="#059669" />
        </div>
        <h2>Создайте семейный профиль</h2>
        <p>Создайте семейный профиль, чтобы делиться моментами с близкими</p>
      </div>

      <form onSubmit={handleSubmit} className="family-creation-form">
        <div className="form-group">
          <label>Название семьи *</label>
          <input
            type="text"
            name="family_name"
            value={formData.family_name}
            onChange={handleChange}
            required
            placeholder="Например: Семья Петровых"
          />
          <small>Это название будет видно всем членам семьи</small>
        </div>

        <div className="form-group">
          <label>Фамилия *</label>
          <input
            type="text"
            name="family_surname"
            value={formData.family_surname}
            onChange={handleChange}
            required
            placeholder="Например: Петров"
          />
          <small>Используется для поиска и сопоставления семей</small>
        </div>

        <div className="family-info-box">
          <Users size={20} color="#059669" />
          <div>
            <strong>Ваш адресс:</strong>
            <p>{user.address_street}, {user.address_city}, {user.address_country}</p>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="form-actions">
          {onCancel && (
            <button type="button" onClick={onCancel} className="btn-secondary">
              Отмена
            </button>
          )}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Создание...' : 'Создать семью'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FamilyUnitCreation;