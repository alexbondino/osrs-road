-- Corre esto en el SQL Editor de Supabase para añadir la tabla de quests

CREATE TABLE IF NOT EXISTS public.quests (
  id         SERIAL PRIMARY KEY,
  name       TEXT UNIQUE NOT NULL,
  difficulty TEXT,
  members    BOOLEAN NOT NULL DEFAULT FALSE,
  series     TEXT,
  icon_url   TEXT
);

ALTER TABLE public.quests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_quests_public" ON public.quests FOR SELECT USING (true);
