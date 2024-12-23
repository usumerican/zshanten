const std = @import("std");
const tst = std.testing;

pub const Suit = u8;
pub const SM: Suit = 0;
pub const SP: Suit = 1;
pub const SS: Suit = 2;
pub const SZ: Suit = 3;
pub const SUITS = [_]Suit{ SM, SP, SS, SZ };
pub const SUITS_NUMBER = [_]Suit{ SM, SP, SS };

pub const Rank = u8;
pub const R1: Rank = 0;
pub const R2: Rank = 1;
pub const R3: Rank = 2;
pub const R4: Rank = 3;
pub const R5: Rank = 4;
pub const R6: Rank = 5;
pub const R7: Rank = 6;
pub const R8: Rank = 7;
pub const R9: Rank = 8;
pub const RANKS = [_]Rank{ R1, R2, R3, R4, R5, R6, R7, R8, R9 };
pub const RANKS_HONOR = [_]Rank{ R1, R2, R3, R4, R5, R6, R7 };

pub fn isRankTerminal(r: Rank) bool {
    return r == R1 or r == R9;
}

test "isRankTerminal" {
    try tst.expectEqual(true, isRankTerminal(R1));
    try tst.expectEqual(false, isRankTerminal(R2));
    try tst.expectEqual(false, isRankTerminal(R8));
    try tst.expectEqual(true, isRankTerminal(R9));
}

pub const TileKind = u8;
pub const TILE_KINDS = [_]TileKind{ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33 };
pub const TILE_KINDS_ORPHAN = [_]TileKind{ 0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33 };

pub fn getTileKind(s: Suit, r: Rank) TileKind {
    return @truncate(RANKS.len * s + r);
}

pub fn getTileKindSuit(k: TileKind) Suit {
    return @truncate(k / RANKS.len);
}

pub fn getTileKindRank(k: TileKind) Rank {
    return @truncate(k % RANKS.len);
}

pub fn isTileKindOrphan(k: TileKind) bool {
    return getTileKindSuit(k) == SZ or isRankTerminal(getTileKindRank(k));
}

pub const TileCount = u8;
pub const WINNABLE_COUNTS = [_]TileCount{ 0, 2, 3, 5, 6, 8, 9, 11, 12, 14 };
pub const WINNABLE_COUNT_NONE: TileCount = 15;
pub const WINNABLE_COUNT_INDICES = [_]?usize{ 0, null, 1, 2, null, 3, 4, null, 5, 6, null, 7, 8, null, 9, null };

pub const Frequency = u8;
pub const FREQUENCY_MAX = 4;
pub const FREQUENCIES = [_]Frequency{ 0, 1, 2, 3, 4 };

pub const RankDistribution = u32;
pub const RANK_DISTRIBUTION_FULL = 0o444444444;
pub const RANK_DISTRIBUTION_SHIFTS = [_]u5{ 0, 3, 6, 9, 12, 15, 18, 21, 24 };

pub fn getRankDistributionFrequency(rd: RankDistribution, r: Rank) Frequency {
    return @truncate((rd >> RANK_DISTRIBUTION_SHIFTS[r]) & 0b111);
}

test "getRankDistributionFrequency" {
    try tst.expectEqual(0, getRankDistributionFrequency(0, R1));
    try tst.expectEqual(4, getRankDistributionFrequency(0o1234, R1));
    try tst.expectEqual(3, getRankDistributionFrequency(0o1234, R2));
    try tst.expectEqual(0, getRankDistributionFrequency(0o1234, R9));
}

pub fn addRankDistributionFrequency(rd: RankDistribution, r: Rank, f: Frequency) RankDistribution {
    return rd + (@as(RankDistribution, f) << RANK_DISTRIBUTION_SHIFTS[r]);
}

test "addRankDistributionFrequency" {
    try tst.expectEqual(0o2, addRankDistributionFrequency(0o1, R1, 1));
    try tst.expectEqual(0o400000001, addRankDistributionFrequency(0o1, R9, 4));
}

