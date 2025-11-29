/**
 * InfoWorldZone Component
 * Right sidebar widgets for My Info and My Documents views
 */
import React from 'react';

const InfoWorldZone = ({ activeView }) => {
  // My Documents view - Privacy widget
  if (activeView === 'my-documents') {
    return (
      <div className="info-world-zone">
        <div className="widget privacy-widget">
          <div className="widget-header" style={{ background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)' }}>
            <div className="gadget-icon" style={{ fontSize: '1.5rem', marginRight: '8px' }}>🔒</div>
            <span style={{ color: '#78350F', fontWeight: '700' }}>Конфиденциальность</span>
          </div>
          <div className="widget-content" style={{ padding: '16px', background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)' }}>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.875rem', lineHeight: '1.6', color: '#92400E' }}>
              <strong style={{ display: 'block', color: '#78350F', fontWeight: '600', marginBottom: '4px', fontSize: '0.9375rem' }}>Защита данных</strong>
              Все ваши документы надежно зашифрованы и видны только вам.
            </p>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.875rem', lineHeight: '1.6', color: '#92400E' }}>
              <strong style={{ display: 'block', color: '#78350F', fontWeight: '600', marginBottom: '4px', fontSize: '0.9375rem' }}>Приватность сканов</strong>
              Скан-копии документов отображаются только в разделе «МОИ ДОКУМЕНТЫ» и не появляются в галерее фотографий.
            </p>
            <p style={{ margin: '0', fontSize: '0.875rem', lineHeight: '1.6', color: '#92400E' }}>
              <strong style={{ display: 'block', color: '#78350F', fontWeight: '600', marginBottom: '4px', fontSize: '0.9375rem' }}>Контроль доступа</strong>
              Только вы можете просматривать и управлять своими документами.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // My Info view - Info widget
  if (activeView === 'my-info') {
    return (
      <div className="info-world-zone">
        <div className="widget info-widget">
          <div className="widget-header" style={{ background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)' }}>
            <div className="gadget-icon" style={{ fontSize: '1.5rem', marginRight: '8px' }}>ℹ️</div>
            <span style={{ color: '#78350F', fontWeight: '700' }}>О Профиле</span>
          </div>
          <div className="widget-content" style={{ padding: '16px', background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)' }}>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.875rem', lineHeight: '1.6', color: '#92400E' }}>
              <strong style={{ display: 'block', color: '#78350F', fontWeight: '600', marginBottom: '4px', fontSize: '0.9375rem' }}>Централизованные данные</strong>
              Эта страница показывает все ваши персональные данные в одном месте.
            </p>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.875rem', lineHeight: '1.6', color: '#92400E' }}>
              <strong style={{ display: 'block', color: '#78350F', fontWeight: '600', marginBottom: '4px', fontSize: '0.9375rem' }}>Изменение данных</strong>
              Для обновления адреса и семейного положения используйте модуль <strong>Семья</strong>.
            </p>
            <p style={{ margin: '0', fontSize: '0.875rem', lineHeight: '1.6', color: '#92400E' }}>
              <strong style={{ display: 'block', color: '#78350F', fontWeight: '600', marginBottom: '4px', fontSize: '0.9375rem' }}>Использование</strong>
              Ваши данные используются в 8 разделах платформы для персонализации функций.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default InfoWorldZone;
