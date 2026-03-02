'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';

interface IconItem {
  name: string;
  icon_url: string;
}

interface Props {
  onSelect: (url: string) => void;
  onClose: () => void;
  skills: { name: string; icon_url: string | null }[];
  quests: { name: string; icon_url: string | null }[];
  diaries: { name: string; icon_url: string | null }[];
}

type Tab = 'items' | 'skills' | 'quests' | 'diaries';

export default function ThumbnailPicker({
  onSelect,
  onClose,
  skills,
  quests,
  diaries,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>('items');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<IconItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Focus search on open
  useEffect(() => {
    if (mounted) setTimeout(() => searchRef.current?.focus(), 50);
  }, [mounted, tab]);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Search items in Supabase
  useEffect(() => {
    if (tab !== 'items') return;
    const query = search.trim();
    setLoadingItems(true);
    const timeout = setTimeout(
      async () => {
        const req = supabase
          .from('items')
          .select('name, icon_url')
          .not('icon_url', 'is', null)
          .order('name');
        if (query) {
          req.ilike('name', `%${query}%`);
        }
        const { data } = await req.limit(60);
        setItems((data ?? []).filter((d): d is IconItem => !!d.icon_url));
        setLoadingItems(false);
      },
      query ? 300 : 0
    );
    return () => clearTimeout(timeout);
  }, [tab, search]);

  // Filter static lists
  const filterList = (
    list: { name: string; icon_url: string | null }[]
  ): IconItem[] => {
    const q = search.trim().toLowerCase();
    return list
      .filter(i => i.icon_url && (!q || i.name.toLowerCase().includes(q)))
      .map(i => ({ name: i.name, icon_url: i.icon_url! }));
  };

  const staticItems: IconItem[] =
    tab === 'skills'
      ? filterList(skills)
      : tab === 'quests'
        ? filterList(quests)
        : tab === 'diaries'
          ? filterList(diaries)
          : [];

  const displayItems = tab === 'items' ? items : staticItems;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'items', label: 'Items' },
    { key: 'skills', label: 'Skills', count: skills.length },
    { key: 'quests', label: 'Quests', count: quests.length },
    { key: 'diaries', label: 'Diaries', count: diaries.length },
  ];

  if (!mounted) return null;

  return createPortal(
    <div
      ref={backdropRef}
      onClick={e => {
        if (e.target === backdropRef.current) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: '#18181b',
          border: '1px solid #3f3f46',
          borderRadius: '1rem',
          boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.25rem 0.75rem',
            borderBottom: '1px solid #27272a',
          }}
        >
          <div>
            <h2
              style={{
                color: '#f4f4f5',
                fontWeight: 700,
                fontSize: '0.95rem',
                margin: 0,
              }}
            >
              Choose a thumbnail
            </h2>
            <p
              style={{
                color: '#71717a',
                fontSize: '0.7rem',
                margin: '2px 0 0',
              }}
            >
              Pick any OSRS icon as the cover image for your roadmap
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#71717a',
              fontSize: '1.25rem',
              cursor: 'pointer',
              lineHeight: 1,
              padding: '2px 6px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #27272a',
            padding: '0 1.25rem',
          }}
        >
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                setSearch('');
              }}
              style={{
                background: 'none',
                border: 'none',
                borderBottom:
                  tab === t.key ? '2px solid #f59e0b' : '2px solid transparent',
                color: tab === t.key ? '#f59e0b' : '#71717a',
                fontSize: '0.78rem',
                fontWeight: tab === t.key ? 600 : 400,
                padding: '0.6rem 0.75rem',
                cursor: 'pointer',
                transition: 'color 0.15s',
                marginBottom: '-1px',
              }}
            >
              {t.label}
              {t.count !== undefined && (
                <span
                  style={{
                    marginLeft: '4px',
                    fontSize: '0.65rem',
                    color: '#52525b',
                  }}
                >
                  ({t.count})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ padding: '0.75rem 1.25rem 0.5rem' }}>
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${tab}…`}
            style={{
              width: '100%',
              background: '#09090b',
              border: '1px solid #3f3f46',
              borderRadius: '0.5rem',
              color: '#f4f4f5',
              fontSize: '0.8rem',
              padding: '0.5rem 0.75rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            onFocus={e => (e.target.style.borderColor = '#f59e0b')}
            onBlur={e => (e.target.style.borderColor = '#3f3f46')}
          />
        </div>

        {/* Grid */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0.5rem 1.25rem 1rem',
          }}
        >
          {loadingItems && tab === 'items' ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '120px',
              }}
            >
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  border: '2px solid #3f3f46',
                  borderTopColor: '#f59e0b',
                  animation: 'spin 0.7s linear infinite',
                }}
              />
            </div>
          ) : displayItems.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                color: '#52525b',
                fontSize: '0.8rem',
                padding: '2rem 0',
              }}
            >
              {search ? 'No results found.' : 'Nothing to show.'}
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))',
                gap: '0.5rem',
              }}
            >
              {displayItems.map(item => (
                <button
                  key={`${item.icon_url}-${item.name}`}
                  onClick={() => {
                    onSelect(item.icon_url);
                    onClose();
                  }}
                  title={item.name}
                  style={{
                    background: '#09090b',
                    border: '1px solid #27272a',
                    borderRadius: '0.5rem',
                    padding: '0.5rem',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'border-color 0.12s, background 0.12s',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.borderColor = '#f59e0b';
                    el.style.background = '#1c1917';
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.borderColor = '#27272a';
                    el.style.background = '#09090b';
                  }}
                >
                  <img
                    src={item.icon_url}
                    alt={item.name}
                    style={{
                      width: '32px',
                      height: '32px',
                      objectFit: 'contain',
                      imageRendering: 'pixelated',
                    }}
                    onError={e => {
                      (e.currentTarget as HTMLImageElement).style.display =
                        'none';
                    }}
                  />
                  <span
                    style={{
                      color: '#a1a1aa',
                      fontSize: '0.55rem',
                      textAlign: 'center',
                      lineHeight: 1.2,
                      maxWidth: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
