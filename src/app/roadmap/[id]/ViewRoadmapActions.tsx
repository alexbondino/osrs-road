'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useIsFollowing } from '@/hooks/useRoadmaps';
import { followRoadmap, unfollowRoadmap } from '@/lib/roadmaps';

interface Props {
  roadmapId: string;
  ownerId: string;
}

export default function ViewRoadmapActions({ roadmapId, ownerId }: Props) {
  const { user } = useAuth();
  const isOwner = user?.id === ownerId;
  const { following, setFollowing, checked } = useIsFollowing(
    user?.id,
    roadmapId
  );
  const [busy, setBusy] = useState(false);

  const handleFollow = async () => {
    if (!user || busy) return;
    setBusy(true);
    try {
      if (following) {
        await unfollowRoadmap(user.id, roadmapId);
        setFollowing(false);
      } else {
        await followRoadmap(user.id, roadmapId);
        setFollowing(true);
      }
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ml-auto flex gap-2 items-center">
      {/* Follow button — solo para non-owners autenticados */}
      {user && !isOwner && checked && (
        <button
          onClick={handleFollow}
          disabled={busy}
          className={`px-3 py-1.5 text-xs rounded-md font-semibold transition-colors ${
            following
              ? 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
              : 'bg-zinc-800 text-zinc-200 border border-zinc-600 hover:border-amber-500 hover:text-amber-400'
          }`}
        >
          {busy ? '…' : following ? '✓ Saved' : '+ Save to my list'}
        </button>
      )}

      {/* Edit button — solo owner */}
      {isOwner && (
        <Link href={`/roadmap/${roadmapId}/edit`}>
          <button className="px-3 py-1.5 text-xs rounded-md bg-amber-500 text-zinc-900 font-semibold hover:bg-amber-400 transition-colors">
            Edit Roadmap
          </button>
        </Link>
      )}
    </div>
  );
}
