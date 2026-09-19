-- +migrate Up
CREATE TABLE IF NOT EXISTS reservation_items (
  id BIGSERIAL PRIMARY KEY,
  reservation_id BIGINT NOT NULL REFERENCES reservations (id) ON DELETE CASCADE,
  event_seat_id BIGINT NOT NULL REFERENCES event_seats (id) ON DELETE RESTRICT,
  price NUMERIC(10, 2) NOT NULL,
  CONSTRAINT reservation_items_unique UNIQUE (reservation_id, event_seat_id)
);

CREATE INDEX IF NOT EXISTS idx_reservation_items_reservation_id ON reservation_items (reservation_id);
CREATE INDEX IF NOT EXISTS idx_reservation_items_event_seat_id ON reservation_items (event_seat_id);

-- +migrate Down
DROP TABLE IF EXISTS reservation_items;
