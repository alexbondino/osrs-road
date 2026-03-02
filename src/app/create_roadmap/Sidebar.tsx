'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';

export interface SidebarItem {
  id: number;
  name: string;
  icon_url: string | null;
  category: 'Skill' | 'Item' | 'Quest' | 'Diary';
  max_level?: number;
}

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

function ItemIcon({ url, name }: { url: string | null; name: string }) {
  const [error, setError] = useState(false);
  if (!url || error) {
    return (
      <div className="w-8 h-8 rounded bg-zinc-600 flex items-center justify-center text-xs text-zinc-400 shrink-0">
        ?
      </div>
    );
  }
  return (
    <Image
      src={url}
      alt={name}
      width={32}
      height={32}
      className="w-8 h-8 object-contain shrink-0"
      onError={() => setError(true)}
      unoptimized
    />
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${Math.floor(n / 1_000_000)}M+`;
  if (n >= 1_000) return `${Math.floor(n / 1_000)}K+`;
  return String(n);
}

function DraggableItem({ item }: { item: SidebarItem }) {
  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/reactflow', JSON.stringify(item));
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-zinc-700 hover:bg-zinc-600 cursor-grab active:cursor-grabbing border border-zinc-600 hover:border-amber-500 transition-colors select-none min-w-0"
    >
      {item.category !== 'Quest' && item.category !== 'Diary' && (
        <ItemIcon url={item.icon_url} name={item.name} />
      )}
      <span className="text-white text-xs font-medium truncate min-w-0">
        {item.name}
      </span>
    </div>
  );
}

export default function Sidebar({
  skills,
  quests,
  diaries,
  itemsCount,
}: {
  skills: Skill[];
  quests: Quest[];
  diaries: Diary[];
  itemsCount: number;
}) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<SidebarItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'skills' | 'quests' | 'diaries' | 'items'>(
    'skills'
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (tab !== 'items') return;
    if (query.length < 2) {
      setItems([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase
        .from('items')
        .select('id, name, icon_url')
        .ilike('name', `%${query}%`)
        .limit(40);
      setItems(
        (data ?? []).map(r => ({
          id: r.id,
          name: r.name,
          icon_url: r.icon_url,
          category: 'Item' as const,
        }))
      );
      setLoading(false);
    }, 350);
  }, [query, tab]);

  const skillItems: SidebarItem[] = skills.map(s => ({
    id: s.id,
    name: s.name,
    icon_url: s.icon_url,
    category: 'Skill',
    max_level: s.max_level,
  }));

  const questItems: SidebarItem[] = quests.map(q => ({
    id: q.id,
    name: q.name,
    icon_url: q.icon_url,
    category: 'Quest',
  }));

  const diaryItems: SidebarItem[] = diaries.map(d => ({
    id: d.id,
    name: d.name,
    icon_url: d.icon_url,
    category: 'Diary',
  }));

  const TABS = [
    { key: 'skills' as const, label: `Skills (${formatCount(skills.length)})` },
    { key: 'quests' as const, label: `Quests (${formatCount(quests.length)})` },
    {
      key: 'diaries' as const,
      label: `Diaries (${formatCount(diaries.length)})`,
    },
    { key: 'items' as const, label: `Items (${formatCount(itemsCount)})` },
  ];

  return (
    <aside
      style={{ width: '16rem', minWidth: '16rem', maxWidth: '16rem' }}
      className="flex-none bg-zinc-900 border-r border-zinc-700 flex flex-col overflow-hidden"
    >
      <div className="flex border-b border-zinc-700 shrink-0">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              setQuery('');
              setItems([]);
            }}
            className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
              tab === t.key
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'items' && (
        <div className="px-3 py-2 border-b border-zinc-700 shrink-0">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search item..."
            className="w-full bg-zinc-800 text-white text-xs px-3 py-2 rounded-md border border-zinc-600 focus:outline-none focus:border-amber-500 placeholder:text-zinc-500"
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-2 px-2 flex flex-col gap-1 min-w-0 w-full">
        {tab === 'skills' &&
          skillItems.map(item => <DraggableItem key={item.id} item={item} />)}
        {tab === 'quests' &&
          questItems.map(item => <DraggableItem key={item.id} item={item} />)}
        {tab === 'diaries' &&
          diaryItems.map(item => <DraggableItem key={item.id} item={item} />)}
        {tab === 'items' && query.length < 2 && (
          <p className="text-zinc-500 text-xs text-center mt-6 px-4">
            Type at least 2 characters to search items
          </p>
        )}
        {tab === 'items' && loading && (
          <p className="text-zinc-400 text-xs text-center mt-6">Searching...</p>
        )}
        {tab === 'items' &&
          !loading &&
          query.length >= 2 &&
          items.length === 0 && (
            <p className="text-zinc-500 text-xs text-center mt-6">No results</p>
          )}
        {tab === 'items' &&
          !loading &&
          items.map(item => <DraggableItem key={item.id} item={item} />)}
      </div>
    </aside>
  );
}
