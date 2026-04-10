"""Add performance indexes on frequently queried columns

Revision ID: a7c3d9e14f62
Revises: f5e2a8b31c09
Create Date: 2026-04-09
"""
from alembic import op

# revision identifiers, used by Alembic.
revision = 'a7c3d9e14f62'
down_revision = 'f5e2a8b31c09'
branch_labels = None
depends_on = None


def upgrade():
    op.create_index('ix_trips_created_at', 'trips', ['created_at'])
    op.create_index('ix_trips_status', 'trips', ['status'])
    op.create_index('ix_usage_events_event_name', 'usage_events', ['event_name'])
    op.create_index('ix_usage_events_created_at', 'usage_events', ['created_at'])
    op.create_index('ix_chat_messages_created_at', 'chat_messages', ['created_at'])
    op.create_index('ix_chat_threads_created_at', 'chat_threads', ['created_at'])


def downgrade():
    op.drop_index('ix_chat_threads_created_at', 'chat_threads')
    op.drop_index('ix_chat_messages_created_at', 'chat_messages')
    op.drop_index('ix_usage_events_created_at', 'usage_events')
    op.drop_index('ix_usage_events_event_name', 'usage_events')
    op.drop_index('ix_trips_status', 'trips')
    op.drop_index('ix_trips_created_at', 'trips')
