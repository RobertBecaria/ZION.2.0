import React, { useState } from 'react';
import { Building2, Briefcase, Users } from 'lucide-react';

const WorkTriggerFlow = ({ onCreateOrg, onJoinOrg }) => {
  const [view, setView] = useState('landing'); // 'landing', 'choice'

  const handleGetStarted = () => {
    setView('choice');
  };

  const handleCreateOrganization = () => {
    onCreateOrg && onCreateOrg();
  };

  const handleJoinOrganization = () => {
    onJoinOrg && onJoinOrg();
  };

  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center p-6">
        <div className="max-w-4xl w-full">
          {/* Hero Section */}
          <div className="text-center mb-12 animate-fadeIn">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 mb-6 shadow-lg">
              <Building2 className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-5xl font-bold text-gray-900 mb-4">
              Добро пожаловать в <span className="text-orange-600">РАБОТУ</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Подключайтесь к своей профессиональной сети, управляйте организациями и сотрудничайте с коллегами в одном месте.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 hover:scale-105">
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center mb-4">
                <Building2 className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2 text-lg">Создавайте Организации</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Настройте профиль вашей компании или стартапа с подробной информацией и брендингом.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 hover:scale-105">
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2 text-lg">Управление Командой</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Приглашайте коллег, назначайте роли, организуйте по отделам и командам.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 hover:scale-105">
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center mb-4">
                <Briefcase className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2 text-lg">Профессиональная Сеть</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Делитесь обновлениями, работайте над проектами и оставайтесь на связи с командой.
              </p>
            </div>
          </div>

          {/* CTA Button */}
          <div className="text-center">
            <button
              onClick={handleGetStarted}
              className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
            >
              <Building2 className="w-5 h-5" />
              Начать
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'choice') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center p-6">
        <div className="max-w-4xl w-full">
          {/* Header */}
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-3">
              Как вы хотите продолжить?
            </h2>
            <p className="text-lg text-gray-600">
              Выберите вариант, чтобы начать работу с профессиональной сетью
            </p>
          </div>

          {/* Choice Cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Create Organization */}
            <button
              onClick={handleCreateOrganization}
              className="group bg-white rounded-2xl p-8 shadow-md border-2 border-gray-200 hover:border-orange-500 transition-all duration-300 text-left hover:shadow-xl hover:scale-105"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                Create Organization
              </h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                Start your own company, startup, or organization profile. Perfect for founders and business owners.
              </p>
              <div className="flex items-center text-orange-600 font-semibold group-hover:gap-3 transition-all duration-300">
                <span>Create Now</span>
                <span className="ml-2 group-hover:ml-0">→</span>
              </div>
            </button>

            {/* Join Organization */}
            <button
              onClick={handleJoinOrganization}
              className="group bg-white rounded-2xl p-8 shadow-md border-2 border-gray-200 hover:border-orange-500 transition-all duration-300 text-left hover:shadow-xl hover:scale-105"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                Join Organization
              </h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                Search for and join existing organizations. Ideal for employees and team members.
              </p>
              <div className="flex items-center text-orange-600 font-semibold group-hover:gap-3 transition-all duration-300">
                <span>Join Now</span>
                <span className="ml-2 group-hover:ml-0">→</span>
              </div>
            </button>
          </div>

          {/* Back Button */}
          <div className="text-center">
            <button
              onClick={() => setView('landing')}
              className="text-gray-600 hover:text-gray-900 font-medium transition-colors duration-200"
            >
              ← Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default WorkTriggerFlow;
