"""Remove legacy auth columns (password_hash, oauth_provider, oauth_id).

Supabase Auth now owns authentication; these columns are no longer needed
in the public.users table.

Revision ID: c1a3f5e80d01
Revises: 7bccb2b40fb6
Create Date: 2026-02-19 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c1a3f5e80d01'
down_revision = '7bccb2b40fb6'
branch_labels = None
depends_on = None


def upgrade():
    # Drop legacy auth columns
    op.drop_index('ix_users_oauth_id', table_name='users')
    op.drop_column('users', 'password_hash')
    op.drop_column('users', 'oauth_provider')
    op.drop_column('users', 'oauth_id')


def downgrade():
    # Re-add legacy auth columns
    op.add_column('users', sa.Column('oauth_id', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('oauth_provider', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('password_hash', sa.Text(), nullable=True))
    op.create_index('ix_users_oauth_id', 'users', ['oauth_id'])
