import React from 'react';
import { Home, Users, MapPin, Star, UserPlus } from 'lucide-react';

const MatchingFamiliesDisplay = ({ matches, onJoinRequest, onCreateNew }) => {
  return (
    <div className="matching-families-display">
      <div className="matching-header">
        <div className="matching-icon">
          <Home size={48} color="#059669" />
        </div>
        <h2>Мы нашли похожие семьи!</h2>
        <p>Найдены семьи с похожим адресом и фамилией. Вы можете присоединиться к существующей семье или создать новую.</p>
      </div>

      <div className="matching-families-list">
        {matches.map((match) => (
          <div key={match.family_unit_id} className="family-match-card">
            <div className="match-score">
              <Star size={20} fill="#FFD700" color="#FFD700" />
              <span>{match.match_score}/3</span>
            </div>

            <div className="family-match-info">
              <h3>{match.family_name}</h3>
              <p className="family-surname">{match.family_surname}</p>

              <div className="family-match-details">
                <div className="match-detail">
                  <MapPin size={16} />
                  <span>
                    {match.address.street}, {match.address.city}, {match.address.country}
                  </span>
                </div>

                <div className="match-detail">
                  <Users size={16} />
                  <span>{match.member_count} {match.member_count === 1 ? 'член' : 'членов'}</span>
                </div>
              </div>

              <div className="match-criteria">
                <span className="criteria-badge">
                  {match.match_score >= 1 && '✓ Адрес совпадает'}
                </span>
                <span className="criteria-badge">
                  {match.match_score >= 2 && '✓ Фамилия совпадает'}
                </span>
                {match.match_score >= 3 && (
                  <span className="criteria-badge">✓ Телефон совпадает</span>
                )}
              </div>
            </div>

            <button
              onClick={() => onJoinRequest(match.family_unit_id)}
              className="btn-primary btn-join-family"
            >
              <UserPlus size={18} />
              Отправить запрос
            </button>
          </div>
        ))}
      </div>

      <div className="matching-footer">
        <div className="divider">
          <span>или</span>
        </div>
        <button onClick={onCreateNew} className="btn-secondary btn-create-new">
          Создать новую семью
        </button>
      </div>
    </div>
  );
};

export default MatchingFamiliesDisplay;