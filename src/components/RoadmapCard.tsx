'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Roadmap } from '@/lib/roadmaps';
import { deleteRoadmap } from '@/lib/roadmaps';

interface Props {
  roadmap: Roadmap;
  /** Si es true, muestra botones de editar / eliminar (solo propietario) */
  editable?: boolean;
  onDeleted?: (id: string) => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function RoadmapCard({
  roadmap,
  editable = false,
  onDeleted,
}: Props) {
  const [deleting, setDeleting] = useState(false);
  const nodeCount = Array.isArray(roadmap.nodes) ? roadmap.nodes.length : 0;
  const edgeCount = Array.isArray(roadmap.edges) ? roadmap.edges.length : 0;

  // Contar por tipo de nodo
  const typeCounts = (() => {
    if (!Array.isArray(roadmap.nodes)) return {};
    const counts: Record<string, number> = {};
    for (const n of roadmap.nodes as { data?: { category?: string } }[]) {
      const cat = n.data?.category ?? 'item';
      counts[cat] = (counts[cat] ?? 0) + 1;
    }
    return counts;
  })();

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!confirm(`Delete "${roadmap.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await deleteRoadmap(roadmap.id);
      onDeleted?.(roadmap.id);
    } catch {
      alert('Could not delete roadmap.');
      setDeleting(false);
    }
  };

  const viewHref = `/roadmap/${roadmap.id}`;
  const editHref = `/roadmap/${roadmap.id}/edit`;

  return (
    <div
      style={{
        background: '#18181b',
        border: '1px solid #3f3f46',
        borderRadius: '0.875rem',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '#f59e0b';
        (e.currentTarget as HTMLDivElement).style.boxShadow =
          '0 0 0 1px #f59e0b40';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '#3f3f46';
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
      }}
    >
      {/* Accent top line */}
      <div
        style={{
          height: '3px',
          background: 'linear-gradient(90deg, #f59e0b, #d97706)',
        }}
      />

      {/* Content */}
      <Link
        href={editable ? editHref : viewHref}
        style={{ textDecoration: 'none', flex: 1 }}
      >
        <div style={{ padding: '1.25rem', cursor: 'pointer' }}>
          {/* Preview area */}
          <div
            style={{
              width: '100%',
              height: '90px',
              background: '#09090b',
              borderRadius: '0.5rem',
              marginBottom: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #27272a',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {roadmap.thumbnail_url ? (
              <img
                src={roadmap.thumbnail_url}
                alt={roadmap.name}
                style={{
                  width: '52px',
                  height: '52px',
                  objectFit: 'contain',
                  imageRendering: 'pixelated',
                }}
              />
            ) : nodeCount > 0 ? (
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: '1.75rem',
                    lineHeight: 1,
                    marginBottom: '4px',
                  }}
                >
                  🗺️
                </div>
                <span style={{ color: '#71717a', fontSize: '0.7rem' }}>
                  {nodeCount} step{nodeCount !== 1 ? 's' : ''}
                </span>
              </div>
            ) : (
              <span style={{ color: '#52525b', fontSize: '0.75rem' }}>
                Empty roadmap
              </span>
            )}
          </div>

          {/* Name */}
          <h3
            style={{
              color: '#f4f4f5',
              fontWeight: 600,
              fontSize: '0.9rem',
              margin: '0 0 0.375rem 0',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {roadmap.name}
          </h3>

          {/* Stats */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {nodeCount > 0 && (
              <span style={{ color: '#a1a1aa', fontSize: '0.7rem' }}>
                {nodeCount} step{nodeCount !== 1 ? 's' : ''}
              </span>
            )}
            {edgeCount > 0 && (
              <span style={{ color: '#a1a1aa', fontSize: '0.7rem' }}>
                {edgeCount} connection{edgeCount !== 1 ? 's' : ''}
              </span>
            )}
            {typeCounts.skill > 0 && (
              <span style={{ color: '#60a5fa', fontSize: '0.7rem' }}>
                ⚔️ {typeCounts.skill} skill{typeCounts.skill !== 1 ? 's' : ''}
              </span>
            )}
            {typeCounts.quest > 0 && (
              <span style={{ color: '#a78bfa', fontSize: '0.7rem' }}>
                📜 {typeCounts.quest} quest{typeCounts.quest !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Date */}
          <p
            style={{
              color: '#52525b',
              fontSize: '0.65rem',
              marginTop: '0.625rem',
            }}
          >
            {editable ? 'Updated' : 'Created'}{' '}
            {formatDate(editable ? roadmap.updated_at : roadmap.created_at)}
          </p>
        </div>
      </Link>

      {/* Actions (solo editable) */}
      {editable && (
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            padding: '0 1rem 1rem',
          }}
        >
          <Link href={viewHref} style={{ flex: 1 }}>
            <button
              style={{
                width: '100%',
                padding: '0.4rem 0',
                background: 'transparent',
                border: '1px solid #3f3f46',
                borderRadius: '0.5rem',
                color: '#a1a1aa',
                fontSize: '0.75rem',
                cursor: 'pointer',
                transition: 'border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  '#71717a';
                (e.currentTarget as HTMLButtonElement).style.color = '#e4e4e7';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  '#3f3f46';
                (e.currentTarget as HTMLButtonElement).style.color = '#a1a1aa';
              }}
            >
              View
            </button>
          </Link>
          <Link href={editHref} style={{ flex: 1 }}>
            <button
              style={{
                width: '100%',
                padding: '0.4rem 0',
                background: '#f59e0b',
                border: 'none',
                borderRadius: '0.5rem',
                color: '#1c1917',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e =>
                ((e.currentTarget as HTMLButtonElement).style.background =
                  '#fbbf24')
              }
              onMouseLeave={e =>
                ((e.currentTarget as HTMLButtonElement).style.background =
                  '#f59e0b')
              }
            >
              Edit
            </button>
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{
              padding: '0.4rem 0.625rem',
              background: 'transparent',
              border: '1px solid #3f3f46',
              borderRadius: '0.5rem',
              color: '#ef4444',
              fontSize: '0.75rem',
              cursor: deleting ? 'not-allowed' : 'pointer',
              opacity: deleting ? 0.5 : 1,
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e =>
              ((e.currentTarget as HTMLButtonElement).style.borderColor =
                '#ef4444')
            }
            onMouseLeave={e =>
              ((e.currentTarget as HTMLButtonElement).style.borderColor =
                '#3f3f46')
            }
            title="Delete roadmap"
          >
            {deleting ? '…' : '🗑'}
          </button>
        </div>
      )}
    </div>
  );
}
