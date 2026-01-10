import React, { memo, useCallback, lazy, Suspense, useMemo } from 'react';
import { GraduationCap, Briefcase } from 'lucide-react';
import { ErrorBoundary } from '../components/auth';

// Lazy load all components
const UniversalWall = lazy(() => import('../components/UniversalWall'));
const SchoolTiles = lazy(() => import('../components/SchoolTiles'));
const EventPlanner = lazy(() => import('../components/EventPlanner'));
const ClassSchedule = lazy(() => import('../components/ClassSchedule'));
const StudentGradebook = lazy(() => import('../components/StudentGradebook'));
const MyClassesList = lazy(() => import('../components/MyClassesList'));
const StudentsList = lazy(() => import('../components/StudentsList'));

const LoadingFallback = () => <div className="module-loading"><div className="loading-spinner" /><p>Загрузка...</p></div>;

/**
 * Journal Module Content - Optimized with memoization and lazy loading
 */
const JournalModuleContent = memo(function JournalModuleContent({
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
  const { color: moduleColor, name: moduleName } = currentModule;

  // Get organization ID
  const organizationId = useMemo(() => 
    selectedSchool?.organization_id || 
    schoolRoles?.schools_as_teacher?.[0]?.organization_id || 
    schoolRoles?.schools_as_parent?.[0]?.organization_id,
    [selectedSchool, schoolRoles]
  );

  // Get schools based on role
  const currentSchools = useMemo(() => 
    schoolRole === 'parent' ? schoolRoles?.schools_as_parent : schoolRoles?.schools_as_teacher,
    [schoolRole, schoolRoles]
  );

  // Memoized handlers
  const handleSelectParentRole = useCallback(() => {
    setSchoolRole('parent');
    setActiveView('journal-school-tiles');
  }, [setSchoolRole, setActiveView]);

  const handleSelectTeacherRole = useCallback(() => {
    setSchoolRole('teacher');
    setActiveView('journal-school-tiles');
  }, [setSchoolRole, setActiveView]);

  const handleSchoolSelect = useCallback((school) => {
    setSelectedSchool(school);
    setActiveView('journal-dashboard');
  }, [setSelectedSchool, setActiveView]);

  const handleBackToDashboard = useCallback(() => setActiveView('journal-dashboard'), [setActiveView]);

  // Loading state
  if (loadingSchoolRoles) {
    return <div className="loading-state"><p>Загрузка информации о школах...</p></div>;
  }

  // Error state
  if (!schoolRoles) {
    return <div className="empty-state-large"><p>Не удалось загрузить информацию о школах</p></div>;
  }

  // View renderer
  const renderContent = () => {
    switch (activeView) {
      case 'wall':
      case 'feed':
        return (
          <UniversalWall
            activeGroup={activeGroup}
            moduleColor={moduleColor}
            moduleName={moduleName}
            user={user}
            activeModule="journal"
            schoolRoles={schoolRoles}
            journalSchoolFilter={journalSchoolFilter}
            journalAudienceFilter={journalAudienceFilter}
          />
        );

      case 'journal-role-select':
        return (
          <div className="journal-role-select">
            <h2>Выберите Роль</h2>
            <p>Вы являетесь и родителем, и учителем. Выберите роль для продолжения.</p>
            <div className="role-selection-buttons">
              {schoolRoles.is_parent && (
                <button className="role-select-btn" onClick={handleSelectParentRole}>
                  <GraduationCap size={32} />
                  <h3>Как Родитель</h3>
                  <p>{schoolRoles.schools_as_parent.length} {
                    schoolRoles.schools_as_parent.length === 1 ? 'школа' : 'школы'
                  }</p>
                </button>
              )}
              {schoolRoles.is_teacher && (
                <button className="role-select-btn" onClick={handleSelectTeacherRole}>
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

      case 'journal-school-tiles':
        return (
          <SchoolTiles
            schools={currentSchools}
            role={schoolRole}
            onSchoolSelect={handleSchoolSelect}
          />
        );

      case 'journal-dashboard':
        return (
          <EventPlanner
            organizationId={selectedSchool?.organization_id}
            schoolRoles={schoolRoles}
            user={user}
            moduleColor={moduleColor}
            viewType="full"
          />
        );

      case 'journal-schedule':
        return (
          <ClassSchedule
            selectedSchool={selectedSchool}
            role={schoolRole}
            onBack={handleBackToDashboard}
          />
        );

      case 'journal-journal':
      case 'journal-gradebook':
        return (
          <StudentGradebook
            selectedSchool={selectedSchool}
            role={schoolRole}
            onBack={handleBackToDashboard}
          />
        );

      case 'journal-calendar':
      case 'event-planner':
        return (
          <EventPlanner
            organizationId={organizationId}
            schoolRoles={schoolRoles}
            user={user}
            moduleColor={moduleColor}
            viewType="full"
          />
        );

      case 'journal-classes':
        return (
          <MyClassesList
            selectedSchool={selectedSchool}
            role={schoolRole}
            onBack={handleBackToDashboard}
            moduleColor={moduleColor}
          />
        );

      case 'journal-students':
        return (
          <StudentsList
            selectedSchool={selectedSchool}
            role={schoolRole}
            onBack={handleBackToDashboard}
            moduleColor={moduleColor}
          />
        );

      default:
        return <div className="journal-content-placeholder"><p>Выберите раздел из WORLD ZONE</p></div>;
    }
  };

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        {renderContent()}
      </Suspense>
    </ErrorBoundary>
  );
});

export default JournalModuleContent;
