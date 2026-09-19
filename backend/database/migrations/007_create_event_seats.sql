-- +migrate Up
CREATE TABLE IF NOT EXISTS event_seats (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  venue_seat_id BIGINT NOT NULL REFERENCES venue_seats (id) ON DELETE RESTRICT,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT event_seats_status_check CHECK (status IN ('AVAILABLE', 'HELD', 'BOOKED', 'DISABLED')),
  CONSTRAINT event_seats_unique UNIQUE (event_id, venue_seat_id)
);

CREATE INDEX IF NOT EXISTS idx_event_seats_event_id ON event_seats (event_id);
CREATE INDEX IF NOT EXISTS idx_event_seats_status ON event_seats (status);
-- Composite index accelerates the hot-path lookup: seats for one event filtered by status.
CREATE INDEX IF NOT EXISTS idx_event_seats_event_status ON event_seats (event_id, status);

-- +migrate Down
DROP TABLE IF EXISTS event_seats;
