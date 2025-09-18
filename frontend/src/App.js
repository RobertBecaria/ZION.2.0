import React, { useState, useEffect, createContext, useContext } from 'react';
import './App.css';
import UniversalChatLayout from './components/UniversalChatLayout';
import ChatGroupList from './components/ChatGroupList';
import UniversalCalendar from './components/UniversalCalendar';
import UniversalWall from './components/UniversalWall';
import ContentNavigation from './components/ContentNavigation';
import UniversalEventsPanel from './components/UniversalEventsPanel';
import MediaStorage from './components/MediaStorage';
import { 
  Clock, User, MessageCircle, Video, FileText, Settings, Search, Filter, Users,
  LogIn, UserPlus, Building2, GraduationCap, Briefcase, Shield, Eye, EyeOff,
  ChevronRight, Calendar, Heart, MapPin, Bell, Image, Grid, List, 
  Upload, FolderPlus, Download, Trash2, Newspaper, Book, 
  Building, ShoppingCart, DollarSign
} from 'lucide-react';

// Create Auth Context
const AuthContext = createContext();

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing token on app load
    const token = localStorage.getItem('zion_token');
    if (token) {
      fetchUserProfile(token);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUserProfile = async (token) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        localStorage.removeItem('zion_token');
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      localStorage.removeItem('zion_token');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('zion_token', data.access_token);
        setUser(data.user);
        return { success: true };
      } else {
        const error = await response.json();
        return { success: false, error: error.detail };
      }
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  };

  const register = async (userData) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('zion_token', data.access_token);
        setUser(data.user);
        return { success: true };
      } else {
        const error = await response.json();
        return { success: false, error: error.detail || 'Registration failed' };
      }
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'Network error' };
    }
  };

  const logout = () => {
    localStorage.removeItem('zion_token');
    setUser(null);
  };

  const completeOnboarding = async (onboardingData) => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(onboardingData),
      });

      if (response.ok) {
        // Refresh user profile to get updated affiliations
        await fetchUserProfile(token);
        return { success: true };
      } else {
        const error = await response.json();
        return { success: false, error: error.detail };
      }
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      register, 
      logout, 
      completeOnboarding,
      refreshProfile: () => fetchUserProfile(localStorage.getItem('zion_token'))
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// Login Component
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
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo-section">
            <img src="/zion-logo.jpeg" alt="ZION.CITY Logo" className="auth-logo" />
            <h1 className="platform-logo">ZION.CITY</h1>
          </div>
          <p>Добро пожаловать в цифровую экосистему</p>
        </div>
        
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
            />
          </div>
          
          <div className="form-group">
            <label>Пароль</label>
            <div className="password-input">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите пароль"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'Входим...' : <><LogIn size={20} /> Войти</>}
          </button>
        </form>
        
        <div className="auth-switch">
          <p>Нет аккаунта? <button onClick={onSwitchToRegister}>Зарегистрироваться</button></p>
        </div>
      </div>
    </div>
  );
}

// Registration Component
function RegistrationForm({ onSwitchToLogin }) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    middle_name: '',
    phone: ''
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
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo-section">
            <img src="/zion-logo.jpeg" alt="ZION.CITY Logo" className="auth-logo" />
            <h1 className="platform-logo">ZION.CITY</h1>
          </div>
          <p>Создайте аккаунт в цифровой экосистеме</p>
        </div>
        
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-row">
            <div className="form-group">
              <label>Имя *</label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                placeholder="Иван"
                required
              />
            </div>
            <div className="form-group">
              <label>Фамилия *</label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                placeholder="Иванов"
                required
              />
            </div>
          </div>
          
          <div className="form-group">
            <label>Отчество</label>
            <input
              type="text"
              name="middle_name"
              value={formData.middle_name}
              onChange={handleChange}
              placeholder="Иванович (необязательно)"
            />
          </div>
          
          <div className="form-group">
            <label>Email *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="your@email.com"
              required
            />
          </div>
          
          <div className="form-group">
            <label>Телефон</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+38 (067) 123-45-67"
            />
          </div>
          
          <div className="form-group">
            <label>Пароль *</label>
            <div className="password-input">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Минимум 6 символов"
                required
                minLength={6}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'Создаём аккаунт...' : <><UserPlus size={20} /> Зарегистрироваться</>}
          </button>
        </form>
        
        <div className="auth-switch">
          <p>Уже есть аккаунт? <button onClick={onSwitchToLogin}>Войти</button></p>
        </div>
      </div>
    </div>
  );
}

