from sqlalchemy import create_engine, event, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

# Support both SQLite (dev) and PostgreSQL (prod)
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False, "timeout": 30}

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)

# Enable WAL mode for SQLite to prevent "database is locked" errors
if settings.DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=10000")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    Base.metadata.create_all(bind=engine) # Create tables based on models defined in the app


def run_migrations():
    """Add columns that are missing from existing production tables.
    create_all() only creates missing tables, not missing columns — this fills the gap.
    Safe to run on every startup: each ALTER TABLE uses IF NOT EXISTS / is idempotent.
    Only runs on PostgreSQL; SQLite always gets a fresh schema via create_all().
    """
    if not settings.DATABASE_URL.startswith("postgresql"):
        return  # SQLite gets full schema from create_all() above

    column_migrations = [
        # owners: usage_alert_sent_at added after initial deploy
        "ALTER TABLE owners ADD COLUMN IF NOT EXISTS usage_alert_sent_at TIMESTAMPTZ",
    ]

    with engine.connect() as conn:
        for sql in column_migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
                print(f"[Migration] Applied: {sql}")
            except Exception as e:
                conn.rollback()
                print(f"[Migration] Skipped ({e}): {sql}")
