# ZION.CITY Platform - Product Requirements Document

## Original Problem Statement
Build and enhance the ZION.CITY social platform - a family-focused social network with AI assistant (ERIC) integration, financial tools (Altyn Coin), services marketplace, and community features.

## Core Requirements

### ERIC AI Assistant
- Personal AI assistant powered by DeepSeek V3.2 (text) + Claude Sonnet 4.5 (vision/documents)
- Floating chat widget with sun baby avatar
- Full profile page in "Вещи" (Things) module
- @ERIC mention feature for auto-commenting on posts
- Context-aware responses using platform data
- Russian language UI
- **Platform-wide search across organizations, services, products, people**
- **Interactive search result action cards with navigation**
- **Inter-Agent Communication: Personal ERICs can query Business ERICs**
- **Business Analytics Dashboard for organization owners**
- **AI Assistant Privacy Settings with context-aware analysis**

### Family & Social Features
- Family wall with posts, comments, reactions
- News feed with public/family visibility
- Family member management
- Profile customization

### Financial Tools
- Altyn Coin digital currency system
- Transaction tracking
- Budget planning (future)

## What's Been Implemented

### 2026-01-04: Business Analytics Dashboard (Phase A - COMPLETE ✅)
- ✅ `/api/work/organizations/{org_id}/analytics` endpoint
- ✅ Summary metrics: bookings, reviews, rating, unique customers
- ✅ Period selector: 7d, 30d, 90d, all time
- ✅ Bookings chart with daily breakdown
- ✅ Popular services ranking with booking counts
- ✅ Recent reviews with star ratings
- ✅ Rating distribution visualization
- ✅ Customer loyalty metrics (unique, repeat, repeat rate %)
- ✅ Integrated into Business ERIC Settings (new "Аналитика" tab)

### 2026-01-04: AI Assistant Settings Page (Phase B - COMPLETE ✅)
- ✅ Enhanced ERICProfile settings tab
- ✅ **Data Access Settings** section:
  - Family coordination toggle
  - Financial analysis toggle
  - Service recommendations toggle
  - Marketplace suggestions toggle
  - Health data access toggle
  - Location tracking toggle
- ✅ **Context Analysis Settings** section (NEW):
  - Work context toggle - analyze documents with work context
  - Calendar context toggle - analyze events with calendar context
- ✅ **Conversation History Management**:
  - Stats display (conversations, messages counts)
  - "Clear all history" button with confirmation

### 2026-01-04: Contextual Upload Integration (Phase C - COMPLETE ✅)
- ✅ `ERICAnalyzeButton` component created
- ✅ Supports context types: work, family, finance, calendar, marketplace, generic
- ✅ Auto-generates context-aware analysis prompts
- ✅ Three variants: default, compact, icon-only
- ✅ Both options available:
  - Auto-analyze when clicking "Analyze with ERIC"
  - Store context for later user-initiated analysis
- ✅ **Integrated into all upload flows:**
  - PostComposer (wall) - generic context
  - WorkPostComposer - work context with organization data
  - FamilyPostComposer - family context with family unit data
  - MarketplaceListingForm - marketplace context with product info
- ✅ **New backend endpoint:** `/api/agent/analyze-file-upload`
  - Handles FormData file uploads (images, documents)
  - Converts images to base64 for Claude AI analysis
  - Supports all context types with context_data
- ✅ **Analysis Modal:**
  - Displays Claude AI analysis results
  - "Копировать" (Copy) button
  - "Добавить в пост" (Add to post) button

### 2026-01-03: Search Action Cards & Inter-Agent Communication
- ✅ Interactive cards with type badges (УСЛУГА, ОРГАНИЗАЦИЯ, РЕКОМЕНДАЦИЯ, etc.)
- ✅ Navigation buttons to relevant pages
- ✅ `/api/agent/query-businesses` endpoint
- ✅ Automatic business ERIC queries on recommendation keywords

### 2026-01-03: ERIC Platform Search
- ✅ Search across organizations, services, products, people
- ✅ Keyword expansion (Russian → English categories)
- ✅ Word stem matching

