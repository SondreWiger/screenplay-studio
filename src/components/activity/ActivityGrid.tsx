'use client';

/**
 * ActivityGrid — GitHub-style yearly activity heatmap.
 *
 * 52 columns (weeks) × 7 rows (days). Each cell is colored by the user's
 * `activity_color` at an opacity proportional to pages written vs daily goal.
 *
 * Usage:
 *   <ActivityGrid
 *     logs={[{ log_date: '2025-01-15', pages_written: 2, session_minutes: 45 }]}
 *     activityColor="#22c55e"
 *     dailyGoal={1}
 *   />
 */

import React, { useMemo, useState } from 'react';

interface DayData {
  pages: number;
  minutes: number;
}

interface ActivityGridProps {
  /** Aggregated daily work data */
  logs: Array<{ log_date: string; pages_written: number; session_minutes: number }>;
  /** Hex color for filled cells (default green) */
  activityColor?: string;
  /** Daily goal in pages (used to calculate intensity) */
  dailyGoal?: number;
  /** Cell size in px (default 11) */
  cellSize?: number;
  /** Cell gap in px (default 2) */
  cellGap?: number;
  /** Show month labels above the grid */
  showMonthLabels?: boolean;
  /** Show day-of-week labels on the left */
  showDayLabels?: boolean;
  /** Show the legend at the bottom */
  showLegend?: boolean;
  /** Extra class names for the wrapper */
  className?: string;
  /** Year to display (default current year) */
  year?: number;
}

const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Return the Monday-aligned start of the ISO week containing `date`.
 * The grid always starts on a Monday so columns are uniform.
 */
function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sun
  const diff = (day === 0 ? -6 : 1 - day); // shift to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Compute intensity 0-4 from pages vs goal */
function getIntensity(pages: number, goal: number): 0 | 1 | 2 | 3 | 4 {
  if (pages <= 0) return 0;
  const ratio = pages / Math.max(goal, 0.1);
  if (ratio >= 1.5) return 4;
  if (ratio >= 1.0) return 3;
  if (ratio >= 0.5) return 2;
  return 1;
}

