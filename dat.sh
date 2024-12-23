#!/bin/bash
set -euxo pipefail

mkdir -p src/dat
zig run -O ReleaseFast src/dat_crds.zig -- honor > src/dat/crds_honor.dat
zig run -O ReleaseFast src/dat_crds.zig -- number > src/dat/crds_number.dat
zig run -O ReleaseFast src/dat_wrgs.zig -- honor > src/dat/wrgs_honor.dat
zig run -O ReleaseFast src/dat_wrgs.zig -- number > src/dat/wrgs_number.dat
ls -al src/dat
