import React, { useState, useEffect } from 'react';
import { 
  Users, MapPin, Calendar, Settings, UserPlus, MessageCircle, 
  Heart, Image, FileText, Trophy, Briefcase, Camera, Share2, Edit3
} from 'lucide-react';

const FamilyProfilePage = ({ familyId, currentUser, onBack, onInviteMember }) => {
  const [familyProfile, setFamilyProfile] = useState(null);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [familyPosts, setFamilyPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('timeline');
  const [isUserMember, setIsUserMember] = useState(false);
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    if (familyId) {
      fetchFamilyProfile();
      fetchFamilyMembers();
      fetchFamilyPosts();
    }
  }, [familyId]);

  const fetchFamilyProfile = async () => {
    try {
      const token = localStorage.getItem('zion_token');
      const backendUrl = process.env.REACT_APP_BACKEND_URL;
      
      if (!backendUrl) {
        throw new Error('Backend URL not configured');
      }
      
      const response = await fetch(`${backendUrl}/api/family-profiles/${familyId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setFamilyProfile(data);
        setIsUserMember(data.is_user_member || false);
        setUserRole(data.user_role || '');
      }
    } catch (error) {
      console.error('Error fetching family profile:', error);
    }
  };

  const fetchFamilyMembers = async () => {
    try {
      const token = localStorage.getItem('zion_token');
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://family-profile-hub.preview.emergentagent.com';
      
      const response = await fetch(`${backendUrl}/api/family-profiles/${familyId}/members`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setFamilyMembers(data.family_members || []);
      }
    } catch (error) {
      console.error('Error fetching family members:', error);
    }
  };

  const fetchFamilyPosts = async () => {
    try {
      const token = localStorage.getItem('zion_token');
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://family-profile-hub.preview.emergentagent.com';
      
      const response = await fetch(`${backendUrl}/api/family-profiles/${familyId}/posts`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setFamilyPosts(data.family_posts || []);
      }
    } catch (error) {
      console.error('Error fetching family posts:', error);
    } finally {
      setLoading(false);
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

  const getContentTypeIcon = (contentType) => {
    const icons = {
      'ANNOUNCEMENT': MessageCircle,
      'PHOTO_ALBUM': Camera,
      'EVENT': Calendar,
      'MILESTONE': Trophy,
      'BUSINESS_UPDATE': Briefcase
    };
    const IconComponent = icons[contentType] || MessageCircle;
    return <IconComponent className="w-4 h-4" />;
  };

  const getContentTypeLabel = (contentType) => {
    const labels = {
      'ANNOUNCEMENT': 'Объявление',
      'PHOTO_ALBUM': 'Фотоальбом',
      'EVENT': 'Событие',
      'MILESTONE': 'Достижение',
      'BUSINESS_UPDATE': 'Бизнес-новости'
    };
    return labels[contentType] || contentType;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatPostDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!familyProfile) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Семейный профиль не найден</p>
        <button 
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          Назад
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Family Cover Section */}
      <div className="relative">
        <div className="h-48 bg-gradient-to-r from-green-500 to-green-700 rounded-t-xl" style={{ background: 'linear-gradient(135deg, #30A67E 0%, #4CAF50 100%)' }}></div>
        
        {/* Family Photo */}
        <div className="absolute -bottom-16 left-8">
          <div className="w-32 h-32 bg-white rounded-full shadow-lg border-4 border-white overflow-hidden">
            {familyProfile.family_photo_url ? (
              <img 
                src={familyProfile.family_photo_url} 
                alt={familyProfile.family_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                <Users className="w-16 h-16 text-gray-400" />
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="absolute top-4 right-4 flex space-x-2">
          {isUserMember && (userRole === 'CREATOR' || userRole === 'ADMIN') && (
            <button className="bg-white bg-opacity-90 hover:bg-opacity-100 p-2 rounded-lg shadow-lg transition-all">
              <Settings className="w-5 h-5 text-gray-700" />
            </button>
          )}
          <button className="bg-white bg-opacity-90 hover:bg-opacity-100 p-2 rounded-lg shadow-lg transition-all">
            <Share2 className="w-5 h-5 text-gray-700" />
          </button>
        </div>
      </div>

      {/* Family Info Section */}
      <div className="bg-white rounded-b-xl shadow-lg p-8 pt-20">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {familyProfile.family_name}
            </h1>
            
            {familyProfile.family_surname && (
              <p className="text-lg text-gray-600 mb-3">
                Фамилия: {familyProfile.family_surname}
              </p>
            )}

            {familyProfile.public_bio && (
              <p className="text-gray-700 mb-4">
                {familyProfile.public_bio}
              </p>
            )}

            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              {familyProfile.primary_address && (
                <div className="flex items-center space-x-1">
                  <MapPin className="w-4 h-4" />
                  <span>{familyProfile.city || familyProfile.primary_address}</span>
                </div>
              )}
              
              {familyProfile.established_date && (
                <div className="flex items-center space-x-1">
                  <Calendar className="w-4 h-4" />
                  <span>С {formatDate(familyProfile.established_date)}</span>
                </div>
              )}

              <div className="flex items-center space-x-1">
                <Users className="w-4 h-4" />
                <span>{familyProfile.member_count} {familyProfile.member_count === 1 ? 'член' : 'членов'}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 md:mt-0 flex space-x-3">
            {!isUserMember && (
              <button className="px-6 py-3 text-white rounded-lg hover:opacity-90 flex items-center space-x-2" style={{ background: '#4CAF50' }}>
                <UserPlus className="w-5 h-5" />
                <span>Подписаться</span>
              </button>
            )}
            
            {isUserMember && (
              <button className="px-6 py-3 text-white rounded-lg hover:opacity-90 flex items-center space-x-2" style={{ background: '#4CAF50' }}>
                <Edit3 className="w-5 h-5" />
                <span>Создать пост</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="mt-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {['timeline', 'members', 'about'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab
                    ? 'border-green-600 text-green-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                style={activeTab === tab ? { borderColor: '#4CAF50', color: '#1A5E3B' } : {}}
              >
                {tab === 'timeline' && 'Лента'}
                {tab === 'members' && 'Члены семьи'}
                {tab === 'about' && 'О семье'}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'timeline' && (
          <div className="space-y-6">
            {familyPosts.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl shadow-sm">
                <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Пока нет семейных постов</p>
                {isUserMember && (
                  <button className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                    Создать первый пост
                  </button>
                )}
              </div>
            ) : (
              familyPosts.map((post) => (
                <div key={post.id} className="bg-white rounded-xl shadow-sm p-6">
                  {/* Post Header */}
                  <div className="flex items-start space-x-3 mb-4">
                    <div className="w-10 h-10 bg-gray-200 rounded-full overflow-hidden">
                      {post.author.avatar_url ? (
                        <img 
                          src={post.author.avatar_url} 
                          alt={post.author.first_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-300 flex items-center justify-center">
                          <span className="text-gray-600 text-xs font-medium">
                            {post.author.first_name[0]}{post.author.last_name[0]}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium text-gray-900">
                          {post.author.first_name} {post.author.last_name}
                        </h4>
                        <div className="flex items-center space-x-1 text-sm text-gray-500">
                          {getContentTypeIcon(post.content_type)}
                          <span>{getContentTypeLabel(post.content_type)}</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500">
                        {formatPostDate(post.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* Post Content */}
                  {post.title && (
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {post.title}
                    </h3>
                  )}
                  
                  <p className="text-gray-700 mb-4">{post.content}</p>

                  {/* Post Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div className="flex items-center space-x-4">
                      <button className="flex items-center space-x-2 text-gray-500 hover:text-red-500 transition-colors">
                        <Heart className="w-5 h-5" />
                        <span className="text-sm">{post.likes_count}</span>
                      </button>
                      
                      <button className="flex items-center space-x-2 text-gray-500 hover:text-blue-500 transition-colors">
                        <MessageCircle className="w-5 h-5" />
                        <span className="text-sm">{post.comments_count}</span>
                      </button>
                    </div>

                    <div className="text-xs text-gray-400">
                      {post.privacy_level === 'PUBLIC' && '🌍 Публично'}
                      {post.privacy_level === 'FAMILY_ONLY' && '👨‍👩‍👧‍👦 Только семья'}
                      {post.privacy_level === 'ADMIN_ONLY' && '🔒 Только админы'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'members' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                Члены семьи ({familyMembers.length})
              </h3>
              
              {isUserMember && (userRole === 'CREATOR' || userRole === 'ADMIN') && (
                <button 
                  onClick={() => onInviteMember && onInviteMember(familyId, familyProfile.family_name)}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Пригласить</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {familyMembers.map((member) => (
                <div key={member.id} className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg">
                  <div className="w-12 h-12 bg-gray-200 rounded-full overflow-hidden">
                    {member.user_avatar_url ? (
                      <img 
                        src={member.user_avatar_url} 
                        alt={member.user_first_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-300 flex items-center justify-center">
                        <span className="text-gray-600 font-medium">
                          {member.user_first_name[0]}{member.user_last_name[0]}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 truncate">
                      {member.user_first_name} {member.user_last_name}
                    </h4>
                    <p className="text-sm text-gray-500">
                      {getRoleDisplayName(member.family_role)}
                    </p>
                    {member.relationship_to_family && (
                      <p className="text-xs text-gray-400">
                        {member.relationship_to_family}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'about' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">О семье</h3>
            
            <div className="space-y-6">
              {familyProfile.description && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Описание</h4>
                  <p className="text-gray-700">{familyProfile.description}</p>
                </div>
              )}

              {(familyProfile.primary_address || familyProfile.city) && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Местоположение</h4>
                  <div className="text-gray-700">
                    {familyProfile.primary_address && (
                      <p>{familyProfile.primary_address}</p>
                    )}
                    <p>
                      {[familyProfile.city, familyProfile.state, familyProfile.country]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Статистика</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-2xl font-bold text-green-600">{familyProfile.member_count}</p>
                    <p className="text-sm text-gray-600">Членов семьи</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-2xl font-bold text-blue-600">{familyPosts.length}</p>
                    <p className="text-sm text-gray-600">Постов</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FamilyProfilePage;