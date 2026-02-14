"""Add rec_score to files table

Revision ID: 20260215_0001
Revises: 20260213_0003
Create Date: 2026-02-15
"""

from alembic import op
import sqlalchemy as sa

revision = "20260215_0001"
down_revision = "20260213_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("files") as batch_op:
        batch_op.add_column(sa.Column("rec_score", sa.Float(), nullable=False, server_default="0.0"))


def downgrade() -> None:
    with op.batch_alter_table("files") as batch_op:
        batch_op.drop_column("rec_score")
