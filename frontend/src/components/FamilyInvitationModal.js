import React, { useState } from 'react';
import { 
  X, Mail, UserPlus, Users, Shield, Baby, AlertCircle, 
  Send, CheckCircle, Home, MessageCircle 
} from 'lucide-react';

const FamilyInvitationModal = ({ 
  isOpen, 
  onClose, 
  familyId, 
  familyName, 
  currentUserRole, 
  onInvitationSent 
}) => {
  const [formData, setFormData] = useState({
    invited_user_email: '',
    invitation_type: 'MEMBER',
    relationship_to_family: '',
    message: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState(1);

  const roleOptions = [
    {
      value: 'ADMIN',
      label: 'Администратор семьи',
      description: 'Может управлять семейным профилем и приглашать членов',
      icon: Shield,
      color: 'blue',
      restricted: currentUserRole !== 'CREATOR' && currentUserRole !== 'ADMIN'
    },
    {
      value: 'MEMBER',
      label: 'Член семьи (взрослый)',
      description: 'Взрослый член семьи с полными правами публикации',
      icon: Users,
      color: 'green',
      restricted: false
    },
    {
      value: 'CHILD',
      label: 'Ребенок',
      description: 'Детский аккаунт с ограниченными правами',
      icon: Baby,
      color: 'purple',
      restricted: false
    }
  ];

  const relationshipOptions = [
    'Супруг/Супруга', 'Сын', 'Дочь', 'Отец', 'Мать', 'Брат', 'Сестра',
    'Дедушка', 'Бабушка', 'Внук', 'Внучка', 'Дядя', 'Тетя', 
    'Племянник', 'Племянница', 'Двоюродный брат', 'Двоюродная сестра',
    'Свекор', 'Свекровь', 'Тесть', 'Теща', 'Зять', 'Невестка'
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const token = localStorage.getItem('zion_token');
      const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
      
      
      const response = await fetch(`${backendUrl}/api/family-profiles/${familyId}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const result = await response.json();
        setSuccess(true);
        if (onInvitationSent) {
          onInvitationSent(result);
        }
        
        // Auto-close after success message
        setTimeout(() => {
          onClose();
          setSuccess(false);
          setStep(1);
          setFormData({
            invited_user_email: '',
            invitation_type: 'MEMBER',
            relationship_to_family: '',
            message: ''
          });
        }, 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Не удалось отправить приглашение');
      }
    } catch (error) {
      console.error('Error sending invitation:', error);
      setError('Произошла ошибка при отправке приглашения');
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = () => {
    if (step === 1 && !formData.invited_user_email) {
      setError('Пожалуйста, введите email адрес');
      return;
    }
    setStep(prev => Math.min(prev + 1, 3));
    setError('');
  };

  const prevStep = () => {
    setStep(prev => Math.max(prev - 1, 1));
    setError('');
  };

  const selectedRole = roleOptions.find(role => role.value === formData.invitation_type);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {success ? 'Приглашение отправлено!' : 'Пригласить в семью'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {success ? 'Приглашение успешно отправлено' : `Семейный профиль "${familyName}"`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {success ? (
          /* Success State */
          <div className="p-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Приглашение отправлено!
            </h3>
            <p className="text-gray-600 mb-4">
              Приглашение отправлено на <strong>{formData.invited_user_email}</strong>
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-700">
                Приглашенный пользователь получит уведомление и сможет принять или отклонить приглашение в течение 7 дней.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Progress Indicator */}
            <div className="px-6 pt-4">
              <div className="flex items-center justify-center space-x-4 mb-4">
                {[1, 2, 3].map((i) => (
                  <React.Fragment key={i}>
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                      i <= step ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'
                    }`}>
                      {i}
                    </div>
                    {i < 3 && (
                      <div className={`flex-1 h-1 ${
                        i < step ? 'bg-green-500' : 'bg-gray-300'
                      }`} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div className="px-6 pb-6">
              {/* Step 1: Email Address */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-3">
                      <Mail className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Email приглашаемого
                    </h3>
                    <p className="text-gray-600">
                      Введите email адрес человека, которого хотите пригласить
                    </p>
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      Email адрес *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="invited_user_email"
                      value={formData.invited_user_email}
                      onChange={handleInputChange}
                      placeholder="example@email.com"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="flex items-start space-x-2">
                      <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
                      <div className="text-sm text-yellow-800">
                        <p><strong>Важно:</strong> Приглашайте только людей, которые действительно живут с вами в одном доме или являются близкими родственниками.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Role Selection */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-100 rounded-full mb-3">
                      <UserPlus className="w-6 h-6 text-purple-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Роль в семье
                    </h3>
                    <p className="text-gray-600">
                      Выберите подходящую роль для приглашаемого
                    </p>
                  </div>

                  <div className="space-y-3">
                    {roleOptions.map((role) => {
                      const IconComponent = role.icon;
                      const isSelected = formData.invitation_type === role.value;
                      const isDisabled = role.restricted;
                      
                      return (
                        <div
                          key={role.value}
                          className={`border rounded-lg p-4 cursor-pointer transition-all ${
                            isDisabled 
                              ? 'opacity-50 cursor-not-allowed bg-gray-50' 
                              : isSelected
                                ? `border-${role.color}-500 bg-${role.color}-50`
                                : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => !isDisabled && setFormData(prev => ({ ...prev, invitation_type: role.value }))}
                        >
                          <div className="flex items-start space-x-3">
                            <input
                              type="radio"
                              name="invitation_type"
                              value={role.value}
                              checked={isSelected}
                              onChange={handleInputChange}
                              disabled={isDisabled}
                              className="mt-1"
                            />
                            <IconComponent className={`w-5 h-5 mt-0.5 ${
                              isSelected ? `text-${role.color}-600` : 'text-gray-500'
                            }`} />
                            <div className="flex-1">
                              <h4 className={`font-medium ${
                                isSelected ? `text-${role.color}-900` : 'text-gray-900'
                              }`}>
                                {role.label}
                                {isDisabled && (
                                  <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded ml-2">
                                    Недоступно
                                  </span>
                                )}
                              </h4>
                              <p className={`text-sm ${
                                isSelected ? `text-${role.color}-700` : 'text-gray-600'
                              }`}>
                                {role.description}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 3: Relationship & Message */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-3">
                      <Home className="w-6 h-6 text-green-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Детали приглашения
                    </h3>
                    <p className="text-gray-600">
                      Дополнительная информация о приглашении
                    </p>
                  </div>

                  <div>
                    <label htmlFor="relationship" className="block text-sm font-medium text-gray-700 mb-2">
                      Родственная связь
                    </label>
                    <select
                      id="relationship"
                      name="relationship_to_family"
                      value={formData.relationship_to_family}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="">Выберите родственную связь</option>
                      {relationshipOptions.map((relationship) => (
                        <option key={relationship} value={relationship}>
                          {relationship}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                      Персональное сообщение (опционально)
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleInputChange}
                      placeholder="Привет! Приглашаю тебя присоединиться к нашему семейному профилю..."
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>

                  {/* Summary */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Сводка приглашения:</h4>
                    <div className="space-y-1 text-sm text-gray-600">
                      <p><strong>Email:</strong> {formData.invited_user_email}</p>
                      <p><strong>Роль:</strong> {selectedRole?.label}</p>
                      {formData.relationship_to_family && (
                        <p><strong>Родственная связь:</strong> {formData.relationship_to_family}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-between items-center p-6 border-t border-gray-200">
              <button
                type="button"
                onClick={step === 1 ? onClose : prevStep}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                {step === 1 ? 'Отмена' : 'Назад'}
              </button>

              {step < 3 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Далее
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                    isSubmitting
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                      <span>Отправка...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Отправить приглашение</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default FamilyInvitationModal;