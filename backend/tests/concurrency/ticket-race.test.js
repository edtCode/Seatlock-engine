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

describe('Concurrency: ticket verification race', () => {
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

  async function bookOneSeat() {
    const { venue, seats } = await createVenueWithSeats(1);
    const event = await createPublishedEvent(venue.id);
    const [eventSeat] = await createEventSeats(event.id, seats);
    const user = await createUser({ email: 'ticketbuyer@test.com' });

    const resRes = await request(app)
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .set('Idempotency-Key', 'ticket-res-key')
      .send({ eventId: event.id, seatIds: [eventSeat.id] })
      .expect(201);

    const reservationId = resRes.body.data.reservationId;

    const payRes = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .set('Idempotency-Key', 'ticket-pay-key')
      .send({ reservationId })
      .expect(201);

    const providerPaymentId = await query(`SELECT provider_payment_id FROM payments WHERE id = $1`, [
      payRes.body.data.paymentId,
    ]).then((r) => r.rows[0].provider_payment_id);

    // Simulate the payment provider's webhook confirming success.
    const crypto = require('crypto');
    const payload = JSON.stringify({
      eventId: 'evt_test_1',
      eventType: 'payment.succeeded',
      providerPaymentId,
      status: 'SUCCESS',
    });
    const signature = crypto
      .createHmac('sha256', process.env.PAYMENT_WEBHOOK_SECRET || 'mock_webhook_secret')
      .update(payload)
      .digest('hex');

    await request(app)
      .post('/api/v1/webhooks/payment')
      .set('Content-Type', 'application/json')
      .set('x-mock-signature', signature)
      .send(payload)
      .expect(200);

    const { rows: ticketRows } = await query(
      `SELECT t.* FROM tickets t JOIN bookings b ON b.id = t.booking_id WHERE b.user_id = $1`,
      [user.id]
    );

    return { ticket: ticketRows[0], user };
  }

  test('two simultaneous scans of the same ticket: only one succeeds', async () => {
    const { ticket } = await bookOneSeat();
    const staff = await createUser({ email: 'staff@test.com', role: 'ADMIN' });

    const scan = () =>
      request(app)
        .post('/api/v1/tickets/verify')
        .set('Authorization', `Bearer ${tokenFor(staff)}`)
        .send({ ticketRef: ticket.ticket_ref });

    const [a, b] = await Promise.all([scan(), scan()]);
    const statuses = [a.status, b.status].sort();

    expect(statuses).toEqual([200, 409]);

    const { rows } = await query(`SELECT status FROM tickets WHERE id = $1`, [ticket.id]);
    expect(rows[0].status).toBe('USED');
  }, 30000);
});
