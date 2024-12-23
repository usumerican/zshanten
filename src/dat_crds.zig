const std = @import("std");
const cmn = @import("common.zig");
const RankDistribution = cmn.RankDistribution;
const root = @import("root.zig");

fn generateConcealRankDistributions(comptime HONOR: bool) !void {
    const time = std.time.milliTimestamp();
    var crds_buf: [405350]RankDistribution = undefined;
    var crds: []RankDistribution = &crds_buf;
    crds.len = 0;
    cmn.loadConcealedRankDistributions(HONOR, &crds);
    const writer = std.io.getStdOut().writer();
    for (crds) |rd| {
        try writer.writeInt(RankDistribution, rd, .little);
    }
    std.debug.print("len: {d}\n", .{crds.len});
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
        try generateConcealRankDistributions(true);
    } else if (std.mem.eql(u8, command, "number")) {
        try generateConcealRankDistributions(false);
    }
}
