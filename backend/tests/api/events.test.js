const {
  getApp,
  request,
  resetDatabase,
  flushRedis,
  createUser,
  tokenFor,
  createVenueWithSeats,
  createPublishedEvent,
  createEventSeats,
  closeAll,
} = require('../helpers');

describe('Events API', () => {
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

  test('public can list published events with seat availability', async () => {
    const { venue, seats } = await createVenueWithSeats(5);
    const event = await createPublishedEvent(venue.id);
    await createEventSeats(event.id, seats, 75);

    const res = await request(app).get('/api/v1/events');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].available_seats).toBe(5);
    expect(res.body.pagination.total).toBe(1);
  });

  test('public can view seat inventory for an event', async () => {
    const { venue, seats } = await createVenueWithSeats(3);
    const event = await createPublishedEvent(venue.id);
    await createEventSeats(event.id, seats, 40);

    const res = await request(app).get(`/api/v1/events/${event.id}/seats`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(3);
    expect(res.body.data[0].status).toBe('AVAILABLE');
  });

  test('non-admin cannot create an event', async () => {
    const user = await createUser();
    const res = await request(app)
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({
        venueId: 1,
        title: 'Should Fail',
        startTime: new Date(Date.now() + 86400000).toISOString(),
        endTime: new Date(Date.now() + 90000000).toISOString(),
      });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  test('admin can create, publish, and delete an event', async () => {
    const admin = await createUser({ role: 'ADMIN' });
    const { venue } = await createVenueWithSeats(1);

    const createRes = await request(app)
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${tokenFor(admin)}`)
      .send({
        venueId: venue.id,
        title: 'New Show',
        startTime: new Date(Date.now() + 86400000).toISOString(),
        endTime: new Date(Date.now() + 90000000).toISOString(),
        status: 'PUBLISHED',
      });
    expect(createRes.status).toBe(201);
    const eventId = createRes.body.data.id;

    const deleteRes = await request(app)
      .delete(`/api/v1/events/${eventId}`)
      .set('Authorization', `Bearer ${tokenFor(admin)}`);
    expect(deleteRes.status).toBe(204);
  });
});
