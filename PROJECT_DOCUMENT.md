# ZION.CITY 2.0 - Project Document

**Version:** V3 Branch (Production)
**Last Updated:** January 27, 2026
**Repository:** github.com/RobertBecaria/ZION.2.0
**Production Server:** 212.41.8.199 (Ubuntu 24.04, i7-8700, 64GB RAM)

---

## 1. PROJECT OVERVIEW

ZION.CITY is a comprehensive digital ecosystem platform combining social networking, family management, education, commerce, finance, and AI assistance into a unified Russian-language web application. It serves as an all-in-one platform for families, organizations, schools, and communities.

### Core Concept
A multi-module social platform where users can:
- Manage family profiles and relationships (NODE/SUPER NODE family architecture)
- Participate in organizations and schools
- Post content, follow channels, and interact socially
- Buy/sell in a marketplace and manage personal inventory
- Book services from providers
- Manage finances with an internal cryptocurrency (Altyn Coin)
- Plan and attend community events
- Chat in real-time with individuals and groups
- Interact with ERIC - an AI assistant powered by DeepSeek and Claude

---

## 2. TECH STACK

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Python | 3.11 | Runtime |
| FastAPI | 0.110.1 | Web framework (async) |
| Uvicorn + Gunicorn | Latest | ASGI server |
| MongoDB | 7.x | Primary database |
| Motor | Latest | Async MongoDB driver |
| Redis | 7.x (Alpine) | Caching & sessions |
| PyJWT | Latest | Authentication |
| Bcrypt | 4.0.1 | Password hashing |

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19.0.0 | UI framework |
| Tailwind CSS | 3.4.17 | Styling |
| Radix UI / shadcn | 40+ components | Component library |
| Lucide React | 0.507.0 | Icons |
| React Hook Form | 7.56.2 | Forms |
| Zod | 3.24.4 | Validation |
| FullCalendar | 6.1.19 | Calendar views |
| Leaflet | 1.9.4 | Maps |
| Craco | 7.1.0 | Build config |

### AI Integration
| Service | Model | Purpose |
|---------|-------|---------|
| DeepSeek | V3.2 (deepseek-chat) | Text, document analysis, primary chat |
| Anthropic Claude | Sonnet 4.5 | Image/vision analysis only |

### Infrastructure
| Component | Details |
|-----------|---------|
| Docker | Multi-stage build |
| Nginx | 12 workers, reverse proxy |
| Supervisor | Process manager |
| Docker Compose | 3 services (app, mongodb, redis) |

---

## 3. APPLICATION MODULES (8 Modules)

### 3.1 Family Module (Color: #30A67E)
- Family profiles with NODE (nuclear family) and SUPER NODE (household) architecture
- Family units with roles: HEAD, SPOUSE, CHILD, PARENT
- Family wall/feed with posts
- Family invitations and join requests with voting
- Household management
- Children tracking with school enrollment

### 3.2 News / Community Module (Color: #1D4ED8)
- News channels with categories (World News, Politics, Economy, Tech, etc.)
- Channel creation, subscription, and moderation
- News feed with posts, likes, comments
- User profiles and social interactions
- Friends, followers, following system
- People discovery with recommendations
- News events (meetups, concerts, broadcasts)

### 3.3 Journal / Education Module (Color: #6D28D9)
- School enrollment and class management
- Student gradebook with grades
- Academic calendar with events
- Teacher profiles and schedules
- School dashboard with audience filters
- Class schedules

### 3.4 Services Module (Color: #B91C1C)
- Service listings across categories
- Service booking with calendar slots
- Reviews and ratings system
- Provider profiles
- Booking management

### 3.5 Organizations / Work Module (Color: #C2410C)
- Organization creation (COMPANY, EDUCATIONAL, etc.)
- Department and team management
- Work announcements with reactions
- Task management with templates, subtasks, deadlines
- Member roles and permissions
- Join requests and approvals
- Work events and calendar
- Organization analytics

### 3.6 Marketplace Module (Color: #BE185D)
- Product listings with categories
- Personal inventory (My Things)
- Favorites
- List inventory items for sale
- Warranty tracking
- ERIC AI shopping assistant

