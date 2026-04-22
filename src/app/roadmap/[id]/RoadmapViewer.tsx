'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
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
import GroupNode from '@/app/create_roadmap/GroupNode';
import Image from 'next/image';
import type { Roadmap } from '@/lib/roadmaps';
import { fetchProgress, saveProgress } from '@/lib/roadmaps';
import { useAuth } from '@/hooks/useAuth';

const nodeTypes = { itemNode: ItemNode, groupNode: GroupNode };
const edgeTypes = { midpoint: SmoothStepEdge };

export default function RoadmapViewer({ roadmap }: { roadmap: Roadmap }) {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [tooltip, setTooltip] = useState<{
    label: string;
    nodeType: string;
    icon_url?: string | null;
    category?: string;
    level?: string;
    qty?: string;
    groupItems?: {
      label: string;
      icon_url: string | null;
      category: string;
      level?: string;
      qty?: string;
    }[];
    checklist?: string[];
    x: number;
    y: number;
  } | null>(null);
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

  const onNodeMouseEnter: NodeMouseHandler = useCallback((e, node) => {
    const d = node.data as {
      label?: string;
      icon_url?: string | null;
      category?: string;
      level?: string;
      qty?: string;
      items?: {
        label: string;
        icon_url: string | null;
        category: string;
        level?: string;
        qty?: string;
      }[];
      checklist?: string[];
    };
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({
      label: d.label ?? 'Group',
      nodeType: node.type ?? 'itemNode',
      icon_url: d.icon_url,
      category: d.category,
      level: d.level,
      qty: d.qty,
      groupItems: node.type === 'groupNode' ? (d.items ?? []) : undefined,
      checklist: d.checklist ?? [],
      x: rect.right + 10,
      y: rect.top,
    });
  }, []);

  const onNodeMouseLeave: NodeMouseHandler = useCallback(() => {
    setTooltip(null);
  }, []);

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
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
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

      {tooltip &&
        createPortal(
          <div
            className="fixed z-50 pointer-events-none"
            style={{ left: tooltip.x + 18, top: tooltip.y - 12, maxWidth: 300 }}
          >
            <div
              className="rounded-2xl shadow-2xl overflow-hidden"
              style={{
                background: 'rgba(24,24,27,0.97)',
                border: '1px solid rgba(113,113,122,0.5)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <div className="px-4 py-3 flex flex-col gap-2.5">
                {/* single item */}
                {tooltip.nodeType === 'itemNode' && (
                  <>
                    {/* name row with icon */}
                    <div className="flex items-center gap-2.5">
                      {tooltip.icon_url && (
                        <Image
                          src={tooltip.icon_url}
                          alt={tooltip.label}
                          width={28}
                          height={28}
                          className="w-7 h-7 object-contain shrink-0"
                          unoptimized
                        />
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="text-white font-semibold text-sm leading-tight truncate">
                          {tooltip.label}
                        </span>
                        {tooltip.category === 'Skill' && tooltip.level && (
                          <span className="text-amber-400 text-xs mt-0.5">
                            Lv {tooltip.level}
                          </span>
                        )}
                        {tooltip.category === 'Item' && tooltip.qty && (
                          <span className="text-amber-400 text-xs mt-0.5">
                            ×{tooltip.qty}
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* group items list */}
                {tooltip.groupItems && tooltip.groupItems.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {tooltip.groupItems.map((item, i) => {
                      const badge =
                        item.category === 'Skill' && item.level
                          ? `Lv ${item.level}`
                          : item.category === 'Item' && item.qty
                            ? `×${item.qty}`
                            : null;
                      return (
                        <div key={i} className="flex items-center gap-2.5">
                          {item.icon_url ? (
                            <Image
                              src={item.icon_url}
                              alt={item.label}
                              width={20}
                              height={20}
                              className="w-5 h-5 object-contain shrink-0"
                              unoptimized
                            />
                          ) : (
                            <div className="w-5 h-5 rounded-md bg-zinc-700 shrink-0" />
                          )}
                          <span className="text-zinc-100 text-sm flex-1 truncate">
                            {item.label}
                          </span>
                          {badge && (
                            <span className="text-amber-400 text-xs font-semibold shrink-0 ml-1">
                              {badge}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* checklist */}
                {tooltip.checklist && tooltip.checklist.length > 0 && (
                  <>
                    <div className="border-t border-zinc-700/60 mt-1" />
                    <div className="flex flex-col gap-2 mt-1">
                      {tooltip.checklist.map((task, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                          <span className="text-zinc-300 text-sm leading-snug">
                            {task}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
