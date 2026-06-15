-- =============================================================================
-- Complete Duel Matchmaking Rewrite — Atomic PostgreSQL Functions
-- =============================================================================
-- This migration replaces the unreliable multi-step matchmaking with a single
-- atomic PostgreSQL function that locks, matches, creates lobbies, and seats
-- players all within one transaction.
-- =============================================================================

-- 1. Add unique constraint (if not already present from previous migration)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'multiplayer_queue_user_id_queue_type_key'
  ) THEN
    ALTER TABLE public.multiplayer_queue
    ADD CONSTRAINT multiplayer_queue_user_id_queue_type_key
    UNIQUE (user_id, queue_type);
  END IF;
END $$;

-- 2. Core atomic matchmaking function
--    This runs inside a single transaction. FOR UPDATE SKIP LOCKED ensures
--    no two callers can match the same opponent or create duplicate lobbies.
CREATE OR REPLACE FUNCTION public.atomic_matchmake_duel(
  p_user_id uuid,
  p_display_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opponent_record record;
  v_lobby_id uuid;
  v_lobby_code text;
  v_my_seat_id uuid;
  v_opp_seat_id uuid;
  v_opp_display_name text;
  v_existing_status text;
BEGIN
  -- ── Step 0: Purge stale queue entries (> 3 minutes old) ──
  DELETE FROM multiplayer_queue
  WHERE queue_type = 'duel'
    AND status = 'waiting'
    AND requested_at < now() - interval '3 minutes';

  -- ── Step 1: Check caller's current queue status ──
  SELECT status INTO v_existing_status
  FROM multiplayer_queue
  WHERE user_id = p_user_id AND queue_type = 'duel';

  IF v_existing_status = 'waiting' THEN
    -- Already in queue — just return current state
    RETURN jsonb_build_object(
      'action', 'already_waiting',
      'status', 'waiting'
    );
  END IF;

  IF v_existing_status = 'matched' THEN
    -- Already matched — return existing match info
    RETURN jsonb_build_object(
      'action', 'already_matched',
      'status', 'matched'
    );
  END IF;

  -- ── Step 2: Purge the caller's own stale row if it exists ──
  DELETE FROM multiplayer_queue
  WHERE user_id = p_user_id AND queue_type = 'duel';

  -- ── Step 3: Atomically look for an opponent ──
  SELECT *
  INTO v_opponent_record
  FROM multiplayer_queue
  WHERE queue_type = 'duel'
    AND status = 'waiting'
    AND user_id != p_user_id
  ORDER BY requested_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    -- ── No opponent available; insert caller as waiting ──
    INSERT INTO multiplayer_queue (user_id, queue_type, status, requested_at)
    VALUES (p_user_id, 'duel', 'waiting', now());

    RETURN jsonb_build_object(
      'action', 'queued',
      'status', 'waiting'
    );
  END IF;

  -- ── Step 4: Match found! Create the lobby ──
  v_lobby_code := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6));

  -- Look up opponent display name
  SELECT username INTO v_opp_display_name
  FROM profiles
  WHERE id = v_opponent_record.user_id;

  IF v_opp_display_name IS NULL THEN
    v_opp_display_name := 'Player_' || left(v_opponent_record.user_id::text, 6);
  END IF;

  INSERT INTO multiplayer_lobbies (
    code, host_id, mode, status, max_players,
    selected_games, game_order, current_game_index
  ) VALUES (
    v_lobby_code, p_user_id, 'duel', 'live', 2,
    '{}'::text[], '{}'::text[], 0
  )
  RETURNING id INTO v_lobby_id;

  -- ── Step 5: Seat both players atomically ──
  INSERT INTO multiplayer_lobby_players (lobby_id, user_id, display_name, seat_index)
  VALUES (v_lobby_id, p_user_id, p_display_name, 0)
  RETURNING id INTO v_my_seat_id;

  INSERT INTO multiplayer_lobby_players (lobby_id, user_id, display_name, seat_index)
  VALUES (v_lobby_id, v_opponent_record.user_id, v_opp_display_name, 1)
  RETURNING id INTO v_opp_seat_id;

  -- ── Step 6: Mark both players as matched ──
  INSERT INTO multiplayer_queue (user_id, queue_type, status, matched_code)
  VALUES (p_user_id, 'duel', 'matched', v_lobby_code);

  UPDATE multiplayer_queue
  SET status = 'matched',
      matched_code = v_lobby_code
  WHERE id = v_opponent_record.id;

  -- ── Step 7: Return match details ──
  RETURN jsonb_build_object(
    'action', 'matched',
    'status', 'matched',
    'lobby_code', v_lobby_code,
    'player_id', v_my_seat_id,
    'opponent_id', v_opp_seat_id,
    'opponent_name', v_opp_display_name
  );
END;
$$;

-- 3. Queue statistics helper (returns waiting count AND playing count)
CREATE OR REPLACE FUNCTION public.get_duel_queue_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_waiting_count integer;
  v_playing_count integer;
BEGIN
  SELECT count(*)::integer INTO v_waiting_count
  FROM multiplayer_queue
  WHERE queue_type = 'duel' AND status = 'waiting';

  SELECT coalesce(count(DISTINCT mlp.user_id), 0)::integer INTO v_playing_count
  FROM multiplayer_lobby_players mlp
  INNER JOIN multiplayer_lobbies ml ON ml.id = mlp.lobby_id
  WHERE ml.mode = 'duel' AND ml.status = 'live';

  RETURN jsonb_build_object(
    'waiting', v_waiting_count,
    'playing', v_playing_count
  );
END;
$$;

-- 4. Cleanup: remove stale entries and orphaned matches
CREATE OR REPLACE FUNCTION public.cleanup_duel_queue()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_removed integer;
BEGIN
  -- Remove queue entries where any player has been in a live lobby > 30 min ago
  UPDATE multiplayer_queue
  SET status = 'cancelled'
  WHERE queue_type = 'duel'
    AND status = 'matched'
    AND matched_code IN (
      SELECT ml.code
      FROM multiplayer_lobbies ml
      WHERE ml.mode = 'duel'
        AND ml.status = 'finished'
    );

  -- Remove stale waiting entries (> 3 min)
  DELETE FROM multiplayer_queue
  WHERE queue_type = 'duel'
    AND status = 'waiting'
    AND requested_at < now() - interval '3 minutes';

  GET DIAGNOSTICS v_removed = ROW_COUNT;

  -- Mark expired live lobbies as finished (> 1 hour)
  UPDATE multiplayer_lobbies
  SET status = 'finished'
  WHERE mode = 'duel'
    AND status = 'live'
    AND created_at < now() - interval '1 hour';

  RETURN jsonb_build_object('cleaned', v_removed);
END;
$$;

-- 5. Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.atomic_matchmake_duel(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_duel_queue_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_duel_queue() TO authenticated;