-- Agrega la columna thumbnail_url a la tabla roadmaps existente
-- Ejecutar en Supabase SQL Editor

ALTER TABLE public.roadmaps
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
