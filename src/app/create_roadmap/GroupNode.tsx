'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { Handle, Position, useReactFlow } from '@xyflow/react';

export interface GItem {
  label: string;
  icon_url: string | null;
  category: string;
  level?: string;
  qty?: string;
}

interface GroupNodeData {
  items: GItem[];
  _dockHighlight?: boolean;
}

const QUEST_ICON =
  'https://oldschool.runescape.wiki/images/Quest_point_icon.png';
const DIARY_ICON =
  'https://oldschool.runescape.wiki/images/Achievement_Diaries.png';

const CELL_W = 52;
const CELL_H = 48;
const H_PAD = 16;
const V_PAD = 16;

function resolveIcon(item: GItem): string | null {
  if (item.category === 'Quest') return QUEST_ICON;
  if (item.category === 'Diary') return DIARY_ICON;
  return item.icon_url;
}

function ItemCell({ item }: { item: GItem }) {
  const [error, setError] = useState(false);
  const [hovered, setHovered] = useState(false);
  const url = resolveIcon(item);

  // badge numérico para Item y Skill
  const badge =
    item.category === 'Item'
      ? `${item.qty ?? '1'}`
      : item.category === 'Skill' && item.level
        ? item.level
        : null;

  // Quest y Diary muestran su nombre completo
  const showLabel = item.category === 'Quest' || item.category === 'Diary';

  return (
    <div
      className="relative flex flex-col items-center justify-center gap-0.5"
      style={{ width: CELL_W, height: CELL_H }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {hovered && !showLabel && (
        <div className="absolute z-50 bottom-full mb-1 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-600 rounded px-1.5 py-0.5 text-[9px] text-white whitespace-nowrap shadow-lg pointer-events-none">
          {item.label}
        </div>
      )}

      {!url || error ? (
        <div className="w-6 h-6 rounded bg-zinc-600 flex items-center justify-center text-[9px] text-zinc-400">
          ?
        </div>
      ) : (
        <Image
          src={url}
          alt={item.label}
          width={24}
          height={24}
          className="w-6 h-6 object-contain"
          onError={() => setError(true)}
          unoptimized
        />
      )}

      {badge ? (
        <span className="text-[7px] text-amber-400 font-semibold leading-tight">
          {badge}
        </span>
      ) : showLabel ? (
        <span
          className="text-zinc-300 leading-tight text-center px-0.5 w-full"
          style={{
            fontSize: '6px',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            wordBreak: 'break-word',
          }}
        >
          {item.label}
        </span>
      ) : (
        <span className="text-[7px] text-zinc-500 leading-tight truncate max-w-full px-0.5">
          {item.category.slice(0, 1)}
        </span>
      )}
    </div>
  );
}

// ── Edit modal ──────────────────────────────────────────────────────────────

function ModalRow({
  item,
  onChange,
  onDelete,
}: {
  item: GItem;
  onChange: (updated: GItem) => void;
  onDelete: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const url = resolveIcon(item);

  return (
    <div className="flex items-center gap-3 py-2 border-b border-zinc-700 last:border-0">
      {/* icon */}
      <div className="w-8 h-8 shrink-0 flex items-center justify-center">
        {url && !imgError ? (
          <Image
            src={url}
            alt={item.label}
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

      {/* name */}
      <span className="text-white text-xs font-medium flex-1 truncate min-w-0">
        {item.label}
      </span>

      {/* editable field */}
      {item.category === 'Skill' && (
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-zinc-400 text-xs">Lv</span>
          <input
            type="text"
            inputMode="numeric"
            value={item.level ?? ''}
            maxLength={2}
            onChange={e => {
              const val = e.target.value.replace(/\D/g, '');
              onChange({ ...item, level: val });
            }}
            className="w-10 bg-zinc-700 text-white text-xs text-center rounded py-0.5 border border-zinc-600 focus:outline-none focus:border-amber-500"
          />
        </div>
      )}
      {item.category === 'Item' && (
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-zinc-400 text-xs">Qty</span>
          <input
            type="text"
            inputMode="numeric"
            value={item.qty ?? '1'}
            maxLength={6}
            onChange={e => {
              const val = e.target.value.replace(/\D/g, '');
              onChange({ ...item, qty: val });
            }}
            className="w-14 bg-zinc-700 text-white text-xs text-center rounded py-0.5 border border-zinc-600 focus:outline-none focus:border-amber-500"
          />
        </div>
      )}

      {/* delete */}
      <button
        onClick={onDelete}
        className="shrink-0 w-6 h-6 rounded flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-zinc-700 transition-colors"
        title="Remove"
      >
        ✕
      </button>
    </div>
  );
}

function EditModal({
  items,
  onSave,
  onClose,
}: {
  items: GItem[];
  onSave: (items: GItem[]) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<GItem[]>(items);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const update = (i: number, updated: GItem) =>
    setDraft(d => d.map((it, idx) => (idx === i ? updated : it)));

  const remove = (i: number) => setDraft(d => d.filter((_, idx) => idx !== i));

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-80 max-h-[70vh] flex flex-col overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700 shrink-0">
          <span className="text-white font-semibold text-sm">Edit group</span>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors text-base leading-none"
          >
            ✕
          </button>
        </div>

        {/* list */}
        <div className="flex-1 overflow-y-auto px-4">
          {draft.length === 0 ? (
            <p className="text-zinc-500 text-xs text-center py-6">No items</p>
          ) : (
            draft.map((item, i) => (
              <ModalRow
                key={i}
                item={item}
                onChange={updated => update(i, updated)}
                onDelete={() => remove(i)}
              />
            ))
          )}
        </div>

        {/* footer */}
        <div className="flex gap-2 px-4 py-3 border-t border-zinc-700 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-1.5 rounded-md text-xs text-zinc-300 border border-zinc-600 hover:bg-zinc-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSave(draft);
              onClose();
            }}
            className="flex-1 py-1.5 rounded-md text-xs font-semibold bg-amber-500 text-zinc-900 hover:bg-amber-400 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Main node ───────────────────────────────────────────────────────────────

export default function GroupNode({
  id,
  data,
}: {
  id: string;
  data: GroupNodeData;
}) {
  const { updateNodeData } = useReactFlow();
  const [modalOpen, setModalOpen] = useState(false);

  const items = data.items ?? [];
  const highlighted = data._dockHighlight ?? false;

  const count = items.length || 1;
  const rows = Math.max(2, Math.ceil(Math.sqrt(count)));
  const cols = Math.max(2, Math.ceil(count / rows));

  const nodeW = cols * CELL_W + H_PAD;
  const nodeH = rows * CELL_H + V_PAD;

  return (
    <>
      <div
        className={`relative border-2 rounded-xl transition-all ${
          highlighted
            ? 'border-amber-400 shadow-[0_0_22px_6px_rgba(251,191,36,0.6)] bg-zinc-700'
            : 'border-amber-500/50 bg-zinc-800/90 shadow-xl'
        }`}
        style={{ width: nodeW, height: nodeH }}
        onDoubleClick={e => {
          e.stopPropagation();
          setModalOpen(true);
        }}
        title="Double-click to edit"
      >
        <Handle
          type="target"
          position={Position.Left}
          className="w-3! h-3! bg-amber-500! border-2! border-amber-300!"
        />

        <div
          className="flex items-center justify-center w-full h-full"
          style={{ padding: `${V_PAD / 2}px ${H_PAD / 2}px` }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${cols}, ${CELL_W}px)`,
              gridTemplateRows: `repeat(${rows}, ${CELL_H}px)`,
              gridAutoFlow: 'column',
            }}
          >
            {items.map((item, i) => (
              <ItemCell key={i} item={item} />
            ))}
          </div>
        </div>

        <Handle
          type="source"
          position={Position.Right}
          className="w-3! h-3! bg-amber-500! border-2! border-amber-300!"
        />
      </div>

      {modalOpen && (
        <EditModal
          items={items}
          onSave={updated => updateNodeData(id, { items: updated })}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
