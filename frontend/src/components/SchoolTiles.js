import React from 'react';
import { GraduationCap, Users, BookOpen, ChevronRight } from 'lucide-react';

const SchoolTiles = ({ schools, role, onSchoolSelect }) => {
  if (!schools || schools.length === 0) {
    return (
      <div className="empty-state-large">
        <GraduationCap size={48} style={{ color: '#6D28D9', opacity: 0.5 }} />
        <h3>Нет Школ</h3>
        <p>
          {role === 'parent' 
            ? 'У вас пока нет детей, зачисленных в школы'
            : 'Вы пока не работаете ни в одной образовательной организации'}
        </p>
      </div>
    );
  }

  return (
    <div className="school-tiles-container">
      <div className="school-tiles-header">
        <h2>
          {role === 'parent' ? 'Школы Ваших Детей' : 'Школы, Где Вы Преподаёте'}
        </h2>
        <p className="subtitle">
          {role === 'parent' 
            ? 'Выберите школу для просмотра информации о детях и их успеваемости'
            : 'Выберите школу для работы с классами и журналом'}
        </p>
      </div>

      <div className="school-tiles-grid">
        {schools.map((school) => (
          <div 
            key={school.organization_id} 
            className="school-tile"
            onClick={() => onSchoolSelect(school)}
          >
            <div className="school-tile-icon">
              <GraduationCap size={32} />
            </div>
            
            <div className="school-tile-content">
              <h3>{school.organization_name}</h3>
              
              {role === 'parent' ? (
                <div className="school-tile-meta">
                  <div className="meta-item">
                    <Users size={16} />
                    <span>
                      {school.children_count} {
                        school.children_count === 1 ? 'ребёнок' : 
                        school.children_count > 4 ? 'детей' : 'ребёнка'
                      }
                    </span>
                  </div>
                </div>
              ) : (
                <div className="school-tile-meta">
                  {school.teaching_subjects && school.teaching_subjects.length > 0 && (
                    <div className="meta-item">
                      <BookOpen size={16} />
                      <span>{school.teaching_subjects.join(', ')}</span>
                    </div>
                  )}
                  {school.teaching_grades && school.teaching_grades.length > 0 && (
                    <div className="meta-item">
                      <Users size={16} />
                      <span>Классы: {school.teaching_grades.join(', ')}</span>
                    </div>
                  )}
                  {school.is_class_supervisor && school.supervised_class && (
                    <div className="supervisor-badge">
                      Классный руководитель {school.supervised_class}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="school-tile-arrow">
              <ChevronRight size={20} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SchoolTiles;
