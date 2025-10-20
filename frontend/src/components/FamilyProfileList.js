import React, { useState, useEffect } from 'react';
import { 
  Users, Plus, Home, MapPin, Calendar, Crown, Shield, 
  UserCheck, Settings, Eye, ChevronRight
} from 'lucide-react';

const FamilyProfileList = ({ onCreateFamily, onViewFamily, onManageFamily }) => {
  const [familyProfiles, setFamilyProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchFamilyProfiles();
  }, []);

  const fetchFamilyProfiles = async () => {
    try {
      const token = localStorage.getItem('zion_token');
      const backendUrl = process.env.REACT_APP_BACKEND_URL;
      if (!backendUrl) throw new Error('Backend URL not configured');
      
      const response = await fetch(`${backendUrl}/api/family-profiles`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setFamilyProfiles(data.family_profiles || []);
      } else {
        setError('Не удалось загрузить семейные профили');
      }
    } catch (error) {
      console.error('Error fetching family profiles:', error);
      setError('Произошла ошибка при загрузке семейных профилей');
    } finally {
      setLoading(false);
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'CREATOR':
        return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'ADMIN':
        return <Shield className="w-4 h-4 text-blue-500" />;
      case 'ADULT_MEMBER':
        return <UserCheck className="w-4 h-4 text-green-500" />;
      case 'CHILD':
        return <Users className="w-4 h-4 text-purple-500" />;
      default:
        return <Users className="w-4 h-4 text-gray-500" />;
    }
  };

  const getRoleDisplayName = (role) => {
    const roleNames = {
      'CREATOR': 'Создатель',
      'ADMIN': 'Администратор',
      'ADULT_MEMBER': 'Член семьи',
      'CHILD': 'Ребенок'
    };
    return roleNames[role] || role;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Семейные профили</h1>
          <p className="text-gray-600">
            Управляйте семейными профилями и приглашайте родственников
          </p>
        </div>
        
        <button
          onClick={onCreateFamily}
          className="flex items-center space-x-2 px-6 py-3 text-white rounded-lg transition-colors"
          style={{ background: '#4CAF50' }}
          onMouseOver={(e) => e.target.style.background = '#45a049'}
          onMouseOut={(e) => e.target.style.background = '#4CAF50'}
        >
          <Plus className="w-5 h-5" />
          <span>Создать семейный профиль</span>
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Family Profiles Grid */}
      {familyProfiles.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
            <Users className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            У вас пока нет семейных профилей
          </h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Создайте семейный профиль, чтобы делиться новостями и событиями 
            с родственниками и друзьями семьи
          </p>
          <button
            onClick={onCreateFamily}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Создать первый семейный профиль</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {familyProfiles.map((family) => (
            <div key={family.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              {/* Family Cover */}
              <div className="h-32 relative" style={{ background: 'linear-gradient(135deg, #30A67E 0%, #4CAF50 100%)' }}>
                {family.family_photo_url ? (
                  <img 
                    src={family.family_photo_url} 
                    alt={family.family_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full" style={{ background: 'linear-gradient(135deg, #30A67E 0%, #4CAF50 100%)' }} />
                )}
                
                {/* Privacy Indicator */}
                <div className="absolute top-3 right-3">
                  <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${
                    family.is_private 
                      ? 'bg-red-100 text-red-700' 
                      : 'bg-green-100 text-green-700'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${
                      family.is_private ? 'bg-red-500' : 'bg-green-500'
                    }`} />
                    <span>{family.is_private ? 'Приватный' : 'Публичный'}</span>
                  </div>
                </div>
              </div>

              {/* Family Info */}
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {family.family_name}
                    </h3>
                    {family.family_surname && (
                      <p className="text-sm text-gray-600">
                        Фамилия: {family.family_surname}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-1 ml-2">
                    {getRoleIcon(family.user_role)}
                    <span className="text-xs text-gray-500">
                      {getRoleDisplayName(family.user_role)}
                    </span>
                  </div>
                </div>

                {family.public_bio && (
                  <p className="text-sm text-gray-700 mb-4 line-clamp-2">
                    {family.public_bio}
                  </p>
                )}

                {/* Family Stats */}
                <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-1">
                      <Users className="w-3 h-3" />
                      <span>{family.member_count} {family.member_count === 1 ? 'член' : 'членов'}</span>
                    </div>
                    
                    {family.city && (
                      <div className="flex items-center space-x-1">
                        <MapPin className="w-3 h-3" />
                        <span>{family.city}</span>
                      </div>
                    )}
                  </div>

                  {family.established_date && (
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(family.established_date).getFullYear()}</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onViewFamily(family.id)}
                    className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-lg transition-colors"
                    style={{ background: '#E8F5E9', color: '#1A5E3B' }}
                    onMouseOver={(e) => e.target.style.background = '#C8E6C9'}
                    onMouseOut={(e) => e.target.style.background = '#E8F5E9'}
                  >
                    <Eye className="w-4 h-4" />
                    <span className="text-sm font-medium">Просмотр</span>
                  </button>
                  
                  {(family.user_role === 'CREATOR' || family.user_role === 'ADMIN') && (
                    <button
                      onClick={() => onManageFamily(family.id)}
                      className="flex items-center justify-center px-3 py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                      title="Управление семьей"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  )}
                  
                  <button
                    onClick={() => onViewFamily(family.id)}
                    className="flex items-center justify-center px-3 py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                    title="Подробнее"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Section */}
      {familyProfiles.length > 0 && (
        <div className="mt-12 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-start space-x-3">
            <Home className="w-6 h-6 text-blue-500 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">
                О семейных профилях
              </h3>
              <div className="text-sm text-blue-700 space-y-2">
                <p>
                  <strong>Семейные профили</strong> позволяют создавать отдельные страницы для каждого домохозяйства 
                  и делиться семейными новостями с приглашенными родственниками.
                </p>
                <p>
                  <strong>Приватность:</strong> Все семейные профили работают по системе приглашений. 
                  Только приглашенные семьи могут подписаться на ваши обновления.
                </p>
                <p>
                  <strong>Роли:</strong> Создатели и администраторы могут приглашать членов семьи, 
                  управлять настройками и модерировать контент.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FamilyProfileList;