import { tokenize, cosine } from "./text";

export type NotePoint = {
  noteId: string;
  title: string;
  ts: number;       // updatedAt
  text: string;     // latest snapshot
};

type V = number[];

function buildVocab(points: NotePoint[], maxTerms = 800) {
  const df = new Map<string, number>();
  const docsTokens: string[][] = [];

  for (const p of points) {
    const toks = Array.from(new Set(tokenize(p.text)));
    docsTokens.push(toks);
    for (const t of toks) df.set(t, (df.get(t) ?? 0) + 1);
  }

  // pick top terms by document frequency (not perfect, but MVP)
  const terms = [...df.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxTerms)
    .map(([t]) => t);

  const idx = new Map<string, number>();
  terms.forEach((t, i) => idx.set(t, i));

  const N = points.length;
  const idf: number[] = terms.map(t => {
    const dfi = df.get(t) ?? 1;
    return Math.log((N + 1) / (dfi + 1)) + 1;
  });

  return { terms, idx, idf };
}

function vectorize(text: string, idx: Map<string, number>, idf: number[]): V {
  const v = new Array(idf.length).fill(0);
  const toks = tokenize(text);
  for (const t of toks) {
    const i = idx.get(t);
    if (i != null) v[i] += 1;
  }
  // tf-idf
  for (let i = 0; i < v.length; i++) v[i] = v[i] * idf[i];
  return v;
}

function add(a: V, b: V) {
  for (let i = 0; i < a.length; i++) a[i] += b[i];
}
function scale(a: V, s: number) {
  for (let i = 0; i < a.length; i++) a[i] *= s;
}

export type Lane = {
  centroid: V;
  count: number;
  noteIds: string[];
};

export function computeLanes(points: NotePoint[], laneSimThreshold = 0.28): {
  vectors: Map<string, V>;
  lanes: Lane[];
} {
  const { idx, idf } = buildVocab(points);
  const vectors = new Map<string, V>();

  const lanes: Lane[] = [];

  for (const p of points) {
    const v = vectorize(p.text, idx, idf);
    vectors.set(p.noteId, v);

    // find best lane by cosine to centroid
    let bestLane = -1;
    let bestSim = -1;

    for (let li = 0; li < lanes.length; li++) {
      const sim = cosine(v, lanes[li].centroid);
      if (sim > bestSim) {
        bestSim = sim;
        bestLane = li;
      }
    }

    if (bestLane >= 0 && bestSim >= laneSimThreshold) {
      // update centroid incrementally
      const lane = lanes[bestLane];
      // centroid = (centroid*count + v) / (count+1)
      scale(lane.centroid, lane.count);
      add(lane.centroid, v);
      lane.count += 1;
      scale(lane.centroid, 1 / lane.count);
      lane.noteIds.push(p.noteId);
    } else {
      lanes.push({ centroid: v.slice(), count: 1, noteIds: [p.noteId] });
    }
  }

  return { vectors, lanes };
}

export function nearestNeighbors(points: NotePoint[], vectors: Map<string, V>, k = 2) {
  const byId = new Map(points.map(p => [p.noteId, p]));
  const ids = points.map(p => p.noteId);

  const edges: Array<{ a: string; b: string; w: number }> = [];

  for (const a of ids) {
    const va = vectors.get(a)!;
    const sims: Array<{ b: string; w: number }> = [];
    for (const b of ids) {
      if (a === b) continue;
      const vb = vectors.get(b)!;
      const w = cosine(va, vb);
      sims.push({ b, w });
    }
    sims.sort((x, y) => y.w - x.w);
    for (const nn of sims.slice(0, k)) {
      if (nn.w <= 0) continue;
      // store canonical edge
      const keyA = a < nn.b ? a : nn.b;
      const keyB = a < nn.b ? nn.b : a;
      edges.push({ a: keyA, b: keyB, w: nn.w });
    }
  }

  // dedupe
  const seen = new Set<string>();
  const out: typeof edges = [];
  for (const e of edges) {
    const key = `${e.a}__${e.b}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}
