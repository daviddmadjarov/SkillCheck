-- =============================================================================
-- Fix: process_duel_forfeit now considers game submissions before awarding win
-- =============================================================================
-- Previous behavior: Win always went to whoever had a recent heartbeat,
-- even if the "absent" player had actually completed their games and
-- navigated away (e.g., intermission page closed).
--
-- New behavior: When detecting a forfeit, check which player completed
-- more rounds and award the win to the player with more submitted results.
-- If both have equal submissions, fall back to heartbeat-based logic.
-- =============================================================================

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
  v_winner_player record;
  v_loser_player record;
  v_grace_period interval := interval '30 seconds';
  v_absent_submissions integer;
  v_active_submissions integer;
  v_result jsonb;
BEGIN
  -- Find lobbies in live mode
  SELECT * INTO v_lobby
  FROM multiplayer_lobbies
  WHERE code = p_lobby_code
    AND mode = 'duel'
    AND status = 'live';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('action', 'no_lobby');
  END IF;

  -- Mark current caller as alive
  IF p_checking_user_id IS NOT NULL THEN
    UPDATE multiplayer_lobby_players
    SET last_heartbeat_at = now()
    WHERE lobby_id = v_lobby.id
      AND user_id = p_checking_user_id;
  END IF;

  -- Check for absent players (heartbeat > 30 seconds ago)
  SELECT * INTO v_absent_player
  FROM multiplayer_lobby_players
  WHERE lobby_id = v_lobby.id
    AND forfeited = false
    AND last_heartbeat_at < now() - v_grace_period
  ORDER BY last_heartbeat_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    -- All players are still here
    RETURN jsonb_build_object('action', 'all_present');
  END IF;

  -- Absent player found — mark them as forfeited
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
    -- Both players disconnected somehow — just end the match
    UPDATE multiplayer_lobbies
    SET status = 'finished',
        forfeited = true,
        updated_at = now()
    WHERE id = v_lobby.id;

    RETURN jsonb_build_object('action', 'both_disconnected');
  END IF;

  -- ── CRITICAL FIX: Compare game submissions before awarding win ──
  -- Count how many rounds each player has submitted results for
  SELECT COUNT(*) INTO v_absent_submissions
  FROM multiplayer_game_results
  WHERE lobby_code = p_lobby_code
    AND player_id = v_absent_player.id;

  SELECT COUNT(*) INTO v_active_submissions
  FROM multiplayer_game_results
  WHERE lobby_code = p_lobby_code
    AND player_id = v_active_player.id;

  -- If the absent (heartbeat-lost) player actually completed MORE rounds
  -- than the "active" player, the absent player should win instead.
  -- This prevents the scenario where Player A plays all rounds, closes
  -- their tab, and Player B (who never played) gets a free win.
  IF v_absent_submissions > v_active_submissions THEN
    v_winner_player := v_absent_player;
    v_loser_player := v_active_player;

    -- Unmark the true winner's forfeit flag
    UPDATE multiplayer_lobby_players
    SET forfeited = false
    WHERE id = v_absent_player.id;

    -- Mark the true loser as forfeited instead
    UPDATE multiplayer_lobby_players
    SET forfeited = true
    WHERE id = v_active_player.id;
  ELSE
    v_winner_player := v_active_player;
    v_loser_player := v_absent_player;
  END IF;

  -- Award win to the determined winner via Elo
  v_result := process_duel_completion(v_lobby.id, v_winner_player.user_id);

  -- Mark lobby as forfeited
  UPDATE multiplayer_lobbies
  SET forfeited = true,
      updated_at = now()
  WHERE id = v_lobby.id;

  RETURN jsonb_build_object(
    'action', 'forfeited',
    'winner_user_id', v_winner_player.user_id,
    'winner_display_name', v_winner_player.display_name,
    'loser_user_id', v_loser_player.user_id,
    'loser_display_name', v_loser_player.display_name,
    'elo_result', v_result
  );
END;
$$;

-- Re-grant execute permission
GRANT EXECUTE ON FUNCTION public.process_duel_forfeit(text, uuid) TO authenticated;