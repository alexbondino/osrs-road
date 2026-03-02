import { ReactFlowProvider } from '@xyflow/react';
import RoadmapBuilder from './RoadmapBuilder';
import { supabase } from '@/lib/supabase';

export default async function CreateRoadmapPage() {
  const [
    { data: skills },
    { data: quests },
    { data: diaries },
    { count: itemsCount },
  ] = await Promise.all([
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

  return (
    <div className="h-[calc(100vh-49px)] bg-zinc-950">
      <ReactFlowProvider>
        <RoadmapBuilder
          skills={skills ?? []}
          quests={quests ?? []}
          diaries={diaries ?? []}
          itemsCount={itemsCount ?? 0}
        />
      </ReactFlowProvider>
    </div>
  );
}
