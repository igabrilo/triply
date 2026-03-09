"""add new features models

Revision ID: ee4b65787aa5
Revises: c1a3f5e80d01
Create Date: 2026-03-08 10:00:00.000000

This migration file was re-created to restore Alembic history continuity.
The original revision existed in runtime state but was missing from source.
Current application logic stores new feature payloads in trips.constraints,
so no schema operation is required here.
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "ee4b65787aa5"
down_revision = "c1a3f5e80d01"
branch_labels = None
depends_on = None


def upgrade():
    # No-op: placeholder revision to satisfy existing alembic_version.
    pass


def downgrade():
    # No-op.
    pass

