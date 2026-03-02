'use client';

import { useEffect, useState } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  SmoothStepEdge,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import ItemNode from '@/app/create_roadmap/ItemNode';
import type { Roadmap } from '@/lib/roadmaps';

const nodeTypes = { itemNode: ItemNode };
// En modo lectura usamos SmoothStepEdge en lugar del MidpointEdge interactivo
const edgeTypes = { midpoint: SmoothStepEdge };

export default function RoadmapViewer({ roadmap }: { roadmap: Roadmap }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-950">
        <span className="text-zinc-500 text-sm">Loading…</span>
      </div>
    );
  }

  const nodes: Node[] = Array.isArray(roadmap.nodes)
    ? (roadmap.nodes as Node[])
    : [];
  const edges: Edge[] = Array.isArray(roadmap.edges)
    ? (roadmap.edges as Edge[])
    : [];

  return (
    <div className="flex-1 bg-zinc-950" style={{ minHeight: 0 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnDoubleClick={false}
        deleteKeyCode={null}
        proOptions={{ hideAttribution: true }}
      >
        <Controls
          showInteractive={false}
          className="[&>button]:bg-zinc-800 [&>button]:border-zinc-600 [&>button]:text-white"
        />
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#3f3f46"
        />
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="text-5xl mb-4">🗺️</div>
              <p className="text-zinc-500 text-sm">This roadmap is empty.</p>
            </div>
          </div>
        )}
      </ReactFlow>
    </div>
  );
}
