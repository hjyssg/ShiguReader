"""add activity log status/task/context

Revision ID: 20260217_0002
Revises: 20260217_0001
Create Date: 2026-02-17
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision = "20260217_0002"
down_revision = "20260217_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("activity_logs", sa.Column("status", sa.String(), nullable=False, server_default="completed"))
    op.add_column("activity_logs", sa.Column("task_key", sa.String(), nullable=True))
    op.add_column("activity_logs", sa.Column("context_json", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("activity_logs", "context_json")
    op.drop_column("activity_logs", "task_key")
    op.drop_column("activity_logs", "status")
