-- Add a unique constraint on (user_id, queue_type) to multiplayer_queue
-- This enables upsert/onConflict operations to work properly for the duel queue
ALTER TABLE multiplayer_queue
ADD CONSTRAINT multiplayer_queue_user_id_queue_type_key
UNIQUE (user_id, queue_type);