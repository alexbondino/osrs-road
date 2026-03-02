-- Corre esto en el SQL Editor de Supabase para añadir la tabla de unlocks

CREATE TABLE IF NOT EXISTS public.unlocks (
  id          SERIAL PRIMARY KEY,
  name        TEXT UNIQUE NOT NULL,
  subcategory TEXT,
  icon_url    TEXT
);

ALTER TABLE public.unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_unlocks_public" ON public.unlocks FOR SELECT USING (true);
