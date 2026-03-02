-- Corre esto en el SQL Editor de Supabase para añadir la tabla de diaries

CREATE TABLE IF NOT EXISTS public.diaries (
  id       SERIAL PRIMARY KEY,
  name     TEXT UNIQUE NOT NULL,
  area     TEXT,
  tier     TEXT,
  icon_url TEXT
);

ALTER TABLE public.diaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_diaries_public" ON public.diaries FOR SELECT USING (true);
