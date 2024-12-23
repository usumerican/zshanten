const std = @import("std");
const cmn = @import("common.zig");
const root = @import("root.zig");

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    const allocator = gpa.allocator();
    const argv = try std.process.argsAlloc(allocator);
    defer std.process.argsFree(allocator, argv);
    if (argv.len <= 1) {
        return;
    }
    const td = cmn.parseTileDistribution(argv[1]);
    const wc = (cmn.getTileDistributionTotal(td) / 3) * 3 + 2;
    const tgn = root.solveNormalTileGap(td, wc);
    std.debug.print("normal: {d} {b}\n", .{ cmn.getTileGapNorm(tgn), tgn });
    if (wc == 14) {
        const tgp = root.solvePairTileGap(td);
        std.debug.print("pair: {d} {b}\n", .{ cmn.getTileGapNorm(tgp), tgp });
        const tgo = root.solveOrphanTileGap(td);
        std.debug.print("orpan: {d} {b}\n", .{ cmn.getTileGapNorm(tgo), tgo });
    }
}
