/**
 * RegistrationForm Component
 * Handles user registration
 */
import React, { useState } from 'react';
import { UserPlus, Eye, EyeOff } from 'lucide-react';
import { useAuth } from './AuthContext';

const BACKGROUND_IMAGE = 'https://customer-assets.emergentagent.com/job_19d0102c-736b-4d98-ac03-8c99eb900d4d/artifacts/go6pslyt_photo_2025-12-21%2015.36.56.jpeg';

const inputStyle = {
  background: 'rgba(30, 41, 59, 0.8)',
  border: '1px solid rgba(139, 92, 246, 0.3)',
  color: '#fff'
};

function RegistrationForm({ onSwitchToLogin }) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    middle_name: '',
    phone: ''
    // Removed gender - will be set via mandatory popup on first login
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();

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

    const result = await register(formData);
    if (!result.success) {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div 
      className="auth-container"
      style={{
        backgroundImage: `url(${BACKGROUND_IMAGE})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        minHeight: '100vh'
      }}
    >
      <div 
        className="auth-card"
        style={{
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          boxShadow: '0 0 40px rgba(139, 92, 246, 0.2), 0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }}
      >
        <div className="auth-header">
          <div className="auth-logo-section">
            <img src="/zion-logo.jpeg" alt="ZION.CITY Logo" className="auth-logo" />
            <h1 className="platform-logo" style={{ color: '#fff', textShadow: '0 0 20px rgba(139, 92, 246, 0.5)' }}>ZION.CITY</h1>
          </div>
          <p style={{ color: '#a5b4fc' }}>Создайте аккаунт в WEB 4.0 - многофункциональная цифровая платформа и мессенджер!</p>
        </div>
        
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-row">
            <div className="form-group">
              <label style={{ color: '#e2e8f0' }}>Имя *</label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                placeholder="Иван"
                required
                style={inputStyle}
              />
            </div>
            <div className="form-group">
              <label style={{ color: '#e2e8f0' }}>Фамилия *</label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                placeholder="Иванов"
                required
                style={inputStyle}
              />
            </div>
          </div>
          
          <div className="form-group">
            <label style={{ color: '#e2e8f0' }}>Отчество</label>
            <input
              type="text"
              name="middle_name"
              value={formData.middle_name}
              onChange={handleChange}
              placeholder="Иванович (необязательно)"
              style={inputStyle}
            />
          </div>
          
          <div className="form-group">
            <label style={{ color: '#e2e8f0' }}>Email *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="your@email.com"
              required
              style={inputStyle}
            />
          </div>
          
          <div className="form-group">
            <label style={{ color: '#e2e8f0' }}>Телефон</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+38 (067) 123-45-67"
              style={inputStyle}
            />
          </div>
          
          <div className="form-group">
            <label style={{ color: '#e2e8f0' }}>Пароль *</label>
            <div className="password-input">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Минимум 6 символов"
                required
                minLength={6}
                style={inputStyle}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                style={{ color: '#a5b4fc' }}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <button 
            type="submit" 
            className="auth-button" 
            disabled={loading}
            style={{
              background: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)',
              boxShadow: '0 0 20px rgba(139, 92, 246, 0.4)'
            }}
          >
            {loading ? 'Создаём аккаунт...' : <><UserPlus size={20} /> Зарегистрироваться</>}
          </button>
        </form>
        
        <div className="auth-switch">
          <p style={{ color: '#94a3b8' }}>Уже есть аккаунт? <button onClick={onSwitchToLogin} style={{ color: '#a5b4fc' }}>Войти</button></p>
        </div>
      </div>
    </div>
  );
}

export default RegistrationForm;
