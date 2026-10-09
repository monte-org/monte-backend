# Subscription System Guide

## Overview

The subscription system provides comprehensive recurring billing functionality for merchants offering subscription-based services. It supports flexible billing intervals, automatic payment processing, subscription lifecycle management, proration, dunning management, usage tracking, and webhook notifications.

## Architecture

### Data Models

#### SubscriptionPlan
- **Purpose**: Defines subscription pricing and billing rules
- **Key Fields**: amount, currency, billingInterval, trialPeriodDays, gracePeriodDays, lateFeePercentage, maxRetryAttempts
- **Billing Intervals**: DAILY, WEEKLY, MONTHLY, YEARLY
- **Status**: ACTIVE, INACTIVE, ARCHIVED

#### Subscription
- **Purpose**: Represents an active customer subscription
- **Key Fields**: customerId, customerEmail, planId, status, currentPeriodStart, currentPeriodEnd
- **Status**: ACTIVE, TRIALING, PAST_DUE, CANCELLED, PAUSED, COMPLETED
- **Lifecycle**: Supports trial periods, automatic renewal, pause/resume, cancellation

#### SubscriptionInvoice
- **Purpose**: Tracks billing transactions
- **Key Fields**: subscriptionId, status, type, subtotal, total, lineItems
- **Types**: RECURRING, PRORATION, USAGE_BASED, ONE_TIME
- **Status**: DRAFT, PENDING, PROCESSING, PAID, FAILED, VOID, REFUNDED

#### SubscriptionUsage
- **Purpose**: Tracks usage-based billing metrics
- **Key Fields**: metricId, metricName, quantity, unitPrice, periodStart, periodEnd
- **Supports**: Usage aggregation, limit checking, period-based reporting

#### DunningRecord
- **Purpose**: Manages failed payment recovery
- **Key Fields**: action, attemptNumber, scheduledAt, status
- **Actions**: PAYMENT_RETRY, EMAIL_NOTIFICATION, SUBSCRIPTION_PAUSE, SUBSCRIPTION_CANCEL
- **Status**: PENDING, IN_PROGRESS, RESOLVED, FAILED, ESCALATED

## Services

### SubscriptionPlanService
Manages subscription plan lifecycle:
- `createPlan()` - Create new pricing plans
- `updatePlan()` - Modify existing plans
- `archivePlan()` - Archive unused plans
- `calculateNextBillingDate()` - Calculate next payment date
- `calculateProration()` - Calculate proration amounts for plan changes

### SubscriptionService
Core subscription management:
- `createSubscription()` - Create new subscriptions with optional trials
- `updateSubscription()` - Modify subscription details
- `changePlan()` - Handle plan changes with proration
- `cancelSubscription()` - Immediate or end-of-period cancellation
- `pauseSubscription()` - Temporarily suspend billing
- `resumeSubscription()` - Reactivate paused subscriptions
- `processSubscriptionPayment()` - Process recurring payments
- `handleTrialEnd()` - Transition from trial to active billing

### SubscriptionInvoiceService
Invoice generation and management:
- `createRecurringInvoice()` - Generate standard billing invoices
- `createProrationInvoice()` - Handle plan change adjustments
- `createUsageBasedInvoice()` - Generate usage-based bills
- `markInvoiceAsPaid()` - Record successful payments
- `markInvoiceAsFailed()` - Handle payment failures
- `calculateLateFee()` - Compute overdue penalties

### SubscriptionSchedulerService
Automated payment scheduling using Bull queues:
- `scheduleNextPayment()` - Queue future payment processing
- `scheduleTrialEnd()` - Queue trial-to-active transition
- `scheduleResume()` - Queue subscription reactivation
- `cancelScheduledPayments()` - Remove pending payment jobs
- **Cron Jobs**: Hourly sync, daily cleanup

### DunningService
Failed payment recovery management:
- `createDunningRecord()` - Create recovery actions
- `processDunningRecord()` - Execute recovery strategies
- `scheduleNextDunningAction()` - Plan retry sequence
- **Retry Strategy**: Email notification → Payment retry → Pause → Cancel

### UsageTrackingService
Usage-based billing support:
- `recordUsage()` - Record individual usage events
- `recordUsageBatch()` - Batch usage recording
- `aggregateUsageByMetric()` - Sum usage by metric
- `checkUsageLimits()` - Validate against plan limits
- `getUsageSummary()` - Generate usage reports

### SubscriptionNotificationService
Webhook event notifications:
- `sendSubscriptionEvent()` - Notify on subscription changes
- `sendInvoiceEvent()` - Notify on invoice status changes
- `sendDunningEvent()` - Notify on dunning actions
- **Events**: subscription.created, subscription.updated, subscription.cancelled, invoice.paid, dunning.retry_scheduled

### SubscriptionAnalyticsService
Business intelligence and reporting:
- `getSubscriptionMetrics()` - Subscription counts, churn rate, MRR, ARR
- `getRevenueMetrics()` - Revenue totals, invoice status breakdown
- `getPlanMetrics()` - Plan performance comparison
- `getSubscriptionTrends()` - Time-series subscription data
- `getCustomerLifetimeValue()` - LTV calculations

## API Endpoints

### Plan Management
- `POST /subscriptions/plans` - Create plan
- `GET /subscriptions/plans/:planId` - Get plan details
- `GET /subscriptions/plans` - List merchant plans
- `PUT /subscriptions/plans/:planId` - Update plan
- `POST /subscriptions/plans/:planId/archive` - Archive plan
- `POST /subscriptions/plans/:planId/activate` - Activate plan
- `POST /subscriptions/plans/:planId/deactivate` - Deactivate plan
- `DELETE /subscriptions/plans/:planId` - Delete plan

