import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getFirebaseAdminApp, getFirestoreAdmin } from '@/lib/firebase/admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { 
  PaymentEvent, 
  PaymentStatus, 
  SubscriptionStatus,
  SUBSCRIPTION_CONSTANTS 
} from '@/types/subscription';

// Transaction Hub API webhook signature verification
const WEBHOOK_SECRET = process.env.TRANSACTION_HUB_WEBHOOK_SECRET;

interface WebhookPayload {
  event_type: 'payment.succeeded' | 'payment.failed' | 'subscription.created' | 'subscription.updated' | 'subscription.canceled' | 'refund.created';
  event_id: string;
  created_at: string;
  data: {
    id: string;
    user_id: string;
    subscription_id?: string;
    plan_id?: string;
    amount: number;
    currency: 'JPY';
    status: PaymentStatus;
    payment_method_id?: string;
    failure_reason?: string;
    metadata?: Record<string, any>;
  };
  signature: string;
}

// Webhook signature verification
function verifyWebhookSignature(payload: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) {
    console.error('[Payment Webhook] WEBHOOK_SECRET not configured');
    return false;
  }

  try {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(payload, 'utf8')
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('[Payment Webhook] Signature verification error:', error);
    return false;
  }
}

// Check if event already processed (idempotency control)
async function isEventProcessed(eventId: string): Promise<boolean> {
  try {
    const db = getFirestoreAdmin();
    if (!db) return false;

    const eventDoc = await db.collection('payment_events').doc(eventId).get();
    return eventDoc.exists;
  } catch (error) {
    console.error('[Payment Webhook] Error checking event:', error);
    return false;
  }
}

// Record payment event for idempotency
async function recordPaymentEvent(event: WebhookPayload): Promise<void> {
  try {
    const db = getFirestoreAdmin();
    if (!db) throw new Error('Firestore Admin not initialized');

    const paymentEvent: PaymentEvent = {
      id: event.event_id,
      userId: event.data.user_id,
      subscriptionId: event.data.subscription_id || null,
      eventType: event.event_type,
      amount: event.data.amount,
      currency: event.data.currency,
      status: event.data.status,
      paymentMethodId: event.data.payment_method_id || null,
      failureReason: event.data.failure_reason || null,
      metadata: event.data.metadata || null,
      createdAt: Timestamp.fromDate(new Date(event.created_at))
    };

    await db.collection('payment_events').doc(event.event_id).set(paymentEvent);
    console.log(`[Payment Webhook] Event ${event.event_id} recorded`);
  } catch (error) {
    console.error('[Payment Webhook] Error recording event:', error);
    throw error;
  }
}

// Update user subscription data
async function updateUserSubscription(event: WebhookPayload): Promise<void> {
  try {
    const db = getFirestoreAdmin();
    if (!db) throw new Error('Firestore Admin not initialized');

    const userId = event.data.user_id;
    const userRef = db.collection('users').doc(userId);

    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      
      if (!userDoc.exists) {
        console.warn(`[Payment Webhook] User ${userId} not found`);
        return;
      }

      const userData = userDoc.data();
      const updates: Record<string, any> = {};

      switch (event.event_type) {
        case 'payment.succeeded':
          await handlePaymentSucceeded(event, userData, updates, transaction);
          break;
        
        case 'payment.failed':
          await handlePaymentFailed(event, userData, updates, transaction);
          break;
        
        case 'subscription.created':
          await handleSubscriptionCreated(event, userData, updates, transaction);
          break;
        
        case 'subscription.updated':
          await handleSubscriptionUpdated(event, userData, updates, transaction);
          break;
        
        case 'subscription.canceled':
          await handleSubscriptionCanceled(event, userData, updates, transaction);
          break;
        
        case 'refund.created':
          await handleRefundCreated(event, userData, updates, transaction);
          break;
        
        default:
          console.warn(`[Payment Webhook] Unknown event type: ${event.event_type}`);
          return;
      }

      // Apply updates if any
      if (Object.keys(updates).length > 0) {
        updates.updatedAt = FieldValue.serverTimestamp();
        transaction.update(userRef, updates);
        console.log(`[Payment Webhook] User ${userId} updated for event ${event.event_type}`);
      }
    });

  } catch (error) {
    console.error('[Payment Webhook] Error updating user subscription:', error);
    throw error;
  }
}

