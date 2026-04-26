<<<<<<< HEAD
# RingZ.ai
=======
# AI Restaurant Phone Agent

A SaaS platform that automatically answers restaurant phone calls using conversational AI. Takes food orders, answers questions using RAG, sends SMS confirmations, and streams orders to a live kitchen dashboard.

**Tech Stack:** FastAPI + Telnyx + Deepgram + Claude AI (Anthropic) + PostgreSQL + React + Tailwind CSS

---

## Architecture

```
Customer Phone Call
  → Telnyx (Voice + STT/TTS + SMS)
  → FastAPI Backend
  → Claude AI (with RAG context from uploaded documents)
  → PostgreSQL Database
  → React Kitchen Dashboard
```

---

## Quick Start

### 1. Clone and configure

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys (see API Keys section below)
```

### 2. Run with Docker (recommended)

```bash
docker-compose up --build
```

- Backend API: http://localhost:8000
- Frontend: http://localhost:3000
- API Docs: http://localhost:8000/docs

### 3. Run locally (development)

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

---

## API Keys Required

| Service | Purpose | Get it |
|---------|---------|--------|
| `ANTHROPIC_API_KEY` | Claude AI (conversation + RAG) | console.anthropic.com |
| `TELNYX_API_KEY` | Voice calls + SMS | telnyx.com |
| `DEEPGRAM_API_KEY` | Speech-to-text | deepgram.com ($200 free credit) |
| `STRIPE_SECRET_KEY` | Payment links | stripe.com |

---

## First-Time Setup

1. **Sign up** at http://localhost:5173/signup
2. **Seed demo menu:** Go to Menu Manager → click "Seed Demo Menu"
3. **Upload a document:** Go to Knowledge Base → upload your menu PDF
4. **Configure settings:** Go to Settings → add restaurant address, hours

---

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entry point
│   │   ├── config.py            # Settings from .env
│   │   ├── database.py          # SQLAlchemy setup
│   │   ├── models/              # SQLAlchemy ORM models
│   │   │   ├── owner.py         # Restaurant owners
│   │   │   ├── restaurant.py    # Restaurant locations
│   │   │   ├── menu_item.py     # Menu items
│   │   │   ├── order.py         # Orders + order items
│   │   │   ├── conversation.py  # Call conversation history
│   │   │   ├── document.py      # Uploaded docs + RAG chunks
│   │   │   └── call_log.py      # Call analytics
│   │   ├── schemas/             # Pydantic request/response models
│   │   ├── routers/             # FastAPI route handlers
│   │   │   ├── auth.py          # POST /api/auth/*
│   │   │   ├── voice.py         # POST /voice/* (Telnyx webhooks)
│   │   │   ├── orders.py        # GET/PATCH /api/orders/*
│   │   │   ├── menu.py          # CRUD /api/menu/*
│   │   │   ├── knowledge.py     # POST /api/knowledge/upload
│   │   │   ├── dashboard.py     # GET /api/dashboard/*
│   │   │   ├── restaurant.py    # GET/PUT /api/restaurant/
│   │   │   └── payments.py      # POST /payments/stripe-webhook
│   │   ├── services/
│   │   │   ├── ai_engine.py     # Claude integration + model routing
│   │   │   ├── rag_service.py   # Document chunking + keyword search
│   │   │   ├── sms_service.py   # Telnyx SMS
│   │   │   ├── stripe_service.py # Stripe payment links
│   │   │   ├── document_service.py # PDF/DOCX/TXT extraction
│   │   │   └── auth_service.py  # JWT + bcrypt
│   │   └── middleware/
│   │       └── auth.py          # JWT bearer token middleware
│   ├── alembic/                 # Database migrations
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Router + auth guards
│   │   ├── pages/
│   │   │   ├── Login.jsx        # Auth
│   │   │   ├── Signup.jsx       # New account
│   │   │   ├── KitchenDashboard.jsx  # Live orders (5s polling)
│   │   │   ├── MenuManager.jsx  # CRUD menu items
│   │   │   ├── DocumentUpload.jsx    # RAG document management
│   │   │   ├── Settings.jsx     # Restaurant settings
│   │   │   ├── OrderHistory.jsx # Searchable order history
│   │   │   └── Analytics.jsx    # Call + revenue charts
│   │   ├── components/
│   │   │   ├── Layout.jsx       # Sidebar navigation
│   │   │   ├── OrderCard.jsx    # Order card with status buttons
│   │   │   └── StatCard.jsx     # Metric display card
│   │   ├── context/AuthContext.jsx  # JWT auth state
│   │   └── services/api.js      # Axios API client
│   ├── package.json
│   └── Dockerfile
└── docker-compose.yml
```

