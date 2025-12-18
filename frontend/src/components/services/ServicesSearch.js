/**
 * ServicesSearch Component
 * Main search and discovery page for services
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Search, Filter, MapPin, Grid, List, X, ChevronDown } from 'lucide-react';
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
  const [viewMode, setViewMode] = useState('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [total, setTotal] = useState(0);

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
      params.append('limit', '20');

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
          >
            <Grid size={18} />
          </button>
          <button 
            className={viewMode === 'list' ? 'active' : ''}
            onClick={() => setViewMode('list')}
          >
            <List size={18} />
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
