import React, { useState, useEffect } from 'react';
import { Building2, Search, Plus, Globe, Lock, MapPin, Calendar, Users, Briefcase, Check, X } from 'lucide-react';
import { OrganizationTypes, OrganizationSizes, Industries } from '../mock-work';

import { BACKEND_URL } from '../config/api';
const WorkSetupPage = ({ initialMode = 'choice', onBack, onComplete, onJoinRequest }) => {
  
  const [mode, setMode] = useState(initialMode); // 'choice', 'search', 'create'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedOrgType, setSelectedOrgType] = useState('');
  const [step, setStep] = useState(1); // For multi-step creation
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // Organization form data
  const [formData, setFormData] = useState({
    name: '',
    organization_type: 'COMPANY',
    description: '',
    industry: '',
    organization_size: '11-50',
    founded_year: new Date().getFullYear(),
    website: '',
    official_email: '',
    address_street: '',
    address_city: '',
    address_state: '',
    address_country: 'Россия',
    address_postal_code: '',
    is_private: false,
    allow_public_discovery: true,
    creator_role: 'CEO',
    custom_role_name: '',
    creator_department: '',
    creator_team: '',
    creator_job_title: ''
  });

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setSearching(true);
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
          organization_type: selectedOrgType || null
        })
      });
      
      if (!response.ok) {
        throw new Error('Search failed');
      }
      
      const data = await response.json();
      setSearchResults(data.organizations || []);
    } catch (error) {
      console.error('Search error:', error);
      alert('Ошибка при поиске организаций');
    } finally {
      setSearching(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCreateOrganization = async () => {
    setCreating(true);
    try {
            const token = localStorage.getItem('zion_token');
      
      const response = await fetch(`${BACKEND_URL}/api/work/organizations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create organization');
      }
      
      const data = await response.json();
      console.log('Organization created:', data);
      alert('Организация успешно создана!');
      onComplete && onComplete();
    } catch (error) {
      console.error('Create organization error:', error);
      alert(`Ошибка: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleJoinOrganization = (orgId) => {
    // Mock: Show success and navigate
    console.log('Joining organization:', orgId);
    alert('Запрос на присоединение отправлен! (В разработке)');
    onJoinRequest && onJoinRequest(orgId);
  };

  // Choice View
  if (mode === 'choice') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white p-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={onBack}
            className="mb-6 text-gray-600 hover:text-gray-900 flex items-center gap-2 transition-colors duration-200"
          >
            ← Back
          </button>

          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-3">
              Set Up Your Work Profile
            </h1>
            <p className="text-lg text-gray-600">
              Create a new organization or search for an existing one
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <button
              onClick={() => setMode('search')}
              className="group bg-white rounded-2xl p-8 shadow-md hover:shadow-xl transition-all duration-300 text-left border-2 border-transparent hover:border-orange-500 hover:scale-105"
            >
              <div className="w-16 h-16 rounded-xl bg-orange-100 flex items-center justify-center mb-4 group-hover:bg-orange-500 transition-colors duration-300">
                <Search className="w-8 h-8 text-orange-600 group-hover:text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Search & Join</h2>
              <p className="text-gray-600">Find and join an existing organization</p>
            </button>

            <button
              onClick={() => { setMode('create'); setStep(1); }}
              className="group bg-white rounded-2xl p-8 shadow-md hover:shadow-xl transition-all duration-300 text-left border-2 border-transparent hover:border-orange-500 hover:scale-105"
            >
              <div className="w-16 h-16 rounded-xl bg-orange-100 flex items-center justify-center mb-4 group-hover:bg-orange-500 transition-colors duration-300">
                <Plus className="w-8 h-8 text-orange-600 group-hover:text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Create New</h2>
              <p className="text-gray-600">Start your own organization profile</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Search View
  if (mode === 'search') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white p-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => setMode('choice')}
            className="mb-6 text-gray-600 hover:text-gray-900 flex items-center gap-2 transition-colors duration-200"
          >
            ← Back
          </button>

          <div className="bg-white rounded-2xl shadow-md p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Search Organizations</h2>
            
            {/* Search Input */}
            <div className="flex gap-3 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search by organization name..."
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={searching || !searchQuery.trim()}
                className="px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors duration-200 font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {searching ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Поиск...
                  </>
                ) : (
                  'Поиск'
                )}
              </button>
            </div>

            {/* Organization Type Filter */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Type</label>
              <select
                value={selectedOrgType}
                onChange={(e) => setSelectedOrgType(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="">All Types</option>
                {Object.keys(OrganizationTypes).map(type => (
                  <option key={type} value={type}>
                    {type.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Found {searchResults.length} organization{searchResults.length !== 1 ? 's' : ''}
                </h3>
                <div className="space-y-4">
                  {searchResults.map(org => (
                    <div key={org.id} className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-all duration-200">
                      <div className="flex items-start gap-4">
                        <img
                          src={org.logo_url}
                          alt={org.name}
                          className="w-16 h-16 rounded-xl object-cover"
                        />
                        <div className="flex-1">
                          <h4 className="text-xl font-bold text-gray-900 mb-1">{org.name}</h4>
                          <p className="text-sm text-gray-600 mb-2">
                            {org.organization_type.replace('_', ' ')} • {org.industry} • {org.member_count} members
                          </p>
                          <p className="text-gray-700 mb-3">{org.description}</p>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <MapPin className="w-4 h-4" />
                            {org.address_city}, {org.address_country}
                          </div>
                        </div>
                        <button
                          onClick={() => handleJoinOrganization(org.id)}
                          className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors duration-200 font-semibold"
                        >
                          Join
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {searchQuery && searchResults.length === 0 && (
              <div className="text-center py-12">
                <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No organizations found. Try a different search term.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Create Organization View - Multi-step Form
  if (mode === 'create') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white p-6">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => step === 1 ? setMode('choice') : setStep(step - 1)}
            className="mb-6 text-gray-600 hover:text-gray-900 flex items-center gap-2 transition-colors duration-200"
          >
            ← Back
          </button>

          <div className="bg-white rounded-2xl shadow-md p-8">
            {/* Progress Steps */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                {[1, 2, 3].map(s => (
                  <div key={s} className="flex items-center flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-300 ${
                      step === s ? 'bg-orange-500 text-white scale-110' :
                      step > s ? 'bg-green-500 text-white' :
                      'bg-gray-200 text-gray-500'
                    }`}>
                      {step > s ? <Check className="w-5 h-5" /> : s}
                    </div>
                    {s < 3 && (
                      <div className={`flex-1 h-1 mx-2 rounded transition-all duration-300 ${
                        step > s ? 'bg-green-500' : 'bg-gray-200'
                      }`} />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-sm font-medium">
                <span className={step === 1 ? 'text-orange-600' : step > 1 ? 'text-green-600' : 'text-gray-500'}>Basic Info</span>
                <span className={step === 2 ? 'text-orange-600' : step > 2 ? 'text-green-600' : 'text-gray-500'}>Details</span>
                <span className={step === 3 ? 'text-orange-600' : 'text-gray-500'}>Your Role</span>
              </div>
            </div>

            {/* Step 1: Basic Information */}
            {step === 1 && (
              <div className="space-y-6">
                <h2 className="text-3xl font-bold text-gray-900 mb-6">Basic Information</h2>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Organization Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="ZION.CITY"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Organization Type *</label>
                  <select
                    value={formData.organization_type}
                    onChange={(e) => handleInputChange('organization_type', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    {Object.keys(OrganizationTypes).map(type => (
                      <option key={type} value={type}>
                        {type.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={4}
                    placeholder="Tell us about your organization..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Industry *</label>
                    <select
                      value={formData.industry}
                      onChange={(e) => handleInputChange('industry', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                      <option value="">Select industry</option>
                      {Industries.map(ind => (
                        <option key={ind} value={ind}>{ind}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Organization Size</label>
                    <select
                      value={formData.organization_size}
                      onChange={(e) => handleInputChange('organization_size', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                      {OrganizationSizes.map(size => (
                        <option key={size} value={size}>{size} employees</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  onClick={() => formData.name && formData.description && formData.industry && setStep(2)}
                  disabled={!formData.name || !formData.description || !formData.industry}
                  className="w-full py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors duration-200 font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              </div>
            )}

            {/* Step 2: Contact & Address Details */}
            {step === 2 && (
              <div className="space-y-6">
                <h2 className="text-3xl font-bold text-gray-900 mb-6">Contact & Location</h2>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Website</label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => handleInputChange('website', e.target.value)}
                      placeholder="https://example.com"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Official Email</label>
                    <input
                      type="email"
                      value={formData.official_email}
                      onChange={(e) => handleInputChange('official_email', e.target.value)}
                      placeholder="info@example.com"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Founded Year</label>
                  <input
                    type="number"
                    value={formData.founded_year}
                    onChange={(e) => handleInputChange('founded_year', parseInt(e.target.value))}
                    min="1800"
                    max={new Date().getFullYear()}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Street Address</label>
                  <input
                    type="text"
                    value={formData.address_street}
                    onChange={(e) => handleInputChange('address_street', e.target.value)}
                    placeholder="123 Main Street"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Город</label>
                    <input
                      type="text"
                      value={formData.address_city}
                      onChange={(e) => handleInputChange('address_city', e.target.value)}
                      placeholder="Ростов-на-Дону"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Область/Регион</label>
                    <input
                      type="text"
                      value={formData.address_state}
                      onChange={(e) => handleInputChange('address_state', e.target.value)}
                      placeholder="Ростовская область"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setStep(3)}
                    className="flex-1 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors duration-200 font-semibold"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Your Role */}
            {step === 3 && (
              <div className="space-y-6">
                <h2 className="text-3xl font-bold text-gray-900 mb-6">Your Role in the Organization</h2>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Your Role *</label>
                  <select
                    value={formData.creator_role}
                    onChange={(e) => handleInputChange('creator_role', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="CEO">CEO</option>
                    <option value="CTO">CTO</option>
                    <option value="CFO">CFO</option>
                    <option value="FOUNDER">Founder</option>
                    <option value="CO_FOUNDER">Co-Founder</option>
                    <option value="DIRECTOR">Director</option>
                    <option value="MANAGER">Manager</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Job Title *</label>
                  <input
                    type="text"
                    value={formData.creator_job_title}
                    onChange={(e) => handleInputChange('creator_job_title', e.target.value)}
                    placeholder="Chief Executive Officer"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                    <input
                      type="text"
                      value={formData.creator_department}
                      onChange={(e) => handleInputChange('creator_department', e.target.value)}
                      placeholder="Executive"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Team (optional)</label>
                    <input
                      type="text"
                      value={formData.creator_team}
                      onChange={(e) => handleInputChange('creator_team', e.target.value)}
                      placeholder="Leadership Team"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Privacy Settings</h3>
                  
                  <label className="flex items-center gap-3 mb-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!formData.is_private}
                      onChange={(e) => handleInputChange('is_private', !e.target.checked)}
                      className="w-5 h-5 text-orange-500 rounded focus:ring-2 focus:ring-orange-500"
                    />
                    <div>
                      <div className="font-medium text-gray-900">Public Organization</div>
                      <div className="text-sm text-gray-600">Anyone can view your organization profile</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.allow_public_discovery}
                      onChange={(e) => handleInputChange('allow_public_discovery', e.target.checked)}
                      className="w-5 h-5 text-orange-500 rounded focus:ring-2 focus:ring-orange-500"
                    />
                    <div>
                      <div className="font-medium text-gray-900">Allow Discovery</div>
                      <div className="text-sm text-gray-600">Let people find your organization in search</div>
                    </div>
                  </label>
                </div>

                <button
                  onClick={handleCreateOrganization}
                  disabled={!formData.creator_job_title || creating}
                  className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl hover:shadow-lg transition-all duration-200 font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Создание...
                    </>
                  ) : (
                    'Создать организацию'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default WorkSetupPage;
