"""add cached_image_url to plan_items

Revision ID: d4a1c5f2e9b0
Revises: a3f1c9d82e47
Create Date: 2026-04-01 19:10:00.000000

"""

from alembic import op
import sqlalchemy as sa


revision = "d4a1c5f2e9b0"
down_revision = "a3f1c9d82e47"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('plan_items', sa.Column('cached_image_url', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('plan_items', 'cached_image_url')
