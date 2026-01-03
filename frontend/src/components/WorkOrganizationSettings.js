import React, { useState, useEffect } from 'react';
import { X, Save, Building2, Globe, Mail, MapPin, Image, AlertCircle, Check, Upload, Trash2, LogOut, Crown, UserCog, Clock, Sparkles } from 'lucide-react';
import { OrganizationTypes, OrganizationSizes, Industries } from '../mock-work';
import WorkTransferOwnershipModal from './WorkTransferOwnershipModal';
import WorkMemberSettings from './WorkMemberSettings';
import WorkChangeRequestsManager from './WorkChangeRequestsManager';

const WorkOrganizationSettings = ({ organizationId, onClose, onSuccess, onLeaveOrganization, currentMembership }) => {
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState(currentMembership?.is_admin ? 'company' : 'personal'); // 'company' or 'personal'
  const [activeSection, setActiveSection] = useState('basic'); // 'basic', 'contact', 'media', 'privacy' (for company tab)
  const [pendingChangeRequestsCount, setPendingChangeRequestsCount] = useState(0);
  
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [showTransferOwnership, setShowTransferOwnership] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  
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
    logo_url: '',
    banner_url: ''
  });

  useEffect(() => {
    loadOrganization();
    // Get current user ID from token
    const token = localStorage.getItem('zion_token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setCurrentUserId(payload.sub);
      } catch (e) {
        console.error('Error parsing token:', e);
      }
    }
    // Load pending change requests count if admin
    if (currentMembership?.is_admin) {
      loadPendingChangeRequests();
    }
  }, [organizationId]);

  const loadOrganization = async () => {
    try {
      const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem('zion_token');

      const response = await fetch(`${BACKEND_URL}/api/work/organizations/${organizationId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Не удалось загрузить организацию');
      }

      const data = await response.json();
      setOrganization(data);
      setFormData({
        name: data.name || '',
        organization_type: data.organization_type || 'COMPANY',
        description: data.description || '',
        industry: data.industry || '',
        organization_size: data.organization_size || '11-50',
        founded_year: data.founded_year || new Date().getFullYear(),
        website: data.website || '',
        official_email: data.official_email || '',
        address_street: data.address_street || '',
        address_city: data.address_city || '',
        address_state: data.address_state || '',
        address_country: data.address_country || 'Россия',
        address_postal_code: data.address_postal_code || '',
        is_private: data.is_private || false,
        allow_public_discovery: data.allow_public_discovery !== false,
        logo_url: data.logo_url || '',
        banner_url: data.banner_url || ''
      });
    } catch (error) {
      console.error('Error loading organization:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingChangeRequests = async () => {
    try {
      const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem('zion_token');

      // Load both change requests and join requests
      const [changeResponse, joinResponse] = await Promise.all([
        fetch(`${BACKEND_URL}/api/work/organizations/${organizationId}/change-requests?status=PENDING`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${BACKEND_URL}/api/work/organizations/${organizationId}/join-requests`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      let totalCount = 0;

      if (changeResponse.ok) {
        const changeData = await changeResponse.json();
        totalCount += changeData.data?.length || 0;
      }

      if (joinResponse.ok) {
        const joinData = await joinResponse.json();
        const pendingJoinRequests = (joinData.requests || []).filter(r => r.status === 'pending');
        totalCount += pendingJoinRequests.length;
      }

      setPendingChangeRequestsCount(totalCount);
    } catch (error) {
      console.error('Error loading pending requests:', error);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleImageUpload = (field, event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Размер файла не должен превышать 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      handleChange(field, reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.description) {
      setError('Название и описание обязательны');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem('zion_token');

      const response = await fetch(`${BACKEND_URL}/api/work/organizations/${organizationId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Не удалось обновить организацию');
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess && onSuccess();
      }, 1500);

    } catch (error) {
      console.error('Error updating organization:', error);
      setError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLeaveOrganization = async () => {
    setLeaving(true);
    setError(null);

    try {
      const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem('zion_token');

      const response = await fetch(`${BACKEND_URL}/api/work/organizations/${organizationId}/leave`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Не удалось покинуть организацию');
      }

      // Call the callback to return to organization list
      onLeaveOrganization && onLeaveOrganization();

    } catch (error) {
      console.error('Error leaving organization:', error);
      setError(error.message);
      setLeaving(false);
      setShowLeaveConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка настроек...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Настройки</h2>
            <p className="text-sm text-gray-600 mt-1">{organization?.name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors duration-200"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Main Tabs (Company / Personal) */}
        {currentMembership?.is_admin && (
          <div className="border-b border-gray-200 px-6 bg-gray-50">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab('company')}
                className={`px-6 py-4 font-semibold text-base border-b-3 transition-all duration-200 ${
                  activeTab === 'company'
                    ? 'text-orange-600 border-orange-600 border-b-3'
                    : 'text-gray-600 border-transparent hover:text-gray-900'
                }`}
                style={{ borderBottomWidth: activeTab === 'company' ? '3px' : '0' }}
              >
                <Building2 className="w-5 h-5 inline-block mr-2" />
                Настройки Компании
              </button>
              <button
                onClick={() => setActiveTab('personal')}
                className={`px-6 py-4 font-semibold text-base border-b-3 transition-all duration-200 ${
                  activeTab === 'personal'
                    ? 'text-orange-600 border-orange-600 border-b-3'
                    : 'text-gray-600 border-transparent hover:text-gray-900'
                }`}
                style={{ borderBottomWidth: activeTab === 'personal' ? '3px' : '0' }}
              >
                <UserCog className="w-5 h-5 inline-block mr-2" />
                МОИ НАСТРОЙКИ
              </button>
            </div>
          </div>
        )}

        {/* Sub-Navigation Tabs (for Company Settings only) */}
        {activeTab === 'company' && currentMembership?.is_admin && (
          <div className="border-b border-gray-200 px-6">
            <div className="flex gap-1">
              {[
                { id: 'basic', label: 'Основное', icon: Building2 },
                { id: 'contact', label: 'Контакты', icon: Mail },
                { id: 'media', label: 'Медиа', icon: Image },
                { id: 'privacy', label: 'Приватность', icon: Globe },
                { id: 'requests', label: 'Запросы', icon: Clock, badge: pendingChangeRequestsCount }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSection(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 font-medium transition-all duration-200 border-b-2 relative ${
                    activeSection === tab.id
                      ? 'text-orange-600 border-orange-600'
                      : 'text-gray-600 border-transparent hover:text-gray-900'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  {/* Badge for pending requests */}
                  {tab.badge > 0 && (
                    <span className="ml-1 min-w-[20px] h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1.5">
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Personal Settings Tab Content */}
          {activeTab === 'personal' && (
            <WorkMemberSettings
              organizationId={organizationId}
              currentMembership={currentMembership}
              onClose={onClose}
              onUpdate={() => {
                loadOrganization();
                if (onSuccess) onSuccess();
              }}
            />
          )}

          {/* Company Settings Tab Content */}
          {activeTab === 'company' && currentMembership?.is_admin && (
            <>
              {/* Change Requests Section (NEW) */}
              {activeSection === 'requests' && (
                <WorkChangeRequestsManager 
                  organizationId={organizationId}
                  onRequestHandled={() => {
                    loadPendingChangeRequests();
                    if (onSuccess) onSuccess();
                  }}
                />
              )}

              {/* Success Message */}
              {activeSection !== 'requests' && success && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3 mb-6">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-green-900">Сохранено!</h3>
                    <p className="text-sm text-green-700 mt-1">Настройки организации успешно обновлены.</p>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {activeSection !== 'requests' && error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 mb-6">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-red-900">Ошибка</h3>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                  </div>
                </div>
              )}

          {/* Basic Info Section */}
          {activeSection === 'basic' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Название *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Тип организации</label>
                <select
                  value={formData.organization_type}
                  onChange={(e) => handleChange('organization_type', e.target.value)}
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Описание *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Индустрия</label>
                  <select
                    value={formData.industry}
                    onChange={(e) => handleChange('industry', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">Выберите индустрию</option>
                    {Industries.map(ind => (
                      <option key={ind} value={ind}>{ind}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Размер</label>
                  <select
                    value={formData.organization_size}
                    onChange={(e) => handleChange('organization_size', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    {OrganizationSizes.map(size => (
                      <option key={size} value={size}>{size} сотрудников</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Год основания</label>
                <input
                  type="number"
                  value={formData.founded_year}
                  onChange={(e) => handleChange('founded_year', parseInt(e.target.value))}
                  min="1800"
                  max={new Date().getFullYear()}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          {/* Contact Info Section */}
          {activeSection === 'contact' && (
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Веб-сайт</label>
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => handleChange('website', e.target.value)}
                    placeholder="https://example.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.official_email}
                    onChange={(e) => handleChange('official_email', e.target.value)}
                    placeholder="info@example.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Адрес</label>
                <input
                  type="text"
                  value={formData.address_street}
                  onChange={(e) => handleChange('address_street', e.target.value)}
                  placeholder="Проспект Буденновский, 15"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Город</label>
                  <input
                    type="text"
                    value={formData.address_city}
                    onChange={(e) => handleChange('address_city', e.target.value)}
                    placeholder="Ростов-на-Дону"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Область/Регион</label>
                  <input
                    type="text"
                    value={formData.address_state}
                    onChange={(e) => handleChange('address_state', e.target.value)}
                    placeholder="Ростовская область"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Страна</label>
                  <input
                    type="text"
                    value={formData.address_country}
                    onChange={(e) => handleChange('address_country', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Индекс</label>
                  <input
                    type="text"
                    value={formData.address_postal_code}
                    onChange={(e) => handleChange('address_postal_code', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Media Section */}
          {activeSection === 'media' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Логотип</label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
                  {formData.logo_url ? (
                    <div className="relative inline-block">
                      <img src={formData.logo_url} alt="Logo" className="w-32 h-32 object-cover rounded-xl" />
                      <button
                        onClick={() => handleChange('logo_url', '')}
                        className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <Upload className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-600 mb-2">Загрузите логотип</p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload('logo_url', e)}
                        className="hidden"
                        id="logo-upload"
                      />
                      <label
                        htmlFor="logo-upload"
                        className="inline-block px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 cursor-pointer"
                      >
                        Выбрать файл
                      </label>
                      <p className="text-xs text-gray-500 mt-2">Макс. 5MB</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Баннер</label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
                  {formData.banner_url ? (
                    <div className="relative inline-block">
                      <img src={formData.banner_url} alt="Banner" className="w-full max-w-md h-32 object-cover rounded-xl" />
                      <button
                        onClick={() => handleChange('banner_url', '')}
                        className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <Upload className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-600 mb-2">Загрузите баннер</p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload('banner_url', e)}
                        className="hidden"
                        id="banner-upload"
                      />
                      <label
                        htmlFor="banner-upload"
                        className="inline-block px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 cursor-pointer"
                      >
                        Выбрать файл
                      </label>
                      <p className="text-xs text-gray-500 mt-2">Рекомендуется 1200x400px, макс. 5MB</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Privacy Section */}
          {activeSection === 'privacy' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm text-blue-700">
                  Настройки приватности определяют, кто может видеть вашу организацию и её контент.
                </p>
              </div>

              <label className="flex items-start gap-3 cursor-pointer p-4 border border-gray-200 rounded-xl hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={!formData.is_private}
                  onChange={(e) => handleChange('is_private', !e.target.checked)}
                  className="w-5 h-5 text-orange-500 rounded mt-1"
                />
                <div>
                  <div className="font-medium text-gray-900">Публичная организация</div>
                  <div className="text-sm text-gray-600">Любой пользователь может просматривать профиль организации</div>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer p-4 border border-gray-200 rounded-xl hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={formData.allow_public_discovery}
                  onChange={(e) => handleChange('allow_public_discovery', e.target.checked)}
                  className="w-5 h-5 text-orange-500 rounded mt-1"
                />
                <div>
                  <div className="font-medium text-gray-900">Разрешить поиск</div>
                  <div className="text-sm text-gray-600">Организация будет отображаться в результатах поиска</div>
                </div>
              </label>

              {/* Danger Zone */}
              <div className="mt-8 pt-8 border-t-2 border-red-200">
                <h3 className="text-lg font-semibold text-red-900 mb-4">Опасная зона</h3>
                
                {/* Transfer Ownership (only for owner) */}
                {organization?.creator_id === currentUserId && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <Crown className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-orange-900">Передать владение</h4>
                        <p className="text-sm text-orange-700 mt-1">
                          Вы можете передать полный контроль над организацией другому администратору.
                        </p>
                        <button
                          onClick={() => setShowTransferOwnership(true)}
                          className="mt-3 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-all duration-200 flex items-center gap-2"
                        >
                          <Crown className="w-4 h-4" />
                          Передать владение
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-red-900">Покинуть организацию</h4>
                      <p className="text-sm text-red-700 mt-1">
                        После выхода вы потеряете доступ ко всему контенту организации и чатам. Это действие нельзя отменить.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowLeaveConfirm(true)}
                  className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-all duration-200 flex items-center gap-2"
                >
                  <LogOut className="w-5 h-5" />
                  Покинуть компанию
                </button>
              </div>
            </div>
          )}
            </>
          )}
        </div>

        {/* Footer - Only show for company settings */}
        {activeTab === 'company' && currentMembership?.is_admin && (
          <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-colors duration-200 font-semibold text-gray-700"
            disabled={saving}
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={saving || success}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl hover:shadow-lg transition-all duration-200 font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Сохранение...
              </>
            ) : success ? (
              'Сохранено!'
            ) : (
              <>
                <Save className="w-5 h-5" />
                Сохранить изменения
              </>
            )}
          </button>
        </div>
        )}
      </div>

      {/* Leave Confirmation Dialog */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            <div className="p-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              
              <h3 className="text-2xl font-bold text-gray-900 text-center mb-2">
                Покинуть организацию?
              </h3>
              
              <p className="text-gray-600 text-center mb-6">
                Вы уверены, что хотите покинуть "{organization?.name}"? Это действие нельзя отменить, и вам придется запросить новое приглашение для возврата.
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowLeaveConfirm(false)}
                  disabled={leaving}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-colors duration-200 font-semibold text-gray-700"
                >
                  Отмена
                </button>
                <button
                  onClick={handleLeaveOrganization}
                  disabled={leaving}
                  className="flex-1 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all duration-200 font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {leaving ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Выход...
                    </>
                  ) : (
                    <>
                      <LogOut className="w-5 h-5" />
                      Покинуть
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Ownership Modal */}
      {showTransferOwnership && (
        <WorkTransferOwnershipModal
          organizationId={organizationId}
          organizationName={organization?.name}
          currentOwnerId={currentUserId}
          onClose={() => setShowTransferOwnership(false)}
          onSuccess={() => {
            setShowTransferOwnership(false);
            loadOrganization();
            onSuccess && onSuccess();
          }}
        />
      )}
    </div>
  );
};

export default WorkOrganizationSettings;