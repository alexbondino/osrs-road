'use client';

import { Handle, Position } from '@xyflow/react';

interface ItemNodeData {
  label: string;
  emoji: string;
  category: string;
}

export default function ItemNode({ data }: { data: ItemNodeData }) {
  return (
    <div className="bg-zinc-800 border-2 border-zinc-600 rounded-lg p-3 min-w-[130px] text-center shadow-xl hover:border-amber-500 transition-colors">
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-amber-300"
      />
      <div className="text-3xl mb-1">{data.emoji}</div>
      <div className="text-white text-xs font-semibold leading-tight">
        {data.label}
      </div>
      <div className="text-amber-400 text-xs mt-0.5">{data.category}</div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-amber-300"
      />
    </div>
  );
}
