'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  SmoothStepEdge,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import ItemNode from '@/app/create_roadmap/ItemNode';
import type { Roadmap } from '@/lib/roadmaps';
import { fetchProgress, saveProgress } from '@/lib/roadmaps';
import { useAuth } from '@/hooks/useAuth';

const nodeTypes = { itemNode: ItemNode };
const edgeTypes = { midpoint: SmoothStepEdge };

export default function RoadmapViewer({ roadmap }: { roadmap: Roadmap }) {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cargar progreso al montar
  useEffect(() => {
    setMounted(true);
    if (!user) return;
    fetchProgress(user.id, roadmap.id).then(ids => {
      setCompletedIds(new Set(ids));
    });
  }, [user, roadmap.id]);

  // Guardar con debounce de 800ms
  const persistProgress = useCallback(
    (next: Set<string>) => {
      if (!user) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveProgress(user.id, roadmap.id, Array.from(next));
      }, 800);
    },
    [user, roadmap.id]
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (_e, node) => {
      if (!user) return;
      setCompletedIds(prev => {
        const next = new Set(prev);
        if (next.has(node.id)) next.delete(node.id);
        else next.add(node.id);
        persistProgress(next);
        return next;
      });
    },
    [user, persistProgress]
  );

  if (!mounted) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-950">
        <span className="text-zinc-500 text-sm">Loading…</span>
      </div>
    );
  }

  const baseNodes: Node[] = Array.isArray(roadmap.nodes)
    ? (roadmap.nodes as Node[])
    : [];
  const nodes: Node[] = baseNodes.map(n => ({
    ...n,
    data: { ...n.data, completed: completedIds.has(n.id) },
  }));
  const edges: Edge[] = Array.isArray(roadmap.edges)
    ? (roadmap.edges as Edge[])
    : [];

  const completedCount = completedIds.size;
  const totalCount = baseNodes.length;

  return (
    <div className="flex-1 flex flex-col bg-zinc-950" style={{ minHeight: 0 }}>
      {/* Barra de progreso */}
      {user && totalCount > 0 && (
        <div className="shrink-0 px-4 py-2 bg-zinc-900 border-b border-zinc-800 flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-500"
              style={{ width: `${(completedCount / totalCount) * 100}%` }}
            />
          </div>
          <span className="text-zinc-400 text-xs shrink-0">
            {completedCount}/{totalCount} completed
          </span>
        </div>
      )}
      <ReactFlow
        className="flex-1"
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
        onNodeClick={onNodeClick}
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
