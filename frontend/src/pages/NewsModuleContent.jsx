import React, { memo, useCallback, lazy, Suspense, useMemo } from 'react';

// Lazy load all components
const NewsFeed = lazy(() => import('../components/NewsFeed'));
const ChannelView = lazy(() => import('../components/ChannelView'));
const NewsUserProfile = lazy(() => import('../components/NewsUserProfile'));
const FriendsPage = lazy(() => import('../components/FriendsPage'));
const ChannelsPage = lazy(() => import('../components/ChannelsPage'));
const PeopleDiscovery = lazy(() => import('../components/PeopleDiscovery'));
const UniversalChatLayout = lazy(() => import('../components/UniversalChatLayout'));

const LoadingFallback = () => <div className="module-loading"><div className="loading-spinner" /><p>Загрузка...</p></div>;

/**
 * News Module Content - Optimized with memoization and lazy loading
 */
const NewsModuleContent = memo(function NewsModuleContent({
  activeView,
  setActiveView,
  user,
  currentModule,
  selectedChannelId,
  setSelectedChannelId,
  selectedNewsUserId,
  setSelectedNewsUserId,
  activeGroup,
  activeDirectChat,
  chatGroups,
  handleGroupSelect,
  handleCreateGroup,
}) {
  const { color: moduleColor } = currentModule;

  // Memoized navigation
  const nav = useMemo(() => ({
    toFeed: () => setActiveView('feed'),
    toChannels: () => setActiveView('channels'),
    toChannelView: () => setActiveView('channel-view'),
    toUserProfile: () => setActiveView('news-user-profile'),
  }), [setActiveView]);

  // Memoized handlers
  const handleBackFromChannel = useCallback(() => {
    setSelectedChannelId(null);
    nav.toChannels();
  }, [setSelectedChannelId, nav]);

  const handleBackFromProfile = useCallback(() => {
    setSelectedNewsUserId(null);
    nav.toFeed();
  }, [setSelectedNewsUserId, nav]);

  const handleViewChannel = useCallback((channel) => {
    setSelectedChannelId(channel.id);
    nav.toChannelView();
  }, [setSelectedChannelId, nav]);

  const handleNavigateToProfile = useCallback((person) => {
    setSelectedNewsUserId(person.id);
    nav.toUserProfile();
  }, [setSelectedNewsUserId, nav]);

  // Get initial tab for friends page
  const getFriendsInitialTab = () => {
    if (activeView === 'followers') return 'followers';
    if (activeView === 'following') return 'following';
    return 'friends';
  };

  // View renderer
  const renderContent = () => {
    // News Feed View
    if ((activeView === 'wall' || activeView === 'feed') && !selectedChannelId) {
      return <NewsFeed user={user} moduleColor={moduleColor} />;
    }

    // Channel View
    if (activeView === 'channel-view' && selectedChannelId) {
      return (
        <ChannelView
          channelId={selectedChannelId}
          user={user}
          moduleColor={moduleColor}
          onBack={handleBackFromChannel}
        />
      );
    }

    // User Profile View
    if (activeView === 'news-user-profile' && selectedNewsUserId) {
      return (
        <NewsUserProfile
          userId={selectedNewsUserId}
          user={user}
          moduleColor={moduleColor}
          onBack={handleBackFromProfile}
          onOpenChat={(person) => {}}
        />
      );
    }

    // Friends Page
    if (['friends', 'followers', 'following'].includes(activeView)) {
      return (
        <FriendsPage
          user={user}
          moduleColor={moduleColor}
          initialTab={getFriendsInitialTab()}
          onBack={nav.toFeed}
          onOpenChat={(person) => {}}
        />
      );
    }

    // Channels Page
    if (activeView === 'channels' && !selectedChannelId) {
      return (
        <ChannelsPage
          user={user}
          moduleColor={moduleColor}
          onViewChannel={handleViewChannel}
        />
      );
    }

    // People Discovery
    if (activeView === 'people-discovery') {
      return (
        <PeopleDiscovery
          user={user}
          moduleColor={moduleColor}
          onNavigateToProfile={handleNavigateToProfile}
          onClose={nav.toFeed}
        />
      );
    }

    // Chat View
    if (activeView === 'chat') {
      return (
        <UniversalChatLayout
          activeGroup={activeGroup}
          activeDirectChat={activeDirectChat}
          chatGroups={chatGroups}
          onGroupSelect={handleGroupSelect}
          moduleColor={moduleColor}
          onCreateGroup={handleCreateGroup}
          user={user}
        />
      );
    }

    // Default: News Feed
    return <NewsFeed user={user} moduleColor={moduleColor} />;
  };

  return (
    <Suspense fallback={<LoadingFallback />}>
      {renderContent()}
    </Suspense>
  );
});

export default NewsModuleContent;
