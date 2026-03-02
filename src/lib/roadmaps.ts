// Server-safe: sin 'use client'. Se puede importar desde Server Components y Client Components.
import { supabase } from '@/lib/supabase';
import type { Node, Edge } from '@xyflow/react';

export interface Roadmap {
  id: string;
  user_id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
  created_at: string;
  updated_at: string;
}

// ── Fetch all roadmaps (home, server component) ───────────────────────────
export async function fetchAllRoadmaps(): Promise<Roadmap[]> {
  const { data, error } = await supabase
    .from('roadmaps')
    .select('id, user_id, name, nodes, edges, created_at, updated_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Roadmap[];
}

// ── Fetch un roadmap por id ────────────────────────────────────────────────
export async function fetchRoadmapById(id: string): Promise<Roadmap | null> {
  const { data, error } = await supabase
    .from('roadmaps')
    .select('id, user_id, name, nodes, edges, created_at, updated_at')
    .eq('id', id)
    .single();
  if (error) return null;
  return data as Roadmap;
}

// ── Guardar (insert) un nuevo roadmap ─────────────────────────────────────
export async function saveRoadmap(payload: {
  user_id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
}): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from('roadmaps')
    .insert(payload)
    .select('id')
    .single();
  if (error) throw error;
  return data as { id: string };
}

// ── Actualizar un roadmap existente ───────────────────────────────────────
export async function updateRoadmap(
  id: string,
  payload: { name: string; nodes: Node[]; edges: Edge[] }
): Promise<void> {
  const { error } = await supabase
    .from('roadmaps')
    .update(payload)
    .eq('id', id);
  if (error) throw error;
}

// ── Eliminar un roadmap ───────────────────────────────────────────────────
export async function deleteRoadmap(id: string): Promise<void> {
  const { error } = await supabase.from('roadmaps').delete().eq('id', id);
  if (error) throw error;
}
