/**
 * LoginForm Component
 * Handles user login
 */
import React, { useState } from 'react';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import { useAuth } from './AuthContext';

const BACKGROUND_IMAGE = 'https://customer-assets.emergentagent.com/job_19d0102c-736b-4d98-ac03-8c99eb900d4d/artifacts/go6pslyt_photo_2025-12-21%2015.36.56.jpeg';

function LoginForm({ onSwitchToRegister }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(email, password);
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
          <p style={{ fontWeight: 'bold', color: '#a5b4fc' }}>BRICS WEB 4.0</p>
        </div>
        
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label style={{ color: '#e2e8f0' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              style={{
                background: 'rgba(30, 41, 59, 0.8)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                color: '#fff'
              }}
            />
          </div>
          
          <div className="form-group">
            <label style={{ color: '#e2e8f0' }}>Пароль</label>
            <div className="password-input">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите пароль"
                required
                style={{
                  background: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  color: '#fff'
                }}
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
            {loading ? 'Входим...' : <><LogIn size={20} /> Войти</>}
          </button>
        </form>
        
        <div className="auth-switch">
          <p style={{ color: '#94a3b8' }}>Нет аккаунта? <button onClick={onSwitchToRegister} style={{ color: '#a5b4fc' }}>Зарегистрироваться</button></p>
        </div>
      </div>
    </div>
  );
}

export default LoginForm;
