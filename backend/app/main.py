import asyncio
from datetime import datetime, timedelta

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.database import create_tables, run_migrations, SessionLocal

# Import all models so SQLAlchemy registers them before create_all
import app.models  # noqa: F401

from app.routers import auth, menu, orders, knowledge, dashboard, voice, payments, restaurant, subscription


AUTO_CONFIRM_SECONDS = 60  # Auto-confirm new orders after 1 minute


async def auto_confirm_orders():
    """Background task: auto-confirm 'new' orders older than 1 minute."""
    while True:
        await asyncio.sleep(15)  # Check every 15 seconds
        db = None
        try:
            db = SessionLocal()
            from app.models.order import Order
            cutoff = datetime.utcnow() - timedelta(seconds=AUTO_CONFIRM_SECONDS)
            stale_orders = (
                db.query(Order)
                .filter(Order.status == "new", Order.created_at <= cutoff)
                .all()
            )
            for order in stale_orders:
                order.status = "confirmed"
                print(f"[Auto-Confirm] Order {order.id[:8]} auto-confirmed after {AUTO_CONFIRM_SECONDS}s")
            if stale_orders:
                db.commit()
        except Exception as e:
            if db:
                db.rollback()
            print(f"[Auto-Confirm] Error: {e}")
        finally:
            if db:
                db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create DB tables + apply column migrations
    create_tables()
    run_migrations()
    print("Database tables ready")
    # Start background auto-confirm task (only for PostgreSQL; SQLite can't handle concurrent writes)
    is_sqlite = settings.DATABASE_URL.startswith("sqlite")
    task = None
    if not is_sqlite:
        task = asyncio.create_task(auto_confirm_orders())
        print(f"Auto-confirm background task started ({AUTO_CONFIRM_SECONDS}s timeout)")
    else:
        print("Auto-confirm: disabled for SQLite (will use frontend polling instead)")
    yield
    if task:
        task.cancel()


app = FastAPI(
    title="AI Restaurant Phone Agent",
    description="SaaS platform that automatically answers restaurant calls using conversational AI",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=(
        [settings.FRONTEND_URL]
        if settings.APP_ENV == "production"
        else [settings.FRONTEND_URL, "http://localhost:5173", "http://localhost:3000"]
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(menu.router)
app.include_router(orders.router)
app.include_router(knowledge.router)
app.include_router(dashboard.router)
app.include_router(voice.router)
app.include_router(payments.router)
app.include_router(restaurant.router)
app.include_router(subscription.router)


@app.get("/")
def root():
    return {
        "service": "AI Restaurant Phone Agent",
        "version": "2.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/api/health/ai")
def health_ai():
    """Check which AI provider is active and do a live ping test."""
    from app.services.ai_engine import _groq_client, _anthropic_client, GROQ_FAST_MODEL, HAIKU_MODEL
    import time

    if _groq_client:
        provider = "groq"
        model = GROQ_FAST_MODEL
    elif _anthropic_client:
        provider = "anthropic"
        model = HAIKU_MODEL
    else:
        return {"provider": "none", "status": "error", "message": "No API key configured"}

    try:
        start = time.time()
        from app.services.ai_engine import _chat
        reply = _chat(fast=True, system="", messages=[{"role": "user", "content": "Reply with exactly: OK"}], max_tokens=5)
        latency_ms = round((time.time() - start) * 1000)
        return {
            "provider": provider,
            "model": model,
            "status": "ok",
            "reply": reply.strip(),
            "latency_ms": latency_ms,
        }
    except Exception as e:
        return {"provider": provider, "model": model, "status": "error", "message": str(e)}
