#!/bin/bash
# Setup cron job for event reminders

echo "Setting up Event Reminders Cron Job..."

# Make the check script executable
chmod +x /app/backend/check_reminders.sh

# Create log file
touch /var/log/event_reminders.log
chmod 666 /var/log/event_reminders.log

# Check if cron job already exists
CRON_ENTRY="*/5 * * * * /app/backend/check_reminders.sh"

if crontab -l 2>/dev/null | grep -q "check_reminders.sh"; then
    echo "✓ Cron job already exists"
else
    # Add cron job
    (crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -
    echo "✓ Cron job added successfully"
fi

# Display current crontab
echo ""
echo "Current crontab:"
crontab -l

echo ""
echo "✅ Setup complete!"
echo "Event reminders will be checked every 5 minutes"
echo "Log file: /var/log/event_reminders.log"
