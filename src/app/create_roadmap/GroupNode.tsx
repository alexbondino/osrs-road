'use client';

import { useState, useEffect, useRef } from 'react';
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
  checklist?: CheckItem[];
  completed?: boolean;
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

const CELL_W = 62;
const CELL_H = 57;
const H_PAD = 16;
const V_PAD = 16;

function resolveIcon(item: GItem): string | null {
  if (item.category === 'Quest') return QUEST_ICON;
  if (item.category === 'Diary') return DIARY_ICON;
  return item.icon_url;
}

function ItemCell({ item }: { item: GItem }) {
  const [error, setError] = useState(false);
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
    >
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
  readOnly,
  onChange,
  onDelete,
  isOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  item: GItem;
  readOnly?: boolean;
  onChange: (updated: GItem) => void;
  onDelete: () => void;
  isOver?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}) {
  const [imgError, setImgError] = useState(false);
  const url = resolveIcon(item);

  return (
    <div
      className="flex items-center gap-3 py-2 border-b border-zinc-700 last:border-0"
      draggable={!readOnly}
      onDragStart={onDragStart}
      onDragOver={e => {
        e.preventDefault();
        onDragOver?.(e);
      }}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      style={isOver ? { borderTop: '2px solid #f59e0b' } : undefined}
    >
      {!readOnly && (
        <div
          className="cursor-grab text-zinc-600 hover:text-zinc-400 shrink-0 select-none"
          title="Drag to reorder"
        >
          ⠿
        </div>
      )}
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
          {readOnly ? (
            <span className="text-white text-xs font-semibold w-10 text-center">
              {item.level || '—'}
            </span>
          ) : (
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
          )}
        </div>
      )}
      {item.category === 'Item' && (
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-zinc-400 text-xs">Qty</span>
          {readOnly ? (
            <span className="text-white text-xs font-semibold w-14 text-center">
              {item.qty || '—'}
            </span>
          ) : (
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
          )}
        </div>
      )}

      {/* delete */}
      {!readOnly && (
        <button
          onClick={onDelete}
          className="shrink-0 w-6 h-6 rounded flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-zinc-700 transition-colors"
          title="Remove"
        >
          ✕
        </button>
      )}
    </div>
  );
}

function EditModal({
  items,
  checklist,
  readOnly,
  onSave,
  onClose,
  onChecklistChange,
}: {
  items: GItem[];
  checklist: CheckItem[];
  readOnly?: boolean;
  onSave: (items: GItem[], checklist: CheckItem[]) => void;
  onClose: () => void;
  onChecklistChange?: (checklist: CheckItem[]) => void;
}) {
  const [draft, setDraft] = useState<GItem[]>(items);
  const [clDraft, setClDraft] = useState<CheckItem[]>(checklist);
  const [newTask, setNewTask] = useState('');
  const [mounted, setMounted] = useState(false);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const update = (i: number, updated: GItem) =>
    setDraft(d => d.map((it, idx) => (idx === i ? updated : it)));
  const remove = (i: number) => setDraft(d => d.filter((_, idx) => idx !== i));

  const handleDrop = (i: number) => {
    const from = dragIndexRef.current;
    dragIndexRef.current = null;
    setOverIndex(null);
    if (from === null || from === i) return;
    setDraft(d => {
      const next = [...d];
      const [moved] = next.splice(from, 1);
      next.splice(i, 0, moved);
      return next;
    });
  };

  const addTask = () => {
    const t = newTask.trim();
    if (!t) return;
    setClDraft(d => [...d, { text: t, done: false }]);
    setNewTask('');
  };

  const mouseDownOnOverlay = useRef(false);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onMouseDown={e => {
        e.stopPropagation();
        mouseDownOnOverlay.current = e.target === e.currentTarget;
      }}
      onMouseUp={e => {
        e.stopPropagation();
        if (mouseDownOnOverlay.current && e.target === e.currentTarget)
          onClose();
        mouseDownOnOverlay.current = false;
      }}
      onClick={e => e.stopPropagation()}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-80 max-h-[75vh] flex flex-col overflow-hidden">
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

        {/* single scrollable body: items + checklist */}
        <div className="flex-1 overflow-y-auto px-4">
          {/* items */}
          {draft.length === 0 ? (
            <p className="text-zinc-500 text-xs text-center py-4">No items</p>
          ) : (
            draft.map((item, i) => (
              <ModalRow
                key={i}
                item={item}
                readOnly={readOnly}
                onChange={updated => update(i, updated)}
                onDelete={() => remove(i)}
                isOver={overIndex === i}
                onDragStart={() => {
                  dragIndexRef.current = i;
                }}
                onDragOver={() => setOverIndex(i)}
                onDrop={() => handleDrop(i)}
                onDragEnd={() => {
                  dragIndexRef.current = null;
                  setOverIndex(null);
                }}
              />
            ))
          )}

          {/* checklist section */}
          <div className="mt-2 mb-2">
            <div className="flex items-center gap-2 py-2 border-t border-zinc-700">
              <span className="text-zinc-400 text-[10px] font-semibold uppercase tracking-wider">
                Checklist
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {clDraft.length === 0 && (
                <p className="text-zinc-600 text-xs py-1">No objectives yet</p>
              )}{' '}
              {clDraft.map((task, i) => (
                <div key={i} className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const updated = clDraft.map((t, idx) =>
                        idx === i ? { ...t, done: !t.done } : t
                      );
                      setClDraft(updated);
                      if (readOnly) onChecklistChange?.(updated);
                    }}
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
                  onSave(draft, clDraft);
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
  const completed = data.completed ?? false;
  const readOnly =
    (data as GroupNodeData & { readOnly?: boolean }).readOnly ?? false;

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
            ? 'border-amber-400 shadow-[0_0_22px_6px_rgba(251,191,36,0.6)]'
            : completed
              ? 'border-amber-500'
              : 'border-zinc-600 shadow-xl'
        }`}
        style={{
          width: nodeW,
          height: nodeH,
          backgroundColor: highlighted
            ? '#3f3f46'
            : completed
              ? '#78350f'
              : 'rgba(39,39,42,0.9)',
        }}
        onDoubleClick={e => {
          e.stopPropagation();
          (data as unknown as { onModalOpen?: () => void }).onModalOpen?.();
          setModalOpen(true);
        }}
        title="Double-click to edit"
      >
        {completed && (
          <div
            className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center"
            style={{
              fontSize: '10px',
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
          checklist={normalizeChecklist(data.checklist as unknown[])}
          readOnly={readOnly}
          onSave={(updatedItems, updatedChecklist) =>
            updateNodeData(id, {
              items: updatedItems,
              checklist: updatedChecklist,
            })
          }
          onChecklistChange={
            readOnly ? cl => updateNodeData(id, { checklist: cl }) : undefined
          }
          onClose={() => {
            (data as unknown as { onModalClose?: () => void }).onModalClose?.();
            setModalOpen(false);
          }}
        />
      )}
    </>
  );
}
