-- =============================================================================
-- Fix stuck matches + Elo idempotency
-- =============================================================================

-- 1. Update atomic_matchmake_duel to:
--    - Close any "live" duel lobby where the caller is seated but stale
--    - Purge matched queue entries for finished/closed lobbies
--    - Never return "already_matched" for lobbies that are finished

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
  v_existing_code text;
  v_stale_lobby record;
  v_other_player record;
BEGIN
  -- ── Step 0: Purge stale queue entries (> 3 minutes old) ──
  DELETE FROM multiplayer_queue
  WHERE queue_type = 'duel'
    AND status = 'waiting'
    AND requested_at < now() - interval '3 minutes';

  -- ── Step 1: Check caller's current queue status ──
  SELECT status, matched_code INTO v_existing_status, v_existing_code
  FROM multiplayer_queue
  WHERE user_id = p_user_id AND queue_type = 'duel';

  -- ── Step 1a: If already matched, check if the lobby is still valid ──
  IF v_existing_status = 'matched' AND v_existing_code IS NOT NULL THEN
    -- Check if this lobby actually exists and is live
    SELECT * INTO v_stale_lobby
    FROM multiplayer_lobbies
    WHERE code = v_existing_code
      AND mode = 'duel';

    IF NOT FOUND OR v_stale_lobby.status = 'finished' THEN
      -- Lobby doesn't exist or is already finished — clear the matched entry
      DELETE FROM multiplayer_queue
      WHERE user_id = p_user_id AND queue_type = 'duel';

      -- Reset and continue to look for a fresh match
      v_existing_status := NULL;
      v_existing_code := NULL;
    ELSE
      -- Return the existing match so the caller can continue it
      RETURN jsonb_build_object(
        'action', 'already_matched',
        'status', 'matched',
        'lobby_code', v_existing_code
      );
    END IF;
  END IF;

  IF v_existing_status = 'waiting' THEN
    RETURN jsonb_build_object(
      'action', 'already_waiting',
      'status', 'waiting'
    );
  END IF;

  -- ── Step 2: Purge the caller's own row if it exists ──
  DELETE FROM multiplayer_queue
  WHERE user_id = p_user_id AND queue_type = 'duel';

  -- ── Step 2b: Also force-close any "live" duel lobby where the caller
  --    has a seat but the lobby is stale (> 2 min old, meaning the match
  --    never properly started or the other player never joined).
  FOR v_stale_lobby IN
    SELECT ml.id, ml.code
    FROM multiplayer_lobbies ml
    INNER JOIN multiplayer_lobby_players mlp ON mlp.lobby_id = ml.id
    WHERE ml.mode = 'duel'
      AND ml.status = 'live'
      AND mlp.user_id = p_user_id
      AND ml.created_at < now() - interval '2 minutes'
  LOOP
    -- Find the other player in this lobby and also clear their queue
    FOR v_other_player IN
      SELECT user_id FROM multiplayer_lobby_players
      WHERE lobby_id = v_stale_lobby.id AND user_id != p_user_id
    LOOP
      -- Clear the other player's matched queue entry
      DELETE FROM multiplayer_queue
      WHERE user_id = v_other_player.user_id AND queue_type = 'duel' AND status = 'matched';
    END LOOP;

    -- Remove the stale lobby players
    DELETE FROM multiplayer_lobby_players WHERE lobby_id = v_stale_lobby.id;

    -- Mark the lobby as finished
    UPDATE multiplayer_lobbies
    SET status = 'finished',
        updated_at = now()
    WHERE id = v_stale_lobby.id;

    -- Clear our own matched queue entry too
    DELETE FROM multiplayer_queue
    WHERE user_id = p_user_id AND queue_type = 'duel';
  END LOOP;

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
    INSERT INTO multiplayer_queue (user_id, queue_type, status, requested_at)
    VALUES (p_user_id, 'duel', 'waiting', now());

    RETURN jsonb_build_object(
      'action', 'queued',
      'status', 'waiting'
    );
  END IF;

  -- ── Step 4: Create the lobby ──
  v_lobby_code := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6));

  SELECT username INTO v_opp_display_name
  FROM profiles WHERE id = v_opponent_record.user_id;

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

  INSERT INTO multiplayer_lobby_players (lobby_id, user_id, display_name, seat_index, last_heartbeat_at)
  VALUES (v_lobby_id, p_user_id, p_display_name, 0, now())
  RETURNING id INTO v_my_seat_id;

  INSERT INTO multiplayer_lobby_players (lobby_id, user_id, display_name, seat_index, last_heartbeat_at)
  VALUES (v_lobby_id, v_opponent_record.user_id, v_opp_display_name, 1, now())
  RETURNING id INTO v_opp_seat_id;

  -- Mark caller as matched
  INSERT INTO multiplayer_queue (user_id, queue_type, status, matched_code)
  VALUES (p_user_id, 'duel', 'matched', v_lobby_code);

  -- Mark opponent as matched
  UPDATE multiplayer_queue
  SET status = 'matched',
      matched_code = v_lobby_code
  WHERE id = v_opponent_record.id;

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

