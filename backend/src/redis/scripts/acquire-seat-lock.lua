-- acquire-seat-lock.lua
-- KEYS[1] = seat lock key, e.g. seatlock:event:{eventId}:seat:{seatId}
-- ARGV[1] = reservationId (lock owner token)
-- ARGV[2] = TTL in seconds
--
-- Returns 1 if the lock was acquired, 0 if the seat is already locked.
-- Equivalent to `SET key reservationId NX EX ttl`, expressed as a script so
-- it can be extended later (e.g. tracking lock acquisition metrics) while
-- remaining a single atomic Redis operation.

local key = KEYS[1]
local reservationId = ARGV[1]
local ttl = tonumber(ARGV[2])

local existing = redis.call('GET', key)
if existing then
  return 0
end

redis.call('SET', key, reservationId, 'EX', ttl)
return 1
