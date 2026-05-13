-- Corre esto en el SQL Editor de Supabase para añadir la tabla de monsters

CREATE TABLE IF NOT EXISTS public.monsters (
  id           SERIAL PRIMARY KEY,
  name         TEXT UNIQUE NOT NULL,
  combat_level INTEGER,
  members      BOOLEAN NOT NULL DEFAULT FALSE,
  icon_url     TEXT
);

ALTER TABLE public.monsters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_monsters_public" ON public.monsters FOR SELECT USING (true);
