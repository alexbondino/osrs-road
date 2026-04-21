// Server-safe: sin 'use client'. Se puede importar desde Server Components y Client Components.
import { supabase } from '@/lib/supabase';
import type { Node, Edge } from '@xyflow/react';

export interface Roadmap {
  id: string;
  user_id: string;
  name: string;
  thumbnail_url: string | null;
  nodes: Node[];
  edges: Edge[];
  created_at: string;
  updated_at: string;
}

// ── Supabase REST helpers (bypass postgrest-js JSON.stringify) ────────────
// postgrest-js calls JSON.stringify(this.body) internally and fails when
// ReactFlow nodes contain cyclic internal references. Using raw fetch lets
// us control serialization completely.

const REST_URL = process.env.NEXT_PUBLIC_SUPABASE_URL! + '/rest/v1';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token ?? ANON_KEY;
  return {
    'Content-Type': 'application/json',
    apikey: ANON_KEY,
    Authorization: `Bearer ${token}`,
  };
}

// Cycle-safe JSON.stringify (breaks circular refs instead of throwing).
function safeStringify(value: unknown): string {
  const seen = new WeakSet();
  return JSON.stringify(value, (_key, val) => {
    if (typeof val === 'bigint') return Number(val);
    if (typeof val === 'object' && val !== null) {
      if (seen.has(val as object)) return undefined;
      seen.add(val as object);
    }
    return val;
  });
}

// ── Fetch all roadmaps (home, server component) ───────────────────────────
export async function fetchAllRoadmaps(): Promise<Roadmap[]> {
  const { data, error } = await supabase
    .from('roadmaps')
    .select(
      'id, user_id, name, thumbnail_url, nodes, edges, created_at, updated_at'
    )
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Roadmap[];
}

// ── Fetch un roadmap por id ────────────────────────────────────────────────
export async function fetchRoadmapById(id: string): Promise<Roadmap | null> {
  const { data, error } = await supabase
    .from('roadmaps')
    .select(
      'id, user_id, name, thumbnail_url, nodes, edges, created_at, updated_at'
    )
    .eq('id', id)
    .single();
  if (error) return null;
  return data as Roadmap;
}

// ── Guardar (insert) un nuevo roadmap ─────────────────────────────────────
export async function saveRoadmap(payload: {
  user_id: string;
  name: string;
  thumbnail_url?: string | null;
  nodes: object[];
  edges: object[];
}): Promise<{ id: string } | null> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${REST_URL}/roadmaps`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: safeStringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  const row = Array.isArray(data) ? data[0] : data;
  return row ? { id: row.id } : null;
}

// ── Actualizar un roadmap existente ───────────────────────────────────────
export async function updateRoadmap(
  id: string,
  payload: {
    name: string;
    thumbnail_url?: string | null;
    nodes: object[];
    edges: object[];
  }
): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(
    `${REST_URL}/roadmaps?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: safeStringify(payload),
    }
  );
  if (!res.ok) throw new Error(await res.text());
}

// ── Eliminar un roadmap ───────────────────────────────────────────────────
export async function deleteRoadmap(id: string): Promise<void> {
  const { error } = await supabase.from('roadmaps').delete().eq('id', id);
  if (error) throw error;
}

// ── Follows ───────────────────────────────────────────────────────────────
export async function followRoadmap(
  userId: string,
  roadmapId: string
): Promise<void> {
  const { error } = await supabase
    .from('roadmap_follows')
    .insert({ user_id: userId, roadmap_id: roadmapId });
  if (error) throw error;
}

export async function unfollowRoadmap(
  userId: string,
  roadmapId: string
): Promise<void> {
  const { error } = await supabase
    .from('roadmap_follows')
    .delete()
    .eq('user_id', userId)
    .eq('roadmap_id', roadmapId);
  if (error) throw error;
}

export async function checkIsFollowing(
  userId: string,
  roadmapId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('roadmap_follows')
    .select('roadmap_id')
    .eq('user_id', userId)
    .eq('roadmap_id', roadmapId)
    .maybeSingle();
  return data !== null;
}

export async function fetchFollowedRoadmaps(
  userId: string
): Promise<Roadmap[]> {
  const { data, error } = await supabase
    .from('roadmap_follows')
    .select(
      'roadmap_id, roadmaps(id, user_id, name, thumbnail_url, nodes, edges, created_at, updated_at)'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as { roadmaps: Roadmap }[]).map(
    row => row.roadmaps
  );
}

// ── Progreso de nodos completados ───────────────────────────────────────
export async function fetchProgress(
  userId: string,
  roadmapId: string
): Promise<string[]> {
  const { data } = await supabase
    .from('roadmap_progress')
    .select('completed_nodes')
    .eq('user_id', userId)
    .eq('roadmap_id', roadmapId)
    .maybeSingle();
  return (data?.completed_nodes as string[]) ?? [];
}

export async function saveProgress(
  userId: string,
  roadmapId: string,
  completedNodes: string[]
): Promise<void> {
  const { error } = await supabase.from('roadmap_progress').upsert(
    {
      user_id: userId,
      roadmap_id: roadmapId,
      completed_nodes: completedNodes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,roadmap_id' }
  );
  if (error) throw error;
}
