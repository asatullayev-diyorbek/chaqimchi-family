import React from 'react';
import { MiniWeek, WeekBars, CategoryDonut } from '@/components/Charts';
import AppChip from '@/components/AppChip';
import { DEMO_APPS, fmt } from '@/lib/site';

// A lightweight mock of the real Parent Web dashboard used in the hero section.
// It assembles existing chart components to give a realistic preview without
// loading heavy assets. The design follows the existing glass‑panel style.
function ParentWebMock() {
  return (
    <div className="glass panel hero-mock" style={{ '--d': '150ms' } as React.CSSProperties}>
      {/* Chart preview (MiniWeek) */}
      <div className="tile hp panel-chart" style={{ '--d': '140ms' } as React.CSSProperties}>
        <div className="k">Oxirgi 7 kun · o'rta 3s 24d</div>
        <MiniWeek />
      </div>
      {/* Category donut */}
      <div className="tile hp panel-cats" style={{ '--d': '380ms' } as React.CSSProperties}>
        <div className="k">Kategoriyalar</div>
        <CategoryDonut />
      </div>
      {/* Top apps list (first three) */}
      <div className="rows">
        {DEMO_APPS.slice(0, 3).map((a, i) => (
          <div className="row hp" key={a.name} style={{ '--d': `${420 + i * 90}ms` } as React.CSSProperties}>
            <span className="app">
              <AppChip icon={a.icon} color={a.color} />{a.name}
            </span>
            <b>{fmt(a.minutes)}</b>
          </div>
        ))}
      </div>
      {/* Rest time strip */}
      <div className="strip hp" style={{ '--d': '720ms' } as React.CSSProperties}>
        <i className="iconify" data-icon="solar:check-circle-bold" aria-hidden />
        Dam olish vaqti 22:00–07:00 — faol
      </div>
    </div>
  );
}

export default ParentWebMock;
