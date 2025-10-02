import React, { useState } from 'react';
import { 
  MessageCircle, Camera, Calendar, Trophy, Briefcase, 
  Globe, Users, Shield, Pin, X, Image, FileText
} from 'lucide-react';

const FamilyPostComposer = ({ familyId, familyName, userRole, onClose, onPostCreated }) => {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    content_type: 'ANNOUNCEMENT',
    privacy_level: 'PUBLIC',
    target_audience: 'SUBSCRIBERS',
    is_pinned: false
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const contentTypes = [
    { value: 'ANNOUNCEMENT', label: 'Объявление', icon: MessageCircle, color: 'blue' },
    { value: 'PHOTO_ALBUM', label: 'Фотоальбом', icon: Camera, color: 'green' },
    { value: 'EVENT', label: 'Событие', icon: Calendar, color: 'purple' },
    { value: 'MILESTONE', label: 'Достижение', icon: Trophy, color: 'yellow' },
    { value: 'BUSINESS_UPDATE', label: 'Бизнес-новости', icon: Briefcase, color: 'gray' }
  ];

  const privacyLevels = [
    { 
      value: 'PUBLIC', 
      label: 'Публично', 
      description: 'Видно всем подписанным семьям',
      icon: Globe,
      color: 'green'
    },
    { 
      value: 'FAMILY_ONLY', 
      label: 'Только семья', 
      description: 'Видно только членам семьи',
      icon: Users,
      color: 'blue'
    },
    { 
      value: 'ADMIN_ONLY', 
      label: 'Только админы', 
      description: 'Видно только администраторам семьи',
      icon: Shield,
      color: 'red',
      adminOnly: true
    }
  ];

  const canUseAdminOnly = userRole === 'CREATOR' || userRole === 'ADMIN';
  const isChild = userRole === 'CHILD';

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const token = localStorage.getItem('zion_token');
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://famiconnect.preview.emergentagent.com';
      
      // If user is a child and tries to post publicly, force it to family-only
      let postData = { ...formData };
      if (isChild && postData.privacy_level === 'PUBLIC') {
        postData.privacy_level = 'FAMILY_ONLY';
      }
      
      const response = await fetch(`${backendUrl}/api/family-profiles/${familyId}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(postData)
      });

      if (response.ok) {
        const newPost = await response.json();
        if (onPostCreated) {
          onPostCreated(newPost);
        }
        onClose();
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Не удалось создать пост');
      }
    } catch (error) {
      console.error('Error creating family post:', error);
      setError('Произошла ошибка при создании поста');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedContentType = contentTypes.find(type => type.value === formData.content_type);
  const selectedPrivacyLevel = privacyLevels.find(level => level.value === formData.privacy_level);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Создать семейный пост</h2>
            <p className="text-sm text-gray-600 mt-1">
              Пост в семейном профиле "{familyName}"
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Content Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Тип контента
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {contentTypes.map((type) => {
                const IconComponent = type.icon;
                const isSelected = formData.content_type === type.value;
                
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, content_type: type.value }))}
                    className={`flex items-center space-x-2 p-3 rounded-lg border transition-all ${
                      isSelected
                        ? `bg-${type.color}-50 border-${type.color}-500 text-${type.color}-700`
                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <IconComponent className="w-4 h-4" />
                    <span className="text-sm font-medium">{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Заголовок (опционально)
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="Введите заголовок поста..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* Content */}
          <div>
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
              Содержание поста *
            </label>
            <textarea
              id="content"
              name="content"
              value={formData.content}
              onChange={handleInputChange}
              placeholder="О чем хотите рассказать семье?"
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            />
          </div>

          {/* Privacy Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Уровень приватности
            </label>
            <div className="space-y-3">
              {privacyLevels.map((level) => {
                if (level.adminOnly && !canUseAdminOnly) return null;
                
                const IconComponent = level.icon;
                const isSelected = formData.privacy_level === level.value;
                const isDisabled = isChild && level.value === 'PUBLIC';
                
                return (
                  <div
                    key={level.value}
                    className={`flex items-start space-x-3 p-4 border rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? `bg-${level.color}-50 border-${level.color}-500`
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => !isDisabled && setFormData(prev => ({ ...prev, privacy_level: level.value }))}
                  >
                    <input
                      type="radio"
                      name="privacy_level"
                      value={level.value}
                      checked={isSelected}
                      onChange={handleInputChange}
                      disabled={isDisabled}
                      className="mt-1"
                    />
                    <IconComponent className={`w-5 h-5 mt-0.5 ${
                      isSelected ? `text-${level.color}-600` : 'text-gray-500'
                    }`} />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className={`font-medium ${
                          isSelected ? `text-${level.color}-900` : 'text-gray-900'
                        }`}>
                          {level.label}
                        </h4>
                        {isDisabled && (
                          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                            Недоступно для детей
                          </span>
                        )}
                      </div>
                      <p className={`text-sm ${
                        isSelected ? `text-${level.color}-700` : 'text-gray-600'
                      }`}>
                        {level.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {isChild && (
              <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Для детей:</strong> Публичные посты могут быть одобрены родителями или администраторами 
                  для показа подписчикам семьи.
                </p>
              </div>
            )}
          </div>

          {/* Pin Option (for admins only) */}
          {canUseAdminOnly && (
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="is_pinned"
                name="is_pinned"
                checked={formData.is_pinned}
                onChange={handleInputChange}
                className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
              />
              <label htmlFor="is_pinned" className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                <Pin className="w-4 h-4" />
                <span>Закрепить пост (важные объявления)</span>
              </label>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              Пост будет опубликован от вашего имени
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Отмена
              </button>
              
              <button
                type="submit"
                disabled={isSubmitting || !formData.content.trim()}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  isSubmitting || !formData.content.trim()
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {isSubmitting ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Публикация...</span>
                  </div>
                ) : (
                  'Опубликовать'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FamilyPostComposer;