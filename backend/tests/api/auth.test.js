const { getApp, request, resetDatabase, flushRedis, closeAll } = require('../helpers');

describe('Auth API', () => {
  let app;

  beforeAll(() => {
    app = getApp();
  });

  beforeEach(async () => {
    await resetDatabase();
    await flushRedis();
  });

  afterAll(async () => {
    await closeAll();
  });

  test('register -> login -> me -> refresh -> logout', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Jane Doe',
      email: 'jane@test.com',
      password: 'Str0ng!Pass',
    });
    expect(registerRes.status).toBe(201);
    expect(registerRes.body.data.user.email).toBe('jane@test.com');
    expect(registerRes.body.data.user.password_hash).toBeUndefined();

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'jane@test.com', password: 'Str0ng!Pass' });
    expect(loginRes.status).toBe(200);
    const { accessToken, refreshToken } = loginRes.body.data;

    const meRes = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.email).toBe('jane@test.com');

    const refreshRes = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.data.accessToken).toBeDefined();

    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .send({ refreshToken: refreshRes.body.data.refreshToken });
    expect(logoutRes.status).toBe(200);
  });

  test('rejects weak passwords', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Weak', email: 'weak@test.com', password: 'weak' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('rejects duplicate email', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'A', email: 'dup@test.com', password: 'Str0ng!Pass' });
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'B', email: 'dup@test.com', password: 'Str0ng!Pass' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  test('rejects invalid login', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nope@test.com', password: 'Str0ng!Pass' });
    expect(res.status).toBe(401);
  });

  test('unauthenticated /me is rejected', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_REQUIRED');
  });
});
