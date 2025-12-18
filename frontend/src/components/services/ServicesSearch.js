/**
 * ServicesSearch Component
 * Main search and discovery page for services with 2GIS map integration
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, Filter, MapPin, Grid, List, X, ChevronDown, Map as MapIcon, Navigation } from 'lucide-react';
import { load } from '@2gis/mapgl';
import ServiceCard from './ServiceCard';
import ServiceCategories from './ServiceCategories';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

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
  
  // 2GIS Map refs
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const mapglAPIRef = useRef(null);
  const markersRef = useRef([]);

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
          setMapCenter([latitude, longitude]);
        },
        (error) => {
          console.log('Geolocation error:', error);
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
    return listings.map((listing, index) => {
      if (listing.latitude && listing.longitude) {
        return listing;
      }
      // Generate coordinates around Moscow for demo
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

  // Initialize 2GIS Map
  useEffect(() => {
    if (viewMode !== 'map' || !mapContainerRef.current) return;

    let map = null;

    const initMap = async () => {
      try {
        // Load 2GIS MapGL API
        const mapglAPI = await load();
        mapglAPIRef.current = mapglAPI;

        // Create map instance
        map = new mapglAPI.Map(mapContainerRef.current, {
          center: [mapCenter[1], mapCenter[0]], // 2GIS uses [lng, lat]
          zoom: 13,
          key: '4e76a044-3c62-4710-8ee6-a846c68fd68b', // Demo key for 2GIS
        });

        mapInstanceRef.current = map;

        // Add markers for listings
        addMarkers(mapglAPI, map);

        // Add user location marker if available
        if (userLocation) {
          new mapglAPI.Marker(map, {
            coordinates: [userLocation[1], userLocation[0]],
            icon: 'https://docs.2gis.com/img/mapgl/marker.svg',
          });
        }

      } catch (error) {
        console.error('Error initializing 2GIS map:', error);
      }
    };

    initMap();

    // Cleanup
    return () => {
      if (markersRef.current) {
        markersRef.current.forEach(marker => marker.destroy());
        markersRef.current = [];
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
        mapInstanceRef.current = null;
      }
    };
  }, [viewMode, mapCenter, userLocation]);

  // Update markers when listings change
  useEffect(() => {
    if (viewMode !== 'map' || !mapInstanceRef.current || !mapglAPIRef.current) return;
    
    addMarkers(mapglAPIRef.current, mapInstanceRef.current);
  }, [listingsForMap, viewMode]);

  const addMarkers = (mapglAPI, map) => {
    // Clear existing markers
    markersRef.current.forEach(marker => marker.destroy());
    markersRef.current = [];

    // Add new markers
    listingsForMap.forEach((listing, index) => {
      if (!listing.latitude || !listing.longitude) return;

      const marker = new mapglAPI.Marker(map, {
        coordinates: [listing.longitude, listing.latitude],
        label: {
          text: listing.name.substring(0, 20),
          offset: [0, -60],
          relativeAnchor: [0.5, 0],
        },
      });

      marker.on('click', () => {
        setSelectedMapListing(listing);
        
        // Show popup
        const popup = new mapglAPI.HtmlMarker(map, {
          coordinates: [listing.longitude, listing.latitude],
          html: `
            <div class="gis-popup">
              <h4>${listing.name}</h4>
              <p class="popup-org">${listing.organization_name || ''}</p>
              <p class="popup-rating">⭐ ${listing.rating?.toFixed(1) || '0.0'}</p>
              ${listing.price_from ? `<p class="popup-price">от ${listing.price_from.toLocaleString()} ₽</p>` : ''}
            </div>
          `,
        });

        // Remove popup after 5 seconds
        setTimeout(() => popup.destroy(), 5000);
      });

      markersRef.current.push(marker);
    });
  };

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
    if (userLocation && mapInstanceRef.current) {
      mapInstanceRef.current.setCenter([userLocation[1], userLocation[0]]);
      mapInstanceRef.current.setZoom(15);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setCenter([longitude, latitude]);
            mapInstanceRef.current.setZoom(15);
          }
        }
      );
    }
  };

  const handleSidebarItemClick = (listing) => {
    setSelectedMapListing(listing);
    if (mapInstanceRef.current && listing.latitude && listing.longitude) {
      mapInstanceRef.current.setCenter([listing.longitude, listing.latitude]);
      mapInstanceRef.current.setZoom(16);
    }
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
            <div 
              ref={mapContainerRef} 
              className="services-2gis-map"
            />
            
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