// Handle successful payment
async function handlePaymentSucceeded(
  event: WebhookPayload, 
  userData: any, 
  updates: Record<string, any>,
  transaction: any
): Promise<void> {
  const planId = event.data.plan_id;
  if (!planId) return;

  // Get plan information
  const db = getFirestoreAdmin();
  if (!db) return;

  const planDoc = await transaction.get(db.collection('plans').doc(planId));
  if (!planDoc.exists) {
    console.error(`[Payment Webhook] Plan ${planId} not found`);
    return;
  }

  const planData = planDoc.data();
  const now = Timestamp.now();
  
  // Calculate subscription period
  const months = parseInt(planData.planType.replace('month', ''));
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + months);

  // Update subscription basic info
  updates['subscriptionBasic'] = {
    planType: planData.planType,
    status: SUBSCRIPTION_CONSTANTS.SUBSCRIPTION_STATUS.ACTIVE,
    startDate: now,
    endDate: Timestamp.fromDate(endDate),
    autoRenew: true,
    trialEndDate: null
  };

  // Update subscription management info
  updates['subscriptionManagement'] = {
    subscriptionId: event.data.subscription_id || event.data.id,
    customerId: userData.billing?.customerId || '',
    priceId: planId,
    billingCycle: planData.billingCycle,
    nextBillingDate: Timestamp.fromDate(endDate),
    lastBillingDate: now,
    amount: event.data.amount,
    currency: event.data.currency
  };

  // Update subscription schedule
  updates['subscriptionSchedule'] = {
    currentPeriodStart: now,
    currentPeriodEnd: Timestamp.fromDate(endDate),
    nextPeriodStart: null,
    gracePeriodEnd: null,
    pausedAt: null,
    resumeAt: null
  };

  // Update convenience fields
  updates['isPremium'] = true;
  updates['hasActiveSubscription'] = true;
  updates['canAccessPremiumFeatures'] = true;
  updates['subscriptionExpiresAt'] = Timestamp.fromDate(endDate);
  
  // Calculate days until expiry
  const diffMs = endDate.getTime() - new Date().getTime();
  const daysUntilExpiry = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  updates['daysUntilExpiry'] = daysUntilExpiry;

  // Update billing info
  updates['billing.lastPaymentDate'] = now;
  updates['billing.nextBillingDate'] = Timestamp.fromDate(endDate);

  // Clear cancellation info
  updates['cancellation'] = {
    canceledAt: null,
    cancelAtPeriodEnd: false,
    cancelReason: null,
    refundAmount: null,
    refundStatus: null
  };
}

// Handle failed payment
async function handlePaymentFailed(
  event: WebhookPayload, 
  userData: any, 
  updates: Record<string, any>,
  transaction: any
): Promise<void> {
  // Update subscription status to past_due
  if (userData.subscriptionBasic) {
    updates['subscriptionBasic.status'] = SUBSCRIPTION_CONSTANTS.SUBSCRIPTION_STATUS.PAST_DUE;
  }

  // Set grace period (3 days default)
  const gracePeriodEnd = new Date();
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() + SUBSCRIPTION_CONSTANTS.DEFAULT_VALUES.GRACE_PERIOD_DAYS);
  
  updates['subscriptionSchedule.gracePeriodEnd'] = Timestamp.fromDate(gracePeriodEnd);
  updates['canAccessPremiumFeatures'] = false;

  console.log(`[Payment Webhook] Payment failed for user ${event.data.user_id}, grace period until ${gracePeriodEnd.toISOString()}`);
}

// Handle subscription created
async function handleSubscriptionCreated(
  event: WebhookPayload, 
  userData: any, 
  updates: Record<string, any>,
  transaction: any
): Promise<void> {
  // Similar to payment succeeded, but for new subscriptions
  await handlePaymentSucceeded(event, userData, updates, transaction);
}

