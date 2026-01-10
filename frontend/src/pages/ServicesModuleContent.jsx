import React, { memo, useCallback, lazy, Suspense } from 'react';

// Lazy load all components
const UniversalWall = lazy(() => import('../components/UniversalWall'));
const ServicesSearch = lazy(() => import('../components/services').then(m => ({ default: m.ServicesSearch })));
const ServiceProviderProfile = lazy(() => import('../components/services').then(m => ({ default: m.ServiceProviderProfile })));
const ServicesMyProfile = lazy(() => import('../components/services').then(m => ({ default: m.ServicesMyProfile })));
const ServicesBookings = lazy(() => import('../components/services').then(m => ({ default: m.ServicesBookings })));
const ServiceBookingCalendar = lazy(() => import('../components/services').then(m => ({ default: m.ServiceBookingCalendar })));
const ServicesReviews = lazy(() => import('../components/services').then(m => ({ default: m.ServicesReviews })));

const LoadingFallback = () => <div className="module-loading"><div className="loading-spinner" /><p>Загрузка...</p></div>;

/**
 * Services Module Content - Optimized with memoization and lazy loading
 */
const ServicesModuleContent = memo(function ServicesModuleContent({
  activeView,
  setActiveView,
  user,
  currentModule,
  selectedServiceListing,
  setSelectedServiceListing,
  activeGroup,
}) {
  const { color: moduleColor, name: moduleName } = currentModule;

  // Memoized handlers
  const handleViewListing = useCallback((listing) => {
    setSelectedServiceListing(listing);
    setActiveView('services-listing-detail');
  }, [setSelectedServiceListing, setActiveView]);

  const handleBackToSearch = useCallback(() => setActiveView('services-search'), [setActiveView]);
  const handleBackToProfile = useCallback(() => setActiveView('services-my-profile'), [setActiveView]);
  const handleBackToDetail = useCallback(() => setActiveView('services-listing-detail'), [setActiveView]);

  const handleBookAppointment = useCallback((listing) => {
    setSelectedServiceListing(listing);
    setActiveView('services-booking-calendar');
  }, [setSelectedServiceListing, setActiveView]);

  const handleViewReviews = useCallback((listing) => {
    setSelectedServiceListing(listing);
    setActiveView('services-reviews');
  }, [setSelectedServiceListing, setActiveView]);

  // View renderer
  const renderContent = () => {
    switch (activeView) {
      case 'services-search':
      case 'wall':
      case 'feed':
        return (
          <ServicesSearch
            user={user}
            moduleColor={moduleColor}
            onViewListing={handleViewListing}
          />
        );

      case 'services-listing-detail':
        if (!selectedServiceListing) return <ServicesSearch user={user} moduleColor={moduleColor} onViewListing={handleViewListing} />;
        return (
          <ServiceProviderProfile
            listing={selectedServiceListing}
            onBack={handleBackToSearch}
            onBookAppointment={handleBookAppointment}
            onViewReviews={handleViewReviews}
            moduleColor={moduleColor}
            user={user}
          />
        );

      case 'services-my-profile':
        return (
          <ServicesMyProfile
            user={user}
            moduleColor={moduleColor}
            onViewListing={handleViewListing}
          />
        );

      case 'services-bookings':
        return <ServicesBookings user={user} moduleColor={moduleColor} />;

      case 'services-calendar':
        return (
          <ServiceBookingCalendar
            user={user}
            isProvider={true}
            moduleColor={moduleColor}
            onBack={handleBackToProfile}
          />
        );

      case 'services-booking-calendar':
        if (!selectedServiceListing) return <ServicesSearch user={user} moduleColor={moduleColor} onViewListing={handleViewListing} />;
        return (
          <ServiceBookingCalendar
            user={user}
            serviceId={selectedServiceListing.id}
            serviceName={selectedServiceListing.name}
            isProvider={false}
            moduleColor={moduleColor}
            onBack={handleBackToDetail}
            onBookingCreated={() => {}}
          />
        );

      case 'services-reviews':
        if (!selectedServiceListing) return <ServicesSearch user={user} moduleColor={moduleColor} onViewListing={handleViewListing} />;
        return (
          <ServicesReviews
            serviceId={selectedServiceListing.id}
            serviceName={selectedServiceListing.name}
            user={user}
            isProvider={false}
            moduleColor={moduleColor}
            onBack={handleBackToDetail}
          />
        );

      case 'services-feed':
        return (
          <UniversalWall
            activeGroup={activeGroup}
            moduleColor={moduleColor}
            moduleName={moduleName}
            activeModule="services"
            user={user}
          />
        );

      default:
        return (
          <div className="coming-soon-section">
            <h3>В разработке</h3>
            <p>Этот раздел скоро будет доступен</p>
          </div>
        );
    }
  };

  return (
    <Suspense fallback={<LoadingFallback />}>
      {renderContent()}
    </Suspense>
  );
});

export default ServicesModuleContent;
