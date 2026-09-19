-- release-seat-lock.lua
-- KEYS[1] = seat lock key
-- ARGV[1] = reservationId (expected lock owner token)
--
-- Only deletes the key if its current value matches the caller's
-- reservationId. This prevents a delayed/late release call from one
-- reservation from destroying a *different* reservation's lock that
-- was legitimately acquired after the first one expired.
--
-- Returns 1 if deleted, 0 if the key didn't exist or was owned by someone else.

local key = KEYS[1]
local reservationId = ARGV[1]

local current = redis.call('GET', key)
if current == reservationId then
  redis.call('DEL', key)
  return 1
end

return 0
