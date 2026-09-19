-- +migrate Up
-- One ticket per booking_item (i.e. per seat in a confirmed booking).
CREATE TABLE IF NOT EXISTS tickets (
  id BIGSERIAL PRIMARY KEY,
  ticket_ref VARCHAR(40) NOT NULL,
  booking_id BIGINT NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
  booking_item_id BIGINT NOT NULL REFERENCES booking_items (id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'VALID',
  used_at TIMESTAMPTZ,
  used_by BIGINT REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tickets_ref_unique UNIQUE (ticket_ref),
  CONSTRAINT tickets_booking_item_unique UNIQUE (booking_item_id),
  CONSTRAINT tickets_status_check CHECK (status IN ('VALID', 'USED', 'CANCELLED'))
);

CREATE INDEX IF NOT EXISTS idx_tickets_booking_id ON tickets (booking_id);
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_ref ON tickets (ticket_ref);

-- +migrate Down
DROP TABLE IF EXISTS tickets;