/** Convert hex color + opacity to rgba */
function hexToRgba(hex: string, opacity: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

const INTENSITY_OPACITY: Record<0 | 1 | 2 | 3 | 4, number> = {
  0: 0.07,
  1: 0.28,
  2: 0.52,
  3: 0.76,
  4: 1.0,
};

export default function ActivityGrid({
  logs,
  activityColor = '#22c55e',
  dailyGoal = 1,
  cellSize = 11,
  cellGap = 2,
  showMonthLabels = true,
  showDayLabels = true,
  showLegend = true,
  className = '',
  year,
}: ActivityGridProps) {
  const [tooltip, setTooltip] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

  // Build lookup map from raw logs
  const dayMap = useMemo(() => {
    const map = new Map<string, DayData>();
    for (const log of logs) {
      const existing = map.get(log.log_date);
      if (existing) {
        existing.pages += log.pages_written;
        existing.minutes += log.session_minutes;
      } else {
        map.set(log.log_date, { pages: log.pages_written, minutes: log.session_minutes });
      }
    }
    return map;
  }, [logs]);

  // Build the 52×7 grid as an array of week-columns
  const { weeks, monthCols } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Start: Monday of (today - 364 days)
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 363);
    const gridStart = getMondayOfWeek(startDate);

    const weeksArr: Array<Array<{ date: string; iso: string; intensity: 0 | 1 | 2 | 3 | 4; pages: number; minutes: number; inFuture: boolean }>> = [];
    const monthColsArr: Array<{ month: string; col: number }> = [];

    let cursor = new Date(gridStart);
    let lastMonth = -1;

    for (let week = 0; week < 53; week++) {
      const weekCol: typeof weeksArr[0] = [];
      for (let dow = 0; dow < 7; dow++) {
        const isoDate = cursor.toISOString().slice(0, 10);
        const data = dayMap.get(isoDate);
        const inFuture = cursor > today;
        const intensity = inFuture ? 0 : getIntensity(data?.pages ?? 0, dailyGoal);

        // Track month headers
        if (dow === 0 && cursor.getMonth() !== lastMonth) {
          lastMonth = cursor.getMonth();
          monthColsArr.push({ month: MONTH_NAMES[cursor.getMonth()], col: week });
        }

        weekCol.push({
          date: cursor.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          iso: isoDate,
          intensity,
          pages: data?.pages ?? 0,
          minutes: data?.minutes ?? 0,
          inFuture,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      weeksArr.push(weekCol);
      if (cursor > new Date(today.getTime() + 7 * 86400000)) break; // don't exceed today+1week
    }

    return { weeks: weeksArr, monthCols: monthColsArr };
  }, [dayMap, dailyGoal]);

  const step = cellSize + cellGap;
  const gridWidth  = weeks.length * step;
  const gridHeight = 7 * step;

  const dayLabelWidth = showDayLabels ? 28 : 0;
  const monthLabelHeight = showMonthLabels ? 18 : 0;

  return (
    <div className={`select-none ${className}`}>
      <div
        style={{
          position: 'relative',
          width: dayLabelWidth + gridWidth + 'px',
          paddingTop: monthLabelHeight + 'px',
        }}
        data-activity-grid="true"
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Month labels */}
        {showMonthLabels && monthCols.map(({ month, col }) => (
          <span
            key={`${month}-${col}`}
            style={{
              position: 'absolute',
              top: 0,
              left: dayLabelWidth + col * step,
              fontSize: '9px',
              color: 'rgba(255,255,255,0.3)',
              letterSpacing: '0.05em',
              lineHeight: '14px',
              pointerEvents: 'none',
            }}
          >
            {month}
          </span>
        ))}

        {/* Day-of-week labels */}
        {showDayLabels && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: monthLabelHeight,
              display: 'flex',
              flexDirection: 'column',
              gap: cellGap,
            }}
          >
            {DAY_LABELS.map((label, i) => (
              <div
                key={i}
                style={{
                  height: cellSize,
                  fontSize: '9px',
                  color: 'rgba(255,255,255,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingRight: 4,
                  width: dayLabelWidth - 4,
                  lineHeight: 1,
                }}
              >
                {label}
              </div>
            ))}
          </div>
        )}

        {/* Grid */}
        <div
          style={{
            marginLeft: dayLabelWidth,
            display: 'flex',
            gap: cellGap,
          }}
        >
          {weeks.map((weekCols, wi) => (
            <div
              key={wi}
              style={{ display: 'flex', flexDirection: 'column', gap: cellGap }}
            >
              {weekCols.map((cell) => (
                <div
                  key={cell.iso}
                  style={{
                    width: cellSize,
                    height: cellSize,
                    borderRadius: 2,
                    backgroundColor: hexToRgba(activityColor, INTENSITY_OPACITY[cell.intensity]),
                    cursor: cell.inFuture ? 'default' : 'pointer',
                    transition: 'transform 0.1s, filter 0.1s',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    if (cell.inFuture) return;
                    const rect = (e.target as HTMLElement).getBoundingClientRect();
                    const containerRect = (e.currentTarget.closest('[data-activity-grid]') as HTMLElement)?.getBoundingClientRect?.() ?? rect;
                    setTooltip({
                      text: cell.pages > 0
                        ? `${cell.date} — ${cell.pages.toFixed(1)} pg${cell.minutes > 0 ? ` · ${cell.minutes}min` : ''}`
                        : `${cell.date} — no activity`,
                      x: rect.left - (containerRect?.left ?? 0) + cellSize / 2,
                      y: rect.top - (containerRect?.top ?? 0) - 6,
                    });
                  }}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div
            style={{
              position: 'absolute',
              top: monthLabelHeight + tooltip.y - 28,
              left: tooltip.x,
              transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.85)',
              color: 'rgba(255,255,255,0.9)',
              fontSize: '10px',
              padding: '4px 8px',
              borderRadius: 5,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              zIndex: 10,
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            {tooltip.text}
          </div>
        )}
      </div>

      {/* Legend */}
      {showLegend && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          marginTop: 8,
          marginLeft: dayLabelWidth,
        }}>
          <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)', marginRight: 2 }}>Less</span>
          {([0, 1, 2, 3, 4] as const).map((lvl) => (
            <div
              key={lvl}
              style={{
                width: cellSize,
                height: cellSize,
                borderRadius: 2,
                backgroundColor: hexToRgba(activityColor, INTENSITY_OPACITY[lvl]),
              }}
            />
          ))}
          <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)', marginLeft: 2 }}>More</span>
        </div>
      )}
    </div>
  );
}
