# Payment Split Management System

Complete payment split functionality for the Monte platform, enabling merchants to split payments across multiple recipients for marketplace scenarios, affiliate payouts, and revenue sharing.

## Overview

This system provides flexible payment splitting capabilities with support for percentage-based, fixed-amount, and milestone-based distributions. It includes comprehensive validation, atomic execution, retry logic, and notification systems.

## Features

### Smart Contract (Stellar/Soroban)
- **Payment Split Contract**: On-chain payment split management
- **Percentage Validation**: Ensures splits sum to 100%
- **Atomic Execution**: Prevents partial failures
- **Milestone Support**: Conditional splits based on milestones
- **Retry Logic**: Automatic retry for failed distributions
- **Gas Optimization**: Efficient on-chain operations

### Backend Services (NestJS)
- **Split Management**: Create, execute, and cancel payment splits
- **Distribution Tracking**: Monitor individual recipient distributions
- **Milestone Management**: Trigger and complete milestones
- **Refund Handling**: Partial payments and split refunds
- **Audit Trail**: Complete compliance logging
- **Notifications**: Multi-channel notification system

### Frontend UI (Next.js)
- **Split Dashboard**: Create and manage payment splits
- **Recipient Management**: Add/remove recipients with validation
- **Analytics Views**: Split metrics and breakdowns
- **Status Tracking**: Real-time split status updates

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Split Page   │  │ Analytics    │  │ Recipients   │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└───────────────────────────┬─────────────────────────────────┘
                            │ REST API
┌───────────────────────────┴─────────────────────────────────┐
│                  Backend (NestJS)                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │Split Service │  │Refund Service│  │Notification  │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │Distribution  │  │Milestone     │  │Audit Service │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────────┐
│              Database (PostgreSQL)                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │ Splits   │ │Distribs  │ │Milestones│ │Audit     │        │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘        │
└───────────────────────────┬─────────────────────────────────┘
                            │ Stellar Network
┌───────────────────────────┴─────────────────────────────────┐
│              Smart Contracts (Soroban)                        │
│  ┌──────────────────────────────────────────┐                │
│  │     Payment Split Contract             │                │
│  │  - Percentage validation                │                │
│  │  - Atomic distribution                 │                │
│  │  - Milestone tracking                  │                │
│  │  - Retry logic                         │                │
│  └──────────────────────────────────────────┘                │
└───────────────────────────────────────────────────────────────┘
```

## Setup Instructions

### Prerequisites

- Node.js >= 18
- PostgreSQL >= 14
- Rust (for smart contract compilation)
- Soroban CLI

### Backend Setup

```bash
cd backend
npm install
```

Configure environment variables in `.env`:

```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password
DATABASE_NAME=monte
NODE_ENV=development
PORT=4000
```

Run database migrations:

```bash
npm run migration:run
```

Start the backend server:

```bash
npm run start:dev
```

### Frontend Setup

```bash
cd frontend
npm install
```

Configure environment variables in `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Start the frontend development server:

```bash
npm run dev
```

### Smart Contract Setup

```bash
cd smartcontracts/contracts/payment_split_contract
cargo build --target wasm32-unknown-unknown --release
```

Deploy to testnet:

```bash
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/payment_split_contract.wasm \
  --source <YOUR_SECRET_KEY> \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015"
```

## API Endpoints

### Payment Splits

- `POST /api/payment-splits` - Create a new payment split
- `POST /api/payment-splits/:splitId/execute` - Execute a pending split
- `POST /api/payment-splits/:splitId/cancel` - Cancel a split
- `POST /api/payment-splits/:splitId/retry` - Retry failed distributions
- `GET /api/payment-splits/:splitId` - Get split details
- `GET /api/payment-splits/:splitId/audit` - Get split audit trail

### Distributions

- `POST /api/payment-splits/distribute` - Distribute to a recipient
- `POST /api/payment-splits/distributions/:distributionId/confirm` - Confirm distribution
- `POST /api/payment-splits/distributions/:distributionId/fail` - Mark distribution as failed

### Milestones

- `POST /api/payment-splits/:splitId/milestones/trigger` - Trigger a milestone
- `POST /api/payment-splits/:splitId/milestones/:milestoneId/complete` - Complete a milestone

### Analytics

- `GET /api/payment-splits/analytics/summary` - Split analytics

## Data Models

### Split Status Flow

```
PENDING → EXECUTING → COMPLETED
                    ↘ PARTIALLY_COMPLETED → COMPLETED
                    ↘ FAILED → RETRY → EXECUTING
PENDING → CANCELLED
```

### Milestone Status Flow

```
PENDING → TRIGGERED → COMPLETED
         ↘ SKIPPED
```

### Split Types

