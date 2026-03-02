import { ReactFlowProvider } from '@xyflow/react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchRoadmapById } from '@/lib/roadmaps';
import RoadmapViewer from './RoadmapViewer';
import ViewRoadmapActions from './ViewRoadmapActions';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ViewRoadmapPage({ params }: Props) {
  const { id } = await params;
  const roadmap = await fetchRoadmapById(id);

  if (!roadmap) notFound();

  const nodeCount = Array.isArray(roadmap.nodes) ? roadmap.nodes.length : 0;
  const edgeCount = Array.isArray(roadmap.edges) ? roadmap.edges.length : 0;

  return (
    <div className="h-[calc(100vh-49px)] flex flex-col bg-zinc-950">
      {/* Header bar */}
      <div className="flex items-center gap-4 px-5 py-3 bg-zinc-900 border-b border-zinc-700 shrink-0">
        <Link
          href="/"
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 0 1-.75.75H5.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 1 1 1.06 1.06L5.56 9.25H16.25A.75.75 0 0 1 17 10Z"
              clipRule="evenodd"
            />
          </svg>
        </Link>

        <div className="flex flex-col min-w-0">
          <h1 className="text-white font-semibold text-sm truncate">
            {roadmap.name}
          </h1>
          <span className="text-zinc-500 text-xs">
            {nodeCount} step{nodeCount !== 1 ? 's' : ''} · {edgeCount}{' '}
            connection{edgeCount !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Client component that shows Edit button only for owner */}
        <ViewRoadmapActions roadmapId={roadmap.id} ownerId={roadmap.user_id} />
      </div>

      {/* Canvas */}
      <ReactFlowProvider>
        <RoadmapViewer roadmap={roadmap} />
      </ReactFlowProvider>
    </div>
  );
}
