import uuid
from datetime import datetime, timezone

from sqlalchemy import Uuid

from app import db


class Subscription(db.Model):
    """User subscription (Stripe / payment provider)."""
    __tablename__ = 'subscriptions'

    id = db.Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = db.Column(Uuid, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)

    provider = db.Column(db.Text, nullable=True)                # stripe | …
    provider_customer_id = db.Column(db.Text, nullable=True)
    provider_subscription_id = db.Column(db.Text, nullable=True)

    plan = db.Column(db.Text, default='free')                   # free | premium
    status = db.Column(db.Text, default='active')               # active | canceled | past_due | …

    current_period_end = db.Column(db.DateTime(timezone=True), nullable=True)

    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # --- Relationships ---
    user = db.relationship('User', back_populates='subscriptions')
    invoices = db.relationship('Invoice', back_populates='subscription', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': str(self.id),
            'userId': str(self.user_id),
            'provider': self.provider,
            'plan': self.plan,
            'status': self.status,
            'currentPeriodEnd': self.current_period_end.isoformat() if self.current_period_end else None,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f'<Subscription {self.id} [{self.plan}]>'
