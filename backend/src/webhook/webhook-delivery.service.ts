import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { Webhook } from './entities/webhook.entity';
import { WebhookDelivery, DeliveryStatus } from './entities/webhook-delivery.entity';
import { WebhookDeliveryLog } from './entities/webhook-delivery-log.entity';
import { WebhookSignatureService } from './webhook-signature.service';

@Injectable()
export class WebhookDeliveryService {
  private readonly logger = new Logger(WebhookDeliveryService.name);
  private readonly rateLimitMap = new Map<string, { count: number; resetTime: number }>();

  constructor(
    @InjectRepository(WebhookDelivery)
    private webhookDeliveryRepository: Repository<WebhookDelivery>,
    @InjectRepository(WebhookDeliveryLog)
    private webhookDeliveryLogRepository: Repository<WebhookDeliveryLog>,
    private httpService: HttpService,
    private signatureService: WebhookSignatureService,
  ) {}

  async deliverWebhook(
    webhook: Webhook,
    payload: Record<string, any>,
    signature: string,
    isTest = false,
  ): Promise<WebhookDelivery> {
    const delivery = this.webhookDeliveryRepository.create({
      deliveryId: uuidv4(),
      webhookId: webhook.webhookId,
      url: webhook.url,
      status: DeliveryStatus.PENDING,
      requestPayload: payload,
      attemptNumber: 1,
    });

    await this.webhookDeliveryRepository.save(delivery);

    await this.logDelivery(delivery.deliveryId, webhook.webhookId, 'INFO', 'Delivery started', {
      url: webhook.url,
      isTest,
    });

    try {
      if (!this.checkRateLimit(webhook.webhookId, webhook.rateLimitPerMinute)) {
        throw new Error('Rate limit exceeded');
      }

      const startTime = Date.now();
      const headers = this.buildHeaders(webhook, signature);

      const response = await firstValueFrom(
        this.httpService.post(webhook.url, payload, {
          headers,
          timeout: webhook.timeout,
          validateStatus: () => true,
        }),
      );

      const responseTime = Date.now() - startTime;

      delivery.responseStatusCode = response.status;
      delivery.responseBody = typeof response.data === 'string' 
        ? response.data 
        : JSON.stringify(response.data);
      delivery.responseTime = responseTime;

      if (response.status >= 200 && response.status < 300) {
        delivery.status = DeliveryStatus.SUCCESS;
        delivery.deliveredAt = new Date();

        webhook.successCount++;
        webhook.lastSuccessAt = new Date();

        await this.logDelivery(
          delivery.deliveryId,
          webhook.webhookId,
          'INFO',
          'Delivery successful',
          {
            statusCode: response.status,
            responseTime,
          },
        );
      } else {
        delivery.status = DeliveryStatus.FAILED;
        delivery.errorMessage = `HTTP ${response.status}: ${response.statusText}`;

        webhook.failureCount++;
        webhook.lastFailureAt = new Date();

        await this.logDelivery(
          delivery.deliveryId,
          webhook.webhookId,
          'ERROR',
          'Delivery failed',
          {
            statusCode: response.status,
            error: delivery.errorMessage,
            responseTime,
          },
        );
      }

      await this.webhookDeliveryRepository.save(delivery);

      return delivery;
    } catch (error) {
      delivery.status = DeliveryStatus.FAILED;
      delivery.errorMessage = error.message;
      delivery.responseTime = Date.now() - Date.now();

      webhook.failureCount++;
      webhook.lastFailureAt = new Date();

      await this.logDelivery(
        delivery.deliveryId,
        webhook.webhookId,
        'ERROR',
        'Delivery error',
        {
          error: error.message,
          stack: error.stack,
        },
      );

      await this.webhookDeliveryRepository.save(delivery);

      throw error;
    }
  }

  async retryDelivery(delivery: WebhookDelivery, webhook: Webhook): Promise<WebhookDelivery> {
    const newDelivery = this.webhookDeliveryRepository.create({
      deliveryId: uuidv4(),
      eventId: delivery.eventId,
      webhookId: webhook.webhookId,
      url: webhook.url,
      status: DeliveryStatus.RETRYING,
      requestPayload: delivery.requestPayload,
      attemptNumber: delivery.attemptNumber + 1,
    });

    await this.webhookDeliveryRepository.save(newDelivery);

    await this.logDelivery(
      newDelivery.deliveryId,
      webhook.webhookId,
      'INFO',
      'Retry delivery started',
      {
        attemptNumber: newDelivery.attemptNumber,
        originalDeliveryId: delivery.deliveryId,
      },
    );

    try {
      const signature = this.signatureService.generateSignature(
        newDelivery.requestPayload,
        webhook.secret,
      );

      const result = await this.deliverWebhook(
        webhook,
        newDelivery.requestPayload,
        signature,
        false,
      );

      return result;
    } catch (error) {
      newDelivery.status = DeliveryStatus.FAILED;
      newDelivery.errorMessage = error.message;
      await this.webhookDeliveryRepository.save(newDelivery);
      throw error;
    }
  }

  private buildHeaders(webhook: Webhook, signature: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Monte-Webhook/1.0',
      'X-Monte-Signature': signature,
      'X-Monte-Timestamp': Date.now().toString(),
      'X-Monte-Webhook-Id': webhook.webhookId,
    };

    if (webhook.headers) {
      Object.assign(headers, webhook.headers);
    }

    return headers;
  }

  private checkRateLimit(webhookId: string, limitPerMinute: number): boolean {
    if (limitPerMinute === 0) {
      return true;
    }

    const now = Date.now();
    const windowStart = now - 60000;

    let rateData = this.rateLimitMap.get(webhookId);

    if (!rateData || rateData.resetTime < now) {
      rateData = { count: 0, resetTime: now + 60000 };
      this.rateLimitMap.set(webhookId, rateData);
    }

    if (rateData.count >= limitPerMinute) {
      this.logger.warn(`Rate limit exceeded for webhook ${webhookId}`);
      return false;
    }

    rateData.count++;
    return true;
  }

  private async logDelivery(
    deliveryId: string,
    webhookId: string,
    logType: string,
    message: string,
    details?: Record<string, any>,
  ): Promise<void> {
    const log = this.webhookDeliveryLogRepository.create({
      deliveryId,
      webhookId,
      logType,
      message,
      details,
    });

    await this.webhookDeliveryLogRepository.save(log);
  }

  async moveToDeadLetter(delivery: WebhookDelivery): Promise<void> {
    delivery.status = DeliveryStatus.DEAD_LETTER;
    await this.webhookDeliveryRepository.save(delivery);

    await this.logDelivery(
      delivery.deliveryId,
      delivery.webhookId,
      'ERROR',
      'Moved to dead letter queue',
      {
        attemptNumber: delivery.attemptNumber,
        errorMessage: delivery.errorMessage,
      },
    );
  }
}
