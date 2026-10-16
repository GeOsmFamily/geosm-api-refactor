/**
 * E-mails envoyes aux utilisateurs (verification, reinitialisation, bienvenue) en francais,
 * anglais et espagnol, comme l'interface. La langue vient d'Accept-Language a la requete qui
 * declenche l'envoi ; francais par defaut. Les e-mails d'administration restent en francais.
 */
export type EmailLang = 'fr' | 'en' | 'es';

export function emailLang(lang: string | undefined): EmailLang {
  return lang === 'en' || lang === 'es' ? lang : 'fr';
}

interface LinkEmail {
  subject: string;
  title: string;
  body: string;
  expiry: string;
}

export const USER_EMAILS: Record<
  EmailLang,
  { verification: LinkEmail; reset: LinkEmail; welcome: { subject: string; title: (name: string) => string; body: string } }
> = {
  fr: {
    verification: {
      subject: 'Confirmez votre adresse e-mail - GeOsm',
      title: 'Confirmation de votre adresse e-mail',
      body: 'Cliquez sur le lien ci-dessous pour confirmer votre adresse e-mail :',
      expiry: 'Ce lien expire dans 24 heures.',
    },
    reset: {
      subject: 'Réinitialisez votre mot de passe - GeOsm',
      title: 'Réinitialisation du mot de passe',
      body: 'Cliquez sur le lien ci-dessous pour choisir un nouveau mot de passe :',
      expiry: "Ce lien expire dans 1 heure. Si vous n'avez rien demandé, ignorez ce message.",
    },
    welcome: {
      subject: 'Bienvenue sur GeOsm',
      title: (name) => `Bienvenue, ${name} !`,
      body: 'Votre compte a bien été créé. Vous pouvez vous connecter ici :',
    },
  },
  en: {
    verification: {
      subject: 'Verify your email - GeOsm',
      title: 'Email verification',
      body: 'Click the link below to verify your email address:',
      expiry: 'This link expires in 24 hours.',
    },
    reset: {
      subject: 'Reset your password - GeOsm',
      title: 'Password reset',
      body: 'Click the link below to choose a new password:',
      expiry: 'This link expires in 1 hour. If you did not ask for it, ignore this message.',
    },
    welcome: {
      subject: 'Welcome to GeOsm',
      title: (name) => `Welcome, ${name}!`,
      body: 'Your account has been created. You can log in here:',
    },
  },
  es: {
    verification: {
      subject: 'Confirme su correo electrónico - GeOsm',
      title: 'Confirmación de su correo electrónico',
      body: 'Haga clic en el siguiente enlace para confirmar su correo electrónico:',
      expiry: 'Este enlace caduca en 24 horas.',
    },
    reset: {
      subject: 'Restablezca su contraseña - GeOsm',
      title: 'Restablecimiento de la contraseña',
      body: 'Haga clic en el siguiente enlace para elegir una nueva contraseña:',
      expiry: 'Este enlace caduca en 1 hora. Si no lo ha solicitado, ignore este mensaje.',
    },
    welcome: {
      subject: 'Bienvenido a GeOsm',
      title: (name) => `¡Bienvenido, ${name}!`,
      body: 'Su cuenta ha sido creada. Puede iniciar sesión aquí:',
    },
  },
};

export function userEmailHtml(title: string, body: string, link: string, footer?: string): string {
  return (
    `<h2>${title}</h2><p>${body}</p><p><a href="${link}">${link}</a></p>` +
    (footer ? `<p>${footer}</p>` : '')
  );
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
