'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Handle, Position } from '@xyflow/react';

interface ItemNodeData {
  label: string;
  icon_url: string | null;
  category: string;
}

export default function ItemNode({ data }: { data: ItemNodeData }) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="bg-zinc-800 border-2 border-zinc-600 rounded-lg p-3 min-w-[130px] text-center shadow-xl hover:border-amber-500 transition-colors">
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-amber-300"
      />
      <div className="flex justify-center mb-1.5">
        {data.icon_url && !imgError ? (
          <Image
            src={data.icon_url}
            alt={data.label}
            width={32}
            height={32}
            className="w-8 h-8 object-contain"
            onError={() => setImgError(true)}
            unoptimized
          />
        ) : (
          <div className="w-8 h-8 rounded bg-zinc-600 flex items-center justify-center text-xs text-zinc-400">
            ?
          </div>
        )}
      </div>
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
