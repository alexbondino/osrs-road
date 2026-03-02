'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Handle, Position, useReactFlow } from '@xyflow/react';

interface ItemNodeData {
  label: string;
  icon_url: string | null;
  category: string;
  max_level?: number | null;
  level?: string;
  qty?: string;
  completed?: boolean;
}

const QUEST_ICON =
  'https://oldschool.runescape.wiki/images/Quest_point_icon.png';
const DIARY_ICON =
  'https://oldschool.runescape.wiki/images/Achievement_Diaries.png';

export default function ItemNode({
  id,
  data,
}: {
  id: string;
  data: ItemNodeData;
}) {
  const { updateNodeData } = useReactFlow();
  const [imgError, setImgError] = useState(false);

  const isSkill = data.category === 'Skill';
  const isQuest = data.category === 'Quest';
  const isDiary = data.category === 'Diary';
  const isItem = data.category === 'Item';
  const completed = data.completed ?? false;

  const level = data.level ?? '';
  const qty = data.qty ?? '1';

  const handleLevelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    const max = data.max_level ?? 99;
    if (val === '' || (Number(val) >= 1 && Number(val) <= max)) {
      updateNodeData(id, { level: val });
    }
  };

  const handleQtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    if (val === '' || Number(val) >= 1) {
      updateNodeData(id, { qty: val });
    }
  };

  const iconSrc = isQuest ? QUEST_ICON : isDiary ? DIARY_ICON : data.icon_url;
  const showFallback = !iconSrc || imgError;

  return (
    <div
      className={`relative border-2 rounded-xl shadow-xl transition-colors ${
        completed
          ? 'bg-amber-950 border-amber-500 shadow-amber-900/40'
          : 'bg-zinc-800 border-zinc-600 hover:border-amber-500'
      }`}
      style={{ width: 140, height: 130 }}
    >
      {completed && (
        <div
          className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center"
          style={{
            fontSize: '9px',
            lineHeight: 1,
            color: '#1c1917',
            fontWeight: 700,
            zIndex: 10,
          }}
        >
          ✓
        </div>
      )}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3! h-3! bg-amber-500! border-2! border-amber-300!"
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

        {/* Categoría, input level o input qty */}
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
        ) : isItem ? (
          <div className="flex items-center gap-1">
            <span className="text-zinc-400 text-[10px]">Qty</span>
            <input
              type="text"
              inputMode="numeric"
              value={qty}
              onChange={handleQtyChange}
              maxLength={4}
              style={{ width: '2rem' }}
              className="nodrag bg-zinc-700 text-white text-[11px] text-center rounded py-0.5 focus:outline-none ring-1 ring-amber-500 transition-colors"
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
        className="w-3! h-3! bg-amber-500! border-2! border-amber-300!"
      />
    </div>
  );
}
