export const IMPORT_OBJECT = { env: { memory: new WebAssembly.Memory({ initial: 256 }) } };
let instance;

export function setInstance(i) {
  instance = i;
}

export function solveNormalTileGap(rdm, rdp, rds, rdz, wc) {
  return instance.exports.solveNormalTileGap(rdm, rdp, rds, rdz, wc);
}

export function solvePairTileGap(rdm, rdp, rds, rdz) {
  return instance.exports.solvePairTileGap(rdm, rdp, rds, rdz);
}

export function solveOrphanTileGap(rdm, rdp, rds, rdz) {
  return instance.exports.solveOrphanTileGap(rdm, rdp, rds, rdz);
}

export const SUIT_COUNT = 4;
export const RANK_COUNT = 9;
export const TILE_KIND_COUNT = 34;
export const FREQUENCY_MAX = 4;

export function getTileKind(s, r) {
  return RANK_COUNT * s + r;
}

export function getTileKindSuit(k) {
  return Math.floor(k / RANK_COUNT);
}

export function getTileKindRank(k) {
  return k % RANK_COUNT;
}

export function getTileFrequencies(tileKinds) {
  const tileFrequencies = Array(TILE_KIND_COUNT).fill(0);
  for (const k of tileKinds) {
    const f = tileFrequencies[k];
    if (f < FREQUENCY_MAX) {
      tileFrequencies[k]++;
    }
  }
  return tileFrequencies;
}

export function getRankDistributions(tileFrequencies) {
  const rankDistributions = Array(SUIT_COUNT).fill(0);
  for (let k = 0; k < TILE_KIND_COUNT; k++) {
    const f = tileFrequencies[k];
    if (f) {
      rankDistributions[getTileKindSuit(k)] += f << (3 * getTileKindRank(k));
    }
  }
  return rankDistributions;
}

export function getTileGapNorm(tg) {
  return Number(tg >> 34n);
}

export function hasTileGapTileKind(tg, k) {
  return tg & (1n << BigInt(k));
}
