import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { IEmailService } from '../../application/services/email.service.js';
import { config } from '../../config/env.config.js';
import { logger } from '../observability/logger.js';
import { emailSentTotal, emailFailedTotal } from '../observability/metrics.js';

export class SmtpEmailService implements IEmailService {
  private transporter: Transporter | null = null;
  private readonly from: string;
  private readonly appUrl: string;

  constructor() {
    this.from = config.SMTP_FROM;
    this.appUrl = config.APP_URL;

    if (config.SMTP_HOST && config.SMTP_USER) {
      this.transporter = nodemailer.createTransport({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        secure: config.SMTP_PORT === 465,
        auth: {
          user: config.SMTP_USER,
          pass: config.SMTP_PASS,
        },
      });
      logger.info('SMTP email service initialized', { host: config.SMTP_HOST, port: config.SMTP_PORT });
    } else {
      logger.warn('SMTP not configured — emails will be logged only');
    }
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.transporter) {
      logger.info('Email (no SMTP)', { to, subject });
      return;
    }
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
      emailSentTotal.inc();
      logger.info('Email sent', { to, subject });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      emailFailedTotal.inc();
      logger.error('Failed to send email', { to, subject, error: msg });
    }
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const link = `${this.appUrl}/verify-email?token=${token}`;
    await this.send(
      email,
      'Verify your email - GeOSM',
      `<h2>Email Verification</h2><p>Click the link below to verify your email address:</p><p><a href="${link}">${link}</a></p><p>This link expires in 24 hours.</p>`,
    );
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const link = `${this.appUrl}/reset-password?token=${token}`;
    await this.send(
      email,
      'Reset your password - GeOSM',
      `<h2>Password Reset</h2><p>Click the link below to reset your password:</p><p><a href="${link}">${link}</a></p><p>This link expires in 1 hour.</p>`,
    );
  }

  async sendWelcomeEmail(email: string, firstName: string): Promise<void> {
    await this.send(
      email,
      'Welcome to GeOSM',
      `<h2>Welcome, ${firstName}!</h2><p>Your account has been created successfully. You can now log in at <a href="${this.appUrl}">${this.appUrl}</a>.</p>`,
    );
  }
}
