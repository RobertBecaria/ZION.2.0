import React, { useState } from 'react';
import { User, Bot, Users as UsersIcon } from 'lucide-react';

function GenderUpdateModal({ isOpen, onClose, onUpdate }) {
  const [selectedGender, setSelectedGender] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const genderOptions = [
    {
      value: 'MALE',
      icon: User,
      label: 'Мужчина',
      description: 'Человек мужского пола',
      color: '#1877F2'
    },
    {
      value: 'FEMALE',
      icon: UsersIcon,
      label: 'Женщина',
      description: 'Человек женского пола',
      color: '#E91E63'
    },
    {
      value: 'IT',
      icon: Bot,
      label: 'IT (Технологии)',
      description: 'AI Агент, Умное устройство, IoT',
      color: '#9C27B0'
    }
  ];

  const handleSubmit = async () => {
    if (!selectedGender) {
      alert('Пожалуйста, выберите пол');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('zion_token');
      const backendUrl = process.env.REACT_APP_BACKEND_URL;
      if (!backendUrl) throw new Error('Backend URL not configured');
      
      const response = await fetch(`${backendUrl}/api/users/gender`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ gender: selectedGender })
      });

      if (response.ok) {
        onUpdate(selectedGender);
        onClose();
      } else {
        throw new Error('Failed to update gender');
      }
    } catch (error) {
      console.error('Error updating gender:', error);
      alert('Ошибка при обновлении. Попробуйте еще раз.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target.className === 'modal-overlay' && !loading && onClose()}>
      <div className="gender-modal">
        <div className="modal-header">
          <h2>Укажите ваш пол</h2>
          <p className="modal-subtitle">Это поможет настроить фильтры и улучшить взаимодействие</p>
        </div>

        <div className="gender-options">
          {genderOptions.map((option) => {
            const IconComponent = option.icon;
            return (
              <div
                key={option.value}
                className={`gender-option ${selectedGender === option.value ? 'selected' : ''}`}
                onClick={() => setSelectedGender(option.value)}
                style={{
                  borderColor: selectedGender === option.value ? option.color : '#E4E6EB',
                  backgroundColor: selectedGender === option.value ? `${option.color}10` : 'white'
                }}
              >
                <div className="gender-icon" style={{ color: option.color }}>
                  <IconComponent size={32} />
                </div>
                <div className="gender-info">
                  <h3 style={{ color: selectedGender === option.value ? option.color : '#050505' }}>
                    {option.label}
                  </h3>
                  <p>{option.description}</p>
                </div>
                <div className="gender-radio">
                  <div 
                    className="radio-outer"
                    style={{ borderColor: selectedGender === option.value ? option.color : '#BCC0C4' }}
                  >
                    {selectedGender === option.value && (
                      <div 
                        className="radio-inner"
                        style={{ backgroundColor: option.color }}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="modal-actions">
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={!selectedGender || loading}
            style={{
              backgroundColor: selectedGender ? '#059669' : '#E4E6EB',
              color: selectedGender ? 'white' : '#BCC0C4',
              cursor: selectedGender && !loading ? 'pointer' : 'not-allowed'
            }}
          >
            {loading ? 'Сохранение...' : 'Продолжить'}
          </button>
        </div>

        <p className="modal-note">
          💡 <strong>Зачем это нужно?</strong> Вы сможете создавать посты для определенных групп 
          (например, "только для отцов" или "только для матерей") и видеть релевантный контент.
        </p>
      </div>
    </div>
  );
}

export default GenderUpdateModal;