pub fn subtractRankDistributionFrequency(rd: RankDistribution, r: Rank, f: Frequency) RankDistribution {
    return rd - (@as(RankDistribution, f) << RANK_DISTRIBUTION_SHIFTS[r]);
}

test "subtractRankDistributionFrequency" {
    try tst.expectEqual(0o1, subtractRankDistributionFrequency(0o2, R1, 1));
    try tst.expectEqual(0o1, subtractRankDistributionFrequency(0o400000001, R9, 4));
}

pub fn getRankDistributionNorm(from: RankDistribution, to: RankDistribution) TileCount {
    var n: TileCount = 0;
    for (RANKS) |r| {
        n += getRankDistributionFrequency(to, r) -| getRankDistributionFrequency(from, r);
    }
    return n;
}

test "getRankDistributionNorm" {
    try tst.expectEqual(0, getRankDistributionNorm(0, 0));
    try tst.expectEqual(8, getRankDistributionNorm(0o432104321, 0o123401234));
}

pub fn compareRankDistributions(_: void, lhs: RankDistribution, rhs: RankDistribution) std.math.Order {
    return std.math.order(lhs, rhs);
}

pub const TileDistribution = u128;
pub const TILE_DISTRIBUTION_RANK_DISTRIBUTION_SHIFTS = [_]u7{ 0, 27, 54, 81 };
pub const TILE_DISTRIBUTION_FREQUENCY_SHIFTS = _: {
    var shifts: [TILE_KINDS.len]u7 = undefined;
    for (0..TILE_KINDS.len) |i| {
        shifts[i] = 3 * i;
    }
    break :_ shifts;
};

pub fn getTileDistribution(rdm: RankDistribution, rdp: RankDistribution, rds: RankDistribution, rdz: RankDistribution) TileDistribution {
    return (@as(TileDistribution, rdm) << TILE_DISTRIBUTION_RANK_DISTRIBUTION_SHIFTS[SM]) |
        (@as(TileDistribution, rdp) << TILE_DISTRIBUTION_RANK_DISTRIBUTION_SHIFTS[SP]) |
        (@as(TileDistribution, rds) << TILE_DISTRIBUTION_RANK_DISTRIBUTION_SHIFTS[SS]) |
        (@as(TileDistribution, rdz) << TILE_DISTRIBUTION_RANK_DISTRIBUTION_SHIFTS[SZ]);
}

test "getTileDistribution" {
    try tst.expectEqual(0o4000000_111000000_000111000_000000111, getTileDistribution(0o000000111, 0o000111000, 0o111000000, 0o4000000));
}

pub fn getTileDistributionRankDistribution(td: TileDistribution, s: Suit) RankDistribution {
    return @truncate((td >> TILE_DISTRIBUTION_RANK_DISTRIBUTION_SHIFTS[s]) & 0o777777777);
}

test "getTileDistributionRankDistribution" {
    try tst.expectEqual(0o100000001, getTileDistributionRankDistribution(0o4000001_300000001_200000001_100000001, SM));
    try tst.expectEqual(0o200000001, getTileDistributionRankDistribution(0o4000001_300000001_200000001_100000001, SP));
    try tst.expectEqual(0o300000001, getTileDistributionRankDistribution(0o4000001_300000001_200000001_100000001, SS));
    try tst.expectEqual(0o4000001, getTileDistributionRankDistribution(0o4000001_300000001_200000001_100000001, SZ));
}

pub fn getTileDistributionFrequency(td: TileDistribution, k: TileKind) Frequency {
    return @truncate((td >> TILE_DISTRIBUTION_FREQUENCY_SHIFTS[k]) & 0b111);
}

test "getTileDistributionFrequency" {
    try tst.expectEqual(1, getTileDistributionFrequency(0o4000001_300000001_200000001_100000001, 0));
    try tst.expectEqual(4, getTileDistributionFrequency(0o4000001_300000001_200000001_100000001, 33));
}

pub fn addTileDistributionFrequency(td: TileDistribution, k: TileKind, f: Frequency) TileDistribution {
    return td + (@as(TileDistribution, f) << TILE_DISTRIBUTION_FREQUENCY_SHIFTS[k]);
}

