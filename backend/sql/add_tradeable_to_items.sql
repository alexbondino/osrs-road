-- Añade columna tradeable a items para distinguir objetos no comprables en GE
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS tradeable BOOLEAN NOT NULL DEFAULT TRUE;
