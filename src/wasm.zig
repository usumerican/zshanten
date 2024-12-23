const cmn = @import("common.zig");
const RankDistribution = cmn.RankDistribution;
const TileCount = cmn.TileCount;
const TileGap = cmn.TileGap;
const root = @import("root.zig");

export fn solveNormalTileGap(
    rdm: RankDistribution,
    rdp: RankDistribution,
    rds: RankDistribution,
    rdz: RankDistribution,
    wc: TileCount,
) TileGap {
    return root.solveNormalTileGap(cmn.getTileDistribution(rdm, rdp, rds, rdz), wc);
}

export fn solvePairTileGap(
    rdm: RankDistribution,
    rdp: RankDistribution,
    rds: RankDistribution,
    rdz: RankDistribution,
) TileGap {
    return root.solvePairTileGap(cmn.getTileDistribution(rdm, rdp, rds, rdz));
}

export fn solveOrphanTileGap(
    rdm: RankDistribution,
    rdp: RankDistribution,
    rds: RankDistribution,
    rdz: RankDistribution,
) TileGap {
    return root.solveOrphanTileGap(cmn.getTileDistribution(rdm, rdp, rds, rdz));
}
