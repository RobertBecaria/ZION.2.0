import React, { useState } from 'react';
import { Users, UserPlus, X, Plus, Info } from 'lucide-react';

function FamilyStatusForm({ user, onFamilyCreated, moduleColor = '#059669' }) {
  const [loading, setLoading] = useState(false);
  const [familyName, setFamilyName] = useState(`Семья ${user?.last_name || ''}`);
  
  // Spouse data
  const [spouse, setSpouse] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    relation: 'SPOUSE'
  });
  
  // Children array
  const [children, setChildren] = useState([]);
  
  // Parents array
  const [parents, setParents] = useState([]);
  
  const [showSpouseForm, setShowSpouseForm] = useState(false);

  const addChild = () => {
    setChildren([...children, {
      first_name: '',
      last_name: user?.last_name || '',
      date_of_birth: '',
      relation: 'CHILD'
    }]);
  };

  const removeChild = (index) => {
    setChildren(children.filter((_, i) => i !== index));
  };

  const updateChild = (index, field, value) => {
    const updated = [...children];
    updated[index][field] = value;
    setChildren(updated);
  };

  const addParent = () => {
    setParents([...parents, {
      first_name: '',
      last_name: user?.last_name || '',
      date_of_birth: '',
      relation: 'PARENT'
    }]);
  };

  const removeParent = (index) => {
    setParents(parents.filter((_, i) => i !== index));
  };

  const updateParent = (index, field, value) => {
    const updated = [...parents];
    updated[index][field] = value;
    setParents(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!familyName.trim()) {
      alert('Пожалуйста, укажите название семьи');
      return;
    }

    setLoading(true);
    
    try {
      const token = localStorage.getItem('zion_token');
      const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
      

      // Prepare family members list
      const members = [
        // Current user as creator
        {
          user_id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          role: 'PARENT',
          is_creator: true
        }
      ];

      // Add spouse if provided
      if (showSpouseForm && spouse.first_name && spouse.last_name) {
        members.push({
          first_name: spouse.first_name,
          last_name: spouse.last_name,
          date_of_birth: spouse.date_of_birth || null,
          role: 'SPOUSE',
          is_creator: false
        });
      }

      // Add children
      children.forEach(child => {
        if (child.first_name && child.last_name) {
          members.push({
            first_name: child.first_name,
            last_name: child.last_name,
            date_of_birth: child.date_of_birth || null,
            role: 'CHILD',
            is_creator: false
          });
        }
      });

      // Add parents
      parents.forEach(parent => {
        if (parent.first_name && parent.last_name) {
          members.push({
            first_name: parent.first_name,
            last_name: parent.last_name,
            date_of_birth: parent.date_of_birth || null,
            role: 'PARENT',
            is_creator: false
          });
        }
      });

      // Create family profile
      const response = await fetch(`${backendUrl}/api/family/create-with-members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: familyName,
          surname: user.last_name,
          members: members,
          description: `Семья ${familyName}`,
          privacy_level: 'PRIVATE'
        })
      });

      if (response.ok) {
        const data = await response.json();
        alert('✅ Профиль семьи успешно создан!');
        
        // Reload page to show new family profile
        window.location.reload();
      } else {
        const error = await response.json();
        alert(`Ошибка: ${error.detail || 'Не удалось создать семью'}`);
      }
    } catch (error) {
      console.error('Error creating family:', error);
      alert('Произошла ошибка при создании семьи');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="family-status-form-container">
      <div className="form-header-section">
        <Users size={48} style={{ color: moduleColor }} />
        <h2>Семейное положение</h2>
        <p>Заполните информацию о вашей семье для создания семейного профиля</p>
      </div>

      <form onSubmit={handleSubmit} className="family-status-form">
        {/* Family Name */}
        <div className="form-section">
          <label className="form-label">Название семьи *</label>
          <input
            type="text"
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
            className="form-input"
            placeholder="Семья Ивановых"
            required
          />
        </div>

        {/* Spouse Section */}
        <div className="form-section">
          <div className="section-header">
            <h3>Супруг/Супруга</h3>
            {!showSpouseForm && (
              <button
                type="button"
                className="add-btn"
                onClick={() => setShowSpouseForm(true)}
                style={{ color: moduleColor }}
              >
                <Plus size={18} />
                Добавить
              </button>
            )}
          </div>

          {showSpouseForm && (
            <div className="member-card">
              <button
                type="button"
                className="remove-member-btn"
                onClick={() => setShowSpouseForm(false)}
              >
                <X size={18} />
              </button>
              
              <div className="member-fields">
                <div className="field-row">
                  <div className="field-group">
                    <label>Имя *</label>
                    <input
                      type="text"
                      value={spouse.first_name}
                      onChange={(e) => setSpouse({...spouse, first_name: e.target.value})}
                      className="form-input"
                      placeholder="Имя"
                    />
                  </div>
                  <div className="field-group">
                    <label>Фамилия *</label>
                    <input
                      type="text"
                      value={spouse.last_name}
                      onChange={(e) => setSpouse({...spouse, last_name: e.target.value})}
                      className="form-input"
                      placeholder="Фамилия"
                    />
                  </div>
                </div>
                <div className="field-group">
                  <label>Дата рождения (опционально)</label>
                  <input
                    type="date"
                    value={spouse.date_of_birth}
                    onChange={(e) => setSpouse({...spouse, date_of_birth: e.target.value})}
                    className="form-input"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Children Section */}
        <div className="form-section">
          <div className="section-header">
            <h3>Дети</h3>
            <button
              type="button"
              className="add-btn"
              onClick={addChild}
              style={{ color: moduleColor }}
            >
              <Plus size={18} />
              Добавить ребенка
            </button>
          </div>

          {children.map((child, index) => (
            <div key={index} className="member-card">
              <button
                type="button"
                className="remove-member-btn"
                onClick={() => removeChild(index)}
              >
                <X size={18} />
              </button>
              
              <div className="member-fields">
                <div className="field-row">
                  <div className="field-group">
                    <label>Имя *</label>
                    <input
                      type="text"
                      value={child.first_name}
                      onChange={(e) => updateChild(index, 'first_name', e.target.value)}
                      className="form-input"
                      placeholder="Имя"
                    />
                  </div>
                  <div className="field-group">
                    <label>Фамилия *</label>
                    <input
                      type="text"
                      value={child.last_name}
                      onChange={(e) => updateChild(index, 'last_name', e.target.value)}
                      className="form-input"
                      placeholder="Фамилия"
                    />
                  </div>
                </div>
                <div className="field-group">
                  <label>Дата рождения (опционально)</label>
                  <input
                    type="date"
                    value={child.date_of_birth}
                    onChange={(e) => updateChild(index, 'date_of_birth', e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Parents Section */}
        <div className="form-section">
          <div className="section-header">
            <h3>Родители</h3>
            <button
              type="button"
              className="add-btn"
              onClick={addParent}
              style={{ color: moduleColor }}
            >
              <Plus size={18} />
              Добавить родителя
            </button>
          </div>

          {parents.map((parent, index) => (
            <div key={index} className="member-card">
              <button
                type="button"
                className="remove-member-btn"
                onClick={() => removeParent(index)}
              >
                <X size={18} />
              </button>
              
              <div className="member-fields">
                <div className="field-row">
                  <div className="field-group">
                    <label>Имя *</label>
                    <input
                      type="text"
                      value={parent.first_name}
                      onChange={(e) => updateParent(index, 'first_name', e.target.value)}
                      className="form-input"
                      placeholder="Имя"
                    />
                  </div>
                  <div className="field-group">
                    <label>Фамилия *</label>
                    <input
                      type="text"
                      value={parent.last_name}
                      onChange={(e) => updateParent(index, 'last_name', e.target.value)}
                      className="form-input"
                      placeholder="Фамилия"
                    />
                  </div>
                </div>
                <div className="field-group">
                  <label>Дата рождения (опционально)</label>
                  <input
                    type="date"
                    value={parent.date_of_birth}
                    onChange={(e) => updateParent(index, 'date_of_birth', e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Household Info */}
        <div className="info-card" style={{ borderColor: moduleColor }}>
          <Info size={20} style={{ color: moduleColor }} />
          <div>
            <h4>Что такое Домохозяйство?</h4>
            <p>
              <strong>Домохозяйство</strong> - это все люди, проживающие по одному адресу, 
              включая родственников разных поколений. Например: старший сын с женой и детьми, 
              живущие в одном доме с родителями.
            </p>
            <p className="note">
              Вы сможете создать домохозяйство после создания семейного профиля.
            </p>
          </div>
        </div>

        {/* Submit Button */}
        <div className="form-actions">
          <button
            type="submit"
            className="submit-btn"
            disabled={loading}
            style={{ backgroundColor: loading ? '#ccc' : moduleColor }}
          >
            {loading ? 'Создаём семью...' : '✨ Создать семейный профиль'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default FamilyStatusForm;
