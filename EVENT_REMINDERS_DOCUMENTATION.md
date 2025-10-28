# Event Reminders System - Documentation

## Overview

Автоматическая система напоминаний о событиях для модуля Work в Zion.City.
Отправляет in-app уведомления участникам за 15 минут, 1 час или 1 день до события.

## Architecture

### Components

1. **Backend Logic** (`/app/backend/server.py`)
   - Event reminder models and intervals
   - Reminder checking logic
   - Notification creation
   - API endpoints

2. **Background Service** (`/app/backend/reminder_service.sh`)
   - Runs continuously via Supervisor
   - Checks for reminders every 5 minutes
   - Logs to `/var/log/event_reminders.log`

3. **Frontend UI** (`/app/frontend/src/components/WorkEventsPanel.js`)
   - Reminder selection checkboxes
   - Event creation form

## How It Works

### Event Creation Flow

1. User создает событие в WorkEventsPanel
2. Выбирает reminders: "За 15 минут", "За 1 час", "За 1 день"
3. Data сохраняется в MongoDB:
   ```json
   {
     "title": "Встреча команды",
     "scheduled_date": "2025-10-28T15:00:00Z",
     "reminder_intervals": ["15_MINUTES", "1_HOUR"],
     "reminders_sent": {}
   }
   ```

### Reminder Checking Flow

1. **Background Service** запускается каждые 5 минут
2. Вызывает `/api/internal/check-reminders` (localhost only)
3. Backend проверяет все события:
   - Находит события с `reminder_intervals`
   - Вычисляет время для каждого reminder
   - Проверяет 5-минутное окно (-5 до +5 минут)
4. Если время подходит:
   - Определяет участников (GOING/MAYBE или all members)
   - Создает notifications типа `EVENT_REMINDER`
   - Обновляет `reminders_sent` чтобы не дублировать

### Notification Format

```json
{
  "type": "EVENT_REMINDER",
  "title": "Напоминание о событии",
  "message": "Событие \"Встреча команды\" начнется через 15 минут",
  "metadata": {
    "event_id": "...",
    "event_title": "Встреча команды",
    "event_time": "15:00",
    "location": "Конференц-зал А",
    "interval": "15_MINUTES"
  },
  "is_read": false
}
```

## Service Management

### Check Service Status

```bash
sudo supervisorctl status event-reminders
```

### View Logs

```bash
# Real-time logs
tail -f /var/log/event_reminders.log

# Last 50 lines
tail -50 /var/log/event_reminders.log

# Supervisor logs
tail -f /var/log/supervisor/event-reminders.out.log
```

### Restart Service

```bash
sudo supervisorctl restart event-reminders
```

### Stop Service

```bash
sudo supervisorctl stop event-reminders
```

### Manual Trigger (for testing)

```bash
# Via script
bash /app/backend/check_reminders.sh

# Via API (requires auth)
curl -X POST http://localhost:8001/api/work/events/check-reminders \
  -H "Authorization: Bearer YOUR_TOKEN"

# Via internal endpoint (no auth, localhost only)
curl -X POST http://localhost:8001/api/internal/check-reminders \
  -H "X-Internal-Request: true"
```

## Configuration

### Reminder Intervals

Defined in `server.py`:

```python
class WorkEventReminderInterval(str, Enum):
    FIFTEEN_MINUTES = "15_MINUTES"  # 15 минут до события
    ONE_HOUR = "1_HOUR"             # 1 час до события
    ONE_DAY = "1_DAY"               # 1 день до события
```

### Check Interval

Default: **5 minutes**

To change, edit `/app/backend/reminder_service.sh`:

```bash
CHECK_INTERVAL=300  # 5 minutes in seconds
```

Change to 300 (5min), 600 (10min), etc., then restart:

```bash
sudo supervisorctl restart event-reminders
```

### Time Window

Default: **5 minutes** (-5 to +5 from target time)

This allows flexibility for the scheduler. If reminder should fire at 14:45:00,
it will trigger anytime between 14:40:00 and 14:50:00.

To change, edit `check_and_send_event_reminders()` in `server.py`:

```python
if -300 <= time_diff <= 300:  # 5 minutes = 300 seconds
```

## Recipient Logic

### With RSVP Enabled

Reminders sent only to users who responded:
- ✅ GOING
- ✅ MAYBE
- ❌ NOT_GOING (not sent)

### Without RSVP

Reminders sent based on visibility:

