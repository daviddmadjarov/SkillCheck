-- =============================================================================
-- Comprehensive Duel System Fix — Queue, Forfeit, and State Reliability
-- =============================================================================
-- Root cause of queue ghost-players: atomic_matchmake_duel Step 6 does an
-- INSERT instead of UPSERT, which fails silently on unique constraint. The
-- unmatched 'waiting' rows persist for up to 3 minutes.
--
-- Root cause of false forfeits: lobby players get last_heartbeat_at = now()
-- at creation, but the first heartbeat may not arrive for >30s due to page
-- load time + MultiplayerSessionGuard mount timing.
--
-- This migration fixes both issues and adds cleanup safeguards.
-- =============================================================================

-- =============================================================================
-- PART 1: Fix atomic_matchmake_duel — use UPSERT instead of INSERT at Step 6
-- =============================================================================

-- Drop and recreate the core matchmaking function with the fix
DROP FUNCTION IF EXISTS public.atomic_matchmake_duel(uuid, text);

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
  -- ── Step 0: Purge stale queue entries (> 2 minutes old, reduced from 3) ──
  DELETE FROM multiplayer_queue
  WHERE queue_type = 'duel'
    AND status = 'waiting'
    AND requested_at < now() - interval '2 minutes';

  -- Also purge stale 'matched' entries where the lobby doesn't exist or is finished
  DELETE FROM multiplayer_queue mq
  WHERE mq.queue_type = 'duel'
    AND mq.status = 'matched'
    AND (
      mq.matched_code IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM multiplayer_lobbies ml
        WHERE ml.code = mq.matched_code AND ml.status = 'live'
      )
      OR mq.requested_at < now() - interval '10 minutes'
    );

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
    -- Check if the matched lobby is still live
    IF EXISTS (
      SELECT 1 FROM multiplayer_queue mq
      INNER JOIN multiplayer_lobbies ml ON ml.code = mq.matched_code
      WHERE mq.user_id = p_user_id
        AND mq.queue_type = 'duel'
        AND mq.status = 'matched'
        AND ml.status = 'live'
    ) THEN
      RETURN jsonb_build_object(
        'action', 'already_matched',
        'status', 'matched'
      );
    ELSE
      -- Lobby is dead — clean up and re-queue
      DELETE FROM multiplayer_queue
      WHERE user_id = p_user_id AND queue_type = 'duel';
      v_existing_status := NULL;
    END IF;
  END IF;

  -- ── Step 2: Purge any stale rows for this user ──
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

  -- ── Step 6: UPSERT both players as matched (FIXED: was INSERT, now uses ON CONFLICT) ──
  -- The caller may already have a row from the concurrent waiting INSERT above.
  -- Using INSERT ... ON CONFLICT DO UPDATE ensures exactly one row per player.
  INSERT INTO multiplayer_queue (user_id, queue_type, status, matched_code, requested_at)
  VALUES (p_user_id, 'duel', 'matched', v_lobby_code, now())
  ON CONFLICT (user_id, queue_type) DO UPDATE
  SET status = 'matched',
      matched_code = v_lobby_code,
      requested_at = now();

  UPDATE multiplayer_queue
  SET status = 'matched',
      matched_code = v_lobby_code,
      requested_at = now()
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

-- =============================================================================
-- PART 2: Fix process_duel_forfeit — add lobby-creation grace period
-- =============================================================================

DROP FUNCTION IF EXISTS public.process_duel_forfeit(text, uuid);