### Subscription Management
- `POST /subscriptions` - Create subscription
- `GET /subscriptions/:subscriptionId` - Get subscription details
- `GET /subscriptions` - List merchant subscriptions
- `GET /subscriptions/customer/:customerId` - Get customer subscriptions
- `PUT /subscriptions/:subscriptionId` - Update subscription
- `POST /subscriptions/:subscriptionId/cancel` - Cancel subscription
- `POST /subscriptions/:subscriptionId/pause` - Pause subscription
- `POST /subscriptions/:subscriptionId/resume` - Resume subscription
- `POST /subscriptions/:subscriptionId/process-payment` - Process payment

### Invoice Management
- `GET /subscriptions/:subscriptionId/invoices` - List subscription invoices
- `GET /subscriptions/invoices/:invoiceId` - Get invoice details
- `GET /subscriptions/invoices` - List merchant invoices
- `GET /subscriptions/invoices/customer/:customerId` - Get customer invoices
- `POST /subscriptions/invoices/:invoiceId/retry` - Retry failed payment
- `POST /subscriptions/invoices/:invoiceId/void` - Void invoice
- `POST /subscriptions/invoices/:invoiceId/refund` - Refund invoice

### Usage Tracking
- `POST /subscriptions/usage` - Record usage
- `POST /subscriptions/usage/batch` - Batch record usage
- `GET /subscriptions/:subscriptionId/usage` - Get usage records
- `GET /subscriptions/:subscriptionId/usage/summary` - Get usage summary
- `GET /subscriptions/:subscriptionId/usage/check-limit` - Check usage limits
- `DELETE /subscriptions/usage/:usageId` - Delete usage record

### Dunning Management
- `GET /subscriptions/:subscriptionId/dunning` - Get dunning records
- `POST /subscriptions/dunning/:dunningId/process` - Process dunning action
- `POST /subscriptions/dunning/:dunningId/escalate` - Escalate dunning issue

### Analytics
- `GET /subscriptions/analytics/metrics` - Get subscription metrics
- `GET /subscriptions/analytics/revenue` - Get revenue metrics
- `GET /subscriptions/analytics/plans` - Get plan performance
- `GET /subscriptions/analytics/trends` - Get subscription trends
- `GET /subscriptions/analytics/lifetime-value` - Get customer LTV

## Configuration

### Environment Variables
```env
# Redis for Bull queues
REDIS_HOST=localhost
REDIS_PORT=6379

# Database (already configured)
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=monte
```

### Bull Queues
- `subscription-payments` - Recurring payment processing
- `subscription-trials` - Trial end processing
- `subscription-resume` - Subscription reactivation
- `webhook-notifications` - Webhook delivery

## Proration Logic

Proration is calculated when changing plans:

```typescript
proratedAmount = (newPlanDailyRate × daysRemaining) - (oldPlanDailyRate × daysRemaining)
```

- **Upgrades**: Customer pays the difference
- **Downgrades**: Customer receives credit
- **Configurable**: Per-plan proration settings

## Dunning Strategy

Default retry sequence:
1. **Attempt 1**: Email notification + Payment retry (24 hours)
2. **Attempt 2**: Email notification + Payment retry (24 hours)
3. **Attempt 3**: Email notification + Payment retry (24 hours)
4. **Final**: Subscription cancellation

Configurable per plan via `maxRetryAttempts` and `lateFeePercentage`.

## Usage-Based Billing

Supports metered billing:
- Record usage events with metric ID, quantity, and unit price
- Aggregate usage by billing period
- Check against plan limits before allowing usage
- Generate usage-based invoices

## Webhook Events

All subscription events trigger webhooks:
- `subscription.created` - New subscription created
- `subscription.updated` - Subscription modified
- `subscription.cancelled` - Subscription cancelled
- `subscription.paused` - Subscription paused
- `subscription.resumed` - Subscription resumed
- `subscription.trial_ended` - Trial period ended
- `subscription.payment_failed` - Payment processing failed
- `subscription.payment_succeeded` - Payment successful
- `invoice.created` - Invoice generated
- `invoice.paid` - Invoice paid
- `dunning.retry_scheduled` - Payment retry scheduled

## Multi-Currency Support

All monetary fields include currency specification:
- Plans have a currency field
- Invoices inherit subscription currency
- Amounts stored as decimals with 8-digit precision

## Grace Periods and Late Fees

- **Grace Period**: Days after due date before late fees apply
- **Late Fee**: Percentage of invoice amount charged after grace period
- **Configurable**: Per-plan settings

## Testing

### Test Webhook
```bash
POST /subscriptions/webhooks/test
{
  "webhookUrl": "https://your-domain.com/webhook"
}
```

### Create Test Subscription
```bash
POST /subscriptions
{
  "planId": "plan-uuid",
  "customerId": "customer-uuid",
  "customerEmail": "customer@example.com",
  "trialPeriod": true
}
```

## Monitoring

The system includes built-in monitoring:
- Queue job status logging
- Payment failure tracking
- Dunning action monitoring
- Scheduled task execution logs

## Best Practices

1. **Plan Design**: Create clear plan hierarchies with meaningful names
2. **Proration**: Enable proration for smooth plan transitions
3. **Dunning**: Configure appropriate retry attempts based on your business
4. **Usage Tracking**: Define clear metrics and units for usage-based billing
5. **Webhooks**: Implement idempotent webhook handlers
6. **Testing**: Test plan changes and cancellations thoroughly
7. **Monitoring**: Monitor queue health and payment success rates

## Integration Points

The subscription system integrates with:
- **Payment Service** - For actual payment processing
- **Webhook Service** - For event notifications
- **Blockchain Listener** - For Stellar transaction monitoring
- **Merchant Service** - For merchant validation