test "addTileDistributionFrequency" {
    try tst.expectEqual(0o2, addTileDistributionFrequency(0o1, 0, 1));
    try tst.expectEqual(0o4000000_000000000_000000000_000000001, addTileDistributionFrequency(0o1, 33, 4));
}

pub fn getTileDistributionTotal(td: TileDistribution) TileCount {
    var total: TileCount = 0;
    for (TILE_KINDS) |k| {
        total += getTileDistributionFrequency(td, k);
    }
    return total;
}

pub fn parseTileDistribution(str: []const u8) TileDistribution {
    var td: TileDistribution = 0;
    var s = SM;
    var it = std.mem.reverseIterator(str);
    while (it.next()) |ch| {
        switch (ch) {
            'm' => s = SM,
            'p' => s = SP,
            's' => s = SS,
            'z' => s = SZ,
            '0'...'9' => {
                const k = getTileKind(s, if (ch == '0') R5 else ch - '1');
                if (getTileDistributionFrequency(td, k) < FREQUENCY_MAX) {
                    td = addTileDistributionFrequency(td, k, 1);
                }
            },
            else => {},
        }
    }
    return td;
}

test "parseTileDistribution" {
    try tst.expectEqual(0o111, parseTileDistribution("123"));
    try tst.expectEqual(0o4000000_111000000_000111000_000000111, parseTileDistribution("123m456p789s7777z"));
    try tst.expectEqual(0o0000000_000010000_000040000_000040000, parseTileDistribution("0s0000p00000m"));
}

pub const RankGap = u16;

pub fn hasRankGapRank(rg: RankGap, r: Rank) bool {
    return rg & (@as(RankGap, 1) << @truncate(r)) > 0;
}

test "hasRankGapRank" {
    try tst.expectEqual(false, hasRankGapRank(0b100000000, R1));
    try tst.expectEqual(true, hasRankGapRank(0b100000000, R9));
}

pub fn setRankGapRank(rg: RankGap, r: Rank) RankGap {
    return rg | (@as(RankGap, 1) << @truncate(r));
}

test "setRankGapRank" {
    try tst.expectEqual(0b100000001, setRankGapRank(0b100000000, R1));
    try tst.expectEqual(0b100000000, setRankGapRank(0b100000000, R9));
}

pub fn getRankGapNorm(rg: RankGap) TileCount {
    return @truncate(rg >> RANKS.len);
}

test "getRankGapNorm" {
    try tst.expectEqual(7, getRankGapNorm(0b111_100000001));
}

pub fn setRankGapNorm(rg: RankGap, n: TileCount) RankGap {
    return (@as(RankGap, n) << RANKS.len) | (rg & 0b111111111);
}

test "setRankGapNorm" {
    try tst.expectEqual(0b111_100000001, setRankGapNorm(0b100000001, 7));
}

pub const TileGap = u64;

pub fn getTileGapNorm(tg: TileGap) TileCount {
    return @truncate((tg >> TILE_KINDS.len) & 0b1111);
}

test "getTileGapNorm" {
    try tst.expectEqual(1, getTileGapNorm(0b1_1000001_100000001_100000001_100000001));
}

pub fn setTileGapNorm(tg: TileGap, n: TileCount) TileGap {
    return (@as(TileGap, n) << TILE_KINDS.len) | (tg & 0b1111111_111111111_111111111_111111111);
}

test "setTileGapNorm" {
    try tst.expectEqual(
        0b1110_1000001_100000001_100000001_100000001,
        setTileGapNorm(0b1_1000001_100000001_100000001_100000001, 14),
    );
}

pub fn hasTileGapTileKind(tg: TileGap, k: TileKind) bool {
    return (tg & (@as(TileGap, 1) << @truncate(k))) > 0;
}

test "hasTileGapTileKind" {
    try tst.expectEqual(false, hasTileGapTileKind(0b1_1000000_000000000_000000000_000000000, 0));
    try tst.expectEqual(true, hasTileGapTileKind(0b1_1000000_000000000_000000000_000000000, 33));
}

