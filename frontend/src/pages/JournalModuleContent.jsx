import React from 'react';
import { GraduationCap, Briefcase } from 'lucide-react';
import { ErrorBoundary } from '../components/auth';
import UniversalWall from '../components/UniversalWall';
import SchoolTiles from '../components/SchoolTiles';
import EventPlanner from '../components/EventPlanner';
import ClassSchedule from '../components/ClassSchedule';
import StudentGradebook from '../components/StudentGradebook';
import MyClassesList from '../components/MyClassesList';
import StudentsList from '../components/StudentsList';

/**
 * Journal Module Content - Extracted from App.js
 * Handles all school/journal-related views
 */
function JournalModuleContent({
  activeView,
  setActiveView,
  user,
  currentModule,
  schoolRoles,
  loadingSchoolRoles,
  selectedSchool,
  setSelectedSchool,
  schoolRole,
  setSchoolRole,
  journalSchoolFilter,
  journalAudienceFilter,
  activeGroup,
}) {
  // Loading state
  if (loadingSchoolRoles) {
    return (
      <div className="loading-state">
        <p>Загрузка информации о школах...</p>
      </div>
    );
  }

  // Error state
  if (!schoolRoles) {
    return (
      <div className="empty-state-large">
        <p>Не удалось загрузить информацию о школах</p>
      </div>
    );
  }

  // Wall/Feed view
  if (activeView === 'wall' || activeView === 'feed') {
    return (
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
    );
  }

  // Role Selection
  if (activeView === 'journal-role-select') {
    return (
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
    );
  }

  // School Tiles
  if (activeView === 'journal-school-tiles') {
    return (
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
    );
  }

  // Dashboard (Event Planner by default)
  if (activeView === 'journal-dashboard') {
    return (
      <ErrorBoundary>
        <EventPlanner
          organizationId={selectedSchool?.organization_id}
          schoolRoles={schoolRoles}
          user={user}
          moduleColor={currentModule.color}
          viewType="full"
        />
      </ErrorBoundary>
    );
  }

  // Schedule
  if (activeView === 'journal-schedule') {
    return (
      <ErrorBoundary>
        <ClassSchedule
          selectedSchool={selectedSchool}
          role={schoolRole}
          onBack={() => setActiveView('journal-dashboard')}
        />
      </ErrorBoundary>
    );
  }

  // Gradebook
  if (activeView === 'journal-journal' || activeView === 'journal-gradebook') {
    return (
      <ErrorBoundary>
        <StudentGradebook
          selectedSchool={selectedSchool}
          role={schoolRole}
          onBack={() => setActiveView('journal-dashboard')}
        />
      </ErrorBoundary>
    );
  }

  // Calendar/Event Planner
  if (activeView === 'journal-calendar' || activeView === 'event-planner') {
    return (
      <ErrorBoundary>
        <EventPlanner
          organizationId={selectedSchool?.organization_id || (schoolRoles?.schools_as_teacher?.[0]?.organization_id) || (schoolRoles?.schools_as_parent?.[0]?.organization_id)}
          schoolRoles={schoolRoles}
          user={user}
          moduleColor={currentModule.color}
          viewType="full"
        />
      </ErrorBoundary>
    );
  }

  // Classes
  if (activeView === 'journal-classes') {
    return (
      <ErrorBoundary>
        <MyClassesList
          selectedSchool={selectedSchool}
          role={schoolRole}
          onBack={() => setActiveView('journal-dashboard')}
          moduleColor={currentModule.color}
        />
      </ErrorBoundary>
    );
  }

  // Students
  if (activeView === 'journal-students') {
    return (
      <ErrorBoundary>
        <StudentsList
          selectedSchool={selectedSchool}
          role={schoolRole}
          onBack={() => setActiveView('journal-dashboard')}
          moduleColor={currentModule.color}
        />
      </ErrorBoundary>
    );
  }

  // Default: Placeholder
  return (
    <div className="journal-content-placeholder">
      <p>Выберите раздел из WORLD ZONE</p>
    </div>
  );
}

export default JournalModuleContent;
