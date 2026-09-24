-- ============================================================
-- PELADA APP – Schema completo para Supabase (PostgreSQL)
-- Execute no Supabase → SQL Editor
-- ============================================================

-- ── Enums ────────────────────────────────────────────────────
CREATE TYPE player_position AS ENUM ('goleiro', 'linha');
CREATE TYPE attendance_status AS ENUM ('confirmado', 'espera', 'ausente');

-- ── Tabela: profiles ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id          uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email       text,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Tabela: players ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS players (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        text NOT NULL,
  nickname    text,
  position    player_position NOT NULL DEFAULT 'linha',
  stars       numeric(3,1) NOT NULL DEFAULT 3 CHECK (stars >= 0 AND stars <= 5),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_players_user ON players(user_id);
CREATE INDEX idx_players_position ON players(position);

-- ── Tabela: game_schedules ───────────────────────────────────
-- day_of_week: 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb
CREATE TABLE IF NOT EXISTS game_schedules (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title       text NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time  time NOT NULL,
  end_time    time,
  location    text,
  notes       text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_schedules_user ON game_schedules(user_id);

-- ── Tabela: match_attendees ──────────────────────────────────
CREATE TABLE IF NOT EXISTS match_attendees (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id uuid REFERENCES game_schedules(id) ON DELETE CASCADE NOT NULL,
  player_id   uuid REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  game_date   date NOT NULL DEFAULT CURRENT_DATE,
  status      attendance_status NOT NULL DEFAULT 'espera',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(schedule_id, player_id, game_date)
);

CREATE INDEX idx_attendees_schedule ON match_attendees(schedule_id, game_date);

-- ── Row Level Security ───────────────────────────────────────
ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE players        ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_attendees ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "profiles_own" ON profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Players
CREATE POLICY "players_own" ON players FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Schedules
CREATE POLICY "schedules_own" ON game_schedules FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Attendees (via schedule ownership)
CREATE POLICY "attendees_own" ON match_attendees FOR ALL
  USING (
    EXISTS (SELECT 1 FROM game_schedules gs WHERE gs.id = schedule_id AND gs.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM game_schedules gs WHERE gs.id = schedule_id AND gs.user_id = auth.uid())
  );

-- ── Trigger: auto-create profile on signup ───────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
