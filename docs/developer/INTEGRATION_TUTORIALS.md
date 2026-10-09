# Monte Integration Tutorials

## Table of Contents
1. [Quick Start: Create First Payment in 5 Minutes](#quick-start-create-first-payment-in-5-minutes)
2. [Checkout Integration: Embed Monte Checkout](#checkout-integration-embed-monte-checkout)
3. [API Integration: Use REST API](#api-integration-use-rest-api)
4. [Webhook Integration: Handle Payment Events](#webhook-integration-handle-payment-events)
5. [SDK Integration: JavaScript SDK](#sdk-integration-javascript-sdk)
6. [SDK Integration: Python SDK](#sdk-integration-python-sdk)
7. [SDK Integration: Go SDK](#sdk-integration-go-sdk)
8. [Subscription Integration: Recurring Billing](#subscription-integration-recurring-billing)

## Quick Start: Create First Payment in 5 Minutes

This tutorial will guide you through creating your first payment using Monte in just 5 minutes.

### Prerequisites

- Monte API key (get from [dashboard.monte.io](https://dashboard.monte.io))
- Node.js installed (for this example)

### Step 1: Get Your API Key

1. Sign up at [dashboard.monte.io](https://dashboard.monte.io)
2. Navigate to API Keys section
3. Create a new API key
4. Copy your API key

### Step 2: Create a Payment

```javascript
// payment-example.js
const axios = require('axios');

const API_KEY = 'your_api_key_here';
const API_URL = 'https://api.monte.io/api/v1';

async function createPayment() {
  try {
    const response = await axios.post(
      `${API_URL}/payments`,
      {
        amount: 100.00,
        currency: 'XLM',
        merchantId: 'your_merchant_id',
        customerEmail: 'customer@example.com',
        description: 'Test payment',
      },
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Payment created successfully!');
    console.log('Payment ID:', response.data.paymentId);
    console.log('Payment URL:', response.data.paymentUrl);
    
    return response.data;
  } catch (error) {
    console.error('Error creating payment:', error.response?.data || error.message);
  }
}

createPayment();
```

### Step 3: Run the Example

```bash
# Install axios
npm install axios

# Run the script
node payment-example.js
```

### Step 4: Complete the Payment

1. Open the `paymentUrl` from the response
2. Complete the payment using your Stellar wallet
3. The payment will be processed on the Stellar network

### Step 5: Verify Payment Status

```javascript
async function checkPaymentStatus(paymentId) {
  try {
    const response = await axios.get(
      `${API_URL}/payments/${paymentId}`,
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
        },
      }
    );

    console.log('Payment Status:', response.data.status);
    console.log('Transaction Hash:', response.data.transactionHash);
    
    return response.data;
  } catch (error) {
    console.error('Error checking payment:', error.response?.data || error.message);
  }
}

// Use the payment ID from step 2
checkPaymentStatus('payment_id_from_step_2');
```

### What's Next?

- [Embed Monte Checkout](#checkout-integration-embed-monte-checkout)
- [Handle Webhooks](#webhook-integration-handle-payment-events)
- [Use SDKs](#sdk-integration-javascript-sdk)

## Checkout Integration: Embed Monte Checkout

This tutorial shows how to embed Monte's hosted checkout into your website.

### Step 1: Create a Payment

```javascript
// Create payment with redirect URL
const response = await axios.post(
  'https://api.monte.io/api/v1/payments',
  {
    amount: 50.00,
    currency: 'USD',
    merchantId: 'your_merchant_id',
    customerEmail: 'customer@example.com',
    redirectUrl: 'https://your-website.com/payment/success',
    cancelUrl: 'https://your-website.com/payment/cancel',
  },
  {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
    },
  }
);

const { paymentUrl, paymentId } = response.data;
```

### Step 2: Redirect to Checkout

```html
<!-- payment.html -->
<!DOCTYPE html>
<html>
<head>
  <title>Pay with Monte</title>
</head>
<body>
  <button onclick="redirectToCheckout()">
    Pay with Monte
  </button>

  <script>
    const paymentUrl = 'PAYMENT_URL_FROM_STEP_1';
    
    function redirectToCheckout() {
      window.location.href = paymentUrl;
    }
  </script>
</body>
</html>
```

### Step 3: Handle Payment Success

```javascript
// success.js (on your redirectUrl)
const urlParams = new URLSearchParams(window.location.search);
const paymentId = urlParams.get('payment_id');

async function handlePaymentSuccess() {
  try {
    const response = await axios.get(
      `https://api.monte.io/api/v1/payments/${paymentId}`,
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
        },
      }
    );

    if (response.data.status === 'COMPLETED') {
      // Payment successful
      console.log('Payment completed!');
      // Update your database
      // Show success message to user
    } else {
      // Payment pending or failed
      console.log('Payment status:', response.data.status);
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
  }
}

handlePaymentSuccess();
```

### Step 4: Handle Payment Cancellation

```javascript
// cancel.js (on your cancelUrl)
const urlParams = new URLSearchParams(window.location.search);
const paymentId = urlParams.get('payment_id');

// Handle cancellation
console.log('Payment cancelled by user');
// Redirect back to your website
window.location.href = 'https://your-website.com/checkout';
```

### Customizing Checkout

You can customize the checkout appearance:

```javascript
const response = await axios.post(
  'https://api.monte.io/api/v1/payments',
  {
    amount: 50.00,
    currency: 'USD',
    merchantId: 'your_merchant_id',
    customerEmail: 'customer@example.com',
    redirectUrl: 'https://your-website.com/payment/success',
    cancelUrl: 'https://your-website.com/payment/cancel',
    metadata: {
      customLogo: 'https://your-website.com/logo.png',
      customColor: '#FF5733',
      customTheme: 'dark',
    },
  },
  {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
    },
  }
);
```

## API Integration: Use REST API

This tutorial shows how to use Monte's REST API for custom checkout implementations.

### Authentication

All API requests require authentication using your API key:

```javascript
const headers = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
};
```

### Create Payment

```javascript
async function createPayment() {
  const response = await axios.post(
    'https://api.monte.io/api/v1/payments',
    {
      amount: 100.00,
      currency: 'XLM',
      merchantId: 'your_merchant_id',
      customerEmail: 'customer@example.com',
      customerName: 'John Doe',
      description: 'Product purchase',
      metadata: {
        orderId: 'ORDER-123',
        productId: 'PROD-456',
      },
    },
    { headers }
  );

  return response.data;
}
```

### Get Payment Details

```javascript
async function getPayment(paymentId) {
  const response = await axios.get(
    `https://api.monte.io/api/v1/payments/${paymentId}`,
    { headers }
  );

  return response.data;
}
```

### List Payments

```javascript
async function listPayments(filters = {}) {
  const params = new URLSearchParams(filters);
  const response = await axios.get(
    `https://api.monte.io/api/v1/payments?${params}`,
    { headers }
  );

  return response.data;
}

// Example usage
const payments = await listPayments({
  status: 'COMPLETED',
  limit: 10,
  offset: 0,
});
```

### Refund Payment

```javascript
async function refundPayment(paymentId, amount = null) {
  const response = await axios.post(
    `https://api.monte.io/api/v1/payments/${paymentId}/refund`,
    {
      amount: amount, // null for full refund
      reason: 'Customer request',
    },
    { headers }
  );

  return response.data;
}
```

### Create Subscription

```javascript
async function createSubscription() {
  const response = await axios.post(
    'https://api.monte.io/api/v1/subscriptions',
    {
      planId: 'plan_123',
      customerId: 'customer_456',
      customerEmail: 'customer@example.com',
      paymentMethodId: 'payment_method_789',
    },
    { headers }
  );

  return response.data;
}
```

### Complete Example: Custom Checkout Flow

```javascript
class MonteClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.monte.io/api/v1';
    this.headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  async createPayment(paymentData) {
    const response = await axios.post(
      `${this.baseUrl}/payments`,
      paymentData,
      { headers: this.headers }
    );
    return response.data;
  }

  async getPayment(paymentId) {
    const response = await axios.get(
      `${this.baseUrl}/payments/${paymentId}`,
      { headers: this.headers }
    );
    return response.data;
  }

  async listPayments(filters = {}) {
    const params = new URLSearchParams(filters);
    const response = await axios.get(
      `${this.baseUrl}/payments?${params}`,
      { headers: this.headers }
    );
    return response.data;
  }

  async refundPayment(paymentId, amount = null, reason = '') {
    const response = await axios.post(
      `${this.baseUrl}/payments/${paymentId}/refund`,
      { amount, reason },
      { headers: this.headers }
    );
    return response.data;
  }
}

// Usage
const monte = new MonteClient('your_api_key');

// Create payment
const payment = await monte.createPayment({
  amount: 100.00,
  currency: 'XLM',
  merchantId: 'your_merchant_id',
  customerEmail: 'customer@example.com',
});

// Check payment status
const status = await monte.getPayment(payment.paymentId);

// List payments
const payments = await monte.listPayments({ status: 'COMPLETED' });
```

## Webhook Integration: Handle Payment Events

This tutorial shows how to handle Monte webhooks to receive real-time payment events.

### Step 1: Register Webhook

```javascript
async function registerWebhook() {
  const response = await axios.post(
    'https://api.monte.io/api/v1/notifications/webhooks/register',
    {
      url: 'https://your-website.com/webhooks/monte',
      events: [
        'payment.created',
        'payment.confirmed',
        'payment.failed',
        'subscription.billed',
      ],
      secret: 'your_webhook_secret',
    },
    {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
    }
  );

  return response.data;
}
```

### Step 2: Create Webhook Endpoint

```javascript
// Express.js example
const express = require('express');
const crypto = require('crypto');
const app = express();

app.use(express.json());

app.post('/webhooks/monte', (req, res) => {
  const signature = req.headers['x-monte-signature'];
  const payload = JSON.stringify(req.body);

  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', 'your_webhook_secret')
    .update(payload)
    .digest('hex');

  if (signature !== expectedSignature) {
    console.error('Invalid signature');
    return res.status(401).send('Invalid signature');
  }

  // Handle webhook event
  handleWebhookEvent(req.body);

  res.status(200).send('OK');
});

function handleWebhookEvent(event) {
  const { eventType, data } = event;

  switch (eventType) {
    case 'payment.created':
      console.log('Payment created:', data.paymentId);
      break;
    case 'payment.confirmed':
      console.log('Payment confirmed:', data.paymentId);
      // Update your database
      // Send confirmation email
      break;
    case 'payment.failed':
      console.log('Payment failed:', data.paymentId);
      // Handle failure
      break;
    case 'subscription.billed':
      console.log('Subscription billed:', data.subscriptionId);
      // Process subscription billing
      break;
    default:
      console.log('Unknown event type:', eventType);
  }
}

app.listen(3000, () => {
  console.log('Webhook server running on port 3000');
});
```

### Step 3: Test Webhook

```bash
# Use ngrok to test locally
ngrok http 3000

# Update webhook URL with ngrok URL
# Trigger a test payment
# Check webhook endpoint logs
```

### Webhook Event Types

| Event Type | Description |
|------------|-------------|
| `payment.created` | Payment initiated |
| `payment.confirmed` | Payment confirmed on-chain |
| `payment.failed` | Payment failed |
| `escrow.created` | Escrow initiated |
| `escrow.released` | Escrow released |
| `subscription.billed` | Subscription billed |
| `subscription.cancelled` | Subscription cancelled |

### Webhook Retry Logic

Monte automatically retries failed webhook deliveries with exponential backoff:
- 1st retry: 1 minute
- 2nd retry: 5 minutes
- 3rd retry: 15 minutes
- 4th retry: 1 hour
- 5th retry: 4 hours

## SDK Integration: JavaScript SDK

### Installation

```bash
npm install @monte/sdk
```

### Setup

```javascript
import { MonteClient } from '@monte/sdk';

const monte = new MonteClient({
  apiKey: 'your_api_key',
  environment: 'production', // or 'test'
});
```

### Create Payment

```javascript
const payment = await monte.payments.create({
  amount: 100.00,
  currency: 'XLM',
  merchantId: 'your_merchant_id',
  customerEmail: 'customer@example.com',
});

console.log('Payment ID:', payment.id);
console.log('Payment URL:', payment.paymentUrl);
```

### Get Payment

```javascript
const payment = await monte.payments.get('payment_id');

console.log('Status:', payment.status);
console.log('Amount:', payment.amount);
```

### List Payments

```javascript
const payments = await monte.payments.list({
  status: 'COMPLETED',
  limit: 10,
});

payments.forEach(payment => {
  console.log(payment.id, payment.amount);
});
```

### Create Subscription

```javascript
const subscription = await monte.subscriptions.create({
  planId: 'plan_123',
  customerId: 'customer_456',
  customerEmail: 'customer@example.com',
});

console.log('Subscription ID:', subscription.id);
```

### Handle Webhooks

```javascript
const webhookHandler = monte.webhooks.createHandler({
  secret: 'your_webhook_secret',
});

webhookHandler.on('payment.confirmed', (data) => {
  console.log('Payment confirmed:', data.paymentId);
  // Handle payment confirmation
});

webhookHandler.on('payment.failed', (data) => {
  console.log('Payment failed:', data.paymentId);
  // Handle payment failure
});

// Express.js integration
app.post('/webhooks/monte', webhookHandler.middleware());
```

### Complete Example

```javascript
import { MonteClient } from '@monte/sdk';

const monte = new MonteClient({
  apiKey: 'your_api_key',
  environment: 'test',
});

async function processPayment() {
  try {
    // Create payment
    const payment = await monte.payments.create({
      amount: 50.00,
      currency: 'USD',
      merchantId: 'your_merchant_id',
      customerEmail: 'customer@example.com',
    });

    console.log('Payment created:', payment.id);

    // Wait for confirmation
    const confirmedPayment = await monte.payments.waitForConfirmation(
      payment.id,
      { timeout: 300000 } // 5 minutes
    );

    console.log('Payment confirmed:', confirmedPayment.transactionHash);

    return confirmedPayment;
  } catch (error) {
    console.error('Payment failed:', error);
    throw error;
  }
}

processPayment();
```

## SDK Integration: Python SDK

### Installation

```bash
pip install monte-sdk
```

### Setup

```python
from monte import MonteClient

monte = MonteClient(
    api_key='your_api_key',
    environment='production'  # or 'test'
)
```

### Create Payment

```python
payment = monte.payments.create(
    amount=100.00,
    currency='XLM',
    merchant_id='your_merchant_id',
    customer_email='customer@example.com'
)

print(f"Payment ID: {payment.id}")
print(f"Payment URL: {payment.payment_url}")
```

### Get Payment

```python
payment = monte.payments.get('payment_id')

print(f"Status: {payment.status}")
print(f"Amount: {payment.amount}")
```

### List Payments

```python
payments = monte.payments.list(
    status='COMPLETED',
    limit=10
)

for payment in payments:
    print(f"{payment.id}: {payment.amount}")
```

### Create Subscription

```python
subscription = monte.subscriptions.create(
    plan_id='plan_123',
    customer_id='customer_456',
    customer_email='customer@example.com'
)

print(f"Subscription ID: {subscription.id}")
```

### Handle Webhooks

```python
from flask import Flask, request
from monte.webhooks import WebhookHandler

app = Flask(__name__)
webhook_handler = WebhookHandler(secret='your_webhook_secret')

@app.route('/webhooks/monte', methods=['POST'])
def handle_webhook():
    event = webhook_handler.verify(request)
    
    if event.event_type == 'payment.confirmed':
        print(f"Payment confirmed: {event.data.payment_id}")
        # Handle payment confirmation
    elif event.event_type == 'payment.failed':
        print(f"Payment failed: {event.data.payment_id}")
        # Handle payment failure
    
    return 'OK', 200

if __name__ == '__main__':
    app.run(port=3000)
```

### Complete Example

```python
from monte import MonteClient
import asyncio

monte = MonteClient(
    api_key='your_api_key',
    environment='test'
)

async def process_payment():
    try:
        # Create payment
        payment = monte.payments.create(
            amount=50.00,
            currency='USD',
            merchant_id='your_merchant_id',
            customer_email='customer@example.com'
        )
        
        print(f"Payment created: {payment.id}")
        
        # Wait for confirmation
        confirmed_payment = monte.payments.wait_for_confirmation(
            payment.id,
            timeout=300  # 5 minutes
        )
        
        print(f"Payment confirmed: {confirmed_payment.transaction_hash}")
        
        return confirmed_payment
    except Exception as error:
        print(f"Payment failed: {error}")
        raise

# Run
process_payment()
```

## SDK Integration: Go SDK

### Installation

```bash
go get github.com/0xNinx/monte-go-sdk
```

### Setup

```go
package main

import (
    "fmt"
    "github.com/0xNinx/monte-go-sdk"
)

func main() {
    client := monte.NewClient(&monte.Config{
        APIKey:      "your_api_key",
        Environment: monte.EnvironmentProduction, // or monte.EnvironmentTest
    })
}
```

### Create Payment

```go
payment, err := client.Payments.Create(&monte.CreatePaymentRequest{
    Amount:        100.00,
    Currency:      "XLM",
    MerchantID:    "your_merchant_id",
    CustomerEmail: "customer@example.com",
})

if err != nil {
    panic(err)
}

fmt.Printf("Payment ID: %s\n", payment.ID)
fmt.Printf("Payment URL: %s\n", payment.PaymentURL)
```

### Get Payment

```go
payment, err := client.Payments.Get("payment_id")

if err != nil {
    panic(err)
}

fmt.Printf("Status: %s\n", payment.Status)
fmt.Printf("Amount: %f\n", payment.Amount)
```

### List Payments

```go
payments, err := client.Payments.List(&monte.ListPaymentsRequest{
    Status: monte.PaymentStatusCompleted,
    Limit:  10,
})

if err != nil {
    panic(err)
}

for _, payment := range payments {
    fmt.Printf("%s: %f\n", payment.ID, payment.Amount)
}
```

### Create Subscription

```go
subscription, err := client.Subscriptions.Create(&monte.CreateSubscriptionRequest{
    PlanID:        "plan_123",
    CustomerID:    "customer_456",
    CustomerEmail: "customer@example.com",
})

if err != nil {
    panic(err)
}

fmt.Printf("Subscription ID: %s\n", subscription.ID)
```

### Handle Webhooks

```go
package main

import (
    "net/http"
    "github.com/0xNinx/monte-go-sdk/webhooks"
)

func webhookHandler(w http.ResponseWriter, r *http.Request) {
    handler := webhooks.NewHandler("your_webhook_secret")
    
    event, err := handler.Verify(r)
    if err != nil {
        http.Error(w, "Invalid signature", http.StatusUnauthorized)
        return
    }
    
    switch event.EventType {
    case "payment.confirmed":
        fmt.Printf("Payment confirmed: %s\n", event.Data["payment_id"])
        // Handle payment confirmation
    case "payment.failed":
        fmt.Printf("Payment failed: %s\n", event.Data["payment_id"])
        // Handle payment failure
    }
    
    w.WriteHeader(http.StatusOK)
}

func main() {
    http.HandleFunc("/webhooks/monte", webhookHandler)
    http.ListenAndServe(":3000", nil)
}
```

### Complete Example

```go
package main

import (
    "fmt"
    "time"
    "github.com/0xNinx/monte-go-sdk"
)

func main() {
    client := monte.NewClient(&monte.Config{
        APIKey:      "your_api_key",
        Environment: monte.EnvironmentTest,
    })
    
    // Create payment
    payment, err := client.Payments.Create(&monte.CreatePaymentRequest{
        Amount:        50.00,
        Currency:      "USD",
        MerchantID:    "your_merchant_id",
        CustomerEmail: "customer@example.com",
    })
    
    if err != nil {
        panic(err)
    }
    
    fmt.Printf("Payment created: %s\n", payment.ID)
    
    // Wait for confirmation
    confirmedPayment, err := client.Payments.WaitForConfirmation(
        payment.ID,
        &monte.WaitForConfirmationOptions{
            Timeout: 5 * time.Minute,
        },
    )
    
    if err != nil {
        panic(err)
    }
    
    fmt.Printf("Payment confirmed: %s\n", confirmedPayment.TransactionHash)
}
```

## Subscription Integration: Recurring Billing

This tutorial shows how to set up recurring billing with subscriptions.

### Step 1: Create a Subscription Plan

```javascript
async function createPlan() {
  const response = await axios.post(
    'https://api.monte.io/api/v1/subscriptions/plans',
    {
      name: 'Pro Plan',
      amount: 29.99,
      currency: 'USD',
      billingInterval: 'monthly',
      trialPeriodDays: 14,
      features: ['Feature 1', 'Feature 2', 'Feature 3'],
    },
    {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
    }
  );

  return response.data;
}

const plan = await createPlan();
console.log('Plan ID:', plan.planId);
```

### Step 2: Create a Subscription

```javascript
async function createSubscription(planId, customerId, customerEmail) {
  const response = await axios.post(
    'https://api.monte.io/api/v1/subscriptions',
    {
      planId,
      customerId,
      customerEmail,
      paymentMethodId: 'payment_method_id',
      trialPeriod: true,
    },
    {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
    }
  );

  return response.data;
}

const subscription = await createSubscription(
  plan.planId,
  'customer_123',
  'customer@example.com'
);

console.log('Subscription ID:', subscription.subscriptionId);
```

### Step 3: Handle Subscription Events

```javascript
// In your webhook handler
webhookHandler.on('subscription.billed', (data) => {
  console.log('Subscription billed:', data.subscriptionId);
  console.log('Amount:', data.amount);
  console.log('Next billing date:', data.nextBillingDate);
  
  // Update your database
  // Send invoice to customer
});

webhookHandler.on('subscription.cancelled', (data) => {
  console.log('Subscription cancelled:', data.subscriptionId);
  
  // Update your database
  // Send cancellation confirmation
});
```

### Step 4: Cancel Subscription

```javascript
async function cancelSubscription(subscriptionId) {
  const response = await axios.post(
    `https://api.monte.io/api/v1/subscriptions/${subscriptionId}/cancel`,
    {
      cancelAtPeriodEnd: true, // Cancel at end of current period
    },
    {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
    }
  );

  return response.data;
}

await cancelSubscription(subscription.subscriptionId);
```

### Step 5: Update Subscription Plan

```javascript
async function updateSubscriptionPlan(subscriptionId, newPlanId) {
  const response = await axios.put(
    `https://api.monte.io/api/v1/subscriptions/${subscriptionId}`,
    {
      planId: newPlanId,
    },
    {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
    }
  );

  return response.data;
}

await updateSubscriptionPlan(subscription.subscriptionId, 'new_plan_id');
```

### Complete Subscription Flow Example

```javascript
class SubscriptionManager {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.monte.io/api/v1';
    this.headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  async createPlan(planData) {
    const response = await axios.post(
      `${this.baseUrl}/subscriptions/plans`,
      planData,
      { headers: this.headers }
    );
    return response.data;
  }

  async createSubscription(planId, customerData) {
    const response = await axios.post(
      `${this.baseUrl}/subscriptions`,
      {
        planId,
        ...customerData,
      },
      { headers: this.headers }
    );
    return response.data;
  }

  async cancelSubscription(subscriptionId, cancelAtPeriodEnd = true) {
    const response = await axios.post(
      `${this.baseUrl}/subscriptions/${subscriptionId}/cancel`,
      { cancelAtPeriodEnd },
      { headers: this.headers }
    );
    return response.data;
  }

  async updateSubscription(subscriptionId, updates) {
    const response = await axios.put(
      `${this.baseUrl}/subscriptions/${subscriptionId}`,
      updates,
      { headers: this.headers }
    );
    return response.data;
  }
}

// Usage
const manager = new SubscriptionManager('your_api_key');

// Create plan
const plan = await manager.createPlan({
  name: 'Pro Plan',
  amount: 29.99,
  currency: 'USD',
  billingInterval: 'monthly',
});

// Create subscription
const subscription = await manager.createSubscription(plan.planId, {
  customerId: 'customer_123',
  customerEmail: 'customer@example.com',
  paymentMethodId: 'payment_method_123',
});

// Cancel subscription
await manager.cancelSubscription(subscription.subscriptionId);
```

## Testing Your Integration

### Test Mode

Monte provides a test mode for development:

```javascript
const monte = new MonteClient({
  apiKey: 'your_test_api_key',
  environment: 'test',
});
```

### Test Webhooks Locally

Use ngrok to test webhooks locally:

```bash
# Install ngrok
npm install -g ngrok

# Start ngrok
ngrok http 3000

# Use the ngrok URL for your webhook
```

### Test Cards and Wallets

Use test wallets for Stellar testnet:
- Get test XLM from [Stellar testnet faucet](https://friendbot.stellar.org)
- Use testnet for development
- Switch to mainnet for production

## Next Steps

- [SDK Documentation](#sdk-documentation)
- [Troubleshooting Guide](#troubleshooting-guide)
- [API Reference](https://api.monte.io/docs)
