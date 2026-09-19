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

describe('Concurrency: same-seat reservation race', () => {
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

  test('100 concurrent reservation requests for the same seat: exactly 1 succeeds', async () => {
    const { venue, seats } = await createVenueWithSeats(1);
    const event = await createPublishedEvent(venue.id);
    const [eventSeat] = await createEventSeats(event.id, seats);

    const CONCURRENCY = 100;
    const users = await Promise.all(
      Array.from({ length: CONCURRENCY }, (_, i) => createUser({ email: `race${i}@test.com` }))
    );

    const requests = users.map((user, i) =>
      request(app)
        .post('/api/v1/reservations')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .set('Idempotency-Key', `race-key-${i}`)
        .send({ eventId: event.id, seatIds: [eventSeat.id] })
    );

    const responses = await Promise.all(requests.map((r) => r.catch((e) => e)));

    const successes = responses.filter((r) => r.status === 201);
    const conflicts = responses.filter((r) => r.status === 409);

    expect(successes.length).toBe(1);
    expect(conflicts.length).toBe(CONCURRENCY - 1);

    // Verify against Postgres: exactly one HELD seat, exactly one reservation row.
    const { rows: seatRows } = await query(`SELECT status FROM event_seats WHERE id = $1`, [eventSeat.id]);
    expect(seatRows[0].status).toBe('HELD');

    const { rows: reservationRows } = await query(
      `SELECT * FROM reservations WHERE event_id = $1 AND status = 'ACTIVE'`,
      [event.id]
    );
    expect(reservationRows.length).toBe(1);

    // No duplicate booking / reservation-item ownership of this seat.
    const { rows: itemRows } = await query(`SELECT * FROM reservation_items WHERE event_seat_id = $1`, [
      eventSeat.id,
    ]);
    expect(itemRows.length).toBe(1);
  }, 60000);

  test('multi-seat reservation releases all locks if one seat in the batch is unavailable', async () => {
    const { venue, seats } = await createVenueWithSeats(3);
    const event = await createPublishedEvent(venue.id);
    const eventSeats = await createEventSeats(event.id, seats);
    const [seatA, seatB, seatC] = eventSeats;

    // Pre-book seatB via a separate successful reservation.
    const otherUser = await createUser({ email: 'other@test.com' });
    await request(app)
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${tokenFor(otherUser)}`)
      .set('Idempotency-Key', 'pre-book')
      .send({ eventId: event.id, seatIds: [seatB.id] })
      .expect(201);

    // Now attempt a batch reservation including the already-held seatB.
    const user = await createUser({ email: 'batch@test.com' });
    const res = await request(app)
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .set('Idempotency-Key', 'batch-key')
      .send({ eventId: event.id, seatIds: [seatA.id, seatB.id, seatC.id] });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SEAT_ALREADY_HELD');

    // seatA and seatC must NOT be left HELD (no partial locks left behind).
    const { rows } = await query(`SELECT id, status FROM event_seats WHERE id = ANY($1::bigint[])`, [
      [seatA.id, seatC.id],
    ]);
    for (const row of rows) {
      expect(row.status).toBe('AVAILABLE');
    }
  }, 30000);
});
