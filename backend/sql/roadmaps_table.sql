-- =========================================================
-- OSRS Road — Tabla roadmaps
-- Pega esto en el SQL Editor de Supabase y ejecuta
-- =========================================================

CREATE TABLE IF NOT EXISTS public.roadmaps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT 'My Roadmap',
  nodes       JSONB NOT NULL DEFAULT '[]',
  edges       JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_roadmaps_user_id ON public.roadmaps (user_id);
CREATE INDEX IF NOT EXISTS idx_roadmaps_created_at ON public.roadmaps (created_at DESC);

-- Habilitar Row Level Security
ALTER TABLE public.roadmaps ENABLE ROW LEVEL SECURITY;

-- Lectura pública (todos pueden ver los roadmaps en el home)
CREATE POLICY "read_roadmaps_public"
  ON public.roadmaps FOR SELECT USING (true);

-- Solo el dueño puede insertar
CREATE POLICY "insert_own_roadmaps"
  ON public.roadmaps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Solo el dueño puede actualizar
CREATE POLICY "update_own_roadmaps"
  ON public.roadmaps FOR UPDATE
  USING (auth.uid() = user_id);

-- Solo el dueño puede borrar
CREATE POLICY "delete_own_roadmaps"
  ON public.roadmaps FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER roadmaps_set_updated_at
  BEFORE UPDATE ON public.roadmaps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
