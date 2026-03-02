'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useMyRoadmaps, useFollowedRoadmaps } from '@/hooks/useRoadmaps';
import { unfollowRoadmap } from '@/lib/roadmaps';
import RoadmapCard from '@/components/RoadmapCard';

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          border: '3px solid #3f3f46',
          borderTopColor: '#f59e0b',
          animation: 'spin 0.8s linear infinite',
        }}
      />
    </div>
  );
}

export default function ListRoadmapPage() {
  const { user } = useAuth();

  // My created roadmaps
  const { roadmaps, loading, reload } = useMyRoadmaps(user?.id);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const visible = roadmaps.filter(r => !deletedIds.has(r.id));
  const handleDeleted = (id: string) =>
    setDeletedIds(prev => new Set([...prev, id]));

  // Followed roadmaps
  const {
    roadmaps: followed,
    loading: followedLoading,
    reload: reloadFollowed,
  } = useFollowedRoadmaps(user?.id);
  const [unfollowedIds, setUnfollowedIds] = useState<Set<string>>(new Set());
  const visibleFollowed = followed.filter(r => !unfollowedIds.has(r.id));

  const handleUnfollow = async (id: string) => {
    if (!user) return;
    try {
      await unfollowRoadmap(user.id, id);
      setUnfollowedIds(prev => new Set([...prev, id]));
    } catch {
      alert('Could not remove roadmap from your list.');
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 max-w-7xl mx-auto">
      {/* ── My Roadmaps ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">My Roadmaps</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {loading
              ? 'Loading…'
              : visible.length > 0
                ? `${visible.length} roadmap${visible.length !== 1 ? 's' : ''} in your collection`
                : "You haven't created any roadmaps yet"}
          </p>
        </div>
      </div>

      {loading && <Spinner />}

      {!loading && visible.length === 0 && (
        <div className="text-center py-16">
          <div className="text-6xl mb-5">🏕️</div>
          <h2 className="text-white font-semibold text-lg mb-2">
            No roadmaps yet
          </h2>
          <p className="text-zinc-500 text-sm mb-6">
            Plan your OSRS adventure by creating your first roadmap.
          </p>
        </div>
      )}

      {!loading && visible.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {visible.map(r => (
            <RoadmapCard
              key={r.id}
              roadmap={r}
              editable={true}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}

      {/* ── Followed Roadmaps ─────────────────────────────────────────────── */}
      <div className="mt-14">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white">Followed Roadmaps</h2>
          <p className="text-zinc-500 text-sm mt-1">
            {followedLoading
              ? 'Loading…'
              : visibleFollowed.length > 0
                ? `${visibleFollowed.length} saved roadmap${visibleFollowed.length !== 1 ? 's' : ''}`
                : "You haven't saved any roadmaps yet"}
          </p>
        </div>

        {followedLoading && <Spinner />}

        {!followedLoading && visibleFollowed.length === 0 && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">🔖</div>
            <p className="text-zinc-500 text-sm">
              Browse community roadmaps and click{' '}
              <span className="text-zinc-300">+ Save to my list</span> to save
              them here.
            </p>
          </div>
        )}

        {!followedLoading && visibleFollowed.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {visibleFollowed.map(r => (
              <RoadmapCard
                key={r.id}
                roadmap={r}
                editable={false}
                onUnfollow={handleUnfollow}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
