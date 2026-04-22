'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  SmoothStepEdge,
  useNodesState,
  useViewport,
  useReactFlow,
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

const QUEST_ICON =
  'https://oldschool.runescape.wiki/images/Quest_point_icon.png';
const DIARY_ICON =
  'https://oldschool.runescape.wiki/images/Achievement_Diaries.png';

function resolveIcon(
  icon_url: string | null | undefined,
  category?: string
): string | null {
  if (category === 'Quest') return QUEST_ICON;
  if (category === 'Diary') return DIARY_ICON;
  return icon_url ?? null;
}

type TooltipData = {
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
  checklist?: { text: string; done?: boolean }[];
  flowRight: number;
  flowTop: number;
  flowHeight: number;
};

function TooltipOverlay({ tooltip }: { tooltip: TooltipData | null }) {
  const { zoom } = useViewport();
  const { flowToScreenPosition } = useReactFlow();

  if (!tooltip) return null;

  const screenPos = flowToScreenPosition({
    x: tooltip.flowRight,
    y: tooltip.flowTop,
  });
  const screenHeight = Math.round(tooltip.flowHeight * zoom);

  return createPortal(
    <div
      className="fixed z-50 pointer-events-none"
      style={{
        left: screenPos.x + 8,
        top: screenPos.y,
        width: 300,
        minHeight: screenHeight,
      }}
    >
      <div
        className="rounded-2xl shadow-2xl"
        style={{
          background: 'rgba(24,24,27,0.97)',
          border: '1px solid rgba(113,113,122,0.5)',
          backdropFilter: 'blur(12px)',
          minHeight: screenHeight,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div className="px-4 py-3 flex flex-col gap-2.5 w-full">
          {/* single item */}
          {tooltip.nodeType === 'itemNode' &&
            (() => {
              const badge =
                tooltip.category === 'Skill' && tooltip.level
                  ? `Lv ${tooltip.level}`
                  : tooltip.category === 'Item' && tooltip.qty
                    ? `×${tooltip.qty}`
                    : null;
              return (
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
                  <span className="text-white font-semibold text-sm flex-1 truncate">
                    {tooltip.label}
                  </span>
                  {badge && (
                    <span className="text-amber-400 text-xs font-semibold shrink-0 ml-1">
                      {badge}
                    </span>
                  )}
                </div>
              );
            })()}

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
                        width={28}
                        height={28}
                        className="w-7 h-7 object-contain shrink-0"
                        unoptimized
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-md bg-zinc-700 shrink-0" />
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
                  <div key={i} className="flex items-center gap-2">
                    <span
                      className="shrink-0 w-4 h-4 rounded flex items-center justify-center"
                      style={{
                        backgroundColor: task.done ? '#f59e0b' : 'transparent',
                        border: task.done
                          ? '2px solid #f59e0b'
                          : '2px solid #52525b',
                        fontSize: '9px',
                        color: '#1c1917',
                        fontWeight: 700,
                      }}
                    >
                      {task.done ? '\u2713' : ''}
                    </span>
                    <span
                      className={`text-sm leading-snug ${
                        task.done
                          ? 'text-zinc-500 line-through'
                          : 'text-zinc-300'
                      }`}
                    >
                      {task.text}
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
  );
}

export default function RoadmapViewer({ roadmap }: { roadmap: Roadmap }) {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);

  // Refs para acceder a los valores más recientes dentro de callbacks con debounce
  const completedIdsRef = useRef<Set<string>>(new Set());
  const nodesRef = useRef<Node[]>([]);

  const rawNodes = useMemo<Node[]>(
    () => (Array.isArray(roadmap.nodes) ? (roadmap.nodes as Node[]) : []),
    [roadmap.nodes]
  );
  const rawEdges = useMemo<Edge[]>(
    () => (Array.isArray(roadmap.edges) ? (roadmap.edges as Edge[]) : []),
    [roadmap.edges]
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(
    rawNodes.map(n => ({
      ...n,
      data: { ...n.data, completed: false, readOnly: true },
    }))
  );
  nodesRef.current = nodes;

  // Cargar progreso al montar
  useEffect(() => {
    setMounted(true);
    if (!user) return;
    fetchProgress(user.id, roadmap.id).then(
      ({ completedNodes, checklistState }) => {
        const idSet = new Set(completedNodes);
        setCompletedIds(idSet);
        completedIdsRef.current = idSet;
        // Aplicar completed + checklist done states directamente en nodes (un solo render)
        setNodes(
          rawNodes.map(n => {
            const savedDone = checklistState[n.id];
            const cl = n.data.checklist as
              | { text: string; done?: boolean }[]
              | undefined;
            const updatedChecklist = cl?.map((item, i) => ({
              ...item,
              done: savedDone
                ? (savedDone[i] ?? item.done ?? false)
                : (item.done ?? false),
            }));
            return {
              ...n,
              data: {
                ...n.data,
                completed: idSet.has(n.id),
                readOnly: true,
                ...(updatedChecklist ? { checklist: updatedChecklist } : {}),
              },
            };
          })
        );
        initializedRef.current = true;
      }
    );
  }, [user, roadmap.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Guardar con debounce de 800ms — guarda completed nodes Y checklist state
  const persistAll = useCallback(
    (completedNext?: Set<string>) => {
      if (!user) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const ids = completedNext ?? completedIdsRef.current;
        const checklistState: Record<string, boolean[]> = {};
        nodesRef.current.forEach(n => {
          const cl = n.data.checklist as
            | { text: string; done?: boolean }[]
            | undefined;
          if (cl && cl.length > 0) {
            checklistState[n.id] = cl.map(item => item.done ?? false);
          }
        });
        saveProgress(user.id, roadmap.id, Array.from(ids), checklistState);
      }, 800);
    },
    [user, roadmap.id]
  );

  // Auto-guardar cuando cambia el checklist en algún nodo (después de inicializar)
  useEffect(() => {
    if (!initializedRef.current) return;
    persistAll();
  }, [nodes]); // eslint-disable-line react-hooks/exhaustive-deps

  const onNodeMouseEnter: NodeMouseHandler = useCallback((_e, node) => {
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
      checklist?: { text: string; done?: boolean }[];
    };
    const pa =
      (node as unknown as { positionAbsolute?: { x: number; y: number } })
        .positionAbsolute ?? node.position;
    const w = node.measured?.width ?? 140;
    const h = node.measured?.height ?? 130;
    setTooltip({
      label: d.label ?? 'Group',
      nodeType: node.type ?? 'itemNode',
      icon_url: resolveIcon(d.icon_url, d.category),
      category: d.category,
      level: d.level,
      qty: d.qty,
      groupItems:
        node.type === 'groupNode'
          ? (d.items ?? []).map(it => ({
              ...it,
              icon_url: resolveIcon(it.icon_url, it.category),
            }))
          : undefined,
      checklist: ((d.checklist ?? []) as unknown[]).map(item =>
        typeof item === 'string'
          ? { text: item, done: false }
          : (item as { text: string; done?: boolean })
      ),
      flowRight: pa.x + w,
      flowTop: pa.y,
      flowHeight: h,
    });
  }, []);

  const onNodeMouseLeave: NodeMouseHandler = useCallback(() => {
    setTooltip(null);
  }, []);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_e, node) => {
      if (!user) return;
      // Actualizar visualmente en el mismo render (sin pasar por useEffect)
      setNodes(nds =>
        nds.map(n =>
          n.id === node.id
            ? { ...n, data: { ...n.data, completed: !n.data.completed } }
            : n
        )
      );
      setCompletedIds(prev => {
        const next = new Set(prev);
        if (next.has(node.id)) next.delete(node.id);
        else next.add(node.id);
        completedIdsRef.current = next;
        persistAll(next);
        return next;
      });
    },
    [user, persistAll, setNodes]
  );

  if (!mounted) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-950">
        <span className="text-zinc-500 text-sm">Loading…</span>
      </div>
    );
  }

  const completedCount = completedIds.size;
  const totalCount = rawNodes.length;

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
        edges={rawEdges}
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
        onNodesChange={onNodesChange}
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
        <TooltipOverlay tooltip={tooltip} />
      </ReactFlow>
    </div>
  );
}