CREATE OR REPLACE FUNCTION public.process_duel_forfeit(
  p_lobby_code text,
  p_checking_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lobby record;
  v_absent_player record;
  v_active_player record;
  v_heartbeat_grace interval := interval '30 seconds';
  v_lobby_grace interval := interval '45 seconds';  -- Extra grace from lobby creation
  v_result jsonb;
  v_lobby_age interval;
BEGIN
  -- Find the lobby
  SELECT * INTO v_lobby
  FROM multiplayer_lobbies
  WHERE code = p_lobby_code
    AND mode = 'duel'
    AND status = 'live';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('action', 'no_lobby');
  END IF;

  -- ── Mark current caller as alive ──
  IF p_checking_user_id IS NOT NULL THEN
    UPDATE multiplayer_lobby_players
    SET last_heartbeat_at = now()
    WHERE lobby_id = v_lobby.id
      AND user_id = p_checking_user_id;
  END IF;

  -- ── Calculate lobby age ──
  v_lobby_age := now() - v_lobby.created_at;

  -- ── During the initial grace window (45s from lobby creation), never forfeit anyone ──
  -- This prevents false forfeits while both players are loading the game page.
  IF v_lobby_age < v_lobby_grace THEN
    RETURN jsonb_build_object(
      'action', 'all_present',
      'lobby_age_seconds', extract(epoch from v_lobby_age)::integer
    );
  END IF;

  -- ── After the lobby grace period, use the standard 30s heartbeat check ──
  SELECT * INTO v_absent_player
  FROM multiplayer_lobby_players
  WHERE lobby_id = v_lobby.id
    AND forfeited = false
    AND last_heartbeat_at < now() - v_heartbeat_grace
  ORDER BY last_heartbeat_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    -- All players are still sending heartbeats
    RETURN jsonb_build_object('action', 'all_present');
  END IF;

  -- ── Absent player found — mark them as forfeited ──
  UPDATE multiplayer_lobby_players
  SET forfeited = true
  WHERE id = v_absent_player.id;

  -- Find the active (non-forfeited) player
  SELECT * INTO v_active_player
  FROM multiplayer_lobby_players
  WHERE lobby_id = v_lobby.id
    AND forfeited = false
  LIMIT 1;

  IF NOT FOUND THEN
    -- Both players disconnected — end the match
    UPDATE multiplayer_lobbies
    SET status = 'finished',
        forfeited = true,
        updated_at = now()
    WHERE id = v_lobby.id;

    RETURN jsonb_build_object('action', 'both_disconnected');
  END IF;

  -- Award win to the active player
  v_result := process_duel_completion(v_lobby.id, v_active_player.user_id);

  -- Mark lobby as forfeited
  UPDATE multiplayer_lobbies
  SET forfeited = true,
      updated_at = now()
  WHERE id = v_lobby.id;

  RETURN jsonb_build_object(
    'action', 'forfeited',
    'winner_user_id', v_active_player.user_id,
    'winner_display_name', v_active_player.display_name,
    'loser_user_id', v_absent_player.user_id,
    'loser_display_name', v_absent_player.display_name,
    'elo_result', v_result
  );
END;
$$;

-- =============================================================================
-- PART 3: New RPC — unqueue_player (atomic removal from queue with stats return)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.unqueue_player(
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count integer;
  v_waiting_count integer;
  v_playing_count integer;
BEGIN
  -- Remove ALL queue entries for this user (any status, any queue_type)
  -- This handles the case where a user has stale rows in multiple states.
  DELETE FROM multiplayer_queue
  WHERE user_id = p_user_id
    AND queue_type = 'duel';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- Return updated stats
  SELECT count(*)::integer INTO v_waiting_count
  FROM multiplayer_queue
  WHERE queue_type = 'duel' AND status = 'waiting';

  SELECT coalesce(count(DISTINCT mlp.user_id), 0)::integer INTO v_playing_count
  FROM multiplayer_lobby_players mlp
  INNER JOIN multiplayer_lobbies ml ON ml.id = mlp.lobby_id
  WHERE ml.mode = 'duel' AND ml.status = 'live';

  RETURN jsonb_build_object(
    'action', 'unqueued',
    'removed_entries', v_deleted_count,
    'waiting', v_waiting_count,
    'playing', v_playing_count
  );
END;
$$;

-- =============================================================================
-- PART 4: Updated cleanup function (runs more aggressively)
-- =============================================================================

DROP FUNCTION IF EXISTS public.cleanup_duel_queue();

CREATE OR REPLACE FUNCTION public.cleanup_duel_queue()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_removed integer;
  v_finished_lobbies integer;
BEGIN
  -- Remove queue entries where matched lobby is finished
  WITH finished AS (
    DELETE FROM multiplayer_queue
    WHERE queue_type = 'duel'
      AND status = 'matched'
      AND matched_code IN (
        SELECT ml.code FROM multiplayer_lobbies ml
        WHERE ml.mode = 'duel' AND ml.status = 'finished'
      )
    RETURNING id
  )
  SELECT count(*) INTO v_removed FROM finished;

  -- Remove stale waiting entries (> 2 minutes)
  WITH stale AS (
    DELETE FROM multiplayer_queue
    WHERE queue_type = 'duel'
      AND status = 'waiting'
      AND requested_at < now() - interval '2 minutes'
    RETURNING id
  )
  SELECT v_removed + count(*) INTO v_removed FROM stale;

  -- Mark expired live lobbies as finished (> 1 hour)
  UPDATE multiplayer_lobbies
  SET status = 'finished'
  WHERE mode = 'duel'
    AND status = 'live'
    AND created_at < now() - interval '1 hour';

  GET DIAGNOSTICS v_finished_lobbies = ROW_COUNT;

  RETURN jsonb_build_object(
    'cleaned_queue_entries', v_removed,
    'finished_expired_lobbies', v_finished_lobbies
  );
END;
$$;

-- =============================================================================
-- PART 5: Grant permissions
-- =============================================================================
GRANT EXECUTE ON FUNCTION public.atomic_matchmake_duel(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_duel_forfeit(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unqueue_player(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_duel_queue() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_duel_queue_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_duel_completion(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_elo(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_elo_leaderboard(integer) TO authenticated;

-- =============================================================================
-- PART 6: Ensure indexes exist for performance
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_queue_user_type_status
ON public.multiplayer_queue (user_id, queue_type, status);

CREATE INDEX IF NOT EXISTS idx_queue_status_requested
ON public.multiplayer_queue (status, requested_at)
WHERE queue_type = 'duel';

CREATE INDEX IF NOT EXISTS idx_lobby_players_user
ON public.multiplayer_lobby_players (user_id, lobby_id);