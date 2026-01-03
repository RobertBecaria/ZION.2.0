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

### 2026-01-03: Search Action Cards & Inter-Agent Communication (COMPLETE ✅)

**Search Action Cards:**
- ✅ Interactive cards in ERIC chat with type badges:
  - 🟢 УСЛУГА (Service) - Green, "Забронировать" button → /services/{id}
  - 🟣 ОРГАНИЗАЦИЯ (Organization) - Indigo, "Подробнее" button → /organizations/{id}
  - 🟡 ТОВАР (Product) - Amber, "Посмотреть" button → /marketplace/{id}
  - 💜 РЕКОМЕНДАЦИЯ (Recommendation) - Purple, from inter-agent queries
  - 🩷 ЧЕЛОВЕК (Person) - Pink, "Написать" button → /messages?user={id}
- ✅ Metadata display: price, city, rating, promotions indicator
- ✅ Navigation via window.location for Router context compatibility

**Inter-Agent Communication (P1):**
- ✅ `query_multiple_businesses` method in eric_agent.py
- ✅ `/api/agent/query-businesses` endpoint
- ✅ Automatic business ERIC queries on recommendation keywords (лучший, рекомендуй, посоветуй)
- ✅ Privacy-respecting responses based on business settings
- ✅ Relevance scoring for result ranking

### 2026-01-03: ERIC Platform Search (P0 - COMPLETE ✅)
- ✅ Search API (`/api/agent/search`)
- ✅ Chat with Search (`/api/agent/chat-with-search`)
- ✅ Keyword Expansion (Russian → English categories)
- ✅ Word stem matching (услуг, красот, школ, etc.)

### Previous Sessions
- ERIC Widget & Prompt Fixes
- Image & Document Analysis (Claude Sonnet 4.5)
- Media Picker from Platform Journal
- Business ERIC Settings UI/API
- "Ask ERIC AI" Post Visibility
- NewsFeed Refactoring

## Architecture

### Backend (FastAPI + MongoDB)
- `/app/backend/server.py` - Main server with 24k+ lines
- `/app/backend/eric_agent.py` - ERIC AI logic (~1200 lines)
- DeepSeek API for text chat
- Claude Sonnet 4.5 (via Emergent) for vision/documents

### Frontend (React)
- `/app/frontend/src/components/eric/` - ERIC components
  - `ERICChatWidget.js` - Main chat interface
  - `ERICSearchCards.js` - Search result action cards
  - `MediaPicker.js` - Platform file picker
- Shadcn UI components

### Database Collections
- `agent_conversations` - ERIC chat history
- `agent_settings` - User AI preferences
- `business_eric_settings` - Organization ERIC settings
- `service_listings` - Services marketplace
- `marketplace_products` - Products marketplace
- `work_organizations` - Companies/schools/etc.

## API Endpoints (ERIC)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agent/chat` | POST | Basic chat (no search) |
| `/api/agent/chat-with-search` | POST | Chat with auto-search + inter-agent |
| `/api/agent/search` | POST | Direct search API |
| `/api/agent/query-businesses` | POST | Query multiple business ERICs |
| `/api/agent/chat-with-image` | POST | Chat with image analysis |
| `/api/agent/analyze-image` | POST | Image analysis only |
| `/api/work/organizations/{org_id}/eric-settings` | GET/PUT | Business ERIC settings |

## Prioritized Backlog

### P0 & P1 (Critical & High) - COMPLETE ✅
- ✅ ERIC Platform Search
- ✅ Search Action Cards with Navigation
- ✅ Inter-Agent Communication

### P2 (Medium Priority) - Next Up
- Enhanced Business Analytics (aggregated insights)
- AI Assistant Settings Page
- Drag-and-drop image upload for ERIC chat

### P3 (Low Priority)
- Linter warning cleanup

## 3rd Party Integrations
- **DeepSeek** - AI/LLM for text chat (User API key)
- **Claude Sonnet 4.5** - Vision/documents (Emergent LLM Key)
- **Exchange Rate API** - Currency conversion
- **OpenStreetMap/Leaflet** - Maps
- **FullCalendar** - Calendar UI

## Test Reports
- `/app/test_reports/iteration_2.json` - ERIC Search tests (26 passed)
- `/app/test_reports/iteration_3.json` - Action Cards & Inter-Agent (13 passed)
- `/app/tests/test_eric_search.py` - Search test file
- `/app/tests/test_eric_inter_agent.py` - Inter-Agent test file

## Test Credentials
- Admin: `admin@test.com` / `testpassword123`
- User: `testuser@test.com` / `testpassword123`
