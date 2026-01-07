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
- **Contextual file analysis with ERIC Analyze button**
- **Push Notifications when Business ERICs respond with recommendations**

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

### 2026-01-07: Wall Feed Performance & Pagination (COMPLETE ✅)
- ✅ **Reduced Initial Load:** Default posts reduced from 20 to 10 for faster first load
- ✅ **Lazy Loading "Load More":** Added pagination with "Показать ещё" (Show More) button
- ✅ **Backend Pagination API:** 
  - Returns `{posts: [], has_more: boolean, total: number}` structure
  - Supports `skip` and `limit` query parameters
  - Efficient pagination with `limit + 1` fetch for `has_more` detection
- ✅ **Frontend Pagination State:** 
  - `hasMore`, `isLoadingMore`, `currentPage` state management
  - Proper reset when filters/module changes
- ✅ **Optimized Local Updates:** Comment add/delete updates counts locally without refetching all posts
- ✅ **Styled "Load More" Button:** Module-colored gradient button with loading spinner

### 2026-01-07: Production Performance Optimizations (COMPLETE ✅)
- ✅ **MongoDB Connection Pooling:** maxPoolSize=100, minPoolSize=10, optimized timeouts
- ✅ **In-Memory Cache:** Simple LRU cache with TTL for frequent queries
- ✅ **Rate Limiting:** 
  - AI chat: 20 requests/minute per user
  - AI analysis: 10 requests/minute per user
  - Search: 30 requests/minute per user
- ✅ **GZip Compression:** Enabled for responses > 500 bytes
- ✅ **Background Tasks:** Periodic cache cleanup, index verification on startup
- ✅ **Health Endpoints:**
  - `/api/health` - Basic health check
  - `/api/health/detailed` - Includes DB, cache, rate limiter status
  - `/api/metrics` - Database stats, cache entries, tracked users
- ✅ **Production Configuration Files:**
  - `gunicorn.conf.py` - Optimized worker configuration
  - `production_config.py` - Full deployment guide (nginx, docker, systemd)
- ✅ **CORS Optimization:** 24-hour preflight cache
- ✅ **Logging Optimization:** Reduced verbosity in production mode

### 2026-01-06: Family Section Optimization & Bug Fixes (COMPLETE ✅)
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

### 2026-01-05: Connections Page Performance Optimization (COMPLETE ✅)
- ✅ **Fixed N+1 Query in `/users/suggestions`** - Was making 300+ queries, now uses batch queries
- ✅ **Batch queries with `asyncio.gather()`** for parallel database access
- ✅ **Created 15+ MongoDB indexes** for connections-related collections:
  - `user_friendships.user1_id`, `user_friendships.user2_id`
  - `user_follows.follower_id`, `user_follows.target_id`
  - `friend_requests.sender_id+status`, `friend_requests.receiver_id+status`
  - `work_members.user_id+status`, `school_memberships.user_id`
  - And more...
- ✅ Full FriendsPage load (7 API calls): ~89ms total (was potentially 10+ seconds)

### 2026-01-05: Posts Feed Performance Optimization (COMPLETE ✅)
- ✅ **Fixed N+1 Query Problem** - Reduced from 100+ queries to ~6 batch queries per request
- ✅ **Batch queries for:** authors, media files, likes, reactions
- ✅ **Created MongoDB indexes** for optimal query performance:
  - `posts.created_at` (descending)
  - `posts.source_module + created_at` (compound)
  - `posts.user_id + created_at` (compound)
  - `posts.family_id + created_at` (compound)
  - `post_likes.post_id + user_id` (unique)
  - `post_reactions.post_id + emoji`
  - And more...
- ✅ Response time: ~50-60ms (was potentially 5-10 seconds with many posts)

### 2026-01-05: ERIC Honest Responses - No Hallucination (COMPLETE ✅)
- ✅ ERIC no longer hallucinates when no results found in ZION.CITY database
- ✅ Professional "no results" message promoting ZION.CITY as free platform
- ✅ Updated system prompt with strict anti-hallucination rules
- ✅ Search context explicitly tells AI not to invent data
- ✅ Encourages users to spread the word about ZION.CITY

### 2026-01-05: Notification Click Opens ERIC Chat (COMPLETE ✅)
- ✅ **Click ERIC notification → Opens ERIC chat with query auto-sent**
- ✅ Custom event system: `eric-open-with-query` event
- ✅ ERICChatWidget listens for events and auto-sends queries
- ✅ NotificationDropdown dispatches events on click
- ✅ Visual hint: "Нажмите, чтобы открыть в ERIC" on ERIC notifications
- ✅ Works for both `eric_recommendation` and `eric_analysis` notification types

### 2026-01-05: Smart File Routing - Cost Optimization (COMPLETE ✅)
- ✅ **LLM Cost Optimization:** Documents now analyzed via DeepSeek (cheaper) instead of Claude
- ✅ **Smart File Type Detection:** Automatically routes files to appropriate LLM
  - Images (PNG, JPG, WEBP, GIF) → Claude Sonnet (vision required)
  - Documents (PDF, DOCX, TXT, CSV, XLSX, JSON, XML) → DeepSeek (cost-effective)
