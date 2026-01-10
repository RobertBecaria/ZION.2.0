import React from 'react';
import {
  GoodWillSearch,
  GoodWillEventDetail,
  GoodWillEventForm,
  GoodWillCalendar,
  GoodWillOrganizerProfile,
  GoodWillMyEvents,
  GoodWillInvitations,
  GoodWillGroups
} from '../components/goodwill';

/**
 * Events/Good Will Module Content (ДОБРАЯ ВОЛЯ) - Extracted from App.js
 * Handles all good will events-related views
 */
function EventsModuleContent({
  activeView,
  setActiveView,
  user,
  currentModule,
  selectedGoodWillEventId,
  setSelectedGoodWillEventId,
}) {
  const token = localStorage.getItem('zion_token');

  // Search/Browse
  if (activeView === 'goodwill-search') {
    return (
      <GoodWillSearch
        token={token}
        moduleColor={currentModule.color}
        onSelectEvent={(event) => {
          setSelectedGoodWillEventId(event.id);
          setActiveView('goodwill-event-detail');
        }}
      />
    );
  }

  // Event Detail
  if (activeView === 'goodwill-event-detail' && selectedGoodWillEventId) {
    return (
      <GoodWillEventDetail
        eventId={selectedGoodWillEventId}
        token={token}
        moduleColor={currentModule.color}
        onBack={() => setActiveView('goodwill-search')}
        currentUser={user}
      />
    );
  }

  // Calendar
  if (activeView === 'goodwill-calendar') {
    return (
      <GoodWillCalendar
        token={token}
        moduleColor={currentModule.color}
        onSelectEvent={(event) => {
          setSelectedGoodWillEventId(event.id);
          setActiveView('goodwill-event-detail');
        }}
      />
    );
  }

  // My Events
  if (activeView === 'goodwill-my-events') {
    return (
      <GoodWillMyEvents
        token={token}
        moduleColor={currentModule.color}
        onSelectEvent={(event) => {
          setSelectedGoodWillEventId(event.id);
          setActiveView('goodwill-event-detail');
        }}
        onCreateEvent={() => setActiveView('goodwill-create-event')}
      />
    );
  }

  // Create Event
  if (activeView === 'goodwill-create-event') {
    return (
      <GoodWillEventForm
        token={token}
        moduleColor={currentModule.color}
        onBack={() => setActiveView('goodwill-my-events')}
        onEventCreated={(event) => {
          setSelectedGoodWillEventId(event.id);
          setActiveView('goodwill-event-detail');
        }}
      />
    );
  }

  // Invitations
  if (activeView === 'goodwill-invitations') {
    return (
      <GoodWillInvitations
        token={token}
        moduleColor={currentModule.color}
        onSelectEvent={(event) => {
          setSelectedGoodWillEventId(event.id);
          setActiveView('goodwill-event-detail');
        }}
      />
    );
  }

  // Favorites
  if (activeView === 'goodwill-favorites') {
    return (
      <GoodWillSearch
        token={token}
        moduleColor={currentModule.color}
        onSelectEvent={(event) => {
          setSelectedGoodWillEventId(event.id);
          setActiveView('goodwill-event-detail');
        }}
      />
    );
  }

  // Organizer Profile
  if (activeView === 'goodwill-organizer-profile') {
    return (
      <GoodWillOrganizerProfile
        token={token}
        moduleColor={currentModule.color}
        onProfileCreated={() => setActiveView('goodwill-my-events')}
      />
    );
  }

  // Groups
  if (activeView === 'goodwill-groups') {
    return (
      <GoodWillGroups
        token={token}
        moduleColor={currentModule.color}
      />
    );
  }

  // Default: Search
  return (
    <GoodWillSearch
      token={token}
      moduleColor={currentModule.color}
      onSelectEvent={(event) => {
        setSelectedGoodWillEventId(event.id);
        setActiveView('goodwill-event-detail');
      }}
    />
  );
}

export default EventsModuleContent;