### 3.7 Finance Module (Color: #A16207)
- Altyn Coin wallet
- Token portfolio
- Transaction history
- Corporate wallets for organizations
- Exchange rates
- Marketplace and service payments
- Admin: Token emission, dividends, welcome bonuses

### 3.8 Events / Good Will Module (Color: #8B5CF6)
- Community event planning
- Interest groups
- RSVP and ticket purchasing
- Event photos and reviews
- Event chat
- QR code check-in
- Organizer profiles
- Wishlist management
- Favorites and reminders

---

## 4. CROSS-MODULE FEATURES

### 4.1 Authentication
- JWT-based (HS256) with Bearer tokens
- 60-minute expiration (production)
- Separate admin authentication
- Bcrypt password hashing (12 rounds)
- Optional authentication on some endpoints

### 4.2 Real-Time Chat
- WebSocket at `/api/ws/chat/{chatId}`
- Group chats and direct messages
- Typing indicators
- Message read receipts
- Voice messages (record + playback)
- Emoji reactions
- File attachments
- Auto-reconnection with 3s delay

### 4.3 ERIC AI Assistant
- Persistent conversation history (30-day retention)
- Document analysis (PDF, DOCX, XLSX via DeepSeek)
- Image analysis (via Claude Vision)
- Platform data search
- Business queries
- Post mentions
- User-configurable privacy settings
- Multi-language (Russian/English auto-detect)

### 4.4 Media Storage
- File upload with user/module organization
- Supports: images (PNG, JPG, WEBP, GIF), documents (PDF, DOCX, XLSX), audio (MP3, WAV, MP4)
- 10MB max upload size
- Media collections
- Lightbox image viewer
- Cross-module media access

### 4.5 Notifications
- Real-time notification system
- 30-day TTL auto-expiration
- Unread count tracking
- Mark as read (individual and bulk)

### 4.6 Social Features
- Posts with likes, comments, emoji reactions
- Friend requests and friendships
- Follow/unfollow users and organizations
- User search and discovery
- Profile privacy settings

---

## 5. API ENDPOINTS SUMMARY

| Module | Endpoint Count |
|--------|---------------|
| Authentication & Users | 30+ |
| Family | 35+ |
| News & Channels | 40+ |
| Work & Organizations | 70+ |
| Education | 20+ |
| Chat & Messaging | 25+ |
| Social (Posts, Friends) | 20+ |
| Services | 15+ |
| Marketplace & Inventory | 20+ |
| Finance | 30+ |
| Events / Good Will | 35+ |
| Journal / Calendar | 10+ |
| ERIC AI Agent | 15+ |
| Media & Files | 10+ |
| Admin Dashboard | 25+ |
| Utilities | 5+ |
| **Total** | **~425 endpoints** |

---

## 6. DATABASE

### MongoDB Collections (~97 collections)

**User & Auth:** users, user_affiliations, profile_privacy_settings, user_documents, user_follows, user_friendships

**Family:** family_profiles, family_members, family_invitations, family_posts, family_subscriptions, family_units, family_unit_members, family_unit_posts, family_join_requests, households, household_members

**Chat:** chat_groups, chat_group_members, chat_messages, direct_chats, direct_chat_messages, typing_status, scheduled_actions

**Social:** posts, post_likes, post_comments, post_reactions, comment_likes, friend_requests, friendships, notifications

**Work:** organizations, work_organizations, work_members, work_posts, work_notifications, work_departments, work_teams, work_join_requests, work_change_requests, work_tasks, work_task_templates

**Education:** teachers, school_memberships, work_students, student_grades, student_enrollment_requests, class_schedules, academic_events

**News:** news_channels, channel_subscriptions, channel_moderators, news_posts, news_post_likes, news_post_comments, news_events

**Services:** service_listings, service_bookings, service_reviews

**Marketplace:** marketplace_products, marketplace_favorites, inventory_items

**Finance:** wallets, transactions, emissions, dividend_payouts, exchange_rates

**Events:** goodwill_events, event_organizer_profiles, event_attendees, event_chat, event_favorites, event_invitations, event_photos, event_reminders, event_reviews, interest_groups, group_members

**AI:** agent_conversations

**Media:** media_files, media_collections

---

## 7. FRONTEND ARCHITECTURE

### Component Count: 247+ files

