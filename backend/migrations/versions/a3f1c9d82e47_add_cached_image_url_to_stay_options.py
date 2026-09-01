"""add cached_image_url to stay_options

Revision ID: a3f1c9d82e47
Revises: ee4b65787aa5
Create Date: 2026-03-10 12:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


revision = "a3f1c9d82e47"
down_revision = "ee4b65787aa5"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('stay_options', sa.Column('cached_image_url', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('stay_options', 'cached_image_url')
