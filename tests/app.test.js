const request = require('supertest');
const path = require('path');
const { createApp, escapeHtml } = require('../src/app');
const { getBuildInfo } = require('../src/buildInfo');
const { HEADLINE } = require('../src/config');

const buildInfo = { version: '9.9.9', commit: 'abc1234', builtAt: '2026-01-01T00:00:00Z' };
const app = createApp(buildInfo);

describe('HTTP API', () => {
  test('GET /health reports ok and the deployed version', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', version: '9.9.9', commit: 'abc1234' });
  });

  test('GET / renders the headline and version', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain(escapeHtml(HEADLINE));
    expect(res.text).toContain('v9.9.9');
  });

  test('GET /api/info returns headline and build info', async () => {
    const res = await request(app).get('/api/info');
    expect(res.body).toMatchObject({ headline: HEADLINE, version: '9.9.9' });
  });

  test('GET /api/calc adds', async () => {
    const res = await request(app).get('/api/calc?op=add&a=2&b=40');
    expect(res.body).toEqual({ result: 42 });
  });

  test('GET /api/calc returns 400 on divide by zero', async () => {
    const res = await request(app).get('/api/calc?op=divide&a=1&b=0');
    expect(res.status).toBe(400);
  });

  test('GET /api/calc returns 400 on unknown op', async () => {
    const res = await request(app).get('/api/calc?op=pow&a=1&b=2');
    expect(res.status).toBe(400);
  });

  test('does not leak the x-powered-by header', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('helpers', () => {
  test('escapeHtml escapes markup', () => {
    expect(escapeHtml('<script>"x"</script>')).toBe('&lt;script&gt;&quot;x&quot;&lt;/script&gt;');
  });

  test('getBuildInfo falls back when build-info.json is missing', () => {
    expect(getBuildInfo(path.join(__dirname, 'nope.json')).commit).toBe('local');
  });
});
