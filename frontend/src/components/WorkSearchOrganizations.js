import React, { useState } from 'react';
import { Search, Building2, MapPin, Users, Globe, Lock, ArrowLeft, Filter, Check, Clock } from 'lucide-react';
import { Industries, OrganizationTypes } from '../mock-work';
import { toast } from '../utils/animations';

import { BACKEND_URL } from '../config/api';
const WorkSearchOrganizations = ({ onBack, onViewProfile, onJoinSuccess }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    industry: '',
    city: '',
    organization_type: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [joiningOrgId, setJoiningOrgId] = useState(null);
  const [requestingOrgId, setRequestingOrgId] = useState(null);
  const [error, setError] = useState(null);

  const handleSearch = async () => {
    setSearching(true);
    setHasSearched(true);

    try {
            const token = localStorage.getItem('zion_token');

      const response = await fetch(`${BACKEND_URL}/api/work/organizations/search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: searchQuery,
          industry: filters.industry || null,
          city: filters.city || null,
          organization_type: filters.organization_type || null
        })
      });

      if (!response.ok) {
        throw new Error('Failed to search organizations');
      }

      const data = await response.json();
      setSearchResults(data.organizations || []);
    } catch (error) {
      console.error('Search error:', error);
      setError('Не удалось выполнить поиск. Попробуйте снова.');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleJoinOrganization = async (orgId, isPrivate) => {
        const token = localStorage.getItem('zion_token');

    // Always send a join request (for both public and private organizations)
    // This ensures admins get notified and can approve/reject
    setRequestingOrgId(orgId);
    
    try {
      // Use the new endpoint that creates notification for admins
      const response = await fetch(`${BACKEND_URL}/api/organizations/${orgId}/join-request`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Не удалось отправить запрос');
      }

      const data = await response.json();
      
      // Update the org in results to show pending request
      setSearchResults(prev => prev.map(org => 
        org.id === orgId ? { ...org, user_has_pending_request: true } : org
      ));
      
      // Show success message
      toast.success(data.message || 'Запрос на вступление отправлен! Администратор организации получит уведомление.');

    } catch (error) {
      console.error('Request join error:', error);
      toast.error(error.message);
    } finally {
      setRequestingOrgId(null);
    }
  };

  const handleClearFilters = () => {
    setFilters({
      industry: '',
      city: '',
      organization_type: ''
    });
  };

  const activeFiltersCount = Object.values(filters).filter(v => v).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white p-6">
      {/* Header */}
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="w-10 h-10 rounded-full hover:bg-white/80 flex items-center justify-center transition-all duration-200 shadow-sm"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Поиск организаций</h1>
              <p className="text-gray-600 mt-1">Найдите компанию или организацию для вступления</p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Введите название организации..."
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center gap-2 ${
                showFilters || activeFiltersCount > 0
                  ? 'bg-orange-100 text-orange-600 border-2 border-orange-300'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Filter className="w-5 h-5" />
              Фильтры
              {activeFiltersCount > 0 && (
                <span className="bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>
            <button
              onClick={handleSearch}
              disabled={searching}
              className="px-8 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-200 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {searching ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Поиск...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  Найти
                </>
              )}
            </button>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Индустрия</label>
                  <select
                    value={filters.industry}
                    onChange={(e) => setFilters(prev => ({ ...prev, industry: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">Все индустрии</option>
                    {Industries.map(ind => (
                      <option key={ind} value={ind}>{ind}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Город</label>
                  <input
                    type="text"
                    value={filters.city}
                    onChange={(e) => setFilters(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="Например, Москва"
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Тип организации</label>
                  <select
                    value={filters.organization_type}
                    onChange={(e) => setFilters(prev => ({ ...prev, organization_type: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">Все типы</option>
                    {Object.keys(OrganizationTypes).map(type => (
                      <option key={type} value={type}>
                        {type.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {activeFiltersCount > 0 && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleClearFilters}
                    className="text-sm text-orange-600 hover:text-orange-700 font-medium"
                  >
                    Очистить все фильтры
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Results */}
        {hasSearched && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                {searchResults.length > 0 
                  ? `Найдено организаций: ${searchResults.length}`
                  : 'Организации не найдены'
                }
              </h2>
            </div>

            {searchResults.length > 0 ? (
              <div className="grid gap-4">
                {searchResults.map(org => (
                  <div
                    key={org.id}
                    className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 overflow-hidden"
                  >
                    <div className="p-6">
                      <div className="flex gap-6">
                        {/* Logo */}
                        <div className="flex-shrink-0">
                          <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                            <Building2 className="w-10 h-10 text-white" />
                          </div>
                        </div>

                        {/* Info */}
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-xl font-bold text-gray-900">{org.name}</h3>
                                {org.is_private ? (
                                  <Lock className="w-4 h-4 text-gray-500" />
                                ) : (
                                  <Globe className="w-4 h-4 text-green-500" />
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mt-1">
                                {org.organization_type.replace('_', ' ')} • {org.industry}
                              </p>
                            </div>

                            {/* Action Button */}
                            <div>
                              {org.user_is_member ? (
                                <button
                                  onClick={() => onViewProfile(org.id)}
                                  className="px-6 py-2 bg-green-100 text-green-700 rounded-xl font-semibold flex items-center gap-2"
                                >
                                  <Check className="w-5 h-5" />
                                  Уже участник
                                </button>
                              ) : org.user_has_pending_request ? (
                                <button
                                  disabled
                                  className="px-6 py-2 bg-yellow-100 text-yellow-700 rounded-xl font-semibold flex items-center gap-2 cursor-not-allowed"
                                >
                                  <Clock className="w-5 h-5" />
                                  Ожидание
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleJoinOrganization(org.id, org.is_private)}
                                  disabled={joiningOrgId === org.id || requestingOrgId === org.id}
                                  className="px-6 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-200 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                  {joiningOrgId === org.id || requestingOrgId === org.id ? (
                                    <>
                                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                      {org.is_private ? 'Отправка...' : 'Вступление...'}
                                    </>
                                  ) : (
                                    'Запрос на вступление'
                                  )}
                                </button>
                              )}
                            </div>
                          </div>

                          <p className="text-gray-700 mb-3">{org.description}</p>

                          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              {org.address_city}, {org.address_country}
                            </div>
                            <div className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {org.member_count} участников
                            </div>
                            <div className="flex items-center gap-1">
                              <Building2 className="w-4 h-4" />
                              {org.organization_size} сотрудников
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
                <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Организации не найдены</h3>
                <p className="text-gray-600">Попробуйте изменить критерии поиска или фильтры</p>
              </div>
            )}
          </div>
        )}

        {/* Initial State */}
        {!hasSearched && (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <Search className="w-16 h-16 text-orange-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Начните поиск</h3>
            <p className="text-gray-600">Введите название организации и нажмите "Найти"</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkSearchOrganizations;