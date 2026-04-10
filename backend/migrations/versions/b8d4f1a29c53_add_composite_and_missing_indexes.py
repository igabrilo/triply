"""Add composite and missing indexes for performance

Revision ID: b8d4f1a29c53
Revises: a7c3d9e14f62
Create Date: 2026-04-10
"""
from alembic import op
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = 'b8d4f1a29c53'
down_revision = 'a7c3d9e14f62'
branch_labels = None
depends_on = None


def _index_exists(table_name: str, index_name: str) -> bool:
    bind = op.get_bind()
    inspector = inspect(bind)
    index_names = {idx['name'] for idx in inspector.get_indexes(table_name)}
    return index_name in index_names


def upgrade():
    if not _index_exists('trips', 'ix_trips_user_id_created_at'):
        op.create_index('ix_trips_user_id_created_at', 'trips', ['user_id', 'created_at'])
    if not _index_exists('plan_items', 'ix_plan_items_status'):
        op.create_index('ix_plan_items_status', 'plan_items', ['status'])
    if not _index_exists('plan_items', 'ix_plan_items_sort_order'):
        op.create_index('ix_plan_items_sort_order', 'plan_items', ['sort_order'])
    if not _index_exists('trip_days', 'ix_trip_days_day_index'):
        op.create_index('ix_trip_days_day_index', 'trip_days', ['day_index'])


def downgrade():
    if _index_exists('trip_days', 'ix_trip_days_day_index'):
        op.drop_index('ix_trip_days_day_index', 'trip_days')
    if _index_exists('plan_items', 'ix_plan_items_sort_order'):
        op.drop_index('ix_plan_items_sort_order', 'plan_items')
    if _index_exists('plan_items', 'ix_plan_items_status'):
        op.drop_index('ix_plan_items_status', 'plan_items')
    if _index_exists('trips', 'ix_trips_user_id_created_at'):
        op.drop_index('ix_trips_user_id_created_at', 'trips')
