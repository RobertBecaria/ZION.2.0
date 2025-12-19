/**
 * ServicesMyProfile Component
 * Provider dashboard for managing services and CRM
 */
import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit2, Trash2, Eye, EyeOff, Calendar, Star,
  Building2, ChevronRight, Settings, BarChart2, Users,
  Clock, DollarSign, Loader2, AlertCircle
} from 'lucide-react';
import ServiceListingForm from './ServiceListingForm';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const ServicesMyProfile = ({
  user,
  moduleColor = '#B91C1C',
  onViewListing
}) => {
  const [myListings, setMyListings] = useState([]);
  const [myOrganizations, setMyOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingListing, setEditingListing] = useState(null);
  const [stats, setStats] = useState({
    totalViews: 0,
    totalBookings: 0,
    averageRating: 0,
    activeListings: 0
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('zion_token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Fetch user's organizations
      const orgsResponse = await fetch(`${BACKEND_URL}/api/work/organizations`, { headers });
      if (orgsResponse.ok) {
        const orgsData = await orgsResponse.json();
        setMyOrganizations(orgsData.organizations || []);
      }

      // Fetch user's service listings
      const listingsResponse = await fetch(`${BACKEND_URL}/api/services/my-listings`, { headers });
      if (listingsResponse.ok) {
        const listingsData = await listingsResponse.json();
        const listings = listingsData.listings || [];
        setMyListings(listings);
        
        // Calculate stats
        const totalViews = listings.reduce((sum, l) => sum + (l.view_count || 0), 0);
        const totalBookings = listings.reduce((sum, l) => sum + (l.booking_count || 0), 0);
        const activeListings = listings.filter(l => l.status === 'ACTIVE').length;
        const ratingsSum = listings.reduce((sum, l) => sum + (l.rating || 0), 0);
        const averageRating = listings.length > 0 ? ratingsSum / listings.length : 0;
        
        setStats({ totalViews, totalBookings, averageRating, activeListings });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSuccess = () => {
    setShowCreateForm(false);
    setEditingListing(null);
    fetchData();
  };

  const handleToggleStatus = async (listing) => {
    try {
      const token = localStorage.getItem('zion_token');
      const newStatus = listing.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
      
      const response = await fetch(`${BACKEND_URL}/api/services/listings/${listing.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  if (loading) {
    return (
      <div className="services-my-profile loading">
        <Loader2 size={32} className="spin" style={{ color: moduleColor }} />
        <p>Загрузка данных...</p>
      </div>
    );
  }

  // Show form for creating/editing
  if (showCreateForm || editingListing) {
    return (
      <ServiceListingForm
        listing={editingListing}
        organizations={myOrganizations}
        onSuccess={handleCreateSuccess}
        onCancel={() => { setShowCreateForm(false); setEditingListing(null); }}
        moduleColor={moduleColor}
      />
    );
  }

  return (
    <div className="services-my-profile">
      {/* Header */}
      <div className="profile-header">
        <div>
          <h2 style={{ color: moduleColor }}>👤 Мой профиль услуг</h2>
          <p>Управление вашими услугами и записями</p>
        </div>
        
        {myOrganizations.length > 0 && (
          <button
            className="create-service-btn"
            onClick={() => setShowCreateForm(true)}
            style={{ backgroundColor: moduleColor }}
          >
            <Plus size={18} />
            Добавить услугу
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="profile-stats">
        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: `${moduleColor}15` }}>
            <Eye size={24} style={{ color: moduleColor }} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.totalViews}</span>
            <span className="stat-label">Просмотров</span>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: '#10b98115' }}>
            <Calendar size={24} style={{ color: '#10b981' }} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.totalBookings}</span>
            <span className="stat-label">Записей</span>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: '#f59e0b15' }}>
            <Star size={24} style={{ color: '#f59e0b' }} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.averageRating.toFixed(1)}</span>
            <span className="stat-label">Рейтинг</span>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: '#6366f115' }}>
            <BarChart2 size={24} style={{ color: '#6366f1' }} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.activeListings}</span>
            <span className="stat-label">Активных услуг</span>
          </div>
        </div>
      </div>

      {/* Organizations Check */}
      {myOrganizations.length === 0 ? (
        <div className="no-organizations-warning">
          <AlertCircle size={48} style={{ color: '#f59e0b' }} />
          <h3>Необходима организация</h3>
          <p>Для создания услуг вам нужно сначала создать или присоединиться к организации в разделе «Организации».</p>
          <button className="go-to-orgs-btn" style={{ borderColor: moduleColor, color: moduleColor }}>
            <Building2 size={18} />
            Перейти к организациям
          </button>
        </div>
      ) : (
        <>
          {/* My Organizations */}
          <div className="my-organizations-section">
            <h3><Building2 size={20} /> Мои организации</h3>
            <div className="organizations-list">
              {myOrganizations.map(org => (
                <div key={org.id} className="org-card">
                  <div className="org-avatar" style={{ backgroundColor: `${moduleColor}20` }}>
                    {org.logo ? (
                      <img src={org.logo} alt={org.name} />
                    ) : (
                      <span style={{ color: moduleColor }}>{org.name?.charAt(0)}</span>
                    )}
                  </div>
                  <div className="org-info">
                    <h4>{org.name}</h4>
                    <span className="org-type">{org.organization_type}</span>
                  </div>
                  <span className="listings-count">
                    {myListings.filter(l => l.organization_id === org.id).length} услуг
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* My Services */}
          <div className="my-services-section">
            <h3>📋 Мои услуги ({myListings.length})</h3>
            
            {myListings.length === 0 ? (
              <div className="no-listings">
                <p>У вас пока нет услуг</p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  style={{ backgroundColor: moduleColor }}
                >
                  <Plus size={18} /> Создать первую услугу
                </button>
              </div>
            ) : (
              <div className="services-list">
                {myListings.map(listing => (
                  <div key={listing.id} className={`service-row ${listing.status !== 'ACTIVE' ? 'inactive' : ''}`}>
                    <div className="service-main">
                      <div className="service-image">
                        {listing.images?.[0] ? (
                          <img src={listing.images[0]} alt={listing.name} />
                        ) : (
                          <div className="placeholder" style={{ backgroundColor: `${moduleColor}15` }}>
                            {listing.name?.charAt(0)}
                          </div>
                        )}
                      </div>
                      
                      <div className="service-details">
                        <h4>{listing.name}</h4>
                        <p className="org-name">{listing.organization_name}</p>
                        <div className="service-meta">
                          <span><Eye size={14} /> {listing.view_count || 0}</span>
                          <span><Calendar size={14} /> {listing.booking_count || 0}</span>
                          <span><Star size={14} /> {listing.rating?.toFixed(1) || '0.0'}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="service-status">
                      <span 
                        className={`status-badge ${listing.status?.toLowerCase()}`}
                        style={listing.status === 'ACTIVE' ? { backgroundColor: `${moduleColor}15`, color: moduleColor } : {}}
                      >
                        {listing.status === 'ACTIVE' ? 'Активна' : 
                         listing.status === 'PAUSED' ? 'Приостановлена' : listing.status}
                      </span>
                    </div>
                    
                    <div className="service-actions">
                      <button
                        className="action-btn"
                        onClick={() => handleToggleStatus(listing)}
                        title={listing.status === 'ACTIVE' ? 'Приостановить' : 'Активировать'}
                      >
                        {listing.status === 'ACTIVE' ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                      <button
                        className="action-btn"
                        onClick={() => setEditingListing(listing)}
                        title="Редактировать"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        className="action-btn view"
                        onClick={() => onViewListing && onViewListing(listing)}
                        title="Просмотр"
                        style={{ color: moduleColor }}
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ServicesMyProfile;
