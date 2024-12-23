const std = @import("std");
const tst = std.testing;
const cmn = @import("common.zig");
const RankDistribution = cmn.RankDistribution;
const RankGap = cmn.RankGap;
const TileCount = cmn.TileCount;
const TileDistribution = cmn.TileDistribution;
const TileGap = cmn.TileGap;

const CRDS_HONOR = std.mem.bytesAsSlice(RankDistribution, @embedFile("dat/crds_honor.dat"));

test "CRDS_HONOR" {
    try tst.expectEqual(43130, CRDS_HONOR.len);
}

const CRDS_NUMBER = std.mem.bytesAsSlice(RankDistribution, @embedFile("dat/crds_number.dat"));

test "CRDS_NUMBER" {
    try tst.expectEqual(405350, CRDS_NUMBER.len);
}

fn findConcealedRankDistributionIndex(comptime HONOR: bool, rd: RankDistribution) ?usize {
    const CRDS = comptime if (HONOR) CRDS_HONOR else CRDS_NUMBER;
    return std.sort.binarySearch(RankDistribution, rd, @alignCast(CRDS), {}, cmn.compareRankDistributions);
}

test "findConcealedRankDistributionIndex(HONOR)" {
    try tst.expectEqual(0, findConcealedRankDistributionIndex(true, 0));
    try tst.expectEqual(1, findConcealedRankDistributionIndex(true, 1));
    try tst.expectEqual(CRDS_HONOR.len - 1, findConcealedRankDistributionIndex(true, 0o4442000));
    try tst.expectEqual(null, findConcealedRankDistributionIndex(true, 0o444200000));
}

test "findConcealedRankDistributionIndex(NUMBER)" {
    try tst.expectEqual(0, findConcealedRankDistributionIndex(false, 0));
    try tst.expectEqual(1, findConcealedRankDistributionIndex(false, 1));
    try tst.expectEqual(CRDS_NUMBER.len - 1, findConcealedRankDistributionIndex(false, 0o444200000));
    try tst.expectEqual(null, findConcealedRankDistributionIndex(false, 0o444300000));
}

const WRGS_HONOR = std.mem.bytesAsSlice(RankGap, @embedFile("dat/wrgs_honor.dat"));

test "WRGS_HONOR" {
    try tst.expectEqual(431300, WRGS_HONOR.len);
    try tst.expectEqual(0, WRGS_HONOR[0]);
    try tst.expectEqual(0b10_001111111, WRGS_HONOR[1]);
}

const WRGS_NUMBER = std.mem.bytesAsSlice(RankGap, @embedFile("dat/wrgs_number.dat"));

test "WRGS_NUMBER" {
    try tst.expectEqual(4053500, WRGS_NUMBER.len);
    try tst.expectEqual(0, WRGS_NUMBER[0]);
    try tst.expectEqual(0b10_111111111, WRGS_NUMBER[1]);
}

fn findWinnableRankGap(comptime HONOR: bool, cdi: usize, wci: usize) RankGap {
    const WRGS = comptime if (HONOR) WRGS_HONOR else WRGS_NUMBER;
    return WRGS[cmn.WINNABLE_COUNTS.len * cdi + wci];
}

test "findWinnableRankGap" {
    try tst.expectEqual(0b10_001111111, findWinnableRankGap(true, 0, 1));
    try tst.expectEqual(0b10_111111111, findWinnableRankGap(false, 0, 1));
}

pub fn solvePairTileGap(td: TileDistribution) TileGap {
    var fc: TileCount = 0;
    var pc: TileCount = 0;
    for (cmn.TILE_KINDS) |k| {
        const f = cmn.getTileDistributionFrequency(td, k);
        if (f > 0) {
            fc += 1;
            if (f >= 2) {
                pc += 1;
            }
        }
    }
    const pair_norm = @as(TileCount, 14) - @min(7, fc) - pc;
    var pair_tile_gap = cmn.setTileGapNorm(0, pair_norm);
    if (pair_norm > 0) {
        if (fc >= 7) {
            for (cmn.TILE_KINDS) |k| {
                if (cmn.getTileDistributionFrequency(td, k) == 1) {
                    pair_tile_gap = cmn.setTileGapTileKind(pair_tile_gap, k);
                }
            }
        } else {
            for (cmn.TILE_KINDS) |k| {
                if (cmn.getTileDistributionFrequency(td, k) <= 1) {
                    pair_tile_gap = cmn.setTileGapTileKind(pair_tile_gap, k);
                }
            }
        }
    }
    return pair_tile_gap;
}

test "solvePairTileGap" {
    try tst.expectEqual(0, solvePairTileGap(0o2222222_000000000_000000000_000000000));
    try tst.expectEqual(0b1_0000001_000000000_000000000_000000000, solvePairTileGap(0o2222221_000000000_000000000_000000000));
    try tst.expectEqual(0b10_0000011_100000000_000000000_000000000, solvePairTileGap(0o2222211_100000000_000000000_000000000));
    try tst.expectEqual(0b10_0000001_111111111_111111111_111111111, solvePairTileGap(0o3222220_000000000_000000000_000000000));
    try tst.expectEqual(0b111_1111111_111111000_000000000_000000000, solvePairTileGap(0o1111111_111111000_000000000_000000000));
}

