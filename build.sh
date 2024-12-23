#!/bin/bash
set -euxo pipefail

npm run zig:test
npm run zig:wasm
npm run test
npm run build
tree -s dist