// Onboarding Component
function OnboardingWizard({ onComplete }) {
  const [step, setStep] = useState(1);
  const [onboardingData, setOnboardingData] = useState({
    work_place: '',
    work_role: '',
    university: '',
    university_role: '',
    school: '',
    school_role: '',
    privacy_settings: {
      work_visible_in_services: true,
      school_visible_in_events: true,
      location_sharing_enabled: false,
      profile_visible_to_public: true,
      family_visible_to_friends: true
    }
  });
  const [loading, setLoading] = useState(false);
  const { completeOnboarding } = useAuth();

  const handleInputChange = (field, value) => {
    setOnboardingData({
      ...onboardingData,
      [field]: value
    });
  };

  const handlePrivacyChange = (field, value) => {
    setOnboardingData({
      ...onboardingData,
      privacy_settings: {
        ...onboardingData.privacy_settings,
        [field]: value
      }
    });
  };

  const nextStep = () => {
    if (step < 4) setStep(step + 1);
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleComplete = async () => {
    setLoading(true);
    const result = await completeOnboarding(onboardingData);
    if (result.success) {
      onComplete();
    }
    setLoading(false);
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="onboarding-step">
            <div className="step-header">
              <Building2 size={48} color="#059669" />
              <h2>Место работы</h2>
              <p>Укажите информацию о вашем месте работы (необязательно)</p>
            </div>
            <div className="form-group">
              <label>Название организации</label>
              <input
                type="text"
                value={onboardingData.work_place}
                onChange={(e) => handleInputChange('work_place', e.target.value)}
                placeholder="ООО 'ТехноПром'"
              />
            </div>
            <div className="form-group">
              <label>Ваша должность</label>
              <input
                type="text"
                value={onboardingData.work_role}
                onChange={(e) => handleInputChange('work_role', e.target.value)}
                placeholder="Менеджер по проектам"
              />
            </div>
          </div>
        );
      
      case 2:
        return (
          <div className="onboarding-step">
            <div className="step-header">
              <GraduationCap size={48} color="#1D4ED8" />
              <h2>Образование</h2>
              <p>Укажите информацию об учебном заведении (необязательно)</p>
            </div>
            <div className="form-group">
              <label>Университет / Школа</label>
              <input
                type="text"
                value={onboardingData.university}
                onChange={(e) => handleInputChange('university', e.target.value)}
                placeholder="Херсонский Государственный Университет"
              />
            </div>
            <div className="form-group">
              <label>Статус</label>
              <select
                value={onboardingData.university_role}
                onChange={(e) => handleInputChange('university_role', e.target.value)}
              >
                <option value="">Выберите статус</option>
                <option value="Студент">Студент</option>
                <option value="Преподаватель">Преподаватель</option>
                <option value="Сотрудник">Сотрудник</option>
                <option value="Выпускник">Выпускник</option>
              </select>
            </div>
            <div className="form-group">
              <label>Школа ребёнка</label>
              <input
                type="text"
                value={onboardingData.school}
                onChange={(e) => handleInputChange('school', e.target.value)}
                placeholder="Средняя школа №5"
              />
            </div>
            {onboardingData.school && (
              <div className="form-group">
                <label>Ваш статус в школе</label>
                <select
                  value={onboardingData.school_role}
                  onChange={(e) => handleInputChange('school_role', e.target.value)}
                >
                  <option value="">Выберите статус</option>
                  <option value="Родитель">Родитель</option>
                  <option value="Учитель">Учитель</option>
                  <option value="Администрация">Администрация</option>
                </select>
              </div>
            )}
          </div>
        );
      
      case 3:
        return (
          <div className="onboarding-step">
            <div className="step-header">
              <Shield size={48} color="#B91C1C" />
              <h2>Настройки приватности</h2>
              <p>Управляйте видимостью вашей информации в разных модулях</p>
            </div>
            
            <div className="privacy-settings">
              <div className="privacy-item">
                <div className="privacy-info">
                  <strong>Работа в Сервисах</strong>
                  <p>Показывать место работы в модуле Сервисы</p>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={onboardingData.privacy_settings.work_visible_in_services}
                    onChange={(e) => handlePrivacyChange('work_visible_in_services', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              
              <div className="privacy-item">
                <div className="privacy-info">
                  <strong>Школа в Мероприятиях</strong>
                  <p>Показывать школу в модуле Мероприятия</p>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={onboardingData.privacy_settings.school_visible_in_events}
                    onChange={(e) => handlePrivacyChange('school_visible_in_events', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              
              <div className="privacy-item">
                <div className="privacy-info">
                  <strong>Геолокация</strong>
                  <p>Делиться местоположением с семьёй</p>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={onboardingData.privacy_settings.location_sharing_enabled}
                    onChange={(e) => handlePrivacyChange('location_sharing_enabled', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>
        );
      
      case 4:
        return (
          <div className="onboarding-step">
            <div className="step-header">
              <Users size={48} color="#059669" />
              <h2>Добро пожаловать в ZION.CITY!</h2>
              <p>Ваш профиль настроен. Теперь все ваши данные будут умно использоваться во всех модулях платформы.</p>
            </div>
            
            <div className="onboarding-summary">
              <h3>Что мы настроили:</h3>
              <div className="summary-grid">
                {onboardingData.work_place && (
                  <div className="summary-item">
                    <Briefcase size={20} />
                    <span>{onboardingData.work_place} - {onboardingData.work_role}</span>
                  </div>
                )}
                {onboardingData.university && (
                  <div className="summary-item">
                    <GraduationCap size={20} />
                    <span>{onboardingData.university} - {onboardingData.university_role}</span>
                  </div>
                )}
                {onboardingData.school && (
                  <div className="summary-item">
                    <Building2 size={20} />
                    <span>{onboardingData.school} - {onboardingData.school_role}</span>
                  </div>
                )}
              </div>
              
              <div className="magic-explanation">
                <h4>✨ Магия интеграции:</h4>
                <ul>
                  <li>Ваше место работы появится в модуле <strong>Организации</strong> как рабочее пространство</li>
                  <li>Компания будет показана в <strong>Сервисах</strong> как поставщик услуг</li>
                  <li>События из школы появятся в семейном календаре</li>
                  <li>Новости будут персонализированы под ваши интересы</li>
                </ul>
              </div>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="onboarding-container">
      <div className="onboarding-card">
        <div className="onboarding-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${(step / 4) * 100}%` }}
            ></div>
          </div>
          <span className="progress-text">Шаг {step} из 4</span>
        </div>
        
        {renderStep()}
        
        <div className="onboarding-actions">
          {step > 1 && (
            <button onClick={prevStep} className="btn-secondary">
              Назад
            </button>
          )}
          
          {step < 4 ? (
            <button onClick={nextStep} className="btn-primary">
              Далее <ChevronRight size={20} />
            </button>
          ) : (
            <button onClick={handleComplete} className="btn-primary" disabled={loading}>
              {loading ? 'Завершаем...' : 'Войти в ZION.CITY'}
            </button>
          )}
          
          {step < 4 && (
            <button onClick={handleComplete} className="btn-ghost">
              Пропустить настройку
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Main Dashboard Component
function Dashboard() {
  const [activeModule, setActiveModule] = useState('family');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedModuleFilter, setSelectedModuleFilter] = useState('all');
  const [mediaStats, setMediaStats] = useState({});
  const [chatGroups, setChatGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [showCalendar, setShowCalendar] = useState(false);
  const [activeView, setActiveView] = useState('wall'); // 'wall' or 'chat'
  const { user, logout } = useAuth();

  // Check if user needs onboarding (no affiliations)
  useEffect(() => {
    if (user && (!user.affiliations || user.affiliations.length === 0)) {
      setShowOnboarding(true);
    }
  }, [user]);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Fetch media statistics for right sidebar
  const fetchMediaStats = async () => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/media/modules`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setMediaStats(data.modules || {});
      }
    } catch (error) {
      console.error('Error fetching media stats:', error);
    }
  };

  // Load chat groups and fetch media stats when dashboard loads
  useEffect(() => {
    if (user) {
      fetchChatGroups();
      fetchMediaStats();
    }
  }, [user]);

  const fetchChatGroups = async () => {
    setLoadingGroups(true);
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/chat-groups`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setChatGroups(data.chat_groups || []);
        
        // Auto-select first family group if available
        const familyGroup = data.chat_groups?.find(g => g.group.group_type === 'FAMILY');
        if (familyGroup && !activeGroup) {
          setActiveGroup(familyGroup);
        }
      }
    } catch (error) {
      console.error('Error fetching chat groups:', error);
    } finally {
      setLoadingGroups(false);
    }
  };

  const handleGroupSelect = (groupData) => {
    setActiveGroup(groupData);
  };

  const handleCreateGroup = () => {
    fetchChatGroups(); // Refresh groups after creation
  };

  if (showOnboarding) {
    return <OnboardingWizard onComplete={() => setShowOnboarding(false)} />;
  }

  const modules = [
    { key: 'family', name: 'Семья', color: '#059669' },
    { key: 'news', name: 'Новости', color: '#1D4ED8' },
    { key: 'journal', name: 'Журнал', color: '#6D28D9' },
    { key: 'services', name: 'Сервисы', color: '#B91C1C' },
    { key: 'organizations', name: 'Организации', color: '#C2410C' },
    { key: 'marketplace', name: 'Маркетплейс', color: '#BE185D' },
    { key: 'finance', name: 'Финансы', color: '#A16207' },
    { key: 'events', name: 'Мероприятия', color: '#7E22CE' }
  ];

  const currentModule = modules.find(m => m.key === activeModule);
  const currentDate = new Date().toLocaleDateString('ru-RU', { 
    day: 'numeric', 
    month: 'long',
    year: 'numeric'
  });

  const sidebarTintStyle = {
    background: `linear-gradient(135deg, ${currentModule.color}05 0%, ${currentModule.color}02 100%)`,
  };

  const getUserAffiliationsByType = (type) => {
    if (!user.affiliations) return [];
    return user.affiliations.filter(a => a.affiliation.type === type);
  };

  return (
    <div className="app">
      {/* Top Navigation Bar */}
      <nav className="top-nav">
        <div className="nav-content">
          <div className="logo-section">
            <img src="/zion-logo.jpeg" alt="ZION.CITY Logo" className="nav-logo" />
            <h1 className="platform-logo">ZION.CITY</h1>
          </div>
          
          <div className="module-navigation">
            {modules.map((module) => (
              <button
                key={module.key}
                className={`nav-module ${activeModule === module.key ? 'active' : ''}`}
                onClick={() => setActiveModule(module.key)}
                style={{
                  backgroundColor: activeModule === module.key ? module.color : undefined
                }}
              >
                {module.name}
              </button>
            ))}
          </div>

          <div className="user-section">
            <div 
              className="clock-widget clickable" 
              onClick={() => setShowCalendar(!showCalendar)}
              title="Открыть календарь"
            >
              <div className="time">{currentTime.toLocaleTimeString('ru-RU', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}</div>
              <div className="date">{currentDate}</div>
              <div className="calendar-icon">
                <Calendar size={16} />
              </div>
            </div>
            <div className="user-menu">
              <button className="user-button">
                <User size={20} />
                <span>{user.first_name}</span>
              </button>
              <div className="user-dropdown">
                <button onClick={() => setShowOnboarding(true)}>Настройки профиля</button>
                <button onClick={logout}>Выйти</button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="main-container">
        {/* Left Sidebar - "Me" Zone */}
        <aside className="left-sidebar" style={sidebarTintStyle}>
          <div className="sidebar-header">
            <h3>Личный кабинет</h3>
          </div>
          
          {/* User Profile Section */}
          <div className="user-profile-section">
            <div className="profile-card">
              <div className="profile-avatar" style={{ backgroundColor: currentModule.color }}>
                <User size={32} color="white" />
              </div>
              <div className="profile-info">
                <h4>{user.first_name} {user.last_name}</h4>
                <p>@{user.email.split('@')[0]}</p>
              </div>
            </div>
            
            <button className="profile-btn primary" style={{ backgroundColor: currentModule.color }}>
              Мой Профиль
            </button>
            
            <button className="profile-btn secondary">
              Моя Лента
            </button>
          </div>

          <nav className="sidebar-nav">
            <a href="#" className="nav-item">
              <Users size={20} />
              <span>Мои Друзья</span>
            </a>
            <a href="#" className="nav-item">
              <MessageCircle size={20} />
              <span>Мои Сообщения</span>
            </a>
            
            {/* Media Storage Section */}
            <div className="nav-section">
              <span className="nav-section-title">Медиа Хранилище</span>
              <a 
                href="#" 
                className={`nav-item ${activeView === 'media-photos' ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveView('media-photos');
                }}
              >
                <Image size={20} />
                <span>Мои Фото</span>
              </a>
              <a 
                href="#" 
                className={`nav-item ${activeView === 'media-documents' ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveView('media-documents');
                }}
              >
                <FileText size={20} />
                <span>Мои Документы</span>
              </a>
              <a 
                href="#" 
                className={`nav-item ${activeView === 'media-videos' ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveView('media-videos');
                }}
              >
                <Video size={20} />
                <span>Мои Видео</span>
              </a>
            </div>
            
            <a href="#" className="nav-item">
              <Settings size={20} />
              <span>Настройки</span>
            </a>
          </nav>
        </aside>

        {/* Central Content Area */}
        <main className="content-area">
          {/* Show Calendar when active */}
          {showCalendar ? (
            <UniversalCalendar
              user={user}
              activeModule={activeModule}
              moduleColor={currentModule.color}
              onClose={() => setShowCalendar(false)}
            />
          ) : (
            <>
              <div className="content-header">
                <h2 className="module-title" style={{ color: currentModule.color }}>
                  {currentModule.name}
                </h2>
                <div className="breadcrumb">
                  <span>Главная</span> / <span>{currentModule.name}</span>
                </div>
                {user.affiliations && user.affiliations.length > 0 && (
                  <div className="context-tags">
                    {user.affiliations.slice(0, 3).map((affiliation) => (
                      <span key={affiliation.id} className="context-tag">
                        {affiliation.affiliation.name} - {affiliation.user_role_in_org}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="content-body">
                {/* Content Navigation */}
                <ContentNavigation
                  activeView={activeView}
                  onViewChange={setActiveView}
                  moduleColor={currentModule.color}
                  moduleName={currentModule.name}
                  showCalendar={showCalendar}
                  onCalendarToggle={() => setShowCalendar(!showCalendar)}
                />

                {/* Content Area with Split Layout */}
                <div className="split-content-layout">
                  {/* Main Content Area */}
                  <div className={`main-content-area ${(activeView === 'media-photos' || activeView === 'media-documents' || activeView === 'media-videos') ? 'full-width' : ''}`}>
                    {/* Media Storage Views - Full Width */}
                    {(activeView === 'media-photos' || activeView === 'media-documents' || activeView === 'media-videos') ? (
                      <MediaStorage
                        mediaType={activeView === 'media-photos' ? 'photos' : 
                                   activeView === 'media-documents' ? 'documents' : 'videos'}
                        user={user}
                        activeModule={activeModule}
                        moduleColor={currentModule.color}
                        selectedModuleFilter={selectedModuleFilter}
                        onModuleFilterChange={setSelectedModuleFilter}
                        onModuleCountsUpdate={setMediaStats}
                      />
                    ) : (
                      <>
                        {activeModule === 'family' && (
                          <>
                            {activeView === 'wall' ? (
                              <UniversalWall
                                activeGroup={activeGroup}
                                moduleColor={currentModule.color}
                                moduleName={currentModule.name}
                                user={user}
                              />
                            ) : (
                              <UniversalChatLayout
                                activeGroup={activeGroup}
                                chatGroups={chatGroups}
                                onGroupSelect={handleGroupSelect}
                                moduleColor={currentModule.color}
                                onCreateGroup={handleCreateGroup}
                                user={user}
                              />
                            )}
                          </>
                        )}

                        {activeModule === 'organizations' && (
                          <>
                            {activeView === 'wall' ? (
                              <UniversalWall
                                activeGroup={activeGroup}
                                moduleColor={currentModule.color}
                                moduleName={currentModule.name}
                                user={user}
                              />
                            ) : (
                              <UniversalChatLayout
                                activeGroup={activeGroup}
                                chatGroups={chatGroups}
                                onGroupSelect={handleGroupSelect}
                                moduleColor={currentModule.color}
                                onCreateGroup={handleCreateGroup}
                                user={user}
                              />
                            )}
                          </>
                        )}

                        {(activeModule === 'news' || activeModule === 'journal' || 
                          activeModule === 'services' || activeModule === 'marketplace' || 
                          activeModule === 'finance' || activeModule === 'events') && (
                          <>
                            {activeView === 'wall' ? (
                              <UniversalWall
                                activeGroup={activeGroup}
                                moduleColor={currentModule.color}
                                moduleName={currentModule.name}
                                user={user}
                              />
                            ) : (
                              <UniversalChatLayout
                                activeGroup={activeGroup}
                                chatGroups={chatGroups}
                                onGroupSelect={handleGroupSelect}
                                moduleColor={currentModule.color}
                                onCreateGroup={handleCreateGroup}
                                user={user}
                              />
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>

                  {/* Events Panel (30%) - Hide when in media views */}
                  {!(activeView === 'media-photos' || activeView === 'media-documents' || activeView === 'media-videos') && (
                    <div className="events-panel-area">
                      <UniversalEventsPanel
                        activeGroup={activeGroup}
                        moduleColor={currentModule.color}
                        moduleName={currentModule.name}
                        user={user}
                        context={activeView}
                      />
                    </div>
                  )}
                </div>
              </div>
              </>
            )}
        </main>

        {/* Right Sidebar - "World" Zone - Context-Specific */}
        <aside className="right-sidebar" style={sidebarTintStyle}>
          <div className="sidebar-header">
            <h3>Мировая Зона</h3>
          </div>
          
          {/* WALL View - Wall-specific widgets */}
          {activeView === 'wall' && (
            <>
              {/* Search Widget */}
              <div className="widget search-widget">
                <div className="widget-header">
                  <Search size={16} />
                  <span>Поиск записей</span>
                </div>
                <input type="text" placeholder="Поиск по записям..." className="search-input" />
              </div>

              {/* Quick Filters Widget */}
              <div className="widget filters-widget">
                <div className="widget-header">
                  <Filter size={16} />
                  <span>Быстрые фильтры</span>
                </div>
                <div className="filter-row">
                  <button className="filter-btn active" style={{ backgroundColor: currentModule.color, borderColor: currentModule.color }}>Все</button>
                  <button className="filter-btn">Новости</button>
                  <button className="filter-btn">События</button>
                </div>
              </div>

              {/* Online Friends Widget */}
              <div className="widget friends-widget">
                <div className="widget-header">
                  <Users size={16} />
                  <span>Друзья онлайн</span>
                </div>
                <div className="friends-list">
                  <div className="friend-item">
                    <div className="friend-avatar"></div>
                    <div className="friend-name">Елена Иванова</div>
                    <div className="online-indicator"></div>
                  </div>
                  <div className="friend-item">
                    <div className="friend-avatar"></div>
                    <div className="friend-name">Дмитрий Смирнов</div>
                    <div className="online-indicator"></div>
                  </div>
                </div>
              </div>

              {/* Popular Topics Widget */}
              <div className="widget topics-widget">
                <div className="widget-header">
                  <span>Популярное</span>
                </div>
                <div className="hashtags-list">
                  <span className="hashtag">#семья</span>
                  <span className="hashtag">#новости</span>
                  <span className="hashtag">#события</span>
                  <span className="hashtag">#город</span>
                  <span className="hashtag">#работа</span>
                </div>
              </div>
            </>
          )}

          {/* MEDIA Views - Media-specific controls */}
          {(activeView === 'media-photos' || activeView === 'media-documents' || activeView === 'media-videos') && (
            <>
              {/* Media Stats Widget */}
              <div className="widget media-stats-widget">
                <div className="widget-header">
                  <div className="media-icon" style={{ color: currentModule.color }}>
                    {activeView === 'media-photos' && <Image size={16} />}
                    {activeView === 'media-documents' && <FileText size={16} />}
                    {activeView === 'media-videos' && <Video size={16} />}
                  </div>
                  <span>Статистика медиа</span>
                </div>
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-number">
                      {mediaStats.all || 0}
                    </span>
                    <span className="stat-label">
                      {activeView === 'media-photos' && 'Фото'}
                      {activeView === 'media-documents' && 'Документы'}
                      {activeView === 'media-videos' && 'Видео'}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-number">
                      {(() => {
                        const totalSize = Object.values(mediaStats).reduce((total, module) => {
                          const allFiles = [...(module.images || []), ...(module.documents || []), ...(module.videos || [])];
                          return total + allFiles.reduce((size, file) => size + (file.file_size || 0), 0);
                        }, 0);
                        return (totalSize / (1024 * 1024)).toFixed(1);
                      })()} MB
                    </span>
                    <span className="stat-label">Использовано</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-number">{Object.keys(mediaStats).length}</span>
                    <span className="stat-label">Разделов</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-number">0</span>
                    <span className="stat-label">Альбомов</span>
                  </div>
                </div>
              </div>

              {/* Module Filters Widget */}
              <div className="widget module-filters-widget">
                <div className="widget-header">
                  <Filter size={16} />
                  <span>Разделы</span>
                </div>
                <div className="module-filter-list">
                  <button 
                    className={`module-filter-item ${selectedModuleFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setSelectedModuleFilter('all')}
                  >
                    <Grid size={16} style={{ color: '#6B7280' }} />
                    <div className="module-color-dot" style={{ backgroundColor: '#6B7280' }}></div>
                    <span>Все</span>
                    <span className="file-count">
                      {mediaStats.all || 0}
                    </span>
                  </button>
                  
                  <button 
                    className={`module-filter-item ${selectedModuleFilter === 'family' ? 'active' : ''}`}
                    onClick={() => setSelectedModuleFilter('family')}
                  >
                    <Users size={16} style={{ color: '#059669' }} />
                    <div className="module-color-dot" style={{ backgroundColor: '#059669' }}></div>
                    <span>Семья</span>
                    <span className="file-count">
                      {mediaStats.family || 0}
                    </span>
                  </button>
                  
                  <button 
                    className={`module-filter-item ${selectedModuleFilter === 'news' ? 'active' : ''}`}
                    onClick={() => setSelectedModuleFilter('news')}
                  >
                    <Newspaper size={16} style={{ color: '#1D4ED8' }} />
                    <div className="module-color-dot" style={{ backgroundColor: '#1D4ED8' }}></div>
                    <span>Новости</span>
                    <span className="file-count">
                      {mediaStats.news || 0}
                    </span>
                  </button>
                  
                  <button 
                    className={`module-filter-item ${selectedModuleFilter === 'journal' ? 'active' : ''}`}
                    onClick={() => setSelectedModuleFilter('journal')}
                  >
                    <Book size={16} style={{ color: '#6D28D9' }} />
                    <div className="module-color-dot" style={{ backgroundColor: '#6D28D9' }}></div>
                    <span>Журнал</span>
                    <span className="file-count">
                      {mediaStats.journal || 0}
                    </span>
                  </button>
                  
                  <button 
                    className={`module-filter-item ${selectedModuleFilter === 'services' ? 'active' : ''}`}
                    onClick={() => setSelectedModuleFilter('services')}
                  >
                    <Briefcase size={16} style={{ color: '#B91C1C' }} />
                    <div className="module-color-dot" style={{ backgroundColor: '#B91C1C' }}></div>
                    <span>Сервисы</span>
                    <span className="file-count">
                      {mediaStats.services || 0}
                    </span>
                  </button>
                  
                  <button 
                    className={`module-filter-item ${selectedModuleFilter === 'organizations' ? 'active' : ''}`}
                    onClick={() => setSelectedModuleFilter('organizations')}
                  >
                    <Building size={16} style={{ color: '#C2410C' }} />
                    <div className="module-color-dot" style={{ backgroundColor: '#C2410C' }}></div>
                    <span>Организации</span>
                    <span className="file-count">
                      {mediaStats.organizations || 0}
                    </span>
                  </button>
                  
                  <button 
                    className={`module-filter-item ${selectedModuleFilter === 'marketplace' ? 'active' : ''}`}
                    onClick={() => setSelectedModuleFilter('marketplace')}
                  >
                    <ShoppingCart size={16} style={{ color: '#BE185D' }} />
                    <div className="module-color-dot" style={{ backgroundColor: '#BE185D' }}></div>
                    <span>Маркетплейс</span>
                    <span className="file-count">
                      {mediaStats.marketplace || 0}
                    </span>
                  </button>
                  
                  <button 
                    className={`module-filter-item ${selectedModuleFilter === 'finance' ? 'active' : ''}`}
                    onClick={() => setSelectedModuleFilter('finance')}
                  >
                    <DollarSign size={16} style={{ color: '#A16207' }} />
                    <div className="module-color-dot" style={{ backgroundColor: '#A16207' }}></div>
                    <span>Финансы</span>
                    <span className="file-count">
                      {mediaStats.finance || 0}
                    </span>
                  </button>
                  
                  <button 
                    className={`module-filter-item ${selectedModuleFilter === 'events' ? 'active' : ''}`}
                    onClick={() => setSelectedModuleFilter('events')}
                  >
                    <Calendar size={16} style={{ color: '#7E22CE' }} />
                    <div className="module-color-dot" style={{ backgroundColor: '#7E22CE' }}></div>
                    <span>Мероприятия</span>
                    <span className="file-count">
                      {mediaStats.events || 0}
                    </span>
                  </button>
                </div>
              </div>

              {/* Quick Actions Widget */}
              <div className="widget media-actions-widget">
                <div className="widget-header">
                  <span>Быстрые действия</span>
                </div>
                <div className="quick-actions-list">
                  <button className="quick-action-btn" style={{ backgroundColor: currentModule.color }}>
                    <Upload size={16} />
                    <span>Загрузить файлы</span>
                  </button>
                  <button className="quick-action-btn">
                    <FolderPlus size={16} />
                    <span>Создать альбом</span>
                  </button>
                  <button className="quick-action-btn">
                    <Download size={16} />
                    <span>Скачать все</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* CHAT View - Chat-specific widgets */}
          {activeView === 'chat' && (
            <>
              {/* Chat Groups Widget */}
              <div className="widget chat-groups-widget">
                <div className="widget-header">
                  <MessageCircle size={16} />
                  <span>Активные чаты</span>
                </div>
                <div className="chat-groups-list">
                  <div className="chat-group-item">
                    <div className="group-avatar"></div>
                    <div className="group-info">
                      <span className="group-name">Семья</span>
                      <span className="last-message">Привет всем! 👋</span>
                    </div>
                    <div className="unread-count">2</div>
                  </div>
                </div>
              </div>

              {/* Online Friends Widget */}
              <div className="widget friends-widget">
                <div className="widget-header">
                  <Users size={16} />
                  <span>Друзья онлайн</span>
                </div>
                <div className="friends-list">
                  <div className="friend-item">
                    <div className="friend-avatar"></div>
                    <div className="friend-info">
                      <span className="friend-name">Анна Петрова</span>
                      <span className="friend-status">В сети</span>
                    </div>
                    <div className="status-indicator online"></div>
                  </div>
                  <div className="friend-item">
                    <div className="friend-avatar"></div>
                    <div className="friend-info">
                      <span className="friend-name">Максим Иванов</span>
                      <span className="friend-status">В сети</span>
                    </div>
                    <div className="status-indicator online"></div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* CHAT View - Chat-specific widgets */}
          {activeView === 'chat' && (
            <>
              {/* Chat Groups Widget */}
              <div className="widget chat-groups-widget">
                <ChatGroupList
                  chatGroups={chatGroups}
                  activeGroup={activeGroup}
                  onGroupSelect={handleGroupSelect}
                  onCreateGroup={handleCreateGroup}
                  moduleColor={currentModule.color}
                  user={user}
                />
              </div>

              {/* Chat Settings Widget */}
              <div className="widget chat-settings-widget">
                <div className="widget-header">
                  <Settings size={16} />
                  <span>Настройки чата</span>
                </div>
                <div className="chat-settings-list">
                  <div className="setting-item">
                    <span>Уведомления</span>
                    <label className="toggle">
                      <input type="checkbox" defaultChecked />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <div className="setting-item">
                    <span>Звук сообщений</span>
                    <label className="toggle">
                      <input type="checkbox" defaultChecked />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Chat Participants Widget */}
              {activeGroup && (
                <div className="widget participants-widget">
                  <div className="widget-header">
                    <Users size={16} />
                    <span>Участники ({activeGroup.member_count})</span>
                  </div>
                  <div className="participants-list">
                    <div className="participant-item">
                      <div className="participant-avatar" style={{ backgroundColor: currentModule.color }}>
                        <User size={16} color="white" />
                      </div>
                      <div className="participant-info">
                        <span className="participant-name">{user.first_name} {user.last_name}</span>
                        <span className="participant-role">Администратор</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Chat Activity Widget */}
              <div className="widget chat-activity-widget">
                <div className="widget-header">
                  <MessageCircle size={16} />
                  <span>Активность чата</span>
                </div>
                <div className="activity-stats">
                  <div className="stat-item">
                    <span className="stat-number">25</span>
                    <span className="stat-label">Сообщений сегодня</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-number">{chatGroups.length}</span>
                    <span className="stat-label">Активных групп</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

// Main App Component
function App() {
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  
  return (
    <AuthProvider>
      <div className="App">
        <AuthWrapper authMode={authMode} setAuthMode={setAuthMode} />
      </div>
    </AuthProvider>
  );
}

function AuthWrapper({ authMode, setAuthMode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Загрузка ZION.CITY...</p>
      </div>
    );
  }

  if (!user) {
    if (authMode === 'register') {
      return <RegistrationForm onSwitchToLogin={() => setAuthMode('login')} />;
    }
    return <LoginForm onSwitchToRegister={() => setAuthMode('register')} />;
  }

  return <Dashboard />;
}

export default App;