pub fn solveOrphanTileGap(td: TileDistribution) TileGap {
    var oc1: TileCount = 0;
    var oc2: TileCount = 0;
    for (cmn.TILE_KINDS_ORPHAN) |k| {
        const f = cmn.getTileDistributionFrequency(td, k);
        if (f > 0) {
            oc1 += 1;
            if (f >= 2) {
                oc2 = 1;
            }
        }
    }
    const orphan_norm = @as(TileCount, 14) - oc1 - oc2;
    var orphan_tile_gap = cmn.setTileGapNorm(0, orphan_norm);
    const f = oc2 ^ 1;
    for (cmn.TILE_KINDS_ORPHAN) |k| {
        if (cmn.getTileDistributionFrequency(td, k) <= f) {
            orphan_tile_gap = cmn.setTileGapTileKind(orphan_tile_gap, k);
        }
    }
    return orphan_tile_gap;
}

test "solveOrphanTileGap" {
    try tst.expectEqual(0, solveOrphanTileGap(0o2111111_100000001_100000001_100000001));
    try tst.expectEqual(0b1_1111111_100000001_100000001_100000001, solveOrphanTileGap(0o1111111_100000001_100000001_100000001));
    try tst.expectEqual(0b1_0000000_000000000_000000000_000000001, solveOrphanTileGap(0o2111111_100000001_100000001_100000000));
    try tst.expectEqual(0b10_0000000_000000000_000000000_100000001, solveOrphanTileGap(0o2111111_100000001_100000001_010000000));
    try tst.expectEqual(0b10_0000000_000000000_000000000_100000001, solveOrphanTileGap(0o2211111_100000001_100000001_000000000));
    try tst.expectEqual(0b1110_1111111_100000001_100000001_100000001, solveOrphanTileGap(0o0000000_044410000_000000000_000000000));
}

pub fn solveNormalTileGap(td: TileDistribution, wc: TileCount) TileGap {
    const crdim = findConcealedRankDistributionIndex(false, cmn.getTileDistributionRankDistribution(td, cmn.SM)) orelse return cmn.WINNABLE_COUNT_NONE;
    const crdip = findConcealedRankDistributionIndex(false, cmn.getTileDistributionRankDistribution(td, cmn.SP)) orelse return cmn.WINNABLE_COUNT_NONE;
    const crdis = findConcealedRankDistributionIndex(false, cmn.getTileDistributionRankDistribution(td, cmn.SS)) orelse return cmn.WINNABLE_COUNT_NONE;
    const crdiz = findConcealedRankDistributionIndex(true, cmn.getTileDistributionRankDistribution(td, cmn.SZ)) orelse return cmn.WINNABLE_COUNT_NONE;
    var min_norm: TileCount = cmn.WINNABLE_COUNT_NONE;
    var min_tile_gap: TileGap = cmn.setTileGapNorm(0, min_norm);
    for (cmn.WINNABLE_COUNTS) |wcm| {
        if (wcm > wc) {
            break;
        }
        const rgm = findWinnableRankGap(false, crdim, cmn.WINNABLE_COUNT_INDICES[wcm].?);
        for (cmn.WINNABLE_COUNTS) |wcp| {
            const wcmp = wcm + wcp;
            if (wcmp > wc) {
                break;
            }
            if (wcmp % 3 == 1) {
                continue;
            }
            const rgp = findWinnableRankGap(false, crdip, cmn.WINNABLE_COUNT_INDICES[wcp].?);
            for (cmn.WINNABLE_COUNTS) |wcs| {
                const wcmps = wcmp + wcs;
                if (wcmps > wc) {
                    break;
                }
                if (wcmps % 3 == 1) {
                    continue;
                }
                const rgs = findWinnableRankGap(false, crdis, cmn.WINNABLE_COUNT_INDICES[wcs].?);
                for (cmn.WINNABLE_COUNTS) |wcz| {
                    if (wcmps + wcz >= wc) {
                        const rgz = findWinnableRankGap(true, crdiz, cmn.WINNABLE_COUNT_INDICES[wcz].?);
                        const norm = cmn.getRankGapNorm(rgm) + cmn.getRankGapNorm(rgp) + cmn.getRankGapNorm(rgs) + cmn.getRankGapNorm(rgz);
                        if (norm <= min_norm) {
                            if (norm < min_norm) {
                                min_norm = norm;
                                min_tile_gap = cmn.setTileGapNorm(0, min_norm);
                            }
                            min_tile_gap = cmn.mergeTileGap(min_tile_gap, rgm, rgp, rgs, rgz);
                        }
                        break;
                    }
                }
            }
        }
    }
    return min_tile_gap;
}

test "solveNormalTileGap" {
    try tst.expectEqual(0, solveNormalTileGap(0o2444, 14));
    try tst.expectEqual(0b1_0000000_000000000_000000000_000011000, solveNormalTileGap(0o1444, 14));
    try tst.expectEqual(0b1001_1111111_111000111_111000111_111000111, solveNormalTileGap(0o1111111_100000001_100000001_100000001, 14));
}
