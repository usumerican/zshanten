import fs from 'fs';
import { IMPORT_OBJECT, setInstance } from './wasm';

export * from './wasm';

export async function initWasm() {
  setInstance((await WebAssembly.instantiate(fs.readFileSync('dist/bin/zshanten.wasm'), IMPORT_OBJECT)).instance);
}
