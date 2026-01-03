/**
 * Business ERIC Settings Component
 * Settings panel for configuring ERIC AI for organizations
 */
import React, { useState, useEffect } from 'react';
import { Sparkles, Check, AlertCircle, Loader2, Save } from 'lucide-react';

const BusinessERICSettings = ({ organizationId, onSave }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [settings, setSettings] = useState({
    is_active: true,
    share_public_data: true,
    share_promotions: true,
    share_repeat_customer_stats: false,
    share_ratings_reviews: false,
    allow_user_eric_queries: true,
    share_aggregated_analytics: false,
    business_description: '',
    specialties: []
  });

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    loadSettings();
  }, [organizationId]);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${BACKEND_URL}/api/work/organizations/${organizationId}/eric-settings`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (response.ok) {
        const data = await response.json();
        setSettings(prev => ({
          ...prev,
          ...data
        }));
      }
    } catch (err) {
      console.error('Error loading ERIC settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
    setSuccess(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${BACKEND_URL}/api/work/organizations/${organizationId}/eric-settings`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(settings)
        }
      );
      
      if (response.ok) {
        setSuccess(true);
        if (onSave) onSave();
        setTimeout(() => setSuccess(false), 3000);
      } else {
        const data = await response.json();
        setError(data.detail || 'Ошибка сохранения');
      }
    } catch (err) {
      setError('Ошибка соединения');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-orange-200 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-orange-900">ERIC AI для бизнеса</h3>
            <p className="text-sm text-orange-700">
              Настройте ИИ-помощника для вашей организации
            </p>
          </div>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-700">{error}</span>
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <Check className="w-5 h-5 text-green-500" />
          <span className="text-green-700">Настройки сохранены!</span>
        </div>
      )}

      {/* Business ERIC Status */}
      <div className="p-4 border border-gray-200 rounded-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${settings.is_active ? 'bg-green-100' : 'bg-gray-100'}`}>
              <Check className={`w-5 h-5 ${settings.is_active ? 'text-green-600' : 'text-gray-400'}`} />
            </div>
            <div>
              <div className="font-medium text-gray-900">ERIC Business</div>
              <div className="text-sm text-gray-600">ИИ-помощник для бизнеса</div>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.is_active}
              onChange={(e) => handleChange('is_active', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
          </label>
        </div>
      </div>

      {/* Data Access Settings */}
      <div>
        <h4 className="font-semibold text-gray-900 mb-3">Доступ к данным</h4>
        <p className="text-sm text-gray-600 mb-4">
          Выберите, какие данные ERIC Business может использовать для ответов на запросы пользователей.
        </p>
        
        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer p-4 border border-gray-200 rounded-xl hover:bg-gray-50">
            <input
              type="checkbox"
              checked={settings.share_public_data}
              onChange={(e) => handleChange('share_public_data', e.target.checked)}
              className="w-5 h-5 text-orange-500 rounded mt-0.5"
            />
            <div>
              <div className="font-medium text-gray-900">Публичные данные компании</div>
              <div className="text-sm text-gray-600">Информация о компании, услуги, контакты</div>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer p-4 border border-gray-200 rounded-xl hover:bg-gray-50">
            <input
              type="checkbox"
              checked={settings.share_promotions}
              onChange={(e) => handleChange('share_promotions', e.target.checked)}
              className="w-5 h-5 text-orange-500 rounded mt-0.5"
            />
            <div>
              <div className="font-medium text-gray-900">Акции и купоны</div>
              <div className="text-sm text-gray-600">Текущие скидки и специальные предложения</div>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer p-4 border border-gray-200 rounded-xl hover:bg-gray-50">
            <input
              type="checkbox"
              checked={settings.share_repeat_customer_stats}
              onChange={(e) => handleChange('share_repeat_customer_stats', e.target.checked)}
              className="w-5 h-5 text-orange-500 rounded mt-0.5"
            />
            <div>
              <div className="font-medium text-gray-900">Аналитика повторных клиентов</div>
              <div className="text-sm text-gray-600">Агрегированная статистика лояльности (без личных данных)</div>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer p-4 border border-gray-200 rounded-xl hover:bg-gray-50">
            <input
              type="checkbox"
              checked={settings.share_ratings_reviews}
              onChange={(e) => handleChange('share_ratings_reviews', e.target.checked)}
              className="w-5 h-5 text-orange-500 rounded mt-0.5"
            />
            <div>
              <div className="font-medium text-gray-900">Рейтинги и отзывы</div>
              <div className="text-sm text-gray-600">Средний рейтинг и тренды отзывов</div>
            </div>
          </label>
        </div>
      </div>

      {/* Query Permissions */}
      <div>
        <h4 className="font-semibold text-gray-900 mb-3">Разрешения на запросы</h4>
        <p className="text-sm text-gray-600 mb-4">
          Настройте, как другие ERIC-агенты могут взаимодействовать с вашим бизнес-помощником.
        </p>
        
        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer p-4 border border-gray-200 rounded-xl hover:bg-gray-50">
            <input
              type="checkbox"
              checked={settings.allow_user_eric_queries}
              onChange={(e) => handleChange('allow_user_eric_queries', e.target.checked)}
              className="w-5 h-5 text-orange-500 rounded mt-0.5"
            />
            <div>
              <div className="font-medium text-gray-900">Разрешить запросы от пользователей ERIC</div>
              <div className="text-sm text-gray-600">Персональные ERIC-помощники могут запрашивать публичную информацию</div>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer p-4 border border-gray-200 rounded-xl hover:bg-gray-50">
            <input
              type="checkbox"
              checked={settings.share_aggregated_analytics}
              onChange={(e) => handleChange('share_aggregated_analytics', e.target.checked)}
              className="w-5 h-5 text-orange-500 rounded mt-0.5"
            />
            <div>
              <div className="font-medium text-gray-900">Делиться агрегированной аналитикой</div>
              <div className="text-sm text-gray-600">Позволить ERIC сообщать % повторных клиентов при запросах</div>
            </div>
          </label>
        </div>
      </div>

      {/* Business Description */}
      <div>
        <h4 className="font-semibold text-gray-900 mb-3">Описание для ERIC</h4>
        <p className="text-sm text-gray-600 mb-4">
          Опишите ваш бизнес для более точных ответов ERIC (опционально)
        </p>
        <textarea
          value={settings.business_description || ''}
          onChange={(e) => handleChange('business_description', e.target.value)}
          placeholder="Например: Мы специализируемся на ремонте автомобилей немецких марок с 2010 года..."
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          rows={3}
        />
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h4 className="font-medium text-blue-900 mb-2">Как это работает?</h4>
        <ul className="text-sm text-blue-700 space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-blue-500 mt-1">•</span>
            <span>Когда пользователь спрашивает ERIC о вашем бизнесе, его ERIC отправляет запрос вашему ERIC Business</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500 mt-1">•</span>
            <span>ERIC Business отвечает только разрешённой публичной информацией</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500 mt-1">•</span>
            <span>Приватные данные (финансы, личные контакты клиентов) никогда не передаются</span>
          </li>
        </ul>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t border-gray-200">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:shadow-lg transition-all duration-200 font-semibold disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Сохранение...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Сохранить настройки ERIC
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default BusinessERICSettings;
