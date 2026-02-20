"""Add parsed_metadata table

Revision ID: 20260213_0002
Revises: 20260213_0001
Create Date: 2026-02-13 11:30:00

"""

from alembic import op
import sqlalchemy as sa

revision = "20260213_0002"
down_revision = "20260213_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "parsed_metadata",
        sa.Column("filepath", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=True),
        sa.Column("group_name", sa.Text(), nullable=True),
        sa.Column("event", sa.Text(), nullable=True),
        sa.Column("date_tag", sa.Text(), nullable=True),
        sa.Column("media_type", sa.Text(), nullable=True),
        sa.Column(
            "parsed_at",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("(strftime('%s','now'))"),
        ),
        sa.PrimaryKeyConstraint("filepath"),
    )
    op.create_index("idx_parsed_metadata_event", "parsed_metadata", ["event"])
    op.create_index("idx_parsed_metadata_group_name", "parsed_metadata", ["group_name"])
    op.create_index("idx_parsed_metadata_media_type", "parsed_metadata", ["media_type"])


def downgrade() -> None:
    op.drop_index("idx_parsed_metadata_media_type", table_name="parsed_metadata")
    op.drop_index("idx_parsed_metadata_group_name", table_name="parsed_metadata")
    op.drop_index("idx_parsed_metadata_event", table_name="parsed_metadata")
    op.drop_table("parsed_metadata")
