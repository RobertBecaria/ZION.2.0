import React, { useState, useEffect, createContext, useContext } from 'react';
import './App.css';
import UniversalChatLayout from './components/UniversalChatLayout';
import ChatGroupList from './components/ChatGroupList';
import UniversalCalendar from './components/UniversalCalendar';
import UniversalWall from './components/UniversalWall';
import ContentNavigation from './components/ContentNavigation';
import UniversalEventsPanel from './components/UniversalEventsPanel';
import { 
  Clock, User, MessageCircle, Video, FileText, Settings, Search, Filter, Users,
  LogIn, UserPlus, Building2, GraduationCap, Briefcase, Shield, Eye, EyeOff,
  ChevronRight, Calendar, Heart, MapPin, Bell
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
          <h1 className="platform-logo">ZION.CITY</h1>
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
          <h1 className="platform-logo">ZION.CITY</h1>
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
  const [chatGroups, setChatGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [showCalendar, setShowCalendar] = useState(false);
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

  // Load chat groups when dashboard loads
  useEffect(() => {
    if (user) {
      fetchChatGroups();
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
    backgroundColor: `${currentModule.color}08`
  };

  const getUserAffiliationsByType = (type) => {
    if (!user.affiliations) return [];
    return user.affiliations.filter(a => a.affiliation.type === type);
  };

  return (
    <div className="app">
      {/* Top Navigation Bar */}
      <nav className="top-nav" style={{ backgroundColor: currentModule.color }}>
        <div className="nav-content">
          <div className="logo-section">
            <h1 className="platform-logo">ZION.CITY</h1>
          </div>
          
          <div className="module-navigation">
            {modules.map((module) => (
              <button
                key={module.key}
                className={`nav-module ${activeModule === module.key ? 'active' : ''}`}
                onClick={() => setActiveModule(module.key)}
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
            <h3>Личная Зона</h3>
          </div>
          <nav className="sidebar-nav">
            <a href="#profile" className="nav-item">
              <User size={20} />
              <span>Профиль</span>
            </a>
            <a href="#friends" className="nav-item">
              <Users size={20} />
              <span>Друзья</span>
            </a>
            <a href="#messages" className="nav-item">
              <MessageCircle size={20} />
              <span>Сообщения</span>
            </a>
            <a href="#videos" className="nav-item">
              <Video size={20} />
              <span>Видео</span>
            </a>
            <a href="#documents" className="nav-item">
              <FileText size={20} />
              <span>Документы</span>
            </a>
            <a href="#settings" className="nav-item">
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
                {activeModule === 'family' && (
                  <div className="family-dashboard">
                    <div className="family-chat-container">
                      {/* Full width chat area */}
                      <div className="chat-area">
                        <UniversalChatLayout
                          activeGroup={activeGroup}
                          chatGroups={chatGroups}
                          onGroupSelect={handleGroupSelect}
                          moduleColor={currentModule.color}
                          onCreateGroup={handleCreateGroup}
                          user={user}
                        />
                      </div>
                    </div>
                  </div>
                )}

            {activeModule === 'organizations' && (
              <div className="organizations-dashboard">
                <div className="welcome-section">
                  <h3>Ваши организации</h3>
                  <p>Управляйте связями с вашими рабочими и учебными учреждениями</p>
                </div>
                
                <div className="organizations-grid">
                  {getUserAffiliationsByType('WORK').map((affiliation) => (
                    <div key={affiliation.id} className="organization-tile clickable">
                      <div className="org-icon">
                        <Briefcase size={32} />
                      </div>
                      <div className="org-info">
                        <h4>{affiliation.affiliation.name}</h4>
                        <p>{affiliation.user_role_in_org}</p>
                        <span className="org-type">Место работы</span>
                      </div>
                      <ChevronRight size={20} className="org-arrow" />
                    </div>
                  ))}
                  
                  {getUserAffiliationsByType('UNIVERSITY').map((affiliation) => (
                    <div key={affiliation.id} className="organization-tile clickable">
                      <div className="org-icon">
                        <GraduationCap size={32} />
                      </div>
                      <div className="org-info">
                        <h4>{affiliation.affiliation.name}</h4>
                        <p>{affiliation.user_role_in_org}</p>
                        <span className="org-type">Университет</span>
                      </div>
                      <ChevronRight size={20} className="org-arrow" />
                    </div>
                  ))}
                  
                  {getUserAffiliationsByType('SCHOOL').map((affiliation) => (
                    <div key={affiliation.id} className="organization-tile clickable">
                      <div className="org-icon">
                        <Building2 size={32} />
                      </div>
                      <div className="org-info">
                        <h4>{affiliation.affiliation.name}</h4>
                        <p>{affiliation.user_role_in_org}</p>
                        <span className="org-type">Школа</span>
                      </div>
                      <ChevronRight size={20} className="org-arrow" />
                    </div>
                  ))}
                </div>
                
                {(!user.affiliations || user.affiliations.length === 0) && (
                  <div className="empty-state">
                    <Building2 size={64} color="#9ca3af" />
                    <h3>Нет организаций</h3>
                    <p>Добавьте информацию о работе и учёбе в настройках профиля</p>
                    <button onClick={() => setShowOnboarding(true)} className="btn-primary">
                      Добавить организации
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {activeModule !== 'family' && activeModule !== 'organizations' && (
              <div className="module-placeholder">
                <h3>Модуль "{currentModule.name}"</h3>
                <p>Контент модуля будет размещен здесь</p>
                {user.affiliations && user.affiliations.length > 0 && (
                  <div className="contextual-preview">
                    <h4>Контекстная информация:</h4>
                    <ul>
                      {user.affiliations.map((affiliation) => (
                        <li key={affiliation.id}>
                          {affiliation.affiliation.name} будет отображаться в этом модуле
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="placeholder-content">
                  <div className="placeholder-block"></div>
                  <div className="placeholder-block"></div>
                  <div className="placeholder-block"></div>
                </div>
              </div>
            )}
          </div>
              </>
            )}
        </main>

        {/* Right Sidebar - "World" Zone */}
        <aside className="right-sidebar" style={sidebarTintStyle}>
          <div className="sidebar-header">
            <h3>Мировая Зона</h3>
          </div>
          
          {/* Horizontal Filter Row */}
          <div className="filter-section">
            <div className="filter-header">
              <Filter size={16} />
              <span>Фильтры</span>
            </div>
            <div className="filter-row">
              <button className="filter-btn active">Все</button>
              <button className="filter-btn">Семья</button>
              <button className="filter-btn">Друзья</button>
              <button className="filter-btn">Работа</button>
            </div>
          </div>

          {/* Search Widget */}
          <div className="widget search-widget">
            <div className="widget-header">
              <Search size={16} />
              <span>Поиск</span>
            </div>
            <input type="text" placeholder="Поиск по платформе..." className="search-input" />
          </div>

          {/* Context Widget */}
          {user.affiliations && user.affiliations.length > 0 && (
            <div className="widget context-widget">
              <div className="widget-header">
                <Building2 size={16} />
                <span>Ваши организации</span>
              </div>
              <div className="context-list">
                {user.affiliations.slice(0, 3).map((affiliation) => (
                  <div key={affiliation.id} className="context-item">
                    <div className="context-icon">
                      {affiliation.affiliation.type === 'WORK' && <Briefcase size={16} />}
                      {affiliation.affiliation.type === 'UNIVERSITY' && <GraduationCap size={16} />}
                      {affiliation.affiliation.type === 'SCHOOL' && <Building2 size={16} />}
                    </div>
                    <div className="context-info">
                      <span className="context-name">{affiliation.affiliation.name}</span>
                      <span className="context-role">{affiliation.user_role_in_org}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chat Groups Widget - Show only when in Family module */}
          {activeModule === 'family' && (
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
          )}

          {/* Friends List Widget */}
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

          {/* Quick Stats Widget */}
          <div className="widget stats-widget">
            <div className="widget-header">
              <Bell size={16} />
              <span>Быстрая статистика</span>
            </div>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-number">12</span>
                <span className="stat-label">Сообщения</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">3</span>
                <span className="stat-label">События</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">{user.affiliations ? user.affiliations.length : 0}</span>
                <span className="stat-label">Организации</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">24</span>
                <span className="stat-label">Уведомления</span>
              </div>
            </div>
          </div>
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