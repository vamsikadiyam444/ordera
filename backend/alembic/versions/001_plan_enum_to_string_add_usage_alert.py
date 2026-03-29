"""plan enum to string, add usage_alert_sent_at

Revision ID: 001
Revises:
Create Date: 2026-03-28
"""
from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    dialect = conn.dialect.name

    if dialect == "postgresql":
        # Convert plan column from enum type to varchar
        op.execute("ALTER TABLE owners ALTER COLUMN plan TYPE VARCHAR(50) USING plan::VARCHAR")
        # Rename old enum values: basic → essential
        op.execute("UPDATE owners SET plan = 'essential' WHERE plan = 'basic'")
        # Drop the old enum type if it exists
        op.execute("DROP TYPE IF EXISTS plan_enum")
    else:
        # SQLite: recreate approach not needed — SQLite stores enum as TEXT already
        op.execute("UPDATE owners SET plan = 'essential' WHERE plan = 'basic'")

    # Add usage_alert_sent_at column
    op.add_column(
        "owners",
        sa.Column("usage_alert_sent_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade():
    op.drop_column("owners", "usage_alert_sent_at")

    conn = op.get_bind()
    if conn.dialect.name == "postgresql":
        op.execute("UPDATE owners SET plan = 'basic' WHERE plan = 'essential'")
        op.execute("""
            CREATE TYPE plan_enum_old AS ENUM ('basic', 'pro', 'enterprise');
            ALTER TABLE owners ALTER COLUMN plan TYPE plan_enum_old USING plan::plan_enum_old;
        """)
