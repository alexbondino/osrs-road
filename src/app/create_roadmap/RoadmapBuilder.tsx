'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  type OnConnect,
  type Node,
  type Edge,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import ItemNode from './ItemNode';
import GroupNode from './GroupNode';
import type { GItem } from './GroupNode';
import MidpointEdge from './MidpointEdge';
import AlignmentGuides, { type Guide } from './AlignmentGuides';
import Sidebar from './Sidebar';
import type { SidebarItem } from './Sidebar';
import { useAuth } from '@/hooks/useAuth';
import { saveRoadmap, updateRoadmap } from '@/lib/roadmaps';
import ThumbnailPicker from './ThumbnailPicker';
import AuthModal from '@/components/AuthModal';

const NODE_WIDTH = 140;
const NODE_HEIGHT = 130;
const SNAP_THRESHOLD = 6;

const nodeTypes = { itemNode: ItemNode, groupNode: GroupNode };
const edgeTypes = { midpoint: MidpointEdge };

// idCounter is managed per-component instance via useRef (see RoadmapBuilder)

interface Skill {
  id: number;
  name: string;
  icon_url: string | null;
  max_level: number;
}

interface Quest {
  id: number;
  name: string;
  icon_url: string | null;
  difficulty: string | null;
  members: boolean;
}

interface Diary {
  id: number;
  name: string;
  area: string | null;
  tier: string | null;
  icon_url: string | null;
}