-- 2. Make process_duel_completion idempotent — skip if already finished
CREATE OR REPLACE FUNCTION public.process_duel_completion(
  p_lobby_id uuid,
  p_winner_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lobby_record record;
  v_loser_record record;
  v_winner_rating integer;
  v_loser_rating integer;
  v_elo_result jsonb;
  v_winner_new integer;
  v_loser_new integer;
BEGIN
  -- Check if lobby is already finished — if so, skip (idempotent)
  SELECT * INTO v_lobby_record FROM multiplayer_lobbies WHERE id = p_lobby_id AND mode = 'duel';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Lobby not found');
  END IF;

  IF v_lobby_record.status = 'finished' THEN
    -- Already processed — return the existing Elo values
    SELECT elo_rating INTO v_winner_new FROM profiles WHERE id = p_winner_user_id;
    SELECT elo_rating INTO v_loser_new FROM profiles WHERE id != p_winner_user_id AND id IN (
      SELECT user_id FROM multiplayer_lobby_players WHERE lobby_id = p_lobby_id
    ) LIMIT 1;

    RETURN jsonb_build_object(
      'already_processed', true,
      'winner_new_elo', v_winner_new,
      'loser_new_elo', v_loser_new
    );
  END IF;

  -- Mark lobby as finished
  UPDATE multiplayer_lobbies
  SET status = 'finished',
      winner_user_id = p_winner_user_id,
      updated_at = now()
  WHERE id = p_lobby_id
    AND status = 'live';

  -- Find the loser
  SELECT user_id INTO v_loser_record
  FROM multiplayer_lobby_players
  WHERE lobby_id = p_lobby_id
    AND user_id != p_winner_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Could not find opponent');
  END IF;

  -- Get current Elo ratings
  SELECT coalesce(elo_rating, 1000) INTO v_winner_rating
  FROM profiles WHERE id = p_winner_user_id;

  SELECT coalesce(elo_rating, 1000) INTO v_loser_rating
  FROM profiles WHERE id = v_loser_record.user_id;

  -- Calculate new Elo
  v_elo_result := calculate_elo(v_winner_rating, v_loser_rating);
  v_winner_new := (v_elo_result->>'winner_new')::integer;
  v_loser_new := (v_elo_result->>'loser_new')::integer;

  -- Update winner profile
  UPDATE profiles
  SET elo_rating = v_winner_new,
      peak_elo = greatest(peak_elo, v_winner_new),
      duel_wins = duel_wins + 1
  WHERE id = p_winner_user_id;

  -- Update loser profile
  UPDATE profiles
  SET elo_rating = v_loser_new,
      duel_losses = duel_losses + 1
  WHERE id = v_loser_record.user_id;

  -- Clean up queue entries for both players
  DELETE FROM multiplayer_queue
  WHERE (user_id = p_winner_user_id OR user_id = v_loser_record.user_id)
    AND queue_type = 'duel';

  RETURN jsonb_build_object(
    'winner_new_elo', v_winner_new,
    'loser_new_elo', v_loser_new,
    'elo_delta', v_elo_result->>'delta'
  );
END;
$$;

-- 3. Update process_duel_forfeit to also clean queue entries
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
  v_grace_period interval := interval '30 seconds';
  v_result jsonb;
BEGIN
  SELECT * INTO v_lobby
  FROM multiplayer_lobbies
  WHERE code = p_lobby_code
    AND mode = 'duel';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('action', 'no_lobby');
  END IF;

  -- If lobby is already finished, just return the result
  IF v_lobby.status = 'finished' THEN
    RETURN jsonb_build_object('action', 'already_finished');
  END IF;

  -- Mark current caller as alive
  IF p_checking_user_id IS NOT NULL THEN
    UPDATE multiplayer_lobby_players
    SET last_heartbeat_at = now()
    WHERE lobby_id = v_lobby.id
      AND user_id = p_checking_user_id;
  END IF;

  -- Check for absent players
  SELECT * INTO v_absent_player
  FROM multiplayer_lobby_players
  WHERE lobby_id = v_lobby.id
    AND forfeited = false
    AND last_heartbeat_at < now() - v_grace_period
  ORDER BY last_heartbeat_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('action', 'all_present');
  END IF;

  -- Mark absent player as forfeited
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
    UPDATE multiplayer_lobbies SET status = 'finished', forfeited = true, updated_at = now() WHERE id = v_lobby.id;
    RETURN jsonb_build_object('action', 'both_disconnected');
  END IF;

  -- Award win + Elo
  v_result := process_duel_completion(v_lobby.id, v_active_player.user_id);

  UPDATE multiplayer_lobbies SET forfeited = true, updated_at = now() WHERE id = v_lobby.id;

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