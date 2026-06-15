-- =============================================================================
-- Duel Elo + Disconnect/Forfeit System Migration
-- =============================================================================
-- Adds Elo rating columns, forfeit tracking, heartbeat timestamps, and
-- the server-side functions to calculate Elo and detect disconnects.
-- =============================================================================

-- 1. Add Elo columns to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS elo_rating integer NOT NULL DEFAULT 1000,
ADD COLUMN IF NOT EXISTS peak_elo integer NOT NULL DEFAULT 1000,
ADD COLUMN IF NOT EXISTS duel_wins integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS duel_losses integer NOT NULL DEFAULT 0;

-- 2. Add forfeit and heartbeat columns to lobby players
ALTER TABLE public.multiplayer_lobby_players
ADD COLUMN IF NOT EXISTS forfeited boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz NOT NULL DEFAULT now();

-- 3. Add forfeited winner column to lobbies
ALTER TABLE public.multiplayer_lobbies
ADD COLUMN IF NOT EXISTS forfeited boolean NOT NULL DEFAULT false;

-- 4. Core Elo calculation function
--    Uses standard Elo with K=32. Returns the new rating.
CREATE OR REPLACE FUNCTION public.calculate_elo(
  p_winner_rating integer,
  p_loser_rating integer
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_k_factor integer := 32;
  v_expected numeric;
  v_winner_new integer;
  v_loser_new integer;
  v_delta integer;
BEGIN
  -- Expected score for winner (between 0 and 1)
  v_expected := 1.0 / (1.0 + 10.0^((p_loser_rating - p_winner_rating)::numeric / 400.0));

  -- Delta = K * (actual_score - expected_score)
  -- Winner's actual score is 1, loser's is 0
  v_delta := round(v_k_factor * (1.0 - v_expected));

  v_winner_new := p_winner_rating + v_delta;
  v_loser_new  := p_loser_rating - v_delta;

  RETURN jsonb_build_object(
    'winner_new', v_winner_new,
    'loser_new', v_loser_new,
    'delta', v_delta
  );
END;
$$;

-- 5. Process duel completion (called after both players finish or forfeit)
--    Awards Elo, updates standings, marks lobby as finished.
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
  v_loser_record record;
  v_winner_rating integer;
  v_loser_rating integer;
  v_elo_result jsonb;
  v_winner_new integer;
  v_loser_new integer;
BEGIN
  -- Mark lobby as finished
  UPDATE multiplayer_lobbies
  SET status = 'finished',
      winner_user_id = p_winner_user_id,
      updated_at = now()
  WHERE id = p_lobby_id
    AND mode = 'duel'
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

  RETURN jsonb_build_object(
    'winner_new_elo', v_winner_new,
    'loser_new_elo', v_loser_new,
    'elo_delta', v_elo_result->>'delta'
  );
END;
$$;

-- 6. Process forfeit — detects absent players and ends the match
--    Called by the heartbeat endpoint or session-status polling.
--    A player is considered disconnected if last_heartbeat_at > 30 seconds ago.
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

  -- Award win to the active player via Elo
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

-- 7. Leaderboard function for Elo rankings
CREATE OR REPLACE FUNCTION public.get_elo_leaderboard(p_limit integer DEFAULT 8)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_agg(entry ORDER BY entry->>'rank')
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'user_id', p.id,
      'username', p.username,
      'elo_rating', coalesce(p.elo_rating, 1000),
      'duel_wins', coalesce(p.duel_wins, 0),
      'duel_losses', coalesce(p.duel_losses, 0),
      'rank', row_number() OVER (
        ORDER BY coalesce(p.elo_rating, 1000) DESC,
                 p.created_at ASC
      )
    ) AS entry
    FROM profiles p
    WHERE coalesce(p.duel_wins, 0) + coalesce(p.duel_losses, 0) > 0
    ORDER BY coalesce(p.elo_rating, 1000) DESC
    LIMIT p_limit
  ) sub;

  RETURN coalesce(v_result, '[]'::jsonb);
END;
$$;

-- 8. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.calculate_elo(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_duel_completion(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_duel_forfeit(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_elo_leaderboard(integer) TO authenticated;

-- 9. Create index for heartbeat queries
CREATE INDEX IF NOT EXISTS idx_lobby_players_heartbeat
ON public.multiplayer_lobby_players (lobby_id, last_heartbeat_at)
WHERE forfeited = false;