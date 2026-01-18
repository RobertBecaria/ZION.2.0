import React, { useState, useEffect } from 'react';
import { Users, UserPlus, UserMinus, X, Search } from 'lucide-react';


import { BACKEND_URL } from '../../config/api';
const DepartmentMembersModal = ({
  department,
  organizationId,
  organizationMembers,
  moduleColor,
  onClose,
  onRefresh
}) => {
  const [departmentMembers, setDepartmentMembers] = useState([]);
  const [availableMembers, setAvailableMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (department) {
      fetchDepartmentMembers();
    }
  }, [department]);

  const fetchDepartmentMembers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${BACKEND_URL}/api/organizations/${organizationId}/departments/${department.id}/members`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const members = data.data || [];
        setDepartmentMembers(members);

        // Calculate available members (org members not in this department)
        const memberUserIds = members.map(m => m.user_id);
        const available = organizationMembers.filter(om => !memberUserIds.includes(om.user_id));
        setAvailableMembers(available);
      }
    } catch (error) {
      console.error('Error fetching department members:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (userId) => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${BACKEND_URL}/api/organizations/${organizationId}/departments/${department.id}/members`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ user_id: userId })
        }
      );

      if (response.ok) {
        await fetchDepartmentMembers();
        if (onRefresh) onRefresh();
      } else {
        const error = await response.json();
        alert(error.detail || 'Ошибка при добавлении участника');
      }
    } catch (error) {
      console.error('Error adding member:', error);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!window.confirm('Удалить этого сотрудника из отдела?')) return;

    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${BACKEND_URL}/api/organizations/${organizationId}/departments/${department.id}/members/${userId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        await fetchDepartmentMembers();
        if (onRefresh) onRefresh();
      } else {
        const error = await response.json();
        alert(error.detail || 'Ошибка при удалении участника');
      }
    } catch (error) {
      console.error('Error removing member:', error);
    }
  };

  const filteredAvailable = availableMembers.filter(m =>
    `${m.first_name} ${m.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!department) return null;

  return (
    <div className="member-modal-overlay">
      <div className="member-modal">
        <div className="member-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: department.color || moduleColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Users size={20} color="white" />
            </div>
            <div>
              <h3 style={{ margin: 0 }}>{department.name}</h3>
              <p style={{ margin: 0, fontSize: '14px', color: '#65676B' }}>
                {departmentMembers.length} участников
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        <div className="member-modal-body" style={{ padding: '20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#65676B' }}>
              Загрузка...
            </div>
          ) : (
            <>
              {/* Current Members */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#65676B' }}>
                  УЧАСТНИКИ ОТДЕЛА
                </h4>
                {departmentMembers.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', background: '#F0F2F5', borderRadius: '10px', color: '#65676B' }}>
                    В отделе пока нет участников
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {departmentMembers.map(member => (
                      <div
                        key={member.user_id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px',
                          background: '#F8F9FA',
                          borderRadius: '10px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '50%',
                              background: moduleColor + '20',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: moduleColor,
                              fontWeight: '600'
                            }}
                          >
                            {member.first_name?.[0]}
                          </div>
                          <div>
                            <p style={{ margin: 0, fontWeight: '500' }}>
                              {member.first_name} {member.last_name}
                            </p>
                            <p style={{ margin: 0, fontSize: '13px', color: '#65676B' }}>
                              {member.role || 'Сотрудник'}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveMember(member.user_id)}
                          style={{
                            padding: '8px',
                            background: '#FEE2E2',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            color: '#DC2626'
                          }}
                        >
                          <UserMinus size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Members */}
              <div>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#65676B' }}>
                  ДОБАВИТЬ УЧАСТНИКОВ
                </h4>
                <div style={{ position: 'relative', marginBottom: '12px' }}>
                  <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#65676B' }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Поиск сотрудников..."
                    style={{
                      width: '100%',
                      padding: '12px 12px 12px 40px',
                      border: '1px solid #E4E6EB',
                      borderRadius: '10px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                {filteredAvailable.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', background: '#F0F2F5', borderRadius: '10px', color: '#65676B' }}>
                    {searchQuery ? 'Никого не найдено' : 'Все сотрудники уже в отделе'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                    {filteredAvailable.map(member => (
                      <div
                        key={member.user_id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px',
                          background: '#F8F9FA',
                          borderRadius: '10px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '50%',
                              background: '#E4E6EB',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#65676B',
                              fontWeight: '600'
                            }}
                          >
                            {member.first_name?.[0]}
                          </div>
                          <p style={{ margin: 0, fontWeight: '500' }}>
                            {member.first_name} {member.last_name}
                          </p>
                        </div>
                        <button
                          onClick={() => handleAddMember(member.user_id)}
                          style={{
                            padding: '8px 12px',
                            background: moduleColor,
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: '500'
                          }}
                        >
                          <UserPlus size={16} />
                          Добавить
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DepartmentMembersModal;
