-- +migrate Up
CREATE TABLE IF NOT EXISTS venue_seats (
  id BIGSERIAL PRIMARY KEY,
  venue_id BIGINT NOT NULL REFERENCES venues (id) ON DELETE CASCADE,
  row_label VARCHAR(10) NOT NULL,
  seat_number INTEGER NOT NULL,
  seat_type VARCHAR(20) NOT NULL DEFAULT 'REGULAR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT venue_seats_type_check CHECK (seat_type IN ('REGULAR', 'PREMIUM', 'VIP', 'ACCESSIBLE')),
  CONSTRAINT venue_seats_unique UNIQUE (venue_id, row_label, seat_number)
);

CREATE INDEX IF NOT EXISTS idx_venue_seats_venue_id ON venue_seats (venue_id);

-- +migrate Down
DROP TABLE IF EXISTS venue_seats;
