import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class AuthMailService {
  private readonly logger = new Logger(AuthMailService.name);
  private readonly transporter: nodemailer.Transporter | null;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    this.from = this.configService.get<string>('SMTP_FROM') || 'noreply@monte.io';

    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<string>('SMTP_PORT');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    this.transporter = host
      ? nodemailer.createTransport({
          host,
          port: port ? parseInt(port, 10) : 587,
          secure: false,
          auth: user ? { user, pass } : undefined,
        })
      : null;
  }

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    const resetUrl = `${this.configService.get<string>('NEXT_PUBLIC_SITE_URL') || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    const subject = 'Reset your Monte password';
    const text = `We received a request to reset your password. This link expires in 1 hour:\n\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email.`;

    if (!this.transporter) {
      this.logger.warn(
        `SMTP is not configured. Password reset email for ${email} was not sent. Reset URL: ${resetUrl}`,
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: email,
        subject,
        text,
      });
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${email}: ${error.message}`);
    }
  }
}
