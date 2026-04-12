"""Stripe subscription routes – checkout, webhooks, customer portal."""

import logging

import stripe
from flask import current_app, g, jsonify, request

from app import db
from app.models.subscription import Subscription
from app.routes import api_bp
from app.utils.auth import require_auth

logger = logging.getLogger(__name__)


def _stripe_configured() -> bool:
    return bool(current_app.config.get('STRIPE_SECRET_KEY'))


def _stripe_checkout_config_error() -> str | None:
    """Return a configuration error message when checkout prerequisites are missing."""
    if not current_app.config.get('STRIPE_SECRET_KEY'):
        return 'Payments not configured'

    price_id = (current_app.config.get('STRIPE_PRICE_ID_PREMIUM') or '').strip()
    if not price_id:
        return 'Payments misconfigured: missing STRIPE_PRICE_ID_PREMIUM'

    return None


# ------------------------------------------------------------------
# Create Stripe Checkout Session
# ------------------------------------------------------------------
@api_bp.route('/subscriptions/checkout', methods=['POST'])
@require_auth
def create_checkout_session():
    """Create a Stripe Checkout session for the Premium plan."""
    checkout_config_error = _stripe_checkout_config_error()
    if checkout_config_error:
        logger.error('Stripe checkout unavailable: %s', checkout_config_error)
        return jsonify({'success': False, 'message': checkout_config_error}), 503

    user = g.current_user
    if user.plan == 'premium':
        return jsonify({'success': False, 'message': 'Already on Premium'}), 400

    stripe.api_key = current_app.config['STRIPE_SECRET_KEY']
    frontend_url = current_app.config['FRONTEND_URL']

    # Re-use existing Stripe customer if one exists
    existing_sub = (
        Subscription.query
        .filter_by(user_id=user.id, provider='stripe')
        .first()
    )
    customer_id = existing_sub.provider_customer_id if existing_sub else None

    checkout_params = {
        'mode': 'subscription',
        'payment_method_types': ['card'],
        'line_items': [{
            'price': current_app.config['STRIPE_PRICE_ID_PREMIUM'].strip(),
            'quantity': 1,
        }],
        'success_url': f'{frontend_url}/dashboard?upgrade=success',
        'cancel_url': f'{frontend_url}/dashboard?upgrade=cancelled',
        'client_reference_id': str(user.id),
        'metadata': {'user_id': str(user.id)},
    }
    if customer_id:
        checkout_params['customer'] = customer_id
    else:
        checkout_params['customer_email'] = user.email

    try:
        session = stripe.checkout.Session.create(**checkout_params)
    except stripe.StripeError as exc:
        logger.exception('Stripe checkout creation failed')
        return jsonify({'success': False, 'message': 'Payment service error'}), 502

    return jsonify({'success': True, 'url': session.url}), 200


# ------------------------------------------------------------------
# Stripe Customer Portal
# ------------------------------------------------------------------
@api_bp.route('/subscriptions/portal', methods=['POST'])
@require_auth
def create_portal_session():
    """Redirect to Stripe Customer Portal for managing subscription."""
    if not _stripe_configured():
        return jsonify({'success': False, 'message': 'Payments not configured'}), 503

    user = g.current_user
    stripe.api_key = current_app.config['STRIPE_SECRET_KEY']

    sub = (
        Subscription.query
        .filter_by(user_id=user.id, provider='stripe')
        .first()
    )
    if not sub or not sub.provider_customer_id:
        return jsonify({'success': False, 'message': 'No subscription found'}), 404

    frontend_url = current_app.config['FRONTEND_URL']
    try:
        session = stripe.billing_portal.Session.create(
            customer=sub.provider_customer_id,
            return_url=f'{frontend_url}/dashboard',
        )
    except stripe.StripeError:
        logger.exception('Stripe portal session failed')
        return jsonify({'success': False, 'message': 'Payment service error'}), 502

    return jsonify({'success': True, 'url': session.url}), 200


# ------------------------------------------------------------------
# Stripe Webhook
# ------------------------------------------------------------------
@api_bp.route('/webhooks/stripe', methods=['POST'])
def stripe_webhook():
    """Handle Stripe webhook events for subscription lifecycle."""
    if not _stripe_configured():
        return '', 400

    stripe.api_key = current_app.config['STRIPE_SECRET_KEY']
    webhook_secret = current_app.config['STRIPE_WEBHOOK_SECRET']
    payload = request.get_data()
    sig_header = request.headers.get('Stripe-Signature', '')

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    except (ValueError, stripe.SignatureVerificationError):
        logger.warning('Stripe webhook signature verification failed')
        return '', 400

    event_type = event['type']
    data = event['data']['object']

    if event_type == 'checkout.session.completed':
        _handle_checkout_completed(data)
    elif event_type in ('customer.subscription.updated', 'customer.subscription.deleted'):
        _handle_subscription_change(data)

    return '', 200


def _handle_checkout_completed(session):
    """Activate premium after successful checkout."""
    from app.models.user import User

    user_id = session.get('client_reference_id') or (session.get('metadata') or {}).get('user_id')
    if not user_id:
        logger.error('Stripe checkout missing user_id in metadata')
        return

    customer_id = session.get('customer')
    subscription_id = session.get('subscription')

    user = User.query.get(user_id)
    if not user:
        logger.error('Stripe checkout: user %s not found', user_id)
        return

    # Upsert subscription record
    sub = Subscription.query.filter_by(user_id=user.id, provider='stripe').first()
    if not sub:
        sub = Subscription(user_id=user.id, provider='stripe')
        db.session.add(sub)

    sub.provider_customer_id = customer_id
    sub.provider_subscription_id = subscription_id
    sub.plan = 'premium'
    sub.status = 'active'

    user.plan = 'premium'
    db.session.commit()
    logger.info('User %s upgraded to premium via Stripe checkout', user_id)


def _handle_subscription_change(subscription_data):
    """Update plan when subscription is updated or cancelled."""
    from app.models.user import User

    sub_id = subscription_data.get('id')
    status = subscription_data.get('status')  # active | past_due | canceled | unpaid

    sub = Subscription.query.filter_by(provider_subscription_id=sub_id, provider='stripe').first()
    if not sub:
        logger.warning('Stripe sub %s not found in DB', sub_id)
        return

    sub.status = status
    if subscription_data.get('current_period_end'):
        from datetime import datetime, timezone
        sub.current_period_end = datetime.fromtimestamp(
            subscription_data['current_period_end'], tz=timezone.utc,
        )

    user = User.query.get(sub.user_id)
    if user:
        if status in ('active', 'past_due'):
            user.plan = 'premium'
        else:
            user.plan = 'basic'

    db.session.commit()
    logger.info('Subscription %s status → %s for user %s', sub_id, status, sub.user_id)
