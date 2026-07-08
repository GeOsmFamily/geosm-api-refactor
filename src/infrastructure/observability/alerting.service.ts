import os from 'os';
import { createChildLogger } from './logger.js';

export type AlertLevel = 'CRITICAL' | 'WARNING' | 'INFO';

interface AlertMetadata {
  [key: string]: unknown;
}

const alertLogger = createChildLogger('AlertingService');

export class AlertingService {
  private readonly slackWebhookUrl: string | undefined;
  private readonly alertEmailTo: string | undefined;
  private readonly emailService: {
    sendAlertEmail?: (to: string, subject: string, html: string) => Promise<void>;
  } | null;

  constructor(
    emailService?: {
      sendAlertEmail?: (to: string, subject: string, html: string) => Promise<void>;
    } | null,
  ) {
    this.slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    this.alertEmailTo = process.env.ALERT_EMAIL_TO;
    this.emailService = emailService ?? null;
  }

  async sendAlert(
    level: AlertLevel,
    title: string,
    message: string,
    metadata?: AlertMetadata,
  ): Promise<void> {
    const alertData = {
      level,
      title,
      message,
      metadata,
      timestamp: new Date().toISOString(),
      hostname: os.hostname(),
      environment: process.env.NODE_ENV || 'development',
    };

    // Always log
    const logMethod = level === 'CRITICAL' ? 'error' : level === 'WARNING' ? 'warn' : 'info';
    alertLogger[logMethod](`[ALERT:${level}] ${title}: ${message}`, metadata);

    if (level === 'INFO') return;

    // WARNING and CRITICAL: send to Slack
    if (this.slackWebhookUrl) {
      await this.sendSlackNotification(alertData);
    }

    // CRITICAL: also send email
    if (level === 'CRITICAL' && this.alertEmailTo && this.emailService?.sendAlertEmail) {
      try {
        const html = `<h2>[${level}] ${title}</h2><p>${message}</p><pre>${JSON.stringify(metadata, null, 2)}</pre><p><small>${alertData.timestamp} on ${alertData.hostname}</small></p>`;
        await this.emailService.sendAlertEmail(
          this.alertEmailTo,
          `[GeOSM ALERT - ${level}] ${title}`,
          html,
        );
      } catch (err) {
        alertLogger.error('Failed to send alert email', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  async alertOnHighErrorRate(threshold: number): Promise<void> {
    // This would be called periodically by a monitoring loop
    await this.sendAlert('WARNING', 'High Error Rate', `Error rate has exceeded ${threshold}%`, {
      threshold,
    });
  }

  async alertOnSlowQueries(thresholdMs: number): Promise<void> {
    await this.sendAlert(
      'WARNING',
      'Slow Database Queries Detected',
      `Queries exceeding ${thresholdMs}ms threshold`,
      { thresholdMs },
    );
  }

  async alertOnJobFailure(jobName: string, error: Error | string): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : error;
    await this.sendAlert(
      'CRITICAL',
      'Job Processing Failed',
      `Job "${jobName}" failed: ${errorMessage}`,
      {
        jobName,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      },
    );
  }

  async alertOnDiskSpace(thresholdPercent: number): Promise<void> {
    try {
      const { execSync } = await import('child_process');
      const output = execSync("df -h / | tail -1 | awk '{print $5}'").toString().trim();
      const usagePercent = parseInt(output.replace('%', ''), 10);
      if (usagePercent >= thresholdPercent) {
        await this.sendAlert(
          'WARNING',
          'Disk Space Alert',
          `Disk usage at ${usagePercent}% (threshold: ${thresholdPercent}%)`,
          {
            usagePercent,
            thresholdPercent,
          },
        );
      }
    } catch (err) {
      alertLogger.warn('Failed to check disk space', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async alertOnMemoryUsage(thresholdPercent: number): Promise<void> {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usagePercent = Math.round(((totalMem - freeMem) / totalMem) * 100);
    if (usagePercent >= thresholdPercent) {
      await this.sendAlert(
        'WARNING',
        'High Memory Usage',
        `Memory usage at ${usagePercent}% (threshold: ${thresholdPercent}%)`,
        {
          usagePercent,
          thresholdPercent,
          totalMem: Math.round(totalMem / 1024 / 1024),
          freeMem: Math.round(freeMem / 1024 / 1024),
        },
      );
    }
  }

  private async sendSlackNotification(alertData: {
    level: AlertLevel;
    title: string;
    message: string;
    metadata?: AlertMetadata;
    timestamp: string;
    hostname: string;
    environment: string;
  }): Promise<void> {
    if (!this.slackWebhookUrl) return;

    const color =
      alertData.level === 'CRITICAL'
        ? '#ff0000'
        : alertData.level === 'WARNING'
          ? '#ffaa00'
          : '#36a64f';
    const emoji =
      alertData.level === 'CRITICAL'
        ? ':rotating_light:'
        : alertData.level === 'WARNING'
          ? ':warning:'
          : ':information_source:';

    const payload = {
      attachments: [
        {
          color,
          title: `${emoji} [${alertData.level}] ${alertData.title}`,
          text: alertData.message,
          fields: [
            { title: 'Environment', value: alertData.environment, short: true },
            { title: 'Host', value: alertData.hostname, short: true },
          ],
          footer: 'GeOSM API Alerting',
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };

    try {
      const response = await fetch(this.slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        alertLogger.warn('Slack webhook returned non-OK status', { status: response.status });
      }
    } catch (err) {
      alertLogger.error('Failed to send Slack notification', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
