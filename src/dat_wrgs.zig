const std = @import("std");
const cmn = @import("common.zig");
const RankDistribution = cmn.RankDistribution;
const RankGap = cmn.RankGap;
const root = @import("root.zig");

fn generateWinnableGaps(comptime HONOR: bool) !void {
    const time = std.time.milliTimestamp();
    const CRDS: []RankDistribution = @alignCast(@constCast(std.mem.bytesAsSlice(
        RankDistribution,
        @embedFile(if (HONOR) "dat/crds_honor.dat" else "dat/crds_number.dat"),
    )));
    var wrds: []RankDistribution = undefined;
    var wrdis: []const usize = undefined;
    if (HONOR) {
        var wrds_buf: [498]RankDistribution = undefined;
        wrds = &wrds_buf;
        wrds.len = 0;
        for (cmn.WINNABLE_COUNTS) |wc| {
            cmn.loadWinnableRankDistributions(true, &wrds, wc);
        }
        wrdis = &cmn.WINNABLE_RANK_DISTRIBUTION_INDICES_HONOR;
    } else {
        var wrds_buf: [21743]RankDistribution = undefined;
        wrds = &wrds_buf;
        wrds.len = 0;
        for (cmn.WINNABLE_COUNTS) |wc| {
            cmn.loadWinnableRankDistributions(false, &wrds, wc);
        }
        wrdis = &cmn.WINNABLE_RANK_DISTRIBUTION_INDICES_NUMBER;
    }
    var wrgs_buf: [4053500]RankGap = undefined;
    var wrgs: []RankGap = &wrgs_buf;
    wrgs.len = 0;
    cmn.loadWinnableRankGaps(&wrgs, CRDS, wrds, wrdis);
    const writer = std.io.getStdOut().writer();
    for (wrgs) |rg| {
        try writer.writeInt(RankGap, rg, .little);
    }
    std.debug.print("len: {d}\n", .{wrgs.len});
    std.debug.print("time: {d}ms\n", .{std.time.milliTimestamp() - time});
}

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    const allocator = gpa.allocator();
    const argv = try std.process.argsAlloc(allocator);
    defer std.process.argsFree(allocator, argv);
    if (argv.len <= 1) {
        return;
    }
    const command = argv[1];
    if (std.mem.eql(u8, command, "honor")) {
        try generateWinnableGaps(true);
    } else if (std.mem.eql(u8, command, "number")) {
        try generateWinnableGaps(false);
    }
}
