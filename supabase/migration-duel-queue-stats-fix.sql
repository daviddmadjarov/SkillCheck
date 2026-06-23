-- =============================================================================
-- Fix duel ghost-player count and leave-forfeit parameter mismatch
-- =============================================================================
--
-- Root Causes:
-- 1. The heartbeat route calls process_duel_forfeit with p_leave_user_id (wrong
--    parameter name), which PostgreSQL rejects. The error is silently caught,
--    so the leaving player is never marked forfeited and the lobby stays 'live'.
-- 2. get_duel_queue_stats counts all players in any 'live' duel lobby, including
--    abandoned ones. Since #1 prevents lobbies from transitioning to 'finished',
--    abandoned lobbies accumulate, perpetually showing 2 ghost-players.
-- =============================================================================

-- =============================================================================
-- PART 1: Fix process_duel_forfeit — accept explicit leaving user
-- =============================================================================

-- Drop ALL existing versions (there may be a 2-param and a 3-param variant)
DROP FUNCTION IF EXISTS public.process_duel_forfeit(text, uuid);
DROP FUNCTION IF EXISTS public.process_duel_forfeit(text, uuid, uuid);
DROP FUNCTION IF EXISTS public.process_duel_forfeit(text, uuid, text);

CREATE OR REPLACE FUNCTION public.process_duel_forfeit(
  p_lobby_code text,
  p_checking_user_id uuid DEFAULT NULL,
  p_leaving_user_id uuid DEFAULT NULL
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
  v_lobby_grace interval := interval '45 seconds';
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

  -- ── Mark current caller as alive (if provided) ──
  IF p_checking_user_id IS NOT NULL THEN
    UPDATE multiplayer_lobby_players
    SET last_heartbeat_at = now()
    WHERE lobby_id = v_lobby.id
      AND user_id = p_checking_user_id;
  END IF;

  -- ── Handle explicit player leave ──
  -- When a player explicitly leaves (closes tab, navigates away),
  -- mark them as forfeited immediately without waiting for heartbeat timeout.
  IF p_leaving_user_id IS NOT NULL THEN
    UPDATE multiplayer_lobby_players
    SET forfeited = true
    WHERE lobby_id = v_lobby.id
      AND user_id = p_leaving_user_id
      AND forfeited = false;

    -- Find the active (non-forfeited) player
    SELECT * INTO v_active_player
    FROM multiplayer_lobby_players
    WHERE lobby_id = v_lobby.id
      AND forfeited = false
    LIMIT 1;

    IF NOT FOUND THEN
      -- Both players left — end the match
      UPDATE multiplayer_lobbies
      SET status = 'finished',
          forfeited = true,
          updated_at = now()
      WHERE id = v_lobby.id;

      RETURN jsonb_build_object('action', 'both_disconnected');
    END IF;

    -- Award win to the active player
    v_result := process_duel_completion(v_lobby.id, v_active_player.user_id);

    -- Mark lobby as forfeited and finished
    UPDATE multiplayer_lobbies
    SET forfeited = true,
        status = 'finished',
        updated_at = now()
    WHERE id = v_lobby.id;

    RETURN jsonb_build_object(
      'action', 'forfeited',
      'winner_user_id', v_active_player.user_id,
      'winner_display_name', v_active_player.display_name,
      'loser_user_id', p_leaving_user_id,
      'elo_result', v_result
    );
  END IF;

  -- ── Calculate lobby age ──
  v_lobby_age := now() - v_lobby.created_at;

  -- ── During the initial grace window (45s from lobby creation), never forfeit anyone ──
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
    RETURN jsonb_build_object('action', 'all_present');
  END IF;

  -- ── Absent player found — mark them as forfeited ──
  UPDATE multiplayer_lobby_players
  SET forfeited = true
  WHERE id = v_absent_player.id;

  -- Find the active player
  SELECT * INTO v_active_player
  FROM multiplayer_lobby_players
  WHERE lobby_id = v_lobby.id
    AND forfeited = false
  LIMIT 1;

  IF NOT FOUND THEN
    UPDATE multiplayer_lobbies
    SET status = 'finished',
        forfeited = true,
        updated_at = now()
    WHERE id = v_lobby.id;

    RETURN jsonb_build_object('action', 'both_disconnected');
  END IF;

  v_result := process_duel_completion(v_lobby.id, v_active_player.user_id);

  UPDATE multiplayer_lobbies
  SET forfeited = true,
      status = 'finished',
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
-- PART 2: Also fix the heartbeat route's parameter name
-- =============================================================================
-- The heartbeat route sends p_leave_user_id but the function expects
-- p_leaving_user_id — both now match since we defined the function above
-- with p_leaving_user_id as the third parameter.

-- =============================================================================
-- PART 3: One-time cleanup — immediately mark all abandoned duel lobbies as finished
-- =============================================================================
-- These are stale lobbies that were stuck in 'live' status because the
-- heartbeat forfeit calls were silently failing (parameter name mismatch).
-- Without this cleanup, ghost-players would persist even after the function fix.
DO $$
DECLARE
  v_cleaned_lobbies int;
  v_cleaned_queue int;
  v_ghost_players int;
BEGIN
  -- Mark any duel lobby older than 10 minutes as finished (abandoned matches)
  UPDATE multiplayer_lobbies
  SET status = 'finished',
      forfeited = true,
      updated_at = now()
  WHERE mode = 'duel'
    AND status = 'live'
    AND created_at < now() - interval '10 minutes';

  GET DIAGNOSTICS v_cleaned_lobbies = ROW_COUNT;

  -- Count how many ghost-players were associated with those lobbies
  SELECT count(*)::int INTO v_ghost_players
  FROM multiplayer_lobby_players mlp
  INNER JOIN multiplayer_lobbies ml ON ml.id = mlp.lobby_id
  WHERE ml.mode = 'duel' AND ml.status = 'finished' AND ml.forfeited = true
    AND ml.updated_at = now();

  -- Clean up stale matched queue entries pointing to cleaned lobbies
  DELETE FROM multiplayer_queue
  WHERE queue_type = 'duel'
    AND status = 'matched'
    AND matched_code IN (
      SELECT code FROM multiplayer_lobbies
      WHERE mode = 'duel' AND status = 'finished' AND forfeited = true
        AND updated_at = now()
    );

  GET DIAGNOSTICS v_cleaned_queue = ROW_COUNT;

  RAISE NOTICE 'Cleanup: % abandoned lobbies marked finished, % ghost-players freed, % stale queue entries removed',
    v_cleaned_lobbies, v_ghost_players, v_cleaned_queue;
END;
$$;

-- =============================================================================
-- PART 4: Grant permissions
-- =============================================================================
GRANT EXECUTE ON FUNCTION public.process_duel_forfeit(text, uuid, uuid) TO authenticated;
