/**
 * ServicesSearch Component
 * Main search and discovery page for services with OpenStreetMap integration
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Filter, MapPin, Grid, List, X, ChevronDown, Map as MapIcon, Navigation } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import ServiceCard from './ServiceCard';
import ServiceCategories from './ServiceCategories';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Custom marker icon for services
const serviceIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// User location marker icon
const userLocationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Component to handle map center changes
const MapController = ({ center, selectedListing }) => {
  const map = useMap();
  
  useEffect(() => {
    if (selectedListing && selectedListing.latitude && selectedListing.longitude) {
      map.flyTo([selectedListing.latitude, selectedListing.longitude], 16, { duration: 0.5 });
    }
  }, [map, selectedListing]);

  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom());
    }
  }, [map, center]);

  return null;
};

const ServicesSearch = ({ 
  user, 
  moduleColor = '#B91C1C',
  onViewListing
}) => {
  const [categories, setCategories] = useState({});
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [cityFilter, setCityFilter] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [viewMode, setViewMode] = useState('grid'); // 'grid', 'list', 'map'
  const [showFilters, setShowFilters] = useState(false);
  const [total, setTotal] = useState(0);
  const [userLocation, setUserLocation] = useState(null);
  const [mapCenter, setMapCenter] = useState([55.7558, 37.6173]); // Moscow default
  const [selectedMapListing, setSelectedMapListing] = useState(null);

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
          setMapCenter([latitude, longitude]);
        },
        () => {
          // Geolocation unavailable or denied
        }
      );
    }
  }, []);

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/services/categories`);
        if (response.ok) {
          const data = await response.json();
          setCategories(data.categories || {});
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };
    fetchCategories();
  }, []);

  // Fetch listings
  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (selectedCategory) params.append('category_id', selectedCategory);
      if (selectedSubcategory) params.append('subcategory_id', selectedSubcategory);
      if (cityFilter) params.append('city', cityFilter);
      params.append('sort_by', sortBy);
      params.append('limit', '50');

      const response = await fetch(`${BACKEND_URL}/api/services/listings?${params}`);
      if (response.ok) {
        const data = await response.json();
        setListings(data.listings || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error('Error fetching listings:', error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCategory, selectedSubcategory, cityFilter, sortBy]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  // Generate coordinates for listings (demo purposes)
  const listingsForMap = useMemo(() => {
    return listings.map((listing) => {
      if (listing.latitude && listing.longitude) {
        return listing;
      }
      // Generate coordinates around map center for demo
      const baseLatitude = mapCenter[0] || 55.7558;
      const baseLongitude = mapCenter[1] || 37.6173;
      const offset = 0.02;
      return {
        ...listing,
        latitude: baseLatitude + (Math.random() - 0.5) * offset * 2,
        longitude: baseLongitude + (Math.random() - 0.5) * offset * 2,
      };
    });
  }, [listings, mapCenter]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchListings();
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory(null);
    setSelectedSubcategory(null);
    setCityFilter('');
    setSortBy('rating');
  };

  const handleLocateMe = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
          setMapCenter([latitude, longitude]);
        },
        () => {
          // Geolocation unavailable or denied
        }
      );
    }
  };

  const handleSidebarItemClick = (listing) => {
    setSelectedMapListing(listing);
  };

  return (
    <div className="services-search">
      {/* Search Header */}
      <div className="services-search-header">
        <h2 style={{ color: moduleColor }}>🔍 Поиск услуг</h2>
        <p>Найдите лучшие услуги в вашем городе</p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="services-search-bar">
        <div className="search-input-wrapper">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            placeholder="Поиск услуг..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button type="button" className="clear-btn" onClick={() => setSearchQuery('')}>
              <X size={16} />
            </button>
          )}
        </div>
        
        <div className="search-location">
          <MapPin size={18} />
          <input
            type="text"
            placeholder="Город"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
          />
        </div>
        
        <button 
          type="submit" 
          className="search-btn"
          style={{ backgroundColor: moduleColor }}
        >
          Найти
        </button>
        
        <button 
          type="button"
          className="filter-toggle-btn"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter size={18} />
          Фильтры
          <ChevronDown size={16} className={showFilters ? 'rotated' : ''} />
        </button>
      </form>

      {/* Filters Panel */}
      {showFilters && (
        <div className="services-filters-panel">
          <div className="filter-group">
            <label>Сортировка</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="rating">По рейтингу</option>
              <option value="price">По цене</option>
              <option value="newest">Сначала новые</option>
              <option value="popular">По популярности</option>
            </select>
          </div>
          
          <button className="clear-filters-btn" onClick={clearFilters}>
            Сбросить фильтры
          </button>
        </div>
      )}

      {/* Categories */}
      <ServiceCategories
        categories={categories}
        selectedCategory={selectedCategory}
        onCategorySelect={setSelectedCategory}
        moduleColor={moduleColor}
      />

      {/* Results Header */}
      <div className="services-results-header">
        <span className="results-count">
          Найдено: <strong>{total}</strong> услуг
        </span>
        <div className="view-toggle">
          <button 
            className={viewMode === 'grid' ? 'active' : ''}
            onClick={() => setViewMode('grid')}
            title="Сетка"
          >
            <Grid size={18} />
          </button>
          <button 
            className={viewMode === 'list' ? 'active' : ''}
            onClick={() => setViewMode('list')}
            title="Список"
          >
            <List size={18} />
          </button>
          <button 
            className={viewMode === 'map' ? 'active' : ''}
            onClick={() => setViewMode('map')}
            title="Карта"
            style={viewMode === 'map' ? { backgroundColor: moduleColor, color: 'white' } : {}}
          >
            <MapIcon size={18} />
          </button>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="services-loading">
          <div className="spinner" style={{ borderTopColor: moduleColor }}></div>
          <p>Загрузка услуг...</p>
        </div>
      ) : listings.length === 0 ? (
        <div className="services-empty">
          <span style={{ fontSize: '4rem' }}>🔍</span>
          <h3>Услуги не найдены</h3>
          <p>Попробуйте изменить параметры поиска</p>
        </div>
      ) : viewMode === 'map' ? (
        <div className="services-map-container">
          <div className="map-wrapper">
            <MapContainer 
              center={mapCenter} 
              zoom={13} 
              scrollWheelZoom={true}
              className="services-leaflet-map"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapController center={mapCenter} selectedListing={selectedMapListing} />
              
              {/* Service markers */}
              {listingsForMap.map(listing => (
                listing.latitude && listing.longitude && (
                  <Marker 
                    key={listing.id}
                    position={[listing.latitude, listing.longitude]}
                    icon={serviceIcon}
                    eventHandlers={{
                      click: () => setSelectedMapListing(listing)
                    }}
                  >
                    <Popup className="service-popup">
                      <div className="map-popup-content">
                        <h4>{listing.name}</h4>
                        <p className="popup-category">{listing.organization_name || ''}</p>
                        <p className="popup-rating">⭐ {listing.rating?.toFixed(1) || '0.0'}</p>
                        {listing.price_from && (
                          <p className="popup-price">от {listing.price_from.toLocaleString()} ₽</p>
                        )}
                        <button 
                          className="popup-view-btn"
                          onClick={() => onViewListing && onViewListing(listing)}
                          style={{ backgroundColor: moduleColor }}
                        >
                          Подробнее
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                )
              ))}
              
              {/* User location marker */}
              {userLocation && (
                <Marker position={userLocation} icon={userLocationIcon}>
                  <Popup>Вы здесь</Popup>
                </Marker>
              )}
            </MapContainer>
            
            {/* Map controls */}
            <div className="map-controls">
              <button 
                className="locate-btn"
                onClick={handleLocateMe}
                title="Моё местоположение"
              >
                <Navigation size={20} />
              </button>
            </div>
          </div>
          
          {/* Side panel with listing cards */}
          <div className="map-sidebar">
            <h4>Услуги на карте ({listingsForMap.length})</h4>
            <div className="map-sidebar-list">
              {listingsForMap.map(listing => (
                <div 
                  key={listing.id}
                  className={`map-sidebar-item ${selectedMapListing?.id === listing.id ? 'selected' : ''}`}
                  onClick={() => handleSidebarItemClick(listing)}
                >
                  <div className="sidebar-item-content">
                    <h5>{listing.name}</h5>
                    <p className="sidebar-item-org">{listing.organization_name}</p>
                    <div className="sidebar-item-meta">
                      <span className="sidebar-item-rating">⭐ {listing.rating?.toFixed(1) || '0.0'}</span>
                      {listing.price_from && (
                        <span className="sidebar-item-price">от {listing.price_from.toLocaleString()} ₽</span>
                      )}
                    </div>
                  </div>
                  <button 
                    className="sidebar-item-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewListing && onViewListing(listing);
                    }}
                    style={{ color: moduleColor }}
                  >
                    →
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className={`services-grid ${viewMode}`}>
          {listings.map(listing => (
            <ServiceCard
              key={listing.id}
              listing={listing}
              moduleColor={moduleColor}
              onClick={() => onViewListing && onViewListing(listing)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ServicesSearch;
