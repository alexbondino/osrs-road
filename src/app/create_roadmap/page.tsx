import { ReactFlowProvider } from '@xyflow/react';
import RoadmapBuilder from './RoadmapBuilder';

export default function CreateRoadmapPage() {
  return (
    <div className="h-[calc(100vh-49px)] bg-zinc-950">
      <ReactFlowProvider>
        <RoadmapBuilder />
      </ReactFlowProvider>
    </div>
  );
}
