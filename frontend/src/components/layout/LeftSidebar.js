/**
 * LeftSidebar Component
 * Left sidebar with user profile and module-specific navigation
 */
import React from 'react';
import { 
  User, Newspaper, Heart, Briefcase, GraduationCap, 
  Users, MessageCircle, Image, Video, FileText, Settings, Tv,
  ShoppingCart, Package, Store, Smartphone, Shirt, Car, Home as HomeIcon, Laptop, Palette,
  Wallet, Send, TrendingUp, DollarSign, Coins
} from 'lucide-react';
import { getModuleByKey, getSidebarTintStyle } from '../../config/moduleConfig';

const LeftSidebar = ({
  activeModule,
  activeView,
  setActiveView,
  user,
  // Module-specific props
  schoolRoles,
  loadingSchoolRoles,
  schoolRole,
  setSchoolRole,
  setSelectedSchool,
  setSelectedChannelId
}) => {
  const currentModule = getModuleByKey(activeModule);
  const sidebarTintStyle = getSidebarTintStyle(currentModule.color);

  // Helper to create button style
  const getButtonStyle = (isActive, color = currentModule.color) => ({
    backgroundColor: isActive ? color : undefined,
    background: isActive 
      ? `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`
      : undefined,
    color: isActive ? 'white' : undefined
  });

  // Helper to create divider style
  const getDividerStyle = (color = currentModule.color) => ({
    background: `linear-gradient(90deg, transparent, ${color}30, transparent)`
  });

  return (
    <aside className="left-sidebar" style={sidebarTintStyle}>
      <div className="sidebar-header">
        <h3>Личный кабинет</h3>
      </div>
      
      {/* User Profile Section */}
      <div className="user-profile-section">
        <div className="profile-card-enhanced">
          {/* Profile Avatar */}
          <div className="profile-avatar-large">
            {user?.profile_picture ? (
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
              {user?.name_alias || `${user?.first_name} ${user?.last_name}`}
            </h4>
            <p className="profile-email">@{user?.email?.split('@')[0]}</p>
          </div>
        </div>
        
        {/* My Profile Button - Always visible */}
        <button 
          className={`profile-btn ${activeView === 'my-profile' ? 'primary' : 'secondary'}`}
          style={getButtonStyle(activeView === 'my-profile')}
          onClick={() => setActiveView('my-profile')}
        >
          <User size={18} />
          <span>Мой Профиль</span>
        </button>
        
        {/* Generic Feed Button - Only for modules without dedicated feed button */}
        {activeModule !== 'organizations' && activeModule !== 'journal' && activeModule !== 'news' && (
          <button 
            className={`profile-btn ${activeView === 'feed' ? 'primary' : 'secondary'}`}
            style={getButtonStyle(activeView === 'feed')}
            onClick={() => setActiveView('feed')}
          >
            <Newspaper size={18} />
            <span>Моя Лента</span>
          </button>
        )}
        
        {/* ==================== FAMILY MODULE ==================== */}
        {activeModule === 'family' && (
          <>
            <div className="sidebar-divider" style={getDividerStyle()}></div>
            
            <button 
              className={`profile-btn ${activeView === 'my-family-profile' ? 'primary' : 'secondary'}`}
              style={getButtonStyle(activeView === 'my-family-profile', '#059669')}
              onClick={() => setActiveView('my-family-profile')}
            >
              <Heart size={18} />
              <span>МОЯ СЕМЬЯ</span>
            </button>
            
            <div className="sidebar-divider" style={getDividerStyle()}></div>
          </>
        )}
        
        {/* ==================== ORGANIZATIONS MODULE ==================== */}
        {activeModule === 'organizations' && (
          <>
            <div className="sidebar-divider" style={getDividerStyle('#C2410C')}></div>
            
            <button 
              className={`profile-btn ${(activeView === 'wall' || activeView === 'feed') ? 'primary' : 'secondary'}`}
              style={getButtonStyle(activeView === 'wall' || activeView === 'feed', '#C2410C')}
              onClick={() => setActiveView('wall')}
            >
              <Newspaper size={18} />
              <span>МОЯ ЛЕНТА</span>
            </button>
            
            <div className="sidebar-divider" style={getDividerStyle('#C2410C')}></div>
            
            <button 
              className={`profile-btn ${activeView === 'my-work' ? 'primary' : 'secondary'}`}
              style={getButtonStyle(activeView === 'my-work', '#C2410C')}
              onClick={() => setActiveView('my-work')}
            >
              <Briefcase size={18} />
              <span>МОЯ РАБОТА</span>
            </button>
            
            <button 
              className={`profile-btn ${activeView === 'my-school-admin' ? 'primary' : 'secondary'}`}
              style={getButtonStyle(activeView === 'my-school-admin', '#1E40AF')}
              onClick={() => setActiveView('my-school-admin')}
            >
              <GraduationCap size={18} />
              <span>МОЯ ШКОЛА</span>
            </button>
            
            <div className="sidebar-divider"></div>
          </>
        )}

        {/* ==================== JOURNAL MODULE ==================== */}
        {activeModule === 'journal' && !loadingSchoolRoles && schoolRoles && (
          <>
            <div className="sidebar-divider" style={getDividerStyle('#6D28D9')}></div>
            
            <button 
              className={`profile-btn ${(activeView === 'wall' || activeView === 'feed') ? 'primary' : 'secondary'}`}
              style={getButtonStyle(activeView === 'wall' || activeView === 'feed', '#6D28D9')}
              onClick={() => setActiveView('wall')}
            >
              <Newspaper size={18} />
              <span>МОЯ ЛЕНТА</span>
            </button>
            
            <div className="sidebar-divider" style={getDividerStyle('#6D28D9')}></div>
            
            {/* MY SCHOOL button for parents */}
            {schoolRoles.is_parent && (
              <button 
                className={`profile-btn ${schoolRole === 'parent' ? 'primary' : 'secondary'}`}
                style={getButtonStyle(schoolRole === 'parent', '#6D28D9')}
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
                style={getButtonStyle(schoolRole === 'teacher', '#6D28D9')}
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

        {/* ==================== NEWS MODULE ==================== */}
        {activeModule === 'news' && (
          <>
            <div className="sidebar-divider" style={getDividerStyle('#1D4ED8')}></div>
            
            <button 
              className={`profile-btn ${(activeView === 'wall' || activeView === 'feed') ? 'primary' : 'secondary'}`}
              style={getButtonStyle(activeView === 'wall' || activeView === 'feed', '#1D4ED8')}
              onClick={() => {
                setActiveView('feed');
                if (setSelectedChannelId) setSelectedChannelId(null);
              }}
            >
              <Newspaper size={18} />
              <span>МОЯ ЛЕНТА</span>
            </button>
            
            <button 
              className={`profile-btn ${activeView === 'channels' ? 'primary' : 'secondary'}`}
              style={getButtonStyle(activeView === 'channels', '#1D4ED8')}
              onClick={() => {
                setActiveView('channels');
                if (setSelectedChannelId) setSelectedChannelId(null);
              }}
            >
              <Tv size={18} />
              <span>КАНАЛЫ</span>
            </button>
            
            <div className="sidebar-divider"></div>
          </>
        )}

        {/* ==================== SERVICES MODULE ==================== */}
        {activeModule === 'services' && (
          <>
            <div className="sidebar-divider" style={getDividerStyle('#B91C1C')}></div>
            
            <button 
              className={`profile-btn ${activeView === 'services-search' ? 'primary' : 'secondary'}`}
              style={getButtonStyle(activeView === 'services-search', '#B91C1C')}
              onClick={() => setActiveView('services-search')}
            >
              <span style={{ fontSize: '18px' }}>🔍</span>
              <span>ПОИСК</span>
            </button>
            
            <button 
              className={`profile-btn ${activeView === 'services-my-profile' ? 'primary' : 'secondary'}`}
              style={getButtonStyle(activeView === 'services-my-profile', '#B91C1C')}
              onClick={() => setActiveView('services-my-profile')}
            >
              <Briefcase size={18} />
              <span>МОЙ ПРОФИЛЬ</span>
            </button>
            
            <button 
              className={`profile-btn ${activeView === 'services-feed' ? 'primary' : 'secondary'}`}
              style={getButtonStyle(activeView === 'services-feed', '#B91C1C')}
              onClick={() => setActiveView('services-feed')}
            >
              <Newspaper size={18} />
              <span>МОЯ ЛЕНТА</span>
            </button>
            
            <button 
              className={`profile-btn ${activeView === 'services-bookings' ? 'primary' : 'secondary'}`}
              style={getButtonStyle(activeView === 'services-bookings', '#B91C1C')}
              onClick={() => setActiveView('services-bookings')}
            >
              <span style={{ fontSize: '18px' }}>📋</span>
              <span>МОИ ЗАЯВКИ</span>
            </button>
            
            <button 
              className={`profile-btn ${activeView === 'services-calendar' ? 'primary' : 'secondary'}`}
              style={getButtonStyle(activeView === 'services-calendar', '#B91C1C')}
              onClick={() => setActiveView('services-calendar')}
            >
              <span style={{ fontSize: '18px' }}>📅</span>
              <span>КАЛЕНДАРЬ</span>
            </button>
            
            <div className="sidebar-divider"></div>
          </>
        )}

        {/* ==================== MARKETPLACE MODULE (ВЕЩИ) ==================== */}
        {activeModule === 'marketplace' && (
          <>
            <div className="sidebar-divider" style={getDividerStyle('#BE185D')}></div>
            
            {/* MARKETPLACE Section */}
            <button 
              className={`profile-btn ${activeView === 'marketplace-search' ? 'primary' : 'secondary'}`}
              style={getButtonStyle(activeView === 'marketplace-search', '#BE185D')}
              onClick={() => setActiveView('marketplace-search')}
            >
              <Store size={18} />
              <span>МАРКЕТПЛЕЙС</span>
            </button>
            
            <div className="sidebar-divider" style={getDividerStyle('#BE185D')}></div>
            
            {/* MY THINGS Section */}
            <div className="nav-group-label" style={{ color: '#BE185D', padding: '8px 12px', fontSize: '11px' }}>
              МОИ ВЕЩИ
            </div>
            
            <button 
              className={`profile-btn ${activeView === 'my-things-smart' ? 'primary' : 'secondary'}`}
              style={getButtonStyle(activeView === 'my-things-smart', '#3B82F6')}
              onClick={() => setActiveView('my-things-smart')}
            >
              <Smartphone size={18} />
              <span>Умные Вещи</span>
            </button>
            
            <button 
              className={`profile-btn ${activeView === 'my-things-wardrobe' ? 'primary' : 'secondary'}`}
              style={getButtonStyle(activeView === 'my-things-wardrobe', '#EC4899')}
              onClick={() => setActiveView('my-things-wardrobe')}
            >
              <Shirt size={18} />
              <span>Мой Гардероб</span>
            </button>
            
            <button 
              className={`profile-btn ${activeView === 'my-things-garage' ? 'primary' : 'secondary'}`}
              style={getButtonStyle(activeView === 'my-things-garage', '#F59E0B')}
              onClick={() => setActiveView('my-things-garage')}
            >
              <Car size={18} />
              <span>Мой Гараж</span>
            </button>
            
            <button 
              className={`profile-btn ${activeView === 'my-things-home' ? 'primary' : 'secondary'}`}
              style={getButtonStyle(activeView === 'my-things-home', '#10B981')}
              onClick={() => setActiveView('my-things-home')}
            >
              <HomeIcon size={18} />
              <span>Мой Дом</span>
            </button>
            
            <button 
              className={`profile-btn ${activeView === 'my-things-electronics' ? 'primary' : 'secondary'}`}
              style={getButtonStyle(activeView === 'my-things-electronics', '#8B5CF6')}
              onClick={() => setActiveView('my-things-electronics')}
            >
              <Laptop size={18} />
              <span>Моя Электроника</span>
            </button>
            
            <button 
              className={`profile-btn ${activeView === 'my-things-collection' ? 'primary' : 'secondary'}`}
              style={getButtonStyle(activeView === 'my-things-collection', '#F97316')}
              onClick={() => setActiveView('my-things-collection')}
            >
              <Palette size={18} />
              <span>Моя Коллекция</span>
            </button>
            
            <div className="sidebar-divider" style={getDividerStyle('#BE185D')}></div>
            
            {/* User's Listings & Favorites */}
            <button 
              className={`profile-btn ${activeView === 'marketplace-my-listings' ? 'primary' : 'secondary'}`}
              style={getButtonStyle(activeView === 'marketplace-my-listings', '#BE185D')}
              onClick={() => setActiveView('marketplace-my-listings')}
            >
              <Package size={18} />
              <span>МОИ ОБЪЯВЛЕНИЯ</span>
            </button>
            
            <button 
              className={`profile-btn ${activeView === 'marketplace-favorites' ? 'primary' : 'secondary'}`}
              style={getButtonStyle(activeView === 'marketplace-favorites', '#BE185D')}
              onClick={() => setActiveView('marketplace-favorites')}
            >
              <Heart size={18} />
              <span>ИЗБРАННОЕ</span>
            </button>
            
            <div className="sidebar-divider"></div>
          </>
        )}

        {/* ==================== FINANCE MODULE (ФИНАНСЫ) ==================== */}
        {activeModule === 'finance' && (
          <>
            <div className="sidebar-divider" style={getDividerStyle('#A16207')}></div>
            
            <button 
              className={`profile-btn ${(activeView === 'wallet' || activeView === 'wall' || activeView === 'feed') ? 'primary' : 'secondary'}`}
              style={getButtonStyle(activeView === 'wallet' || activeView === 'wall' || activeView === 'feed', '#A16207')}
              onClick={() => setActiveView('wallet')}
            >
              <Wallet size={18} />
              <span>МОЙ КОШЕЛЁК</span>
            </button>
            
            <div className="sidebar-divider" style={getDividerStyle('#A16207')}></div>
            
            {/* Quick Actions */}
            <div className="nav-group-label" style={{ color: '#A16207', padding: '8px 12px', fontSize: '11px' }}>
              БЫСТРЫЕ ДЕЙСТВИЯ
            </div>
            
            <button 
              className={`profile-btn secondary`}
              style={{ color: '#059669' }}
              onClick={() => setActiveView('wallet')}
            >
              <Coins size={18} />
              <span>Отправить COIN</span>
            </button>
            
            <button 
              className={`profile-btn secondary`}
              style={{ color: '#8B5CF6' }}
              onClick={() => setActiveView('wallet')}
            >
              <TrendingUp size={18} />
              <span>Передать TOKEN</span>
            </button>
            
            <div className="sidebar-divider" style={getDividerStyle('#A16207')}></div>
            
            {/* Finance Info */}
            <div className="nav-group-label" style={{ color: '#A16207', padding: '8px 12px', fontSize: '11px' }}>
              ИНФОРМАЦИЯ
            </div>
            
            <button 
              className={`profile-btn secondary`}
              onClick={() => setActiveView('wallet')}
            >
              <DollarSign size={18} />
              <span>Курсы валют</span>
            </button>
            
            <div className="sidebar-divider"></div>
          </>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="sidebar-nav">
        {/* Friends link - hidden in News module (moved to right sidebar) */}
        {activeModule !== 'news' && (
          <a href="#" className="nav-item">
            <Users size={20} />
            <span>Мои Друзья</span>
          </a>
        )}
        <a href="#" className="nav-item">
          <MessageCircle size={20} />
          <span>Мои Сообщения</span>
        </a>
        
        {/* Media Storage Section */}
        <div className="nav-group">
          <div className="nav-group-label">МЕДИА ХРАНИЛИЩЕ</div>
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
  );
};

export default LeftSidebar;
