/**
 * CalendarGrid Component
 * Monthly calendar grid with event dots, selection, and flash animations
 */
import React from 'react';
import { getCreatorRoleInfo } from './utils';

const CalendarGrid = ({ 
  days,
  events,
  today,
  selectedDate,
  moduleColor = '#6D28D9',
  flashingInvitations = [],
  onDaySelect,
  onEventSelect,
  getEventsForDate
}) => {
  return (
    <div className="calendar-grid">
      {days.map((dayInfo, index) => {
        const dayEvents = dayInfo.date ? getEventsForDate(dayInfo.date) : [];
        const isToday = dayInfo.date === today;
        const isSelected = dayInfo.date === selectedDate;
        
        return (
          <div 
            key={index}
            className={`calendar-day ${!dayInfo.day ? 'empty' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
            onClick={() => dayInfo.date && onDaySelect && onDaySelect(dayInfo.date)}
            style={{
              borderColor: isSelected ? moduleColor : undefined,
              backgroundColor: isSelected ? `${moduleColor}10` : undefined
            }}
          >
            {dayInfo.day && (
              <>
                <span className="day-number" style={{ 
                  color: isToday ? 'white' : undefined,
                  backgroundColor: isToday ? moduleColor : undefined
                }}>
                  {dayInfo.day}
                </span>
                <div className="day-events">
                  {dayEvents.slice(0, 3).map(event => {
                    const roleInfo = getCreatorRoleInfo(event.creator_role);
                    const isFlashing = flashingInvitations.includes(event.id);
                    return (
                      <div 
                        key={event.id}
                        className={`event-dot ${isFlashing ? 'birthday-flash' : ''}`}
                        style={{ 
                          backgroundColor: event.role_color || roleInfo.color,
                          animation: isFlashing ? 'birthdayFlash 0.5s ease-in-out infinite' : undefined
                        }}
                        title={`${event.title} (${roleInfo.label})`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventSelect && onEventSelect(event);
                        }}
                      >
                        <span className="event-dot-title">{event.title}</span>
                      </div>
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <span className="more-events">+{dayEvents.length - 3}</span>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default CalendarGrid;
