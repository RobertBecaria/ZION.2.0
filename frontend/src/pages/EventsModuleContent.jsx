import React, { memo, useCallback, lazy, Suspense, useMemo } from 'react';

// Lazy load all components
const GoodWillSearch = lazy(() => import('../components/goodwill').then(m => ({ default: m.GoodWillSearch })));
const GoodWillEventDetail = lazy(() => import('../components/goodwill').then(m => ({ default: m.GoodWillEventDetail })));
const GoodWillEventForm = lazy(() => import('../components/goodwill').then(m => ({ default: m.GoodWillEventForm })));
const GoodWillCalendar = lazy(() => import('../components/goodwill').then(m => ({ default: m.GoodWillCalendar })));
const GoodWillOrganizerProfile = lazy(() => import('../components/goodwill').then(m => ({ default: m.GoodWillOrganizerProfile })));
const GoodWillMyEvents = lazy(() => import('../components/goodwill').then(m => ({ default: m.GoodWillMyEvents })));
const GoodWillInvitations = lazy(() => import('../components/goodwill').then(m => ({ default: m.GoodWillInvitations })));
const GoodWillGroups = lazy(() => import('../components/goodwill').then(m => ({ default: m.GoodWillGroups })));

const LoadingFallback = () => <div className="module-loading"><div className="loading-spinner" /><p>Загрузка...</p></div>;

/**
 * Events/Good Will Module Content (ДОБРАЯ ВОЛЯ) - Optimized with memoization and lazy loading
 */
const EventsModuleContent = memo(function EventsModuleContent({
  activeView,
  setActiveView,
  user,
  currentModule,
  selectedGoodWillEventId,
  setSelectedGoodWillEventId,
}) {
  const { color: moduleColor } = currentModule;
  const token = useMemo(() => localStorage.getItem('zion_token'), []);

  // Memoized handlers
  const handleSelectEvent = useCallback((event) => {
    setSelectedGoodWillEventId(event.id);
    setActiveView('goodwill-event-detail');
  }, [setSelectedGoodWillEventId, setActiveView]);

  const handleEventCreated = useCallback((event) => {
    setSelectedGoodWillEventId(event.id);
    setActiveView('goodwill-event-detail');
  }, [setSelectedGoodWillEventId, setActiveView]);

  const nav = useMemo(() => ({
    toSearch: () => setActiveView('goodwill-search'),
    toMyEvents: () => setActiveView('goodwill-my-events'),
    toCreateEvent: () => setActiveView('goodwill-create-event'),
  }), [setActiveView]);

  // View renderer
  const renderContent = () => {
    switch (activeView) {
      case 'goodwill-search':
      case 'goodwill-favorites':
      default:
        return (
          <GoodWillSearch
            token={token}
            moduleColor={moduleColor}
            onSelectEvent={handleSelectEvent}
          />
        );

      case 'goodwill-event-detail':
        if (!selectedGoodWillEventId) return <GoodWillSearch token={token} moduleColor={moduleColor} onSelectEvent={handleSelectEvent} />;
        return (
          <GoodWillEventDetail
            eventId={selectedGoodWillEventId}
            token={token}
            moduleColor={moduleColor}
            onBack={nav.toSearch}
            currentUser={user}
          />
        );

      case 'goodwill-calendar':
        return (
          <GoodWillCalendar
            token={token}
            moduleColor={moduleColor}
            onSelectEvent={handleSelectEvent}
          />
        );

      case 'goodwill-my-events':
        return (
          <GoodWillMyEvents
            token={token}
            moduleColor={moduleColor}
            onSelectEvent={handleSelectEvent}
            onCreateEvent={nav.toCreateEvent}
          />
        );

      case 'goodwill-create-event':
        return (
          <GoodWillEventForm
            token={token}
            moduleColor={moduleColor}
            onBack={nav.toMyEvents}
            onEventCreated={handleEventCreated}
          />
        );

      case 'goodwill-invitations':
        return (
          <GoodWillInvitations
            token={token}
            moduleColor={moduleColor}
            onSelectEvent={handleSelectEvent}
          />
        );

      case 'goodwill-organizer-profile':
        return (
          <GoodWillOrganizerProfile
            token={token}
            moduleColor={moduleColor}
            onProfileCreated={nav.toMyEvents}
          />
        );

      case 'goodwill-groups':
        return (
          <GoodWillGroups
            token={token}
            moduleColor={moduleColor}
          />
        );
    }
  };

  return (
    <Suspense fallback={<LoadingFallback />}>
      {renderContent()}
    </Suspense>
  );
});

export default EventsModuleContent;
