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
    // CORS_ORIGIN (pas APP_URL, qui pointe vers l'API elle-même - voir app.config.ts) est
    // l'origine publique du frontend, déjà utilisée pour ça par les redirections OSM OAuth
    // (auth.routes.ts) - les liens de vérification/réinitialisation doivent pointer là, pas
    // vers l'API qui ne sert aucune page pour ces routes.
    this.appUrl = config.CORS_ORIGIN;

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
      logger.info('SMTP email service initialized', {
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
      });
    } else {
      logger.warn('SMTP not configured — emails will be logged only');
    }
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.transporter) {
      // Sans SMTP configuré (dev/démo), le corps complet (donc le lien de vérification/reset)
      // est loggé - seul moyen de tester ces parcours sans serveur mail réel ; logger juste
      // to/subject rendait le flux invérifiable.
      logger.info('Email (no SMTP) - contenu complet ci-dessous', { to, subject, html });
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

  async sendAlertEmail(email: string, subject: string, html: string): Promise<void> {
    await this.send(email, subject, html);
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

  async sendOsmImportReportEmail(
    email: string,
    report: import('../../application/services/email.service.js').OsmImportReportData,
  ): Promise<void> {
    const pointsDiff = report.pointsAfter - report.pointsBefore;
    const polygonsDiff = report.polygonsAfter - report.polygonsBefore;
    const linesDiff = report.linesAfter - report.linesBefore;

    const formatDiff = (val: number) => (val >= 0 ? `+${val}` : `${val}`);

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #1a73e8;">🌐 GeOSM — Rapport de mise à jour des données OSM</h2>
        <p>L'importation et la synchronisation des données OpenStreetMap sont terminées avec succès.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <tr style="background: #f5f5f5;"><td style="padding: 10px; font-weight: bold;">Source PBF :</td><td style="padding: 10px;">${report.pbfPath}</td></tr>
          <tr><td style="padding: 10px; font-weight: bold;">Durée du traitement :</td><td style="padding: 10px;">${report.durationSeconds} secondes</td></tr>
          <tr style="background: #f5f5f5;"><td style="padding: 10px; font-weight: bold;">Limites administratives extraites :</td><td style="padding: 10px;">${report.extractedBoundariesCount} communes / zones</td></tr>
        </table>

        <h3 style="margin-top: 20px; color: #202124;">📊 Évolution des objets spatiaux en base (PostGIS)</h3>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd; text-align: left;">
          <thead>
            <tr style="background: #1a73e8; color: white;">
              <th style="padding: 10px;">Type d'objet</th>
              <th style="padding: 10px;">Avant import</th>
              <th style="padding: 10px;">Après import</th>
              <th style="padding: 10px;">Changement</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;">📍 Points (POI / Équipements)</td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;">${report.pointsBefore}</td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;">${report.pointsAfter}</td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold; color: ${pointsDiff >= 0 ? '#2e7d32' : '#c62828'};">${formatDiff(pointsDiff)}</td>
            </tr>
            <tr style="background: #f9f9f9;">
              <td style="padding: 10px; border-bottom: 1px solid #ddd;">🔷 Polygones (Bâtiments, Villes)</td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;">${report.polygonsBefore}</td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;">${report.polygonsAfter}</td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold; color: ${polygonsDiff >= 0 ? '#2e7d32' : '#c62828'};">${formatDiff(polygonsDiff)}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;">🛣️ Lignes (Routes, Rivières)</td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;">${report.linesBefore}</td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;">${report.linesAfter}</td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold; color: ${linesDiff >= 0 ? '#2e7d32' : '#c62828'};">${formatDiff(linesDiff)}</td>
            </tr>
          </tbody>
        </table>

        <p style="margin-top: 20px; font-size: 12px; color: #777;">
          Ce rapport est généré automatiquement par l'instance GeOSM après chaque mise à jour OSM.
        </p>
      </div>
    `;

    await this.send(email, `[GeOSM] Rapport de mise à jour OSM — ${report.pbfPath}`, html);
  }

  async sendBackupReportEmail(
    email: string,
    report: import('../../application/services/email.service.js').BackupReportData,
  ): Promise<void> {
    const sizeMb = (report.sizeBytes / (1024 * 1024)).toFixed(2);
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #2e7d32;">💾 GeOSM — Rapport de sauvegarde PostgreSQL</h2>
        <p>La sauvegarde de la base de données s'est terminée avec succès.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <tr style="background: #f5f5f5;"><td style="padding: 10px; font-weight: bold;">Clé de sauvegarde :</td><td style="padding: 10px;">${report.key}</td></tr>
          <tr><td style="padding: 10px; font-weight: bold;">Taille du fichier :</td><td style="padding: 10px;">${sizeMb} Mo (${report.sizeBytes} octets)</td></tr>
          <tr style="background: #f5f5f5;"><td style="padding: 10px; font-weight: bold;">Nettoyage de rétention :</td><td style="padding: 10px;">${report.deletedOldBackups} ancienne(s) sauvegarde(s) supprimée(s)</td></tr>
        </table>
      </div>
    `;
    await this.send(email, `[GeOSM] Sauvegarde PostgreSQL réussie (${sizeMb} Mo)`, html);
  }

  async sendRoleAssignmentEmail(
    email: string,
    data: import('../../application/services/email.service.js').RoleAssignmentData,
  ): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #1a73e8;">👤 GeOSM — Modification de votre rôle utilisateur</h2>
        <p>Bonjour <strong>${data.userName}</strong>,</p>
        <p>Votre rôle dans l'application GeOSM a été mis à jour par l'administrateur (<strong>${data.assignedBy}</strong>).</p>
        <p>Nouveau rôle attribué : <strong style="color: #1565c0;">${data.newRole}</strong></p>
        <p>Vous pouvez vous connecter à la plateforme pour accéder à vos nouvelles fonctionnalités : <a href="${this.appUrl}">${this.appUrl}</a></p>
      </div>
    `;
    await this.send(email, `[GeOSM] Mise à jour de votre rôle utilisateur (${data.newRole})`, html);
  }

  async sendFeedbackNotificationEmail(
    email: string,
    data: import('../../application/services/email.service.js').FeedbackNotificationData,
  ): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #e65100;">💬 GeOSM — Nouveau signalement / commentaire citoyen</h2>
        <p>Un utilisateur (<strong>${data.userEmail}</strong>) a transmis une remarque sur le géoportail${data.instanceName ? ` (Instance: ${data.instanceName})` : ''} :</p>
        <div style="background: #fff3e0; border-left: 4px solid #ff9800; padding: 12px; margin: 15px 0;">
          <p><strong>Catégorie :</strong> ${data.category}</p>
          <p><strong>Message :</strong> ${data.comment}</p>
        </div>
      </div>
    `;
    await this.send(email, `[GeOSM] Nouveau signalement citoyen — ${data.category}`, html);
  }

  async sendMonthlyReportEmail(
    email: string,
    report: import('../../application/services/email.service.js').ActivityReportData,
  ): Promise<void> {
    const storageMb = (report.storageSizeBytes / (1024 * 1024)).toFixed(2);
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #1a73e8;">📊 GeOSM — Rapport d'activité mensuel (${report.periodTitle})</h2>
        <p>Voici le bilan d'activité et de santé de la plateforme GeOSM pour ce mois-ci :</p>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; border: 1px solid #e0e0e0;">
          <tr style="background: #f5f5f5;"><td style="padding: 10px; font-weight: bold;">🌍 Instances actives :</td><td style="padding: 10px;">${report.activeInstancesCount} instance(s)</td></tr>
          <tr><td style="padding: 10px; font-weight: bold;">🗺️ Couches cartographiques :</td><td style="padding: 10px;">${report.totalLayersCount} couche(s) configurée(s)</td></tr>
          <tr style="background: #f5f5f5;"><td style="padding: 10px; font-weight: bold;">👥 Utilisateurs inscrits :</td><td style="padding: 10px;">${report.totalUsersCount} au total (${report.newUsersInPeriod} nouveau(x) ce mois-ci)</td></tr>
          <tr><td style="padding: 10px; font-weight: bold;">📥 Exportations réalisées :</td><td style="padding: 10px;">${report.totalExportsInPeriod} fichier(s) généré(s)</td></tr>
          <tr style="background: #f5f5f5;"><td style="padding: 10px; font-weight: bold;">💾 Volume de stockage MinIO :</td><td style="padding: 10px;">${storageMb} Mo occupés</td></tr>
          <tr><td style="padding: 10px; font-weight: bold;">🩺 Santé des services :</td><td style="padding: 10px; font-weight: bold; color: #2e7d32;">${report.systemStatus}</td></tr>
        </table>
        
        <p style="margin-top: 20px; font-size: 12px; color: #777;">
          Ce rapport est généré automatiquement le 1er de chaque mois.
        </p>
      </div>
    `;
    await this.send(email, `[GeOSM] Rapport d'activité mensuel — ${report.periodTitle}`, html);
  }

  async sendWeeklyReportEmail(
    email: string,
    report: import('../../application/services/email.service.js').ActivityReportData,
  ): Promise<void> {
    const storageMb = (report.storageSizeBytes / (1024 * 1024)).toFixed(2);
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #00897b;">📅 GeOSM — Rapport d'activité hebdomadaire (${report.periodTitle})</h2>
        <p>Voici le récapitulatif hebdomadaire de la plateforme GeOSM :</p>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; border: 1px solid #e0e0e0;">
          <tr style="background: #f5f5f5;"><td style="padding: 10px; font-weight: bold;">🌍 Instances actives :</td><td style="padding: 10px;">${report.activeInstancesCount} instance(s)</td></tr>
          <tr><td style="padding: 10px; font-weight: bold;">🗺️ Couches cartographiques :</td><td style="padding: 10px;">${report.totalLayersCount} couche(s) configurée(s)</td></tr>
          <tr style="background: #f5f5f5;"><td style="padding: 10px; font-weight: bold;">👥 Nouveaux utilisateurs cette semaine :</td><td style="padding: 10px;">+${report.newUsersInPeriod} (Total: ${report.totalUsersCount})</td></tr>
          <tr><td style="padding: 10px; font-weight: bold;">📥 Exportations cette semaine :</td><td style="padding: 10px;">${report.totalExportsInPeriod} fichier(s) généré(s)</td></tr>
          <tr style="background: #f5f5f5;"><td style="padding: 10px; font-weight: bold;">💾 Volume de stockage MinIO :</td><td style="padding: 10px;">${storageMb} Mo occupés</td></tr>
          <tr><td style="padding: 10px; font-weight: bold;">🩺 Santé des services :</td><td style="padding: 10px; font-weight: bold; color: #2e7d32;">${report.systemStatus}</td></tr>
        </table>
        
        <p style="margin-top: 20px; font-size: 12px; color: #777;">
          Ce rapport hebdomadaire est généré automatiquement chaque lundi matin.
        </p>
      </div>
    `;
    await this.send(email, `[GeOSM] Rapport d'activité hebdomadaire — ${report.periodTitle}`, html);
  }
}
