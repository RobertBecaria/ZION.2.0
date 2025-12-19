import React, { useState, useEffect, useCallback } from 'react';
import { Home, Users, Vote, MessageSquare, ChevronDown } from 'lucide-react';
import JoinRequestCard from './JoinRequestCard';
import FamilyPostComposer from './FamilyPostComposer';
import FamilyFeed from './FamilyFeed';

const FamilyUnitDashboard = ({ familyUnit, user, allFamilyUnits, onSelectFamily, onRefresh }) => {
  const [activeTab, setActiveTab] = useState('feed');
  const [pendingRequests, setPendingRequests] = useState([]);
  const [showFamilySelector, setShowFamilySelector] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const isHead = familyUnit.user_role === 'HEAD';

  const fetchPendingRequests = useCallback(async () => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/family-join-requests/pending`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Filter for current family
        const familyRequests = data.join_requests.filter(
          req => req.target_family_unit_id === familyUnit.id
        );
        setPendingRequests(familyRequests);
      }
    } catch (err) {
      console.error('Error fetching pending requests:', err);
    }
  }, [familyUnit.id]);

  useEffect(() => {
    if (isHead) {
      fetchPendingRequests();
    }
  }, [isHead, fetchPendingRequests]);

  const handleVoteSubmitted = () => {
    fetchPendingRequests();
    onRefresh();
  };

  const handlePostCreated = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="family-unit-dashboard">
      {/* Family Header */}
      <div className="family-dashboard-header">
        <div className="family-selector">
          <button
            className="family-selector-btn"
            onClick={() => setShowFamilySelector(!showFamilySelector)}
          >
            <Home size={24} color="#059669" />
            <div className="family-selector-info">
              <h2>{familyUnit.family_name}</h2>
              <span className="family-role-badge">{familyUnit.user_role}</span>
            </div>
            {allFamilyUnits.length > 1 && <ChevronDown size={20} />}
          </button>

          {showFamilySelector && allFamilyUnits.length > 1 && (
            <div className="family-selector-dropdown">
              {allFamilyUnits.map(family => (
                <button
                  key={family.id}
                  className={`family-option ${family.id === familyUnit.id ? 'active' : ''}`}
                  onClick={() => {
                    onSelectFamily(family);
                    setShowFamilySelector(false);
                  }}
                >
                  <Home size={20} />
                  <div>
                    <strong>{family.family_name}</strong>
                    <span>{family.user_role}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="family-stats">
          <div className="stat-item">
            <Users size={20} />
            <span>{familyUnit.member_count} членов</span>
          </div>
          {familyUnit.parent_household_id && (
            <div className="stat-item">
              <Home size={20} />
              <span>Часть домохозяйства</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="family-dashboard-tabs">
        <button
          className={`tab-btn ${activeTab === 'feed' ? 'active' : ''}`}
          onClick={() => setActiveTab('feed')}
        >
          <MessageSquare size={20} />
          Лента
        </button>
        {isHead && pendingRequests.length > 0 && (
          <button
            className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            <Vote size={20} />
            Запросы ({pendingRequests.length})
          </button>
        )}
      </div>

      {/* Content */}
      <div className="family-dashboard-content">
        {activeTab === 'feed' && (
          <>
            <FamilyPostComposer
              familyUnit={familyUnit}
              user={user}
              onPostCreated={handlePostCreated}
            />
            <FamilyFeed
              familyUnitId={familyUnit.id}
              refreshTrigger={refreshTrigger}
            />
          </>
        )}

        {activeTab === 'requests' && isHead && (
          <div className="join-requests-section">
            <h3>Запросы на присоединение</h3>
            {pendingRequests.length === 0 ? (
              <div className="empty-state">
                <Vote size={48} color="#94a3b8" />
                <p>Нет ожидающих запросов</p>
              </div>
            ) : (
              <div className="join-requests-list">
                {pendingRequests.map(request => (
                  <JoinRequestCard
                    key={request.id}
                    request={request}
                    onVoteSubmitted={handleVoteSubmitted}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FamilyUnitDashboard;