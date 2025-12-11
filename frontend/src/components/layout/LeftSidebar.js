/**
 * LeftSidebar Component
 * Left sidebar with user profile and module-specific navigation
 */
import React from 'react';
import { 
  User, Newspaper, Heart, Briefcase, GraduationCap, 
  Users, MessageCircle, Image, Video, FileText, Settings, Tv 
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
  setSelectedSchool
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
              onClick={() => setActiveView('feed')}
            >
              <Newspaper size={18} />
              <span>МОЯ ЛЕНТА</span>
            </button>
            
            <button 
              className={`profile-btn ${activeView === 'channels' ? 'primary' : 'secondary'}`}
              style={getButtonStyle(activeView === 'channels', '#1D4ED8')}
              onClick={() => setActiveView('channels')}
            >
              <Tv size={18} />
              <span>КАНАЛЫ</span>
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
