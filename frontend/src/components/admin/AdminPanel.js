import React, { useState, useEffect } from 'react';
import AdminLogin from './AdminLogin';
import AdminLayout from './AdminLayout';

// Get backend URL - smart detection for both preview and production
const getBackendUrl = () => {
  let baseUrl = process.env.REACT_APP_BACKEND_URL || '';
  const currentHost = window.location.hostname;
  const isProduction = currentHost === 'zioncity.app' || 
                       currentHost.endsWith('.zioncity.app') ||
                       currentHost.endsWith('.emergent.host');
  
  if (!baseUrl || (isProduction && baseUrl.includes('preview.emergentagent.com'))) {
    baseUrl = window.location.origin;
  }
  
  if (baseUrl.endsWith('/api')) return baseUrl;
  return baseUrl + '/api';
};

const BACKEND_URL = getBackendUrl();

const AdminPanel = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if admin is already logged in
    const verifyToken = async () => {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${BACKEND_URL}/admin/verify`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('admin_token');
          localStorage.removeItem('admin_name');
        }
      } catch (err) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_name');
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-400 mt-4">Проверка авторизации...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminLogin onLoginSuccess={handleLoginSuccess} />;
  }

  return <AdminLayout onLogout={handleLogout} />;
};

export default AdminPanel;