- **PERCENTAGE**: Split based on percentage amounts (must sum to 100%)
- **FIXED_AMOUNT**: Split based on fixed amounts
- **MILESTONE**: Split based on milestone completion

### Validation Rules

- Maximum 50 recipients per split
- Percentages must sum to exactly 100%
- Fixed amounts must be positive
- Minimum percentage: 1%
- Maximum percentage: 100%
- Maximum retry attempts: 3

## Configuration

### Split Configuration

Default configuration can be set via smart contract:

```typescript
{
  maxRecipients: 50,
  maxRetries: 3,
  minSplitPercentage: 1,
  maxSplitPercentage: 100,
  requireMerchantApproval: true,
  enableAutoRetry: true,
}
```

### Notification Preferences

Users can configure notification channels:

```typescript
{
  email: true,
  sms: false,
  webhook: "https://your-webhook-url",
  inApp: true,
}
```

## Usage Examples

### Create a Percentage-Based Split

```typescript
const split = await paymentSplitService.createSplit({
  paymentId: "PAY_123",
  merchantAddress: "merchant_address",
  totalAmount: 1000,
  currency: "USDC",
  splitType: "PERCENTAGE",
  recipients: [
    { address: "recipient1", percentage: 60 },
    { address: "recipient2", percentage: 40 },
  ],
}, "user_id", "merchant");
```

### Create a Milestone-Based Split

```typescript
const split = await paymentSplitService.createSplit({
  paymentId: "PAY_456",
  merchantAddress: "merchant_address",
  totalAmount: 5000,
  currency: "USDC",
  splitType: "MILESTONE",
  recipients: [
    { address: "affiliate1", percentage: 30 },
    { address: "affiliate2", percentage: 20 },
  ],
  milestones: [
    {
      milestoneId: "M1",
      description: "Product Delivery",
      triggerCondition: "delivery_confirmed",
      requiredAmount: 1500,
    },
    {
      milestoneId: "M2",
      description: "Customer Acceptance",
      triggerCondition: "acceptance_confirmed",
      requiredAmount: 2000,
    },
  ],
}, "user_id", "merchant");
```

### Handle Partial Payment

```typescript
const updatedSplit = await refundService.handlePartialPayment(
  "SPLIT_789",
  500, // Partial amount
  "user_id",
  "merchant"
);
```

### Refund a Split

```typescript
const refundedSplit = await refundService.refundSplit(
  "SPLIT_789",
  500,
  "Customer request",
  "user_id",
  "merchant"
);
```

## Testing

### Backend Tests

```bash
cd backend
npm test
```

### Smart Contract Tests

```bash
cd smartcontracts/contracts/payment_split_contract
cargo test
```

### Frontend Tests

```bash
cd frontend
npm test
```

## Security Considerations

1. **Authentication**: All API endpoints require authentication
2. **Authorization**: Merchants can only manage their own splits
3. **Audit Trail**: All actions are logged for compliance
4. **Atomic Execution**: Splits execute atomically to prevent partial failures
5. **Input Validation**: All inputs are validated using class-validator
6. **Rate Limiting**: API endpoints are rate-limited

## Compliance Features

- **Audit Trail**: Complete logging of all split actions
- **Data Retention**: Configurable data retention policies
- **Export**: CSV export for accounting reconciliation
- **Timestamps**: All records include creation and update timestamps
- **User Tracking**: All actions track who performed them

## Monitoring

### Key Metrics to Monitor

- Split success rate
- Average split execution time
- Distribution failure rate
- Milestone completion rate
- Notification delivery rate

### Alerts

- High split failure rate (> 5%)
- Distributions nearing retry limit
- Milestone delays
- Unusual split patterns

## Troubleshooting

### Common Issues

**Split stuck in PENDING status**
- Check if merchant has sufficient balance
- Verify all recipient addresses are valid
- Check Stellar network status

**Distribution failures**
- Verify recipient wallet addresses
- Check network connectivity
- Review retry count and max retries

**Milestone not triggering**
- Verify trigger condition matches
- Check milestone configuration
- Review merchant permissions

## Gas Optimization

The smart contract implements several gas optimization strategies:

- **Batch Operations**: Multiple distributions in single transaction
- **Efficient Storage**: Minimal on-chain data storage
- **Event Logging**: Off-chain logging where possible
- **Conditional Execution**: Skip unnecessary operations

## Future Enhancements

- [ ] Multi-currency split support
- [ ] Advanced fraud detection for splits
- [ ] Machine learning for split optimization
- [ ] Integration with additional payment processors
- [ ] Mobile app support
- [ ] Real-time notifications via WebSocket
- [ ] Advanced reporting with charts
- [ ] Bulk split processing
- [ ] Automated split scheduling
- [ ] Integration with accounting systems

## Support

For issues or questions:
- GitHub Issues: [repository URL]
- Documentation: [docs URL]
- Email: support@monte.io
