import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  Users, UserCheck, UserX, Activity, TrendingUp, Clock,
  Calendar, RefreshCw, BarChart2, UserPlus
} from 'lucide-react';

// Get backend URL - handle both with and without /api suffix
const getBackendUrl = () => {
  const baseUrl = process.env.REACT_APP_BACKEND_URL || '';
  if (baseUrl.endsWith('/api')) return baseUrl;
  return baseUrl + '/api';
};
const BACKEND_URL = getBackendUrl();

// Memoized StatCard to prevent unnecessary re-renders
const StatCard = memo(({ title, value, icon: Icon, color, subtitle, trend }) => (
  <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 hover:border-slate-600/50 transition-all">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-slate-400 text-sm font-medium">{title}</p>
        <p className="text-3xl font-bold text-white mt-2">{value}</p>
        {subtitle && <p className="text-slate-500 text-xs mt-1">{subtitle}</p>}
        {trend !== undefined && (
          <div className={`flex items-center gap-1 mt-2 text-sm ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            <TrendingUp className={`w-4 h-4 ${trend < 0 ? 'rotate-180' : ''}`} />
            <span>{trend >= 0 ? '+' : ''}{trend}%</span>
          </div>
        )}
      </div>
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
  </div>
));

// Memoized MiniChart component
const MiniChart = memo(({ data, label, color }) => {
  const max = Math.max(...data.map(d => d.count), 1);
  
  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
      <h3 className="text-slate-300 font-medium mb-4">{label}</h3>
      <div className="flex items-end gap-2 h-32">
        {data.map((item, index) => (
          <div key={index} className="flex-1 flex flex-col items-center gap-2">
            <div
              className={`w-full rounded-t-lg ${color} transition-all hover:opacity-80`}
              style={{ height: `${(item.count / max) * 100}%`, minHeight: '4px' }}
              title={`${item.date}: ${item.count}`}
            ></div>
            <span className="text-xs text-slate-500 truncate w-full text-center">
              {new Date(item.date).toLocaleDateString('ru-RU', { weekday: 'short' })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});

// Memoized RecentUsersList component
const RecentUsersList = memo(({ users }) => (
  <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
    <h3 className="text-slate-300 font-medium mb-4 flex items-center gap-2">
      <UserPlus className="w-5 h-5" />
      Последние регистрации
    </h3>
    <div className="space-y-3">
      {users.map((user, index) => (
        <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 hover:bg-slate-900/70 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white font-semibold">
              {user.first_name?.[0] || user.email?.[0] || '?'}
            </div>
            <div>
              <p className="text-white font-medium">{user.first_name} {user.last_name}</p>
              <p className="text-slate-500 text-sm">{user.email}</p>
            </div>
          </div>
          <div className="text-right">
            <span className={`inline-block px-2 py-1 rounded-full text-xs ${user.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {user.is_active ? 'Активен' : 'Неактивен'}
            </span>
            <p className="text-slate-500 text-xs mt-1">
              {new Date(user.created_at).toLocaleDateString('ru-RU')}
            </p>
          </div>
        </div>
      ))}
    </div>
  </div>
));

// Memoized RoleDistribution component
const RoleDistribution = memo(({ roles }) => {
  const total = roles.reduce((sum, r) => sum + r.count, 0);
  const colors = {
    'ADULT': 'bg-purple-500',
    'CHILD': 'bg-cyan-500',
    'TEENAGER': 'bg-blue-500',
    'SENIOR': 'bg-amber-500',
    'ADMIN': 'bg-red-500',
    'UNKNOWN': 'bg-slate-500'
  };
  
  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
      <h3 className="text-slate-300 font-medium mb-4 flex items-center gap-2">
        <BarChart2 className="w-5 h-5" />
        Распределение по ролям
      </h3>
      <div className="space-y-3">
        {roles.map((role, index) => (
          <div key={index}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-400">{role.role}</span>
              <span className="text-white font-medium">{role.count} ({((role.count / total) * 100).toFixed(1)}%)</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full ${colors[role.role] || 'bg-slate-500'} rounded-full transition-all`}
                style={{ width: `${(role.count / total) * 100}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Memoized fetch function to prevent recreation on each render
  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`${BACKEND_URL}/admin/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Ошибка загрузки данных');
      }

      const data = await response.json();
      setStats(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-400 mt-4">Загрузка статистики...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
        <p className="text-red-400">{error}</p>
        <button onClick={fetchDashboard} className="mt-4 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors">
          Попробовать снова
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Панель управления</h1>
          <p className="text-slate-400">Обзор статистики платформы ZION.CITY</p>
        </div>
        <button
          onClick={fetchDashboard}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Обновить
        </button>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Всего пользователей"
          value={stats.total_users}
          icon={Users}
          color="bg-gradient-to-br from-purple-500 to-purple-600"
          subtitle="Зарегистрировано на платформе"
        />
        <StatCard
          title="Активных"
          value={stats.active_users}
          icon={UserCheck}
          color="bg-gradient-to-br from-green-500 to-green-600"
          subtitle="Активные аккаунты"
        />
        <StatCard
          title="Неактивных"
          value={stats.inactive_users}
          icon={UserX}
          color="bg-gradient-to-br from-red-500 to-red-600"
          subtitle="Деактивированные"
        />
        <StatCard
          title="Онлайн сейчас"
          value={stats.online_users}
          icon={Activity}
          color="bg-gradient-to-br from-cyan-500 to-cyan-600"
          subtitle="Активны за последние 5 мин"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Новых сегодня"
          value={stats.new_today}
          icon={UserPlus}
          color="bg-gradient-to-br from-amber-500 to-amber-600"
        />
        <StatCard
          title="За неделю"
          value={stats.new_this_week}
          icon={Calendar}
          color="bg-gradient-to-br from-blue-500 to-blue-600"
        />
        <StatCard
          title="Входов сегодня"
          value={stats.logged_in_today}
          icon={Clock}
          color="bg-gradient-to-br from-indigo-500 to-indigo-600"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MiniChart
          data={stats.registration_trend}
          label="Регистрации за неделю"
          color="bg-gradient-to-t from-purple-500 to-purple-400"
        />
        <MiniChart
          data={stats.login_trend}
          label="Входы за неделю"
          color="bg-gradient-to-t from-cyan-500 to-cyan-400"
        />
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentUsersList users={stats.recent_users} />
        <RoleDistribution roles={stats.role_distribution} />
      </div>
    </div>
  );
};

export default AdminDashboard;
