/**
 * Metro-map layout for the Agents Teams tube map — pure geometry, no RN, so
 * it is unit-tested under plain Node.
 *
 * The same picture web draws (`TeamTubeMap`), sized for a phone canvas that
 * pans and zooms: one column per stage, one coloured line per team running
 * left to right, and a stop shared by several teams drawn ONCE, as an
 * interchange the lines bundle through.
 *
 *  - Columns: `TEAM_STAGES`, `COL_W` apart.
 *  - Rows: inside a column, the busiest stations sit at the top (most lines
 *    first, then first appearance), `ROW_H` apart, so the shared trunk of the
 *    map stays straight and the one-team stops hang below it.
 *  - Lines: through their own stops in stage order; between columns a run of
 *    horizontal → 45°-ish diagonal → horizontal, the metro look. Each line is
 *    nudged by a small per-line offset so lines sharing a stretch draw side
 *    by side instead of on top of each other.
 */
import { TEAM_STAGES, type TubeModel, type TubeStation } from './agentTeamsRules';

export const COL_W = 168;
export const ROW_H = 58;
export const PAD_X = 70;
export const PAD_TOP = 64;
export const PAD_BOTTOM = 40;
/** Gap between neighbouring lines in a bundle. */
export const LINE_GAP = 4;

export const LINE_COLOURS = ['#1A3050', '#1E4DA8', '#1F6B4F', '#2E9E5B', '#7A6324', '#C8622A', '#6B2FB3', '#9B2042'];
export const lineColour = (index: number): string => LINE_COLOURS[((index % LINE_COLOURS.length) + LINE_COLOURS.length) % LINE_COLOURS.length]!;

export interface PlacedStation {
  station: TubeStation;
  x: number;
  y: number;
  /** How many lines run through it. */
  count: number;
  /** Vertical extent of the lines through it (their offsets), so a shared
   * stop is drawn as a pill covering the whole bundle and a one-line stop
   * sits exactly on its line. */
  top: number;
  bottom: number;
}

export interface PlacedLine {
  id: string;
  name: string;
  colour: string;
  /** SVG path `d`. */
  d: string;
}

export interface MetroLayout {
  width: number;
  height: number;
  columns: Array<{ key: string; label: string; hint: string; x: number }>;
  stations: PlacedStation[];
  lines: PlacedLine[];
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export const layoutMetro = (model: TubeModel): MetroLayout => {
  const stageIndex = new Map<string, number>(TEAM_STAGES.map((s, i) => [s.key, i]));
  const colX = (i: number) => PAD_X + i * COL_W;

  /* First-appearance order, so ties keep the data's own order. */
  const firstSeen = new Map<string, number>();
  let seq = 0;
  for (const line of model.lines) for (const s of line.stops) if (!firstSeen.has(s.id)) firstSeen.set(s.id, seq++);

  const byStage = new Map<string, TubeStation[]>();
  for (const st of model.stations.values()) {
    const list = byStage.get(st.stage) ?? [];
    list.push(st);
    byStage.set(st.stage, list);
  }

  const n = model.lines.length;
  const offsetOf = new Map(model.lines.map((l, li) => [l.id, (li - (n - 1) / 2) * LINE_GAP]));

  const pos = new Map<string, { x: number; y: number }>();
  let maxRows = 1;
  const stations: PlacedStation[] = [];
  for (const [stage, list] of byStage) {
    const ci = stageIndex.get(stage) ?? 0;
    list.sort((a, b) => b.lineIds.length - a.lineIds.length || (firstSeen.get(a.id) ?? 0) - (firstSeen.get(b.id) ?? 0));
    maxRows = Math.max(maxRows, list.length);
    list.forEach((st, row) => {
      const p = { x: colX(ci), y: PAD_TOP + row * ROW_H };
      pos.set(st.id, p);
      const offs = st.lineIds.map((id) => offsetOf.get(id) ?? 0);
      stations.push({ station: st, x: p.x, y: p.y, count: st.lineIds.length, top: p.y + Math.min(...offs), bottom: p.y + Math.max(...offs) });
    });
  }

  const lines: PlacedLine[] = model.lines.map((line, li) => {
    const off = offsetOf.get(line.id) ?? 0;
    const pts = line.stops.map((s) => pos.get(s.id)).filter((p): p is { x: number; y: number } => Boolean(p));
    let d = '';
    pts.forEach((p, i) => {
      const y = p.y + off;
      if (i === 0) {
        d = `M${r1(p.x)} ${r1(y)}`;
        return;
      }
      const prev = pts[i - 1]!;
      const py = prev.y + off;
      if (prev.x === p.x) {
        /* Same column: straight down/up through the stacked stops. */
        d += ` L${r1(p.x)} ${r1(y)}`;
      } else {
        /* Between columns: out horizontally, angle across, in horizontally. */
        const run = Math.min(COL_W * 0.28, Math.abs(p.x - prev.x) / 3);
        d += ` L${r1(prev.x + run)} ${r1(py)} L${r1(p.x - run)} ${r1(y)} L${r1(p.x)} ${r1(y)}`;
      }
    });
    return { id: line.id, name: line.name, colour: lineColour(li), d };
  });

  return {
    width: PAD_X * 2 + (TEAM_STAGES.length - 1) * COL_W,
    height: PAD_TOP + (maxRows - 1) * ROW_H + PAD_BOTTOM,
    columns: TEAM_STAGES.map((s, i) => ({ key: s.key, label: s.label, hint: s.hint, x: colX(i) })),
    stations,
    lines,
  };
};

/** Station label for a tiny canvas — a whole word cut, never mid-letter. */
export const shortLabel = (text: string, max = 20): string => {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > 8 ? cut.slice(0, space) : cut).trimEnd()}…`;
};
