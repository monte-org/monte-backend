# Monte Webhook System

A comprehensive webhook system for integrating Monte with external systems (CRM, accounting, inventory, etc.).

## Features

- **Webhook Registration**: Register and manage webhook endpoints
- **Event Types**: Support for multiple event types (payments, refunds, disputes, etc.)
- **Reliable Delivery**: Queue-based delivery with retry logic
- **Signature Verification**: HMAC-SHA256 signature verification for security
- **Rate Limiting**: Per-endpoint rate limiting to prevent overwhelming systems
- **Retry Logic**: Exponential backoff for failed deliveries
- **Dead Letter Queue**: Failed webhooks moved to dead letter queue after max retries
- **Delivery Logs**: Complete history of webhook deliveries
- **Testing Tools**: Test webhooks before activation
- **Debugging Tools**: Troubleshoot webhook issues
- **Replay Functionality**: Manually replay failed webhooks

## Installation

```bash
npm install
```

## Configuration

Add the following environment variables to your `.env` file:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=monte
```

## Event Types

- `payment.created` - Payment created
- `payment.paid` - Payment successfully paid
- `payment.failed` - Payment failed
- `payment.refunded` - Payment refunded
- `payment.split.created` - Payment split created
- `payment.split.completed` - Payment split completed
- `payment.split.failed` - Payment split failed
- `dispute.created` - Dispute created
- `dispute.resolved` - Dispute resolved
- `dispute.closed` - Dispute closed
- `refund.requested` - Refund requested
- `refund.processed` - Refund processed
- `refund.failed` - Refund failed
- `merchant.created` - Merchant account created
- `merchant.updated` - Merchant account updated
- `account.verified` - Account verified

## API Endpoints

### Webhook Management

#### Create Webhook
```http
POST /webhooks
Content-Type: application/json

{
  "merchantId": "merchant_123",
  "url": "https://your-domain.com/webhook",
  "events": ["payment.created", "payment.paid"],
  "secret": "your_webhook_secret",
  "maxRetries": 3,
  "timeout": 300,
  "rateLimitPerMinute": 60,
  "testMode": false
}
```

#### List Webhooks
```http
GET /webhooks?merchantId=merchant_123
```

#### Get Webhook
```http
GET /webhooks/:webhookId
```

#### Update Webhook
```http
PUT /webhooks/:webhookId
Content-Type: application/json

{
  "url": "https://new-domain.com/webhook",
  "events": ["payment.created", "payment.paid", "payment.failed"]
}
```

#### Delete Webhook
```http
DELETE /webhooks/:webhookId
```

#### Activate Webhook
```http
POST /webhooks/:webhookId/activate
```

#### Deactivate Webhook
```http
POST /webhooks/:webhookId/deactivate
```

### Webhook Testing & Debugging

#### Validate Webhook Endpoint
```http
POST /webhooks/:webhookId/validate
```

#### Simulate Webhook Delivery
```http
POST /webhooks/:webhookId/simulate
Content-Type: application/json

{
  "eventType": "payment.created",
  "customPayload": {
    "customField": "customValue"
  }
}
```

#### Get Debug Information
```http
GET /webhooks/:webhookId/debug
```

#### Troubleshoot Webhook
```http
GET /webhooks/:webhookId/troubleshoot
```

#### Generate Test Payload
```http
GET /webhooks/test/payload/:eventType
```

### Webhook Events & Delivery

#### Trigger Webhook
```http
POST /webhooks/trigger
Content-Type: application/json

{
  "eventType": "payment.created",
  "payload": {
    "paymentId": "pay_123",
    "amount": 100.00,
    "currency": "USD"
  },
  "merchantId": "merchant_123"
}
```

#### Get Webhook Events
```http
GET /webhooks/:webhookId/events?limit=50&offset=0
```

#### Get Webhook Deliveries
```http
GET /webhooks/events/:eventId/deliveries?limit=50&offset=0
```

#### Get Delivery Logs
```http
GET /webhooks/deliveries/:deliveryId/logs?limit=50&offset=0
```

#### Replay Webhook
```http
POST /webhooks/replay
Content-Type: application/json

{
  "eventId": "event_123",
  "webhookId": "webhook_123"
}
```

#### Get Webhook Statistics
```http
GET /webhooks/:webhookId/stats
```

## Webhook Signature Verification

Webhooks are signed using HMAC-SHA256. The signature is included in the `X-Monte-Signature` header.

### Signature Format
```
timestamp.signature
```

### Verification Example (Node.js)
```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret, tolerance = 300000) {
  const [timestamp, receivedSignature] = signature.split('.');
  
  const now = Date.now();
  const signatureTime = parseInt(timestamp, 10);
  
  if (Math.abs(now - signatureTime) > tolerance) {
    return false;
  }

  const payloadString = JSON.stringify(payload);
  const signaturePayload = `${timestamp}.${payloadString}`;
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signaturePayload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(receivedSignature),
    Buffer.from(expectedSignature),
  );
}
```

### Verification Example (Python)
```python
import hmac
import hashlib
import time

