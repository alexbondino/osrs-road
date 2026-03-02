'use client';

import { useCallback, useRef, useState } from 'react';
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
import Sidebar from './Sidebar';
import type { SidebarItem } from './Sidebar';

const nodeTypes = { itemNode: ItemNode };

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

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

export default function RoadmapBuilder({
  skills,
  quests,
  itemsCount,
}: {
  skills: Skill[];
  quests: Quest[];
  itemsCount: number;
}) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [roadmapName, setRoadmapName] = useState('Mi Roadmap');

  const onConnect: OnConnect = useCallback(
    connection =>
      setEdges(eds =>
        addEdge(
          {
            ...connection,
            animated: true,
            style: { stroke: '#f59e0b', strokeWidth: 2 },
          },
          eds
        )
      ),
    [setEdges]
  );

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
        },
      };
      setNodes(nds => nds.concat(newNode));
    },
    [rfInstance, setNodes]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-4 px-4 py-2 bg-zinc-900 border-b border-zinc-700 shrink-0">
        <input
          value={roadmapName}
          onChange={e => setRoadmapName(e.target.value)}
          className="bg-zinc-800 text-white text-sm font-semibold px-3 py-1.5 rounded-md border border-zinc-600 focus:outline-none focus:border-amber-500 w-56"
          placeholder="Nombre del roadmap"
        />
        <span className="text-zinc-400 text-xs">
          {nodes.length} pasos · {edges.length} conexiones
        </span>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => {
              setNodes([]);
              setEdges([]);
            }}
            className="px-3 py-1.5 text-xs rounded-md border border-zinc-600 text-zinc-300 hover:bg-zinc-700 transition-colors"
          >
            Limpiar
          </button>
          <button className="px-3 py-1.5 text-xs rounded-md bg-amber-500 text-zinc-900 font-semibold hover:bg-amber-400 transition-colors">
            Guardar
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar skills={skills} quests={quests} itemsCount={itemsCount} />

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
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode="Delete"
          >
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
                    Arrastra items desde el panel izquierdo
                  </p>
                  <p className="text-zinc-600 text-xs mt-1">
                    Conecta los nodos arrastrando desde sus bordes
                  </p>
                </div>
              </div>
            )}
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}
