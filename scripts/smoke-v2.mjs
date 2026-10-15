/* eslint-disable no-console */
/** Verification de bout en bout des regles du Lot 1 contre une API reelle (base de test uniquement). */
const base = 'http://localhost:3005/api/v1';
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
}
async function call(method, path, body, token) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty */ }
  return { status: res.status, json };
}

const email = `smoke${Date.now()}@example.com`;

// Territoire
let r = await call('GET', '/instances/tree');
const tree = r.json?.data ?? [];
const afrique = tree.find((n) => n.slug === 'afrique');
check('GET /instances/tree renvoie continents et pays', r.status === 200 && tree.length === 6 && afrique?.children?.length > 5, `status ${r.status}, ${tree.length} continents`);
const cameroon = afrique?.children?.find((c) => c.slug === 'cameroon');
check('Cameroun actif, Algerie non disponible', cameroon?.isActive === true && afrique.children.find((c) => c.slug === 'algerie')?.isActive === false);

// RG-A-02 mot de passe
r = await call('POST', '/auth/register', { email, password: 'abcdefgh', firstName: 'Ada', lastName: 'Smoke' });
check('RG-A-02 refuse un mot de passe sans chiffre', r.status === 400, `status ${r.status}`);
r = await call('POST', '/auth/register', { email, password: 'abcdefg1', firstName: 'Ada', lastName: 'Smoke' });
check('Inscription valide', r.status === 201 || r.status === 200, `status ${r.status}`);
const token = r.json?.data?.accessToken;
r = await call('POST', '/auth/register', { email, password: 'abcdefg1', firstName: 'Ada', lastName: 'Smoke' });
check('RG-A-01 email deja utilise refuse', r.status === 409, `status ${r.status}`);

// Profil + preference de pays
r = await call('GET', '/auth/me', null, token);
check('Profil : email non verifie, pas de pays', r.json?.data?.emailVerifiedAt === null && r.json?.data?.preferredInstanceId === null);
r = await call('PUT', '/auth/me/preferred-instance', { instanceId: cameroon.id }, token);
check('Choix du pays Cameroun', r.status === 200, `status ${r.status}`);
r = await call('PUT', '/auth/me/preferred-instance', { instanceId: afrique.id }, token);
check('RG-B-03 un continent ne peut pas etre choisi', r.status === 409, `status ${r.status}`);
const algerie = afrique.children.find((c) => c.slug === 'algerie');
r = await call('PUT', '/auth/me/preferred-instance', { instanceId: algerie.id }, token);
check('RG-B-03 un pays non disponible ne peut pas etre choisi', r.status === 409, `status ${r.status}`);
r = await call('GET', '/auth/me', null, token);
check('Le pays choisi est restitue', r.json?.data?.preferredInstanceId === cameroon.id);

// RG-A-04 renvoi 60 s (le mail d'inscription vient de partir)
r = await call('POST', '/auth/resend-verification', {}, token);
check('RG-A-04 renvoi refuse dans les 60 s', r.status === 429 && r.json?.error?.code === 'VERIFICATION_RESEND_COOLDOWN' && r.json?.error?.details?.retryAfterSeconds > 0, `status ${r.status} ${JSON.stringify(r.json?.error?.details)}`);

// Compteurs et preferences
r = await call('GET', '/notifications/counters', null, token);
check('Compteurs de non-lus', r.status === 200 && r.json?.data?.notifications === 0 && r.json?.data?.messages === 0, JSON.stringify(r.json?.data));
r = await call('GET', '/notifications/preferences', null, token);
check('Preferences : tout active par defaut', r.status === 200 && Object.values(r.json?.data ?? {}).every((v) => v === true) && Object.keys(r.json.data).length === 6);
r = await call('PUT', '/notifications/preferences', { preferences: { ZONE: false } }, token);
check('Desactiver la categorie ZONE', r.status === 200 && r.json?.data?.ZONE === false && r.json?.data?.GROUPS === true);
r = await call('PUT', '/notifications/preferences', { preferences: { INCONNUE: false } }, token);
check('Categorie inconnue refusee', r.status === 400, `status ${r.status}`);

// Changement de mot de passe (RG-A-08 + RG-A-02)
r = await call('PUT', '/auth/me/password', { currentPassword: 'mauvais', newPassword: 'nouveau123' }, token);
check('RG-A-08 ancien mot de passe errone refuse', r.status === 401, `status ${r.status}`);
r = await call('PUT', '/auth/me/password', { currentPassword: 'abcdefg1', newPassword: 'sanschiffre' }, token);
check('RG-A-02 nouveau mot de passe sans chiffre refuse', r.status === 400, `status ${r.status}`);

// RG-A-07 mot de passe oublie : meme reponse
const a = await call('POST', '/auth/forgot-password', { email });
const b = await call('POST', '/auth/forgot-password', { email: 'inconnu@example.com' });
check('RG-A-07 reponse identique compte connu / inconnu', a.status === b.status && JSON.stringify(a.json?.data) === JSON.stringify(b.json?.data), `${a.status}/${b.status}`);

// RG-A-11 temporisation apres 5 echecs
let last;
for (let i = 1; i <= 5; i++) last = await call('POST', '/auth/login', { email, password: 'faux' + i });
check('5 echecs : dernier echec = 401', last.status === 401, `status ${last.status}`);
r = await call('POST', '/auth/login', { email, password: 'abcdefg1' });
check('RG-A-11 le bon mot de passe est refuse pendant la temporisation (429)', r.status === 429 && r.json?.error?.code === 'LOGIN_LOCKED', `status ${r.status} ${JSON.stringify(r.json?.error?.details)}`);

// Redirections temporaires /groups
const old = await fetch(base + '/instances/abc/groups', { redirect: 'manual' });
check('Ancien /groups redirige en 308 vers /layer-groups', old.status === 308 && (old.headers.get('location') ?? '').includes('/layer-groups'), `status ${old.status} ${old.headers.get('location')}`);

const failed = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failed}/${results.length} verifications reussies`);
console.log('EMAIL=' + email);
process.exit(failed ? 1 : 0);