pub fn setTileGapTileKind(tg: TileGap, k: TileKind) TileGap {
    return tg | (@as(TileGap, 1) << @truncate(k));
}

test "setTileGapTileKind" {
    try tst.expectEqual(0b1_1000000_000000000_000000000_000000001, setTileGapTileKind(0b1_1000000_000000000_000000000_000000000, 0));
    try tst.expectEqual(0b1_1000000_000000000_000000000_000000000, setTileGapTileKind(0b1_1000000_000000000_000000000_000000000, 33));
}

pub fn mergeTileGap(tg: TileGap, rgm: RankGap, rgp: RankGap, rgs: RankGap, rgz: RankGap) TileGap {
    return tg |
        (rgm & 0b111111111) |
        (@as(TileGap, rgp & 0b111111111) << RANKS.len) |
        (@as(TileGap, rgs & 0b111111111) << 2 * RANKS.len) |
        (@as(TileGap, rgz & 0b1111111) << 3 * RANKS.len);
}

test "mergeTileGap" {
    try tst.expectEqual(
        0b1110_1011111_100001111_100000111_100000011,
        mergeTileGap(0b1110_1000001_100000001_100000001_100000001, 0b1_000000011, 0b1_000000111, 0b1_000001111, 0b1_000011111),
    );
}

fn loadConcealedRankDistributionsImpl(crds: *[]RankDistribution, r: Rank, rd: RankDistribution, c: TileCount) void {
    for (FREQUENCIES) |f| {
        const fc = c + f;
        if (fc > 14) {
            break;
        }
        const fd = addRankDistributionFrequency(rd, r, f);
        if (r == R1) {
            crds.len += 1;
            crds.*[crds.len - 1] = fd;
        } else {
            loadConcealedRankDistributionsImpl(crds, r - 1, fd, fc);
        }
    }
}

pub fn loadConcealedRankDistributions(comptime HONOR: bool, crds: *[]RankDistribution) void {
    loadConcealedRankDistributionsImpl(crds, if (HONOR) R7 else R9, 0, 0);
}

test "loadConcealedRankDistributions(HONOR)" {
    var crds_buf: [43130]RankDistribution = undefined;
    var crds: []RankDistribution = &crds_buf;
    crds.len = 0;
    loadConcealedRankDistributions(true, &crds);
    try tst.expectEqual(43130, crds.len);
    try tst.expectEqual(true, std.sort.isSorted(RankDistribution, crds, {}, std.sort.asc(RankDistribution)));
    try tst.expectEqual(0, crds[0]);
    try tst.expectEqual(1, crds[1]);
    try tst.expectEqual(0o4442000, crds[crds.len - 1]);
}

test "loadConcealedRankDistributions(NUMBER)" {
    var crds_buf: [405350]RankDistribution = undefined;
    var crds: []RankDistribution = &crds_buf;
    crds.len = 0;
    loadConcealedRankDistributions(false, &crds);
    try tst.expectEqual(405350, crds.len);
    try tst.expectEqual(true, std.sort.isSorted(RankDistribution, crds, {}, std.sort.asc(RankDistribution)));
    try tst.expectEqual(0, crds[0]);
    try tst.expectEqual(1, crds[1]);
    try tst.expectEqual(0o444200000, crds[crds.len - 1]);
}

