'use client';

import { useStore } from '@xyflow/react';

export interface Guide {
  type: 'h' | 'v';
  pos: number; // coordenada en espacio de flujo
}

export default function AlignmentGuides({ guides }: { guides: Guide[] }) {
  const [vpX, vpY, zoom] = useStore(s => s.transform);

  if (!guides.length) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ width: '100%', height: '100%', zIndex: 10 }}
    >
      {guides.map((g, i) =>
        g.type === 'h' ? (
          <line
            key={`h-${i}`}
            x1={-99999}
            y1={g.pos * zoom + vpY}
            x2={99999}
            y2={g.pos * zoom + vpY}
            stroke="#38bdf8"
            strokeWidth={1}
            strokeDasharray="6 3"
            opacity={0.85}
          />
        ) : (
          <line
            key={`v-${i}`}
            x1={g.pos * zoom + vpX}
            y1={-99999}
            x2={g.pos * zoom + vpX}
            y2={99999}
            stroke="#38bdf8"
            strokeWidth={1}
            strokeDasharray="6 3"
            opacity={0.85}
          />
        )
      )}
    </svg>
  );
}
