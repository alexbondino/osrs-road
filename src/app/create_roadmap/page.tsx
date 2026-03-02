import { ReactFlowProvider } from '@xyflow/react';
import RoadmapBuilder from './RoadmapBuilder';
import { supabase } from '@/lib/supabase';

export default async function CreateRoadmapPage() {
  const { data: skills } = await supabase
    .from('skills')
    .select('id, name, icon_url, max_level')
    .order('name');

  return (
    <div className="h-[calc(100vh-49px)] bg-zinc-950">
      <ReactFlowProvider>
        <RoadmapBuilder skills={skills ?? []} />
      </ReactFlowProvider>
    </div>
  );
}