fn loadWinnableRankDistributionsImpl(comptime HONOR: bool, wrds: *[]RankDistribution, mc: TileCount, curr: RankDistribution, rest: RankDistribution) void {
    if (mc == 0) {
        if (std.mem.indexOfScalar(RankDistribution, wrds.*, curr) == null) {
            wrds.len += 1;
            wrds.*[wrds.len - 1] = curr;
        }
        return;
    }
    for (if (HONOR) RANKS_HONOR else RANKS) |r| {
        if (getRankDistributionFrequency(rest, r) >= 3) {
            loadWinnableRankDistributionsImpl(
                HONOR,
                wrds,
                mc - 1,
                addRankDistributionFrequency(curr, r, 3),
                subtractRankDistributionFrequency(rest, r, 3),
            );
        }
    }
    if (!HONOR) {
        for (RANKS[0 .. RANKS.len - 2]) |r| {
            if (getRankDistributionFrequency(rest, r) > 0 and
                getRankDistributionFrequency(rest, r + 1) > 0 and
                getRankDistributionFrequency(rest, r + 2) > 0)
            {
                loadWinnableRankDistributionsImpl(
                    HONOR,
                    wrds,
                    mc - 1,
                    addRankDistributionFrequency(addRankDistributionFrequency(addRankDistributionFrequency(curr, r, 1), r + 1, 1), r + 2, 1),
                    subtractRankDistributionFrequency(subtractRankDistributionFrequency(subtractRankDistributionFrequency(rest, r, 1), r + 1, 1), r + 2, 1),
                );
            }
        }
    }
}

test "loadWinnableRankDistributionsImpl(HONOR)" {
    const data_list = [_]struct { mc: TileCount, len: usize, first: RankDistribution }{
        .{ .mc = 0, .len = 1, .first = 0 },
        .{ .mc = 1, .len = 7, .first = 0o3 },
        .{ .mc = 2, .len = 21, .first = 0o33 },
        .{ .mc = 3, .len = 35, .first = 0o333 },
        .{ .mc = 4, .len = 35, .first = 0o3333 },
    };
    var wrds_buf: [2098]RankDistribution = undefined;
    var wrds: []RankDistribution = &wrds_buf;
    for (data_list) |data| {
        wrds.len = 0;
        loadWinnableRankDistributionsImpl(true, &wrds, data.mc, 0, RANK_DISTRIBUTION_FULL);
        try tst.expectEqual(data.len, wrds.len);
        try tst.expectEqual(data.first, wrds[0]);
    }
}

test "loadWinnableRankDistributionsImpl(NUMBER)" {
    const data_list = [_]struct { mc: TileCount, len: usize, first: RankDistribution }{
        .{ .mc = 0, .len = 1, .first = 0 },
        .{ .mc = 1, .len = 16, .first = 0o3 },
        .{ .mc = 2, .len = 127, .first = 0o33 },
        .{ .mc = 3, .len = 627, .first = 0o333 },
        .{ .mc = 4, .len = 2098, .first = 0o3333 },
    };
    var wrds_buf: [2098]RankDistribution = undefined;
    var wrds: []RankDistribution = &wrds_buf;
    for (data_list) |data| {
        wrds.len = 0;
        loadWinnableRankDistributionsImpl(false, &wrds, data.mc, 0, RANK_DISTRIBUTION_FULL);
        try tst.expectEqual(data.len, wrds.len);
        try tst.expectEqual(data.first, wrds[0]);
    }
}

pub fn loadWinnableRankDistributions(comptime HONOR: bool, wrds: *[]RankDistribution, wc: TileCount) void {
    const mc = wc / 3;
    switch (wc % 3) {
        0 => loadWinnableRankDistributionsImpl(HONOR, wrds, mc, 0, RANK_DISTRIBUTION_FULL),
        2 => for (if (HONOR) RANKS_HONOR else RANKS) |r| {
            loadWinnableRankDistributionsImpl(
                HONOR,
                wrds,
                mc,
                addRankDistributionFrequency(0, r, 2),
                subtractRankDistributionFrequency(RANK_DISTRIBUTION_FULL, r, 2),
            );
        },
        else => {},
    }
}

