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

describe('Payments & Webhooks API', () => {
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

  async function setupReservation() {
    const user = await createUser();
    const { venue, seats } = await createVenueWithSeats(1);
    const event = await createPublishedEvent(venue.id);
    const [seat] = await createEventSeats(event.id, seats, 80);

    const resRes = await request(app)
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .set('Idempotency-Key', 'setup-key')
      .send({ eventId: event.id, seatIds: [seat.id] })
      .expect(201);

    return { user, event, seat, reservationId: resRes.body.data.reservationId };
  }

  test('full flow: create payment -> webhook success -> booking confirmed, seat BOOKED, ticket issued', async () => {
    const { user, seat, reservationId } = await setupReservation();

    const payRes = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .set('Idempotency-Key', 'pay-key')
      .send({ reservationId })
      .expect(201);

    const { rows } = await query(`SELECT provider_payment_id FROM payments WHERE id = $1`, [
      payRes.body.data.paymentId,
    ]);
    const providerPaymentId = rows[0].provider_payment_id;

    const payload = JSON.stringify({
      eventId: 'evt_1',
      eventType: 'payment.succeeded',
      providerPaymentId,
      status: 'SUCCESS',
    });

    const webhookRes = await request(app)
      .post('/api/v1/webhooks/payment')
      .set('Content-Type', 'application/json')
      .set('x-mock-signature', signWebhook(payload))
      .send(payload);
    expect(webhookRes.status).toBe(200);

    const { rows: bookingRows } = await query(`SELECT * FROM bookings WHERE user_id = $1`, [user.id]);
    expect(bookingRows.length).toBe(1);
    expect(bookingRows[0].status).toBe('CONFIRMED');
    expect(bookingRows[0].booking_reference).toMatch(/^SLK-/);

    const { rows: seatRows } = await query(`SELECT status FROM event_seats WHERE id = $1`, [seat.id]);
    expect(seatRows[0].status).toBe('BOOKED');

    const { rows: ticketRows } = await query(
      `SELECT * FROM tickets WHERE booking_id = $1`,
      [bookingRows[0].id]
    );
    expect(ticketRows.length).toBe(1);
    expect(ticketRows[0].status).toBe('VALID');
  });

  test('duplicate webhook delivery for the same event_id is processed only once', async () => {
    const { user, reservationId } = await setupReservation();

    const payRes = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .set('Idempotency-Key', 'pay-key-2')
      .send({ reservationId })
      .expect(201);

    const { rows } = await query(`SELECT provider_payment_id FROM payments WHERE id = $1`, [
      payRes.body.data.paymentId,
    ]);
    const providerPaymentId = rows[0].provider_payment_id;

    const payload = JSON.stringify({
      eventId: 'evt_duplicate_test',
      eventType: 'payment.succeeded',
      providerPaymentId,
      status: 'SUCCESS',
    });
    const signature = signWebhook(payload);

    const first = await request(app)
      .post('/api/v1/webhooks/payment')
      .set('Content-Type', 'application/json')
      .set('x-mock-signature', signature)
      .send(payload);
    expect(first.status).toBe(200);
    expect(first.body.data.alreadyProcessed).toBe(false);

    const second = await request(app)
      .post('/api/v1/webhooks/payment')
      .set('Content-Type', 'application/json')
      .set('x-mock-signature', signature)
      .send(payload);
    expect(second.status).toBe(200);
    expect(second.body.data.alreadyProcessed).toBe(true);

    const { rows: bookingRows } = await query(`SELECT * FROM bookings WHERE user_id = $1`, [user.id]);
    expect(bookingRows.length).toBe(1); // not duplicated
  });

  test('webhook with an invalid signature is rejected', async () => {
    const payload = JSON.stringify({
      eventId: 'evt_bad_sig',
      eventType: 'payment.succeeded',
      providerPaymentId: 'mock_pay_fake',
      status: 'SUCCESS',
    });

    const res = await request(app)
      .post('/api/v1/webhooks/payment')
      .set('Content-Type', 'application/json')
      .set('x-mock-signature', 'not-a-real-signature')
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_WEBHOOK_SIGNATURE');
  });
});
