/* eslint-disable no-console */
/** Verification de l etape 2.1a contre une API reelle et la base de test geosm-e2e-pg (jamais en production). */
import { execSync } from 'node:child_process';

const base = 'http://localhost:3005/api/v1';
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
};
const psql = (sql) =>
  execSync(`docker exec geosm-e2e-pg psql -U geosm -At -c "${sql}"`, { encoding: 'utf8' }).trim();
async function call(method, path, body, token) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* 204 */ }
  return { status: res.status, json };
}
async function userToken(email, role) {
  await call('POST', '/auth/register', { email, password: 'motdepasse1', firstName: 'T', lastName: 'U' });
  psql(`update users set role='${role}' where email='${email}'`);
  return (await call('POST', '/auth/login', { email, password: 'motdepasse1' })).json.data.accessToken;
}

const cm = psql("select id from instances where slug='cameroon'");
const stamp = Date.now();

let r = await call('GET', `/instances/${cm}/predefined-comments`);
check('Liste publique : 5 commentaires par defaut tries', r.status === 200 && r.json.data.length >= 5 && r.json.data.every((c, i, a) => i === 0 || a[i - 1].order <= c.order), r.json?.data?.map((c) => c.label).join(' | '));

const sa = await userToken(`sa${stamp}@example.com`, 'SUPER_ADMIN');
r = await call('POST', `/admin/instances/${cm}/predefined-comments`, { label: '  Nid de poule dangereux ' }, sa);
check('Creation (super-admin) : 201, libelle nettoye, ajoute en fin', r.status === 201 && r.json.data.label === 'Nid de poule dangereux', `status ${r.status} order ${r.json?.data?.order}`);
const id = r.json?.data?.id;
r = await call('PATCH', `/admin/instances/${cm}/predefined-comments/${id}`, { order: 0 }, sa);
check('Modification de l ordre', r.status === 200 && r.json.data.order === 0, `status ${r.status}`);
r = await call('PATCH', `/admin/instances/${cm}/predefined-comments/${id}`, {}, sa);
check('Modification sans champ : 400', r.status === 400, `status ${r.status}`);
r = await call('POST', `/admin/instances/${cm}/predefined-comments`, { label: '' }, sa);
check('Libelle vide : 400', r.status === 400, `status ${r.status}`);

const la = await userToken(`la${stamp}@example.com`, 'ADMIN_INSTANCE');
r = await call('POST', `/admin/instances/${cm}/predefined-comments`, { label: 'x' }, la);
check('Admin d instance NON rattache au Cameroun : 403', r.status === 403, `status ${r.status}`);
const laId = psql(`select id from users where email='la${stamp}@example.com'`);
psql(`insert into instance_users (id,user_id,instance_id,role,updated_at) values (gen_random_uuid(),'${laId}','${cm}','ADMIN_INSTANCE',now())`);
r = await call('POST', `/admin/instances/${cm}/predefined-comments`, { label: 'Ajout admin local' }, la);
check('Admin d instance rattache : 201', r.status === 201, `status ${r.status}`);
const laCreated = r.json?.data?.id;

const viewer = await userToken(`v${stamp}@example.com`, 'VIEWER');
r = await call('GET', `/admin/instances/${cm}/predefined-comments`, null, viewer);
check('Simple utilisateur sur le back-office : 403', r.status === 403, `status ${r.status}`);
r = await call('GET', `/admin/instances/${cm}/predefined-comments`);
check('Anonyme sur le back-office : 401', r.status === 401, `status ${r.status}`);

r = await call('DELETE', `/admin/instances/${cm}/predefined-comments/${id}`, null, sa);
check('Suppression : 204', r.status === 204, `status ${r.status}`);
r = await call('DELETE', `/admin/instances/${cm}/predefined-comments/${id}`, null, sa);
check('Suppression d un element deja supprime : 404', r.status === 404, `status ${r.status}`);
await call('DELETE', `/admin/instances/${cm}/predefined-comments/${laCreated}`, null, sa);

r = await call('POST', '/comments', { instanceId: cm, text: 'Route coupée', lat: 3.86, lon: 11.5, photoUrl: 'http://localhost:9101/geosm/photo.jpg' }, viewer);
check('Commentaire avec photoUrl enregistre', r.status === 201 || r.status === 200 ? r.json.data.photoUrl === 'http://localhost:9101/geosm/photo.jpg' : false, `status ${r.status}`);
r = await call('POST', '/comments', { instanceId: cm, text: 'x', lat: 3, lon: 11, photoUrl: 'pas-une-url' }, viewer);
check('photoUrl invalide : 400', r.status === 400, `status ${r.status}`);
r = await call('POST', '/comments', { instanceId: cm, text: 'Sans photo', lat: 3, lon: 11 }, viewer);
check('Commentaire sans photo : comportement inchange', (r.status === 201 || r.status === 200) && r.json.data.photoUrl === null, `status ${r.status}`);

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} verifications reussies`);
process.exit(failed ? 1 : 0);
