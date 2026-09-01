import uuid
from datetime import datetime, timezone

from sqlalchemy import Uuid

from app import db


class Invoice(db.Model):
    """Payment invoice linked to a subscription."""
    __tablename__ = 'invoices'

    id = db.Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = db.Column(Uuid, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    subscription_id = db.Column(Uuid, db.ForeignKey('subscriptions.id', ondelete='SET NULL'), nullable=True)

    provider_invoice_id = db.Column(db.Text, nullable=True)
    amount_paid = db.Column(db.Numeric(10, 2), nullable=True)
    currency = db.Column(db.Text, nullable=True)
    hosted_invoice_url = db.Column(db.Text, nullable=True)

    status = db.Column(db.Text, default='draft')                # draft | paid | void | …

    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # --- Relationships ---
    subscription = db.relationship('Subscription', back_populates='invoices')

    def to_dict(self):
        return {
            'id': str(self.id),
            'userId': str(self.user_id),
            'subscriptionId': str(self.subscription_id) if self.subscription_id else None,
            'providerInvoiceId': self.provider_invoice_id,
            'amountPaid': float(self.amount_paid) if self.amount_paid else None,
            'currency': self.currency,
            'hostedInvoiceUrl': self.hosted_invoice_url,
            'status': self.status,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f'<Invoice {self.id} [{self.status}]>'