def verify_signature(payload, signature, secret, tolerance=300):
    timestamp, received_signature = signature.split('.')
    
    current_time = int(time.time())
    signature_time = int(timestamp)
    
    if abs(current_time - signature_time) > tolerance:
        return False
    
    payload_string = json.dumps(payload)
    signature_payload = f"{timestamp}.{payload_string}"
    
    expected_signature = hmac.new(
        secret.encode(),
        signature_payload.encode(),
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(received_signature, expected_signature)
```

## Webhook Payload Structure

### Standard Payload
```json
{
  "id": "evt_123",
  "eventType": "payment.created",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "paymentId": "pay_123",
    "amount": 100.00,
    "currency": "USD"
  }
}
```

### Headers
```
Content-Type: application/json
User-Agent: Monte-Webhook/1.0
X-Monte-Signature: 1234567890.abcdef...
X-Monte-Timestamp: 1234567890
X-Monte-Webhook-Id: webhook_123
```

## Retry Logic

Webhooks are retried with exponential backoff:

- Attempt 1: Immediate
- Attempt 2: 2 seconds delay
- Attempt 3: 4 seconds delay
- Attempt 4: 8 seconds delay
- Maximum delay: 1 hour

After max retries, the webhook is moved to the dead letter queue.

## Rate Limiting

Each webhook endpoint can be rate-limited to prevent overwhelming the receiving system:

- Default: No limit (0)
- Recommended: 60 requests per minute
- Configured per webhook via `rateLimitPerMinute`

## Testing Webhooks

Before activating a webhook in production:

1. Create webhook with `testMode: true`
2. Use the `/webhooks/:webhookId/simulate` endpoint to test delivery
3. Check the response and logs
4. Use `/webhooks/:webhookId/troubleshoot` to identify issues
5. Once satisfied, activate the webhook

## Dead Letter Queue

Failed webhooks after max retries are moved to the dead letter queue. These can be:

- Viewed via delivery logs
- Manually replayed using the replay endpoint
- Analyzed for troubleshooting

## Security Best Practices

1. **Always use HTTPS** for webhook endpoints
2. **Keep secrets secure** - never expose them in client-side code
3. **Verify signatures** on all incoming webhooks
4. **Use IP whitelisting** when possible (configure via `allowedIps`)
5. **Monitor delivery logs** for suspicious activity
6. **Implement rate limiting** on your webhook endpoints

## Monitoring & Analytics

### Webhook Statistics
```json
{
  "webhookId": "webhook_123",
  "url": "https://your-domain.com/webhook",
  "status": "ACTIVE",
  "totalEvents": 1000,
  "successfulDeliveries": 950,
  "failedDeliveries": 50,
  "pendingDeliveries": 0,
  "successRate": 95.0,
  "webhookSuccessCount": 950,
  "webhookFailureCount": 50,
  "lastSuccessAt": "2024-01-01T00:00:00Z",
  "lastFailureAt": "2024-01-01T00:00:00Z",
  "lastTriggeredAt": "2024-01-01T00:00:00Z"
}
```

## Troubleshooting

### Common Issues

1. **Webhook not firing**
   - Check webhook status is ACTIVE
   - Verify event types are configured
   - Check merchant ID matches

2. **Signature verification failing**
   - Ensure secret matches between Monte and your system
   - Check timestamp tolerance (default 5 minutes)
   - Verify payload is not modified before verification

3. **Webhook timing out**
   - Increase timeout setting (default 300 seconds)
   - Optimize webhook endpoint performance
   - Process webhooks asynchronously

4. **Rate limit exceeded**
   - Increase `rateLimitPerMinute` setting
   - Optimize webhook endpoint performance
   - Implement queue processing on your end

## Integration Examples

### Express.js (Node.js)
```javascript
const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

app.post('/webhook', (req, res) => {
  const signature = req.headers['x-monte-signature'];
  const payload = req.body;
  
  if (!verifySignature(payload, signature, process.env.WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process webhook
  console.log('Received webhook:', payload.eventType);
  
  res.status(200).json({ received: true });
});

function verifySignature(payload, signature, secret) {
  const [timestamp, receivedSignature] = signature.split('.');
  const payloadString = JSON.stringify(payload);
  const signaturePayload = `${timestamp}.${payloadString}`;
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signaturePayload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(receivedSignature),
    Buffer.from(expectedSignature),
  );
}

app.listen(3000);
```

### Flask (Python)
```python
from flask import Flask, request, jsonify
import hmac
import hashlib
import json

app = Flask(__name__)

@app.route('/webhook', methods=['POST'])
def webhook():
    signature = request.headers.get('X-Monte-Signature')
    payload = request.json
    
    if not verify_signature(payload, signature, app.config['WEBHOOK_SECRET']):
        return jsonify({'error': 'Invalid signature'}), 401
    
    # Process webhook
    print(f"Received webhook: {payload['eventType']}")
    
    return jsonify({'received': True})

def verify_signature(payload, signature, secret):
    timestamp, received_signature = signature.split('.')
    payload_string = json.dumps(payload)
    signature_payload = f"{timestamp}.{payload_string}"
    
    expected_signature = hmac.new(
        secret.encode(),
        signature_payload.encode(),
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(received_signature, expected_signature)

if __name__ == '__main__':
    app.run(port=3000)
```

## Support

For issues or questions about the webhook system, please refer to the main Monte documentation or contact support.
