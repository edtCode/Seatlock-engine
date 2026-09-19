const crypto = require('crypto');
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

function signWebhook(payload) {
  return crypto
    .createHmac('sha256', process.env.PAYMENT_WEBHOOK_SECRET || 'mock_webhook_secret')
    .update(payload)
    .digest('hex');
}

async function bookSeatForUser(app, user, price = 45) {
  const { venue, seats } = await createVenueWithSeats(1);
  const event = await createPublishedEvent(venue.id);
  const [seat] = await createEventSeats(event.id, seats, price);

  const resRes = await request(app)
    .post('/api/v1/reservations')
    .set('Authorization', `Bearer ${tokenFor(user)}`)
    .set('Idempotency-Key', `book-res-${user.id}`)
    .send({ eventId: event.id, seatIds: [seat.id] })
    .expect(201);

  const payRes = await request(app)
    .post('/api/v1/payments')
    .set('Authorization', `Bearer ${tokenFor(user)}`)
    .set('Idempotency-Key', `book-pay-${user.id}`)
    .send({ reservationId: resRes.body.data.reservationId })
    .expect(201);

  const { rows } = await query(`SELECT provider_payment_id FROM payments WHERE id = $1`, [
    payRes.body.data.paymentId,
  ]);
  const providerPaymentId = rows[0].provider_payment_id;

  const payload = JSON.stringify({
    eventId: `evt_${user.id}`,
    eventType: 'payment.succeeded',
    providerPaymentId,
    status: 'SUCCESS',
  });

  await request(app)
    .post('/api/v1/webhooks/payment')
    .set('Content-Type', 'application/json')
    .set('x-mock-signature', signWebhook(payload))
    .send(payload)
    .expect(200);

  const { rows: bookingRows } = await query(`SELECT * FROM bookings WHERE user_id = $1`, [user.id]);
  return { booking: bookingRows[0], event, seat };
}

describe('Bookings API', () => {
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

  test('user can list and fetch their own booking', async () => {
    const user = await createUser();
    const { booking } = await bookSeatForUser(app, user);

    const listRes = await request(app)
      .get('/api/v1/bookings')
      .set('Authorization', `Bearer ${tokenFor(user)}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBe(1);

    const getRes = await request(app)
      .get(`/api/v1/bookings/${booking.id}`)
      .set('Authorization', `Bearer ${tokenFor(user)}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.tickets.length).toBe(1);
  });

  test('a user cannot view another user\'s booking', async () => {
    const owner = await createUser({ email: 'bowner@test.com' });
    const intruder = await createUser({ email: 'bintruder@test.com' });
    const { booking } = await bookSeatForUser(app, owner);

    const res = await request(app)
      .get(`/api/v1/bookings/${booking.id}`)
      .set('Authorization', `Bearer ${tokenFor(intruder)}`);
    expect(res.status).toBe(403);
  });

  test('user can cancel their own confirmed booking, seat becomes AVAILABLE again', async () => {
    const user = await createUser();
    const { booking, seat } = await bookSeatForUser(app, user);

    const cancelRes = await request(app)
      .post(`/api/v1/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${tokenFor(user)}`);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('CANCELLED');

    const { rows } = await query(`SELECT status FROM event_seats WHERE id = $1`, [seat.id]);
    expect(rows[0].status).toBe('AVAILABLE');
  });

  test('cancelling an already-cancelled booking is rejected', async () => {
    const user = await createUser();
    const { booking } = await bookSeatForUser(app, user);

    await request(app)
      .post(`/api/v1/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .expect(200);

    const res = await request(app)
      .post(`/api/v1/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${tokenFor(user)}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BOOKING_ALREADY_CANCELLED');
  });
});
