import React from 'react';
import UniversalWall from '../components/UniversalWall';
import { 
  ServicesSearch, 
  ServiceProviderProfile, 
  ServicesMyProfile,
  ServicesBookings,
  ServiceBookingCalendar,
  ServicesReviews
} from '../components/services';

/**
 * Services Module Content - Extracted from App.js
 * Handles all services-related views
 */
function ServicesModuleContent({
  activeView,
  setActiveView,
  user,
  currentModule,
  selectedServiceListing,
  setSelectedServiceListing,
  activeGroup,
}) {
  // Services Search/Browse
  if (activeView === 'services-search' || activeView === 'wall' || activeView === 'feed') {
    return (
      <ServicesSearch
        user={user}
        moduleColor={currentModule.color}
        onViewListing={(listing) => {
          setSelectedServiceListing(listing);
          setActiveView('services-listing-detail');
        }}
      />
    );
  }

  // Service Listing Detail
  if (activeView === 'services-listing-detail' && selectedServiceListing) {
    return (
      <ServiceProviderProfile
        listing={selectedServiceListing}
        onBack={() => setActiveView('services-search')}
        onBookAppointment={(listing) => {
          setSelectedServiceListing(listing);
          setActiveView('services-booking-calendar');
        }}
        onViewReviews={(listing) => {
          setSelectedServiceListing(listing);
          setActiveView('services-reviews');
        }}
        moduleColor={currentModule.color}
        user={user}
      />
    );
  }

  // My Services Profile
  if (activeView === 'services-my-profile') {
    return (
      <ServicesMyProfile
        user={user}
        moduleColor={currentModule.color}
        onViewListing={(listing) => {
          setSelectedServiceListing(listing);
          setActiveView('services-listing-detail');
        }}
      />
    );
  }

  // My Bookings
  if (activeView === 'services-bookings') {
    return (
      <ServicesBookings
        user={user}
        moduleColor={currentModule.color}
      />
    );
  }

  // Provider Calendar
  if (activeView === 'services-calendar') {
    return (
      <ServiceBookingCalendar
        user={user}
        isProvider={true}
        moduleColor={currentModule.color}
        onBack={() => setActiveView('services-my-profile')}
      />
    );
  }

  // Booking Calendar (for customers)
  if (activeView === 'services-booking-calendar' && selectedServiceListing) {
    return (
      <ServiceBookingCalendar
        user={user}
        serviceId={selectedServiceListing.id}
        serviceName={selectedServiceListing.name}
        isProvider={false}
        moduleColor={currentModule.color}
        onBack={() => setActiveView('services-listing-detail')}
        onBookingCreated={() => {}}
      />
    );
  }

  // Reviews
  if (activeView === 'services-reviews' && selectedServiceListing) {
    return (
      <ServicesReviews
        serviceId={selectedServiceListing.id}
        serviceName={selectedServiceListing.name}
        user={user}
        isProvider={false}
        moduleColor={currentModule.color}
        onBack={() => setActiveView('services-listing-detail')}
      />
    );
  }

  // Services Feed
  if (activeView === 'services-feed') {
    return (
      <UniversalWall
        activeGroup={activeGroup}
        moduleColor={currentModule.color}
        moduleName={currentModule.name}
        activeModule="services"
        user={user}
      />
    );
  }

  // Default: Coming Soon
  return (
    <div className="coming-soon-section">
      <h3>В разработке</h3>
      <p>Этот раздел скоро будет доступен</p>
    </div>
  );
}

export default ServicesModuleContent;
