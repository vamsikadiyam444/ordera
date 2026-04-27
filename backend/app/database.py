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
    """Add columns that are missing from existing tables.
    create_all() only creates missing tables, not missing columns — this fills the gap.
    Safe to run on every startup: idempotent.
    """
    is_sqlite = settings.DATABASE_URL.startswith("sqlite")

    if is_sqlite:
        # SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN,
        # so check PRAGMA table_info first.
        sqlite_migrations = [
            ("owners", "usage_alert_sent_at", "ALTER TABLE owners ADD COLUMN usage_alert_sent_at DATETIME"),
            ("owners", "phone", "ALTER TABLE owners ADD COLUMN phone VARCHAR"),
            ("conversations", "language_detected", "ALTER TABLE conversations ADD COLUMN language_detected VARCHAR"),
        ]
        with engine.connect() as conn:
            for table, column, sql in sqlite_migrations:
                result = conn.execute(text(f"PRAGMA table_info({table})"))
                existing = [row[1] for row in result.fetchall()]
                if column not in existing:
                    try:
                        conn.execute(text(sql))
                        conn.commit()
                        print(f"[Migration] SQLite: added {column} to {table}")
                    except Exception as e:
                        conn.rollback()
                        print(f"[Migration] SQLite: skipped {column} ({e})")
        return

    # PostgreSQL
    column_migrations = [
        # owners: usage_alert_sent_at added after initial deploy
        "ALTER TABLE owners ADD COLUMN IF NOT EXISTS usage_alert_sent_at TIMESTAMPTZ",
        # owners: phone added for SMS OTP verification at signup
        "ALTER TABLE owners ADD COLUMN IF NOT EXISTS phone VARCHAR",
        # conversations: language_detected added for multi-language support
        "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS language_detected VARCHAR",
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
