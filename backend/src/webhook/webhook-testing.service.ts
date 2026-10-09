import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Webhook } from './entities/webhook.entity';
import { WebhookEvent, EventType } from './entities/webhook-event.entity';
import { WebhookDelivery } from './entities/webhook-delivery.entity';
import { WebhookDeliveryLog } from './entities/webhook-delivery-log.entity';
import { WebhookSignatureService } from './webhook-signature.service';

@Injectable()
export class WebhookTestingService {
  private readonly logger = new Logger(WebhookTestingService.name);

  constructor(
    @InjectRepository(Webhook)
    private webhookRepository: Repository<Webhook>,
    @InjectRepository(WebhookEvent)
    private webhookEventRepository: Repository<WebhookEvent>,
    @InjectRepository(WebhookDelivery)
    private webhookDeliveryRepository: Repository<WebhookDelivery>,
    @InjectRepository(WebhookDeliveryLog)
    private webhookDeliveryLogRepository: Repository<WebhookDeliveryLog>,
    private signatureService: WebhookSignatureService,
  ) {}

  async generateTestPayload(eventType: EventType, customData?: Record<string, any>): Promise<Record<string, any>> {
    const basePayload = {
      id: 'test_' + Date.now(),
      eventType,
      timestamp: new Date().toISOString(),
      test: true,
    };

    const eventSpecificPayloads: Record<EventType, Record<string, any>> = {
      [EventType.PAYMENT_CREATED]: {
        paymentId: 'pay_test_123',
        amount: 100.00,
        currency: 'USD',
        status: 'created',
        merchantId: 'merchant_test_123',
      },
      [EventType.PAYMENT_PAID]: {
        paymentId: 'pay_test_123',
        amount: 100.00,
        currency: 'USD',
        status: 'paid',
        paidAt: new Date().toISOString(),
      },
      [EventType.PAYMENT_FAILED]: {
        paymentId: 'pay_test_123',
        amount: 100.00,
        currency: 'USD',
        status: 'failed',
        failureReason: 'Insufficient funds',
        failedAt: new Date().toISOString(),
      },
      [EventType.PAYMENT_REFUNDED]: {
        paymentId: 'pay_test_123',
        refundId: 'ref_test_123',
        amount: 100.00,
        currency: 'USD',
        status: 'refunded',
        refundedAt: new Date().toISOString(),
      },
      [EventType.PAYMENT_SPLIT_CREATED]: {
        splitId: 'split_test_123',
        paymentId: 'pay_test_123',
        totalAmount: 100.00,
        currency: 'USD',
        recipients: [
          { address: 'addr1', percentage: 50 },
          { address: 'addr2', percentage: 50 },
        ],
      },
      [EventType.PAYMENT_SPLIT_COMPLETED]: {
        splitId: 'split_test_123',
        status: 'completed',
        completedAt: new Date().toISOString(),
      },
      [EventType.PAYMENT_SPLIT_FAILED]: {
        splitId: 'split_test_123',
        status: 'failed',
        failureReason: 'Network error',
        failedAt: new Date().toISOString(),
      },
      [EventType.DISPUTE_CREATED]: {
        disputeId: 'disp_test_123',
        paymentId: 'pay_test_123',
        reason: 'Product not received',
        status: 'opened',
        createdAt: new Date().toISOString(),
      },
      [EventType.DISPUTE_RESOLVED]: {
        disputeId: 'disp_test_123',
        status: 'resolved',
        resolution: 'Refund issued',
        resolvedAt: new Date().toISOString(),
      },
      [EventType.DISPUTE_CLOSED]: {
        disputeId: 'disp_test_123',
        status: 'closed',
        closedAt: new Date().toISOString(),
      },
      [EventType.REFUND_REQUESTED]: {
        refundId: 'ref_test_123',
        paymentId: 'pay_test_123',
        amount: 100.00,
        currency: 'USD',
        reason: 'Customer request',
        status: 'requested',
      },
      [EventType.REFUND_PROCESSED]: {
        refundId: 'ref_test_123',
        status: 'processed',
        processedAt: new Date().toISOString(),
      },
      [EventType.REFUND_FAILED]: {
        refundId: 'ref_test_123',
        status: 'failed',
        failureReason: 'Payment gateway error',
        failedAt: new Date().toISOString(),
      },
      [EventType.MERCHANT_CREATED]: {
        merchantId: 'merchant_test_123',
        businessName: 'Test Business',
        email: 'test@example.com',
        status: 'active',
      },
      [EventType.MERCHANT_UPDATED]: {
        merchantId: 'merchant_test_123',
        updatedFields: ['businessName', 'email'],
        updatedAt: new Date().toISOString(),
      },
      [EventType.ACCOUNT_VERIFIED]: {
        merchantId: 'merchant_test_123',
        verificationMethod: 'email',
        verifiedAt: new Date().toISOString(),
      },
    };

    return {
      ...basePayload,
      ...eventSpecificPayloads[eventType],
      ...customData,
    };
  }

  async validateWebhookEndpoint(webhookId: string): Promise<any> {
    const webhook = await this.webhookRepository.findOne({
      where: { webhookId },
    });

    if (!webhook) {
      return {
        valid: false,
        error: 'Webhook not found',
      };
    }

    const validationResults = {
      valid: true,
      checks: {
        url: this.validateUrl(webhook.url),
        events: this.validateEvents(webhook.events),
        secret: !!webhook.secret,
        status: webhook.status === 'ACTIVE',
        rateLimit: webhook.rateLimitPerMinute >= 0,
      },
      warnings: [] as string[],
    };

    if (!webhook.secret) {
      validationResults.warnings.push('No secret configured - signature verification disabled');
    }

    if (webhook.rateLimitPerMinute === 0) {
      validationResults.warnings.push('Rate limiting disabled - may lead to overwhelming endpoint');
    }

    if (!validationResults.checks.url) {
      validationResults.valid = false;
      validationResults.warnings.push('Invalid URL format');
    }

    if (!validationResults.checks.events) {
      validationResults.valid = false;
      validationResults.warnings.push('No events configured');
    }

    return validationResults;
  }

