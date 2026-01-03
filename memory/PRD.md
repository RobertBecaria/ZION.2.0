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
- **NEW: Platform-wide search across organizations, services, products, people**

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

### 2026-01-03: ERIC Platform Search (P0 - COMPLETE)
- ✅ **Search API** (`/api/agent/search`) - searches across:
  - Organizations (work_organizations collection)
  - Services (service_listings collection)
  - Products (marketplace_products collection)
  - People (users collection with privacy filtering)
- ✅ **Chat with Search** (`/api/agent/chat-with-search`) - auto-triggers search on keywords
- ✅ **Keyword Expansion** - Russian terms mapped to English categories:
  - красота → beauty, салон, маникюр, парикмахер
  - ремонт → repair, сервис, мастер
  - машина → auto, car, автосервис
- ✅ **Frontend Integration** - Chat widget now uses search-enabled chat endpoint
- ✅ **Bug Fixes**:
  - Fixed search_type='services' incorrectly including organizations
  - Fixed limit parameter to apply to total results, not per-collection

### Previous Sessions
- **ERIC Widget & Prompt Fixes** - Fixed blinking, hallucinations
- **Image & Document Analysis** - Claude Sonnet 4.5 via Emergent LLM Key
- **Media Picker** - Browse files from platform Journal
- **Business ERIC Settings** - Per-organization AI configuration
- **"Ask ERIC AI" Post Visibility** - Alternative to @mentions
- **NewsFeed Refactoring** - Reduced code by ~44%

## Architecture

### Backend (FastAPI + MongoDB)
- `/app/backend/server.py` - Main server with 24k+ lines
- `/app/backend/eric_agent.py` - ERIC AI logic (~1000 lines)
- DeepSeek API for text chat
- Claude Sonnet 4.5 (via Emergent) for vision/documents

### Frontend (React)
- `/app/frontend/src/components/eric/` - ERIC components
- `/app/frontend/src/components/wall/` - Shared post components
- Shadcn UI components in `/app/frontend/src/components/ui/`

### Database Collections
- `agent_conversations` - ERIC chat history
- `agent_settings` - User AI preferences
- `business_eric_settings` - Organization ERIC settings
- `service_listings` - Services marketplace
- `marketplace_products` - Products marketplace
- `work_organizations` - Companies/schools/etc.
- `users` - User profiles

## API Endpoints (ERIC)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agent/chat` | POST | Basic chat (no search) |
| `/api/agent/chat-with-search` | POST | Chat with auto-search |
| `/api/agent/search` | POST | Direct search API |
| `/api/agent/chat-with-image` | POST | Chat with image analysis |
| `/api/agent/analyze-image` | POST | Image analysis only |
| `/api/agent/analyze-document` | POST | Document analysis |
| `/api/agent/conversations` | GET | List conversations |
| `/api/agent/conversations/{id}` | GET/DELETE | Manage conversation |
| `/api/work/organizations/{org_id}/eric-settings` | GET/PUT | Business ERIC settings |

## Prioritized Backlog

### P0 (Critical) - COMPLETE
- ✅ ERIC Platform Search

### P1 (High Priority) - Next Up
- Inter-Agent Communication (Personal ERIC → Business ERIC)
- Enhanced Business Analytics

### P2 (Medium Priority)
- Advanced Financial Advice features
- AI Assistant Settings Page (control data access)
- Drag-and-drop image upload for ERIC chat

### P3 (Low Priority)
- Linter warning cleanup (jsx prop false positives)

## 3rd Party Integrations
- **DeepSeek** - AI/LLM for text chat (User API key)
- **Claude Sonnet 4.5** - Vision/documents (Emergent LLM Key)
- **Exchange Rate API** - Currency conversion
- **OpenStreetMap/Leaflet** - Maps
- **FullCalendar** - Calendar UI

## Test Credentials
- Admin: `admin@test.com` / `testpassword123`
- User: `testuser@test.com` / `testpassword123`

## Test Reports
- `/app/test_reports/iteration_2.json` - ERIC Search tests (26 passed)
- `/app/tests/test_eric_search.py` - Test file