test "loadWinnableRankDistributions(HONOR)" {
    const data_list = [_]struct { wc: TileCount, len: usize, first: RankDistribution }{
        .{ .wc = 0, .len = 1, .first = 0 },
        .{ .wc = 1, .len = 0, .first = 0 },
        .{ .wc = 2, .len = 7, .first = 0o2 },
        .{ .wc = 3, .len = 7, .first = 0o3 },
        .{ .wc = 4, .len = 0, .first = 0 },
        .{ .wc = 5, .len = 42, .first = 0o32 },
        .{ .wc = 6, .len = 21, .first = 0o33 },
        .{ .wc = 7, .len = 0, .first = 0 },
        .{ .wc = 8, .len = 105, .first = 0o332 },
        .{ .wc = 9, .len = 35, .first = 0o333 },
        .{ .wc = 10, .len = 0, .first = 0 },
        .{ .wc = 11, .len = 140, .first = 0o3332 },
        .{ .wc = 12, .len = 35, .first = 0o3333 },
        .{ .wc = 13, .len = 0, .first = 0 },
        .{ .wc = 14, .len = 105, .first = 0o33332 },
    };
    var wrds_buf: [140]RankDistribution = undefined;
    var wrds: []RankDistribution = &wrds_buf;
    for (data_list) |data| {
        wrds.len = 0;
        loadWinnableRankDistributions(true, &wrds, data.wc);
        try tst.expectEqual(data.len, wrds.len);
        if (data.len > 0) {
            try tst.expectEqual(data.first, wrds[0]);
        }
    }
}

test "loadWinnableRankDistributions(NUMBER)" {
    const data_list = [_]struct { wc: TileCount, len: usize, first: RankDistribution }{
        .{ .wc = 0, .len = 1, .first = 0 },
        .{ .wc = 1, .len = 0, .first = 0 },
        .{ .wc = 2, .len = 9, .first = 0o2 },
        .{ .wc = 3, .len = 16, .first = 0o3 },
        .{ .wc = 4, .len = 0, .first = 0 },
        .{ .wc = 5, .len = 135, .first = 0o32 },
        .{ .wc = 6, .len = 127, .first = 0o33 },
        .{ .wc = 7, .len = 0, .first = 0 },
        .{ .wc = 8, .len = 996, .first = 0o332 },
        .{ .wc = 9, .len = 627, .first = 0o333 },
        .{ .wc = 10, .len = 0, .first = 0 },
        .{ .wc = 11, .len = 4475, .first = 0o3332 },
        .{ .wc = 12, .len = 2098, .first = 0o3333 },
        .{ .wc = 13, .len = 0, .first = 0 },
        .{ .wc = 14, .len = 13259, .first = 0o33332 },
    };
    var wrds_buf: [13259]RankDistribution = undefined;
    var wrds: []RankDistribution = &wrds_buf;
    for (data_list) |data| {
        wrds.len = 0;
        loadWinnableRankDistributions(false, &wrds, data.wc);
        try tst.expectEqual(data.len, wrds.len);
        if (data.len > 0) {
            try tst.expectEqual(data.first, wrds[0]);
        }
    }
}

pub const WINNABLE_RANK_DISTRIBUTION_INDICES_HONOR = [_]usize{ 0, 1, 1, 8, 15, 15, 57, 78, 78, 183, 218, 218, 358, 393, 393, 498 };
pub const WINNABLE_RANK_DISTRIBUTION_INDICES_NUMBER = [_]usize{ 0, 1, 1, 10, 26, 26, 161, 288, 288, 1284, 1911, 1911, 6386, 8484, 8484, 21743 };

pub fn loadWinnableRankGaps(wrgs: *[]RankGap, crds: []const RankDistribution, wrds: []const RankDistribution, wrdis: []const usize) void {
    for (crds) |from| {
        for (WINNABLE_COUNTS) |wc| {
            var min_norm = wc + 1;
            var min_rank_gap: RankGap = setRankGapNorm(0, min_norm);
            for (wrds[wrdis[wc]..wrdis[wc + 1]]) |to| {
                const n = getRankDistributionNorm(from, to);
                if (n <= min_norm) {
                    if (n < min_norm) {
                        min_norm = n;
                        min_rank_gap = setRankGapNorm(0, min_norm);
                    }
                    for (RANKS) |r| {
                        if (getRankDistributionFrequency(to, r) -| getRankDistributionFrequency(from, r) > 0) {
                            min_rank_gap = setRankGapRank(min_rank_gap, r);
                        }
                    }
                }
            }
            wrgs.len += 1;
            wrgs.*[wrgs.len - 1] = min_rank_gap;
        }
    }
}
