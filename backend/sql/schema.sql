-- =========================================================
-- OSRS Road — Schema SQL
-- Pega esto en el SQL Editor de Supabase y ejecuta
-- =========================================================

-- ── Items (todos los ítems trazables del Grand Exchange) ──────────────────
CREATE TABLE IF NOT EXISTS public.items (
  id          INTEGER PRIMARY KEY,         -- ID oficial OSRS
  name        TEXT    NOT NULL,
  examine     TEXT,
  icon        TEXT,                        -- nombre del archivo (ej: "Logs.png")
  icon_url    TEXT,                        -- URL completa de la wiki
  members     BOOLEAN NOT NULL DEFAULT FALSE,
  lowalch     INTEGER,
  highalch    INTEGER,
  limit_ge    INTEGER,                     -- límite de compra en GE
  value       INTEGER,                     -- valor base
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para búsquedas por nombre
CREATE INDEX IF NOT EXISTS idx_items_name ON public.items (name);

-- ── Skills (23 skills de OSRS) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.skills (
  id        SERIAL PRIMARY KEY,
  name      TEXT UNIQUE NOT NULL,
  icon_url  TEXT,
  max_level INTEGER NOT NULL DEFAULT 99
);

-- =========================================================
-- Habilitar Row Level Security (recomendado)
-- =========================================================
ALTER TABLE public.items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

-- Política: lectura pública, escritura solo con service_role
CREATE POLICY "read_items_public"  ON public.items  FOR SELECT USING (true);
CREATE POLICY "read_skills_public" ON public.skills FOR SELECT USING (true);
