import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, LogOut, Menu, X, Shield,
  Database, Coins, ChevronRight
} from 'lucide-react';
import AdminDashboard from './AdminDashboard';
import AdminUserManagement from './AdminUserManagement';
import AdminDatabaseManagement from './AdminDatabaseManagement';
import AdminAltynManagement from './AdminAltynManagement';

const AdminLayout = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [adminName, setAdminName] = useState('');

  useEffect(() => {
    const name = localStorage.getItem('admin_name');
    setAdminName(name || 'Admin');
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_name');
    onLogout();
  };

  const menuItems = [
    { id: 'dashboard', label: 'Панель управления', icon: LayoutDashboard },
    { id: 'users', label: 'Пользователи', icon: Users },
    { id: 'altyn', label: 'ALTYN', icon: Coins },
    { id: 'database', label: 'База данных', icon: Database },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-white">Admin Panel</span>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg hover:bg-slate-700 text-white"
        >
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-slate-800/95 backdrop-blur-xl border-r border-slate-700 z-40 transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        {/* Logo */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center shadow-lg">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Admin Panel</h1>
              <p className="text-xs text-slate-400">ZION.CITY</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                if (window.innerWidth < 1024) setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === item.id
                  ? 'bg-gradient-to-r from-purple-500/20 to-cyan-500/20 text-white border border-purple-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
              {activeTab === item.id && <ChevronRight className="w-4 h-4 ml-auto" />}
            </button>
          ))}
        </nav>

        {/* User Section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/50 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white font-bold">
              {adminName[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">{adminName}</p>
              <p className="text-xs text-slate-500">Администратор</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Выйти</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : ''} lg:ml-64 pt-16 lg:pt-0`}>
        <div className="p-6 lg:p-8">
          {activeTab === 'dashboard' && <AdminDashboard />}
          {activeTab === 'users' && <AdminUserManagement />}
          {activeTab === 'altyn' && <AdminAltynManagement />}
          {activeTab === 'database' && <AdminDatabaseManagement />}
        </div>
      </main>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}
    </div>
  );
};

export default AdminLayout;
