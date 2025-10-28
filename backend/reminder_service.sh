#!/bin/bash
# Event Reminders Background Service
# Runs continuously and checks for reminders every 5 minutes

LOG_FILE="/var/log/event_reminders.log"
CHECK_INTERVAL=300  # 5 minutes in seconds

log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_message "=== Event Reminders Service Started ==="

while true; do
    log_message "Starting event reminders check..."
    
    # Call internal endpoint
    RESPONSE=$(curl -s -X POST "http://localhost:8001/api/internal/check-reminders" \
        -H "X-Internal-Request: true" \
        -w "\nHTTP_CODE:%{http_code}")
    
    HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
    BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE/d')
    
    if [ "$HTTP_CODE" = "200" ]; then
        log_message "SUCCESS: $BODY"
    else
        log_message "ERROR: HTTP $HTTP_CODE - $BODY"
    fi
    
    log_message "Next check in 5 minutes..."
    sleep $CHECK_INTERVAL
done