// Handle subscription updated
async function handleSubscriptionUpdated(
  event: WebhookPayload, 
  userData: any, 
  updates: Record<string, any>,
  transaction: any
): Promise<void> {
  // Update subscription management info with new data
  if (event.data.subscription_id && userData.subscriptionManagement) {
    updates['subscriptionManagement'] = {
      ...userData.subscriptionManagement,
      subscriptionId: event.data.subscription_id,
      amount: event.data.amount || userData.subscriptionManagement.amount,
      updatedAt: Timestamp.now()
    };
  }
}

// Handle subscription canceled
async function handleSubscriptionCanceled(
  event: WebhookPayload, 
  userData: any, 
  updates: Record<string, any>,
  transaction: any
): Promise<void> {
  const now = Timestamp.now();
  
  // Update basic subscription info
  updates['subscriptionBasic.status'] = SUBSCRIPTION_CONSTANTS.SUBSCRIPTION_STATUS.CANCELED;
  updates['subscriptionBasic.autoRenew'] = false;

  // Update cancellation info
  updates['cancellation'] = {
    canceledAt: now,
    cancelAtPeriodEnd: true,
    cancelReason: event.data.metadata?.cancelReason || 'User requested cancellation',
    refundAmount: null,
    refundStatus: null
  };

  // Keep premium access until period end if not immediate cancellation
  if (!event.data.metadata?.immediateCancel) {
    updates['canAccessPremiumFeatures'] = true;
  } else {
    updates['isPremium'] = false;
    updates['hasActiveSubscription'] = false;
    updates['canAccessPremiumFeatures'] = false;
    updates['subscriptionExpiresAt'] = now;
  }

  console.log(`[Payment Webhook] Subscription canceled for user ${event.data.user_id}`);
}

// Handle refund created
async function handleRefundCreated(
  event: WebhookPayload, 
  userData: any, 
  updates: Record<string, any>,
  transaction: any
): Promise<void> {
  // Update cancellation info with refund details
  updates['cancellation.refundAmount'] = event.data.amount;
  updates['cancellation.refundStatus'] = 'completed';

  // If full refund, immediately revoke access
  if (userData.subscriptionManagement && event.data.amount >= userData.subscriptionManagement.amount) {
    updates['isPremium'] = false;
    updates['hasActiveSubscription'] = false;
    updates['canAccessPremiumFeatures'] = false;
    updates['subscriptionBasic.status'] = SUBSCRIPTION_CONSTANTS.SUBSCRIPTION_STATUS.CANCELED;
  }

  console.log(`[Payment Webhook] Refund processed for user ${event.data.user_id}, amount: ${event.data.amount}`);
}

// Main webhook handler
export async function POST(request: NextRequest) {
  try {
    // Initialize Firebase Admin
    getFirebaseAdminApp();

    // Get request body and signature
    const body = await request.text();
    const headersList = headers();
    const signature = headersList.get('x-transaction-hub-signature') || '';

    // Verify webhook signature
    if (!verifyWebhookSignature(body, signature)) {
      console.error('[Payment Webhook] Invalid signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse webhook payload
    const event: WebhookPayload = JSON.parse(body);

    console.log(`[Payment Webhook] Processing event ${event.event_id}: ${event.event_type}`);

    // Check idempotency - if event already processed, return success
    if (await isEventProcessed(event.event_id)) {
      console.log(`[Payment Webhook] Event ${event.event_id} already processed`);
      return NextResponse.json({ status: 'already_processed' });
    }

    // Record the event for idempotency
    await recordPaymentEvent(event);

    // Process the event and update user data
    await updateUserSubscription(event);

    console.log(`[Payment Webhook] Successfully processed event ${event.event_id}`);

    return NextResponse.json({ 
      status: 'success',
      event_id: event.event_id,
      processed_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Payment Webhook] Error processing webhook:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({ 
    status: 'healthy',
    service: 'payment-webhook',
    timestamp: new Date().toISOString()
  });
}