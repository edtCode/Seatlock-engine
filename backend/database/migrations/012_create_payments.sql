-- +migrate Up
CREATE TABLE IF NOT EXISTS payments (
  id BIGSERIAL PRIMARY KEY,
  booking_id BIGINT REFERENCES bookings (id) ON DELETE SET NULL,
  reservation_id BIGINT REFERENCES reservations (id) ON DELETE SET NULL,
  user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  provider VARCHAR(40) NOT NULL,
  provider_payment_id VARCHAR(120),
  amount NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payments_status_check CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'))
);

CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments (booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider_payment_id ON payments (provider_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_reservation_id ON payments (reservation_id);

-- +migrate Down
DROP TABLE IF EXISTS payments;