## Architecture

### Backend (FastAPI + MongoDB)
- `/app/backend/server.py` - Main server (~24.5k lines)
- `/app/backend/eric_agent.py` - ERIC AI logic (~1200 lines)
- DeepSeek API for text chat
- Claude Sonnet 4.5 (via Emergent) for vision/documents

### Frontend (React)
- `/app/frontend/src/components/eric/` - ERIC components
  - `ERICChatWidget.js` - Main chat interface
  - `ERICSearchCards.js` - Search result action cards
  - `ERICAnalyzeButton.js` - Contextual analysis button (NEW)
  - `MediaPicker.js` - Platform file picker
  - `ERICProfile.js` - Full ERIC profile page with settings
- `/app/frontend/src/components/BusinessAnalyticsDashboard.js` (NEW)
- `/app/frontend/src/components/BusinessERICSettings.js` - Business ERIC settings with analytics tab

### Database Collections
- `agent_conversations` - ERIC chat history
- `agent_settings` - User AI preferences (with new context fields)
- `business_eric_settings` - Organization ERIC settings
- `service_listings` - Services marketplace
- `service_bookings` - Booking records (used for analytics)
- `service_reviews` - Service reviews (used for analytics)
- `marketplace_products` - Products marketplace
- `work_organizations` - Companies/schools/etc.

## API Endpoints

### ERIC AI
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agent/chat-with-search` | POST | Chat with auto-search + inter-agent |
| `/api/agent/search` | POST | Direct search API |
| `/api/agent/query-businesses` | POST | Query multiple business ERICs |
| `/api/agent/settings` | GET/PUT | User privacy settings |
| `/api/agent/analyze-file-upload` | POST | Context-aware file analysis (FormData) |

### Business Analytics (NEW)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/work/organizations/{org_id}/analytics` | GET | Business analytics dashboard data |
| `/api/work/organizations/{org_id}/eric-settings` | GET/PUT | Business ERIC settings |

## Privacy Settings Fields

### User Agent Settings
```
allow_financial_analysis: bool
allow_health_data_access: bool
allow_location_tracking: bool
allow_family_coordination: bool
allow_service_recommendations: bool
allow_marketplace_suggestions: bool
allow_work_context: bool (NEW)
allow_calendar_context: bool (NEW)
```

### Business ERIC Settings
```
is_active: bool
share_public_data: bool
share_promotions: bool
share_repeat_customer_stats: bool
share_ratings_reviews: bool
allow_user_eric_queries: bool
share_aggregated_analytics: bool
```

## Prioritized Backlog

### P0-P2 (Complete ✅)
- ✅ ERIC Platform Search
- ✅ Search Action Cards with Navigation
- ✅ Inter-Agent Communication
- ✅ Business Analytics Dashboard
- ✅ AI Assistant Settings Page
- ✅ Contextual Upload Integration

### P3 (Low Priority) - Backlog
- Linter warning cleanup
- Drag-and-drop image upload (decided not to implement - use section-based uploads instead)

## 3rd Party Integrations
- **DeepSeek** - AI/LLM for text chat (User API key)
- **Claude Sonnet 4.5** - Vision/documents (Emergent LLM Key)
- **Exchange Rate API** - Currency conversion
- **OpenStreetMap/Leaflet** - Maps
- **FullCalendar** - Calendar UI

## Test Reports
- `/app/test_reports/iteration_2.json` - ERIC Search tests (26 passed)
- `/app/test_reports/iteration_3.json` - Action Cards & Inter-Agent (13 passed)

## Test Credentials
- Admin: `admin@test.com` / `testpassword123`
- User: `testuser@test.com` / `testpassword123`

## Design Philosophy: Contextual Intelligence
Instead of drag-and-drop uploads, files are uploaded through their relevant sections (Work, Family, Finance, etc.). This provides:
1. **Better Context** - ERIC knows the file's purpose from its upload location
2. **Improved Analysis** - Context-aware prompts generate more relevant insights
3. **Privacy Boundaries** - Context settings control which sections ERIC can analyze
4. **Future Search** - Context tags enable better search and organization
