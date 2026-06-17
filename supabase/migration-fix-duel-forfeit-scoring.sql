-- =============================================================================
-- Simplify: process_duel_forfeit now only handles explicit disconnects
-- =============================================================================
-- Previous behavior: Automatically detected "absent" players by heartbeat
-- timestamps (30-second grace period) and forfeited them — causing false
-- forfeits when players were actively playing but not constantly moving
-- their mouse, clicking, or sending heartbeats.
--
-- New behavior: Only triggers forfeit when a player explicitly leaves
-- (e.g., closes tab, navigates away, logs out). No automatic AFK detection
-- during active gameplay. Idle players are never forfeited.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.process_duel_forfeit(
  p_lobby_code text,
  p_checking_user_id uuid DEFAULT NULL,
  p_leave_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lobby record;
  v_leaver_player record;
  v_remaining_player record;
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

  -- If p_leave_user_id is provided, this is an explicit disconnect
  IF p_leave_user_id IS NOT NULL THEN
    -- Find the leaver
    SELECT * INTO v_leaver_player
    FROM multiplayer_lobby_players
    WHERE lobby_id = v_lobby.id
      AND user_id = p_leave_user_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('action', 'player_not_found');
    END IF;

    -- Find the remaining player (the one who didn't leave)
    SELECT * INTO v_remaining_player
    FROM multiplayer_lobby_players
    WHERE lobby_id = v_lobby.id
      AND user_id != p_leave_user_id
    LIMIT 1;

    IF NOT FOUND THEN
      -- Both players somehow left — just end the match
      UPDATE multiplayer_lobbies
      SET status = 'finished',
          forfeited = true,
          updated_at = now()
      WHERE id = v_lobby.id;

      RETURN jsonb_build_object('action', 'both_disconnected');
    END IF;

    -- Mark the leaver as forfeited
    UPDATE multiplayer_lobby_players
    SET forfeited = true,
        last_heartbeat_at = now()
    WHERE id = v_leaver_player.id;

    -- Award win to the remaining player via Elo
    v_result := process_duel_completion(v_lobby.id, v_remaining_player.user_id);

    -- Mark lobby as forfeited
    UPDATE multiplayer_lobbies
    SET forfeited = true,
        updated_at = now()
    WHERE id = v_lobby.id;

    RETURN jsonb_build_object(
      'action', 'forfeited',
      'winner_user_id', v_remaining_player.user_id,
      'winner_display_name', v_remaining_player.display_name,
      'loser_user_id', v_leaver_player.user_id,
      'loser_display_name', v_leaver_player.display_name,
      'elo_result', v_result
    );
  END IF;

  -- If p_checking_user_id is provided with no p_leave_user_id, it's
  -- a periodic heartbeat check — do nothing, never auto-forfeit.
  IF p_checking_user_id IS NOT NULL THEN
    RETURN jsonb_build_object('action', 'all_present');
  END IF;

  -- Fallback: no parameters provided
  RETURN jsonb_build_object('action', 'no_action');
END;
$$;

-- Re-grant execute permission
GRANT EXECUTE ON FUNCTION public.process_duel_forfeit(text, uuid, uuid) TO authenticated;