/* globals __APP_VERSION__ */

import { shuffle, toSampled } from 'jshuffle';
import {
  FREQUENCY_MAX,
  getRankDistributions,
  getTileFrequencies,
  getTileGapNorm,
  getTileKind,
  getTileKindRank,
  getTileKindSuit,
  hasTileGapTileKind,
  initWasm,
  solveNormalTileGap,
  solveOrphanTileGap,
  solvePairTileGap,
  TILE_KIND_COUNT,
} from './wasm_browser';

function on(target, types, listener) {
  for (const type of types.split(' ')) {
    target.addEventListener(type, (ev) => {
      try {
        if (ev.cancelable) {
          ev.preventDefault();
        }
        ev.stopPropagation();
        listener(ev);
      } catch (e) {
        alert(e.reason || e);
        console.error(e);
      }
    });
  }
}

function parseHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = html
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line)
    .join('');
  return template.content.firstChild;
}

function setTextareaValue(target, text) {
  target.scrollTop = 0;
  target.value = text;
}

function setSelectValue(target, value, defaultValue) {
  const v = value ?? defaultValue ?? null;
  if (v !== null) {
    const s = String(v);
    for (const option of target.options) {
      if (option.value === s) {
        option.selected = true;
        return;
      }
    }
  }
}

const SUIT_CODES = 'mpsz';
const RANK_CODES = '123456789';
const TILE_KIND_CHARS = '🀇🀈🀉🀊🀋🀌🀍🀎🀏🀙🀚🀛🀜🀝🀞🀟🀠🀡🀐🀑🀒🀓🀔🀕🀖🀗🀘🀀🀁🀂🀃🀆🀅🀄🀫'
  .split(/(?:)/u)
  .map((ch) => (ch === '🀄' ? ch + '\ufe0e' : ch));
const TILE_KINDS_CP_ORDER = [
  27, 28, 29, 30, 33, 32, 31, 0, 1, 2, 3, 4, 5, 6, 7, 8, 18, 19, 20, 21, 22, 23, 24, 25, 26, 9, 10, 11, 12, 13, 14, 15,
  16, 17,
];
const CONCEALED_COUNT_MAX = 14;
const NORM_NONE = 15;

function formatTileKindsMpsz(tileKinds) {
  let text = '';
  let last_suit = null;
  for (const k of tileKinds) {
    const s = getTileKindSuit(k);
    if (s !== last_suit) {
      if (last_suit !== null) {
        text += SUIT_CODES[last_suit];
      }
      last_suit = s;
    }
    text += RANK_CODES[getTileKindRank(k)];
  }
  if (last_suit !== null) {
    text += SUIT_CODES[last_suit];
  }
  return text;
}

function parseTileKindsMpsz(text) {
  const tileKinds = [];
  let suit = 0;
  for (let i = text.length; i--; ) {
    const ch = text[i];
    const s = SUIT_CODES.indexOf(ch);
    if (s >= 0) {
      suit = s;
    } else {
      let n = parseInt(ch);
      if (n >= 0) {
        tileKinds.push(getTileKind(suit, (n > 0 ? n : 5) - 1));
      }
    }
  }
  return tileKinds.reverse();
}

function formatTileKindsUnicode(tileKinds) {
  return tileKinds.map((k) => TILE_KIND_CHARS[k]).join('');
}

function parseTileKindsUnicode(text) {
  const tileKinds = [];
  for (const ch of text.split(/(?:)/u)) {
    const cp = ch.codePointAt(0) - 0x1f000;
    if (cp >= 0 && cp < TILE_KIND_COUNT) {
      const k = TILE_KINDS_CP_ORDER[cp];
      tileKinds.push(k);
    }
  }
  return tileKinds;
}

function getTileKindSortedIndices(tileKinds) {
  if (tileKinds.length % 3 === 2) {
    const sortedIndices = [...Array(tileKinds.length - 1).keys()].sort((a, b) => tileKinds[a] - tileKinds[b]);
    sortedIndices.push(tileKinds.length - 1);
    return sortedIndices;
  } else {
    return [...Array(tileKinds.length).keys()].sort((a, b) => tileKinds[a] - tileKinds[b]);
  }
}