### Key Directories
```
frontend/src/
├── components/
│   ├── auth/          (8 files)  - Login, Register, Onboarding
│   ├── layout/        (4 files)  - ModuleNav, LeftSidebar, RightSidebar
│   ├── ui/            (48 files) - shadcn/Radix components
│   ├── wall/          (7 files)  - PostComposer, PostItem, PostMedia, Comments
│   ├── chat/          (13 files) - Chat, Messages, Voice, Emoji
│   ├── eric/          (6 files)  - AI Widget, Profile, Search
│   ├── work/          (11 files) - Tasks, Departments, Teams
│   ├── marketplace/   (11 files) - Products, Inventory, Listings
│   ├── services/      (13 files) - Service Cards, Bookings, Reviews
│   ├── finances/      (8 files)  - Wallet, Portfolio, Transactions
│   ├── goodwill/      (16 files) - Events, Groups, Photos, Reviews
│   ├── admin/         (8 files)  - Admin Panel, User/DB Management
│   └── 100+ standalone components
├── pages/             (8 module content pages)
├── hooks/             (Custom React hooks)
├── config/            (API configuration)
├── contexts/          (Auth + App contexts)
└── skins/             (5 CSS skin variants)
```

### State Management
- **AuthContext**: User auth, login/logout, token management
- **AppContext**: Global navigation, module state, UI state
- **Custom Hooks**: useChatWebSocket, useFamilyData, useOrganizationsData, etc.
- **Local State**: useState for component-level state
- **Props Drilling**: Module props passed through component tree

### CSS / Styling
- Tailwind CSS 3.4.17 (primary)
- 5 CSS skin variants in `/skins/`:
  - skin-v1-original (668KB)
  - skin-v2-modern (40KB)
  - skin-v3-tailadmin (48KB)
  - skin-v4-dual-mode (75KB)
  - skin-v5-ultimate (71KB)
- Module-based color system
- CSS custom properties for theming

---

## 8. DEPLOYMENT

### Docker Architecture
```
┌─────────────────────────────────┐
│  Docker Compose Network         │
│  (zion-network: 172.28.0.0/16)  │
│                                 │
│  ┌──────────────────────┐       │
│  │  zion-city-app       │       │
│  │  Ports: 9080, 9443   │       │
│  │  ├─ Nginx (12 wkrs)  │       │
│  │  ├─ Gunicorn (13 wkrs)│      │
│  │  └─ React Build       │      │
│  │  Memory: 16GB/4GB     │      │
│  └──────────┬───────────┘       │
│             │                    │
│  ┌──────────┴──────┐ ┌────────┐ │
│  │  zion-mongodb   │ │ redis  │ │
│  │  Mongo 7        │ │ 7-alp  │ │
│  │  Memory: 12GB   │ │ 5GB    │ │
│  └─────────────────┘ └────────┘ │
└─────────────────────────────────┘
```

### Deployment Commands
```bash
./deploy.sh setup     # Initial server setup
./deploy.sh deploy    # Build and deploy
./deploy.sh update    # Git pull and redeploy
./deploy.sh ssl       # Setup Let's Encrypt
./deploy.sh logs      # View logs
./deploy.sh status    # Health check
./deploy.sh backup    # Database backup
./deploy.sh restart   # Restart all
```

### Production Server
- **IP:** 212.41.8.199
- **OS:** Ubuntu 24.04 LTS
- **CPU:** i7-8700 (6 cores / 12 threads)
- **RAM:** 64GB
- **Storage:** 2x 480GB SSD
- **Firewall:** UFW (SSH, HTTP, HTTPS)
- **Security:** fail2ban for SSH

---

## 9. SECURITY

### Application Security
- JWT authentication with role separation (user/admin)
- Bcrypt password hashing (12 rounds)
- Input validation with regex escaping for MongoDB
- CORS origin whitelisting
- Rate limiting by operation type:
  - AI Chat: 20 req/min
  - File Analysis: 10 req/min
  - Search: 30 req/min
  - Posts: 10 req/min
  - General: 100 req/min
- 10MB request body limit
- No public static file mount

### Nginx Security
- Content-Security-Policy (strict, no unsafe-inline)
- X-Frame-Options: SAMEORIGIN
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: no geolocation/mic/camera
- AI crawler blocking (GPTBot, ChatGPT, CCBot, ClaudeBot, etc.)
- Hidden server version

