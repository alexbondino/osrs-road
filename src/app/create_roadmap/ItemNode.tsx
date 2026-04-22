'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  _dockHighlight?: boolean;
  checklist?: CheckItem[];
  readOnly?: boolean;
}

type CheckItem = { text: string; done?: boolean };

function normalizeChecklist(raw: unknown[] | undefined): CheckItem[] {
  if (!raw) return [];
  return raw.map(item =>
    typeof item === 'string' ? { text: item, done: false } : (item as CheckItem)
  );
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
  const [checklistOpen, setChecklistOpen] = useState(false);

  const isSkill = data.category === 'Skill';
  const isQuest = data.category === 'Quest';
  const isDiary = data.category === 'Diary';
  const isItem = data.category === 'Item';
  const completed = data.completed ?? false;
  const checklist = normalizeChecklist(data.checklist as unknown[]);
  const readOnly = data.readOnly ?? false;

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
    <>
      <div
        className={`relative border-2 rounded-xl shadow-xl transition-all ${
          data._dockHighlight
            ? 'bg-zinc-700 border-amber-400 shadow-[0_0_22px_6px_rgba(251,191,36,0.6)]'
            : completed
              ? 'border-amber-500'
              : 'bg-zinc-800 border-zinc-600 hover:border-amber-500'
        }`}
        style={{
          width: 140,
          height: 130,
          backgroundColor:
            completed && !data._dockHighlight ? '#78350f' : undefined,
        }}
        onDoubleClick={e => {
          if ((e.target as HTMLElement).closest('input')) return;
          e.stopPropagation();
          setChecklistOpen(true);
        }}
        title="Double-click to edit checklist"
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
            readOnly ? (
              <div className="text-amber-400 text-[10px] font-medium">
                {level ? `Lv ${level}` : 'Lv ?'}
              </div>
            ) : (
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
                    level === ''
                      ? 'ring-1 ring-red-500'
                      : 'ring-1 ring-amber-500'
                  }`}
                />
              </div>
            )
          ) : isItem ? (
            readOnly ? (
              <div className="text-amber-400 text-[10px] font-medium">
                {qty && qty !== '1' ? `×${qty}` : ''}
              </div>
            ) : (
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
            )
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

      {checklistOpen && (
        <ItemEditModal
          data={data}
          readOnly={readOnly}
          onSave={(level, qty, cl) =>
            updateNodeData(id, { level, qty, checklist: cl })
          }
          onClose={() => setChecklistOpen(false)}
        />
      )}
    </>
  );
}

function ItemEditModal({
  data,
  readOnly,
  onSave,
  onClose,
}: {
  data: ItemNodeData;
  readOnly?: boolean;
  onSave: (level: string, qty: string, checklist: CheckItem[]) => void;
  onClose: () => void;
}) {
  const isSkill = data.category === 'Skill';
  const isItem = data.category === 'Item';
  const [level, setLevel] = useState(data.level ?? '');
  const [qty, setQty] = useState(data.qty ?? '1');
  const [clDraft, setClDraft] = useState<CheckItem[]>(
    normalizeChecklist(data.checklist as unknown[])
  );
  const [newTask, setNewTask] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const addTask = () => {
    const t = newTask.trim();
    if (!t) return;
    setClDraft(d => [...d, { text: t, done: false }]);
    setNewTask('');
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-80 max-h-[75vh] flex flex-col overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700 shrink-0">
          <span className="text-white font-semibold text-sm truncate">
            {data.label}
          </span>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors text-base leading-none ml-2 shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4">
          {/* level / qty */}
          {isSkill && (
            <div className="flex items-center gap-2 py-3 border-b border-zinc-700">
              {data.icon_url && (
                <Image
                  src={data.icon_url}
                  alt={data.label}
                  width={24}
                  height={24}
                  className="w-6 h-6 object-contain shrink-0"
                  unoptimized
                />
              )}
              <span className="text-white text-xs font-medium flex-1 truncate">
                {data.label}
              </span>
              <span className="text-zinc-400 text-xs">Lv</span>
              {readOnly ? (
                <span className="text-white text-sm font-semibold">
                  {level || '—'}
                </span>
              ) : (
                <input
                  type="text"
                  inputMode="numeric"
                  value={level}
                  maxLength={2}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '');
                    const max = data.max_level ?? 99;
                    if (val === '' || (Number(val) >= 1 && Number(val) <= max))
                      setLevel(val);
                  }}
                  className="w-16 bg-zinc-700 text-white text-sm text-center rounded py-1 border border-zinc-600 focus:outline-none focus:border-amber-500"
                />
              )}
            </div>
          )}
          {isItem && (
            <div className="flex items-center gap-2 py-3 border-b border-zinc-700">
              {data.icon_url && (
                <Image
                  src={data.icon_url}
                  alt={data.label}
                  width={24}
                  height={24}
                  className="w-6 h-6 object-contain shrink-0"
                  unoptimized
                />
              )}
              <span className="text-white text-xs font-medium flex-1 truncate">
                {data.label}
              </span>
              <span className="text-zinc-400 text-xs">Qty</span>
              {readOnly ? (
                <span className="text-white text-sm font-semibold">
                  {qty || '—'}
                </span>
              ) : (
                <input
                  type="text"
                  inputMode="numeric"
                  value={qty}
                  maxLength={6}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '');
                    if (val === '' || Number(val) >= 1) setQty(val);
                  }}
                  className="w-20 bg-zinc-700 text-white text-sm text-center rounded py-1 border border-zinc-600 focus:outline-none focus:border-amber-500"
                />
              )}
            </div>
          )}

          {/* checklist */}
          <div className="mt-2 mb-2">
            <div className="flex items-center gap-2 py-2">
              <span className="text-zinc-400 text-[10px] font-semibold uppercase tracking-wider">
                Checklist
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {clDraft.length === 0 && (
                <p className="text-zinc-600 text-xs py-1">No objectives yet</p>
              )}
              {clDraft.map((task, i) => (
                <div key={i} className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setClDraft(d =>
                        d.map((t, idx) =>
                          idx === i ? { ...t, done: !t.done } : t
                        )
                      )
                    }
                    className={`nodrag shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      task.done
                        ? 'bg-amber-500 border-amber-500'
                        : 'border-zinc-500 hover:border-amber-400'
                    }`}
                    style={{
                      fontSize: '10px',
                      color: '#1c1917',
                      fontWeight: 700,
                    }}
                  >
                    {task.done ? '\u2713' : ''}
                  </button>
                  {readOnly ? (
                    <span
                      className={`flex-1 text-xs leading-snug ${
                        task.done
                          ? 'text-zinc-500 line-through'
                          : 'text-zinc-200'
                      }`}
                    >
                      {task.text}
                    </span>
                  ) : (
                    <input
                      type="text"
                      value={task.text}
                      onChange={e =>
                        setClDraft(d =>
                          d.map((t, idx) =>
                            idx === i ? { ...t, text: e.target.value } : t
                          )
                        )
                      }
                      className="flex-1 bg-zinc-800 text-white text-xs rounded px-2 py-1 border border-zinc-600 focus:outline-none focus:border-amber-500"
                    />
                  )}
                  {!readOnly && (
                    <button
                      onClick={() =>
                        setClDraft(d => d.filter((_, idx) => idx !== i))
                      }
                      className="shrink-0 w-6 h-6 rounded flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-zinc-700 transition-colors"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              {!readOnly && (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    value={newTask}
                    onChange={e => setNewTask(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTask();
                      }
                    }}
                    placeholder="New objective…"
                    className="flex-1 bg-zinc-800 text-white text-xs rounded px-2 py-1 border border-zinc-600 focus:outline-none focus:border-amber-500 placeholder:text-zinc-600"
                  />
                  <button
                    onClick={addTask}
                    className="shrink-0 px-2 py-1 rounded text-xs bg-amber-500 text-zinc-900 font-semibold hover:bg-amber-400 transition-colors"
                  >
                    + Add
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* footer */}
        <div className="flex gap-2 px-4 py-3 border-t border-zinc-700 shrink-0">
          {readOnly ? (
            <button
              onClick={onClose}
              className="flex-1 py-1.5 rounded-md text-xs font-semibold bg-amber-500 text-zinc-900 hover:bg-amber-400 transition-colors"
            >
              Close
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                className="flex-1 py-1.5 rounded-md text-xs text-zinc-300 border border-zinc-600 hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onSave(level, qty, clDraft);
                  onClose();
                }}
                className="flex-1 py-1.5 rounded-md text-xs font-semibold bg-amber-500 text-zinc-900 hover:bg-amber-400 transition-colors"
              >
                Save
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
