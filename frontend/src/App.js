import React, { useState, useEffect } from 'react';
import './App.css';
// Auth Components - Extracted
import { AuthProvider, useAuth, ErrorBoundary, LoginForm, RegistrationForm, OnboardingWizard } from './components/auth';
// Layout Components
import { ModuleNavigation, LeftSidebar, RightSidebar } from './components/layout';
// Config
import { MODULES, getModuleByKey, getSidebarTintStyle, MODULE_DEFAULT_VIEWS, FAMILY_FILTER_OPTIONS } from './config/moduleConfig';
// Hooks
import { useJournalModule } from './hooks';
// Feature Components
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
import FamilyWorldZone from './components/FamilyWorldZone';
import MediaWorldZone from './components/MediaWorldZone';
import ChatWorldZone from './components/ChatWorldZone';
import InfoWorldZone from './components/InfoWorldZone';
import FamilyProfileWorldZone from './components/FamilyProfileWorldZone';
import AcademicCalendar from './components/AcademicCalendar';
import EventPlanner from './components/EventPlanner';
import ClassSchedule from './components/ClassSchedule';
import StudentGradebook from './components/StudentGradebook';
import MyClassesList from './components/MyClassesList';
import StudentsList from './components/StudentsList';
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
  Search, Bell, ChevronRight, Plus
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
  
  // Removed showProfileCompletionModal state - now using full-page FamilySetupPage
  const [showGenderModal, setShowGenderModal] = useState(false);
  
  const { user, logout, refreshProfile } = useAuth();

  // Journal/School Module Hook
  const {
    schoolRoles,
    loadingSchoolRoles,
    selectedSchool,
    schoolRole,
    journalSchoolFilter,
    journalAudienceFilter,
    setSelectedSchool,
    setSchoolRole,
    setJournalSchoolFilter,
    setJournalAudienceFilter
  } = useJournalModule(user, activeModule);

  // Get current module config
  const currentModule = getModuleByKey(activeModule);
  const sidebarTintStyle = getSidebarTintStyle(currentModule.color);

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

  // Set default view when entering Journal module
  useEffect(() => {
    if (activeModule === 'journal' && !loadingSchoolRoles) {
      setActiveView('wall');
    }
  }, [activeModule, loadingSchoolRoles]);

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

  const getUserAffiliationsByType = (type) => {
    if (!user.affiliations) return [];
    return user.affiliations.filter(a => a.affiliation.type === type);
  };

  return (
    <div className="app">
      {/* Top Navigation Bar - Using extracted component */}
      <ModuleNavigation
        activeModule={activeModule}
        setActiveModule={setActiveModule}
        setActiveView={setActiveView}
        user={user}
        onLogout={logout}
        currentTime={currentTime}
        showCalendar={showCalendar}
        setShowCalendar={setShowCalendar}
        setShowOnboarding={setShowOnboarding}
      />

      <div className="main-container">
        {/* Left Sidebar - Using extracted component */}
        <LeftSidebar
          activeModule={activeModule}
          activeView={activeView}
          setActiveView={setActiveView}
          user={user}
          schoolRoles={schoolRoles}
          loadingSchoolRoles={loadingSchoolRoles}
          schoolRole={schoolRole}
          setSchoolRole={setSchoolRole}
          setSelectedSchool={setSelectedSchool}
        />

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
                  <div className={`main-content-area ${(activeView === 'my-profile' || activeView === 'media-photos' || activeView === 'media-documents' || activeView === 'media-videos' || activeView === 'school-my-children' || activeView === 'school-enrollment' || activeView === 'school-find' || activeView === 'family-profiles' || activeView === 'family-create' || activeView === 'family-view' || activeView === 'family-invitations' || activeView === 'my-info' || activeView === 'my-documents' || activeModule === 'organizations' || (activeModule === 'journal' && selectedSchool) || activeView === 'event-planner' || activeView === 'journal-calendar') ? 'full-width' : ''}`}>
                    
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

                        {(activeModule === 'news' || 
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
                                journalSchoolFilter={journalSchoolFilter}
                                journalAudienceFilter={journalAudienceFilter}
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
                              /* Show EventPlanner by default when school is selected */
                              <ErrorBoundary>
                                <EventPlanner
                                  organizationId={selectedSchool?.organization_id}
                                  schoolRoles={schoolRoles}
                                  user={user}
                                  moduleColor={currentModule.color}
                                  viewType="full"
                                />
                              </ErrorBoundary>
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
                            ) : activeView === 'journal-calendar' || activeView === 'event-planner' ? (
                              <ErrorBoundary>
                                <EventPlanner
                                  organizationId={selectedSchool?.organization_id || (schoolRoles?.schools_as_teacher?.[0]?.organization_id) || (schoolRoles?.schools_as_parent?.[0]?.organization_id)}
                                  schoolRoles={schoolRoles}
                                  user={user}
                                  moduleColor={currentModule.color}
                                  viewType="full"
                                />
                              </ErrorBoundary>
                            ) : activeView === 'journal-classes' ? (
                              <ErrorBoundary>
                                <MyClassesList
                                  selectedSchool={selectedSchool}
                                  role={schoolRole}
                                  onBack={() => setActiveView('journal-dashboard')}
                                  moduleColor={currentModule.color}
                                />
                              </ErrorBoundary>
                            ) : activeView === 'journal-students' ? (
                              <ErrorBoundary>
                                <StudentsList
                                  selectedSchool={selectedSchool}
                                  role={schoolRole}
                                  onBack={() => setActiveView('journal-dashboard')}
                                  moduleColor={currentModule.color}
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

                  {/* Right Events Panel (not for journal with school selected - that uses World Zone) */}
                  {!(activeModule === 'journal' && selectedSchool) && !(activeView === 'my-profile' || activeView === 'media-photos' || activeView === 'media-documents' || activeView === 'media-videos' || activeView === 'family-profiles' || activeView === 'family-create' || activeView === 'family-view' || activeView === 'family-invitations' || activeView === 'my-info' || activeView === 'my-documents' || activeModule === 'organizations' || activeView === 'event-planner' || activeView === 'journal-calendar') && (
                    <div className="events-panel-area">
                      {/* Regular Events Panel for other views */}
                      <UniversalEventsPanel
                        activeGroup={activeGroup}
                        moduleColor={currentModule.color}
                        moduleName={currentModule.name}
                        user={user}
                        context={activeView}
                        onOpenFullCalendar={activeModule === 'journal' ? () => setActiveView('event-planner') : null}
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
          
          {/* JOURNAL Module - Feed View Filters */}
          {activeModule === 'journal' && (activeView === 'wall' || activeView === 'feed') && (
            <JournalWorldZone
              inFeedView={true}
              schoolRoles={schoolRoles}
              schoolFilter={journalSchoolFilter}
              onSchoolFilterChange={setJournalSchoolFilter}
              audienceFilter={journalAudienceFilter}
              onAudienceFilterChange={setJournalAudienceFilter}
              onOpenEventPlanner={() => setActiveView('event-planner')}
            />
          )}
          
          {/* JOURNAL Module - School Selected Navigation */}
          {activeModule === 'journal' && selectedSchool && (
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
          )}
          
          {/* WALL and FEED Views - Wall-specific widgets (Family module only) */}
          {activeModule === 'family' && (activeView === 'wall' || activeView === 'feed') && (
            <FamilyWorldZone
              moduleColor={currentModule.color}
              activeFilters={activeFilters}
              setActiveFilters={setActiveFilters}
              user={user}
            />
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
            <MediaWorldZone
              activeView={activeView}
              moduleColor={currentModule.color}
              mediaStats={mediaStats}
              selectedModuleFilter={selectedModuleFilter}
              setSelectedModuleFilter={setSelectedModuleFilter}
            />
          )}

          {/* FAMILY PROFILE Views - Family-specific controls */}
          {(activeView === 'family-profiles' || activeView === 'family-create' || activeView === 'family-view' || activeView === 'family-invitations') && (
            <FamilyProfileWorldZone
              moduleColor={currentModule.color}
              setActiveView={setActiveView}
            />
          )}

          {/* CHAT View - Chat-specific widgets */}
          {activeView === 'chat' && (
            <ChatWorldZone
              moduleColor={currentModule.color}
              chatGroups={chatGroups}
              activeGroup={activeGroup}
              handleGroupSelect={handleGroupSelect}
              handleCreateGroup={handleCreateGroup}
              user={user}
            />
          )}

          {/* MY DOCUMENTS & MY INFO Views - Info widgets */}
          {(activeView === 'my-documents' || activeView === 'my-info') && (
            <InfoWorldZone activeView={activeView} />
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