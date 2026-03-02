'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useMyRoadmaps } from '@/hooks/useRoadmaps';
import RoadmapCard from '@/components/RoadmapCard';

export default function ListRoadmapPage() {
  const { user } = useAuth();
  const { roadmaps, loading, reload } = useMyRoadmaps(user?.id);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const visible = roadmaps.filter(r => !deletedIds.has(r.id));

  const handleDeleted = (id: string) => {
    setDeletedIds(prev => new Set([...prev, id]));
  };

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 max-w-7xl mx-auto">
      {/* Header */}
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
        <Link href="/create_roadmap">
          <button className="px-4 py-2 rounded-lg bg-amber-500 text-zinc-900 font-semibold text-sm hover:bg-amber-400 transition-colors">
            + New Roadmap
          </button>
        </Link>
      </div>

      {/* Loading spinner */}
      {loading && (
        <div className="flex items-center justify-center py-24">
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
      )}

      {/* Empty state */}
      {!loading && visible.length === 0 && (
        <div className="text-center py-24">
          <div className="text-6xl mb-5">🏕️</div>
          <h2 className="text-white font-semibold text-lg mb-2">
            No roadmaps yet
          </h2>
          <p className="text-zinc-500 text-sm mb-6">
            Plan your OSRS adventure by creating your first roadmap.
          </p>
          <Link href="/create_roadmap">
            <button className="px-6 py-2.5 rounded-lg bg-amber-500 text-zinc-900 font-semibold text-sm hover:bg-amber-400 transition-colors">
              Create My First Roadmap
            </button>
          </Link>
        </div>
      )}

      {/* Grid */}
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
          {/* Add new card */}
          <Link href="/create_roadmap">
            <div
              style={{
                background: 'transparent',
                border: '2px dashed #3f3f46',
                borderRadius: '0.875rem',
                minHeight: '200px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e =>
                ((e.currentTarget as HTMLDivElement).style.borderColor =
                  '#f59e0b')
              }
              onMouseLeave={e =>
                ((e.currentTarget as HTMLDivElement).style.borderColor =
                  '#3f3f46')
              }
            >
              <span style={{ fontSize: '1.5rem', color: '#52525b' }}>+</span>
              <span style={{ color: '#52525b', fontSize: '0.75rem' }}>
                New Roadmap
              </span>
            </div>
          </Link>
        </div>
      )}
    </main>
  );
}
