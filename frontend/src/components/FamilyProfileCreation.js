import React, { useState } from 'react';
import { ChevronLeft, Users, Home, Calendar, Globe, Lock, MapPin } from 'lucide-react';

const FamilyProfileCreation = ({ onBack, onFamilyCreated }) => {
  const [formData, setFormData] = useState({
    family_name: '',
    family_surname: '',
    description: '',
    public_bio: '',
    primary_address: '',
    city: '',
    state: '',
    country: '',
    established_date: '',
    is_private: true,
    allow_public_discovery: false
  });

  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // Multi-step form

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsCreating(true);
    setError('');

    try {
      const token = localStorage.getItem('zion_token');
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://myinfo-portal.preview.emergentagent.com';
      
      const response = await fetch(`${backendUrl}/api/family-profiles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const newFamily = await response.json();
        if (onFamilyCreated) {
          onFamilyCreated(newFamily);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to create family profile');
      }
    } catch (error) {
      console.error('Error creating family profile:', error);
      setError('Network error occurred while creating family profile');
    } finally {
      setIsCreating(false);
    }
  };

  const nextStep = () => {
    setStep(prev => Math.min(prev + 1, 3));
  };

  const prevStep = () => {
    setStep(prev => Math.max(prev - 1, 1));
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
          <Users className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Основная информация</h3>
        <p className="text-gray-600">Расскажите нам о вашей семье</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Название семьи *
          </label>
          <input
            type="text"
            name="family_name"
            value={formData.family_name}
            onChange={handleInputChange}
            placeholder="например: Семья Смирновых"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Фамилия семьи
          </label>
          <input
            type="text"
            name="family_surname"
            value={formData.family_surname}
            onChange={handleInputChange}
            placeholder="Смирнов"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Описание семьи
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Расскажите о вашей семье, интересах, традициях..."
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Дата создания семьи
          </label>
          <input
            type="date"
            name="established_date"
            value={formData.established_date}
            onChange={handleInputChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
          <MapPin className="w-8 h-8 text-blue-600" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Адрес и местоположение</h3>
        <p className="text-gray-600">Информация о месте проживания семьи</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Основной адрес
          </label>
          <input
            type="text"
            name="primary_address"
            value={formData.primary_address}
            onChange={handleInputChange}
            placeholder="ул. Примерная, д. 123, кв. 45"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Город
            </label>
            <input
              type="text"
              name="city"
              value={formData.city}
              onChange={handleInputChange}
              placeholder="Херсон"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Область/Регион
            </label>
            <input
              type="text"
              name="state"
              value={formData.state}
              onChange={handleInputChange}
              placeholder="Херсонская область"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Страна
          </label>
          <input
            type="text"
            name="country"
            value={formData.country}
            onChange={handleInputChange}
            placeholder="Украина"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Публичная информация о семье
          </label>
          <textarea
            name="public_bio"
            value={formData.public_bio}
            onChange={handleInputChange}
            placeholder="Краткая информация о семье, которую увидят подписчики..."
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
          <Lock className="w-8 h-8 text-purple-600" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Настройки приватности</h3>
        <p className="text-gray-600">Кто может видеть ваш семейный профиль</p>
      </div>

      <div className="space-y-6">
        <div className="bg-gray-50 rounded-lg p-6">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="is_private"
              name="is_private"
              checked={formData.is_private}
              onChange={handleInputChange}
              className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
            />
            <div>
              <label htmlFor="is_private" className="text-sm font-medium text-gray-900 cursor-pointer">
                Приватный семейный профиль
              </label>
              <p className="text-sm text-gray-600">
                Только приглашенные семьи смогут видеть ваш профиль
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-6">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="allow_public_discovery"
              name="allow_public_discovery"
              checked={formData.allow_public_discovery}
              onChange={handleInputChange}
              disabled={formData.is_private}
              className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500 disabled:opacity-50"
            />
            <div>
              <label htmlFor="allow_public_discovery" className={`text-sm font-medium cursor-pointer ${formData.is_private ? 'text-gray-400' : 'text-gray-900'}`}>
                Разрешить публичное обнаружение
              </label>
              <p className={`text-sm ${formData.is_private ? 'text-gray-400' : 'text-gray-600'}`}>
                Семьи могут найти ваш профиль через поиск
              </p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <Globe className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-blue-900">Важная информация</h4>
              <p className="text-sm text-blue-700 mt-1">
                Семейные профили работают по системе приглашений. Даже если профиль публичный, 
                другие семьи должны получить приглашение для подписки на ваши обновления.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center space-x-4 mb-8">
        <button
          onClick={onBack}
          className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 mr-1" />
          Назад
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Создание семейного профиля</h1>
          <p className="text-gray-600">Шаг {step} из 3</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center">
          {[1, 2, 3].map((i) => (
            <React.Fragment key={i}>
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                i <= step ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'
              }`}>
                {i}
              </div>
              {i < 3 && (
                <div className={`flex-1 h-1 mx-2 ${
                  i < step ? 'bg-green-500' : 'bg-gray-300'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-6">
          <button
            type="button"
            onClick={prevStep}
            disabled={step === 1}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              step === 1
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Назад
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={nextStep}
              disabled={step === 1 && !formData.family_name}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                (step === 1 && !formData.family_name)
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              Далее
            </button>
          ) : (
            <button
              type="submit"
              disabled={isCreating || !formData.family_name}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                isCreating || !formData.family_name
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {isCreating ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Создание...</span>
                </div>
              ) : (
                'Создать семейный профиль'
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default FamilyProfileCreation;