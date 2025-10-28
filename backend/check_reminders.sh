#!/bin/bash
# Event Reminders Cron Script
# This script checks for upcoming events and sends reminders

# Configuration
BACKEND_URL="http://localhost:8001"
LOG_FILE="/var/log/event_reminders.log"

# Function to log messages
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to get service token
get_service_token() {
    # Try to get token from service account
    RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"system@zion.city","password":"system_service_password_2024"}')
    
    TOKEN=$(echo $RESPONSE | grep -o '"access_token":"[^"]*' | sed 's/"access_token":"//')
    
    if [ -z "$TOKEN" ]; then
        log_message "ERROR: Failed to get service token"
        return 1
    fi
    
    echo $TOKEN
    return 0
}

# Main execution
log_message "Starting event reminders check..."

# Try internal endpoint first (no auth required, localhost only)
RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/internal/check-reminders" \
    -H "X-Internal-Request: true" \
    -w "\nHTTP_CODE:%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" = "200" ]; then
    log_message "SUCCESS: Reminders check completed"
    log_message "Response: $BODY"
else
    log_message "ERROR: Failed with HTTP code $HTTP_CODE"
    log_message "Response: $BODY"
    exit 1
fi

log_message "Event reminders check finished"
exit 0
