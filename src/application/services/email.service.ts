export interface OsmImportReportData {
  pbfPath: string;
  durationSeconds: number;
  extractedBoundariesCount: number;
  pointsBefore: number;
  pointsAfter: number;
  polygonsBefore: number;
  polygonsAfter: number;
  linesBefore: number;
  linesAfter: number;
  layerDiffs?: Array<{ name: string; countBefore: number; countAfter: number }>;
}

export interface BackupReportData {
  key: string;
  sizeBytes: number;
  deletedOldBackups: number;
  durationSeconds?: number;
}

export interface RoleAssignmentData {
  userEmail: string;
  userName: string;
  newRole: string;
  assignedBy: string;
}

export interface FeedbackNotificationData {
  userEmail: string;
  instanceName?: string;
  category: string;
  comment: string;
}

export interface ActivityReportData {
  periodTitle: string; // ex: "Semaine du 3 au 9 Août 2026" ou "Août 2026"
  activeInstancesCount: number;
  totalLayersCount: number;
  totalUsersCount: number;
  newUsersInPeriod: number;
  totalExportsInPeriod: number;
  storageSizeBytes: number;
  systemStatus: string;
}

export interface IEmailService {
  sendVerificationEmail(email: string, token: string): Promise<void>;
  sendPasswordResetEmail(email: string, token: string): Promise<void>;
  sendWelcomeEmail(email: string, firstName: string): Promise<void>;
  sendOsmImportReportEmail(email: string, report: OsmImportReportData): Promise<void>;
  sendBackupReportEmail(email: string, report: BackupReportData): Promise<void>;
  sendRoleAssignmentEmail(email: string, data: RoleAssignmentData): Promise<void>;
  sendFeedbackNotificationEmail(email: string, data: FeedbackNotificationData): Promise<void>;
  sendMonthlyReportEmail(email: string, report: ActivityReportData): Promise<void>;
  sendWeeklyReportEmail(email: string, report: ActivityReportData): Promise<void>;
}
