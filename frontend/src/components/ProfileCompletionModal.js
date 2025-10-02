import React, { useState } from 'react';
import { X } from 'lucide-react';

const ProfileCompletionModal = ({ user, onClose, onComplete }) => {
  const [formData, setFormData] = useState({
    address_street: user?.address_street || '',
    address_city: user?.address_city || '',
    address_state: user?.address_state || '',
    address_country: user?.address_country || '',
    address_postal_code: user?.address_postal_code || '',
    marriage_status: user?.marriage_status || 'SINGLE',
    spouse_name: user?.spouse_name || '',
    spouse_phone: user?.spouse_phone || ''
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
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/users/profile/complete`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error('Не удалось завершить профиль');
      }

      const data = await response.json();
      onComplete(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content profile-completion-modal">
        <div className="modal-header">
          <h2>Завершите свой профиль</h2>
          <button onClick={onClose} className="modal-close-btn">
            <X size={24} />
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-description">
            Чтобы использовать семейный профиль, пожалуйста, заполните дополнительную информацию.
          </p>

          <form onSubmit={handleSubmit} className="profile-completion-form">
            {/* Address Section */}
            <div className="form-section">
              <h3>Адрес</h3>
              
              <div className="form-group">
                <label>Улица *</label>
                <input
                  type="text"
                  name="address_street"
                  value={formData.address_street}
                  onChange={handleChange}
                  required
                  placeholder="Например: ул. Ленина, д. 10"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Город *</label>
                  <input
                    type="text"
                    name="address_city"
                    value={formData.address_city}
                    onChange={handleChange}
                    required
                    placeholder="Например: Херсон"
                  />
                </div>

                <div className="form-group">
                  <label>Область</label>
                  <input
                    type="text"
                    name="address_state"
                    value={formData.address_state}
                    onChange={handleChange}
                    placeholder="Например: Херсонская"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Страна *</label>
                  <input
                    type="text"
                    name="address_country"
                    value={formData.address_country}
                    onChange={handleChange}
                    required
                    placeholder="Например: Украина"
                  />
                </div>

                <div className="form-group">
                  <label>Почтовый индекс</label>
                  <input
                    type="text"
                    name="address_postal_code"
                    value={formData.address_postal_code}
                    onChange={handleChange}
                    placeholder="Например: 73000"
                  />
                </div>
              </div>
            </div>

            {/* Marriage Status Section */}
            <div className="form-section">
              <h3>Семейное положение</h3>
              
              <div className="form-group">
                <label>Статус *</label>
                <select
                  name="marriage_status"
                  value={formData.marriage_status}
                  onChange={handleChange}
                  required
                >
                  <option value="SINGLE">Холост/Не замужем</option>
                  <option value="MARRIED">Женат/Замужем</option>
                  <option value="DIVORCED">Разведен/Разведена</option>
                  <option value="WIDOWED">Вдовец/Вдова</option>
                </select>
              </div>

              {formData.marriage_status === 'MARRIED' && (
                <>
                  <div className="form-group">
                    <label>Имя супруга(и)</label>
                    <input
                      type="text"
                      name="spouse_name"
                      value={formData.spouse_name}
                      onChange={handleChange}
                      placeholder="Например: Мария Петрова"
                    />
                  </div>

                  <div className="form-group">
                    <label>Телефон супруга(и)</label>
                    <input
                      type="tel"
                      name="spouse_phone"
                      value={formData.spouse_phone}
                      onChange={handleChange}
                      placeholder="Например: +380501234567"
                    />
                    <small>Это поможет найти существующие семейные профили</small>
                  </div>
                </>
              )}
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="modal-actions">
              <button type="button" onClick={onClose} className="btn-secondary">
                Отмена
              </button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Сохранение...' : 'Завершить профиль'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfileCompletionModal;