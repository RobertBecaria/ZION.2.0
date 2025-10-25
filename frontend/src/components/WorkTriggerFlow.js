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
              Welcome to <span className="text-orange-600">WORK</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Connect with your professional network, manage organizations, and collaborate with colleagues all in one place.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 hover:scale-105">
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center mb-4">
                <Building2 className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2 text-lg">Create Organizations</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Set up your company or startup profile with detailed information and branding.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 hover:scale-105">
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2 text-lg">Team Management</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Invite colleagues, assign roles, organize by departments and teams.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 hover:scale-105">
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center mb-4">
                <Briefcase className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2 text-lg">Professional Network</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Share updates, collaborate on projects, and stay connected with your team.
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
              Get Started
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
              How would you like to proceed?
            </h2>
            <p className="text-lg text-gray-600">
              Choose an option to get started with your professional network
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
