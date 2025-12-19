import React, { useState, useEffect, useCallback } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  Clock, 
  MapPin, 
  User,
  Plus,
  CheckCircle,
  AlertCircle,
  Target,
  Filter,
  ListTodo,
  Flag,
  Users,
  UserCheck,
  Timer,
  FileText
} from 'lucide-react';

// Priority colors for tasks
const PRIORITY_COLORS = {
  URGENT: '#EF4444',
  HIGH: '#F97316',
  MEDIUM: '#EAB308',
  LOW: '#22C55E'
};

// Status colors for tasks
const STATUS_COLORS = {
  NEW: '#6B7280',
  IN_PROGRESS: '#3B82F6',
  DONE: '#22C55E'
};

function UniversalCalendar({ 
  user, 
  activeModule = 'family', 
  moduleColor = '#059669',
  onClose,
  onTaskClick  // New prop to handle task clicks
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [scheduledActions, setScheduledActions] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('month'); // 'month', 'week', 'day'
  
  // Task filters state
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [assignmentFilter, setAssignmentFilter] = useState('ALL');

  const months = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  // Fetch tasks for Organizations module
  const fetchTasks = useCallback(async () => {
    if (activeModule !== 'organizations') return;
    
    try {
      const token = localStorage.getItem('zion_token');
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();
      
      const params = new URLSearchParams({
        month: month.toString(),
        year: year.toString()
      });
      
      if (statusFilter !== 'ALL') params.append('status_filter', statusFilter);
      if (priorityFilter !== 'ALL') params.append('priority_filter', priorityFilter);
      if (assignmentFilter !== 'ALL') params.append('assignment_filter', assignmentFilter);
      
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/work/tasks/calendar?${params.toString()}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  }, [activeModule, currentDate, statusFilter, priorityFilter, assignmentFilter]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchScheduledActions();
  }, [currentDate, activeModule]);

  useEffect(() => {
    if (activeModule === 'organizations') {
      fetchTasks();
    }
  }, [fetchTasks, activeModule]);

  const fetchScheduledActions = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('zion_token');
      
      // First get all chat groups for the current module
      const groupsResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/chat-groups`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (groupsResponse.ok) {
        const groupsData = await groupsResponse.json();
        const chatGroups = groupsData.chat_groups || [];
        
        // Filter groups based on active module (for now, show all for family)
        const relevantGroups = chatGroups.filter(g => {
          if (activeModule === 'family') {
            return g.group.group_type === 'FAMILY' || g.group.group_type === 'RELATIVES' || g.group.group_type === 'CUSTOM';
          }
          // Later we can add filtering for other modules
          return true;
        });

        // Fetch scheduled actions for all relevant groups
        const allActions = [];
        for (const groupData of relevantGroups) {
          try {
            const actionsResponse = await fetch(
              `${process.env.REACT_APP_BACKEND_URL}/api/chat-groups/${groupData.group.id}/scheduled-actions`,
              {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              }
            );

            if (actionsResponse.ok) {
              const actionsData = await actionsResponse.json();
              const actions = actionsData.scheduled_actions || [];
              
              // Add group info and module color to each action
              actions.forEach(action => {
                action.group = groupData.group;
                action.moduleColor = moduleColor;
              });
              
              allActions.push(...actions);
            }
          } catch (error) {
            console.error(`Error fetching actions for group ${groupData.group.id}:`, error);
          }
        }

        setScheduledActions(allActions);
      }
    } catch (error) {
      console.error('Error fetching scheduled actions:', error);
    } finally {
      setLoading(false);
    }
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = (firstDay.getDay() + 6) % 7; // Convert to Monday = 0

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const getActionsForDate = (date) => {
    if (!date) return [];
    
    return scheduledActions.filter(action => {
      const actionDate = new Date(action.scheduled_date);
      return (
        actionDate.getDate() === date.getDate() &&
        actionDate.getMonth() === date.getMonth() &&
        actionDate.getFullYear() === date.getFullYear()
      );
    });
  };

  // Get tasks for a specific date (by deadline or created_at)
  const getTasksForDate = (date) => {
    if (!date || activeModule !== 'organizations') return [];
    
    const dateStr = date.toISOString().split('T')[0];
    
    return tasks.filter(task => {
      // Check deadline
      if (task.deadline) {
        const deadlineDate = task.deadline.split('T')[0];
        if (deadlineDate === dateStr) return true;
      }
      // Check created_at
      if (task.created_at) {
        const createdDate = task.created_at.split('T')[0];
        if (createdDate === dateStr) return true;
      }
      return false;
    });
  };

  // Get countdown text for a deadline
  const getCountdown = (deadlineStr) => {
    if (!deadlineStr) return null;
    
    const deadline = new Date(deadlineStr);
    const now = new Date();
    const diff = deadline - now;
    
    if (diff <= 0) return { label: 'Просрочено', expired: true };
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) {
      return { label: `${days}д ${hours}ч`, days, hours, expired: false };
    } else if (hours > 0) {
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return { label: `${hours}ч ${minutes}м`, hours, minutes, expired: false };
    } else {
      const minutes = Math.floor(diff / (1000 * 60));
      return { label: `${minutes}м`, minutes, expired: false };
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    return timeString.slice(0, 5); // HH:MM format
  };

  const getActionIcon = (actionType) => {
    switch (actionType) {
      case 'REMINDER':
        return <AlertCircle size={14} />;
      case 'BIRTHDAY':
        return <User size={14} />;
      case 'APPOINTMENT':
        return <Clock size={14} />;
      case 'EVENT':
        return <Calendar size={14} />;
      default:
        return <AlertCircle size={14} />;
    }
  };

  const isToday = (date) => {
    if (!date) return false;
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isSelectedDate = (date) => {
    if (!date) return false;
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  const selectedDateActions = getActionsForDate(selectedDate);
  const selectedDateTasks = getTasksForDate(selectedDate);

  // Handle task click - open detail or navigate
  const handleTaskClick = (task, action = 'detail') => {
    if (onTaskClick) {
      onTaskClick(task, action);
    }
  };

  // Render task filters panel for Organizations
  const renderFiltersPanel = () => {
    if (activeModule !== 'organizations') return null;
    
    return (
      <div className="calendar-filters-panel">
        <button 
          className={`filter-toggle-btn ${showFilters ? 'active' : ''}`}
          onClick={() => setShowFilters(!showFilters)}
          style={{ color: showFilters ? moduleColor : undefined }}
        >
          <Filter size={16} />
          Фильтры задач
        </button>
        
        {showFilters && (
          <div className="filters-dropdown">
            {/* Status Filter */}
            <div className="filter-group">
              <label><ListTodo size={14} /> Статус</label>
              <div className="filter-options">
                {[
                  { value: 'ALL', label: 'Все' },
                  { value: 'ACTIVE', label: 'Активные' },
                  { value: 'COMPLETED', label: 'Завершённые' }
                ].map(opt => (
                  <button
                    key={opt.value}
                    className={`filter-option ${statusFilter === opt.value ? 'active' : ''}`}
                    onClick={() => setStatusFilter(opt.value)}
                    style={{ 
                      backgroundColor: statusFilter === opt.value ? `${moduleColor}20` : undefined,
                      borderColor: statusFilter === opt.value ? moduleColor : undefined,
                      color: statusFilter === opt.value ? moduleColor : undefined
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Priority Filter */}
            <div className="filter-group">
              <label><Flag size={14} /> Приоритет</label>
              <div className="filter-options">
                {[
                  { value: 'ALL', label: 'Все', color: '#6B7280' },
                  { value: 'URGENT', label: 'Срочный', color: PRIORITY_COLORS.URGENT },
                  { value: 'HIGH', label: 'Высокий', color: PRIORITY_COLORS.HIGH },
                  { value: 'MEDIUM', label: 'Средний', color: PRIORITY_COLORS.MEDIUM },
                  { value: 'LOW', label: 'Низкий', color: PRIORITY_COLORS.LOW }
                ].map(opt => (
                  <button
                    key={opt.value}
                    className={`filter-option ${priorityFilter === opt.value ? 'active' : ''}`}
                    onClick={() => setPriorityFilter(opt.value)}
                    style={{ 
                      backgroundColor: priorityFilter === opt.value ? `${opt.color}20` : undefined,
                      borderColor: priorityFilter === opt.value ? opt.color : undefined,
                      color: priorityFilter === opt.value ? opt.color : undefined
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Assignment Filter */}
            <div className="filter-group">
              <label><Users size={14} /> Назначение</label>
              <div className="filter-options">
                {[
                  { value: 'ALL', label: 'Все' },
                  { value: 'MY', label: 'Мои' },
                  { value: 'TEAM', label: 'Команды' },
                  { value: 'CREATED', label: 'Созданные мной' }
                ].map(opt => (
                  <button
                    key={opt.value}
                    className={`filter-option ${assignmentFilter === opt.value ? 'active' : ''}`}
                    onClick={() => setAssignmentFilter(opt.value)}
                    style={{ 
                      backgroundColor: assignmentFilter === opt.value ? `${moduleColor}20` : undefined,
                      borderColor: assignmentFilter === opt.value ? moduleColor : undefined,
                      color: assignmentFilter === opt.value ? moduleColor : undefined
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render task item
  const renderTaskItem = (task) => {
    const priorityColor = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.MEDIUM;
    const statusColor = STATUS_COLORS[task.status] || STATUS_COLORS.NEW;
    const countdown = getCountdown(task.deadline);
    
    return (
      <div
        key={task.id}
        className={`calendar-task-item ${task.is_overdue ? 'overdue' : ''} ${task.status === 'DONE' ? 'completed' : ''}`}
        style={{ borderLeftColor: priorityColor }}
        onClick={() => handleTaskClick(task, 'detail')}
      >
        <div className="task-header">
          <div className="task-icon" style={{ backgroundColor: `${priorityColor}20`, color: priorityColor }}>
            <Target size={14} />
          </div>
          <div className="task-details">
            <h5>{task.title}</h5>
            <div className="task-meta">
              {/* Status badge */}
              <span 
                className="status-badge"
                style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
              >
                {task.status === 'NEW' && 'Новая'}
                {task.status === 'IN_PROGRESS' && 'В работе'}
                {task.status === 'DONE' && 'Завершена'}
              </span>
              
              {/* Priority badge */}
              <span 
                className="priority-badge"
                style={{ backgroundColor: `${priorityColor}20`, color: priorityColor }}
              >
                {task.priority === 'URGENT' && 'Срочно'}
                {task.priority === 'HIGH' && 'Высокий'}
                {task.priority === 'MEDIUM' && 'Средний'}
                {task.priority === 'LOW' && 'Низкий'}
              </span>
              
              {/* Countdown */}
              {countdown && !countdown.expired && task.status !== 'DONE' && (
                <span className="countdown-badge" style={{ color: moduleColor }}>
                  <Timer size={12} />
                  {countdown.label}
                </span>
              )}
              
              {/* Overdue indicator */}
              {task.is_overdue && (
                <span className="overdue-badge">
                  <AlertCircle size={12} />
                  Просрочено
                </span>
              )}
            </div>
          </div>
          {task.status === 'DONE' && (
            <CheckCircle size={16} color="#22C55E" />
          )}
        </div>
        
        {/* Assignee info */}
        {task.assignee_name && (
          <div className="task-assignee">
            <UserCheck size={12} />
            {task.assignee_name}
          </div>
        )}
        
        {/* Organization */}
        <div className="task-org">
          {task.organization_name}
        </div>
        
        {/* Action buttons */}
        <div className="task-actions">
          <button 
            className="task-action-btn"
            onClick={(e) => { e.stopPropagation(); handleTaskClick(task, 'navigate'); }}
            title="Перейти к задаче"
          >
            <FileText size={14} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="universal-calendar">
      {/* Calendar Header */}
      <div className="calendar-header" style={{ borderBottomColor: moduleColor }}>
        <div className="calendar-title">
          <Calendar size={24} style={{ color: moduleColor }} />
          <h2>
            {activeModule === 'organizations' ? 'Календарь задач' : 'Календарь семьи'}
          </h2>
        </div>
        <button className="close-calendar-btn" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="calendar-content">
        {/* Calendar Navigation */}
        <div className="calendar-nav">
          <button onClick={() => navigateMonth(-1)} className="nav-btn">
            <ChevronLeft size={20} />
          </button>
          <h3 className="current-month">
            {months[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h3>
          <button onClick={() => navigateMonth(1)} className="nav-btn">
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Task Filters (Organizations only) */}
        {renderFiltersPanel()}

        <div className="calendar-main">
          {/* Calendar Grid */}
          <div className="calendar-grid">
            {/* Weekday Headers */}
            <div className="weekdays">
              {weekdays.map(day => (
                <div key={day} className="weekday">{day}</div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="calendar-days">
              {getDaysInMonth(currentDate).map((date, index) => {
                const actions = getActionsForDate(date);
                const dateTasks = getTasksForDate(date);
                const allItems = [...actions, ...dateTasks];
                
                // Get unique priority colors for task indicators
                const taskPriorities = dateTasks.map(t => t.priority);
                
                return (
                  <div
                    key={index}
                    className={`calendar-day ${!date ? 'empty' : ''} ${isToday(date) ? 'today' : ''} ${isSelectedDate(date) ? 'selected' : ''}`}
                    onClick={() => date && setSelectedDate(date)}
                    style={{
                      borderColor: isSelectedDate(date) ? moduleColor : undefined,
                      backgroundColor: isSelectedDate(date) ? `${moduleColor}10` : undefined
                    }}
                  >
                    {date && (
                      <>
                        <span 
                          className="day-number"
                          style={{
                            backgroundColor: isToday(date) ? moduleColor : undefined,
                            color: isToday(date) ? 'white' : undefined
                          }}
                        >
                          {date.getDate()}
                        </span>
                        {allItems.length > 0 && (
                          <div className="day-indicators">
                            {/* Regular action indicators */}
                            {actions.slice(0, 2).map((action, i) => (
                              <div
                                key={`action-${i}`}
                                className="action-indicator"
                                style={{ backgroundColor: action.moduleColor }}
                                title={action.title}
                              />
                            ))}
                            
                            {/* Task indicators with priority colors */}
                            {dateTasks.slice(0, 3 - Math.min(actions.length, 2)).map((task, i) => (
                              <div
                                key={`task-${i}`}
                                className="task-indicator"
                                style={{ backgroundColor: PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.MEDIUM }}
                                title={`🎯 ${task.title}`}
                              >
                                🎯
                              </div>
                            ))}
                            
                            {allItems.length > 3 && (
                              <div className="more-indicator">+{allItems.length - 3}</div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Date Details */}
          <div className="selected-date-panel">
            <div className="selected-date-header">
              <h4>
                {selectedDate.toLocaleDateString('ru-RU', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long'
                })}
              </h4>
              <span className="actions-count">
                {selectedDateActions.length + selectedDateTasks.length} событий
              </span>
            </div>

            <div className="date-actions">
              {loading ? (
                <div className="loading-actions">
                  <div className="loading-spinner"></div>
                  <span>Загрузка...</span>
                </div>
              ) : (selectedDateActions.length === 0 && selectedDateTasks.length === 0) ? (
                <div className="no-actions">
                  <Calendar size={32} color="#9ca3af" />
                  <p>Нет событий на эту дату</p>
                </div>
              ) : (
                <>
                  {/* Tasks Section (Organizations) */}
                  {activeModule === 'organizations' && selectedDateTasks.length > 0 && (
                    <div className="tasks-section">
                      <h5 className="section-title">
                        <Target size={16} style={{ color: moduleColor }} />
                        Задачи ({selectedDateTasks.length})
                      </h5>
                      {selectedDateTasks.map(task => renderTaskItem(task))}
                    </div>
                  )}
                  
                  {/* Actions Section */}
                  {selectedDateActions.length > 0 && (
                    <div className="actions-section">
                      {activeModule === 'organizations' && selectedDateTasks.length > 0 && (
                        <h5 className="section-title">
                          <Calendar size={16} style={{ color: moduleColor }} />
                          События ({selectedDateActions.length})
                        </h5>
                      )}
                      {selectedDateActions
                        .sort((a, b) => {
                          if (!a.scheduled_time && !b.scheduled_time) return 0;
                          if (!a.scheduled_time) return 1;
                          if (!b.scheduled_time) return -1;
                          return a.scheduled_time.localeCompare(b.scheduled_time);
                        })
                        .map((action) => (
                          <div
                            key={action.id}
                            className={`calendar-action-item ${action.is_completed ? 'completed' : ''}`}
                            style={{ borderLeftColor: action.moduleColor }}
                          >
                            <div className="action-header">
                              <div className="action-icon" style={{ color: action.moduleColor }}>
                                {getActionIcon(action.action_type)}
                              </div>
                              <div className="action-details">
                                <h5>{action.title}</h5>
                                <div className="action-meta">
                                  {action.scheduled_time && (
                                    <span className="action-time">
                                      <Clock size={12} />
                                      {formatTime(action.scheduled_time)}
                                    </span>
                                  )}
                                  {action.location && (
                                    <span className="action-location">
                                      <MapPin size={12} />
                                      {action.location}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {action.is_completed && (
                                <CheckCircle size={16} color="#10b981" />
                              )}
                            </div>
                            {action.description && (
                              <p className="action-description">{action.description}</p>
                            )}
                            <div className="action-group">
                              Группа: {action.group?.name || 'Неизвестная группа'}
                            </div>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Legend for Organizations */}
      {activeModule === 'organizations' && (
        <div className="calendar-legend">
          <span className="legend-title">Приоритет задач:</span>
          <div className="legend-items">
            <span className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: PRIORITY_COLORS.URGENT }}></span>
              Срочный
            </span>
            <span className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: PRIORITY_COLORS.HIGH }}></span>
              Высокий
            </span>
            <span className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: PRIORITY_COLORS.MEDIUM }}></span>
              Средний
            </span>
            <span className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: PRIORITY_COLORS.LOW }}></span>
              Низкий
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default UniversalCalendar;
