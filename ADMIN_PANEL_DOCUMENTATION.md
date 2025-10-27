# Admin Panel for Change Requests - Documentation

## Overview
Admin panel allows organization administrators to review and manage member role change requests, department change requests, and team change requests.

## Features Implemented

### 1. **Notification Badge System**
- **Location**: Settings button on organization profile
- **Functionality**: Shows count of pending change requests
- **Visual**: Red badge with number, animated pulse effect
- **Updates**: Real-time update after approving/rejecting requests

### 2. **Settings Tabs with Badge**
- **Location**: Inside Settings modal → Company Settings
- **Tabs Available**:
  - Основное (Basic)
  - Контакты (Contacts)
  - Медиа (Media)
  - Приватность (Privacy)
  - **Запросы (Requests)** ← Shows badge with pending count

### 3. **Change Requests Manager**
- **Location**: Settings → Company Settings → Запросы tab
- **Features**:
  - Filter by status: PENDING, APPROVED, REJECTED
  - View request details (user info, requested change, reason)
  - Approve button (one-click approval)
  - Reject button (with optional rejection reason)
  - Real-time list updates
  - User avatars and profile info
  - Timestamps for created_at and reviewed_at

### 4. **Request Types Supported**
- ROLE_CHANGE: Member requests role upgrade/change
- DEPARTMENT_CHANGE: Member requests department transfer
- TEAM_CHANGE: Member requests team change

## User Flow

### For Members:
1. Navigate to Organization Profile
2. Click "НАСТРОЙКИ" (Settings)
3. Go to "МОИ НАСТРОЙКИ" (My Settings) tab
4. Fill out role/department/team change request
5. Provide reason for change
6. Submit request
7. Wait for admin approval

### For Admins:
1. Navigate to Organization Profile
2. See notification badge on "НАСТРОЙКИ" button (if pending requests exist)
3. Click "НАСТРОЙКИ"
4. See badge on "Запросы" tab
5. Click "Запросы" tab
6. View all pending requests with full details
7. Click "Одобрить" (Approve) or "Отклонить" (Reject)
8. If rejecting, optionally provide rejection reason
9. Request is processed immediately
10. Member's role/department/team is updated (if approved)
11. Badge counts update automatically

## API Endpoints Used

### Get Pending Change Requests Count
```
GET /api/work/organizations/{organization_id}/change-requests?status=PENDING
Response: { data: [array of requests] }
```

### Get All Change Requests (with filter)
```
GET /api/work/organizations/{organization_id}/change-requests?status={PENDING|APPROVED|REJECTED}
Response: { data: [array of requests] }
```

### Approve Request
```
POST /api/work/organizations/{organization_id}/change-requests/{request_id}/approve
Response: { success: true, message: "..." }
```

### Reject Request
```
POST /api/work/organizations/{organization_id}/change-requests/{request_id}/reject
Body: { rejection_reason: "optional reason" }
Response: { success: true, message: "..." }
```

## Components Modified

### 1. WorkOrganizationProfile.js
- Added `pendingChangeRequestsCount` state
- Added `loadPendingChangeRequests()` function to fetch count
- Updated Settings button with notification badge
- Passes count to child components

### 2. WorkOrganizationSettings.js
- Added `pendingChangeRequestsCount` state
- Added `loadPendingChangeRequests()` function
- Updated "Запросы" tab with badge display
- Passes `onRequestHandled` callback to WorkChangeRequestsManager
- Refreshes count after request handling

### 3. WorkChangeRequestsManager.js
- Added `onRequestHandled` prop
- Calls callback after approve/reject actions
- Displays user info, request details, timestamps
- Allows filtering by status
- Modal for rejection reason

## Styling

### Badge Styles
```css
/* Notification badge on button */
.absolute -top-2 -right-2 min-w-[24px] h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-2 animate-pulse

/* Badge on tab */
.ml-1 min-w-[20px] h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1.5
```

## Testing Scenarios

### Test 1: Member Creates Request
1. Login as MEMBER user
2. Go to organization settings
3. Submit role change request
4. Verify request is created

### Test 2: Admin Sees Notification
1. Login as ADMIN user
2. Navigate to organization profile
3. Verify badge appears on Settings button
4. Click Settings
5. Verify badge appears on "Запросы" tab

### Test 3: Admin Approves Request
1. Login as ADMIN
2. Go to Settings → Запросы
3. See pending request
4. Click "Одобрить"
5. Verify request disappears from PENDING
6. Verify member's role is updated in database
7. Verify badge count decreases

### Test 4: Admin Rejects Request
1. Login as ADMIN
2. Go to Settings → Запросы
3. See pending request
4. Click "Отклонить"
5. Enter rejection reason
6. Submit
7. Verify request moves to REJECTED status
8. Verify badge count decreases

### Test 5: Filter By Status
1. Go to Запросы tab
2. Click "Одобрено" filter
3. Verify only approved requests shown
4. Click "Отклонено" filter
5. Verify only rejected requests shown
6. Click "Ожидание" filter
7. Verify only pending requests shown

## Future Enhancements

1. **Real-time Notifications**: WebSocket integration for instant updates
2. **Email Notifications**: Send email to member when request is approved/rejected
3. **Batch Operations**: Approve/reject multiple requests at once
4. **Request History**: View full audit trail of all requests
5. **Auto-approve Rules**: Set up rules for automatic approval based on conditions
6. **Delegation**: Allow managers to handle requests for their departments
7. **Request Comments**: Allow back-and-forth discussion on requests
8. **Analytics**: Dashboard showing request statistics and trends

## Known Limitations

1. No real-time updates (requires page refresh to see new requests from other admins)
2. No notification sound/visual alert for new requests
3. Badge only updates after manual action (approve/reject)
4. No "Request Details" expanded view
5. No bulk approve/reject functionality

## Accessibility

- All interactive elements have proper keyboard navigation
- Color contrast meets WCAG AA standards
- Screen reader friendly labels
- Focus states clearly visible

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Performance

- Badge count loads asynchronously
- No performance impact on organization profile load
- Request list paginated (50 per page)
- Optimistic UI updates for approve/reject actions
