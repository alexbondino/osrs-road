import Link from 'next/link';
import { fetchAllRoadmaps } from '@/lib/roadmaps';
import RoadmapCard from '@/components/RoadmapCard';

export const revalidate = 30; // revalidar cada 30 seg

export default async function Home() {
  const roadmaps = await fetchAllRoadmaps().catch(() => []);

  return (
    <main className="min-h-screen bg-zinc-950">
      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 py-20 overflow-hidden">
        {/* Ambient glow */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '600px',
            height: '300px',
            background:
              'radial-gradient(ellipse, rgba(245,158,11,0.07) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #f59e0b, #b45309)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            marginBottom: '1.25rem',
            boxShadow: '0 0 24px rgba(245,158,11,0.35)',
          }}
        >
          🗺️
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
          OSRS Road
        </h1>
        <p className="text-zinc-400 text-lg mb-8 max-w-xl">
          Plan your Old School RuneScape journey. Build and share skill, quest
          &amp; item progression roadmaps.
        </p>
      </section>

      {/* Community roadmaps */}
      <section id="community" className="px-6 pb-20 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">Community Roadmaps</h2>
            <p className="text-zinc-500 text-sm mt-0.5">
              {roadmaps.length > 0
                ? `${roadmaps.length} roadmap${roadmaps.length !== 1 ? 's' : ''} shared by adventurers`
                : 'Be the first to share a roadmap!'}
            </p>
          </div>
        </div>

        {roadmaps.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🏕️</div>
            <p className="text-zinc-500 text-sm">
              No roadmaps yet. Create the first one!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {roadmaps.map(r => (
              <RoadmapCard key={r.id} roadmap={r} editable={false} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