- **ALL_MEMBERS**: All active organization members
- **DEPARTMENT**: All active department members
- **TEAM**: All team members

## Troubleshooting

### Reminders Not Sending

1. **Check service status**:
   ```bash
   sudo supervisorctl status event-reminders
   ```

2. **Check logs for errors**:
   ```bash
   tail -50 /var/log/event_reminders.log
   tail -50 /var/log/supervisor/event-reminders.err.log
   ```

3. **Verify backend is running**:
   ```bash
   curl http://localhost:8001/api/health
   ```

4. **Check event data in MongoDB**:
   ```bash
   mongosh
   use zion_city
   db.work_organization_events.find({reminder_intervals: {$ne: []}}).pretty()
   ```

5. **Manual trigger to test**:
   ```bash
   bash /app/backend/check_reminders.sh
   ```

### Service Won't Start

```bash
# Check supervisor logs
tail -50 /var/log/supervisor/event-reminders.err.log

# Verify script is executable
ls -l /app/backend/reminder_service.sh

# Make executable if needed
chmod +x /app/backend/reminder_service.sh

# Restart
sudo supervisorctl restart event-reminders
```

### Duplicate Notifications

The system tracks sent reminders in `reminders_sent` field:

```json
{
  "reminders_sent": {
    "15_MINUTES": ["user_id_1", "user_id_2"],
    "1_HOUR": ["user_id_1"]
  }
}
```

If duplicates occur, check:
1. System time is correct
2. MongoDB connection is stable
3. No multiple instances of service running

## API Endpoints

### `/api/work/events/check-reminders` (POST)

**Auth**: Required (JWT token)

**Purpose**: Manual trigger for testing

**Example**:
```bash
curl -X POST http://localhost:8001/api/work/events/check-reminders \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### `/api/internal/check-reminders` (POST)

**Auth**: None (localhost only + internal header)

**Purpose**: Called by background service

**Security**:
- Only accessible from localhost (127.0.0.1)
- Requires `X-Internal-Request: true` header

**Example**:
```bash
curl -X POST http://localhost:8001/api/internal/check-reminders \
  -H "X-Internal-Request: true"
```

## Database Schema

### work_organization_events

```javascript
{
  id: String,
  organization_id: String,
  title: String,
  scheduled_date: DateTime,
  scheduled_time: String,  // "HH:MM"
  reminder_intervals: [String],  // ["15_MINUTES", "1_HOUR", "1_DAY"]
  reminders_sent: {
    "15_MINUTES": [String],  // [user_ids]
    "1_HOUR": [String],
    "1_DAY": [String]
  },
  rsvp_enabled: Boolean,
  rsvp_responses: {
    user_id: "GOING" | "MAYBE" | "NOT_GOING"
  },
  visibility: "ALL_MEMBERS" | "DEPARTMENT" | "TEAM",
  // ... other fields
}
```

### work_notifications

```javascript
{
  id: String,
  organization_id: String,
  user_id: String,
  type: "EVENT_REMINDER",
  title: String,
  message: String,
  metadata: {
    event_id: String,
    event_title: String,
    event_time: String,
    location: String,
    organization_name: String,
    interval: String  // "15_MINUTES", "1_HOUR", "1_DAY"
  },
  is_read: Boolean,
  created_at: DateTime
}
```

## Performance Considerations

### Database Queries

The system performs these queries every 5 minutes:

1. Find events with reminders in future
2. For each event, find participants
3. Create notifications for each participant
4. Update events with reminders_sent

**Optimization tips**:
- Index on `scheduled_date` and `reminder_intervals`
- Index on `organization_id` for participant queries
- Limit to 100 events per check (configurable)

### Scaling

For large deployments:

1. **Increase check interval** if many events
2. **Add sharding** by organization
3. **Use Celery** for distributed workers
4. **Add Redis** for caching participant lists

## Future Enhancements

- [ ] Email notifications (requires email service)
- [ ] Push notifications (requires service worker)
- [ ] SMS reminders (requires Twilio/similar)
- [ ] Custom reminder times (user-defined)
- [ ] Snooze reminder option
- [ ] Analytics dashboard
- [ ] Reminder preferences per user

## Support

For issues or questions:
1. Check logs first
2. Review this documentation
3. Test with manual trigger
4. Contact system administrator

---

**Last Updated**: October 28, 2025  
**Version**: 1.0  
**Status**: ✅ Production Ready
