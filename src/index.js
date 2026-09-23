import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { auth } from './auth.js';
import { authPassword } from './auth_password.js';
<<<<<<< HEAD
import { trips } from './trips.js';
=======
import { trips, tripConflictRoutes } from './trips.js';
>>>>>>> 988f489339d9b2a96d221ffa1786b6bf6c94ff25
import { files, tripFiles } from './files.js';
import { profile } from './profile.js';
import { notifications } from './notifications.js';
import { sector } from './sector.js';
import { configuracoes } from './configuracoes.js';
import { activity } from './activity.js';
import { presence } from './presence.js';
import { admin } from './admin.js';
import { mapaOperacional } from './mapa_operacional.js';
import { demandas } from './demandas.js';
<<<<<<< HEAD
=======
import { vehicleRoutes } from './vehicles.js';
>>>>>>> 988f489339d9b2a96d221ffa1786b6bf6c94ff25
import { err, json } from './helpers.js';

const app = new Hono();

app.use(
  '/api/*',
  cors({
    origin: '*',
<<<<<<< HEAD
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
=======
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Trip-Edit-Mode'],
>>>>>>> 988f489339d9b2a96d221ffa1786b6bf6c94ff25
  })
);

app.get('/api/health', (c) =>
  json({
    success: true,
    app: c.env.APP_NAME || 'Chiptronic TravelOps',
    time: new Date().toISOString(),
  })
);

auth.route('/password', authPassword);
app.route('/api/auth', auth);
app.route('/api/trips', trips);
<<<<<<< HEAD
=======
app.route('/api/viagens', tripConflictRoutes);
>>>>>>> 988f489339d9b2a96d221ffa1786b6bf6c94ff25
app.route('/api/trips', tripFiles);
app.route('/api/profile', profile);
app.route('/api/notifications', notifications);
app.route('/api/sector', sector);
app.route('/api/configuracoes', configuracoes);
app.route('/api/activity', activity);
app.route('/api/presence', presence);
app.route('/api/admin', admin);
app.route('/api', mapaOperacional);
app.route('/api', files);
app.route('/api/demandas', demandas);
<<<<<<< HEAD
=======
app.route('/api', vehicleRoutes);
>>>>>>> 988f489339d9b2a96d221ffa1786b6bf6c94ff25

app.notFound((c) => {
  if (c.req.path.startsWith('/api/') || c.req.path === '/api') {
    return err('Rota não encontrada.', 404);
  }
  return err('Não encontrado.', 404);
});

app.onError((e, c) => {
  console.error(e);
  const message = e?.message || 'Erro interno.';
  if (
    message.includes('não permitido') ||
    message.includes('excede') ||
    message.includes('inválido')
  ) {
    return err(message, 400);
  }
  return err(message, 500);
});

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api')) {
      return app.fetch(request, env, ctx);
    }

    if (env.ASSETS) {
      let response = await env.ASSETS.fetch(request);
      if (response.status === 404 && request.method === 'GET' && !url.pathname.includes('.')) {
        const htmlRequest = new Request(new URL(`${url.pathname}.html${url.search}`, request.url), request);
        response = await env.ASSETS.fetch(htmlRequest);
      }
      const contentType = response.headers.get('content-type') || '';
      const headers = new Headers(response.headers);
      if (contentType.includes('text/html')) {
        headers.set('Cache-Control', 'no-cache, must-revalidate');
      } else if (
        contentType.includes('text/css') ||
        contentType.includes('javascript') ||
        contentType.startsWith('image/') ||
        contentType.includes('font/')
      ) {
        headers.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
      }
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    return new Response('Frontend não configurado (ASSETS).', { status: 500 });
  },
};
