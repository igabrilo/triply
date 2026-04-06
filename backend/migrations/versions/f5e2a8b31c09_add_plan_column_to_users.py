"""Add plan column to users

Revision ID: f5e2a8b31c09
Revises: ee4b65787aa5
Create Date: 2026-04-06
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'f5e2a8b31c09'
down_revision = 'd4a1c5f2e9b0'
branch_labels = None
depends_on = None


def upgrade():
    # Safe: checks if column already exists before adding
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('users')]
    if 'plan' not in columns:
        op.add_column('users', sa.Column('plan', sa.String(20), nullable=False, server_default='basic'))


def downgrade():
    op.drop_column('users', 'plan')