  async simulateWebhookDelivery(webhookId: string, eventType: EventType, customPayload?: Record<string, any>): Promise<any> {
    const webhook = await this.webhookRepository.findOne({
      where: { webhookId },
    });

    if (!webhook) {
      return {
        success: false,
        error: 'Webhook not found',
      };
    }

    const payload = await this.generateTestPayload(eventType, customPayload);
    const signature = this.signatureService.generateSignature(payload, webhook.secret || 'test_secret');

    return {
      success: true,
      webhookId,
      eventType,
      payload,
      signature,
      headers: this.buildTestHeaders(webhook, signature),
      timestamp: new Date().toISOString(),
    };
  }

  async getWebhookDebugInfo(webhookId: string): Promise<any> {
    const webhook = await this.webhookRepository.findOne({
      where: { webhookId },
    });

    if (!webhook) {
      return {
        error: 'Webhook not found',
      };
    }

    const recentEvents = await this.webhookEventRepository.find({
      where: { webhookId },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    const recentDeliveries = await this.webhookDeliveryRepository.find({
      where: { webhookId },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    const recentLogs = await this.webhookDeliveryLogRepository.find({
      where: { webhookId },
      order: { createdAt: 'DESC' },
      take: 20,
    });

    return {
      webhook: {
        webhookId: webhook.webhookId,
        url: webhook.url,
        status: webhook.status,
        events: webhook.events,
        maxRetries: webhook.maxRetries,
        timeout: webhook.timeout,
        rateLimitPerMinute: webhook.rateLimitPerMinute,
        testMode: webhook.testMode,
        successCount: webhook.successCount,
        failureCount: webhook.failureCount,
        lastSuccessAt: webhook.lastSuccessAt,
        lastFailureAt: webhook.lastFailureAt,
        lastTriggeredAt: webhook.lastTriggeredAt,
      },
      recentEvents,
      recentDeliveries,
      recentLogs,
      statistics: {
        totalEvents: recentEvents.length,
        totalDeliveries: recentDeliveries.length,
        totalLogs: recentLogs.length,
        successRate: webhook.successCount + webhook.failureCount > 0
          ? (webhook.successCount / (webhook.successCount + webhook.failureCount)) * 100
          : 0,
      },
    };
  }

  async troubleshootWebhook(webhookId: string): Promise<any> {
    const webhook = await this.webhookRepository.findOne({
      where: { webhookId },
    });

    if (!webhook) {
      return {
        error: 'Webhook not found',
      };
    }

    const issues = [];
    const recommendations = [];

    if (webhook.status !== 'ACTIVE') {
      issues.push('Webhook is not active');
      recommendations.push('Activate the webhook to start receiving events');
    }

    if (!webhook.events || webhook.events.length === 0) {
      issues.push('No events configured');
      recommendations.push('Add at least one event type to listen for');
    }

    if (!webhook.secret) {
      issues.push('No secret configured');
      recommendations.push('Configure a secret for signature verification');
    }

    if (webhook.failureCount > webhook.successCount && webhook.failureCount > 10) {
      issues.push('High failure rate detected');
      recommendations.push('Check webhook endpoint accessibility and response handling');
    }

    const recentFailures = await this.webhookEventRepository.find({
      where: { webhookId, deliveryStatus: 'FAILED' },
      order: { createdAt: 'DESC' },
      take: 5,
    });

    if (recentFailures.length > 0) {
      const commonErrors = this.analyzeCommonErrors(recentFailures);
      issues.push(`Recent failures: ${recentFailures.length}`);
      recommendations.push(...commonErrors);
    }

    return {
      webhookId,
      status: issues.length === 0 ? 'healthy' : 'needs_attention',
      issues,
      recommendations,
      recentFailures: recentFailures.slice(0, 3),
    };
  }

  private validateUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private validateEvents(events: string[]): boolean {
    return Array.isArray(events) && events.length > 0;
  }

  private buildTestHeaders(webhook: Webhook, signature: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'User-Agent': 'Monte-Webhook-Test/1.0',
      'X-Monte-Signature': signature,
      'X-Monte-Timestamp': Date.now().toString(),
      'X-Monte-Webhook-Id': webhook.webhookId,
      'X-Monte-Test': 'true',
    };
  }

  private analyzeCommonErrors(failures: WebhookEvent[]): string[] {
    const recommendations = [];
    const errorMessages = failures.map(f => f.errorMessage).filter(Boolean);

    if (errorMessages.some(e => e?.includes('timeout'))) {
      recommendations.push('Webhook endpoint is timing out - consider increasing timeout or optimizing endpoint');
    }

    if (errorMessages.some(e => e?.includes('ECONNREFUSED'))) {
      recommendations.push('Webhook endpoint is unreachable - check URL and server status');
    }

    if (errorMessages.some(e => e?.includes('404'))) {
      recommendations.push('Webhook endpoint returns 404 - verify endpoint URL is correct');
    }

    if (errorMessages.some(e => e?.includes('500'))) {
      recommendations.push('Webhook endpoint is returning server errors - check endpoint logs');
    }

    if (recommendations.length === 0) {
      recommendations.push('Review webhook endpoint logs for specific error details');
    }

    return recommendations;
  }
}
