import React, { useState, useEffect, useCallback } from 'react';
import { Building2, Users, MapPin, Globe, Mail, Calendar, Settings, UserPlus, Edit, Share2, Briefcase, ChevronRight, Crown } from 'lucide-react';
import WorkInviteMemberModal from './WorkInviteMemberModal';
import WorkMemberManagement from './WorkMemberManagement';
import WorkOrganizationSettings from './WorkOrganizationSettings';

const WorkOrganizationProfile = ({ organizationId, onBack, onInviteMember, onSettings }) => {
  const [organization, setOrganization] = useState(null);
  const [members, setMembers] = useState([]);
  const [membersByDept, setMembersByDept] = useState({});
  const [posts, setPosts] = useState([]);
  const [activeTab, setActiveTab] = useState('about'); // 'about', 'members', 'posts'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    // Get current user ID from token or localStorage
    const token = localStorage.getItem('zion_token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setCurrentUserId(payload.sub);
      } catch (e) {
        console.error('Error parsing token:', e);
      }
    }
  }, []);

  const loadOrganizationData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem('zion_token');

      if (!token) {
        throw new Error('Не авторизован');
      }

      // Load organization details
      const orgResponse = await fetch(`${BACKEND_URL}/api/work/organizations/${organizationId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!orgResponse.ok) {
        const errorData = await orgResponse.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Не удалось загрузить организацию');
      }

      const orgData = await orgResponse.json();
      setOrganization(orgData);

      // Load members
      const membersResponse = await fetch(`${BACKEND_URL}/api/work/organizations/${organizationId}/members`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (membersResponse.ok) {
        const membersData = await membersResponse.json();
        setMembers(membersData.members || []);
        setMembersByDept(membersData.departments || {});
      }

      // Posts will be handled by UniversalWall in future
      setPosts([]);

    } catch (error) {
      console.error('Error loading organization:', error);
      setError(error.message || 'Произошла ошибка при загрузке');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (organizationId) {
      loadOrganizationData();
    }
  }, [organizationId, loadOrganizationData]);

  // Check if current user is admin (from organization object)
  const isAdmin = organization?.user_is_admin || false;
  const canInvite = organization?.user_can_invite || false;

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка профиля организации...</p>
        </div>
      </div>
    );
  }

  // Error or not found state
  if (error || !organization) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white p-6 flex items-center justify-center">
        <div className="text-center">
          <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">{error || 'Организация не найдена'}</p>
          <button
            onClick={onBack}
            className="mt-4 text-orange-600 hover:text-orange-700 font-semibold"
          >
            ← Назад к организациям
          </button>
        </div>
      </div>
    );
  }

  // Get current user membership data from organization object
  const currentUserRole = organization.user_role;

  const handleInviteSuccess = () => {
    // Reload members after successful invitation
    setShowInviteModal(false);
    // Reload organization data to get updated member count
    loadOrganizationData();
  };

  const handleMemberUpdate = () => {
    // Reload members after update
    loadOrganizationData();
  };

  const handleMemberRemove = () => {
    // Reload members after removal
    loadOrganizationData();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto">
          {/* Banner */}
          <div className="h-64 bg-gradient-to-br from-orange-400 to-orange-600 relative">
            {organization.banner_url && (
              <img
                src={organization.banner_url}
                alt="Banner"
                className="w-full h-full object-cover"
              />
            )}
            {/* Back Button */}
            <button
              onClick={onBack}
              className="absolute top-6 left-6 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-xl text-gray-900 font-semibold hover:bg-white transition-all duration-200 shadow-md"
            >
              ← Back
            </button>
            {/* Admin Actions */}
            {isAdmin && (
              <button
                onClick={() => onSettings && onSettings(organizationId)}
                className="absolute top-6 right-6 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-xl text-gray-900 font-semibold hover:bg-white transition-all duration-200 shadow-md flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
            )}
          </div>

          {/* Organization Info */}
          <div className="px-8 pb-6">
            <div className="flex items-start gap-6 -mt-16 relative">
              {/* Logo */}
              <div className="w-32 h-32 rounded-2xl bg-white border-4 border-white shadow-xl overflow-hidden">
                <img
                  src={organization.logo_url}
                  alt={organization.name}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Basic Info */}
              <div className="flex-1 pt-20">
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">{organization.name}</h1>
                    <p className="text-lg text-gray-600 mb-4">
                      {organization.organization_type.replace('_', ' ')} · {organization.industry}
                    </p>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span>{organization.member_count} members</span>
                      </div>
                      {organization.address_city && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          <span>{organization.address_city}, {organization.address_country}</span>
                        </div>
                      )}
                      {organization.founded_year && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>Founded {organization.founded_year}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    {canInvite && (
                      <button
                        onClick={() => setShowInviteModal(true)}
                        className="px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors duration-200 font-semibold flex items-center gap-2 hover:scale-105 transition-transform"
                      >
                        <UserPlus className="w-5 h-5" />
                        Пригласить Членов
                      </button>
                    )}
                    <button className="px-6 py-3 bg-white border-2 border-gray-300 rounded-xl hover:border-orange-500 transition-all duration-200 font-semibold flex items-center gap-2">
                      <Share2 className="w-5 h-5" />
                      Поделиться
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mt-8 border-b border-gray-200">
              <button
                onClick={() => setActiveTab('about')}
                className={`px-6 py-3 font-semibold transition-all duration-200 border-b-2 ${
                  activeTab === 'about'
                    ? 'text-orange-600 border-orange-600'
                    : 'text-gray-600 border-transparent hover:text-gray-900'
                }`}
              >
                About
              </button>
              <button
                onClick={() => setActiveTab('members')}
                className={`px-6 py-3 font-semibold transition-all duration-200 border-b-2 ${
                  activeTab === 'members'
                    ? 'text-orange-600 border-orange-600'
                    : 'text-gray-600 border-transparent hover:text-gray-900'
                }`}
              >
                Members ({organization.member_count})
              </button>
              <button
                onClick={() => setActiveTab('posts')}
                className={`px-6 py-3 font-semibold transition-all duration-200 border-b-2 ${
                  activeTab === 'posts'
                    ? 'text-orange-600 border-orange-600'
                    : 'text-gray-600 border-transparent hover:text-gray-900'
                }`}
              >
                Posts
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-6xl mx-auto p-8">
        {activeTab === 'about' && (
          <div className="space-y-6">
            {/* Description */}
            <div className="bg-white rounded-2xl shadow-md p-8 border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">About</h2>
              <p className="text-gray-700 leading-relaxed">{organization.description}</p>
            </div>

            {/* Contact Info */}
            <div className="bg-white rounded-2xl shadow-md p-8 border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Contact Information</h2>
              <div className="grid md:grid-cols-2 gap-6">
                {organization.website && (
                  <div className="flex items-start gap-3">
                    <Globe className="w-5 h-5 text-orange-600 mt-1" />
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Website</div>
                      <a
                        href={organization.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-600 hover:text-orange-700 font-medium"
                      >
                        {organization.website}
                      </a>
                    </div>
                  </div>
                )}
                {organization.official_email && (
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-orange-600 mt-1" />
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Email</div>
                      <a
                        href={`mailto:${organization.official_email}`}
                        className="text-orange-600 hover:text-orange-700 font-medium"
                      >
                        {organization.official_email}
                      </a>
                    </div>
                  </div>
                )}
                {organization.address_street && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-orange-600 mt-1" />
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Address</div>
                      <div className="text-gray-900">
                        {organization.address_street}<br />
                        {organization.address_city}, {organization.address_state}<br />
                        {organization.address_country} {organization.address_postal_code}
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <Building2 className="w-5 h-5 text-orange-600 mt-1" />
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Organization Size</div>
                    <div className="text-gray-900">{organization.organization_size} employees</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Your Role (if member) */}
            {currentUserRole && (
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-8 border border-orange-200">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Ваша роль</h2>
                <div className="grid md:grid-cols-3 gap-6">
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Должность</div>
                    <div className="text-gray-900 font-semibold">{organization.user_job_title}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Отдел</div>
                    <div className="text-gray-900 font-semibold">{organization.user_department}</div>
                  </div>
                  {organization.user_team && (
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Команда</div>
                      <div className="text-gray-900 font-semibold">{organization.user_team}</div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 mt-4">
                  {organization.user_is_admin && (
                    <span className="px-3 py-1 bg-orange-500 text-white rounded-full text-sm font-semibold flex items-center gap-1">
                      <Crown className="w-3 h-3" />
                      Admin
                    </span>
                  )}
                  {organization.user_can_invite && (
                    <span className="px-3 py-1 bg-blue-500 text-white rounded-full text-sm font-semibold">Can Invite</span>
                  )}
                  {organization.user_can_post && (
                    <span className="px-3 py-1 bg-green-500 text-white rounded-full text-sm font-semibold">Can Post</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'members' && (
          <div className="space-y-6">
            {/* Admin Controls Info */}
            {isAdmin && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm text-blue-700">
                  <Crown className="w-4 h-4 inline mr-2" />
                  Вы администратор. Вы можете редактировать роли и удалять членов.
                </p>
              </div>
            )}

            {Object.entries(membersByDept).length > 0 ? (
              Object.entries(membersByDept).map(([dept, deptMembers]) => (
                <div key={dept} className="bg-white rounded-2xl shadow-md p-8 border border-gray-100">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">{dept}</h2>
                  <div className="space-y-4">
                    {deptMembers.map(member => (
                      <WorkMemberManagement
                        key={member.id}
                        member={member}
                        organizationId={organizationId}
                        isCurrentUser={member.user_id === currentUserId}
                        onUpdate={handleMemberUpdate}
                        onRemove={handleMemberRemove}
                      />
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white rounded-2xl shadow-md p-8 border border-gray-100 text-center">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">Загрузка членов организации...</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'posts' && (
          <div className="bg-white rounded-2xl shadow-md p-8 border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Organization Posts</h2>
            {posts.length > 0 ? (
              <div className="space-y-6">
                {posts.map(post => (
                  <div key={post.id} className="border-b border-gray-200 pb-6 last:border-0">
                    <div className="flex items-start gap-4">
                      <img
                        src={post.author_avatar}
                        alt={post.author_name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h3 className="font-semibold text-gray-900">{post.author_name}</h3>
                            <p className="text-sm text-gray-600">{post.author_role}</p>
                          </div>
                          <span className="text-sm text-gray-500">
                            {new Date(post.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-gray-700 mb-4">{post.content}</p>
                        {post.media_urls && post.media_urls.length > 0 && (
                          <div className="grid grid-cols-2 gap-2 mb-4">
                            {post.media_urls.map((url, idx) => (
                              <img
                                key={idx}
                                src={url}
                                alt="Post media"
                                className="w-full h-48 object-cover rounded-lg"
                              />
                            ))}
                          </div>
                        )}
                        <div className="flex gap-4 text-sm text-gray-600">
                          <span>{post.likes_count} likes</span>
                          <span>{post.comments_count} comments</span>
                          <span>{post.shares_count} shares</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-600">No posts yet</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Invite Member Modal */}
      {showInviteModal && (
        <WorkInviteMemberModal
          organizationId={organizationId}
          organizationName={organization.name}
          onClose={() => setShowInviteModal(false)}
          onSuccess={handleInviteSuccess}
        />
      )}
    </div>
  );
};

export default WorkOrganizationProfile;
