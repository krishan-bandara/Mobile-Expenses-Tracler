"use client";

/**
 * A gap-segmented donut chart, computed from actual values rather than
 * hand-typed dasharray numbers — the earlier hand-built version in the
 * design canvas had overlapping round caps because that math was done
 * by hand. This derives every angle from `segments` so it's always
 * correct regardless of how many categories or what their shares are.
 */
export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({
  segments,
  size = 176,
  strokeWidth = 18,
  gapDegrees = 6,
  centerLabel,
  centerValue
}: {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  gapDegrees?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const radius = size / 2 - strokeWidth / 2 - 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;

  const capDegrees = (strokeWidth / (2 * Math.PI * radius)) * 360; // half-cap overshoot in degrees
  const nSegments = segments.filter((s) => s.value > 0).length;
  const totalGapDegrees = gapDegrees * nSegments;
  const availableDegrees = 360 - totalGapDegrees;

  let cursorDegrees = -90; // start at 12 o'clock
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((segment) => {
      const shareDegrees = (segment.value / total) * availableDegrees;
      const visibleDegrees = Math.max(shareDegrees - 2 * capDegrees, 0);
      const visibleLength = (visibleDegrees / 360) * circumference;
      const rotation = cursorDegrees + capDegrees;
      cursorDegrees += shareDegrees + gapDegrees;

      return {
        key: segment.label,
        color: segment.color,
        dasharray: `${visibleLength.toFixed(2)} ${circumference.toFixed(2)}`,
        rotation
      };
    });

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Spending by category">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-track)" strokeWidth={strokeWidth} />
        {arcs.map((arc) => (
          <circle
            key={arc.key}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={arc.dasharray}
            transform={`rotate(${arc.rotation} ${size / 2} ${size / 2})`}
          />
        ))}
      </svg>
      {(centerLabel || centerValue) && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center"
          }}
        >
          {/*
            The clear space inside the ring is a circle, not the full
            size x size box — unconstrained text (especially a long
            total like "Rs 223,224.08") was overflowing past the ring
            and visually crossing the colored arcs. Constrain to a safe
            width for that inner circle, and shrink the value's font as
            it gets longer so it still reads as one clean number rather
            than wrapping awkwardly.
          */}
          <div style={{ width: Math.max((radius - strokeWidth) * 1.7, 70), display: "flex", flexDirection: "column", alignItems: "center" }}>
            {centerLabel && <span className="text-[13px] text-muted">{centerLabel}</span>}
            {centerValue && (
              <span
                className="font-extrabold tracking-tight mt-0.5 leading-tight"
                style={{ fontSize: centerValue.length > 13 ? 14 : centerValue.length > 9 ? 17 : 22 }}
              >
                {centerValue}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
