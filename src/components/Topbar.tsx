import Link from 'next/link';

export default function Topbar() {
  return (
    <nav className="w-full flex items-center justify-between px-6 py-3 bg-zinc-900 border-b border-zinc-700 shadow-sm">
      <span className="text-lg font-bold tracking-tight text-white">
        OSRS Road
      </span>
      <div className="flex gap-3">
        <Link href="/list_roadmap">
          <button className="px-4 py-2 rounded-md border border-zinc-500 text-zinc-200 text-sm font-medium hover:bg-zinc-700 transition-colors">
            My List
          </button>
        </Link>
        <Link href="/create_roadmap">
          <button className="px-4 py-2 rounded-md bg-amber-500 text-zinc-900 text-sm font-semibold hover:bg-amber-400 transition-colors">
            Create Roadmap
          </button>
        </Link>
      </div>
    </nav>
  );
}
