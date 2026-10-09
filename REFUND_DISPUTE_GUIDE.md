# Refund and Dispute Management System

Complete refund and dispute management functionality for the Monte payment platform.

## Overview

This system provides comprehensive tools for handling customer returns, payment conflicts, and chargeback management with full audit trails and analytics.

## Features

### Smart Contract (Stellar/Soroban)
- **Refund Contract**: On-chain refund processing with policy enforcement
- **Fee Calculation**: Automated processing fees based on configurable policies
- **Time Window Validation**: Enforces refund deadlines
- **Dispute Tracking**: On-chain dispute records with evidence links

### Backend Services (NestJS)
- **Refund Management**: Create, process, and reverse refunds
- **Dispute Resolution**: Full workflow from creation to resolution
- **Evidence Collection**: Upload and manage dispute evidence
- **Automated Templates**: Pre-built response templates for common scenarios
- **Analytics & Reporting**: Comprehensive metrics and reconciliation
- **Audit Trail**: Complete compliance logging

### Frontend UI (Next.js)
- **Refund Dashboard**: Process and track all refunds
- **Dispute Management**: Handle disputes with evidence upload
- **Analytics Views**: Real-time metrics and breakdowns
- **Filtering & Search**: Advanced filtering capabilities

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Refund Page  │  │ Dispute Page │  │ Analytics    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└───────────────────────────┬─────────────────────────────────┘
                            │ REST API
┌───────────────────────────┴─────────────────────────────────┐
│                  Backend (NestJS)                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │Refund Service│  │Dispute Service│  │Template Service│     │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │Reconciliation│  │Audit Service │  │Analytics     │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────────┐
│              Database (PostgreSQL)                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │ Refunds  │ │Disputes  │ │Evidence  │ │Audit     │        │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘        │
└───────────────────────────┬─────────────────────────────────┘
                            │ Stellar Network
┌───────────────────────────┴─────────────────────────────────┐
│              Smart Contracts (Soroban)                        │
│  ┌──────────────────────────────────────────┐                │
│  │     Refund Contract                      │                │
│  │  - Fee calculation                       │                │
│  │  - Time window validation                 │                │
│  │  - Dispute tracking                      │                │
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
cd smartcontracts/contracts/refund_contract
cargo build --target wasm32-unknown-unknown --release
```

Deploy to testnet:

```bash
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/refund_contract.wasm \
  --source <YOUR_SECRET_KEY> \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015"
```

## API Endpoints

### Refunds

- `POST /api/refunds` - Create a new refund
- `POST /api/refunds/:id/process` - Process a pending refund
- `POST /api/refunds/:id/fail` - Mark refund as failed
- `POST /api/refunds/:id/reverse` - Reverse a completed refund
- `GET /api/refunds/:id` - Get refund details
- `GET /api/refunds` - List refunds with filters
- `GET /api/refunds/:id/audit` - Get refund audit trail

### Disputes

- `POST /api/disputes` - Create a new dispute
- `PUT /api/disputes/:id` - Update dispute status
- `GET /api/disputes/:id` - Get dispute details
- `GET /api/disputes` - List disputes with filters
- `POST /api/disputes/:id/evidence` - Upload evidence
- `GET /api/disputes/:id/evidence` - Get dispute evidence
- `GET /api/disputes/:id/audit` - Get dispute audit trail

### Analytics

- `GET /api/analytics/refunds` - Refund analytics
- `GET /api/analytics/disputes` - Dispute analytics

## Data Models

### Refund Status Flow

```
PENDING → PROCESSING → COMPLETED
                    ↘ FAILED
COMPLETED → REVERSED
```

### Dispute Status Flow

```
OPEN → UNDER_REVIEW → EVIDENCE_REQUIRED → RESPONDING → WON/LOST → CLOSED
```

### Refund Reasons

- `CUSTOMER_REQUEST` - Customer initiated refund
- `PRODUCT_NOT_RECEIVED` - Product not delivered
- `PRODUCT_DEFECTIVE` - Defective product
- `WRONG_ITEM` - Wrong item sent
- `DUPLICATE_PAYMENT` - Duplicate charge
- `FRAUDULENT` - Fraudulent transaction
- `OTHER` - Other reasons

### Dispute Reasons

- `PRODUCT_NOT_RECEIVED` - Product not delivered
- `PRODUCT_NOT_AS_DESCRIBED` - Product doesn't match description
- `UNAUTHORIZED_TRANSACTION` - Unauthorized charge
- `DUPLICATE_CHARGE` - Duplicate transaction
- `CREDIT_NOT_PROCESSED` - Refund not processed
- `OTHER` - Other reasons

## Configuration

### Refund Policies

Configure default refund policies per merchant:

```typescript
{
  refundWindowDays: 30,           // Days to request refund
  processingFeePercentage: 5,    // Fee percentage
  minimumFee: 100,               // Minimum fee in smallest unit
  autoApproveThreshold: 1000,    // Auto-approve under this amount
  disputeResponseDays: 14,       // Days to respond to disputes
  chargebackResponseDays: 90,    // Days to respond to chargebacks
  requireApproval: false,        // Require manual approval
  autoProcess: true              // Auto-process eligible refunds
}
```

## Testing

### Backend Tests

```bash
cd backend
npm test
```

### Smart Contract Tests

```bash
cd smartcontracts/contracts/refund_contract
cargo test
```

### Frontend Tests

```bash
cd frontend
npm test
```

## Security Considerations

1. **Authentication**: All API endpoints require JWT authentication
2. **Authorization**: Merchants can only access their own refunds/disputes
3. **Audit Trail**: All actions are logged for compliance
4. **Rate Limiting**: API endpoints are rate-limited
5. **Input Validation**: All inputs are validated using class-validator
6. **SQL Injection**: Protected via TypeORM parameterized queries

## Compliance Features

- **Audit Trail**: Complete logging of all refund/dispute actions
- **Data Retention**: Configurable data retention policies
- **Export**: CSV export for accounting reconciliation
- **Timestamps**: All records include creation and update timestamps
- **User Tracking**: All actions track who performed them

## Monitoring

### Key Metrics to Monitor

- Refund rate (refunds / total transactions)
- Average refund processing time
- Dispute win rate
- Chargeback rate
- Fee revenue from refunds

### Alerts

- High refund rate (> 5%)
- Disputes nearing deadline
- Failed refund transactions
- Unusual refund patterns

## Troubleshooting

### Common Issues

**Refund stuck in PENDING status**
- Check if refund window has expired
- Verify merchant has sufficient balance
- Check Stellar network status

**Dispute evidence not uploading**
- Verify file size limits
- Check storage service connectivity
- Ensure file format is supported

**Reconciliation mismatches**
- Verify payment processor API credentials
- Check transaction ID matching logic
- Review timezone handling

## Future Enhancements

- [ ] Multi-currency refund support
- [ ] Advanced fraud detection
- [ ] Machine learning for dispute prediction
- [ ] Integration with additional payment processors
- [ ] Mobile app support
- [ ] Real-time notifications via WebSocket
- [ ] Advanced reporting with charts
- [ ] Bulk refund processing
- [ ] Automated chargeback response
- [ ] Integration with accounting systems

## Support

For issues or questions:
- GitHub Issues: [repository URL]
- Documentation: [docs URL]
- Email: support@monte.io
