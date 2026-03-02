'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  roadmapId: string;
  ownerId: string;
}

export default function ViewRoadmapActions({ roadmapId, ownerId }: Props) {
  const { user } = useAuth();

  if (!user || user.id !== ownerId) return null;

  return (
    <div className="ml-auto flex gap-2">
      <Link href={`/roadmap/${roadmapId}/edit`}>
        <button className="px-3 py-1.5 text-xs rounded-md bg-amber-500 text-zinc-900 font-semibold hover:bg-amber-400 transition-colors">
          Edit Roadmap
        </button>
      </Link>
    </div>
  );
}