on(window, 'DOMContentLoaded', async () => {
  await initWasm();
  const appId = 'zshanten';
  const app = document.getElementById(appId);
  app.classList.add('App');
  const viewStack = [];
  const availableTileKindSet = new Set();
  const availableTileKinds = [];

  function loadItem(key) {
    const item = localStorage.getItem(appId + '/' + key);
    return item ? JSON.parse(item) : null;
  }

  function saveItem(key, value) {
    localStorage.setItem(appId + '/' + key, JSON.stringify(value));
  }

  function pushView(view) {
    viewStack.push(view);
    view.update?.();
    app.replaceChildren(view.el);
  }

  function popView(view) {
    for (let i = viewStack.length; --i; ) {
      const v = viewStack.pop();
      if (v === view) {
        break;
      }
    }
    const v = viewStack[viewStack.length - 1];
    v.update?.();
    app.replaceChildren(v.el);
  }

  function solveShanten(concealedTileFrequencies, restTileFrequencies, goal) {
    const rds = getRankDistributions(concealedTileFrequencies);
    const wc = Math.floor(concealedTileFrequencies.reduce((n, f) => n + f, 0) / 3) * 3 + 2;
    const normalTileGap = solveNormalTileGap(...rds, wc);
    const normalNorm = getTileGapNorm(normalTileGap);
    let minNorm = normalNorm;
    let minTileGap = normalTileGap;
    let pairNorm = NORM_NONE;
    let pairTileGap = 0n;
    let orphanNorm = NORM_NONE;
    let orphanTileGap = 0n;
    if (wc === 14 && !goal) {
      pairTileGap = solvePairTileGap(...rds);
      pairNorm = getTileGapNorm(pairTileGap);
      if (pairNorm <= minNorm) {
        if (pairNorm < minNorm) {
          minNorm = pairNorm;
          minTileGap = 0n;
        }
        minTileGap |= pairTileGap;
      }
      orphanTileGap = solveOrphanTileGap(...rds);
      orphanNorm = getTileGapNorm(orphanTileGap);
      if (orphanNorm <= minNorm) {
        if (orphanNorm < minNorm) {
          minNorm = orphanNorm;
          minTileGap = 0n;
        }
        minTileGap |= orphanTileGap;
      }
    }
    const shanten = {
      min: minNorm - 1,
      normal: normalNorm - 1,
      pair: pairNorm - 1,
      orphan: orphanNorm - 1,
      tileKinds: [...Array(TILE_KIND_COUNT).keys()].reduce(
        (ks, k) => (hasTileGapTileKind(minTileGap, k) && ks.push(k), ks),
        [],
      ),
      tileKindMap: new Map(),
      tileCount: 0,
    };
    if (restTileFrequencies) {
      for (const k of shanten.tileKinds) {
        if (availableTileKindSet.has(k)) {
          const f = restTileFrequencies[k];
          shanten.tileKindMap.set(k, f);
          shanten.tileCount += f;
        }
      }
    }
    return shanten;
  }

  function getNextSolutions(concealedTileKinds, discardedTileKinds, nextDiscarding, goal) {
    const nextSolutions = [];
    const concealedTileFrequencies = getTileFrequencies(concealedTileKinds);
    const restTileFrequencies = getTileFrequencies(discardedTileKinds).map(
      (f, k) => FREQUENCY_MAX - concealedTileFrequencies[k] - f,
    );
    const nextTileKinds = nextDiscarding
      ? concealedTileFrequencies.reduce((ks, f, k) => (f && ks.push(k), ks), [])
      : [...availableTileKindSet].filter((k) => restTileFrequencies[k]);
    for (const nextTileKind of nextTileKinds) {
      const nextConcealedTileKinds = concealedTileKinds.slice();
      const nextDiscardedTileKinds = discardedTileKinds.slice();
      const nextRestTileFrequencies = restTileFrequencies.slice();
      if (nextDiscarding) {
        nextDiscardedTileKinds.push(
          nextConcealedTileKinds.splice(nextConcealedTileKinds.lastIndexOf(nextTileKind), 1)[0],
        );
      } else {
        nextConcealedTileKinds.push(nextTileKind);
        restTileFrequencies[nextTileKind]--;
      }
      const nextShanten = solveShanten(getTileFrequencies(nextConcealedTileKinds), nextRestTileFrequencies, goal);
      nextSolutions.push({
        nextTileKind,
        nextConcealedTileKinds,
        nextDiscardedTileKinds,
        nextShanten,
        nextTileKindCount: nextShanten.tileKindMap.size,
        nextTileCount: nextShanten.tileCount,
      });
    }
    nextSolutions.sort(
      (a, b) =>
        a.nextShanten.min - b.nextShanten.min ||
        b.nextTileCount - a.nextTileCount ||
        b.nextTileKindCount - a.nextTileKindCount ||
        a.nextTileKind - b.nextTileKind,
    );
    return nextSolutions;
  }

  async function copyToClipboard(text) {
    await navigator.clipboard.writeText(text);
    alert('コピーしました。\n' + text);
  }

  function createTileListItem(k, f = '') {
    return parseHtml(`<div class="TileKind${k}"><div>${f}</div></div>`);
  }

  class TileSelect {
    constructor(el, handler) {
      this.el = el;
      this.handler = handler;
      this.tileKinds = [];
      this.sortedIndices = [];
      this.selectedIndex = -1;
      this.buttons = [];
      for (let i = 0; i < CONCEALED_COUNT_MAX; i++) {
        const button = parseHtml('<button></button>');
        on(button, 'click', () => {
          this.handler.onTileSelectClick(this.sortedIndices[i]);
        });
        this.buttons.push(button);
      }
      this.el.replaceChildren(...this.buttons);
    }

    getSortedTileKinds() {
      return this.sortedIndices.map((i) => this.tileKinds[i]);
    }

    update() {
      this.sortedIndices = getTileKindSortedIndices(this.tileKinds);
      for (let i = 0; i < this.buttons.length; i++) {
        const button = this.buttons[i];
        if (i < this.sortedIndices.length) {
          button.hidden = false;
          const classList = button.classList;
          classList.remove(...classList);
          const tileKindIndex = this.sortedIndices[i];
          classList.add('TileKind' + this.tileKinds[tileKindIndex]);
          if (tileKindIndex === this.selectedIndex) {
            classList.add('Light');
          }
        } else {
          button.hidden = true;
        }
      }
    }
  }

  class TilePad {
    constructor(el, handler) {
      this.el = el;
      this.handler = handler;
      this.buttons = [];
      for (let k = 0; k < TILE_KIND_COUNT; k++) {
        const button = parseHtml(`<button class="TileKind${k}"></button>`);
        on(button, 'click', () => {
          handler.onTilePadClick(k);
        });
        this.buttons.push(button);
      }
      this.el.replaceChildren(...this.buttons);
    }

    getButton(k) {
      return this.buttons[k];
    }

    update() {
      for (let k = 0; k < TILE_KIND_COUNT; k++) {
        this.handler.onTilePadUpdate(k);
      }
    }
  }

  class ImportView {
    constructor() {
      this.el = parseHtml(`
        <div class="ImportView">
          <div class="AlignCenter">読み込み</div>
          <div class="TileList"></div>
          <textarea class="ImportOutput" placeholder="MPSZ / Unicode"></textarea>
          <div class="ToolBar">
            <button class="CloseButton">キャンセル</button>
            <button class="PasteButton">ペースト</button>
            <button class="SubmitButton">読み込み</button>
          </div>
        </div>`);
      this.tileList = this.el.querySelector('.TileList');
      this.importOutput = this.el.querySelector('.ImportOutput');
      this.submitButton = this.el.querySelector('.SubmitButton');
      this.tileKinds = [];

      on(this.el.querySelector('.CloseButton'), 'click', () => {
        popView(this);
      });

      on(this.importOutput, 'input', () => {
        this.update();
      });

      on(this.el.querySelector('.PasteButton'), 'click', async () => {
        setTextareaValue(this.importOutput, (await navigator.clipboard.readText()).trim());
        this.update();
      });

      on(this.submitButton, 'click', () => {
        if (this.canSubmit()) {
          this.callback(this.tileKinds);
          popView(this);
        }
      });
    }

    canSubmit() {
      return this.tileKinds.length > 0;
    }

    update() {
      this.tileKinds = parseTileKindsMpsz(this.importOutput.value);
      if (!this.tileKinds.length) {
        this.tileKinds = parseTileKindsUnicode(this.importOutput.value);
      }
      this.tileList.replaceChildren(...this.tileKinds.map((k) => createTileListItem(k)));
      this.submitButton.disabled = !this.canSubmit();
    }

    static instance = new ImportView();

    static show(callback) {
      ImportView.instance.callback = callback;
      pushView(ImportView.instance);
    }
  }

  class ExportView {
    constructor() {
      this.el = parseHtml(`
        <div class="ExportView">
          <div class="AlignCenter">書き出し</div>
          <div class="TileList"></div>
          <textarea class="ExportOutput"></textarea>
          <div class="ToolBar">
            <button class="CloseButton">閉じる</button>
            <select class="FormatSelect">
              <option>MPSZ</option>
              <option>Unicode</option>
            </select>
            <button class="CopyButton">コピー</button>
          </div>
        </div>`);
      this.tileList = this.el.querySelector('.TileList');
      this.exportOutput = this.el.querySelector('.ExportOutput');
      this.formatSelect = this.el.querySelector('.FormatSelect');
      this.tileKinds = [];

      on(this.el.querySelector('.CloseButton'), 'click', () => {
        popView(this);
      });

      on(this.formatSelect, 'change', () => {
        this.update();
      });

      on(this.el.querySelector('.CopyButton'), 'click', () => {
        copyToClipboard(this.exportOutput.value);
      });
    }

    setTileKinds(tileKinds) {
      this.tileKinds = tileKinds;
      this.tileList.replaceChildren(...this.tileKinds.map((k) => createTileListItem(k)));
    }

    update() {
      setTextareaValue(
        this.exportOutput,
        this.formatSelect.value === 'MPSZ'
          ? formatTileKindsMpsz(this.tileKinds)
          : formatTileKindsUnicode(this.tileKinds),
      );
    }

    static instance = new ExportView();

    static show(tileKinds) {
      ExportView.instance.setTileKinds(tileKinds);
      pushView(ExportView.instance);
    }
  }

  class AnalyzeView {
    constructor(concealedTileKinds, discardedTileKinds = []) {
      this.el = parseHtml(`
        <div class="AnalyzeView">
          <div class="TitleBar">
            <button class="CloseButton">閉じる</button>
            <div class="AlignCenter">解析</div>
            <select class="GoalSelect">
              <option value="0">総合</option>
              <option value="1" class="Modified">通常のみ *</option>
            </select>
          </div>
          <div class="TileSelectLabel AlignCenterLeft"></div>
          <div class="TileSelect"></div>
          <div class="AlignCenterLeft">捨牌:</div>
          <div class="DiscardedTileList TileList"></div>
          <div class="AcceptableTileListLabel AlignCenterLeft"></div>
          <div class="AcceptableTileList TileList"></div>
          <div class="SolutionRowBase SolutionHeader">
            <div class="AlignCenter"></div>
            <div class="AlignCenter">向</div>
            <div class="AlignCenter">種</div>
            <div class="AlignCenter">枚</div>
            <div class="AlignCenter">有効牌</div>
          </div>
          <div class="SolutionTable"></div>
          <div class="ToolBar">
            <button class="BackButton">戻る</button>
            <select class="ExportSelect">
              <option value="">書き出し</option>
              <option value="CONCEALED">手牌の書き出し</option>
              <option value="DISCARDED" class="DiscardedOption">捨牌の書き出し</option>
              <option value="ACCEPTABLE" class="AcceptableOption">有効牌の書き出し</option>
            </select>
          </div>
        </div>`);
      this.goalSelect = this.el.querySelector('.GoalSelect');
      this.tileSelectLabel = this.el.querySelector('.TileSelectLabel');
      this.tileSelect = new TileSelect(this.el.querySelector('.TileSelect'), this);
      this.discardedTileList = this.el.querySelector('.DiscardedTileList');
      this.acceptableTileListLabel = this.el.querySelector('.AcceptableTileListLabel');
      this.acceptableTileList = this.el.querySelector('.AcceptableTileList');
      this.solutionHeader = this.el.querySelector('.SolutionHeader');
      this.solutionTable = this.el.querySelector('.SolutionTable');
      this.backButton = this.el.querySelector('.BackButton');
      this.exportSelect = this.el.querySelector('.ExportSelect');
      this.discardedOption = this.el.querySelector('.DiscardedOption');
      this.acceptableOption = this.el.querySelector('.AcceptableOption');
      this.pageStack = [];
      this.pushPage(concealedTileKinds, discardedTileKinds);

      on(this.el.querySelector('.CloseButton'), 'click', () => {
        this.close();
      });

      on(this.goalSelect, 'change', () => {
        const goal = parseInt(this.goalSelect.value);
        for (const page of this.pageStack) {
          if (page.goal !== goal) {
            page.shanten = null;
            page.nextSolutions = null;
          }
        }
        this.update();
      });

      on(this.backButton, 'click', () => {
        if (this.canBack()) {
          this.pageStack.length--;
          this.update();
        } else {
          this.close();
        }
      });

      on(this.exportSelect, 'change', () => {
        if (this.exportSelect.value) {
          const page = this.getCurrentPage();
          ExportView.show(
            this.exportSelect.value === 'DISCARDED'
              ? page.discardedTileKinds
              : this.exportSelect.value === 'ACCEPTABLE'
                ? [...page.shanten.tileKindMap.keys()]
                : this.tileSelect.getSortedTileKinds(),
          );
          this.exportSelect.value = '';
        }
      });
    }

    close() {
      popView(this);
    }

    getCurrentPage() {
      return this.pageStack[this.pageStack.length - 1];
    }

    pushPage(concealedTileKinds, discardedTileKinds) {
      this.pageStack.push({ concealedTileKinds, discardedTileKinds });
    }

    canBack() {
      return this.pageStack.length > 1;
    }

    formatShantenValue(v) {
      return v >= 14 ? '無し' : v > 0 ? v + '向聴' : v < 0 ? '和了' : '聴牌';
    }

    formatShantenValueShort(v) {
      return v >= 14 ? '無' : v > 0 ? '' + v : v < 0 ? '和' : '聴';
    }

    update() {
      const page = this.getCurrentPage();
      const concealedTileFrequencies = getTileFrequencies(page.concealedTileKinds);
      const restTileFrequencies = getTileFrequencies(page.discardedTileKinds).map(
        (f, k) => FREQUENCY_MAX - f - concealedTileFrequencies[k],
      );
      page.goal = parseInt(this.goalSelect.value);
      if (!page.shanten) {
        page.shanten = solveShanten(concealedTileFrequencies, restTileFrequencies, page.goal);
      }
      this.tileSelectLabel.textContent = '手牌: ' + this.formatShantenValue(page.shanten.min);
      this.goalSelect.disabled = page.concealedTileKinds.length < 13;
      if (!this.goalSelect.disabled) {
        this.tileSelectLabel.textContent +=
          ' (通常: ' +
          this.formatShantenValueShort(page.shanten.normal) +
          ', 七対: ' +
          this.formatShantenValueShort(page.shanten.pair) +
          ', 国士: ' +
          this.formatShantenValueShort(page.shanten.orphan) +
          ')';
      }
      this.tileSelect.tileKinds = page.concealedTileKinds;
      this.tileSelect.update();
      this.discardedTileList.replaceChildren(...page.discardedTileKinds.map((k) => createTileListItem(k)));
      this.discardedOption.disabled = !page.discardedTileKinds.length;
      this.acceptableTileListLabel.textContent =
        '有効牌: ' + page.shanten.tileKindMap.size + '種' + page.shanten.tileCount + '枚';
      this.acceptableTileList.replaceChildren(
        ...[...page.shanten.tileKindMap.entries()].map(([k, f]) => createTileListItem(k, f)),
      );
      this.acceptableOption.disabled = !page.shanten.tileKindMap.size;

      let nextDiscarding, targetShantenMin;
      switch (page.concealedTileKinds.length % 3) {
        case 1:
          nextDiscarding = false;
          targetShantenMin = page.shanten.min - 1;
          break;
        case 2:
          nextDiscarding = true;
          targetShantenMin = page.shanten.min;
          break;
        default:
          return;
      }
      this.solutionHeader.children[0].textContent = nextDiscarding ? '打' : '摸';
      if (!page.nextSolutions) {
        page.nextSolutions = getNextSolutions(
          page.concealedTileKinds,
          page.discardedTileKinds,
          nextDiscarding,
          page.goal,
        );
      }
      const bestSolution = page.nextSolutions[0];
      const solutionRows = page.nextSolutions.map((nextSolution) => {
        const solutionRow = parseHtml(`
          <div class="SolutionRowBase SolutionRow">
            <div class="AlignCenter">
              <button class="TileKind${nextSolution.nextTileKind}"></button>
            </div>
            <div class="AlignCenter"></div>
            <div class="AlignCenter"></div>
            <div class="AlignCenter"></div>
            <div class="TileList"></div>
          </div>`);
        const button = solutionRow.children[0].children[0];
        on(button, 'click', () => {
          this.pushPage(nextSolution.nextConcealedTileKinds, nextSolution.nextDiscardedTileKinds);
          this.update();
        });
        solutionRow.children[1].textContent = this.formatShantenValueShort(nextSolution.nextShanten.min);
        solutionRow.children[2].textContent = nextSolution.nextTileKindCount;
        solutionRow.children[3].textContent = nextSolution.nextTileCount;
        solutionRow.children[4].replaceChildren(
          ...[...nextSolution.nextShanten.tileKindMap.entries()].map(([k, f]) => createTileListItem(k, f)),
        );
        if (nextSolution.nextShanten.min === targetShantenMin) {
          if (nextSolution.nextTileCount === bestSolution.nextTileCount) {
            solutionRow.classList.add('Light');
          }
        } else {
          solutionRow.classList.add('Dark');
        }
        return solutionRow;
      });
      this.solutionTable.replaceChildren(...solutionRows);
      this.solutionTable.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }

    onTileSelectClick(i) {
      const page = this.getCurrentPage();
      if (page.concealedTileKinds.length % 3 === 2) {
        const concealedTileKinds = page.concealedTileKinds.slice();
        const discardedTileKinds = page.discardedTileKinds.slice();
        discardedTileKinds.push(concealedTileKinds.splice(i, 1)[0]);
        this.pushPage(concealedTileKinds, discardedTileKinds);
        this.update();
      }
    }
  }

  class PracticeView {
    constructor(concealedTileKinds, restCount) {
      this.el = parseHtml(`
        <div class="PracticeView">
          <div class="TitleBar">
            <button class="CloseButton">閉じる</button>
            <div class="AlignCenter">練習</div>
            <button class="RetryButton">リトライ</button>
          </div>
          <div class="StateOutput AlignCenter"></div>
          <div class="TileSelectLabel AlignCenterLeft"></div>
          <div class="TileSelect"></div>
          <div class="TileListLabel AlignCenterLeft"></div>
          <div class="TileList"></div>
          <div class="TilePad"></div>
          <div class="ToolBar">
            <button class="BackButton">戻る</button>
            <button class="DiscardButton"></button>
            <button class="AnalyzeButton">解析</button>
          </div>
        </div>`);
      this.stateOutput = this.el.querySelector('.StateOutput');
      this.tileSelectLabel = this.el.querySelector('.TileSelectLabel');
      this.tileSelect = new TileSelect(this.el.querySelector('.TileSelect'), this);
      this.tileListLabel = this.el.querySelector('.TileListLabel');
      this.tileList = this.el.querySelector('.TileList');
      this.tilePad = new TilePad(this.el.querySelector('.TilePad'), this);
      this.backButton = this.el.querySelector('.BackButton');
      this.discardButton = this.el.querySelector('.DiscardButton');
      this.stockTileKinds = shuffle(
        concealedTileKinds.reduce(
          (tileKinds, k) => (tileKinds.splice(tileKinds.indexOf(k), 1), tileKinds),
          availableTileKinds.slice(),
        ),
      );
      this.pageStack = [];
      let stockIndex = 2 - (concealedTileKinds.length % 3);
      if (stockIndex <= this.stockTileKinds.length) {
        concealedTileKinds = concealedTileKinds.slice();
        concealedTileKinds.push(...this.stockTileKinds.slice(0, stockIndex));
      }
      this.pushPage(
        concealedTileKinds,
        [],
        stockIndex,
        Math.min(restCount, 1 + this.stockTileKinds.length - stockIndex),
      );

      on(this.el.querySelector('.CloseButton'), 'click', () => {
        this.close();
      });

      on(this.el.querySelector('.RetryButton'), 'click', () => {
        this.pageStack.length = 1;
        this.getCurrentPage().discardedIndex = -1;
        this.update();
      });

      on(this.backButton, 'click', () => {
        if (this.canBack()) {
          this.pageStack.length--;
          this.update();
        } else {
          this.close();
        }
      });

      on(this.discardButton, 'click', () => {
        if (this.canDiscard()) {
          const page = this.getCurrentPage();
          if (page.discardedIndex < 0) {
            page.discardedIndex = page.concealedTileKinds.length - 1;
            this.update();
          } else {
            this.discard();
          }
        }
      });

      on(this.el.querySelector('.AnalyzeButton'), 'click', () => {
        const page = this.getCurrentPage();
        pushView(new AnalyzeView(page.concealedTileKinds, page.discardedTileKinds));
      });
    }

    close() {
      popView(this);
    }

    getCurrentPage() {
      return this.pageStack[this.pageStack.length - 1];
    }

    pushPage(concealedTileKinds, discardedTileKinds, stockIndex, restCount) {
      this.pageStack.push({
        concealedTileKinds,
        discardedTileKinds,
        stockIndex,
        restCount,
        bestTileKindSet: new Set(),
        discardedIndex: -1,
      });
    }

    canBack() {
      return this.pageStack.length > 1;
    }

    canDiscard() {
      return this.getCurrentPage().concealedTileKinds.length % 3 === 2;
    }

    discard() {
      const page = this.getCurrentPage();
      const concealedTileKinds = page.concealedTileKinds.slice();
      const discardedTileKinds = page.discardedTileKinds.slice();
      discardedTileKinds.push(concealedTileKinds.splice(page.discardedIndex, 1)[0]);
      let stockIndex = page.stockIndex;
      if (page.restCount > 1) {
        concealedTileKinds.push(this.stockTileKinds[stockIndex++]);
      }
      this.pushPage(concealedTileKinds, discardedTileKinds, stockIndex, page.restCount - 1);
      this.update();
    }

    select(i) {
      const page = this.getCurrentPage();
      if (i === page.discardedIndex) {
        this.discard();
      } else {
        page.discardedIndex = i;
        this.update();
      }
    }

    update() {
      const page = this.getCurrentPage();
      this.stateOutput.classList.remove('Dark', 'Light', 'Bright');
      if (!this.canDiscard()) {
        this.stateOutput.textContent = '流局';
        this.stateOutput.classList.add('Dark');
      } else {
        if (!page.bestTileKindSet.size) {
          const solutions = getNextSolutions(page.concealedTileKinds, page.discardedTileKinds, true);
          const bestSolution = solutions[0];
          for (const solution of solutions) {
            if (
              solution.nextShanten.min === bestSolution.nextShanten.min &&
              solution.nextTileCount === bestSolution.nextTileCount
            ) {
              page.bestTileKindSet.add(solution.nextTileKind);
            }
          }
        }
        if (page.discardedIndex >= 0) {
          if (page.bestTileKindSet.has(page.concealedTileKinds[page.discardedIndex])) {
            this.stateOutput.textContent = '正解';
            this.stateOutput.classList.add('Light');
          } else {
            this.stateOutput.textContent = '不正解';
            this.stateOutput.classList.add('Dark');
          }
        } else {
          if (!page.shanten) {
            page.shanten = solveShanten(getTileFrequencies(page.concealedTileKinds));
          }
          if (page.shanten.min < 0) {
            this.stateOutput.textContent = '和了';
            this.stateOutput.classList.add('Bright');
          } else {
            this.stateOutput.textContent = '打牌を選択';
          }
        }
      }
      this.tileSelectLabel.textContent = `手牌: 残り${page.restCount}回`;
      this.tileSelect.tileKinds = page.concealedTileKinds;
      this.tileSelect.selectedIndex = page.discardedIndex;
      this.tileSelect.update();
      this.tileListLabel.textContent = `捨牌: ${page.discardedTileKinds.length}枚`;
      this.tileList.replaceChildren(...page.discardedTileKinds.map((k) => createTileListItem(k)));
      this.tilePad.update();
      this.discardButton.textContent = page.discardedIndex >= 0 ? '打牌' : 'ツモ切り';
      this.discardButton.disabled = !this.canDiscard();
    }

    onTilePadUpdate(k) {
      this.tilePad.getButton(k).disabled = !this.canDiscard() || !this.getCurrentPage().concealedTileKinds.includes(k);
    }

    onTilePadClick(k) {
      if (this.canDiscard()) {
        const i = this.getCurrentPage().concealedTileKinds.lastIndexOf(k);
        if (i >= 0) {
          this.select(i);
        }
      }
    }

    onTileSelectClick(i) {
      if (this.canDiscard()) {
        this.select(i);
      }
    }
  }

  class MainView {
    constructor() {
      this.el = parseHtml(`
        <div class="MainView">
          <div class="TitleBar">
            <select class="MenuSelect">
              <option value="">メニュー</option>
              <option value="HOME">ホーム</option>
              <option value="IMPORT">手牌の読み込み</option>
              <option value="EXPORT" class="ExportOption">手牌の書き出し</option>
              <option value="VERSION" class="VersionOption">バージョン情報</option>
            </select>
            <div class="TitleOutput AlignCenter">${document.title}</div>
            <button class="ReloadButton">リロード</button>
          </div>
          <div class="TileSelectLabel AlignCenterLeft"></div>
          <div class="TileSelect"></div>
          <div class="ToolBar">
            <select class="RandomSelect"></select>
            <button class="RandomButton">乱択</button>
            <button class="ClearButton">全消去</button>
            <button class="RemoveButton">削除</button>
          </div>
          <div class="TilePad"></div>
          <div class="ToolBar">
            <select class="AvailableSelect">
              <option value="0,1,2,3,4,5,6,7,8">萬: 全て</option>
              <option value="0,8" class="Modified">萬: 19のみ *</option>
              <option value="" class="Modified">萬: 無し *</option>
            </select>
            <select class="AvailableSelect">
              <option value="9,10,11,12,13,14,15,16,17">筒: 全て</option>
              <option value="9,17" class="Modified">筒: 19のみ *</option>
              <option value="" class="Modified">筒: 無し *</option>
            </select>
            <select class="AvailableSelect">
              <option value="18,19,20,21,22,23,24,25,26">索: 全て</option>
              <option value="18,26" class="Modified">索: 19のみ *</option>
              <option value="" class="Modified">索: 無し *</option>
            </select>
            <select class="AvailableSelect">
              <option value="27,28,29,30,31,32,33">字: 全て</option>
              <option value="27,28,29,30" class="Modified">字: 風のみ *</option>
              <option value="31,32,33" class="Modified">字: 三元のみ *</option>
              <option value="" class="Modified">字: 無し *</option>
            </select>
          </div>
          <div class="ToolBar">
            <select class="RestSelect"></select>
            <button class="PracticeButton">練習</button>
            <button class="AnalyzeButton">解析</button>
          </div>
        </div>`);
      this.menuSelect = this.el.querySelector('.MenuSelect');
      this.exportOption = this.el.querySelector('.ExportOption');
      this.tileSelectLabel = this.el.querySelector('.TileSelectLabel');
      this.tileSelect = new TileSelect(this.el.querySelector('.TileSelect'), this);
      this.randomSelect = this.el.querySelector('.RandomSelect');
      this.randomSelect.replaceChildren(
        ...[...Array(CONCEALED_COUNT_MAX).keys()].map((i) => {
          const v = i + 1;
          const option = parseHtml(`<option value="${v}">${v}枚</option>`);
          if (v !== 14) {
            option.classList.add('Modified');
            option.textContent += ' *';
          }
          return option;
        }),
      );
      setSelectValue(this.randomSelect, loadItem('randomSelect'), 14);
      this.randomButton = this.el.querySelector('.RandomButton');
      this.clearButton = this.el.querySelector('.ClearButton');
      this.removeButton = this.el.querySelector('.RemoveButton');
      this.tilePad = new TilePad(this.el.querySelector('.TilePad'), this);
      this.availableSelects = [...this.el.querySelectorAll('.AvailableSelect')];
      this.restSelect = this.el.querySelector('.RestSelect');
      this.restSelect.replaceChildren(
        ...[...Array(34).keys()].map((i) => {
          const v = i + 1;
          const option = parseHtml(`<option value="${v}">${v}回</option>`);
          if (v !== 18) {
            option.classList.add('Modified');
            option.textContent += ' *';
          }
          return option;
        }),
      );
      setSelectValue(this.restSelect, loadItem('restSelect'), 18);
      this.practiceButton = this.el.querySelector('.PracticeButton');
      this.analyzeButton = this.el.querySelector('.AnalyzeButton');
      this.concealedTileKinds = [];
      this.concealedTileFrequencies = Array(TILE_KIND_COUNT).fill(0);

      on(this.menuSelect, 'change', () => {
        if (this.menuSelect.value === 'HOME') {
          location.href = './';
        } else if (this.menuSelect.value === 'IMPORT') {
          ImportView.show((tileKinds) => {
            tileKinds = tileKinds.slice();
            let i = 0;
            const availableTileFrequencies = getTileFrequencies(availableTileKinds);
            for (const k of tileKinds) {
              if (availableTileFrequencies[k]) {
                availableTileFrequencies[k]--;
                tileKinds[i++] = k;
                if (i >= CONCEALED_COUNT_MAX) {
                  break;
                }
              }
            }
            tileKinds.length = i;
            this.concealedTileKinds = tileKinds;
            this.update();
          });
        } else if (this.menuSelect.value === 'EXPORT') {
          ExportView.show(this.tileSelect.getSortedTileKinds());
        } else if (this.menuSelect.value === 'VERSION') {
          alert(`${document.title} ${__APP_VERSION__}`);
        }
        this.menuSelect.selectedIndex = 0;
      });

      on(this.el.querySelector('.ReloadButton'), 'click', () => {
        location.reload();
      });

      on(this.randomSelect, 'change', () => {
        saveItem('randomSelect', this.randomSelect.value);
      });

      on(this.randomButton, 'click', () => {
        if (availableTileKindSet.size) {
          this.concealedTileKinds = toSampled(availableTileKinds, parseInt(this.randomSelect.value)).sort(
            (a, b) => a - b,
          );
          this.update();
        }
      });

      on(this.clearButton, 'click', () => {
        if (this.canRemove()) {
          this.clear();
        }
      });

      on(this.removeButton, 'click', () => {
        if (this.canRemove()) {
          this.concealedTileKinds.length--;
          this.update();
        }
      });

      for (let i = 0; i < this.availableSelects.length; i++) {
        const availableSelect = this.availableSelects[i];
        const key = 'availableSelect' + i;
        setSelectValue(availableSelect, loadItem(key));
        on(availableSelect, 'change', () => {
          saveItem(key, availableSelect.value);
          availableTileKindSet.clear();
          this.update();
        });
      }

      on(this.restSelect, 'change', () => {
        saveItem('restSelect', this.restSelect.value);
      });

      on(this.practiceButton, 'click', () => {
        if (this.canAnalyze()) {
          pushView(new PracticeView(this.concealedTileKinds, parseInt(this.restSelect.value)));
        }
      });

      on(this.analyzeButton, 'click', () => {
        if (this.canAnalyze()) {
          pushView(new AnalyzeView(this.concealedTileKinds));
        }
      });
    }

    canRemove(i = 0) {
      return i < this.concealedTileKinds.length;
    }

    clear() {
      this.concealedTileKinds.length = 0;
      this.update();
    }

    canAnalyze() {
      return this.canRemove() && this.concealedTileKinds.length % 3 !== 0;
    }

    canAppend(k) {
      return (
        availableTileKindSet.has(k) &&
        this.concealedTileKinds.length < CONCEALED_COUNT_MAX &&
        this.concealedTileFrequencies[k] < FREQUENCY_MAX
      );
    }

    update() {
      if (!availableTileKindSet.size) {
        availableTileKinds.length = 0;
        for (const availableSelect of this.availableSelects) {
          if (availableSelect.value) {
            for (const v of availableSelect.value.split(',')) {
              const k = parseInt(v);
              availableTileKindSet.add(k);
              availableTileKinds.push(k, k, k, k);
            }
          }
        }
        this.concealedTileKinds = this.concealedTileKinds.filter((k) => availableTileKindSet.has(k));
      }
      this.concealedTileFrequencies = getTileFrequencies(this.concealedTileKinds);
      this.tileSelectLabel.textContent = '手牌: ' + this.concealedTileKinds.length + '枚';
      this.tileSelect.tileKinds = this.concealedTileKinds;
      this.tileSelect.selectedIndex = this.concealedTileKinds.length - 1;
      this.tileSelect.update();
      this.tilePad.update();
      this.clearButton.disabled = this.removeButton.disabled = this.exportOption.disabled = !this.canRemove();
      this.practiceButton.disabled = this.analyzeButton.disabled = !this.canAnalyze();
    }

    onTilePadUpdate(k) {
      this.tilePad.getButton(k).disabled = !this.canAppend(k);
    }

    onTilePadClick(k) {
      if (this.canAppend(k)) {
        this.concealedTileKinds.push(k);
        this.update();
      }
    }

    onTileSelectClick(i) {
      if (this.canRemove(i)) {
        this.concealedTileKinds.splice(i, 1);
        this.update();
      }
    }
  }

  pushView(new MainView());
});
