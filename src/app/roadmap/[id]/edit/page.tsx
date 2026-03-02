import { ReactFlowProvider } from '@xyflow/react';
import { notFound } from 'next/navigation';
import { fetchRoadmapById } from '@/lib/roadmaps';
import { supabase } from '@/lib/supabase';
import RoadmapBuilder from '@/app/create_roadmap/RoadmapBuilder';
import ProtectedPage from '@/components/ProtectedPage';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditRoadmapPage({ params }: Props) {
  const { id } = await params;

  const [
    roadmap,
    { data: skills },
    { data: quests },
    { data: diaries },
    { count: itemsCount },
  ] = await Promise.all([
    fetchRoadmapById(id),
    supabase
      .from('skills')
      .select('id, name, icon_url, max_level')
      .order('name'),
    supabase
      .from('quests')
      .select('id, name, icon_url, difficulty, members')
      .order('name'),
    supabase
      .from('diaries')
      .select('id, name, area, tier, icon_url')
      .order('area')
      .order('tier'),
    supabase.from('items').select('id', { count: 'exact', head: true }),
  ]);

  if (!roadmap) notFound();

  return (
    <ProtectedPage>
      <div className="h-[calc(100vh-49px)] bg-zinc-950">
        <ReactFlowProvider>
          <RoadmapBuilder
            skills={skills ?? []}
            quests={quests ?? []}
            diaries={diaries ?? []}
            itemsCount={itemsCount ?? 0}
            initialNodes={roadmap.nodes}
            initialEdges={roadmap.edges}
            initialName={roadmap.name}
            initialThumbnail={roadmap.thumbnail_url}
            roadmapId={roadmap.id}
          />
        </ReactFlowProvider>
      </div>
    </ProtectedPage>
  );
}