- ✅ **Text Extraction Libraries Added:**
  - PyPDF2 for PDF text extraction
  - python-docx for Word documents
  - openpyxl for Excel spreadsheets
- ✅ **New Methods in eric_agent.py:**
  - `detect_file_type()` - Determines routing based on extension/MIME type
  - `extract_text_from_pdf()` - PDF text extraction
  - `extract_text_from_docx()` - Word document extraction
  - `extract_text_from_xlsx()` - Excel spreadsheet extraction
  - `analyze_file_smart()` - Smart routing wrapper
- ✅ **Routing info returned in API response** for transparency

### 2026-01-04: Push Notifications for Inter-Agent Communication (COMPLETE ✅)
- ✅ NotificationDropdown component in top navigation bar
- ✅ Bell icon with unread badge count
- ✅ Notification types: eric_recommendation, eric_analysis, like, comment, etc.
- ✅ Backend endpoints:
  - `GET /api/notifications` - List notifications
  - `GET /api/notifications/unread-count` - Unread count
  - `PUT /api/notifications/{id}/read` - Mark as read
  - `PUT /api/notifications/mark-all-read` - Mark all as read
  - `DELETE /api/notifications/{id}` - Delete notification
- ✅ Auto-creates notification when Business ERICs respond with recommendations
- ✅ Notification shows query, result count, and business names
- ✅ 30-second polling for real-time updates
- ✅ ERIC promo footer in dropdown

### 2026-01-03: Search Action Cards & Inter-Agent Communication
- ✅ Interactive cards with type badges (УСЛУГА, ОРГАНИЗАЦИЯ, РЕКОМЕНДАЦИЯ, etc.)
- ✅ Navigation buttons to relevant pages
- ✅ `/api/agent/query-businesses` endpoint
- ✅ Automatic business ERIC queries on recommendation keywords

### 2026-01-06: Family Section Optimization & Bug Fixes (COMPLETE ✅)
- ✅ **N+1 Query Fixes (5 endpoints):**
  - `GET /api/family-profiles` - Batch query for family profiles
  - `GET /api/family/{id}/members` - Batch query for user data
  - `GET /api/family-profiles/{id}/members` - Batch query for user data
  - `GET /api/family-profiles/{id}/posts` - Batch query for authors + single family fetch
  - `GET /api/family-units/my-units` - Batch query for family units
- ✅ **Database Indexes Added (8 collections):**
  - `family_profiles`: id, creator_id, is_private
  - `family_members`: family_id+is_active, user_id+family_id, compound indexes
  - `family_posts`: family_id+created_at, is_published compound
  - `family_subscriptions`: target+is_active, subscriber+target
  - `family_invitations`: invitee+status, family_id+status
  - `family_units`: id, creator_id, address+surname
  - `family_unit_members`: user_id+is_active, family_unit_id compounds
  - `family_join_requests`: family_unit_id+status, requester_id+status
- ✅ **Authorization Bug Fix:**
  - `DELETE /api/family/{id}/members/{member_id}` - Only admins can remove others; users can leave
- ✅ **Logic Bug Fix:**
  - `POST /api/family/create-with-members` - Now adds creator as member automatically
- ✅ **Model Validation Fixes:**
  - `FamilyProfileResponse` - Added default values for optional fields
  - `FamilyMemberResponse` - Added default values for optional fields

### 2026-01-06: ERIC Search Enhancement - Bilingual Support (COMPLETE ✅)
- ✅ **Fixed "find school" not returning results** - Added English→Russian term expansion
- ✅ **Bidirectional keyword mappings** - Both English and Russian terms now work:
  - "school" → школа, образование, гимназия, лицей
  - "company" → компания, организация, фирма
  - "beauty" → красота, салон, маникюр
  - And many more...
- ✅ **English search trigger words added:** find, search, look for, show me, where, recommend, best
- ✅ **Special education search** - Queries by `organization_type: EDUCATIONAL` when school-related terms detected
- ✅ **Verified working:** "find school" now returns "Тестовая Школа №1"

### 2026-01-03: ERIC Platform Search
- ✅ Search across organizations, services, products, people
- ✅ Keyword expansion (Russian → English categories)
- ✅ Word stem matching

## Architecture

### Backend (FastAPI + MongoDB)
- `/app/backend/server.py` - Main server (~24.5k lines)
- `/app/backend/eric_agent.py` - ERIC AI logic (~1400 lines)
- **Smart LLM Routing (Cost Optimized):**
  - DeepSeek API for text chat AND document analysis (PDF, DOCX, TXT, CSV, XLSX, JSON, XML)
  - Claude Sonnet 4.5 (via Emergent) for image analysis ONLY (PNG, JPG, WEBP, etc.)
- Text extraction libraries: PyPDF2, python-docx, openpyxl

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
