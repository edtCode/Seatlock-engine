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
  query,
} = require('../helpers');

describe('Reservations API', () => {
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

  test('requires Idempotency-Key header', async () => {
    const user = await createUser();
    const { venue, seats } = await createVenueWithSeats(1);
    const event = await createPublishedEvent(venue.id);
    const [seat] = await createEventSeats(event.id, seats, 100);

    const res = await request(app)
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ eventId: event.id, seatIds: [seat.id] });
    expect(res.status).toBe(400);
  });

  test('total amount is calculated server-side from event_seats.price, ignoring any client value', async () => {
    const user = await createUser();
    const { venue, seats } = await createVenueWithSeats(2);
    const event = await createPublishedEvent(venue.id);
    const eventSeats = await createEventSeats(event.id, seats, 60);

    const res = await request(app)
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .set('Idempotency-Key', 'price-test')
      .send({
        eventId: event.id,
        seatIds: eventSeats.map((s) => s.id),
        totalAmount: 1, // attempted tampering - must be ignored entirely
      });

    expect(res.status).toBe(201);
    expect(res.body.data.totalAmount).toBe(120);
  });

  test('reusing the same idempotency key with the same payload returns the cached response, not a new reservation', async () => {
    const user = await createUser();
    const { venue, seats } = await createVenueWithSeats(1);
    const event = await createPublishedEvent(venue.id);
    const [seat] = await createEventSeats(event.id, seats, 30);

    const body = { eventId: event.id, seatIds: [seat.id] };

    const first = await request(app)
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .set('Idempotency-Key', 'same-key')
      .send(body);
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .set('Idempotency-Key', 'same-key')
      .send(body);
    expect(second.status).toBe(201);
    expect(second.body.data.reservationId).toBe(first.body.data.reservationId);

    const { rows } = await query(`SELECT COUNT(*)::int AS count FROM reservations WHERE event_id = $1`, [
      event.id,
    ]);
    expect(rows[0].count).toBe(1);
  });

  test('reusing the same idempotency key with a different payload is rejected', async () => {
    const user = await createUser();
    const { venue, seats } = await createVenueWithSeats(2);
    const event = await createPublishedEvent(venue.id);
    const [seatA, seatB] = await createEventSeats(event.id, seats, 30);

    await request(app)
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .set('Idempotency-Key', 'reused-key')
      .send({ eventId: event.id, seatIds: [seatA.id] })
      .expect(201);

    const res = await request(app)
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .set('Idempotency-Key', 'reused-key')
      .send({ eventId: event.id, seatIds: [seatB.id] });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  test('user can cancel their own active reservation, releasing the seat', async () => {
    const user = await createUser();
    const { venue, seats } = await createVenueWithSeats(1);
    const event = await createPublishedEvent(venue.id);
    const [seat] = await createEventSeats(event.id, seats, 30);

    const created = await request(app)
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .set('Idempotency-Key', 'cancel-key')
      .send({ eventId: event.id, seatIds: [seat.id] })
      .expect(201);

    const cancelRes = await request(app)
      .post(`/api/v1/reservations/${created.body.data.reservationId}/cancel`)
      .set('Authorization', `Bearer ${tokenFor(user)}`);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('CANCELLED');

    const { rows } = await query(`SELECT status FROM event_seats WHERE id = $1`, [seat.id]);
    expect(rows[0].status).toBe('AVAILABLE');
  });

  test('a user cannot cancel another user\'s reservation', async () => {
    const owner = await createUser({ email: 'owner@test.com' });
    const intruder = await createUser({ email: 'intruder@test.com' });
    const { venue, seats } = await createVenueWithSeats(1);
    const event = await createPublishedEvent(venue.id);
    const [seat] = await createEventSeats(event.id, seats, 30);

    const created = await request(app)
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${tokenFor(owner)}`)
      .set('Idempotency-Key', 'owner-key')
      .send({ eventId: event.id, seatIds: [seat.id] })
      .expect(201);

    const res = await request(app)
      .post(`/api/v1/reservations/${created.body.data.reservationId}/cancel`)
      .set('Authorization', `Bearer ${tokenFor(intruder)}`);
    expect(res.status).toBe(403);
  });
});
