import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import axios, { AxiosError } from 'axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookDelivery, DeliveryStatus } from '../entities/webhook-delivery.entity';
import { Webhook } from '../entities/webhook.entity';
import { WebhookService } from './webhook.service';

@Processor('webhook-delivery')
export class WebhookProcessor {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(
    @InjectRepository(WebhookDelivery)
    private deliveryRepository: Repository<WebhookDelivery>,
    @InjectRepository(Webhook)
    private webhookRepository: Repository<Webhook>,
    private webhookService: WebhookService,
  ) {}

  @Process('deliver-webhook')
  async handleWebhookDelivery(job: Job<{
    deliveryId: string;
    webhookId: string;
    url: string;
    secret: string;
  }>) {
    const { deliveryId, webhookId, url, secret } = job.data;
    const startTime = Date.now();

    this.logger.log(`Processing webhook delivery ${deliveryId} to ${url}`);

    const delivery = await this.deliveryRepository.findOne({ where: { id: deliveryId } });
    if (!delivery) {
      this.logger.error(`Delivery ${deliveryId} not found`);
      throw new Error('Delivery not found');
    }

    delivery.attemptNumber = job.attemptsMade + 1;
    delivery.status = DeliveryStatus.RETRYING;
    await this.deliveryRepository.save(delivery);

    try {
      const payload = JSON.stringify(delivery.payload);
      const signature = this.webhookService.generateSignature(payload, secret);

      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Monte-Signature': signature,
          'X-Monte-Event': delivery.eventType,
          'X-Monte-Webhook-Id': webhookId,
          'X-Monte-Delivery-Id': deliveryId,
        },
        timeout: 30000,
      });

      const responseTime = Date.now() - startTime;

      delivery.status = DeliveryStatus.SUCCESS;
      delivery.statusCode = response.status;
      delivery.responseTime = responseTime;
      delivery.responseBody = JSON.stringify(response.data);
      delivery.deliveredAt = new Date();

      await this.deliveryRepository.save(delivery);

      // Update webhook success stats
      const webhook = await this.webhookRepository.findOne({ where: { id: webhookId } });
      if (webhook) {
        webhook.lastSuccessAt = new Date();
        webhook.failureCount = 0;
        await this.webhookRepository.save(webhook);
      }

      this.logger.log(`Webhook delivery ${deliveryId} succeeded (${responseTime}ms)`);
      return { success: true, statusCode: response.status, responseTime };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const axiosError = error as AxiosError;

      delivery.status = DeliveryStatus.FAILED;
      delivery.statusCode = axiosError.response?.status || 0;
      delivery.responseTime = responseTime;
      delivery.errorMessage = axiosError.message;
      delivery.responseBody = axiosError.response?.data 
        ? JSON.stringify(axiosError.response.data) 
        : null;

      // Update webhook failure stats
      const webhook = await this.webhookRepository.findOne({ where: { id: webhookId } });
      if (webhook) {
        webhook.lastFailureAt = new Date();
        webhook.failureCount += 1;

        // Auto-disable webhook after too many failures
        if (webhook.failureCount >= webhook.maxRetries * 2) {
          webhook.status = 'DISABLED' as any;
          this.logger.warn(`Webhook ${webhookId} auto-disabled due to excessive failures`);
        }
        await this.webhookRepository.save(webhook);
      }

      await this.deliveryRepository.save(delivery);

      this.logger.error(`Webhook delivery ${deliveryId} failed: ${axiosError.message}`);
      throw error;
    }
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.debug(`Processing webhook job ${job.id}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.debug(`Completed webhook job ${job.id}`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(`Failed webhook job ${job.id}: ${error.message}`);
  }
}