export default function RoadmapBuilder({
  skills,
  quests,
  diaries,
  itemsCount,
  initialNodes = [],
  initialEdges = [],
  initialName = 'My Roadmap',
  initialThumbnail = null,
  roadmapId,
}: {
  skills: Skill[];
  quests: Quest[];
  diaries: Diary[];
  itemsCount: number;
  initialNodes?: Node[];
  initialEdges?: Edge[];
  initialName?: string;
  initialThumbnail?: string | null;
  roadmapId?: string;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChangeBase] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState(initialEdges);

  const onNodesChange: typeof onNodesChangeBase = useCallback(
    changes => {
      setIsDirty(true);
      onNodesChangeBase(changes);
    },
    [onNodesChangeBase]
  );
  const onEdgesChange: typeof onEdgesChangeBase = useCallback(
    changes => {
      setIsDirty(true);
      onEdgesChangeBase(changes);
    },
    [onEdgesChangeBase]
  );

  // Initialize counter above any existing node IDs to avoid collisions
  const idCounterRef = useRef<number>(
    (() => {
      let max = 0;
      initialNodes.forEach(n => {
        const m = n.id.match(/^node_(\d+)$/);
        if (m) max = Math.max(max, Number(m[1]));
      });
      return max + 1;
    })()
  );
  const getId = useCallback(() => `node_${idCounterRef.current++}`, []);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [roadmapName, setRoadmapName] = useState(initialName);
  const [thumbnail, setThumbnail] = useState<string | null>(
    initialThumbnail ?? null
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [thumbErrorKey, setThumbErrorKey] = useState(0);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(
    null
  );
  const [pendingSave, setPendingSave] = useState(false);
  // true if the roadmap already has a thumbnail or the user picked one this session
  const [coverConfirmed, setCoverConfirmed] = useState(
    initialThumbnail != null && initialThumbnail !== ''
  );
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Warn on browser refresh / tab close when there are unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Intercept in-app navigation clicks when dirty
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!isDirty) return;
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor || anchor.getAttribute('target') === '_blank') return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to leave?'
      );
      if (!confirmed) e.preventDefault();
    };
    window.addEventListener('click', handleClick, true);
    return () => window.removeEventListener('click', handleClick, true);
  }, [isDirty]);
  // ref to current dock target — updated on every drag without causing re-renders
  const dockTargetRef = useRef<string | null>(null);

  const onConnect: OnConnect = useCallback(
    connection =>
      setEdges(eds =>
        addEdge(
          {
            ...connection,
            type: 'midpoint',
          },
          eds
        )
      ),
    [setEdges]
  );

  const onNodeDrag = useCallback(
    (_: React.MouseEvent, draggedNode: Node) => {
      const dW = draggedNode.measured?.width ?? NODE_WIDTH;
      const dH = draggedNode.measured?.height ?? NODE_HEIGHT;
      const dx = draggedNode.position.x;
      const dy = draggedNode.position.y;
      const dCX = dx + dW / 2;
      const dCY = dy + dH / 2;
      const dR = dx + dW;
      const dB = dy + dH;

      // ── Dock detection (priority over alignment snap) ──────────────
      let newDockTarget: string | null = null;
      for (const n of nodes) {
        if (n.id === draggedNode.id) continue;
        const nW = n.measured?.width ?? NODE_WIDTH;
        const nH = n.measured?.height ?? NODE_HEIGHT;
        const nL = n.position.x;
        const nT = n.position.y;
        if (dCX > nL && dCX < nL + nW && dCY > nT && dCY < nT + nH) {
          newDockTarget = n.id;
          break;
        }
      }

      // only call setNodes when the dock target changes
      if (newDockTarget !== dockTargetRef.current) {
        dockTargetRef.current = newDockTarget;
        setNodes(nds =>
          nds.map(n => ({
            ...n,
            data: { ...n.data, _dockHighlight: n.id === newDockTarget },
          }))
        );
      }

      if (newDockTarget) {
        setGuides([]);
        return; // skip alignment guides when docking
      }

      // ── Alignment guide snap ───────────────────────────────────────
      const newGuides: Guide[] = [];
      const seenH = new Set<number>();
      const seenV = new Set<number>();

      let snapX = dx;
      let snapY = dy;
      let snappedH = false;
      let snappedV = false;

      nodes.forEach(n => {
        if (n.id === draggedNode.id) return;
        const nW = n.measured?.width ?? NODE_WIDTH;
        const nH = n.measured?.height ?? NODE_HEIGHT;
        const nL = n.position.x;
        const nT = n.position.y;
        const nCX = nL + nW / 2;
        const nCY = nT + nH / 2;
        const nR = nL + nW;
        const nB = nT + nH;

        // Horizontal checks (alinear borde superior, centro Y, borde inferior)
        const hChecks = [
          { drag: dy, ref: nT, guide: nT, snap: nT },
          { drag: dCY, ref: nCY, guide: nCY, snap: nCY - dH / 2 },
          { drag: dB, ref: nB, guide: nB, snap: nB - dH },
        ];
        hChecks.forEach(({ drag, ref, guide, snap }) => {
          if (Math.abs(drag - ref) < SNAP_THRESHOLD && !seenH.has(guide)) {
            newGuides.push({ type: 'h', pos: guide });
            seenH.add(guide);
            if (!snappedH) {
              snapY = snap;
              snappedH = true;
            }
          }
        });

        // Vertical checks (alinear borde izquierdo, centro X, borde derecho)
        const vChecks = [
          { drag: dx, ref: nL, guide: nL, snap: nL },
          { drag: dCX, ref: nCX, guide: nCX, snap: nCX - dW / 2 },
          { drag: dR, ref: nR, guide: nR, snap: nR - dW },
        ];
        vChecks.forEach(({ drag, ref, guide, snap }) => {
          if (Math.abs(drag - ref) < SNAP_THRESHOLD && !seenV.has(guide)) {
            newGuides.push({ type: 'v', pos: guide });
            seenV.add(guide);
            if (!snappedV) {
              snapX = snap;
              snappedV = true;
            }
          }
        });
      });

      if (snappedH || snappedV) {
        setNodes(nds =>
          nds.map(n =>
            n.id === draggedNode.id
              ? { ...n, position: { x: snapX, y: snapY } }
              : n
          )
        );
      }

      setGuides(newGuides);
    },
    [nodes, setNodes]
  );

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, draggedNode: Node) => {
      setGuides([]);

      // Clear all dock highlights
      setNodes(nds =>
        nds.map(n => ({ ...n, data: { ...n.data, _dockHighlight: false } }))
      );

      const currentDockTarget = dockTargetRef.current;
      dockTargetRef.current = null;

      if (currentDockTarget) {
        // ── Merge dragged node into target ──────────────────────────
        const extractItems = (node: Node): GItem[] => {
          if (node.type === 'groupNode') {
            return (
              (node.data as { items?: (GItem | null)[] }).items ?? []
            ).filter((x): x is GItem => x !== null);
          }
          const d = node.data as Record<string, unknown>;
          return [
            {
              label: String(d.label ?? ''),
              icon_url: d.icon_url != null ? String(d.icon_url) : null,
              category: String(d.category ?? ''),
              ...(d.level != null ? { level: String(d.level) } : {}),
              ...(d.qty != null ? { qty: String(d.qty) } : {}),
            },
          ];
        };

        const draggedItems = extractItems(draggedNode);

        setNodes(nds => {
          const target = nds.find(n => n.id === currentDockTarget);
          if (!target) return nds;
          const seen = new Set<string>();
          const mergedItems: GItem[] = [
            ...extractItems(target),
            ...draggedItems,
          ].filter(item => {
            const key = `${item.category}::${item.label}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          return nds
            .filter(n => n.id !== draggedNode.id)
            .map(n =>
              n.id === currentDockTarget
                ? { ...n, type: 'groupNode', data: { items: mergedItems } }
                : n
            );
        });

        // Redirect edges from dragged node to the new group node
        setEdges(eds =>
          eds
            .filter(
              e =>
                !(
                  e.source === draggedNode.id && e.target === currentDockTarget
                ) &&
                !(e.source === currentDockTarget && e.target === draggedNode.id)
            )
            .map(e => ({
              ...e,
              source:
                e.source === draggedNode.id ? currentDockTarget : e.source,
              target:
                e.target === draggedNode.id ? currentDockTarget : e.target,
            }))
        );
        return;
      }

      // ── Normal final alignment snap ──────────────────────────────
      const dW = draggedNode.measured?.width ?? NODE_WIDTH;
      const dH = draggedNode.measured?.height ?? NODE_HEIGHT;
      const dx = draggedNode.position.x;
      const dy = draggedNode.position.y;
      const dCX = dx + dW / 2;
      const dCY = dy + dH / 2;
      const dR = dx + dW;
      const dB = dy + dH;

      let snapX = dx;
      let snapY = dy;
      let snappedH = false;
      let snappedV = false;
      const STOP_THRESHOLD = SNAP_THRESHOLD + 4;

      nodes.forEach(n => {
        if (n.id === draggedNode.id) return;
        const nW = n.measured?.width ?? NODE_WIDTH;
        const nH = n.measured?.height ?? NODE_HEIGHT;
        const nL = n.position.x;
        const nT = n.position.y;
        const nCX = nL + nW / 2;
        const nCY = nT + nH / 2;
        const nR = nL + nW;
        const nB = nT + nH;

        if (!snappedH) {
          if (Math.abs(dy - nT) < STOP_THRESHOLD) {
            snapY = nT;
            snappedH = true;
          } else if (Math.abs(dCY - nCY) < STOP_THRESHOLD) {
            snapY = nCY - dH / 2;
            snappedH = true;
          } else if (Math.abs(dB - nB) < STOP_THRESHOLD) {
            snapY = nB - dH;
            snappedH = true;
          }
        }
        if (!snappedV) {
          if (Math.abs(dx - nL) < STOP_THRESHOLD) {
            snapX = nL;
            snappedV = true;
          } else if (Math.abs(dCX - nCX) < STOP_THRESHOLD) {
            snapX = nCX - dW / 2;
            snappedV = true;
          } else if (Math.abs(dR - nR) < STOP_THRESHOLD) {
            snapX = nR - dW;
            snappedV = true;
          }
        }
      });

      if (snappedH || snappedV) {
        setNodes(nds =>
          nds.map(n =>
            n.id === draggedNode.id
              ? { ...n, position: { x: snapX, y: snapY } }
              : n
          )
        );
      }
    },
    [nodes, setNodes, setEdges]
  );

  const handleSave = async (overrideThumbnail?: string) => {
    const thumb = overrideThumbnail ?? thumbnail;
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    if (nodes.length === 0) {
      setSaveMsg({ ok: false, text: 'Add at least one step before saving.' });
      setTimeout(() => setSaveMsg(null), 3000);
      return;
    }
    // Skip picker if the user just picked a cover (overrideThumbnail is from onSelect)
    // or has already confirmed one this session. Open picker otherwise.
    const justPicked = overrideThumbnail !== undefined;
    if (!thumb || (!coverConfirmed && !justPicked)) {
      setPendingSave(true);
      setPickerOpen(true);
      return;
    }
    setSaving(true);
    setSaveMsg(null);
    try {
      // Extract only plain-primitive fields from each ReactFlow node/edge.
      // roadmaps.ts uses raw fetch + safeStringify so postgrest-js never
      // touches these objects, but we still sanitize here for clean DB data.
      const safeNodes = nodes.map(n => {
        if (n.type === 'groupNode') {
          const d = n.data as {
            items?: (GItem | null)[];
            checklist?: unknown[];
          };
          return {
            id: String(n.id),
            type: 'groupNode',
            position: { x: Number(n.position.x), y: Number(n.position.y) },
            data: {
              items: (d.items ?? []).map(item =>
                item === null
                  ? null
                  : {
                      label: String(item.label ?? ''),
                      icon_url:
                        item.icon_url != null ? String(item.icon_url) : null,
                      category: String(item.category ?? ''),
                      ...(item.level != null
                        ? { level: String(item.level) }
                        : {}),
                      ...(item.qty != null ? { qty: String(item.qty) } : {}),
                    }
              ),
              checklist: d.checklist ?? [],
            },
          };
        }
        const d = n.data as Record<string, unknown>;
        return {
          id: String(n.id),
          type: String(n.type ?? 'itemNode'),
          position: { x: Number(n.position.x), y: Number(n.position.y) },
          data: {
            label: String(d?.label ?? ''),
            icon_url: d?.icon_url != null ? String(d.icon_url) : null,
            category: String(d?.category ?? ''),
            max_level: d?.max_level != null ? Number(d.max_level) : null,
            ...(d?.level != null ? { level: String(d.level) } : {}),
            ...(d?.qty != null ? { qty: String(d.qty) } : {}),
            ...(d?.completed != null
              ? { completed: Boolean(d.completed) }
              : {}),
            ...(Array.isArray(d?.checklist)
              ? { checklist: d.checklist as unknown[] }
              : {}),
          },
        };
      });
      const safeEdges = edges.map(e => ({
        id: String(e.id),
        source: String(e.source),
        target: String(e.target),
        ...(e.type != null ? { type: String(e.type) } : {}),
        ...(e.data?.mx != null ? { data: { mx: Number(e.data.mx) } } : {}),
      }));
      const payload = {
        name: roadmapName.trim() || 'My Roadmap',
        thumbnail_url: thumb,
        nodes: safeNodes,
        edges: safeEdges,
      };
      if (roadmapId) {
        await updateRoadmap(roadmapId, payload);
        setIsDirty(false);
        setSaveMsg({ ok: true, text: 'Saved!' });
        setTimeout(() => setSaveMsg(null), 2500);
      } else {
        const result = await saveRoadmap({ ...payload, user_id: user.id });
        setIsDirty(false);
        setSaveMsg({ ok: true, text: 'Roadmap saved!' });
        if (result?.id) {
          setTimeout(() => router.push(`/roadmap/${result.id}`), 900);
        }
      }
    } catch (err: unknown) {
      console.error('[RoadmapBuilder] Save error:', err);
      setSaveMsg({
        ok: false,
        text: err instanceof Error ? err.message : 'Could not save roadmap.',
      });
    } finally {
      setSaving(false);
    }
  };

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData('application/reactflow');
      if (!raw || !rfInstance) return;
      const item: SidebarItem = JSON.parse(raw);
      const bounds = reactFlowWrapper.current!.getBoundingClientRect();
      const position = rfInstance.screenToFlowPosition({
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top,
      });
      const newNode: Node = {
        id: getId(),
        type: 'itemNode',
        position,
        data: {
          label: item.name,
          icon_url: item.icon_url,
          category: item.category,
          max_level: item.max_level ?? null,
        },
      };
      setNodes(nds => nds.concat(newNode));
    },
    [rfInstance, setNodes]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-zinc-900 border-b border-zinc-700 shrink-0">
        {/* Thumbnail button */}
        <button
          key={thumbErrorKey}
          onClick={() => setPickerOpen(true)}
          title="Set thumbnail"
          className={
            thumbErrorKey > 0 && !thumbnail ? 'thumb-error-blink' : undefined
          }
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '0.375rem',
            border: '1px solid',
            borderColor: thumbnail
              ? '#f59e0b'
              : thumbErrorKey > 0
                ? '#ef4444'
                : '#3f3f46',
            background: '#09090b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            overflow: 'hidden',
            padding: 0,
          }}
        >
          {thumbnail ? (
            <img
              src={thumbnail}
              alt="thumbnail"
              style={{
                width: '26px',
                height: '26px',
                objectFit: 'contain',
                imageRendering: 'pixelated',
              }}
            />
          ) : (
            <span style={{ fontSize: '0.8rem', color: '#52525b' }}>🖼</span>
          )}
        </button>
        <input
          value={roadmapName}
          onChange={e => {
            setRoadmapName(e.target.value);
            setIsDirty(true);
          }}
          className="bg-zinc-800 text-white text-sm font-semibold px-3 py-1.5 rounded-md border border-zinc-600 focus:outline-none focus:border-amber-500 w-56"
          placeholder="Roadmap name"
        />
        <span className="text-zinc-400 text-xs">
          {nodes.length} steps · {edges.length} connections
        </span>
        <div className="ml-auto flex items-center gap-2">
          {saveMsg && (
            <span
              className={`text-xs px-2 py-1 rounded-md ${
                saveMsg.ok
                  ? 'bg-green-900/50 text-green-400'
                  : 'bg-red-900/50 text-red-400'
              }`}
            >
              {saveMsg.text}
            </span>
          )}
          <button
            onClick={() => {
              setNodes([]);
              setEdges([]);
            }}
            className="px-3 py-1.5 text-xs rounded-md border border-zinc-600 text-zinc-300 hover:bg-zinc-700 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={() => handleSave()}
            disabled={saving}
            className="px-3 py-1.5 text-xs rounded-md bg-amber-500 text-zinc-900 font-semibold hover:bg-amber-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : roadmapId ? 'Update' : 'Save'}
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          skills={skills}
          quests={quests}
          diaries={diaries}
          itemsCount={itemsCount}
        />

        {/* Canvas */}
        <div ref={reactFlowWrapper} className="flex-1 bg-zinc-950">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setRfInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            deleteKeyCode={['Backspace', 'Delete']}
          >
            <AlignmentGuides guides={guides} />
            <Controls className="[&>button]:bg-zinc-800 [&>button]:border-zinc-600 [&>button]:text-white" />
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="#3f3f46"
            />
            {nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <div className="text-4xl mb-3">🗺️</div>
                  <p className="text-zinc-500 text-sm">
                    Drag items from the left panel
                  </p>
                  <p className="text-zinc-600 text-xs mt-1">
                    Connect nodes by dragging from their edges
                  </p>
                </div>
              </div>
            )}
          </ReactFlow>
        </div>
      </div>

      {pickerOpen && (
        <ThumbnailPicker
          onSelect={url => {
            setThumbnail(url);
            setThumbErrorKey(0);
            setCoverConfirmed(true);
            if (pendingSave) {
              setPendingSave(false);
              handleSave(url);
            }
          }}
          onClose={() => {
            setPendingSave(false);
            setPickerOpen(false);
          }}
          skills={skills}
        />
      )}

      {authModalOpen && (
        <AuthModal
          initialTab="signup"
          message="You must be signed in to save your roadmap."
          onClose={() => setAuthModalOpen(false)}
        />
      )}
    </div>
  );
}
