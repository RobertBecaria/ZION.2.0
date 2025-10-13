import React, { useState } from 'react';
import { Send, Users, Home, Globe } from 'lucide-react';

const FamilyPostComposer = ({ familyUnit, user, onPostCreated }) => {
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState('FAMILY_ONLY');
  const [posting, setPosting] = useState(false);

  const visibilityOptions = [
    { value: 'FAMILY_ONLY', label: 'Только семья', icon: Users, description: 'Видят только члены вашей семьи' },
    { value: 'HOUSEHOLD_ONLY', label: 'Домохозяйство', icon: Home, description: 'Видят все семьи в вашем доме' },
    { value: 'PUBLIC', label: 'Публичный', icon: Globe, description: 'Видят все ваши связи' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    setPosting(true);
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/family-units/${familyUnit.id}/posts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            content,
            visibility,
            media_files: []
          })
        }
      );

      if (response.ok) {
        setContent('');
        setVisibility('FAMILY_ONLY');
        onPostCreated();
      } else {
        alert('Не удалось создать пост');
      }
    } catch (err) {
      alert('Ошибка при создании поста');
    } finally {
      setPosting(false);
    }
  };

  const selectedOption = visibilityOptions.find(opt => opt.value === visibility);
  const SelectedIcon = selectedOption?.icon || Users;

  return (
    <div className="family-post-composer">
      <div className="composer-header">
        <h3>Создать пост от имени {familyUnit.family_name}</h3>
      </div>

      <form onSubmit={handleSubmit} className="composer-form">
        <div className="composer-input-area">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`Что нового в семье ${familyUnit.family_surname}?`}
            rows={4}
            disabled={posting}
          />
        </div>

        <div className="composer-visibility">
          <label>Видимость поста:</label>
          <div className="visibility-options">
            {visibilityOptions.map(option => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`visibility-option ${visibility === option.value ? 'active' : ''}`}
                  onClick={() => setVisibility(option.value)}
                >
                  <Icon size={20} />
                  <div>
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="composer-actions">
          <div className="post-info">
            <SelectedIcon size={16} />
            <span>Публикуется как: {user.first_name} ({familyUnit.family_name})</span>
          </div>
          <button
            type="submit"
            className="btn-primary btn-post"
            disabled={!content.trim() || posting}
            style={{ background: '#4CAF50' }}
            onMouseOver={(e) => !e.target.disabled && (e.target.style.background = '#45a049')}
            onMouseOut={(e) => !e.target.disabled && (e.target.style.background = '#4CAF50')}
          >
            <Send size={18} />
            {posting ? 'Публикация...' : 'Опубликовать'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FamilyPostComposer;