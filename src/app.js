const express = require('express');
const { HEADLINE } = require('./config');
const { getBuildInfo } = require('./buildInfo');
const { add, divide } = require('./calculator');

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function createApp(buildInfo = getBuildInfo()) {
  const app = express();
  app.disable('x-powered-by');

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', version: buildInfo.version, commit: buildInfo.commit });
  });

  app.get('/api/info', (req, res) => {
    res.json({ headline: HEADLINE, ...buildInfo });
  });

  app.get('/api/calc', (req, res) => {
    const a = Number(req.query.a);
    const b = Number(req.query.b);
    const ops = { add, divide };
    const op = ops[req.query.op];
    if (!op) return res.status(400).json({ error: 'op must be add or divide' });
    try {
      return res.json({ result: op(a, b) });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.get('/', (req, res) => {
    res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CI/CD Demo</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; display: grid; place-items: center; min-height: 100vh; margin: 0; }
    main { text-align: center; padding: 2rem; }
    h1 { font-size: clamp(1.8rem, 5vw, 3rem); margin-bottom: .5rem; }
    .badge { display: inline-block; background: #22c55e; color: #052e16; padding: .4rem 1rem; border-radius: 999px; font-weight: 700; }
    dl { display: grid; grid-template-columns: auto auto; gap: .3rem 1rem; justify-content: center; margin-top: 1.5rem; color: #94a3b8; }
    dt { text-align: right; } dd { margin: 0; text-align: left; font-family: ui-monospace, monospace; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(HEADLINE)}</h1>
    <span class="badge">v${escapeHtml(buildInfo.version)}</span>
    <dl>
      <dt>Commit</dt><dd>${escapeHtml(buildInfo.commit)}</dd>
      <dt>Built at</dt><dd>${escapeHtml(buildInfo.builtAt || 'n/a')}</dd>
    </dl>
  </main>
</body>
</html>`);
  });

  return app;
}

module.exports = { createApp, escapeHtml };
