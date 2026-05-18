# HyperGuest B2B Channel Manager

A full-stack **Next.js 14** application for managing hotel B2B channel operations via the HyperGuest API ecosystem — including property sync, ARI subscription management, booking push, callback ingestion, and a live analytics dashboard.

---

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![MSSQL](https://img.shields.io/badge/MSSQL-2022-CC2927?logo=microsoftsqlserver)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)
![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Features

| Module | Description |
|---|---|
| **Dashboard** | KPI cards, booking trend chart, recent activity, callback queue status |
| **Property Sync** | Paginated sync from HyperGuest Static API with search and filter |
| **Facilities** | Global facilities catalogue fetch and display |
| **ARI Subscriptions** | Create, view, enable/disable ARI subscriptions per property |
| **Booking Push** | Send OTA_HotelResNotifRQ XML (commit & cancel) to HyperGuest Book API |
| **Callback Log** | Inspect incoming ARI update payloads; mark as processed |
| **API Logs** | Full audit trail of every outbound API call with latency and status |
| **Search / Availability** | Live rate & availability search via HyperGuest Search API |
| **Rate Plans** | Browse rate plans per property from the Static API |
| **Room Types** | Browse room type inventory per property |
| **Booking Stats** | Date-range booking analytics backed by `usp_GetBookingStats` |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     Browser / Admin UI                           │
│              Next.js 14 App Router  (React 18)                   │
└──────────────────────┬───────────────────────────────────────────┘
                       │  HTTP / Server Actions
┌──────────────────────▼───────────────────────────────────────────┐
│                  Next.js API Routes  (/app/api/*)                 │
│                                                                  │
│  /api/properties          /api/subscriptions                     │
│  /api/bookings            /api/callbacks                         │
│  /api/search              /api/stats                             │
│  /api/facilities          /api/logs                              │
│  /api/health              /api/sync                              │
└──────┬──────────────────────────────────────┬────────────────────┘
       │  mssql (tedious)                     │  fetch / axios
       │                                      │
┌──────▼────────────┐          ┌──────────────▼──────────────────┐
│  MSSQL 2022       │          │  HyperGuest APIs                 │
│  HyperGuestB2B    │          │                                  │
│                   │          │  Static   hg-static.hyperguest.com│
│  hg_properties    │          │  Search   search-api.hyperguest.io│
│  hg_facilities    │          │  PDM      pdm.hyperguest.io       │
│  hg_subscriptions │          │  Book     book-api.hyperguest.com │
│  hg_bookings      │          └──────────────────────────────────┘
│  hg_booking_rooms │
│  hg_callbacks     │          ┌──────────────────────────────────┐
│  hg_api_logs      │◄─────────│  Incoming ARI Callbacks (HTTPS)  │
│                   │          │  HyperGuest → /api/callback       │
│  Views:           │          └──────────────────────────────────┘
│  vw_BookingSummary│
│                   │
│  Procs:           │
│  usp_GetDashboard │
│  usp_GetBookingSt.│
└───────────────────┘
```

---

## Quick Start (Local Development)

### Prerequisites

- Node.js 20+
- npm 10+
- SQL Server 2019+ (local, Docker, or Azure SQL)

```bash
# 1. Clone the repository
git clone https://github.com/your-org/hyperguest-b2b-manager.git
cd hyperguest-b2b-manager

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local and set DB_SERVER, DB_PASSWORD, and other values

# 4. Initialise the database (run against your SQL Server instance)
sqlcmd -S localhost -U sa -P 'YourPassword' -i db/schema.sql
sqlcmd -S localhost -U sa -P 'YourPassword' -i db/seed.sql

# 5. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Docker Setup (Recommended)

Docker Compose starts both the Next.js app and a SQL Server 2022 Express instance.

```bash
# 1. Build and start all services
docker compose up --build -d

# 2. Wait ~30 seconds for SQL Server to initialise, then apply the schema
docker exec -it hg_b2b_db \
  /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'YourStrongPassword123!' \
  -No -i /db/schema.sql

# 3. (Optional) Apply seed data
docker exec -it hg_b2b_db \
  /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'YourStrongPassword123!' \
  -No -i /db/seed.sql

# 4. Open the app
open http://localhost:3000
```

### Docker Compose Services

| Service | Image | Port | Purpose |
|---|---|---|---|
| `app` | Local Dockerfile | 3000 | Next.js application |
| `db` | `mcr.microsoft.com/mssql/server:2022-latest` | 1433 | SQL Server 2022 Express |

---

## Database Setup

Run the SQL scripts in order:

```bash
# 1. Schema (tables, indexes, view, stored procedures)
sqlcmd -S <server> -U <user> -P <password> -d master -i db/schema.sql

# 2. Seed data (optional, for development/testing)
sqlcmd -S <server> -U <user> -P <password> -d HyperGuestB2B -i db/seed.sql
```

### Tables

| Table | Purpose |
|---|---|
| `hg_properties` | Cached property metadata from Static API |
| `hg_facilities` | Global facility/amenity catalogue |
| `hg_subscriptions` | ARI subscription registry |
| `hg_bookings` | Booking push log (commit & cancel) |
| `hg_booking_rooms` | Room lines per booking |
| `hg_callbacks` | Incoming ARI update payloads |
| `hg_api_logs` | Outbound API request/response audit log |

### Views & Stored Procedures

| Object | Type | Purpose |
|---|---|---|
| `vw_BookingSummary` | View | Enriched booking rows with nights, tax, commission |
| `usp_GetBookingStats` | Proc | Booking totals / by-date / by-status (3 result sets) |
| `usp_GetDashboardStats` | Proc | Dashboard KPIs + recent bookings + top hotels (4 result sets) |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_HG_STATIC_TOKEN` | Yes | Bearer token for Static API |
| `NEXT_PUBLIC_HG_OPERATIONS_TOKEN` | Yes | Bearer token for PDM / Subscriptions API |
| `NEXT_PUBLIC_HG_CALLBACK_TOKEN` | Yes | Token validated on incoming callback requests |
| `NEXT_PUBLIC_HG_STATIC_URL` | Yes | `https://hg-static.hyperguest.com` |
| `NEXT_PUBLIC_HG_SEARCH_URL` | Yes | `https://search-api.hyperguest.io` |
| `NEXT_PUBLIC_HG_PDM_URL` | Yes | `https://pdm.hyperguest.io` |
| `NEXT_PUBLIC_HG_BOOK_URL` | Yes | `https://book-api.hyperguest.com` |
| `NEXT_PUBLIC_EGLOBE_CALLBACK_URL` | Yes | Public HTTPS URL HyperGuest posts ARI updates to |
| `NEXT_PUBLIC_SUBSCRIPTION_EMAIL` | Yes | Email registered as subscription owner |
| `DB_SERVER` | Yes | SQL Server hostname or IP (`db` in Docker) |
| `DB_PORT` | Yes | SQL Server port (default `1433`) |
| `DB_NAME` | Yes | Database name (`HyperGuestB2B`) |
| `DB_USER` | Yes | SQL Server login |
| `DB_PASSWORD` | Yes | SQL Server password |
| `DB_ENCRYPT` | No | Encrypt connection (`false` for local Docker) |
| `DB_TRUST_SERVER_CERTIFICATE` | No | Trust self-signed cert (`true` for Docker) |
| `NEXTAUTH_SECRET` | Yes | NextAuth session signing secret |
| `NEXTAUTH_URL` | Yes | Full public URL of the app |
| `NODE_ENV` | Yes | `development` or `production` |
| `LOG_LEVEL` | No | `info` (default) |
| `ENABLE_API_LOGGING` | No | Write API calls to `hg_api_logs` (`true`) |
| `SYNC_BATCH_SIZE` | No | Properties per Static API batch (default `50`) |

---

## HyperGuest API Architecture

HyperGuest exposes **5 distinct base URLs** protected by **3 separate Bearer tokens**:

```
Token A — STATIC_TOKEN  (9d49c17f...)
├── hg-static.hyperguest.com          Static API
│   ├── GET /properties                All accessible properties
│   ├── GET /properties/{id}           Single property detail
│   ├── GET /properties/{id}/rooms     Room types
│   ├── GET /properties/{id}/rateplans Rate plan catalogue
│   └── GET /facilities                Global facilities list

Token B — OPERATIONS_TOKEN  (fc35030b...)
├── pdm.hyperguest.io                  PDM / Subscription API
│   ├── POST   /subscriptions          Create ARI subscription
│   ├── GET    /subscriptions          List subscriptions
│   ├── GET    /subscriptions/{id}     Get subscription
│   ├── PATCH  /subscriptions/{id}     Update subscription
│   └── DELETE /subscriptions/{id}     Delete subscription
│
└── search-api.hyperguest.io           Search API
    └── POST /search                   Live ARI availability search

Token C — CALLBACK_TOKEN  (f99a7t2v...)
└── Inbound only — HyperGuest includes this in
    X-HG-Callback-Token header on every ARI push
    to your configured callback URL.

No token (OTA XML over HTTPS)
└── book-api.hyperguest.com            Booking API
    └── POST /ota/hotel-res-notif      OTA_HotelResNotifRQ (commit/cancel)
```

### API Summary Table

| # | API | Base URL | Token | Method | Path |
|---|---|---|---|---|---|
| 1 | List Properties | Static | STATIC | GET | `/properties` |
| 2 | Get Property | Static | STATIC | GET | `/properties/{id}` |
| 3 | Room Types | Static | STATIC | GET | `/properties/{id}/rooms` |
| 4 | Rate Plans | Static | STATIC | GET | `/properties/{id}/rateplans` |
| 5 | Facilities | Static | STATIC | GET | `/facilities` |
| 6 | Create Subscription | PDM | OPERATIONS | POST | `/subscriptions` |
| 7 | List Subscriptions | PDM | OPERATIONS | GET | `/subscriptions` |
| 8 | Get Subscription | PDM | OPERATIONS | GET | `/subscriptions/{id}` |
| 9 | Update Subscription | PDM | OPERATIONS | PATCH | `/subscriptions/{id}` |
| 10 | Delete Subscription | PDM | OPERATIONS | DELETE | `/subscriptions/{id}` |
| 11 | ARI Search | Search | OPERATIONS | POST | `/search` |
| 12 | Push Booking | Book | (OTA XML) | POST | `/ota/hotel-res-notif` |
| 13 | Cancel Booking | Book | (OTA XML) | POST | `/ota/hotel-res-notif` |
| 14 | ARI Callback | Inbound | CALLBACK | POST | *(your endpoint)* |

---

## Folder Structure

```
hyperguest-b2b-manager/
├── app/                        # Next.js 14 App Router
│   ├── (dashboard)/
│   │   ├── page.tsx            # Dashboard home
│   │   ├── properties/
│   │   ├── subscriptions/
│   │   ├── bookings/
│   │   ├── callbacks/
│   │   ├── search/
│   │   └── logs/
│   ├── api/
│   │   ├── properties/
│   │   ├── subscriptions/
│   │   ├── bookings/
│   │   ├── callbacks/
│   │   ├── search/
│   │   ├── stats/
│   │   ├── sync/
│   │   ├── logs/
│   │   └── health/
│   ├── layout.tsx
│   └── globals.css
├── components/                 # Shared React components
│   ├── ui/                     # shadcn/ui primitives
│   ├── charts/
│   ├── tables/
│   └── forms/
├── lib/
│   ├── db.ts                   # MSSQL connection pool (mssql / tedious)
│   ├── hyperguest/
│   │   ├── static.ts           # Static API client
│   │   ├── pdm.ts              # PDM / Subscriptions API client
│   │   ├── search.ts           # Search API client
│   │   └── booking.ts          # Booking API client (OTA XML builder)
│   └── utils.ts
├── types/
│   ├── hyperguest.ts           # API response types
│   └── db.ts                   # Database row types
├── db/
│   ├── schema.sql              # Full MSSQL schema
│   └── seed.sql                # Development seed data
├── public/
├── .env.example                # Environment variable template
├── .env.local                  # Local secrets (gitignored)
├── Dockerfile                  # Multi-stage production Docker image
├── docker-compose.yml          # App + SQL Server compose stack
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Contributing

1. Fork the repository and create a feature branch.
2. Run `npm run lint` and `npm run type-check` before committing.
3. Write or update tests for any new API routes.
4. Open a pull request with a clear description of the change.

---

## License

MIT License — Copyright (c) 2025 Eglobe Solutions
# hyperguest-b2b-manager
# hyperguest-b2b-manager
