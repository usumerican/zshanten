import { describe, expect, test } from 'vitest';
import { initWasm, solveNormalTileGap, solveOrphanTileGap, solvePairTileGap } from '../wasm_node';

describe('wasm', async () => {
  await initWasm();

  test('solveNormalTileGap', () => {
    expect(solveNormalTileGap(0o311111113, 0, 0, 0, 14)).toEqual(0b1_0000000_000000000_000000000_111111111n);
  });

  test('solvePairTileGap', () => {
    expect(solvePairTileGap(0, 0, 0, 0o2222221)).toEqual(0b1_0000001_000000000_000000000_000000000n);
  });

  test('solveOrphanTileGap', () => {
    expect(solveOrphanTileGap(0o100000001, 0o100000001, 0o100000001, 0o1111111)).toEqual(
      0b1_1111111_100000001_100000001_100000001n,
    );
  });
});
