'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Roadmap } from '@/lib/roadmaps';
import { checkIsFollowing, fetchFollowedRoadmaps } from '@/lib/roadmaps';

export type { Roadmap } from '@/lib/roadmaps';

// ── Hook para el perfil del usuario (solo client) ─────────────────────────
export function useMyRoadmaps(userId: string | undefined) {
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!userId) {
      setRoadmaps([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('roadmaps')
      .select(
        'id, user_id, name, thumbnail_url, nodes, edges, created_at, updated_at'
      )
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    setRoadmaps((data ?? []) as Roadmap[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return { roadmaps, loading, reload: load };
}

// ── Roadmaps guardados (seguidos) ─────────────────────────────────────────
export function useFollowedRoadmaps(userId: string | undefined) {
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!userId) {
      setRoadmaps([]);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchFollowedRoadmaps(userId);
      setRoadmaps(data);
    } catch {
      setRoadmaps([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return { roadmaps, loading, reload: load };
}

// ── Estado de follow de un roadmap concreto ───────────────────────────────
export function useIsFollowing(userId: string | undefined, roadmapId: string) {
  const [following, setFollowing] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!userId) {
      setFollowing(false);
      setChecked(true);
      return;
    }
    checkIsFollowing(userId, roadmapId).then(v => {
      setFollowing(v);
      setChecked(true);
    });
  }, [userId, roadmapId]);

  return { following, setFollowing, checked };
}
