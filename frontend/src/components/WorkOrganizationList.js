import React, { useState, useEffect } from 'react';
import { Building2, Users, MapPin, Plus, Briefcase, Crown, Shield, ChevronRight } from 'lucide-react';
import { BACKEND_URL } from '../config/api';

const WorkOrganizationList = ({ onOrgClick, onCreateNew, onJoinOrg, onExploreFeed }) => {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadOrganizations = async () => {
      try {
        const token = localStorage.getItem('zion_token');

        const response = await fetch(`${BACKEND_URL}/api/work/organizations`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to load organizations');
        }
        
        const data = await response.json();
        setOrganizations(data.organizations || []);
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };
    
    loadOrganizations();
  }, []);

  const handleOrgClick = (orgId) => {
    onOrgClick && onOrgClick(orgId);
  };

  const handleCreateNew = () => {
    onCreateNew && onCreateNew();
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Загрузка организаций...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center max-w-md">
              <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
                <Building2 className="w-12 h-12 text-red-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Ошибка загрузки
              </h2>
              <p className="text-gray-600 mb-6">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors duration-200 font-semibold"
              >
                Попробовать снова
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white p-6">
        <div className="max-w-6xl mx-auto">
          {/* Empty State */}
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center max-w-md">
              <div className="w-24 h-24 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-6">
                <Building2 className="w-12 h-12 text-orange-500" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-3">
                No Organizations Yet
              </h2>
              <p className="text-gray-600 mb-8 leading-relaxed">
                Start by creating your organization profile or joining an existing one to connect with your professional network.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={handleCreateNew}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors duration-200 font-semibold"
                >
                  <Plus className="w-5 h-5" />
                  Create Organization
                </button>
                <button
                  onClick={() => onJoinOrg && onJoinOrg()}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-orange-600 border-2 border-orange-500 rounded-xl hover:bg-orange-50 transition-colors duration-200 font-semibold"
                >
                  <Users className="w-5 h-5" />
                  Join Organization
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">MY WORK</h1>
            <p className="text-gray-600">Manage your organizations and professional network</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => onJoinOrg && onJoinOrg()}
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-orange-600 border-2 border-orange-500 rounded-xl hover:bg-orange-50 transition-all duration-200 font-semibold"
            >
              <Users className="w-5 h-5" />
              Поиск
            </button>
            <button
              onClick={handleCreateNew}
              className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-all duration-200 font-semibold hover:scale-105"
            >
              <Plus className="w-5 h-5" />
              Создать
            </button>
          </div>
        </div>

        {/* Organizations Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {organizations.map(org => (
            <div
              key={org.id}
              onClick={() => handleOrgClick(org.id)}
              className="group bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden border border-gray-100 hover:border-orange-300 hover:scale-105"
            >
              {/* Banner */}
              <div className="h-32 bg-gradient-to-br from-orange-400 to-orange-600 relative">
                {org.banner_url && (
                  <img
                    src={org.banner_url}
                    alt="Banner"
                    className="w-full h-full object-cover opacity-80"
                  />
                )}
                {/* Logo */}
                <div className="absolute -bottom-8 left-6">
                  <div className="w-16 h-16 rounded-xl bg-white border-4 border-white shadow-lg overflow-hidden">
                    <img
                      src={org.logo_url}
                      alt={org.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
                {/* Admin Badge */}
                {org.user_is_admin && (
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full flex items-center gap-1 text-xs font-semibold text-orange-600">
                    <Crown className="w-3 h-3" />
                    Admin
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-6 pt-12">
                <h3 className="text-xl font-bold text-gray-900 mb-1 group-hover:text-orange-600 transition-colors duration-200">
                  {org.name}
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  {org.organization_type.replace('_', ' ')} • {org.industry}
                </p>

                {/* User Role */}
                <div className="bg-orange-50 rounded-lg p-3 mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Briefcase className="w-4 h-4 text-orange-600" />
                    <span className="font-semibold text-gray-900 text-sm">{org.user_job_title}</span>
                  </div>
                  <div className="text-xs text-gray-600">
                    {org.user_department}{org.user_team && ` • ${org.user_team}`}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>{org.member_count} members</span>
                  </div>
                  {org.address_city && (
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      <span>{org.address_city}</span>
                    </div>
                  )}
                </div>

                {/* Permissions */}
                <div className="flex flex-wrap gap-2">
                  {org.user_can_post && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                      Can Post
                    </span>
                  )}
                  {org.user_can_invite && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                      Can Invite
                    </span>
                  )}
                  {org.user_is_admin && (
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium">
                      Admin
                    </span>
                  )}
                </div>

                {/* View Button */}
                <div className="mt-4 flex items-center justify-between text-orange-600 font-semibold group-hover:gap-2 transition-all duration-200">
                  <span>View Profile</span>
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mt-12 bg-white rounded-2xl shadow-md p-8 border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Actions</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <button
              onClick={() => onJoinOrg && onJoinOrg()}
              className="flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-orange-500 transition-all duration-200 hover:scale-105 group"
            >
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center group-hover:bg-orange-500 transition-colors duration-200">
                <Users className="w-6 h-6 text-orange-600 group-hover:text-white" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-gray-900">Join Organization</div>
                <div className="text-sm text-gray-600">Search and join existing organizations</div>
              </div>
            </button>

            <button
              onClick={() => onExploreFeed && onExploreFeed()}
              className="flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-orange-500 transition-all duration-200 hover:scale-105 group"
            >
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center group-hover:bg-orange-500 transition-colors duration-200">
                <Building2 className="w-6 h-6 text-orange-600 group-hover:text-white" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-gray-900">Explore Organizations</div>
                <div className="text-sm text-gray-600">Discover organizations in your area</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkOrganizationList;
