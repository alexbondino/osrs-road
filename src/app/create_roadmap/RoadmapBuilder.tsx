'use client';

import { useCallback, useRef, useState } from 'react';
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
import MidpointEdge from './MidpointEdge';
import AlignmentGuides, { type Guide } from './AlignmentGuides';
import Sidebar from './Sidebar';
import type { SidebarItem } from './Sidebar';
import { useAuth } from '@/hooks/useAuth';
import { saveRoadmap, updateRoadmap } from '@/lib/roadmaps';
import ThumbnailPicker from './ThumbnailPicker';

const NODE_WIDTH = 140;
const NODE_HEIGHT = 130;
const SNAP_THRESHOLD = 6;

const nodeTypes = { itemNode: ItemNode };
const edgeTypes = { midpoint: MidpointEdge };

let idCounter = 1;
const getId = () => `node_${idCounter++}`;

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
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [roadmapName, setRoadmapName] = useState(initialName);
  const [thumbnail, setThumbnail] = useState<string | null>(
    initialThumbnail ?? null
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(
    null
  );

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
      const dx = draggedNode.position.x;
      const dy = draggedNode.position.y;
      const dCX = dx + NODE_WIDTH / 2;
      const dCY = dy + NODE_HEIGHT / 2;
      const dR = dx + NODE_WIDTH;
      const dB = dy + NODE_HEIGHT;

      const newGuides: Guide[] = [];
      const seenH = new Set<number>();
      const seenV = new Set<number>();

      let snapX = dx;
      let snapY = dy;
      let snappedH = false;
      let snappedV = false;

      nodes.forEach(n => {
        if (n.id === draggedNode.id) return;
        const nL = n.position.x;
        const nT = n.position.y;
        const nCX = nL + NODE_WIDTH / 2;
        const nCY = nT + NODE_HEIGHT / 2;
        const nR = nL + NODE_WIDTH;
        const nB = nT + NODE_HEIGHT;

        // Horizontal checks (alinear borde superior, centro Y, borde inferior)
        const hChecks = [
          { drag: dy, ref: nT, guide: nT, snap: nT },
          { drag: dCY, ref: nCY, guide: nCY, snap: nT },
          { drag: dB, ref: nB, guide: nB, snap: nB - NODE_HEIGHT },
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
          { drag: dCX, ref: nCX, guide: nCX, snap: nCX - NODE_WIDTH / 2 },
          { drag: dR, ref: nR, guide: nR, snap: nR - NODE_WIDTH },
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

  const onNodeDragStop = useCallback(() => setGuides([]), []);

  const handleSave = async () => {
    if (!user) {
      setSaveMsg({ ok: false, text: 'You must be signed in to save.' });
      return;
    }
    if (nodes.length === 0) {
      setSaveMsg({ ok: false, text: 'Add at least one step before saving.' });
      setTimeout(() => setSaveMsg(null), 3000);
      return;
    }
    setSaving(true);
    setSaveMsg(null);
    try {
      const payload = {
        name: roadmapName.trim() || 'My Roadmap',
        thumbnail_url: thumbnail,
        nodes,
        edges,
      };
      if (roadmapId) {
        await updateRoadmap(roadmapId, payload);
        setSaveMsg({ ok: true, text: 'Saved!' });
        setTimeout(() => setSaveMsg(null), 2500);
      } else {
        const result = await saveRoadmap({ ...payload, user_id: user.id });
        setSaveMsg({ ok: true, text: 'Roadmap saved!' });
        if (result?.id) {
          setTimeout(() => router.push(`/roadmap/${result.id}`), 900);
        }
      }
    } catch (err: unknown) {
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
          onClick={() => setPickerOpen(true)}
          title="Set thumbnail"
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '0.375rem',
            border: '1px solid',
            borderColor: thumbnail ? '#f59e0b' : '#3f3f46',
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
          onChange={e => setRoadmapName(e.target.value)}
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
            onClick={handleSave}
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
          onSelect={url => setThumbnail(url)}
          onClose={() => setPickerOpen(false)}
          skills={skills}
          quests={quests}
          diaries={diaries}
        />
      )}
    </div>
  );
}
