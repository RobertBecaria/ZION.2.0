import React, { useState, useEffect, createContext, useContext } from 'react';
import './App.css';
import UniversalChatLayout from './components/UniversalChatLayout';
import ChatGroupList from './components/ChatGroupList';
import UniversalCalendar from './components/UniversalCalendar';
import UniversalWall from './components/UniversalWall';
import ContentNavigation from './components/ContentNavigation';
import UniversalEventsPanel from './components/UniversalEventsPanel';
import MediaStorage from './components/MediaStorage';
import MyProfile from './components/MyProfile';
// NEW FAMILY SYSTEM COMPONENTS
import ProfileCompletionModal from './components/ProfileCompletionModal';
import FamilyTriggerFlow from './components/FamilyTriggerFlow';
import MyFamilyProfile from './components/MyFamilyProfile';
import PublicFamilyProfile from './components/PublicFamilyProfile';
import GenderUpdateModal from './components/GenderUpdateModal';
// MY INFO MODULE COMPONENTS
import MyInfoPage from './components/MyInfoPage';
import MyDocumentsPage from './components/MyDocumentsPage';
import FamilySetupPage from './components/FamilySetupPage';
// SCHOOL MODULE COMPONENTS
import SchoolDashboard from './components/SchoolDashboard';
import ParentChildrenDashboard from './components/ParentChildrenDashboard';
import SchoolEnrollment from './components/SchoolEnrollment';
import SchoolFinder from './components/SchoolFinder';
import MySchoolsList from './components/MySchoolsList';
import SchoolTiles from './components/SchoolTiles';
import JournalWorldZone from './components/JournalWorldZone';
import ClassSchedule from './components/ClassSchedule';
import StudentGradebook from './components/StudentGradebook';
// WORK MODULE COMPONENTS
import WorkTriggerFlow from './components/WorkTriggerFlow';
import WorkSetupPage from './components/WorkSetupPage';
import WorkOrganizationList from './components/WorkOrganizationList';
import WorkOrganizationProfile from './components/WorkOrganizationProfile';
import WorkSearchOrganizations from './components/WorkSearchOrganizations';
import WorkJoinRequests from './components/WorkJoinRequests';
import WorkOrganizationPublicProfile from './components/WorkOrganizationPublicProfile';
import WorkDepartmentNavigator from './components/WorkDepartmentNavigator';
import WorkAnnouncementsWidget from './components/WorkAnnouncementsWidget';
// SCHOOL/TEACHER COMPONENTS
import TeacherProfileForm from './components/TeacherProfileForm';
import TeacherDirectory from './components/TeacherDirectory';
import WorkAnnouncementsList from './components/WorkAnnouncementsList';
import WorkDepartmentManager from './components/WorkDepartmentManager';
import WorkDepartmentManagementPage from './components/WorkDepartmentManagementPage';
import WorkNextEventWidget from './components/WorkNextEventWidget';
import WorkUpcomingEventsList from './components/WorkUpcomingEventsList';
import WorkCalendarWidget from './components/WorkCalendarWidget';
import { 
  Clock, User, MessageCircle, Video, FileText, Settings, Search, Filter, Users,
  LogIn, UserPlus, Building2, GraduationCap, Briefcase, Shield, Eye, EyeOff,
  ChevronRight, Calendar, Heart, MapPin, Bell, Image, Grid, List, 
  Upload, FolderPlus, Download, Trash2, Newspaper, Book, 
  Building, ShoppingCart, DollarSign, Plus
} from 'lucide-react';
// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <h2>Произошла ошибка</h2>
          <p>Пожалуйста, попробуйте обновить страницу</p>
          <button 
            onClick={() => window.location.reload()} 
            style={{
              padding: '10px 20px',
              background: '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              marginTop: '20px'
            }}
          >
            Обновить страницу
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

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
        console.error('Failed to fetch user profile:', response.status);
        // Only remove token if it's actually unauthorized (401)
        if (response.status === 401) {
          localStorage.removeItem('zion_token');
        }
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      // Don't remove token on network errors, only on auth failures
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
        const profileResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (profileResponse.ok) {
          const userData = await profileResponse.json();
          setUser(userData);
        }
        
        return { success: true };
      } else {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        return { success: false, error: error.detail };
      }
    } catch (error) {
      console.error('Onboarding error:', error);
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
          <p>Добро пожаловать в WEB 4.0 - многофункциональная цифровая платформа и мессенджер!</p>
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
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo-section">
            <img src="/zion-logo.jpeg" alt="ZION.CITY Logo" className="auth-logo" />
            <h1 className="platform-logo">ZION.CITY</h1>
          </div>
          <p>Создайте аккаунт в WEB 4.0 - многофункциональная цифровая платформа и мессенджер!</p>
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
    try {
      // If user has filled any data, try to save it
      const hasData = onboardingData.work_place || onboardingData.university || onboardingData.school;
      
      if (hasData) {
        const result = await completeOnboarding(onboardingData);
        if (!result.success) {
          console.error('Onboarding error:', result.error);
          // Show error but still allow to proceed
          if (!window.confirm(`Не удалось сохранить данные: ${result.error}. Продолжить без сохранения?`)) {
            setLoading(false);
            return;
          }
        }
      }
      
      // Always complete onboarding, even if no data or save failed
      onComplete();
    } catch (error) {
      console.error('Onboarding exception:', error);
      // Allow user to proceed on error
      onComplete();
    } finally {
      setLoading(false);
    }
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
  const [notifications, setNotifications] = useState([]); // For header notifications badge
  const [userFamily, setUserFamily] = useState(null); // User's primary family
  const [activeFilters, setActiveFilters] = useState([]); // Unified stacked filters array
  const [loadingFamily, setLoadingFamily] = useState(true);
  
  // Work Module State
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(null);
  const [workSetupMode, setWorkSetupMode] = useState('choice'); // 'choice', 'search', 'create'
  const [activeDepartmentId, setActiveDepartmentId] = useState(null);
  const [showDepartmentManager, setShowDepartmentManager] = useState(false);
  const [departmentRefreshTrigger, setDepartmentRefreshTrigger] = useState(0);
  
  // Setup window function for opening full department management
  useEffect(() => {
    window.openDepartmentManagement = () => {
      setActiveView('work-department-management');
    };
    return () => {
      delete window.openDepartmentManagement;
    };
  }, []);
  const [viewingPublicOrgId, setViewingPublicOrgId] = useState(null); // For public profile view
  
  // Journal/School Module State
  const [schoolRoles, setSchoolRoles] = useState(null);
  const [loadingSchoolRoles, setLoadingSchoolRoles] = useState(true);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [schoolRole, setSchoolRole] = useState(null); // 'parent' or 'teacher'
  
  // Removed showProfileCompletionModal state - now using full-page FamilySetupPage
  const [showGenderModal, setShowGenderModal] = useState(false);
  
  const { user, logout, refreshProfile } = useAuth();

  // Load user's primary family
  useEffect(() => {
    const loadUserFamily = async () => {
      console.log('[DEBUG] loadUserFamily called', { user: !!user, activeModule });
      
      if (!user || activeModule !== 'family') {
        console.log('[DEBUG] Skipping family load:', { user: !!user, activeModule });
        setLoadingFamily(false);
        return;
      }
      
      try {
        const token = localStorage.getItem('zion_token');
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/family-profiles`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        console.log('[DEBUG] Family API response status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('[DEBUG] Family data received:', data);
          const families = data.family_profiles || [];
          console.log('[DEBUG] Families count:', families.length);
          // Find primary family (where user is creator or first family)
          const primaryFamily = families.find(f => f.user_role === 'PARENT' || f.is_user_member) || families[0];
          console.log('[DEBUG] Primary family selected:', primaryFamily);
          setUserFamily(primaryFamily);
        }
      } catch (error) {
        console.error('[DEBUG] Error loading family:', error);
      } finally {
        setLoadingFamily(false);
      }
    };
    
    loadUserFamily();
  }, [user, activeModule]);

  // Removed automatic profile completion modal - user will access via МОЯ СЕМЬЯ button
  // Family profile creation now happens on-demand when clicking МОЯ СЕМЬЯ

  // Check if user needs to set gender (MANDATORY first time, never again after set)
  useEffect(() => {
    if (user) {
      const hasAskedGender = localStorage.getItem(`gender_asked_${user.id}`);
      
      // Only show modal if gender is not set AND we haven't asked before
      // Once user sets gender, user.gender will exist and modal never shows again
      if (!user.gender && !hasAskedGender) {
        setShowGenderModal(true);
      } else {
        setShowGenderModal(false);
      }
    }
  }, [user]);

  // Check if user needs onboarding (no affiliations and not yet completed)
  // TEMPORARILY DISABLED - Will re-enable later
  useEffect(() => {
    if (user) {
      // ONBOARDING DISABLED FOR NOW
      setShowOnboarding(false);
      
      // Original logic (commented out for now):
      // const onboardingCompleted = localStorage.getItem(`onboarding_completed_${user.id}`);
      // if (!onboardingCompleted && (!user.affiliations || user.affiliations.length === 0)) {
      //   setShowOnboarding(true);
      // } else {
      //   setShowOnboarding(false);
      // }
    }
  }, [user]);

  // Set appropriate view when switching to Work module
  useEffect(() => {
    if (activeModule === 'organizations') {
      setActiveView('my-work');
    }
  }, [activeModule]);

  // Fetch school roles when journal module is active
  useEffect(() => {
    const fetchSchoolRoles = async () => {
      if (activeModule === 'journal' && user) {
        try {
          setLoadingSchoolRoles(true);
          const token = localStorage.getItem('zion_token');
          const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/users/me/school-roles`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const roles = await response.json();
            setSchoolRoles(roles);
            
            // Reset selection when switching to journal
            setSelectedSchool(null);
            setSchoolRole(null);
            
            // Auto-select first school if only one exists
            if (roles.is_parent && !roles.is_teacher && roles.schools_as_parent.length === 1) {
              setSelectedSchool(roles.schools_as_parent[0]);
              setSchoolRole('parent');
              setActiveView('journal-dashboard');
            } else if (!roles.is_parent && roles.is_teacher && roles.schools_as_teacher.length === 1) {
              setSelectedSchool(roles.schools_as_teacher[0]);
              setSchoolRole('teacher');
              setActiveView('journal-dashboard');
            } else {
              // Multiple schools or both roles - show selection screen
              setActiveView('journal-role-select');
            }
          }
        } catch (error) {
          console.error('Error fetching school roles:', error);
        } finally {
          setLoadingSchoolRoles(false);
        }
      }
    };
    
    fetchSchoolRoles();
  }, [activeModule, user]);

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
        
        // Convert nested structure to simple counts
        const simpleCounts = {};
        let totalCount = 0;
        
        // Backend to Frontend module mapping
        const backendToFrontendModuleMap = {
          'family': 'family',
          'community': 'news',
          'personal': 'journal',
          'business': 'services',
          'work': 'organizations',
          'education': 'journal',
          'health': 'journal',
          'government': 'organizations'
        };
        
        // Initialize all frontend modules with 0
        const frontendModules = ['family', 'news', 'journal', 'services', 'organizations', 'marketplace', 'finance', 'events'];
        frontendModules.forEach(module => {
          simpleCounts[module] = 0;
        });
        
        // Count files from backend modules
        if (data.modules) {
          Object.entries(data.modules).forEach(([backendModule, moduleData]) => {
            const frontendModule = backendToFrontendModuleMap[backendModule] || backendModule;
            const moduleCount = (moduleData.images?.length || 0) + 
                              (moduleData.documents?.length || 0) + 
                              (moduleData.videos?.length || 0);
            
            if (simpleCounts.hasOwnProperty(frontendModule)) {
              simpleCounts[frontendModule] += moduleCount;
            }
            totalCount += moduleCount;
          });
        }
        
        // Set total count
        simpleCounts['all'] = totalCount;
        
        setMediaStats(simpleCounts);
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

  const handleUpdateUser = (updatedUserData) => {
    // Update user context with new data
    // This would be handled by your auth context
  };

  if (showOnboarding) {
    return <OnboardingWizard onComplete={async () => {
      // Mark onboarding as completed for this user
      if (user?.id) {
        localStorage.setItem(`onboarding_completed_${user.id}`, 'true');
      }
      // Wait a tick to ensure localStorage is written
      await new Promise(resolve => setTimeout(resolve, 100));
      setShowOnboarding(false);
    }} />;
  }

  const modules = [
    { key: 'family', name: 'Семья', color: '#30A67E' },
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

  // Enhanced sidebar tint with vibrant module colors
  const sidebarTintStyle = {
    background: `linear-gradient(135deg, ${currentModule.color}18 0%, ${currentModule.color}0A 50%, ${currentModule.color}15 100%)`,
    borderColor: `${currentModule.color}25`,
    color: currentModule.color, // For ::before pseudo-element
  };

  const getUserAffiliationsByType = (type) => {
    if (!user.affiliations) return [];
    return user.affiliations.filter(a => a.affiliation.type === type);
  };

  return (
    <div className="app">
      {/* Top Navigation Bar with Dynamic Module Colors */}
      <nav className="top-nav" style={{ color: currentModule.color }}>
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
                onClick={() => {
                  setActiveModule(module.key);
                  // Set appropriate view for Work module
                  if (module.key === 'organizations') {
                    setActiveView('my-work');
                  } else {
                    setActiveView('wall');
                  }
                }}
                style={{
                  color: activeModule === module.key ? 'white' : module.color,
                  backgroundColor: activeModule === module.key ? module.color : undefined,
                  borderColor: `${module.color}20`
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
          
          {/* User Profile Section - Professional Design */}
          <div className="user-profile-section">
            <div className="profile-card-enhanced">
              {/* Profile Avatar with Image or Fallback */}
              <div className="profile-avatar-large">
                {user.profile_picture ? (
                  <img 
                    src={user.profile_picture} 
                    alt={`${user.first_name} ${user.last_name}`}
                    className="avatar-image"
                  />
                ) : (
                  <div 
                    className="avatar-placeholder" 
                    style={{ backgroundColor: currentModule.color }}
                  >
                    <User size={70} color="white" strokeWidth={2.5} />
                  </div>
                )}
                <div className="status-indicator online"></div>
              </div>
              
              {/* Profile Info */}
              <div className="profile-info-enhanced">
                <h4 className="profile-name">
                  {user.name_alias || `${user.first_name} ${user.last_name}`}
                </h4>
                <p className="profile-email">@{user.email.split('@')[0]}</p>
              </div>
            </div>
            
            <button 
              className={`profile-btn ${activeView === 'my-profile' ? 'primary' : 'secondary'}`}
              style={{ 
                backgroundColor: activeView === 'my-profile' ? currentModule.color : undefined,
                background: activeView === 'my-profile' 
                  ? `linear-gradient(135deg, ${currentModule.color} 0%, ${currentModule.color}dd 100%)`
                  : undefined,
                color: activeView === 'my-profile' ? 'white' : undefined
              }}
              onClick={() => setActiveView('my-profile')}
            >
              <User size={18} />
              <span>Мой Профиль</span>
            </button>
            
            {/* Generic "Моя Лента" button - only show for modules WITHOUT their own feed button */}
            {activeModule !== 'organizations' && activeModule !== 'journal' && (
              <button 
                className={`profile-btn ${activeView === 'feed' ? 'primary' : 'secondary'}`}
                style={{ 
                  backgroundColor: activeView === 'feed' ? currentModule.color : undefined,
                  background: activeView === 'feed' 
                    ? `linear-gradient(135deg, ${currentModule.color} 0%, ${currentModule.color}dd 100%)`
                    : undefined,
                  color: activeView === 'feed' ? 'white' : undefined
                }}
                onClick={() => setActiveView('feed')}
              >
                <Newspaper size={18} />
                <span>Моя Лента</span>
              </button>
            )}
            
            {/* Family Section - Always visible in Family module */}
            {activeModule === 'family' && (
              <>
                <div className="sidebar-divider" style={{ background: `linear-gradient(90deg, transparent, ${currentModule.color}30, transparent)` }}></div>
                
                <button 
                  className={`profile-btn ${activeView === 'my-family-profile' ? 'primary' : 'secondary'}`}
                  style={{ 
                    backgroundColor: activeView === 'my-family-profile' ? '#059669' : undefined,
                    background: activeView === 'my-family-profile' 
                      ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                      : undefined,
                    color: activeView === 'my-family-profile' ? 'white' : undefined
                  }}
                  onClick={() => setActiveView('my-family-profile')}
                >
                  <Heart size={18} />
                  <span>МОЯ СЕМЬЯ</span>
                </button>
                
                <div className="sidebar-divider" style={{ background: `linear-gradient(90deg, transparent, ${currentModule.color}30, transparent)` }}></div>
              </>
            )}
            
            {/* Work & School Section - ORGANIZATIONS (Administrative) */}
            {activeModule === 'organizations' && (
              <>
                <div className="sidebar-divider" style={{ background: 'linear-gradient(90deg, transparent, rgba(194, 65, 12, 0.3), transparent)' }}></div>
                
                <button 
                  className={`profile-btn ${(activeView === 'wall' || activeView === 'feed') ? 'primary' : 'secondary'}`}
                  style={{ 
                    backgroundColor: (activeView === 'wall' || activeView === 'feed') ? '#C2410C' : undefined,
                    background: (activeView === 'wall' || activeView === 'feed')
                      ? 'linear-gradient(135deg, #C2410C 0%, #EA580C 100%)'
                      : undefined,
                    color: (activeView === 'wall' || activeView === 'feed') ? 'white' : undefined
                  }}
                  onClick={() => setActiveView('wall')}
                >
                  <Newspaper size={18} />
                  <span>МОЯ ЛЕНТА</span>
                </button>
                
                <div className="sidebar-divider" style={{ background: 'linear-gradient(90deg, transparent, rgba(194, 65, 12, 0.3), transparent)' }}></div>
                
                <button 
                  className={`profile-btn ${activeView === 'my-work' ? 'primary' : 'secondary'}`}
                  style={{ 
                    backgroundColor: activeView === 'my-work' ? '#C2410C' : undefined,
                    background: activeView === 'my-work' 
                      ? 'linear-gradient(135deg, #C2410C 0%, #EA580C 100%)'
                      : undefined,
                    color: activeView === 'my-work' ? 'white' : undefined
                  }}
                  onClick={() => setActiveView('my-work')}
                >
                  <Briefcase size={18} />
                  <span>МОЯ РАБОТА</span>
                </button>
                
                <button 
                  className={`profile-btn ${activeView === 'my-school-admin' ? 'primary' : 'secondary'}`}
                  style={{ 
                    backgroundColor: activeView === 'my-school-admin' ? '#1E40AF' : undefined,
                    background: activeView === 'my-school-admin' 
                      ? 'linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%)'
                      : undefined,
                    color: activeView === 'my-school-admin' ? 'white' : undefined
                  }}
                  onClick={() => setActiveView('my-school-admin')}
                >
                  <GraduationCap size={18} />
                  <span>МОЯ ШКОЛА</span>
                </button>
                
                <div className="sidebar-divider"></div>
              </>
            )}

            {/* Journal/School Section - Always visible in Journal module */}
            {activeModule === 'journal' && !loadingSchoolRoles && schoolRoles && (
              <>
                <div className="sidebar-divider" style={{ background: 'linear-gradient(90deg, transparent, rgba(109, 40, 217, 0.3), transparent)' }}></div>
                
                <button 
                  className={`profile-btn ${(activeView === 'wall' || activeView === 'feed') ? 'primary' : 'secondary'}`}
                  style={{ 
                    backgroundColor: (activeView === 'wall' || activeView === 'feed') ? '#6D28D9' : undefined,
                    background: (activeView === 'wall' || activeView === 'feed')
                      ? 'linear-gradient(135deg, #6D28D9 0%, #7C3AED 100%)'
                      : undefined,
                    color: (activeView === 'wall' || activeView === 'feed') ? 'white' : undefined
                  }}
                  onClick={() => setActiveView('wall')}
                >
                  <Newspaper size={18} />
                  <span>МОЯ ЛЕНТА</span>
                </button>
                
                <div className="sidebar-divider" style={{ background: 'linear-gradient(90deg, transparent, rgba(109, 40, 217, 0.3), transparent)' }}></div>
                
                {/* MY SCHOOL button for parents */}
                {schoolRoles.is_parent && (
                  <button 
                    className={`profile-btn ${schoolRole === 'parent' ? 'primary' : 'secondary'}`}
                    style={{ 
                      backgroundColor: schoolRole === 'parent' ? '#6D28D9' : undefined,
                      background: schoolRole === 'parent' 
                        ? 'linear-gradient(135deg, #6D28D9 0%, #7C3AED 100%)'
                        : undefined,
                      color: schoolRole === 'parent' ? 'white' : undefined
                    }}
                    onClick={() => {
                      setSchoolRole('parent');
                      setSelectedSchool(null);
                      setActiveView('journal-school-tiles');
                    }}
                  >
                    <GraduationCap size={18} />
                    <span>МОЯ ШКОЛА</span>
                  </button>
                )}
                
                {/* MY WORK button for teachers */}
                {schoolRoles.is_teacher && (
                  <button 
                    className={`profile-btn ${schoolRole === 'teacher' ? 'primary' : 'secondary'}`}
                    style={{ 
                      backgroundColor: schoolRole === 'teacher' ? '#6D28D9' : undefined,
                      background: schoolRole === 'teacher' 
                        ? 'linear-gradient(135deg, #6D28D9 0%, #7C3AED 100%)'
                        : undefined,
                      color: schoolRole === 'teacher' ? 'white' : undefined
                    }}
                    onClick={() => {
                      setSchoolRole('teacher');
                      setSelectedSchool(null);
                      setActiveView('journal-school-tiles');
                    }}
                  >
                    <Briefcase size={18} />
                    <span>МОЯ РАБОТА</span>
                  </button>
                )}
                
                <div className="sidebar-divider"></div>
              </>
            )}
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

            {/* MY INFO Module */}
            <div className="nav-group">
              <div className="nav-group-label">МОЯ ИНФОРМАЦИЯ</div>
              <a 
                href="#" 
                className={`nav-item ${activeView === 'my-info' ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveView('my-info');
                }}
              >
                <User size={20} />
                <span>Профиль</span>
              </a>
              <a 
                href="#" 
                className={`nav-item ${activeView === 'my-documents' ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveView('my-documents');
                }}
              >
                <FileText size={20} />
                <span>Документы</span>
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
                <div className="header-left">
                  {/* Modern Pill Badge for Module */}
                  <span 
                    className="module-pill" 
                    style={{ 
                      background: `linear-gradient(135deg, ${currentModule.color} 0%, ${currentModule.color}dd 100%)`,
                      boxShadow: `0 4px 12px ${currentModule.color}30, 0 1px 3px ${currentModule.color}20`
                    }}
                  >
                    {currentModule.name}
                  </span>
                  
                  {/* Current View with Arrow */}
                  {activeView && activeView !== 'wall' && activeView !== 'feed' && (
                    <>
                      <ChevronRight size={16} className="view-separator" />
                      <span className="current-view">
                        {activeView === 'photos' && 'Фото'}
                        {activeView === 'videos' && 'Видео'}
                        {activeView === 'documents' && 'Документы'}
                        {activeView === 'calendar' && 'Календарь'}
                        {activeView === 'my-info' && 'Моя Информация'}
                        {activeView === 'my-documents' && 'Мои Документы'}
                        {!['photos', 'videos', 'documents', 'calendar', 'my-info', 'my-documents', 'feed'].includes(activeView) && 'Стена'}
                      </span>
                    </>
                  )}
                  {(!activeView || activeView === 'wall') && (
                    <>
                      <ChevronRight size={16} className="view-separator" />
                      <span className="current-view">Стена</span>
                    </>
                  )}
                  {activeView === 'feed' && (
                    <>
                      <ChevronRight size={16} className="view-separator" />
                      <span className="current-view">Моя Лента</span>
                    </>
                  )}
                </div>
                
                <div className="header-right">
                  {/* Quick Actions */}
                  <button 
                    className="header-action-btn"
                    onClick={() => {/* Add search functionality */}}
                    title="Поиск"
                  >
                    <Search size={18} />
                  </button>
                  <button 
                    className="header-action-btn primary"
                    onClick={() => {
                      // TODO: Open post creation modal
                      console.log('Create post clicked');
                    }}
                    title="Создать пост"
                    style={{ 
                      background: `linear-gradient(135deg, ${currentModule.color} 0%, ${currentModule.color}dd 100%)`,
                      color: 'white'
                    }}
                  >
                    <Plus size={18} />
                  </button>
                  <button 
                    className="header-action-btn"
                    onClick={() => {/* Show notifications */}}
                    title="Уведомления"
                  >
                    <Bell size={18} />
                    {notifications.length > 0 && (
                      <span className="notification-badge">{notifications.length}</span>
                    )}
                  </button>
                </div>
              </div>
              
              <div className="content-body">
                {/* Content Navigation - Hide for special views that have their own navigation */}
                {!['my-family-profile', 'family-public-view', 'my-info', 'my-documents', 'media-photos', 'media-documents', 'media-videos'].includes(activeView) && (
                  <ContentNavigation
                    activeView={activeView}
                    onViewChange={setActiveView}
                    moduleColor={currentModule.color}
                    moduleName={currentModule.name}
                    showCalendar={showCalendar}
                    onCalendarToggle={() => setShowCalendar(!showCalendar)}
                  />
                )}

                {/* Content Area with Split Layout */}
                <div className="split-content-layout">
                  {/* Main Content Area */}
                  <div className={`main-content-area ${(activeView === 'my-profile' || activeView === 'media-photos' || activeView === 'media-documents' || activeView === 'media-videos' || activeView === 'school-my-children' || activeView === 'school-enrollment' || activeView === 'school-find' || activeView === 'family-profiles' || activeView === 'family-create' || activeView === 'family-view' || activeView === 'family-invitations' || activeView === 'my-info' || activeView === 'my-documents' || activeModule === 'organizations') ? 'full-width' : ''}`}>
                    
                    {/* Family Profile Views - Full Width */}
                    {activeView === 'family-profiles' ? (
                      <FamilyProfileList
                        onCreateFamily={() => setActiveView('family-create')}
                        onViewFamily={(familyId) => {
                          setSelectedFamilyId(familyId);
                          setActiveView('family-view');
                        }}
                        onManageFamily={(familyId) => {
                          setSelectedFamilyId(familyId);
                          setActiveView('family-manage');
                        }}
                      />
                    ) : activeView === 'family-create' ? (
                      <FamilyProfileCreation
                        onBack={() => setActiveView('family-profiles')}
                        onFamilyCreated={() => setActiveView('family-profiles')}
                      />
                    ) : activeView === 'family-view' ? (
                      <FamilyProfilePage
                        familyId={selectedFamilyId}
                        currentUser={user}
                        onBack={() => setActiveView('family-profiles')}
                        onInviteMember={(familyId, familyName) => {
                          setSelectedFamilyForInvitation({ id: familyId, name: familyName });
                          setShowInvitationModal(true);
                        }}
                      />
                    ) : activeView === 'family-invitations' ? (
                      <InvitationManager
                        currentUser={user}
                      />
                    ) : /* MY PROFILE - Dynamic Profile View */
                    activeView === 'my-profile' ? (
                      <MyProfile 
                        user={user} 
                        activeModule={activeModule}
                        moduleColor={currentModule.color}
                      />
                    ) : /* Media Storage Views - Full Width */
                    (activeView === 'media-photos' || activeView === 'media-documents' || activeView === 'media-videos') ? (
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
                    ) : /* SCHOOL Module Views - Full Width */
                    activeView === 'school-my-children' ? (
                      <ParentChildrenDashboard />
                    ) : activeView === 'school-enrollment' ? (
                      <SchoolEnrollment />
                    ) : activeView === 'school-find' ? (
                      <SchoolFinder />
                    ) : /* MY INFO Module Views */
                    activeView === 'my-info' ? (
                      <MyInfoPage 
                        user={user} 
                        moduleColor={currentModule.color} 
                        onProfileUpdate={refreshProfile}
                      />
                    ) : activeView === 'my-documents' ? (
                      <MyDocumentsPage />
                    ) : (
                      <>
                        {activeModule === 'family' && (
                          <>
                            {/* Feed and Wall views - show UniversalWall only */}
                            {(activeView === 'wall' || activeView === 'feed') ? (
                              <UniversalWall
                                activeGroup={activeGroup}
                                moduleColor={currentModule.color}
                                moduleName={currentModule.name}
                                activeModule={activeModule}
                                user={user}
                                activeFilters={activeFilters}
                                userFamilyId={userFamily?.id}
                              />
                            ) : activeView === 'my-family-profile' ? (
                              /* My Family Profile view - or setup if no family */
                              <ErrorBoundary>
                                {userFamily ? (
                                  <MyFamilyProfile
                                    user={user}
                                    familyData={userFamily}
                                    moduleColor={currentModule.color}
                                  />
                                ) : (
                                  <FamilySetupPage
                                    user={user}
                                    onBack={() => setActiveView('wall')}
                                    onComplete={async (newFamily) => {
                                      // Refresh family data
                                      setUserFamily(newFamily);
                                      // Refresh user profile
                                      await refreshProfile();
                                      // Stay on family profile view
                                      setActiveView('my-family-profile');
                                    }}
                                  />
                                )}
                              </ErrorBoundary>
                            ) : activeView === 'family-public-view' ? (
                              /* Public Family Profile view */
                              <ErrorBoundary>
                                <PublicFamilyProfile
                                  user={user}
                                  familyId={userFamily?.id}
                                  onBack={() => setActiveView('my-family-profile')}
                                  moduleColor={currentModule.color}
                                />
                              </ErrorBoundary>
                            ) : (
                              /* Chat view */
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
                            {/* MY WORK View */}
                            {activeView === 'my-work' ? (
                              <ErrorBoundary>
                                <WorkOrganizationList
                                  onOrgClick={(orgId) => {
                                    console.log('WorkOrganizationList onOrgClick called with orgId:', orgId);
                                    setSelectedOrganizationId(orgId);
                                    setActiveView('work-org-profile');
                                  }}
                                  onCreateNew={() => {
                                    setWorkSetupMode('choice');
                                    setActiveView('work-setup');
                                  }}
                                  onJoinOrg={() => {
                                    setActiveView('work-search');
                                  }}
                                  onViewRequests={() => {
                                    setActiveView('work-requests');
                                  }}
                                  onExploreFeed={() => setActiveView('feed')}
                                />
                              </ErrorBoundary>
                            ) : activeView === 'work-search' ? (
                              <ErrorBoundary>
                                <WorkSearchOrganizations
                                  onBack={() => setActiveView('my-work')}
                                  onViewProfile={(orgId) => {
                                    setViewingPublicOrgId(orgId);
                                    setActiveView('work-org-public-view');
                                  }}
                                  onJoinSuccess={(orgId) => {
                                    setSelectedOrganizationId(orgId);
                                    setActiveView('work-org-profile');
                                  }}
                                />
                              </ErrorBoundary>
                            ) : activeView === 'work-org-public-view' ? (
                              <ErrorBoundary>
                                <WorkOrganizationPublicProfile
                                  organizationId={viewingPublicOrgId}
                                  currentUserId={user?.id}
                                  onBack={() => setActiveView('work-search')}
                                  moduleColor={currentModule.color}
                                />
                              </ErrorBoundary>
                            ) : activeView === 'work-requests' ? (
                              <ErrorBoundary>
                                <WorkJoinRequests
                                  onBack={() => setActiveView('my-work')}
                                  onViewProfile={(orgId) => {
                                    setSelectedOrganizationId(orgId);
                                    setActiveView('work-org-profile');
                                  }}
                                />
                              </ErrorBoundary>
                            ) : activeView === 'work-setup' ? (
                              <ErrorBoundary>
                                <WorkSetupPage
                                  initialMode={workSetupMode}
                                  onBack={() => setActiveView('my-work')}
                                  onComplete={() => setActiveView('my-work')}
                                  onJoinRequest={(orgId) => {
                                    setSelectedOrganizationId(orgId);
                                    setActiveView('my-work');
                                  }}
                                />
                              </ErrorBoundary>
                            ) : activeView === 'work-trigger' ? (
                              <ErrorBoundary>
                                <WorkTriggerFlow
                                  onCreateOrg={() => {
                                    setWorkSetupMode('create');
                                    setActiveView('work-setup');
                                  }}
                                  onJoinOrg={() => {
                                    setActiveView('work-search');
                                  }}
                                />
                              </ErrorBoundary>
                            ) : activeView === 'work-org-profile' ? (
                              <ErrorBoundary>
                                <WorkOrganizationProfile
                                  organizationId={selectedOrganizationId}
                                  onBack={() => setActiveView('my-work')}
                                  onInviteMember={(orgId, orgName) => {
                                    // TODO: Open invite modal
                                    alert(`Invite members to ${orgName} (Coming soon)`);
                                  }}
                                  onSettings={(orgId) => {
                                    // TODO: Navigate to settings
                                    alert('Organization settings (Coming soon)');
                                  }}
                                />
                              </ErrorBoundary>
                            ) : activeView === 'work-announcements' ? (
                              <ErrorBoundary>
                                <WorkAnnouncementsList
                                  organizationId={selectedOrganizationId}
                                  onBack={() => setActiveView('wall')}
                                  currentUserId={user?.id}
                                  moduleColor={currentModule.color}
                                />
                              </ErrorBoundary>
                            ) : activeView === 'work-department-management' ? (
                              <ErrorBoundary>
                                <WorkDepartmentManagementPage
                                  organizationId={selectedOrganizationId}
                                  onBack={() => setActiveView('wall')}
                                  moduleColor={currentModule.color}
                                />
                              </ErrorBoundary>
                            ) : activeView === 'my-school' ? (
                              <ErrorBoundary>
                                <SchoolDashboard
                                  onViewChildren={() => setActiveView('school-my-children')}
                                  onFindSchool={() => setActiveView('school-find')}
                                  onEnrollmentRequest={() => setActiveView('school-enrollment')}
                                  onViewMySchools={() => setActiveView('school-my-schools')}
                                />
                              </ErrorBoundary>
                            ) : activeView === 'school-my-children' ? (
                              <ErrorBoundary>
                                <ParentChildrenDashboard />
                              </ErrorBoundary>
                            ) : activeView === 'school-find' ? (
                              <ErrorBoundary>
                                <SchoolFinder />
                              </ErrorBoundary>
                            ) : activeView === 'school-enrollment' ? (
                              <ErrorBoundary>
                                <SchoolEnrollment />
                              </ErrorBoundary>
                            ) : activeView === 'school-my-schools' ? (
                              <ErrorBoundary>
                                <MySchoolsList 
                                  onBack={() => setActiveView('my-school')}
                                  onSchoolClick={(schoolId) => {
                                    // Future: Navigate to school details
                                    console.log('School clicked:', schoolId);
                                  }}
                                />
                              </ErrorBoundary>
                            ) : activeView === 'my-school-admin' ? (
                              <ErrorBoundary>
                                <SchoolDashboard
                                  onViewChildren={() => setActiveView('school-my-children')}
                                  onFindSchool={() => setActiveView('school-find')}
                                  onEnrollmentRequest={() => setActiveView('school-enrollment')}
                                  onViewMySchools={() => setActiveView('school-my-schools')}
                                />
                              </ErrorBoundary>
                            ) : activeView === 'school-my-children' ? (
                              <ErrorBoundary>
                                <ParentChildrenDashboard />
                              </ErrorBoundary>
                            ) : activeView === 'school-find' ? (
                              <ErrorBoundary>
                                <SchoolFinder />
                              </ErrorBoundary>
                            ) : activeView === 'school-enrollment' ? (
                              <ErrorBoundary>
                                <SchoolEnrollment />
                              </ErrorBoundary>
                            ) : (activeView === 'wall' || activeView === 'feed') ? (
                              <UniversalWall
                                activeGroup={activeGroup}
                                moduleColor={currentModule.color}
                                moduleName={currentModule.name}
                                activeModule={activeModule}
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
                            {(activeView === 'wall' || activeView === 'feed') ? (
                              <UniversalWall
                                activeGroup={activeGroup}
                                moduleColor={currentModule.color}
                                moduleName={currentModule.name}
                                activeModule={activeModule}
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

                        {/* JOURNAL MODULE - School Management */}
                        {activeModule === 'journal' && (
                          <>
                            {loadingSchoolRoles ? (
                              <div className="loading-state">
                                <p>Загрузка информации о школах...</p>
                              </div>
                            ) : !schoolRoles ? (
                              <div className="empty-state-large">
                                <p>Не удалось загрузить информацию о школах</p>
                              </div>
                            ) : (activeView === 'wall' || activeView === 'feed') ? (
                              <UniversalWall
                                activeGroup={activeGroup}
                                moduleColor={currentModule.color}
                                moduleName={currentModule.name}
                                user={user}
                                activeModule="journal"
                                schoolRoles={schoolRoles}
                              />
                            ) : activeView === 'journal-role-select' ? (
                              <div className="journal-role-select">
                                <h2>Выберите Роль</h2>
                                <p>Вы являетесь и родителем, и учителем. Выберите роль для продолжения.</p>
                                <div className="role-selection-buttons">
                                  {schoolRoles.is_parent && (
                                    <button 
                                      className="role-select-btn"
                                      onClick={() => {
                                        setSchoolRole('parent');
                                        setActiveView('journal-school-tiles');
                                      }}
                                    >
                                      <GraduationCap size={32} />
                                      <h3>Как Родитель</h3>
                                      <p>{schoolRoles.schools_as_parent.length} {
                                        schoolRoles.schools_as_parent.length === 1 ? 'школа' : 'школы'
                                      }</p>
                                    </button>
                                  )}
                                  {schoolRoles.is_teacher && (
                                    <button 
                                      className="role-select-btn"
                                      onClick={() => {
                                        setSchoolRole('teacher');
                                        setActiveView('journal-school-tiles');
                                      }}
                                    >
                                      <Briefcase size={32} />
                                      <h3>Как Учитель</h3>
                                      <p>{schoolRoles.schools_as_teacher.length} {
                                        schoolRoles.schools_as_teacher.length === 1 ? 'школа' : 'школы'
                                      }</p>
                                    </button>
                                  )}
                                </div>
                              </div>
                            ) : activeView === 'journal-school-tiles' ? (
                              <ErrorBoundary>
                                <SchoolTiles
                                  schools={schoolRole === 'parent' ? schoolRoles.schools_as_parent : schoolRoles.schools_as_teacher}
                                  role={schoolRole}
                                  onSchoolSelect={(school) => {
                                    setSelectedSchool(school);
                                    setActiveView('journal-dashboard');
                                  }}
                                />
                              </ErrorBoundary>
                            ) : activeView === 'journal-dashboard' ? (
                              <div className="journal-dashboard-placeholder">
                                <h2>Журнал - {selectedSchool?.organization_name}</h2>
                                <p>Выберите раздел из навигации справа (WORLD ZONE)</p>
                              </div>
                            ) : activeView === 'journal-schedule' ? (
                              <ErrorBoundary>
                                <ClassSchedule
                                  selectedSchool={selectedSchool}
                                  role={schoolRole}
                                  onBack={() => setActiveView('journal-dashboard')}
                                />
                              </ErrorBoundary>
                            ) : activeView === 'journal-journal' || activeView === 'journal-gradebook' ? (
                              <ErrorBoundary>
                                <StudentGradebook
                                  selectedSchool={selectedSchool}
                                  role={schoolRole}
                                  onBack={() => setActiveView('journal-dashboard')}
                                />
                              </ErrorBoundary>
                            ) : (
                              <div className="journal-content-placeholder">
                                <p>Выберите раздел из WORLD ZONE</p>
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>

                  {/* Right Sidebar - Events Panel or Journal World Zone */}
                  {activeModule === 'journal' && selectedSchool ? (
                    <div className="world-zone-area">
                      <JournalWorldZone
                        selectedSchool={selectedSchool}
                        role={schoolRole}
                        onNavigate={(view) => {
                          if (view === 'school-list') {
                            setSelectedSchool(null);
                            setActiveView('journal-school-tiles');
                          } else {
                            setActiveView(`journal-${view}`);
                          }
                        }}
                      />
                    </div>
                  ) : !(activeView === 'my-profile' || activeView === 'media-photos' || activeView === 'media-documents' || activeView === 'media-videos' || activeView === 'family-profiles' || activeView === 'family-create' || activeView === 'family-view' || activeView === 'family-invitations' || activeView === 'my-info' || activeView === 'my-documents' || activeModule === 'organizations') && (
                    <div className="events-panel-area">
                      {/* Regular Events Panel for other views */}
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
          
          {/* WALL and FEED Views - Wall-specific widgets (Family module only) */}
          {activeModule === 'family' && (activeView === 'wall' || activeView === 'feed') && (
            <>
              {/* Search Widget */}
              <div className="widget search-widget">
                <div className="widget-header">
                  <Search size={16} />
                  <span>Поиск записей</span>
                </div>
                <input type="text" placeholder="Поиск по записям..." className="search-input" />
              </div>

              {/* Unified Post Filter Widget - Stacked Filters */}
              {activeModule === 'family' && (activeView === 'wall' || activeView === 'feed') && (
                <div className="widget unified-filter-widget">
                  <div className="widget-header">
                    <Filter size={16} />
                    <span>Фильтр постов</span>
                  </div>
                  <div className="filter-list">
                    {[
                      { id: 'all', label: 'Все посты', icon: '👁️', description: 'Показать все' },
                      { id: 'public', label: 'Публичные', icon: '🌍', description: 'Общедоступные' },
                      { id: 'my-family', label: 'Моя семья', icon: '🔒', description: 'Только семья' },
                      { id: 'subscribed', label: 'Подписки', icon: '👥', description: 'Подписанные семьи' },
                      { id: 'household', label: 'Домохозяйство', icon: '🏠', description: 'Мой дом' },
                      { id: 'gender-male', label: 'Мужчины', icon: '♂️', description: 'Только для мужчин' },
                      { id: 'gender-female', label: 'Женщины', icon: '♀️', description: 'Только для женщин' },
                      { id: 'gender-it', label: 'IT/AI', icon: '🤖', description: 'Технологии' }
                    ].map((filter) => {
                      const isActive = filter.id === 'all' 
                        ? activeFilters.length === 0 
                        : activeFilters.includes(filter.id);
                      
                      return (
                        <div
                          key={filter.id}
                          className={`filter-item ${isActive ? 'active' : ''}`}
                          onClick={() => {
                            if (filter.id === 'all') {
                              setActiveFilters([]);
                            } else {
                              setActiveFilters(prev => 
                                prev.includes(filter.id)
                                  ? prev.filter(f => f !== filter.id)
                                  : [...prev, filter.id]
                              );
                            }
                          }}
                          style={{
                            backgroundColor: isActive ? `${currentModule.color}10` : 'transparent',
                            borderLeft: isActive ? `3px solid ${currentModule.color}` : '3px solid transparent'
                          }}
                        >
                          <span className="filter-icon">{filter.icon}</span>
                          <span className="filter-label">{filter.label}</span>
                          {isActive && filter.id !== 'all' && (
                            <span className="filter-check" style={{ color: currentModule.color }}>✓</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

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

              {/* User Affiliations Widget - For WALL view */}
              {user.affiliations && user.affiliations.length > 0 && (
                <div className="widget affiliations-widget">
                  <div className="widget-header">
                    <Briefcase size={16} />
                    <span>Мои Роли</span>
                  </div>
                  <div className="affiliations-list">
                    {user.affiliations.slice(0, 5).map((affiliation) => (
                      <div key={affiliation.id} className="affiliation-item">
                        <div className="affiliation-icon" style={{ backgroundColor: currentModule.color }}>
                          <Building size={14} color="white" />
                        </div>
                        <div className="affiliation-info">
                          <span className="affiliation-name">{affiliation.affiliation.name}</span>
                          <span className="affiliation-role">{affiliation.user_role_in_org}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Public View Button - Only when viewing "МОЯ СЕМЬЯ" */}
          {activeModule === 'family' && userFamily && activeView === 'my-family-profile' && (
            <div className="widget public-view-widget">
              <div className="widget-header">
                <Eye size={16} />
                <span>Публичный просмотр</span>
              </div>
              <button 
                className="public-view-button"
                onClick={() => setActiveView('family-public-view')}
                style={{ 
                  backgroundColor: activeView === 'family-public-view' ? currentModule.color : 'white',
                  color: activeView === 'family-public-view' ? 'white' : currentModule.color,
                  borderColor: currentModule.color
                }}
              >
                <Eye size={18} />
                Как видят другие
              </button>
              <p className="widget-hint">Посмотрите, как ваша семья отображается для других пользователей</p>
            </div>
          )}

          {/* ORGANIZATIONS Module - Department & Announcements Widgets */}
          {/* Only show when viewing a specific organization profile, not in general feed */}
          {activeModule === 'organizations' && selectedOrganizationId && activeView === 'work-org-profile' && (
            <>
              {/* Next Event Countdown Widget */}
              <WorkNextEventWidget
                organizationId={selectedOrganizationId}
              />

              {/* Upcoming Events List Widget */}
              <WorkUpcomingEventsList
                organizationId={selectedOrganizationId}
                maxEvents={5}
              />

              {/* Calendar Widget */}
              <WorkCalendarWidget
                organizationId={selectedOrganizationId}
              />

              {/* Department Navigator Widget */}
              <WorkDepartmentNavigator
                organizationId={selectedOrganizationId}
                activeDepartmentId={activeDepartmentId}
                onDepartmentSelect={setActiveDepartmentId}
                onCreateDepartment={() => setShowDepartmentManager(true)}
                moduleColor={currentModule.color}
                refreshTrigger={departmentRefreshTrigger}
              />

              {/* Announcements Widget */}
              <WorkAnnouncementsWidget
                organizationId={selectedOrganizationId}
                departmentId={activeDepartmentId}
                onViewAll={() => {
                  setActiveView('work-announcements');
                }}
                moduleColor={currentModule.color}
              />
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
                      {selectedModuleFilter === 'all' 
                        ? Object.keys(mediaStats).filter(key => key !== 'all' && mediaStats[key] > 0).length
                        : mediaStats[selectedModuleFilter] || 0
                      }
                    </span>
                    <span className="stat-label">
                      {selectedModuleFilter === 'all' ? 'Разделов с файлами' : 'Файлов в разделе'}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-number">
                      {Object.keys(mediaStats).filter(key => key !== 'all').length}
                    </span>
                    <span className="stat-label">Всего разделов</span>
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

          {/* FAMILY PROFILE Views - Family-specific controls */}
          {(activeView === 'family-profiles' || activeView === 'family-create' || activeView === 'family-view' || activeView === 'family-invitations') && (
            <>
              {/* Family Profile Stats Widget */}
              <div className="widget family-stats-widget">
                <div className="widget-header">
                  <Users size={16} />
                  <span>Семейные профили</span>
                </div>
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-number">0</span>
                    <span className="stat-label">Мои семьи</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-number">0</span>
                    <span className="stat-label">Подписчики</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-number">0</span>
                    <span className="stat-label">Семейные посты</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-number">0</span>
                    <span className="stat-label">Приглашения</span>
                  </div>
                </div>
              </div>

              {/* Family Quick Actions Widget */}
              <div className="widget family-actions-widget">
                <div className="widget-header">
                  <span>Быстрые действия</span>
                </div>
                <div className="quick-actions-list">
                  <button 
                    className="quick-action-btn"
                    style={{ backgroundColor: currentModule.color }}
                    onClick={() => setActiveView('family-create')}
                  >
                    <UserPlus size={16} />
                    <span>Создать семью</span>
                  </button>
                  <button 
                    className="quick-action-btn"
                    onClick={() => {
                      // TODO: Open family post composer
                      console.log('Family post clicked');
                    }}
                  >
                    <MessageCircle size={16} />
                    <span>Семейный пост</span>
                  </button>
                </div>
              </div>

              {/* Family Help Widget */}
              <div className="widget family-help-widget">
                <div className="widget-header">
                  <span>Информация</span>
                </div>
                <div className="help-content">
                  <p className="help-text">
                    <strong>Семейные профили</strong> позволяют создавать отдельные страницы для каждого домохозяйства и делиться семейными новостями.
                  </p>
                  <p className="help-text">
                    Приглашайте родственников и друзей семьи для подписки на ваши обновления.
                  </p>
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

          {/* MY DOCUMENTS View - Privacy widget */}
          {activeView === 'my-documents' && (
            <>
              {/* Privacy Widget */}
              <div className="widget privacy-widget">
                <div className="widget-header" style={{ background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)' }}>
                  <div className="gadget-icon" style={{ fontSize: '1.5rem', marginRight: '8px' }}>🔒</div>
                  <span style={{ color: '#78350F', fontWeight: '700' }}>Конфиденциальность</span>
                </div>
                <div className="widget-content" style={{ padding: '16px', background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)' }}>
                  <p style={{ margin: '0 0 16px 0', fontSize: '0.875rem', lineHeight: '1.6', color: '#92400E' }}>
                    <strong style={{ display: 'block', color: '#78350F', fontWeight: '600', marginBottom: '4px', fontSize: '0.9375rem' }}>Защита данных</strong>
                    Все ваши документы надежно зашифрованы и видны только вам.
                  </p>
                  <p style={{ margin: '0 0 16px 0', fontSize: '0.875rem', lineHeight: '1.6', color: '#92400E' }}>
                    <strong style={{ display: 'block', color: '#78350F', fontWeight: '600', marginBottom: '4px', fontSize: '0.9375rem' }}>Приватность сканов</strong>
                    Скан-копии документов отображаются только в разделе "МОИ ДОКУМЕНТЫ" и не появляются в галерее фотографий.
                  </p>
                  <p style={{ margin: '0', fontSize: '0.875rem', lineHeight: '1.6', color: '#92400E' }}>
                    <strong style={{ display: 'block', color: '#78350F', fontWeight: '600', marginBottom: '4px', fontSize: '0.9375rem' }}>Контроль доступа</strong>
                    Только вы можете просматривать и управлять своими документами.
                  </p>
                </div>
              </div>
            </>
          )}

          {/* MY INFO View - Info widget */}
          {activeView === 'my-info' && (
            <>
              {/* Info Widget */}
              <div className="widget info-widget">
                <div className="widget-header" style={{ background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)' }}>
                  <div className="gadget-icon" style={{ fontSize: '1.5rem', marginRight: '8px' }}>ℹ️</div>
                  <span style={{ color: '#78350F', fontWeight: '700' }}>О Профиле</span>
                </div>
                <div className="widget-content" style={{ padding: '16px', background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)' }}>
                  <p style={{ margin: '0 0 16px 0', fontSize: '0.875rem', lineHeight: '1.6', color: '#92400E' }}>
                    <strong style={{ display: 'block', color: '#78350F', fontWeight: '600', marginBottom: '4px', fontSize: '0.9375rem' }}>Централизованные данные</strong>
                    Эта страница показывает все ваши персональные данные в одном месте.
                  </p>
                  <p style={{ margin: '0 0 16px 0', fontSize: '0.875rem', lineHeight: '1.6', color: '#92400E' }}>
                    <strong style={{ display: 'block', color: '#78350F', fontWeight: '600', marginBottom: '4px', fontSize: '0.9375rem' }}>Изменение данных</strong>
                    Для обновления адреса и семейного положения используйте модуль <strong>Семья</strong>.
                  </p>
                  <p style={{ margin: '0', fontSize: '0.875rem', lineHeight: '1.6', color: '#92400E' }}>
                    <strong style={{ display: 'block', color: '#78350F', fontWeight: '600', marginBottom: '4px', fontSize: '0.9375rem' }}>Использование</strong>
                    Ваши данные используются в 8 разделах платформы для персонализации функций.
                  </p>
                </div>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* Gender Update Modal - MANDATORY on First Login if no gender */}
      {showGenderModal && user && (
        <GenderUpdateModal
          isOpen={showGenderModal}
          onClose={() => {
            // Modal is MANDATORY - user cannot close without selecting gender
            // Do nothing on close attempt - user MUST select gender to continue
          }}
          onUpdate={async (gender) => {
            // Mark that we've asked this user for gender
            if (user?.id) {
              localStorage.setItem(`gender_asked_${user.id}`, 'true');
            }
            // Refresh user profile to get updated gender
            await refreshProfile();
            setShowGenderModal(false);
          }}
        />
      )}

      {/* Department Manager Modal */}
      {showDepartmentManager && selectedOrganizationId && (
        <WorkDepartmentManager
          organizationId={selectedOrganizationId}
          onClose={() => {
            setShowDepartmentManager(false);
            // Trigger refresh in department navigator
            setDepartmentRefreshTrigger(prev => prev + 1);
          }}
          moduleColor={currentModule.color}
        />
      )}
    </div>
  );
}

// Main App Component
function App() {
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  
  return (
    <ErrorBoundary>
      <AuthProvider>
        <div className="App">
          <AuthWrapper authMode={authMode} setAuthMode={setAuthMode} />
        </div>
      </AuthProvider>
    </ErrorBoundary>
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