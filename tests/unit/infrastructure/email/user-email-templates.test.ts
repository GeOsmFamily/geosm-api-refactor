import { describe, it, expect } from 'vitest';
import {
  USER_EMAILS,
  emailLang,
  escapeHtml,
  userEmailHtml,
} from '../../../../src/infrastructure/email/user-email-templates.js';

describe('user-email-templates', () => {
  it('retient fr, en, es et se replie sur le francais', () => {
    expect(emailLang('en')).toBe('en');
    expect(emailLang('es')).toBe('es');
    expect(emailLang('de')).toBe('fr');
    expect(emailLang(undefined)).toBe('fr');
  });

  it('a les memes e-mails dans les trois langues', () => {
    for (const lang of ['fr', 'en', 'es'] as const) {
      expect(USER_EMAILS[lang].verification.subject).toContain('GeOsm');
      expect(USER_EMAILS[lang].reset.subject).toContain('GeOsm');
      expect(USER_EMAILS[lang].welcome.title('Ada')).toContain('Ada');
    }
    expect(USER_EMAILS.fr.reset.subject).toBe('Réinitialisez votre mot de passe - GeOsm');
  });

  it('echappe le prenom et place le lien dans le corps', () => {
    expect(escapeHtml('<b>Ada</b> & "Bob"')).toBe('&#60;b&#62;Ada&#60;/b&#62; &#38; &#34;Bob&#34;');
    const html = userEmailHtml('Titre', 'Corps', 'http://x/verify-email?token=t', 'Pied');
    expect(html).toContain('<a href="http://x/verify-email?token=t">');
    expect(html).toContain('<p>Pied</p>');
  });
});
