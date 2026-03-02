'use client';

import { useCallback } from 'react';
import { type EdgeProps, useReactFlow } from '@xyflow/react';

export default function MidpointEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  selected,
}: EdgeProps) {
  const { setEdges, getViewport } = useReactFlow();

  // mx: posición X del segmento vertical (arrastrable horizontalmente)
  const mx = (data?.mx as number) ?? (sourceX + targetX) / 2;
  // Centro visual del handle (mitad vertical entre source y target)
  const handleY = (sourceY + targetY) / 2;

  // Ruta ortogonal: horizontal → vertical → horizontal (ángulos de 90°)
  const pathD = `M ${sourceX},${sourceY} H ${mx} V ${targetY} H ${targetX}`;

  const onMidMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const { zoom } = getViewport();
      const startScreenX = e.clientX;
      const initMx = mx;

      const onMove = (me: MouseEvent) => {
        const dx = (me.clientX - startScreenX) / zoom;
        setEdges(eds =>
          eds.map(ed =>
            ed.id === id ? { ...ed, data: { ...ed.data, mx: initMx + dx } } : ed
          )
        );
      };

      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [id, mx, setEdges, getViewport]
  );

  const strokeColor = selected ? '#fbbf24' : '#f59e0b';

  return (
    <g>
      {/* Área invisible para facilitar selección */}
      <path d={pathD} fill="none" stroke="transparent" strokeWidth={12} />

      {/* Línea principal */}
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth={selected ? 2.5 : 2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Handle arrastrable sobre el segmento vertical */}
      <circle
        cx={mx}
        cy={handleY}
        r={6}
        fill={strokeColor}
        stroke="#1c1917"
        strokeWidth={1.5}
        style={{ cursor: 'ew-resize', pointerEvents: 'all' }}
        className="nopan nodrag"
        onMouseDown={onMidMouseDown}
      />
    </g>
  );
}
