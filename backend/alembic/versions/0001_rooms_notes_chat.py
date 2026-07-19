"""Create collaboration tables."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table("review_rooms", sa.Column("id", sa.String(36), primary_key=True), sa.Column("game_id", sa.Integer(), nullable=True), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False))
    op.create_table("shared_notes", sa.Column("id", sa.String(36), primary_key=True), sa.Column("room_id", sa.String(36), sa.ForeignKey("review_rooms.id", ondelete="CASCADE"), nullable=False), sa.Column("author", sa.String(64), nullable=False), sa.Column("board", sa.String(1), nullable=True), sa.Column("global_ply", sa.Integer(), nullable=True), sa.Column("variation_id", sa.String(36), nullable=True), sa.Column("content", sa.Text(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_shared_notes_room_id", "shared_notes", ["room_id"])
    op.create_table("chat_messages", sa.Column("id", sa.String(36), primary_key=True), sa.Column("room_id", sa.String(36), sa.ForeignKey("review_rooms.id", ondelete="CASCADE"), nullable=False), sa.Column("author", sa.String(64), nullable=False), sa.Column("content", sa.Text(), nullable=False), sa.Column("board", sa.String(1), nullable=True), sa.Column("global_ply", sa.Integer(), nullable=True), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_chat_messages_room_id", "chat_messages", ["room_id"])


def downgrade() -> None:
    op.drop_table("chat_messages")
    op.drop_table("shared_notes")
    op.drop_table("review_rooms")