### Docker Security
- Non-root execution (www-data)
- Multi-stage builds (minimal attack surface)
- Health checks on all containers
- Read-only SSL cert mount

---

## 10. GIT BRANCH STRATEGY

| Branch | Purpose | Status |
|--------|---------|--------|
| `V3` | Production deployment | Active |
| `main` | Default/stable | Base |
| `E2` | Frontend variant (lighter) | Merged into V3 |
| `v3.0-original-skin` | Backend source for V3 | Source |

### Current V3 Branch
V3 was created by merging:
- **Frontend** from E2 branch (cleaner/lighter codebase)
- **Backend** from v3.0-original-skin branch (more features, tests)

### Recent Changes (V3)
1. Fixed News feed BACKEND_URL config (centralized API config)
2. Fixed media 401 errors (allow known source modules without auth)
3. Added image lightbox and error handling
4. Merged E2 frontend with v3.0-original-skin backend
5. Fixed ERIC chat widget (static button, full mode navigation)
6. Fixed nginx permissions for non-root Docker

---

## 11. TESTING

### Backend Tests
- **Framework:** pytest with pytest-asyncio
- **Location:** `/backend/tests/`
- **Test Suites:**
  - test_auth.py - Authentication
  - test_security.py - Security
  - test_users.py - User management
  - test_family.py - Family module
  - test_chat.py - Chat
  - test_organizations.py - Organizations
  - test_validation.py - Input validation
  - test_finance_module.py - Finance

### Frontend Tests
- **Framework:** Playwright
- **Config:** playwright.config.ts
- **Status:** Basic setup, not extensively automated

### Running Tests
```bash
# Backend
cd backend && pytest -v
pytest -m security      # Security tests only
pytest --cov            # With coverage

# Frontend
cd frontend && yarn test
npx playwright test     # E2E tests
```

---

## 12. ENVIRONMENT VARIABLES

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_URL` | Yes | MongoDB connection string |
| `DB_NAME` | Yes | Database name (zion_city) |
| `JWT_SECRET_KEY` | Yes | JWT signing secret (32+ chars) |
| `REDIS_URL` | Yes | Redis connection string |
| `ENVIRONMENT` | Yes | production / development |
| `CORS_ORIGINS` | Yes | Allowed origins |
| `DEEPSEEK_API_KEY` | Yes | DeepSeek AI API key |
| `EMERGENT_LLM_KEY` | Yes | Anthropic Claude API key |
| `ADMIN_USERNAME` | Yes | Admin panel username |
| `ADMIN_PASSWORD` | Yes | Admin panel password |
| `MONGO_PASSWORD` | Yes | MongoDB root password |
| `DEBUG` | No | Debug mode (True/False) |
| `GUNICORN_WORKERS` | No | Worker count (default: 13) |
| `GUNICORN_THREADS` | No | Threads per worker (default: 4) |

---

## 13. KNOWN ISSUES & TECHNICAL DEBT

### Active Issues
1. **Many components use `process.env.REACT_APP_BACKEND_URL` directly** instead of the centralized `config/api.js` import. Fixed for News module components but ~30+ other components still have this pattern.
2. **Missing `/api/news/posts/{post_id}/reaction` endpoint** - Frontend calls it but backend doesn't implement it.
3. **No CI/CD pipeline** - Deployment is manual via SSH and deploy.sh script.
4. **No monitoring/alerting** - No Prometheus, ELK, or Sentry integration.

### Architectural Notes
- `server.py` is ~27,840 lines (monolithic). Could benefit from splitting into modules.
- Frontend uses state-based navigation instead of URL routing (React Router is installed but not used for main navigation).
- Some components have inline `<style jsx>` blocks (e.g., PostMedia.js) instead of using Tailwind or CSS files.

---

## 14. PROJECT STATISTICS

| Metric | Count |
|--------|-------|
| Backend LOC | ~29,500 |
| Frontend Components | 247+ |
| API Endpoints | ~425 |
| MongoDB Collections | ~97 |
| Application Modules | 8 |
| AI Models Integrated | 2 |
| CSS Skin Variants | 5 |
| Backend Test Suites | 9 |
| WebSocket Endpoints | 1 |
| Supported File Types | 20+ |
| Docker Containers | 3 |

---

*Document generated from codebase analysis on January 27, 2026*
