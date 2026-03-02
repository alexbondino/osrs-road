'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Handle, Position } from '@xyflow/react';

interface ItemNodeData {
  label: string;
  icon_url: string | null;
  category: string;
  max_level?: number | null;
}

const QUEST_ICON =
  'https://oldschool.runescape.wiki/images/Quest_point_icon.png';

export default function ItemNode({ data }: { data: ItemNodeData }) {
  const [imgError, setImgError] = useState(false);
  const [level, setLevel] = useState('');

  const isSkill = data.category === 'Skill';
  const isQuest = data.category === 'Quest';

  const handleLevelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    const max = data.max_level ?? 99;
    if (val === '' || (Number(val) >= 1 && Number(val) <= max)) {
      setLevel(val);
    }
  };

  const iconSrc = isQuest ? QUEST_ICON : data.icon_url;
  const showFallback = !iconSrc || imgError;

  return (
    <div
      className="bg-zinc-800 border-2 border-zinc-600 rounded-xl shadow-xl hover:border-amber-500 transition-colors"
      style={{ width: 140, height: 130 }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-amber-300"
      />

      <div className="flex flex-col items-center justify-between h-full py-3 px-2">
        {/* Icono */}
        <div className="w-8 h-8 flex items-center justify-center shrink-0">
          {!showFallback ? (
            <Image
              src={iconSrc!}
              alt={data.label}
              width={32}
              height={32}
              className="w-8 h-8 object-contain"
              onError={() => setImgError(true)}
              unoptimized
            />
          ) : (
            <div className="w-8 h-8 rounded bg-zinc-700 flex items-center justify-center text-xs text-zinc-500">
              ?
            </div>
          )}
        </div>

        {/* Nombre */}
        <div className="text-white text-xs font-semibold text-center leading-tight w-full line-clamp-2 px-1">
          {data.label}
        </div>

        {/* Categoría o input level */}
        {isSkill ? (
          <div className="flex items-center gap-1">
            <span className="text-zinc-400 text-[10px]">Lvl</span>
            <input
              type="text"
              inputMode="numeric"
              value={level}
              onChange={handleLevelChange}
              maxLength={2}
              style={{ width: '1.6rem' }}
              className={`nodrag bg-zinc-700 text-white text-[11px] text-center rounded py-0.5 focus:outline-none transition-colors ${
                level === '' ? 'ring-1 ring-red-500' : 'ring-1 ring-amber-500'
              }`}
            />
          </div>
        ) : (
          <div className="text-amber-400 text-[10px] font-medium">
            {data.category}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-amber-300"
      />
    </div>
  );
}
