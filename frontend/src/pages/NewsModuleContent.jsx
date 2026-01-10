import React from 'react';
import NewsFeed from '../components/NewsFeed';
import ChannelView from '../components/ChannelView';
import NewsUserProfile from '../components/NewsUserProfile';
import FriendsPage from '../components/FriendsPage';
import ChannelsPage from '../components/ChannelsPage';
import PeopleDiscovery from '../components/PeopleDiscovery';
import UniversalChatLayout from '../components/UniversalChatLayout';

/**
 * News Module Content - Extracted from App.js
 * Handles all news-related views
 */
function NewsModuleContent({
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
  // News Feed View
  if ((activeView === 'wall' || activeView === 'feed') && !selectedChannelId) {
    return (
      <NewsFeed
        user={user}
        moduleColor={currentModule.color}
      />
    );
  }

  // Channel View
  if (activeView === 'channel-view' && selectedChannelId) {
    return (
      <ChannelView
        channelId={selectedChannelId}
        user={user}
        moduleColor={currentModule.color}
        onBack={() => {
          setSelectedChannelId(null);
          setActiveView('channels');
        }}
      />
    );
  }

  // User Profile View in News
  if (activeView === 'news-user-profile' && selectedNewsUserId) {
    return (
      <NewsUserProfile
        userId={selectedNewsUserId}
        user={user}
        moduleColor={currentModule.color}
        onBack={() => {
          setSelectedNewsUserId(null);
          setActiveView('feed');
        }}
        onOpenChat={(person) => console.log('Open chat with', person)}
      />
    );
  }

  // Friends Page
  if (activeView === 'friends' || activeView === 'followers' || activeView === 'following') {
    return (
      <FriendsPage
        user={user}
        moduleColor={currentModule.color}
        initialTab={activeView === 'followers' ? 'followers' : activeView === 'following' ? 'following' : 'friends'}
        onBack={() => setActiveView('feed')}
        onOpenChat={(person) => console.log('Open chat with', person)}
      />
    );
  }

  // Channels Page
  if (activeView === 'channels' && !selectedChannelId) {
    return (
      <ChannelsPage
        user={user}
        moduleColor={currentModule.color}
        onViewChannel={(channel) => {
          setSelectedChannelId(channel.id);
          setActiveView('channel-view');
        }}
      />
    );
  }

  // People Discovery Page
  if (activeView === 'people-discovery') {
    return (
      <PeopleDiscovery
        user={user}
        moduleColor={currentModule.color}
        onNavigateToProfile={(person) => {
          setSelectedNewsUserId(person.id);
          setActiveView('news-user-profile');
        }}
        onClose={() => setActiveView('feed')}
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
        moduleColor={currentModule.color}
        onCreateGroup={handleCreateGroup}
        user={user}
      />
    );
  }

  // Default: News Feed
  return (
    <NewsFeed
      user={user}
      moduleColor={currentModule.color}
    />
  );
}

export default NewsModuleContent;
