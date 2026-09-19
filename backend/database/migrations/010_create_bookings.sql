-- +migrate Up
CREATE TABLE IF NOT EXISTS bookings (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  event_id BIGINT NOT NULL REFERENCES events (id) ON DELETE RESTRICT,
  reservation_id BIGINT REFERENCES reservations (id) ON DELETE SET NULL,
  booking_reference VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED',
  total_amount NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bookings_status_check CHECK (status IN ('CONFIRMED', 'CANCELLED', 'REFUNDED')),
  CONSTRAINT bookings_reference_unique UNIQUE (booking_reference)
);

CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings (user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_event_id ON bookings (event_id);
CREATE INDEX IF NOT EXISTS idx_bookings_booking_reference ON bookings (booking_reference);

-- +migrate Down
DROP TABLE IF EXISTS bookings;
