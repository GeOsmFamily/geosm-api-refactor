/* eslint-disable no-console */
/**
 * Test de charge du canal /ws/notifications (etape 1.6) : ouvre N connexions authentifiees,
 * mesure le temps d'etablissement et la latence aller-retour (ping/pong applicatif) sous charge,
 * puis lit la jauge geosm_ws_connections_active.
 *
 * Usage : node scripts/ws-load-test.mjs [apiBase] [connexions] [utilisateurs]
 *   ex. node scripts/ws-load-test.mjs http://localhost:3005 500 100
 * Cree des comptes jetables : a lancer sur une base de test, jamais en production.
 */
const base = process.argv[2] ?? 'http://localhost:3005';
const total = Number(process.argv[3] ?? 500);
const users = Number(process.argv[4] ?? 100);
const api = `${base}/api/v1`;
const wsBase = base.replace(/^http/, 'ws');

async function register(i) {
  const res = await fetch(`${api}/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: `load${Date.now()}_${i}@example.com`,
      password: 'loadtest123',
      firstName: 'Load',
      lastName: String(i),
    }),
  });
  if (!res.ok) throw new Error(`register ${res.status}`);
  return (await res.json()).data.accessToken;
}

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
};

console.log(`Creation de ${users} comptes...`);
const tokens = [];
for (let i = 0; i < users; i++) tokens.push(await register(i));

console.log(`Ouverture de ${total} connexions...`);
const sockets = [];
const connectTimes = [];
const started = performance.now();
await Promise.all(
  Array.from({ length: total }, (_, i) => {
    const token = tokens[i % tokens.length];
    return new Promise((resolve) => {
      const t0 = performance.now();
      const ws = new WebSocket(`${wsBase}/ws/notifications?token=${token}`);
      ws.onopen = () => {
        connectTimes.push(performance.now() - t0);
        sockets.push(ws);
        resolve();
      };
      ws.onerror = () => resolve();
    });
  }),
);
const connectSeconds = (performance.now() - started) / 1000;
console.log(`${sockets.length}/${total} connexions ouvertes en ${connectSeconds.toFixed(1)} s`);

// Latence ping/pong : chaque socket envoie 5 pings, tous en parallele.
const rtts = [];
await Promise.all(
  sockets.map(
    (ws) =>
      new Promise((resolve) => {
        let remaining = 5;
        let sentAt = 0;
        ws.onmessage = (event) => {
          try {
            if (JSON.parse(event.data).type !== 'pong') return;
          } catch {
            return;
          }
          rtts.push(performance.now() - sentAt);
          if (--remaining === 0) resolve();
          else {
            sentAt = performance.now();
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        };
        sentAt = performance.now();
        ws.send(JSON.stringify({ type: 'ping' }));
        setTimeout(resolve, 15000);
      }),
  ),
);

const metrics = await (await fetch(`${base}/metrics`)).text().catch(() => '');
const gauge = metrics.match(/geosm_ws_connections_active\{channel="notifications"\} (\d+)/);

console.log('--- Resultats ---');
console.log(`connexions ouvertes : ${sockets.length}/${total}`);
console.log(
  `etablissement (ms)  : p50 ${percentile(connectTimes, 50).toFixed(0)}  p95 ${percentile(connectTimes, 95).toFixed(0)}  max ${Math.max(...connectTimes).toFixed(0)}`,
);
console.log(
  `ping/pong (ms)      : p50 ${percentile(rtts, 50).toFixed(1)}  p95 ${percentile(rtts, 95).toFixed(1)}  max ${Math.max(...rtts).toFixed(1)}  (${rtts.length} mesures)`,
);
console.log(`jauge geosm_ws_connections_active : ${gauge ? gauge[1] : 'non lue (/metrics inaccessible)'}`);

for (const ws of sockets) ws.close();
await new Promise((r) => setTimeout(r, 1500));
const after = await (await fetch(`${base}/metrics`)).text().catch(() => '');
const gaugeAfter = after.match(/geosm_ws_connections_active\{channel="notifications"\} (\d+)/);
console.log(`jauge apres fermeture : ${gaugeAfter ? gaugeAfter[1] : 'n/a'}`);
process.exit(0);
