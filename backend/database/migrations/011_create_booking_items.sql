-- +migrate Up
CREATE TABLE IF NOT EXISTS booking_items (
  id BIGSERIAL PRIMARY KEY,
  booking_id BIGINT NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
  event_seat_id BIGINT NOT NULL REFERENCES event_seats (id) ON DELETE RESTRICT,
  price NUMERIC(10, 2) NOT NULL,
  CONSTRAINT booking_items_unique UNIQUE (booking_id, event_seat_id)
);

CREATE INDEX IF NOT EXISTS idx_booking_items_booking_id ON booking_items (booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_items_event_seat_id ON booking_items (event_seat_id);

-- +migrate Down
DROP TABLE IF EXISTS booking_items;
