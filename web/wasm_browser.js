import init from '../dist/bin/zshanten.wasm?init';
import { IMPORT_OBJECT, setInstance } from './wasm';

export * from './wasm';

export async function initWasm() {
  setInstance(await init(IMPORT_OBJECT));
}