---

## Voice Call Flow

```
1. Customer calls Telnyx number
2. POST /voice/incoming → create Conversation, generate greeting via Claude
3. Telnyx speaks greeting, listens for speech
4. POST /voice/respond → Deepgram transcribed text arrives
5. RAG search: find relevant document chunks for the customer's question
6. Claude AI: generate response (or ORDER_COMPLETE JSON when order is done)
7. Telnyx speaks AI response
8. Repeat 3-7 until order is confirmed
9. Order saved to DB → SMS sent → Kitchen dashboard updates
```

---

## RAG Knowledge Base

Upload PDFs, DOCX, or TXT files to the Knowledge Base. The system:
1. Extracts text from the file
2. Splits into 500-character overlapping chunks
3. Stores chunks in `knowledge_chunks` table
4. Searches chunks for relevant context using keyword matching
5. Injects top matches into Claude's system prompt

**Document types:** `menu`, `allergy`, `policy`, `faq`, `general`

**Phase 2:** Upgrade to semantic vector search via pgvector (already planned in codebase).

---

## API Documentation

Interactive Swagger UI at: http://localhost:8000/docs

Key endpoints:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/signup` | Create owner account |
| POST | `/api/auth/login` | Get JWT token |
| GET | `/api/dashboard/stats` | Live order stats |
| GET | `/api/orders/` | List orders |
| POST | `/api/menu/` | Add menu item |
| POST | `/api/knowledge/upload` | Upload document |
| GET | `/api/knowledge/search` | Test RAG search |
| POST | `/voice/incoming` | Telnyx webhook (new call) |
| POST | `/voice/respond` | Telnyx webhook (speech received) |

---

## Telnyx Configuration

1. Create a Telnyx account and buy a phone number
2. Create a Call Control Application
3. Set webhook URL: `https://your-domain.com/voice/incoming`
4. Set call status webhook: `https://your-domain.com/voice/status`
5. Copy your API key and public key to `.env`
6. In the admin portal, assign the Telnyx number to a restaurant

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` | JWT signing secret (use a long random string) |
| `ANTHROPIC_API_KEY` | Claude AI API key |
| `TELNYX_API_KEY` | Telnyx API key |
| `TELNYX_PUBLIC_KEY` | For webhook signature verification |
| `TELNYX_CONNECTION_ID` | Call control connection ID |
| `TELNYX_MESSAGING_PROFILE_ID` | For sending SMS |
| `DEEPGRAM_API_KEY` | Speech-to-text |
| `STRIPE_SECRET_KEY` | Payment processing |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification |
| `BASE_URL` | Your public URL (for Stripe redirect URLs) |
| `FRONTEND_URL` | Frontend URL (for CORS) |

---

## Development Notes

- **SQLite** is used by default in development (no PostgreSQL needed)
- Switch to PostgreSQL by updating `DATABASE_URL` in `.env`
- The `/api/menu/seed` endpoint populates a demo menu
- All API routes are documented at `/docs`
- AI model routing: Haiku for simple queries, Sonnet for allergy/policy questions
- Prompt caching is enabled to reduce Claude API costs by ~90%

---

## Deployment (Railway.app)

```bash
# Deploy backend
railway init
railway link
railway up

# Set environment variables in Railway dashboard
# Add PostgreSQL service → copy DATABASE_URL
```

---

## License

Proprietary — AI Restaurant Phone Agent v2.0
>>>>>>> 8ba5015 (Initial clean commit)
