/**
 * BirthdayPartyForm Component
 * Form for creating birthday party events with theme selection,
 * wish list, and classmate invitations.
 */
import React from 'react';
import { Plus, X, Users, Gift, Check, PartyPopper } from 'lucide-react';

const BirthdayPartyForm = ({
  birthdayPartyData,
  setBirthdayPartyData,
  wishInput,
  setWishInput,
  addWish,
  removeWish,
  classmates,
  loadingClassmates,
  selectedClassmates,
  toggleClassmateSelection,
  newEvent
}) => {
  const isPink = birthdayPartyData.theme === 'PINK';
  const themeColor = isPink ? '#BE185D' : '#1D4ED8';
  const themeBorderColor = isPink ? '#F9A8D4' : '#93C5FD';
  const themeAccentColor = isPink ? '#EC4899' : '#3B82F6';
  
  return (
    <div className="birthday-party-section" style={{ 
      background: isPink 
        ? 'linear-gradient(135deg, #FDF2F8 0%, #FCE7F3 100%)' 
        : 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
      padding: '20px',
      borderRadius: '12px',
      marginBottom: '16px',
      border: `2px solid ${themeBorderColor}`
    }}>
      <h4 style={{ 
        color: themeColor,
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        🎂 Настройки дня рождения
      </h4>
      
      {/* Theme Selector */}
      <div className="form-group">
        <label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>
          Тема приглашения
        </label>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={() => setBirthdayPartyData(prev => ({ ...prev, theme: 'PINK' }))}
            style={{
              flex: 1,
              padding: '16px',
              borderRadius: '12px',
              border: isPink ? '3px solid #EC4899' : '2px solid #F9A8D4',
              background: isPink 
                ? 'linear-gradient(135deg, #FDF2F8 0%, #FBCFE8 100%)' 
                : '#FDF2F8',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <span style={{ fontSize: '28px' }}>🎀</span>
            <span style={{ color: '#BE185D', fontWeight: '600' }}>Розовая тема</span>
            <span style={{ fontSize: '12px', color: '#9D174D' }}>Для девочек</span>
          </button>
          <button
            type="button"
            onClick={() => setBirthdayPartyData(prev => ({ ...prev, theme: 'BLUE' }))}
            style={{
              flex: 1,
              padding: '16px',
              borderRadius: '12px',
              border: !isPink ? '3px solid #3B82F6' : '2px solid #93C5FD',
              background: !isPink 
                ? 'linear-gradient(135deg, #EFF6FF 0%, #BFDBFE 100%)' 
                : '#EFF6FF',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <span style={{ fontSize: '28px' }}>🎈</span>
            <span style={{ color: '#1D4ED8', fontWeight: '600' }}>Синяя тема</span>
            <span style={{ fontSize: '12px', color: '#1E40AF' }}>Для мальчиков</span>
          </button>
        </div>
      </div>
      
      {/* Birthday Child Info */}
      <div className="form-row" style={{ marginTop: '16px' }}>
        <div className="form-group" style={{ flex: 2 }}>
          <label>Имя именинника</label>
          <input
            type="text"
            value={birthdayPartyData.birthday_child_name}
            onChange={e => setBirthdayPartyData(prev => ({ ...prev, birthday_child_name: e.target.value }))}
            placeholder="Например: Маша"
            style={{ 
              borderColor: themeBorderColor,
              backgroundColor: 'white'
            }}
          />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Исполняется лет</label>
          <input
            type="number"
            value={birthdayPartyData.birthday_child_age || ''}
            onChange={e => setBirthdayPartyData(prev => ({ ...prev, birthday_child_age: parseInt(e.target.value) || null }))}
            placeholder="7"
            min="1"
            max="18"
            style={{ 
              borderColor: themeBorderColor,
              backgroundColor: 'white'
            }}
          />
        </div>
      </div>
      
      {/* Custom Message */}
      <div className="form-group" style={{ marginTop: '16px' }}>
        <label>Персональное сообщение в приглашении</label>
        <textarea
          value={birthdayPartyData.custom_message}
          onChange={e => setBirthdayPartyData(prev => ({ ...prev, custom_message: e.target.value }))}
          placeholder="Приглашаю тебя на мой день рождения! Будет весело! 🎉"
          rows={3}
          style={{ 
            borderColor: themeBorderColor,
            backgroundColor: 'white'
          }}
        />
      </div>
      
      {/* Wish List */}
      <div className="form-group" style={{ marginTop: '16px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Gift size={16} /> Список желаний 
          <span style={{ 
            fontSize: '11px', 
            background: isPink ? '#FDF2F8' : '#EFF6FF',
            color: themeColor,
            padding: '2px 8px',
            borderRadius: '10px'
          }}>
            Скоро: Маркетплейс
          </span>
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={wishInput}
            onChange={e => setWishInput(e.target.value)}
            placeholder="Добавить желание..."
            onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addWish())}
            style={{ 
              flex: 1,
              borderColor: themeBorderColor,
              backgroundColor: 'white'
            }}
          />
          <button
            type="button"
            onClick={addWish}
            style={{
              padding: '8px 16px',
              background: themeAccentColor,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            <Plus size={16} />
          </button>
        </div>
        {birthdayPartyData.wish_list.length > 0 && (
          <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {birthdayPartyData.wish_list.map((wish, index) => (
              <span
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  background: 'white',
                  borderRadius: '20px',
                  border: `1px solid ${themeBorderColor}`,
                  fontSize: '14px'
                }}
              >
                🎁 {wish}
                <button
                  type="button"
                  onClick={() => removeWish(index)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#9CA3AF',
                    padding: '0',
                    display: 'flex'
                  }}
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
      
      {/* Classmate Selection */}
      <div className="form-group" style={{ marginTop: '16px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={16} /> Пригласить одноклассников
        </label>
        {loadingClassmates ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#6B7280' }}>
            Загрузка списка одноклассников...
          </div>
        ) : classmates.length === 0 ? (
          <div style={{ 
            padding: '20px', 
            textAlign: 'center', 
            color: '#6B7280',
            background: 'white',
            borderRadius: '8px',
            border: '1px dashed #D1D5DB'
          }}>
            <Users size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
            <p>Нет доступных одноклассников</p>
          </div>
        ) : (
          <div style={{ 
            maxHeight: '200px', 
            overflowY: 'auto', 
            background: 'white',
            borderRadius: '8px',
            border: `1px solid ${themeBorderColor}`
          }}>
            {classmates.map(classmate => (
              <div
                key={classmate.id}
                onClick={() => toggleClassmateSelection(classmate)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #F3F4F6',
                  background: selectedClassmates.some(c => c.id === classmate.id) 
                    ? (isPink ? '#FDF2F8' : '#EFF6FF')
                    : 'white',
                  transition: 'background 0.2s ease'
                }}
              >
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '4px',
                  border: `2px solid ${selectedClassmates.some(c => c.id === classmate.id) 
                    ? themeAccentColor
                    : '#D1D5DB'}`,
                  background: selectedClassmates.some(c => c.id === classmate.id)
                    ? themeAccentColor
                    : 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {selectedClassmates.some(c => c.id === classmate.id) && (
                    <Check size={14} color="white" />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '500' }}>{classmate.full_name}</div>
                  {classmate.assigned_class && (
                    <div style={{ fontSize: '12px', color: '#6B7280' }}>
                      Класс: {classmate.assigned_class}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {selectedClassmates.length > 0 && (
          <div style={{ marginTop: '8px', fontSize: '14px', color: '#6B7280' }}>
            Выбрано: {selectedClassmates.length} {selectedClassmates.length === 1 ? 'гость' : 
              selectedClassmates.length < 5 ? 'гостя' : 'гостей'}
          </div>
        )}
      </div>
      
      {/* Invitation Preview */}
      <div className="form-group" style={{ marginTop: '20px' }}>
        <label>Предпросмотр приглашения</label>
        <div style={{
          background: isPink 
            ? 'linear-gradient(135deg, #FDF2F8 0%, #FBCFE8 50%, #F9A8D4 100%)'
            : 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 50%, #93C5FD 100%)',
          borderRadius: '16px',
          padding: '20px',
          textAlign: 'center',
          border: `2px solid ${themeBorderColor}`,
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>
            🎈🎂🎈
          </div>
          <h4 style={{ 
            color: themeColor,
            marginBottom: '8px',
            fontSize: '20px'
          }}>
            {birthdayPartyData.birthday_child_name 
              ? `${birthdayPartyData.birthday_child_name} исполняется ${birthdayPartyData.birthday_child_age || '?'}!`
              : 'День рождения!'}
          </h4>
          {birthdayPartyData.custom_message && (
            <p style={{ 
              fontStyle: 'italic',
              color: isPink ? '#9D174D' : '#1E40AF',
              fontSize: '14px',
              marginBottom: '12px'
            }}>
              &ldquo;{birthdayPartyData.custom_message}&rdquo;
            </p>
          )}
          {newEvent.start_date && (
            <p style={{ 
              fontSize: '14px',
              color: isPink ? '#BE185D' : '#1D4ED8',
              fontWeight: '600'
            }}>
              📅 {new Date(newEvent.start_date).toLocaleDateString('ru-RU', {
                weekday: 'long',
                day: 'numeric', 
                month: 'long'
              })}
              {newEvent.start_time && ` в ${newEvent.start_time}`}
            </p>
          )}
          {newEvent.location && (
            <p style={{ 
              fontSize: '13px',
              color: '#6B7280',
              marginTop: '4px'
            }}>
              📍 {newEvent.location}
            </p>
          )}
          {birthdayPartyData.wish_list.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <p style={{ 
                fontSize: '13px',
                color: themeColor,
                marginBottom: '6px'
              }}>
                <Gift size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                Список желаний:
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center' }}>
                {birthdayPartyData.wish_list.slice(0, 3).map((wish, idx) => (
                  <span key={idx} style={{
                    padding: '2px 8px',
                    background: 'rgba(255,255,255,0.7)',
                    borderRadius: '10px',
                    fontSize: '12px'
                  }}>
                    🎁 {wish}
                  </span>
                ))}
                {birthdayPartyData.wish_list.length > 3 && (
                  <span style={{ fontSize: '12px', color: '#6B7280' }}>
                    +{birthdayPartyData.wish_list.length - 3} ещё
                  </span>
                )}
              </div>
            </div>
          )}
          <div style={{ 
            marginTop: '16px',
            display: 'flex',
            justifyContent: 'center',
            gap: '8px'
          }}>
            <PartyPopper size={20} style={{ color: themeColor }} />
            <span style={{ color: themeColor, fontWeight: '600' }}>
              Жду тебя!
            </span>
            <PartyPopper size={20} style={{ color: themeColor }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BirthdayPartyForm;
