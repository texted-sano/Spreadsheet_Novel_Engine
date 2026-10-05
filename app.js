/* ======================================================================
 * Settings & Global Variables
 * ====================================================================== */
const ENGINE_INFO = { version: '1.1.0', dataFormatVersion: 1, build: '' };

const settings = { 
  textSpeed: 40, autoDelay: 1000, bgmVolume: 0.1, seVolume: 0.5, voiceVolume: 0.8, sysSeVolume: 0.3,
  titleBgm: '', seStart: '', seClick: '', fontChapter: '', chapterColor: '', chapterOutline: '', ttsApiUrl: 'http://127.0.0.1:50021',
  choiceBg: '', choiceFont: '', choiceColor: '', choiceSize: '', choiceOutline: '', choicePos: '', choiceBgPos: '',
  dialogFontSize: '', reflectionSheet: true, rubyGrade: 8
};

const USER_SETTINGS = { 
  gasWebAppUrl: (window.GAME_SETTINGS && typeof window.GAME_SETTINGS.gasWebAppUrl === 'string') ? window.GAME_SETTINGS.gasWebAppUrl : ''
};

let SCENARIO = [ { cmd: 'config', name: 'title_text', text: 'NOVEL GAME' }, { cmd: 'end' } ];
let CONFIG = [];
let GAME_ID = '';
/* 複数のゲームを同一オリジン（同じドメイン）の別フォルダに設置した場合でも、
   localStorageのセーブデータ・フラグ・設定が他のゲームと混ざらないようにするための接頭辞付与。
   CONFIGにgame_idが設定されていない場合は従来通りのキー名のまま動作する（後方互換）。 */
function lsKey(name) { return GAME_ID ? `${GAME_ID}_${name}` : name; }
window.app = null;

/* 画像・音声・ミニゲームの相対パス（"images/foo.png"等）を解決する共通フック。
   通常はそのまま同じパスを返すだけだが、シナリオエディタの「自己完結HTMLとして出力」
   機能でビルドされたファイルでは、ビルド時にwindow.__ASSET_OVERRIDE__へ
   { "images/foo.png": "data:image/png;base64,..." } のようなマッピングが注入される。
   その場合はBase64データURLの方を返すことで、外部ファイルへのアクセスなしに動作する。
   シナリオ・CONFIGの両方のパス構築箇所から、必ずこの関数を経由するようにしている。 */
function resolveAssetPath(rawPath) {
  if (!rawPath) return rawPath;
  if (window.__ASSET_OVERRIDE__) {
    if (window.__ASSET_OVERRIDE__[rawPath]) return window.__ASSET_OVERRIDE__[rawPath];
    const encoded = encodeURI(rawPath);
    if (window.__ASSET_OVERRIDE__[encoded]) return window.__ASSET_OVERRIDE__[encoded];
  }
  return rawPath;
}

/* シナリオエディタの「自己完結HTMLとして出力」機能で、シナリオ・CONFIGデータを簡易的に
   難読化（固定キーによるXOR + Base64）して埋め込んだ場合に使うデコード関数。本格的な暗号
   ではなく、HTMLファイルを直接開いてテキスト検索される程度のカジュアルな解析を防ぐことを
   目的にしている。通常配布（難読化していない場合）は使われない。 */
function __decodeGameData__(encoded) {
  const key = 'novelgame-studio-2026';
  const xored = atob(encoded);
  let utf8Bytes = '';
  for (let i = 0; i < xored.length; i++) {
    utf8Bytes += String.fromCharCode(xored.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return decodeURIComponent(escape(utf8Bytes));
}

/* ======================================================================
 * Class: DataLoader
 * JSONデータの取得やゲーム設定の動的反映を行う
 * ====================================================================== */
class DataLoader {
  async loadGasData(url) {
    if (!url) return { scenario: [], config: [] };
    try { 
      const res = await fetch(url); 
      const raw = await res.json(); 
      if (Array.isArray(raw)) return { scenario: this._parseData(raw), config: [] };
      return { 
        scenario: raw.scenario ? this._parseData(raw.scenario) : [], 
        config: raw.config ? this._parseData(raw.config) : [] 
      };
    } catch (e) { 
      console.error(`シナリオデータの取得に失敗しました url=${url}`, e);
      this._showLoadError('シナリオデータの取得に失敗しました。通信環境を確認するか、配布元にお問い合わせください。');
      return { scenario: [], config: [], error: true }; 
    }
  }

  _showLoadError(message) {
    const overlay = document.getElementById('loading-overlay');
    if (!overlay) return;
    overlay.classList.add('load-error');
    overlay.innerHTML = `<div class="load-error-box">${message}</div>`;
  }

  _parseData(rawArray) {
    if (!rawArray || !Array.isArray(rawArray)) return [];
    return rawArray.map(r => {
      const s = {};
      for (const k in r) { 
        if (r[k] !== '') { 
          s[k] = (k === 'duration') ? parseInt(r[k]) : ((k === 'text' || k === 'text_rubi') && typeof r[k] === 'string') ? r[k].replace(/\\n/g,'\n') : r[k]; 
        }
      }
      return s;
    });
  }

  getRGBFromColor(color) {
    const cvs = document.createElement('canvas'); 
    cvs.width = 1; cvs.height = 1; 
    const ctx = cvs.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1);
    const data = ctx.getImageData(0, 0, 1, 1).data; 
    return { r: data[0], g: data[1], b: data[2], rgbStr: `${data[0]}, ${data[1]}, ${data[2]}` };
  }

  applyColors(colorStr) {
    const rgb = this.getRGBFromColor(colorStr); 
    const root = document.documentElement;
    root.style.setProperty('--main-color', colorStr); 
    root.style.setProperty('--main-color-rgb', rgb.rgbStr);
    
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;

    if (luminance < 0.1) {
      root.style.setProperty('--panel-bg', `rgba(0, 0, 0, 0.85)`); root.style.setProperty('--panel-border', `#ffffff`);
      root.style.setProperty('--btn-bg', `rgba(0, 0, 0, 0.7)`); root.style.setProperty('--btn-border', `#ffffff`); 
      root.style.setProperty('--btn-text', `#ffffff`); root.style.setProperty('--btn-bg-hover', `rgba(255, 255, 255, 0.2)`); 
      root.style.setProperty('--btn-text-hover', `#ffffff`);
      root.style.setProperty('--slot-bg', `rgba(0, 0, 0, 0.7)`); root.style.setProperty('--slot-border', `#ffffff`); 
      root.style.setProperty('--slot-bg-hover', `rgba(255, 255, 255, 0.15)`); root.style.setProperty('--slot-border-hover', `#ffffff`); 
      root.style.setProperty('--slot-text', `#ffffff`);
      
      root.style.setProperty('--ui-text-main', `#ffffff`); root.style.setProperty('--ui-text-dim', `#aaaaaa`); 
      
      root.style.setProperty('--slider-track', `rgba(255, 255, 255, 0.4)`);
      root.style.setProperty('--slider-thumb-border', `2px solid #ffffff`);
      root.style.setProperty('--text-outline', `none`);
      root.style.setProperty('--title-shadow', `0 0 10px rgba(255, 255, 255, 0.3)`); root.style.setProperty('--title-btn-bg', `rgba(0, 0, 0, 0.8)`); 
      root.style.setProperty('--title-btn-border', `#ffffff`); root.style.setProperty('--title-btn-text', `#ffffff`); 
      root.style.setProperty('--game-btn-bg', `rgba(0, 0, 0, 0.7)`); root.style.setProperty('--game-btn-border', `#ffffff`); 
      root.style.setProperty('--game-btn-text', `#ffffff`);
    } else if (luminance > 0.9) {
      root.style.setProperty('--panel-bg', `rgba(255, 255, 255, 0.85)`); root.style.setProperty('--panel-border', `#000000`);
      root.style.setProperty('--btn-bg', `rgba(255, 255, 255, 0.7)`); root.style.setProperty('--btn-border', `#000000`); 
      root.style.setProperty('--btn-text', `#000000`); root.style.setProperty('--btn-bg-hover', `rgba(0, 0, 0, 0.1)`); 
      root.style.setProperty('--btn-text-hover', `#000000`);
      root.style.setProperty('--slot-bg', `rgba(255, 255, 255, 0.7)`); root.style.setProperty('--slot-border', `#000000`); 
      root.style.setProperty('--slot-bg-hover', `rgba(0, 0, 0, 0.15)`); root.style.setProperty('--slot-border-hover', `#000000`); 
      root.style.setProperty('--slot-text', `#000000`);
      
      root.style.setProperty('--ui-text-main', `#000000`); root.style.setProperty('--ui-text-dim', `#444444`); 
      
      root.style.setProperty('--slider-track', `rgba(0, 0, 0, 0.2)`);
      root.style.setProperty('--slider-thumb-border', `2px solid #000000`);
      root.style.setProperty('--text-outline', `none`);
      root.style.setProperty('--title-shadow', `0 0 10px rgba(0, 0, 0, 0.3)`); root.style.setProperty('--title-btn-bg', `rgba(255, 255, 255, 0.95)`); 
      root.style.setProperty('--title-btn-border', `#000000`); root.style.setProperty('--title-btn-text', `#000000`); 
      root.style.setProperty('--game-btn-bg', `rgba(255, 255, 255, 0.7)`); root.style.setProperty('--game-btn-border', `#000000`); 
      root.style.setProperty('--game-btn-text', `#000000`);
    } else {
      root.style.setProperty('--panel-bg', `rgba(255, 255, 255, 0.85)`); root.style.setProperty('--panel-border', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`);
      root.style.setProperty('--btn-bg', `rgba(255, 255, 255, 0.7)`); root.style.setProperty('--btn-border', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`);
      
      root.style.setProperty('--btn-text', colorStr); root.style.setProperty('--ui-text-main', colorStr); 
      root.style.setProperty('--ui-text-dim', colorStr); 
      
      root.style.setProperty('--btn-bg-hover', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`); root.style.setProperty('--btn-text-hover', colorStr);
      root.style.setProperty('--slot-bg', `rgba(255, 255, 255, 0.7)`); root.style.setProperty('--slot-border', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`);
      root.style.setProperty('--slot-bg-hover', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`); root.style.setProperty('--slot-border-hover', colorStr); 
      root.style.setProperty('--slot-text', colorStr);
      root.style.setProperty('--slider-track', `rgba(0, 0, 0, 0.1)`); 
      root.style.setProperty('--slider-thumb-border', `none`);
      root.style.setProperty('--text-outline', `none`); 
      root.style.setProperty('--title-shadow', `0 0 10px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`);
      root.style.setProperty('--title-btn-bg', `rgba(255, 255, 255, 0.95)`); root.style.setProperty('--title-btn-border', colorStr); 
      root.style.setProperty('--title-btn-text', colorStr);
      root.style.setProperty('--game-btn-bg', `rgba(255, 255, 255, 0.7)`); root.style.setProperty('--game-btn-border', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`); 
      root.style.setProperty('--game-btn-text', colorStr);
    }
    root.style.setProperty('--main-auto-save', colorStr);
  }

  /* panel_themeのcolor/color2/color3から、システム系ポップアップ（SYSTEM・セーブ/ロード・ログ・
     キャラセレクト）だけの配色を上書きする。main_colorやゲーム全体の配色には影響しない。
     - bgColor  (color)  : モーダル本体・ボタン・スロットの背景色
     - textColor(color2) : タイトル・ラベル・本文の文字色
     - accentColor(color3): 枠線、テーマ装飾（ブラケット・グロー・下線バー等）の色
     未指定の色はnullを渡すことでmain_color基準のデフォルトに戻る。 */
  applyPanelOverrides(bgColor, textColor, accentColor) {
    const root = document.documentElement;
    const set = (name, val) => { if (val) root.style.setProperty(name, val); else root.style.removeProperty(name); };

    if (bgColor) {
      const rgb = this.getRGBFromColor(bgColor);
      set('--panel-bg-ovr', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.85)`);
      set('--panel-btn-bg-ovr', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`);
      set('--panel-btn-bg-hover-ovr', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.75)`);
    } else {
      set('--panel-bg-ovr', null); set('--panel-btn-bg-ovr', null); set('--panel-btn-bg-hover-ovr', null);
    }

    if (textColor) {
      const rgb = this.getRGBFromColor(textColor);
      set('--panel-text-ovr', textColor);
      set('--panel-text-dim-ovr', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.65)`);
    } else {
      set('--panel-text-ovr', null); set('--panel-text-dim-ovr', null);
    }

    if (accentColor) {
      const rgb = this.getRGBFromColor(accentColor);
      set('--panel-accent-ovr', accentColor);
      set('--panel-accent-ovr-rgb', rgb.rgbStr);
    } else {
      set('--panel-accent-ovr', null); set('--panel-accent-ovr-rgb', null);
    }
  }
  
  applyPos(el, posStr, defParams, useTransform, preserveSize = false) {
    const str = String(posStr || '').toLowerCase();
    
    if (!preserveSize) { el.style.top = 'auto'; el.style.bottom = 'auto'; el.style.left = 'auto'; el.style.right = 'auto'; }
    
    let tx = '0', ty = '0';
    const getVal = (key) => { const match = str.match(new RegExp(`${key}:\\s*([\\d.\\-]+)`)); return match ? match[1] + '%' : null; };
    const hasWord = (word) => new RegExp(`\\b${word}\\b`).test(str);
    let topV = getVal('top'); let botV = getVal('bottom'); let leftV = getVal('left'); let rightV = getVal('right');
    let widthV = getVal('width'); let heightV = getVal('height');

    if (!leftV && !rightV && !hasWord('center')) {
      leftV = '50%';
      tx = '-50%';
    } else if (hasWord('center')) { 
      if (!leftV && !rightV) leftV = '50%'; 
      tx = '-50%'; }
    
    if (hasWord('middle')) { if (!topV && !botV) topV = '50%'; ty = '-50%'; }
    if (hasWord('top') && !topV && !botV && !hasWord('middle')) topV = '0%';
    if (hasWord('bottom') && !topV && !botV && !hasWord('middle')) botV = '0%';
    if (hasWord('left') && !leftV && !rightV && !hasWord('center')) leftV = '0%';
    if (hasWord('right') && !leftV && !rightV && !hasWord('center')) rightV = '0%';

    if (!topV && !botV && !hasWord('middle')) { if (defParams.top !== null) topV = defParams.top; else if (defParams.bottom !== null) botV = defParams.bottom; }
    if (!leftV && !rightV && !hasWord('center')) { if (defParams.left !== null) leftV = defParams.left; else if (defParams.right !== null) rightV = defParams.right; }

    if (topV === '50%') ty = '-50%';
    if (leftV === '50%') tx = '-50%';

    if (topV !== null) { el.style.top = topV; if(preserveSize) el.style.bottom = 'auto'; }
    if (botV !== null) { el.style.bottom = botV; if(preserveSize) el.style.top = 'auto'; }
    if (leftV !== null) { el.style.left = leftV; if(preserveSize) el.style.right = 'auto'; }
    if (rightV !== null) { el.style.right = rightV; if(preserveSize) el.style.left = 'auto'; }
    if (widthV !== null) el.style.width = widthV;
    if (heightV !== null) el.style.height = heightV;

    if (useTransform) { el.style.transform = `translate(${tx}, ${ty})`; } else if (!preserveSize) { el.style.transform = 'none'; }
    return { topV, botV, leftV, rightV };
  }

  applyConfigs(configArray) {
    /* game_idはCONFIGの列挙順に依存せず、他のどのハンドラより先に確定させる
       （以降の全localStorageアクセスがlsKey()経由でこの値を参照するため）。 */
    const gameIdConf = configArray.find(c => c.name === 'game_id');
    if (gameIdConf && gameIdConf.text) {
      GAME_ID = String(gameIdConf.text).trim().replace(/[^a-zA-Z0-9_\-]/g, '_');
    } else if (!GAME_ID) {
      console.warn('CONFIGにgame_idが設定されていません。同一ドメインの別フォルダに複数のゲームを設置すると、セーブデータや設定が共有されてしまう可能性があります。');
    }

    /* panel_themeも同様に、シナリオエディタの再読み込みで前回のCONFIGにあった
       テーマ・カラーオーバーライドが残留しないよう、毎回いったんリセットしてから
       ハンドラ側で（存在すれば）再設定する。 */
    const panelThemeNames = ['sharp', 'pop', 'frame', 'line'];
    const canvasEl = document.getElementById('game-canvas');
    panelThemeNames.forEach(t => canvasEl.classList.remove(`panel-theme-${t}`));
    this.applyPanelOverrides(null, null, null);
    canvasEl.style.removeProperty('--game-frame-w');
    canvasEl.style.removeProperty('--game-frame-c');

    const formatSize = (val) => {
      if (!val) return null; 
      const strVal = String(val).trim();
      if (/^\d+$/.test(strVal)) return ((parseInt(strVal, 10) / 1920) * 100) + 'cqw';
      return strVal;
    };
    const getSrcPath = (c) => resolveAssetPath((c.dir && c.src) ? `${c.dir.replace(/\/$/, '')}/${c.src}` : c.src);

    // ===== MENU BAR POSITION PRESETS =====
    const menuPosPresets = {
      'top-left':      'top: 2, left: 2',
      'top-right':     'top: 2, right: 2',
      'bottom-left':   'bottom: 2, left: 2',
      'bottom-right':  'bottom: 2, right: 2',
      'top-center':    'top: 2, center',
      'bottom-center': 'bottom: 2, center',
      'center':        'top: 2, center',
      'dialog-out-top-left':     'bottom: 45, left: 8',
      'dialog-out-top-right':    'bottom: 45, right: 8',
      'dialog-out-bottom-left':  'bottom: 37, left: 8',
      'dialog-out-bottom-right': 'bottom: 37, right: 8',
      'dialog-in-top-left':      'bottom: 29, left: 8',
      'dialog-in-top-right':     'bottom: 29, right: 8',
      'dialog-in-bottom-left':   'bottom: 4, left: 8',
      'dialog-in-bottom-right':  'bottom: 4, right: 8'
    };

    // ===== CONFIG NAME HANDLERS =====
    const handlers = {
      title_text: (c) => {
        const titleEl = document.getElementById('title-logo-text');
        if (c.text) titleEl.innerHTML = c.text.replace(/\n/g, '<br>');
        if (c.font) titleEl.style.fontFamily = c.font;
        if (c.color) titleEl.style.color = c.color;
        if (c.fontsize) titleEl.style.fontSize = formatSize(c.fontsize);
        if (c.outline) window.app.applyTextOutline(titleEl, c.outline);

        if (c.pos) {
          document.getElementById('title-screen').appendChild(titleEl);
          titleEl.style.position = 'absolute'; titleEl.style.margin = '0'; titleEl.style.width = 'max-content';
          this.applyPos(titleEl, c.pos, { top: null, bottom: null, left: null, right: null }, true, false);
        }
      },

      title_sub: (c) => {
        const subEl = document.getElementById('title-sub-text');
        if (c.text) subEl.innerHTML = c.text.replace(/\n/g, '<br>');
        if (c.font) subEl.style.fontFamily = c.font;
        if (c.color) subEl.style.color = c.color;
        if (c.fontsize) subEl.style.fontSize = formatSize(c.fontsize);
        if (c.outline) window.app.applyTextOutline(subEl, c.outline);

        if (c.pos) {
          document.getElementById('title-screen').appendChild(subEl);
          subEl.style.position = 'absolute'; subEl.style.margin = '0'; subEl.style.width = 'max-content';
          this.applyPos(subEl, c.pos, { top: null, bottom: null, left: null, right: null }, true, false);
        }
      },

      title_rogo: (c) => handlers.title_logo(c),
      title_logo: (c) => {
        const logoCont = document.getElementById('title-logo-container');
        if (c.src) {
          const imgEl = document.getElementById('title-logo-image');
          imgEl.src = getSrcPath(c);
          imgEl.style.display = 'block';
          document.getElementById('title-logo-text').style.display = 'none';
        }
        if (c.pos) {
          logoCont.style.position = 'absolute'; logoCont.style.margin = '0';
          this.applyPos(logoCont, c.pos, { top: null, bottom: null, left: null, right: null }, true, false);
        }
      },

      title_menu_btn: (c) => {
        if (c.text) { document.querySelectorAll('.title-btn, .game-btn, .sys-btn, .choice-btn').forEach(btn => btn.style.borderRadius = c.text); }
        if (c.pos) {
          const menu = document.getElementById('title-menu');
          menu.style.position = 'absolute'; menu.style.margin = '0';
          this.applyPos(menu, c.pos, { top: null, bottom: null, left: null, right: null }, true, false);
        }
      },

      game_btn: (c) => {
        const fontName = c.font || c.text;
        if (c.src || c.color || fontName || c.fontsize) {
          const rawSrc = getSrcPath(c);
          const imgUrl = c.src ? `url('${rawSrc}')` : null;
          if (c.src) {
            const img = new Image();
            img.onload = () => {
              const ratio = `${img.width} / ${img.height}`;
              document.querySelectorAll('.game-btn.is-common-bg').forEach(btn => {
                btn.style.setProperty('aspect-ratio', ratio, 'important');
                btn.style.setProperty('width', 'auto', 'important');
                btn.style.setProperty('height', 'max(36px, 3.5cqw)', 'important');
                btn.style.setProperty('padding', '0', 'important');
              });
            };
            img.src = rawSrc;
          }
          document.querySelectorAll('.game-btn').forEach(btn => {
            if (imgUrl) { btn.classList.add('is-common-bg'); btn.style.backgroundImage = imgUrl; }
            if (c.fontsize) btn.style.setProperty('font-size', formatSize(c.fontsize), 'important');
            if (c.color) { btn.style.setProperty('color', c.color, 'important'); btn.style.textShadow = 'none'; }
            if (fontName) btn.style.setProperty('font-family', fontName, 'important');
          });
        }
        if (c.pos) {
          const bar = document.getElementById('game-menu-bar');
          const posStr = menuPosPresets[String(c.pos).trim().toLowerCase()] || c.pos;
          const res = this.applyPos(bar, posStr, { top: null, bottom: null, left: null, right: null }, false, false);
          if (res.rightV !== null) bar.classList.add('menu-right-pos'); else bar.classList.remove('menu-right-pos');
          if (/\bcenter\b/.test(String(posStr).toLowerCase())) bar.style.transform = 'translateX(-50%)';
        }
      },

      screen_frame: (c) => {
        const canvas = document.getElementById('game-canvas');
        const raw = String(c.text || c.fontsize || '').trim();
        const width = raw ? (/^\d+(\.\d+)?$/.test(raw) ? raw + 'px' : raw) : '14px';
        canvas.style.setProperty('--game-frame-w', width);
        canvas.style.setProperty('--game-frame-c', c.color || 'blue');
      },

      title_bg: (c) => {
        const bgUrl = `url('${getSrcPath(c)}')`;
        document.getElementById('title-bg').style.backgroundImage = bgUrl;
        document.documentElement.style.setProperty('--title-bg-url', bgUrl);
      },

      title_bgm: (c) => { settings.titleBgm = getSrcPath(c); },
      se_start: (c) => { settings.seStart = getSrcPath(c); },
      se_click: (c) => { settings.seClick = getSrcPath(c); },

      font_main: (c) => {
        if (c.font || c.text) document.documentElement.style.setProperty('--font-main', c.font || c.text);
        if (c.color) document.documentElement.style.setProperty('--text-main', c.color);
        if (c.outline) settings.dialogOutline = c.outline;
        if (c.fontsize) settings.dialogFontSize = formatSize(c.fontsize);

        if (c.pos) {
          const dialogText = document.getElementById('dialog-text');
          dialogText.style.position = 'absolute'; dialogText.style.margin = '0';
          this.applyPos(dialogText, c.pos, { top: null, bottom: null, left: null, right: null }, false, false);
        }
      },

      name: (c) => handlers.name_tag(c),
      name_tag: (c) => {
        const nameEl = document.getElementById('name-tag');
        if (c.font) nameEl.style.setProperty('font-family', c.font, 'important');
        if (c.color) nameEl.style.setProperty('color', c.color, 'important');
        if (c.fontsize) nameEl.style.setProperty('font-size', formatSize(c.fontsize), 'important');
        if (c.outline) window.app.applyTextOutline(nameEl, c.outline);

        if (c.pos) {
          nameEl.style.position = 'absolute'; nameEl.style.margin = '0';
          this.applyPos(nameEl, c.pos, { top: null, bottom: null, left: null, right: null }, false, false);
        }
      },

      main_color: (c) => { const colorVal = c.color || c.text; if (colorVal) this.applyColors(colorVal); },
      bg_color: (c) => { if (c.text) document.documentElement.style.setProperty('--bg-dark', c.text); },
      font_chapter: (c) => {
        if (c.font || c.text) settings.fontChapter = c.font || c.text;
        if (c.color) settings.chapterColor = c.color;
        if (c.outline) settings.chapterOutline = c.outline;
      },
      tts_api_url: (c) => { if (c.text) settings.ttsApiUrl = c.text; },

      dialog_bg: (c) => {
        const dialogBg = document.getElementById('dialog-bg');
        if (c.src) {
          const bgUrl = `url('${getSrcPath(c)}')`;
          dialogBg.style.background = `${bgUrl} center / 100% 100% no-repeat`;
        } else if (c.color || c.text) {
          const color = c.color || c.text;
          dialogBg.style.background = `linear-gradient(to top, color-mix(in srgb, ${color} 95%, transparent) 0%, color-mix(in srgb, ${color} 80%, transparent) 30%, transparent 100%)`;
        }
        if (c.pos) {
          dialogBg.style.position = 'absolute'; dialogBg.style.margin = '0';
          this.applyPos(dialogBg, c.pos, { top: null, bottom: null, left: null, right: null }, false, false);
        }
      },

      choice_bg: (c) => {
        if (c.src) settings.choiceBg = getSrcPath(c);
        if (c.pos) settings.choiceBgPos = c.pos;
      },

      choice_text: (c) => {
        if (c.font) settings.choiceFont = c.font;
        if (c.color) settings.choiceColor = c.color;
        if (c.fontsize) settings.choiceSize = formatSize(c.fontsize);
        if (c.outline) settings.choiceOutline = c.outline;
        if (c.pos) settings.choicePos = c.pos;
      },

      panel_theme: (c) => {
        const theme = String(c.text || '').trim().toLowerCase();
        if (panelThemeNames.includes(theme)) {
          document.getElementById('game-canvas').classList.add(`panel-theme-${theme}`);
        }
        /* color列に「背景, 文字, 枠線」の順でカンマ区切り指定（例: "navy, white, #3a5a8c"）。
           1〜2個だけの指定や空欄も可で、指定しなかった色はmain_color基準に戻る */
        const [bgColor, textColor, accentColor] = String(c.color || '').split(',').map(s => s.trim());
        this.applyPanelOverrides(bgColor, textColor, accentColor);
      },

      ruby_grade: (c) => {
        const raw = String(c.text || '').trim().replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
        const num = parseInt(raw, 10);
        settings.rubyGrade = Number.isNaN(num) ? 8 : num;
      },

      /* 未設定・空欄はONとして扱い、OFF系の値が明示された時だけ非表示にする */
      reflection_sheet: (c) => {
        const val = String(c.text || '').trim().toLowerCase();
        settings.reflectionSheet = !['off', 'false', 'no', '0', 'なし', '非表示', 'オフ'].includes(val);
      }
    };

    // ===== IMAGE BUTTON NAME PATTERN (title_btn_*, game_btn_*) =====
    const imgBtnIds = {
      start: 'title-btn-start', continue: 'continue-btn', system: 'title-btn-system',
      auto: 'btn-auto', toggle: 'menu-toggle-btn'
    };
    const imgBtnTypes = ['start', 'continue', 'system', 'back', 'log', 'auto', 'skip', 'save', 'load', 'toggle'];
    const applyImageBtn = (c, btnType) => {
      if (!c.src) return;
      const btnId = imgBtnIds[btnType] || `game-btn-${btnType}`;
      const btn = document.getElementById(btnId);
      if (!btn) return;
      btn.classList.add('is-image-btn');
      btn.style.backgroundImage = `url('${getSrcPath(c)}')`;
      btn.style.backgroundSize = 'contain';
      btn.style.backgroundRepeat = 'no-repeat';
      btn.style.backgroundPosition = 'center';
      if (c.fontsize) btn.style.width = btn.style.height = formatSize(c.fontsize);
    };

    configArray.forEach(c => {
      if (handlers[c.name]) { handlers[c.name](c); return; }

      const imgBtnMatch = imgBtnTypes.find(t => c.name === `title_btn_${t}` || c.name === `game_btn_${t}`);
      if (imgBtnMatch) applyImageBtn(c, imgBtnMatch);
    });
  }
}

/* ======================================================================
 * Class: ParticleSystem
 * Canvasを用いた画面上のパーティクル（雪・雨・風など）演出を管理
 * ====================================================================== */
class ParticleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.splashes = [];
    this.sprites = {};
    this.animId = null;
    this.type = null;

    this.resize = () => { 
      this.canvas.width = this.canvas.clientWidth; 
      this.canvas.height = this.canvas.clientHeight; 
    };
    window.addEventListener('resize', this.resize);
    this.resize();
  }

  start(type) { 
    this.type = type; 
    this.particles = []; 
    this.splashes = [];
    if (!this.animId) this.update(); 
  }

  stop() { 
    this.type = null; 
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); 
    cancelAnimationFrame(this.animId); 
    this.animId = null; 
  }

  getGlowSprite(key, size, stops) {
    if (this.sprites[key]) return this.sprites[key];
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const cx = c.getContext('2d');
    const g = cx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(([offset, color]) => g.addColorStop(offset, color));
    cx.fillStyle = g;
    cx.fillRect(0, 0, size, size);
    this.sprites[key] = c;
    return c;
  }

  spawn() {
    const w = this.canvas.width, h = this.canvas.height;
    if (this.type === 'rain') {
      for (let n = 0; n < 4 && this.particles.length < 220; n++) {
        const depth = Math.random();
        this.particles.push({ x: Math.random() * (w + 120) - 60, y: -30, depth, vx: 2 + depth * 3, vy: 15 + depth * 17, l: 12 + depth * 26 });
      }
    } else if (this.type === 'snow') {
      if (this.particles.length < 160 && Math.random() < 0.55) {
        const depth = Math.random();
        this.particles.push({ x: Math.random() * (w + 60) - 30, y: -14, depth, r: 1.2 + depth * 3.2, vy: 0.45 + depth * 1.35, phase: Math.random() * Math.PI * 2, sway: 0.01 + Math.random() * 0.02, amp: 0.5 + Math.random() * 1.1 });
      }
    } else if (this.type === 'sparkle') {
      if (this.particles.length < 45 && Math.random() < 0.28) {
        this.particles.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.6, vy: -0.3 - Math.random() * 0.9, r: 2.5 + Math.random() * 4.5, life: 0, maxLife: 70 + Math.random() * 50, hue: 38 + Math.random() * 22, spin: (Math.random() - 0.5) * 0.05, phase: Math.random() * Math.PI * 2 });
      }
    } else if (this.type === 'wind') {
      if (this.particles.length < 55) {
        if (Math.random() < 0.16) {
          this.particles.push({ kind: 'streak', x: w + 60, y: Math.random() * h, vx: -(9 + Math.random() * 9), len: 120 + Math.random() * 180, amp: 5 + Math.random() * 13, phase: Math.random() * Math.PI * 2, freq: 0.008 + Math.random() * 0.012, opacity: 0.1 + Math.random() * 0.18, width: 1 + Math.random() * 1.4 });
        }
        if (Math.random() < 0.4) {
          this.particles.push({ kind: 'mote', x: w + 10, y: Math.random() * h, vx: -(6 + Math.random() * 9), vy: (Math.random() - 0.5) * 0.6, r: 0.7 + Math.random() * 1.5, opacity: 0.12 + Math.random() * 0.22, phase: Math.random() * Math.PI * 2 });
        }
      }
    }
  }

  drawRain() {
    const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
    ctx.fillStyle = 'rgba(14, 20, 36, 0.16)';
    ctx.fillRect(0, 0, w, h);
    ctx.lineCap = 'round';
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx; p.y += p.vy;
      ctx.strokeStyle = `rgba(190, 214, 245, ${0.1 + p.depth * 0.32})`;
      ctx.lineWidth = 0.7 + p.depth * 1.3;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * (p.l / p.vy), p.y - p.l);
      ctx.stroke();
      if (p.y > h - 4) {
        if (p.depth > 0.4 && this.splashes.length < 50) this.splashes.push({ x: p.x, y: h - 2 - Math.random() * 5, life: 0, maxLife: 13 + Math.random() * 9, depth: p.depth });
        this.particles.splice(i, 1);
      } else if (p.x > w + 60) {
        this.particles.splice(i, 1);
      }
    }
    for (let i = this.splashes.length - 1; i >= 0; i--) {
      const s = this.splashes[i];
      s.life++;
      if (s.life > s.maxLife) { this.splashes.splice(i, 1); continue; }
      const t = s.life / s.maxLife;
      const rx = 2 + t * 7 * s.depth;
      ctx.strokeStyle = `rgba(200, 225, 250, ${(1 - t) * 0.35 * s.depth})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, rx, rx * 0.32, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  drawSnow() {
    const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
    const sprite = this.getGlowSprite('snow', 32, [[0, 'rgba(255,255,255,1)'], [0.45, 'rgba(255,255,255,0.85)'], [1, 'rgba(255,255,255,0)']]);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.phase += p.sway;
      p.x += Math.sin(p.phase) * p.amp * 0.45 + p.depth * 0.25;
      p.y += p.vy;
      ctx.globalAlpha = 0.3 + p.depth * 0.65;
      const size = p.r * 2.8;
      ctx.drawImage(sprite, p.x - size / 2, p.y - size / 2, size, size);
      if (p.y > h + 14 || p.x < -40 || p.x > w + 40) this.particles.splice(i, 1);
    }
    ctx.globalAlpha = 1;
  }

  drawSparkle() {
    const ctx = this.ctx;
    const glow = this.getGlowSprite('sparkGlow', 48, [[0, 'rgba(255,250,225,0.9)'], [0.4, 'rgba(255,226,150,0.4)'], [1, 'rgba(255,210,120,0)']]);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx; p.y += p.vy; p.life++;
      if (p.life > p.maxLife) { this.particles.splice(i, 1); continue; }
      const fade = Math.sin((p.life / p.maxLife) * Math.PI);
      const a = fade * (0.65 + 0.35 * Math.sin(p.life * 0.3 + p.phase));
      const gs = p.r * fade * 8;
      ctx.globalAlpha = a * 0.55;
      ctx.drawImage(glow, p.x - gs / 2, p.y - gs / 2, gs, gs);

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.life * p.spin);
      ctx.globalAlpha = 1;
      const rayL = p.r * fade * 4.2;
      ctx.strokeStyle = `hsla(${p.hue}, 100%, 88%, ${a})`;
      ctx.lineWidth = Math.max(0.6, p.r * 0.22 * fade);
      ctx.beginPath();
      ctx.moveTo(0, -rayL); ctx.lineTo(0, rayL);
      ctx.moveTo(-rayL, 0); ctx.lineTo(rayL, 0);
      ctx.stroke();
      ctx.rotate(Math.PI / 4);
      const dL = rayL * 0.45;
      ctx.lineWidth *= 0.7;
      ctx.beginPath();
      ctx.moveTo(0, -dL); ctx.lineTo(0, dL);
      ctx.moveTo(-dL, 0); ctx.lineTo(dL, 0);
      ctx.stroke();
      ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(0.8, p.r * fade * 0.55), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  drawWind() {
    const ctx = this.ctx;
    ctx.lineCap = 'round';
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.phase += 0.05;
      p.x += p.vx;
      if (p.kind === 'streak') {
        if (p.x < -p.len - 60) { this.particles.splice(i, 1); continue; }
        const grad = ctx.createLinearGradient(p.x, 0, p.x + p.len, 0);
        grad.addColorStop(0, 'rgba(232, 241, 250, 0)');
        grad.addColorStop(0.5, `rgba(232, 241, 250, ${p.opacity})`);
        grad.addColorStop(1, 'rgba(232, 241, 250, 0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = p.width;
        ctx.beginPath();
        const seg = 10, stepLen = p.len / seg;
        for (let s = 0; s <= seg; s++) {
          const px = p.x + s * stepLen;
          const py = p.y + Math.sin(p.phase + px * p.freq) * p.amp * (s / seg);
          if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      } else {
        p.y += p.vy + Math.sin(p.phase) * 0.3;
        if (p.x < -20) { this.particles.splice(i, 1); continue; }
        ctx.fillStyle = `rgba(235, 242, 250, ${p.opacity})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  update() {
    if (!this.type) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.spawn();
    if (this.type === 'rain') this.drawRain();
    else if (this.type === 'snow') this.drawSnow();
    else if (this.type === 'sparkle') this.drawSparkle();
    else if (this.type === 'wind') this.drawWind();
    this.animId = requestAnimationFrame(() => this.update());
  }

  destroy() { 
    this.stop(); 
    window.removeEventListener('resize', this.resize); 
  }
}

// ===== REFLECTION SHEET =====
const REFLECTION_KANJI_GRADE = {
  '年': 1, '名': 1, '月': 1, '日': 1, '学': 1,
  '組': 2, '前': 2, '考': 2, '点': 2, '数': 2, '記': 2,
  '習': 3, '返': 3, '業': 3,
  '結': 4, '果': 4, '選': 4, '録': 4,
  '授': 5,
  '振': 7
};
const REFLECTION_TEXT = {
  sheetSuffix: 'ふりかえりシート',
  result: 'ゲームの【｜結《けっ》｜果《か》】',
  resultCont: 'ゲームの【｜結《けっ》｜果《か》】（つづき）',
  note: 'この【｜学《がく》｜習《しゅう》】で｜学《まな》んだこと・｜考《かんが》えたこと',
  choices: '｜選《えら》んだこと',
  minigames: 'ミニゲーム',
  scores: '【｜点《てん》｜数《すう》】・【｜記《き》｜録《ろく》】',
  ending: 'エンディング',
  empty: 'まだ【｜記《き》｜録《ろく》】がありません'
};
/* 1ページに詰め込むときの縮小率。末尾が可読性の下限で、これを下回るなら次ページへ送る */
const REFLECTION_SCALES = [1, 0.95, 0.9, 0.85, 0.8, 0.75];
/* ページを増やすくらいなら、という場面でだけ使う追い込み用の縮小率 */
const REFLECTION_TIGHT_SCALES = [0.72, 0.68, 0.64];
const REFLECTION_MAX_PAGES = 12;
const REFLECTION_PAGE = { width: 1240, height: 1754, ptWidth: 595.28, ptHeight: 841.89, margin: 90 };
const REFLECTION_NO_LINE_START = '。、，．）」』】〉》〕｝，、!?！？ー…‥・,.:;：；';

// ===== EFFECT TIMING TABLES =====
const FX_ONESHOT_MS = { hop: 400, step: 1200 };
const FX_EXIT_MS = { runleft: 900, runright: 900, collapse: 1800 };
const FX_SHAKE_DEFAULT_MS = 600;


/* ======================================================================
 * Class: NovelGameEngine
 * ノベルゲームのメインロジック（シナリオ進行、演出、UI管理、セーブ）
 * ====================================================================== */
class NovelGameEngine {
  constructor() {
    this.$ = id => document.getElementById(id);
    this.activeSePlayers = [];
this.state = {
      index: 0, typing: false, fullText: '', typingTimer: null, autoTimer: null, 
      isAuto: false, isSkip: false, skipTimer: null, prevScreen: 'title-screen', 
      saveMode: 'save', flags: {}, history: [], logs: [], uiHidden: false, 
      screenEffect: '', particleType: '', currentVoice: null, bgmFadeTimer: null, 
      charVoices: {}, currentVoiceBlobUrl: null, currentChapter: '',
      chapterStartData: null, currentSrcKey: 'src',
      textFinishedTime: 0
    };

    this.el = {
      bgLayer: this.$('bg-layer'), bgLayerNext: this.$('bg-layer-next'), 
      overlay: this.$('overlay'), choiceUi: this.$('choice-ui'),
      dialogUi: this.$('dialog-ui'), nameTag: this.$('name-tag'), 
      dialogText: this.$('dialog-text'), nextArrow: this.$('next-arrow'),
      bgmPlayer: this.$('bgm-player'), sePlayer: this.$('se-player'), 
      sysSePlayer: this.$('sys-se-player')
    };

    this.charMap = { left: this.$('char-left'), center: this.$('char-center'), right: this.$('char-right') };
    this.particleSystem = null;
    this.el.stageLayer = this.buildStageLayer();

    this.setupWindowResizer();
    this.setupShortcuts();
    this.setupDebugDisplayWatcher();
    
    this.$('text-speed-slider').value = settings.textSpeed;
    this.$('bgm-slider').value = settings.bgmVolume * 100;
    this.$('se-slider').value = settings.seVolume * 100;
    this.$('voice-slider').value = settings.voiceVolume * 100;
    this.$('sys-se-slider').value = settings.sysSeVolume * 100;
    this.el.bgmPlayer.volume = settings.bgmVolume;
    
    if (window.speechSynthesis) window.speechSynthesis.getVoices();
  }

  // ===== STAGE LAYER / CHAR POSITION HELPERS =====
  buildStageLayer() {
    const existing = this.$('stage-layer');
    if (existing) return existing;
    const gameScreen = this.$('game-screen');
    const bgLayer = this.$('bg-layer');
    if (!gameScreen || !bgLayer) return null;
    const stage = document.createElement('div');
    stage.id = 'stage-layer';
    gameScreen.insertBefore(stage, bgLayer);
    ['bg-layer', 'bg-layer-next', 'char-layer', 'particle-canvas'].forEach(id => {
      const node = this.$(id);
      if (node) stage.appendChild(node);
    });
    return stage;
  }

  baseCharPos(pos) { return (typeof pos === 'string') ? pos.replace(/-float$/, '') : pos; }
  isFloatPos(pos) { return (typeof pos === 'string') && pos.endsWith('-float'); }

  screenFxTarget(fxClass) { return fxClass === 'fx-screen-shake' ? (this.el.stageLayer || this.$('game-canvas')) : this.$('game-canvas'); }

  clearScreenFx() {
    [this.$('game-canvas'), this.el.stageLayer].forEach(el => {
      if (!el) return;
      Array.from(el.classList).forEach(c => { if (c.startsWith('fx-')) el.classList.remove(c); });
    });
  }

  getStepSrc(step) {
    if (!step) return null;
    const key = this.state.currentSrcKey || 'src';
    const val = (step[key] !== undefined && step[key] !== '') ? step[key] : step.src;
    if (!val) return null;
    const rawPath = (step.dir && val) ? `${step.dir.replace(/\/$/, '')}/${val}` : val;
    return resolveAssetPath(encodeURI(rawPath));
  }

  setVoiceVolume(val) { settings.voiceVolume = val / 100; if (this.state.currentVoice) this.state.currentVoice.volume = settings.voiceVolume; }
  setBgmVolume(sliderValue) { settings.bgmVolume = sliderValue / 100; this.el.bgmPlayer.volume = settings.bgmVolume; }

  showConfirm(message) {
    this.playSysSe(settings.seClick);
    return new Promise(resolve => {
      const screen = document.getElementById('custom-confirm-screen');
      const msgEl = document.getElementById('confirm-message');
      const yesBtn = document.getElementById('confirm-yes-btn');
      const noBtn = document.getElementById('confirm-no-btn');
      
      msgEl.textContent = message;
      screen.classList.remove('hidden');
      screen.classList.add('active');
      
      const onYes = () => {
        screen.classList.add('hidden');
        screen.classList.remove('active');
        cleanup();
        resolve(true);
      };
      
      const onNo = () => {
        screen.classList.add('hidden');
        screen.classList.remove('active');
        cleanup();
        resolve(false);
      };
      
      const cleanup = () => {
        yesBtn.removeEventListener('click', onYes);
        noBtn.removeEventListener('click', onNo);
      };
      
      yesBtn.addEventListener('click', onYes);
      noBtn.addEventListener('click', onNo);
    });
  }

  setupWindowResizer() {
    window.addEventListener('resize', () => {
      const targetW = 1920; const targetH = 1080; const targetRatio = targetH / targetW;
      const w = window.innerWidth; const h = window.innerHeight; const c = this.$('game-canvas');
      if (h / w > targetRatio) { c.style.width = w + 'px'; c.style.height = (w * targetRatio) + 'px'; } 
      else { c.style.height = h + 'px'; c.style.width = (h / targetRatio) + 'px'; }
      /* 1920x1080を基準にした表示倍率。px指定の外部コンテンツ（ミニゲーム）を画面比率に追従させる */
      document.documentElement.style.setProperty('--canvas-scale', (parseFloat(c.style.width) / targetW).toFixed(4));
    });
    window.dispatchEvent(new Event('resize'));
  }

  setupShortcuts() {
    window.addEventListener('contextmenu', e => {
      if (document.querySelector('.popup-overlay.active')) return;
      const active = document.querySelector('.screen.active:not(.popup-overlay)')?.id || document.querySelector('.screen.active')?.id;
      if (active === 'game-screen' && this.el.choiceUi.style.display !== 'flex') { e.preventDefault(); this.toggleUI(); }
    });
    window.addEventListener('mousedown', e => { if (this.state.uiHidden && e.button === 0) this.toggleUI(); });
    window.addEventListener('wheel', e => {
      if (document.querySelector('.popup-overlay.active')) return;
      const active = document.querySelector('.screen.active:not(.popup-overlay)')?.id || document.querySelector('.screen.active')?.id;
      if (active !== 'game-screen' || this.state.uiHidden || this.el.choiceUi.style.display === 'flex') return;
      if (e.deltaY < 0) this.openLog(); else if (e.deltaY > 0) this.onDialogClick();
    }, { passive: true });
  }

  fadeBGM(newSrc, isLoop = true) {
    if (this.state.bgmFadeTimer) clearInterval(this.state.bgmFadeTimer);
    const targetSrc = newSrc || '';
    
    if (this.state.currentBgm === targetSrc && !this.el.bgmPlayer.paused && targetSrc !== '') { 
      this.el.bgmPlayer.loop = isLoop; 
      return; 
    }
    this.state.currentBgm = targetSrc;

    if (targetSrc === '') {
      this.state.bgmFadeTimer = setInterval(() => {
        if (this.el.bgmPlayer.volume <= 0.05) {
          this.el.bgmPlayer.volume = 0;
          clearInterval(this.state.bgmFadeTimer); 
          this.el.bgmPlayer.pause(); 
          this.el.bgmPlayer.removeAttribute('src'); 
          this.el.bgmPlayer.load();
        } else {
          this.el.bgmPlayer.volume -= 0.05;
        }
      }, 40);
      return;
    }

    const targetVol = settings.bgmVolume; 
    this.state.bgmFadeTimer = setInterval(() => {
      if (!this.el.bgmPlayer.paused && this.el.bgmPlayer.volume > 0.05) {
        this.el.bgmPlayer.volume -= 0.05;
      } else {
        this.el.bgmPlayer.pause(); this.el.bgmPlayer.loop = isLoop; this.el.bgmPlayer.src = targetSrc; 
        this.el.bgmPlayer.currentTime = 0; this.el.bgmPlayer.volume = 0; this.el.bgmPlayer.play().catch(()=>{});
        clearInterval(this.state.bgmFadeTimer);
        this.state.bgmFadeTimer = setInterval(() => {
          if (this.el.bgmPlayer.volume + 0.05 >= targetVol) {
            this.el.bgmPlayer.volume = targetVol;
            clearInterval(this.state.bgmFadeTimer);
          } else {
            this.el.bgmPlayer.volume += 0.05;
          }
        }, 50);
      }
    }, 40);
  }

  updateContinueButtonState() {
    const hasManualSave = [...Array(99)].some((_,i) => localStorage.getItem(lsKey(`save_slot_${i+1}`)));
    let hasAutoSave = false;
    try {
      const autoList = JSON.parse(localStorage.getItem(lsKey('save_auto_list')) || '[]');
      hasAutoSave = Array.isArray(autoList) && autoList.length > 0;
    } catch(e) {}
    
    const btn = this.$('continue-btn');
    if (btn) btn.disabled = !(hasManualSave || hasAutoSave);
  }

  showScreen(id) {
    const popups = ['system-screen', 'save-screen', 'log-screen', 'char-select-screen'];
    const isPopup = popups.includes(id);
    document.querySelectorAll('.screen').forEach(s => {
      if (s.id === id) { s.classList.add('active'); s.style.display = 'flex'; } 
      else if (isPopup && s.id === this.state.prevScreen) { s.style.display = s.id === 'title-screen' ? 'block' : 'flex'; } 
      else { s.classList.remove('active'); s.style.display = 'none'; }
    });
    if (id === 'title-screen') this.updateContinueButtonState();
  }

  fadeTransition(callback) { 
    const el = this.$('transition-overlay');
    el.classList.add('fade-in'); 
    setTimeout(() => { 
      callback(); el.classList.remove('fade-in'); el.classList.add('fade-out'); 
      setTimeout(() => el.classList.remove('fade-out'), 600); 
    }, 500); 
  }

  toggleUI() {
    this.state.uiHidden = !this.state.uiHidden;
    [this.el.dialogUi, this.$('game-menu-bar'), this.el.choiceUi, this.$('item-popup'), this.$('skip-overlay')].forEach(el => { 
      if(el) el.classList.toggle('ui-hidden', this.state.uiHidden); 
    });
  }

  toggleMenuBar() { 
    if (this.state.isSkip) this.stopSkip();
    this.playSysSe(settings.seClick); 
    this.$('game-menu-items').classList.toggle('collapsed'); 
    this.$('menu-toggle-btn').classList.toggle('closed'); 
  }

  playSysSe(src) {
    if (!src) return;
    if (!this.sysAudioCache) this.sysAudioCache = {};
    if (!this.sysAudioCache[src]) { this.sysAudioCache[src] = new Audio(src); this.sysAudioCache[src].preload = 'auto'; }
    const player = this.sysAudioCache[src];
    player.volume = settings.sysSeVolume; player.currentTime = 0; player.play().catch(()=>{});
  }

  /* シナリオエディタ等の外部ツールから、編集中のシナリオ・CONFIGを受け取って即座に反映する。
     プレイ履歴（実際に選んだ選択肢の結果など）はリセットせず保持したまま、現在の再生位置の
     見た目（背景・BGM・キャラ表示・エフェクト・フラグ）だけをreconstructStateUpToで
     再構築し、現在の行をexecuteStepで再表示する。
     CONFIGはフォント・色・ロゴ画像など画面全体に関わる設定で、画面の種類を問わず常に
     再適用する（タイトル画面のデザイン調整中でも確認できるようにするため）。applyConfigsは
     その時点のCONFIG内容でDOM/settingsを上書きするだけの作りなので、何度呼んでも安全。
     SCENARIOの再構築・再表示は、タイトル画面・キャラセレクト中・ログ画面表示中など、
     ゲーム画面そのものを表示していない時は、不用意に画面を切り替えないようスキップする。 */
  reloadScenarioInPlace(newScenario, newConfig) {
    if (Array.isArray(newConfig) && window.dL) {
      try { CONFIG = newConfig; window.dL.applyConfigs(CONFIG); } catch (e) { /* CONFIG反映に失敗してもシナリオの更新は続行する */ }
    }
    if (!Array.isArray(newScenario) || newScenario.length === 0) return;
    SCENARIO = newScenario;
    if (!this.state) return;
    if (this.state.index >= SCENARIO.length) this.state.index = Math.max(0, SCENARIO.length - 1);
    const gameScreenEl = this.$('game-screen');
    if (!gameScreenEl || !gameScreenEl.classList.contains('active')) return;
    this.reconstructStateUpTo(this.state.index);
    this.executeStep();
  }

  /* シナリオエディタのサイドバー表示用に、現在再生中のBGM・背景画像・表示中のキャラクター画像を
     まとめて取得する。既存のDOM/audio要素が今持っている値をそのまま読むだけで、ゲーム本体の
     状態を変更したり、新しい状態を保持したりはしない（読み取り専用のヘルパー）。
     bgコマンドはbgLayerNextを先にフェードインさせてから800ms後にbgLayer本体へ反映する
     クロスフェード方式なので、フェード中（bgLayerNext.opacity==='1'）はbgLayerNextの方を見る
     （reconstructStateUpTo等、他の箇所と同じ判定方法）。
     chapter（章タイトル）表示中は、背景がbgLayerではなくchapter-screen側に設定されるため、
     どちらも空の場合はchapter-screenの背景も確認する。 */
  getDebugDisplayState() {
    const useNextBg = this.el.bgLayerNext.style.opacity === '1';
    const bgSource = useNextBg ? this.el.bgLayerNext.style.backgroundImage : this.el.bgLayer.style.backgroundImage;
    const bgMatch = /url\(['"]?(.*?)['"]?\)/.exec(bgSource || '');
    let bg = bgMatch ? bgMatch[1] : '';
    if (!bg) {
      const chapterScreenEl = this.$('chapter-screen');
      if (chapterScreenEl && !chapterScreenEl.classList.contains('hidden')) {
        const chapMatch = /url\(['"]?(.*?)['"]?\)/.exec(chapterScreenEl.style.background || '');
        if (chapMatch) bg = chapMatch[1];
      }
    }
    const chars = {};
    Object.entries(this.charMap).forEach(([pos, el]) => {
      if (el && !el.classList.contains('hidden') && el.src) {
        chars[pos] = { src: el.src, name: el.dataset.charName || '' };
      }
    });
    return {
      bgm: this.el.bgmPlayer.src || '',
      bg,
      chars
    };
  }

  /* シナリオエディタ等の外部ツールへ、現在の実行位置・フラグ・表示状態（BGM/背景/キャラ）を
     通知する。通常プレイ時（親フレームが無い場合）は何もしない。
     executeStepの冒頭だけでなく、chapter表示中のような「次の行に進むまで時間がかかる場面」でも
     呼ぶことで、サイドバーの情報が更新されないまま固まってしまうのを防ぐ。 */
  notifyDebugStep() {
    if (window.parent === window) return;
    try {
      window.parent.postMessage({ type: 'novelgame-debug-step', index: this.state.index, flags: this.state.flags, display: this.getDebugDisplayState() }, location.protocol === 'file:' ? '*' : location.origin);
    } catch (e) { /* 親フレームが異なるオリジンでも、エラーで処理が止まらないようにする */ }
  }

  /* シナリオエディタのサイドバー表示用に、ゲーム画面が実際に使っている素材（背景・BGM・
     キャラ画像）の変化をDOM/audio要素そのものから監視し、変わった瞬間に通知する。
     fadeBGMは音量を40msごとに下げてから新しいBGMのsrcを設定する非同期フェード処理であり、
     bgコマンドの背景切り替えもsetTimeoutで800ms遅延しているため、executeStepやコマンド実行の
     タイミングだけを基準にすると、実際に画面に反映されるより前の古い情報を読んでしまう
     ことがある。コマンド実行のタイミングではなく「実際にDOM/audioが変化した瞬間」を直接
     捉えることで、この種のズレを構造的に無くしている。 */
  setupDebugDisplayWatcher() {
    if (window.parent === window) return; /* 親フレームが無い通常プレイ時は監視しない */

    let timer = null;
    const notifySoon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => this.notifyDebugStep(), 30);
    };

    /* 通常の背景（bgコマンド）の変化 */
    new MutationObserver(notifySoon).observe(this.el.bgLayer, { attributes: true, attributeFilter: ['style'] });
    new MutationObserver(notifySoon).observe(this.el.bgLayerNext, { attributes: true, attributeFilter: ['style'] });

    /* chapter（章タイトル）画面の背景・表示/非表示の変化 */
    const chapterScreenEl = this.$('chapter-screen');
    if (chapterScreenEl) {
      new MutationObserver(notifySoon).observe(chapterScreenEl, { attributes: true, attributeFilter: ['class', 'style'] });
    }

    /* BGMの変化。srcを書き換えると、ブラウザは読み込み開始時にloadstartを発火する */
    this.el.bgmPlayer.addEventListener('loadstart', notifySoon);
    this.el.bgmPlayer.addEventListener('emptied', notifySoon);

    /* キャラクター表示（show/hide/hideAll）の変化 */
    Object.values(this.charMap).forEach(el => {
      new MutationObserver(notifySoon).observe(el, { attributes: true, attributeFilter: ['src', 'class'] });
    });
  }

  /* 指定したインデックスより前にある行を遡って、背景・BGM・キャラ表示・エフェクト・
     パーティクル・フラグの状態を再構築する。「途中の行から再生」した時に、本来そこまでの
     進行で設定されているはずの見た目・音が欠けてしまう問題に対応するためのもの。

     フラグについては、実際にそのセッションでプレイ済みの履歴(this.state.history)が
     あればそれを最優先で使う（自分でゲームを進めている場合はそれを反映する）。
     履歴が無い場合は、choiceは常に「最初の選択肢」が選ばれたものとして、
     minigameは「満点クリア」したものとして自動的にフラグを補完する。

     mark/jump/chapter/endは状態を持たない（またはユーザー操作前提）ためスキップする。 */
  reconstructStateUpTo(targetIndex) {
    const getPath = (s) => this.getStepSrc(s);
    let lastBg = null;
    let lastBgm = null;
    const lastShowByPos = {};
    const hiddenPos = new Set();
    const fxByTarget = {};
    let lastParticle = null;
    let flags = {};

    /* 実際にプレイ済みの履歴があれば、targetIndex以下で最も近いスナップショットのflagsを使う */
    let historyFlags = null;
    if (this.state.history && this.state.history.length > 0) {
      for (let h = this.state.history.length - 1; h >= 0; h--) {
        if (this.state.history[h].index <= targetIndex) { historyFlags = this.state.history[h].flags; break; }
      }
    }

    for (let i = 0; i < targetIndex && i < SCENARIO.length; i++) {
      const step = SCENARIO[i];
      const cmd = step.cmd;

      if (cmd === 'bg') {
        lastBg = getPath(step);
      } else if (cmd === 'bgm') {
        lastBgm = getPath(step);
      } else if (cmd === 'show' && step.pos) {
        lastShowByPos[this.baseCharPos(step.pos)] = step;
        hiddenPos.delete(this.baseCharPos(step.pos));
      } else if (cmd === 'hide' && step.pos) {
        hiddenPos.add(this.baseCharPos(step.pos));
      } else if (cmd === 'hideAll') {
        Object.keys(this.charMap).forEach(pos => hiddenPos.add(pos));
      } else if (cmd === 'effect') {
        const targetKey = step.pos === 'screen' ? 'screen' : this.baseCharPos(step.pos);
        if (!targetKey) continue;
        if (step.name === 'clear') { delete fxByTarget[targetKey]; }
        else if (step.pos === 'screen' && step.name === 'shake') { delete fxByTarget[targetKey]; }
        else if (FX_EXIT_MS[step.name] != null) { delete fxByTarget[targetKey]; if (targetKey !== 'screen') hiddenPos.add(targetKey); }
        else if (FX_ONESHOT_MS[step.name] != null) { delete fxByTarget[targetKey]; }
        else { fxByTarget[targetKey] = 'fx-' + step.name; }
      } else if (cmd === 'particle') {
        lastParticle = (step.name === 'clear' || !step.name) ? null : step.name;
      } else if (cmd === 'flag' && step.name) {
        const t = String(step.text).trim().toLowerCase();
        if (t === 'true') flags[step.name] = true;
        else if (t === 'false') flags[step.name] = false;
        else if (t === 'reset' || t === '0') flags[step.name] = 0;
        else { const val = step.text ? parseFloat(step.text) : 1; flags[step.name] = (flags[step.name] || 0) + val; }
      } else if (cmd === 'choice' && !historyFlags) {
        /* プレイ履歴が無い場合、choiceは常に「最初の選択肢」が選ばれたものとして補完する。
           最初の選択肢のグループ（連続するchoice行のうち先頭）のnameを使う。 */
        const nameStr = String(step.name || step.text || '').trim();
        if (nameStr) {
          nameStr.split(/[\s,，、]+/).forEach(part => {
            if (part.includes(':')) { const [key, val] = part.split(':'); flags[key] = parseInt(val, 10); }
            else { flags[part] = true; }
          });
        }
        /* 同じ選択肢グループの残りの行はスキップする（最初の1つだけを「選んだ」とみなすため） */
        while (i + 1 < SCENARIO.length && SCENARIO[i + 1].cmd === 'choice') i++;
      } else if (cmd === 'minigame' && !historyFlags) {
        /* プレイ履歴が無い場合、minigameは「満点クリア」したものとして自動補完する。 */
        flags.minigame_score = 100;
        flags.minigame_clear = true;
      }
    }

    if (historyFlags) flags = { ...flags, ...historyFlags };

    /* 背景を反映する */
    if (lastBg) {
      this.el.bgLayer.style.backgroundImage = `url('${lastBg}')`;
      this.el.bgLayerNext.style.backgroundImage = `url('${lastBg}')`;
      this.el.bgLayerNext.style.opacity = '0';
    }

    /* BGMを反映する（途中再生なので、フェード無しで即座に再生開始する）。
       postMessage経由のジャンプ要求はブラウザの自動再生ポリシー上「ユーザー操作」と
       みなされない場合があり、play()が拒否されることがある。失敗時は画面の
       最初のクリックで再試行する。 */
    if (lastBgm) {
      this.el.bgmPlayer.src = lastBgm;
      this.el.bgmPlayer.volume = settings.bgmVolume;
      this.el.bgmPlayer.play().catch(() => {
        const retryOnClick = () => {
          this.el.bgmPlayer.play().catch(() => {});
          document.removeEventListener('click', retryOnClick);
        };
        document.addEventListener('click', retryOnClick);
      });
    }

    /* キャラ表示を反映する */
    Object.entries(lastShowByPos).forEach(([pos, step]) => {
      const sprite = this.charMap[pos];
      if (!sprite || hiddenPos.has(pos)) return;
      sprite.src = getPath(step);
      sprite.classList.remove('hidden');
      if (this.isFloatPos(step.pos)) sprite.classList.add('char-float'); else sprite.classList.remove('char-float');
      sprite.dataset.charName = step.name || '';
      if (step.name && step.voice_type) this.state.charVoices[step.name] = { type: String(step.voice_type).toLowerCase(), id: step.voice_id || '' };
    });

    /* エフェクトを反映する（反映前に、前回のジャンプ等で残っている可能性のあるfxクラスを
       キャラ・画面すべてから一旦除去してから、今回の算出結果だけを付け直す） */
    for (const pos in this.charMap) {
      Array.from(this.charMap[pos].classList).forEach(c => { if (c.startsWith('fx-')) this.charMap[pos].classList.remove(c); });
    }
    this.clearScreenFx();
    this.state.screenEffect = '';
    Object.entries(fxByTarget).forEach(([targetKey, fxClass]) => {
      const targetEl = targetKey === 'screen' ? this.$('game-canvas') : this.charMap[targetKey];
      if (targetEl) { targetEl.classList.add(fxClass); if (targetKey === 'screen') this.state.screenEffect = fxClass; }
    });

    /* パーティクルを反映する */
    if (lastParticle) {
      if (!this.particleSystem) this.particleSystem = new ParticleSystem(this.$('particle-canvas'));
      this.particleSystem.start(lastParticle);
      this.state.particleType = lastParticle;
    }

    /* フラグを反映する（途中再生のデバッグ用途のため、保存データを上書きしてしまわないようlocalStorageには書かない） */
    this.state.flags = { ...this.state.flags, ...flags };
  }

  startNewGame(startIndex) {
    this.playSysSe(settings.seStart); 
    this.state.index = startIndex || 0;
    
    this.state.flags = JSON.parse(localStorage.getItem(lsKey('global_flags')) || '{}');
    
    this.state.history = []; this.state.logs = []; this.state.charVoices = {}; this.state.currentChapter = '';
    this.clearChoicePath();
    Object.values(this.charMap).forEach(e => { e.classList.add('hidden'); e.src = ''; e.dataset.charName = ''; });
    
    this.el.bgLayer.style.backgroundImage = ''; this.el.bgLayerNext.style.backgroundImage = ''; this.el.overlay.style.opacity = '0';
    this.state.screenEffect = ''; this.state.particleType = '';
    
    const gc = this.$('game-canvas'); 
    Array.from(gc.classList).forEach(c => { if(c.startsWith('fx-')) gc.classList.remove(c); });
    
    if (this.particleSystem) this.particleSystem.stop();
    this.el.bgmPlayer.pause(); 
    this.state.prevScreen = 'game-screen';
    
    const savedSrcKey = localStorage.getItem(lsKey('global_src_key'));
    this.state.currentSrcKey = savedSrcKey || 'src';
    
    /* デバッグ起動（外部エディタから特定行を指定された場合）はキャラセレクトを省略し、即座にシナリオへ進む。
       また、指定行より前の背景・BGM・キャラ表示等の状態を再構築してから開始する。 */
    if (!startIndex && window.app.availableSkins && window.app.availableSkins.length > 1 && !savedSrcKey) {
      this.fadeTransition(() => {
        this.openCharSelect();
      });
    } else {
      if (startIndex) this.reconstructStateUpTo(startIndex);
      this.fadeTransition(() => { this.showScreen('game-screen'); this.executeStep(); });
    }
  }

  evaluateCondition(condStr) {
    if (!condStr) return true; 
    try { const fn = new Function('f', `try { with(f) { return !!(${condStr}); } } catch(e){ return false; }`); return fn(this.state.flags); } catch(e) { return false; }
  }

  executeStep() {
    this.stopTyping();
    if (this.state.index >= SCENARIO.length) { this.endGame(); return; }

    /* シナリオエディタ等の外部ツールから埋め込まれている場合、現在の実行位置とフラグ状態を親フレームに通知する。
       通常プレイ時（親フレームが無い場合）は何も起きない。 */
    this.notifyDebugStep();

    if (this.reviewMode) this.updateReviewLineNumber();

    const step = SCENARIO[this.state.index];

    if (!step.cmd && (!step.text || String(step.text).trim() === '') && !step.text_rubi) {
      if (!this.evaluateCondition(step.cond)) { this.state.index++; this.executeStep(); return; }
      this.el.dialogText.textContent = '';
      if (step.name) {
        const speakingNames = step.name.split(/[＆&・、,と\s]+/);
        Object.values(this.charMap).forEach(charEl => {
          if (charEl.classList.contains('hidden')) return;
          const charName = charEl.dataset.charName || '';
          const isSpeaking = speakingNames.some(n => n === charName || n.toLowerCase() === charName.toLowerCase());
          charEl.classList.toggle('dimmed', !isSpeaking);
        });
        const isHiddenName = (step.name === '（空白）' || step.name === '空白' || step.name === 'なし');
        if (isHiddenName) { this.el.nameTag.classList.add('hidden'); } else { this.el.nameTag.textContent = step.name; this.el.nameTag.classList.remove('hidden'); }
      }
      this.state.index++; this.executeStep(); return;
    }

    if (!this.evaluateCondition(step.cond)) { this.state.index++; this.executeStep(); return; }
    if (step.cmd === 'mark') { this.state.index++; this.executeStep(); return; }
    
    if (step.cmd === 'choice') {
      this.saveSnapshot(); 
      const choices = []; 
      let tempIndex = this.state.index;
      while (tempIndex < SCENARIO.length && SCENARIO[tempIndex].cmd === 'choice') {
        if(this.evaluateCondition(SCENARIO[tempIndex].cond)) { choices.push(SCENARIO[tempIndex]); }
        tempIndex++;
      }
      if (choices.length === 0) { this.state.index = tempIndex; this.executeStep(); return; }
      this.showChoices(choices, tempIndex); 
      return;
    }

    if (step.cmd === 'jump') { this.jumpTo(step.to); return; }
    if (step.cmd) { 
      this.handleCommand(step).then((stop) => { 
        if (stop) return;
        this.state.index++; 
        this.executeStep(); 
      }); 
      return; 
    }

    this.displayDialog(step);
  }

  // REVIEW MODE
  setupReviewMode() {
    this.reviewMode = new URLSearchParams(window.location.search).get('review') === '1';
    if (!this.reviewMode) return;

    const wrapper = document.getElementById('game-wrapper');
    if (!wrapper) return;

    const wmConf = CONFIG.find(c => c.name === 'review_watermark');
    const wmText = (wmConf && typeof wmConf.text === 'string' && wmConf.text !== '') ? wmConf.text : 'REVIEW';

    const wm = document.createElement('div');
    wm.className = 'review-watermark';
    const wmInner = document.createElement('span');
    wmInner.className = 'review-watermark-text';
    wmInner.textContent = wmText;
    wm.appendChild(wmInner);
    wrapper.appendChild(wm);

    const ln = document.createElement('div');
    ln.className = 'review-line-number';
    wrapper.appendChild(ln);
    this.reviewLineEl = ln;
  }

  updateReviewLineNumber() {
    if (!this.reviewMode || !this.reviewLineEl) return;
    this.reviewLineEl.textContent = `L ${this.state.index + 1}`;
  }

  showChoices(choices, nextIndex) {
    this.stopSkip();
    const choiceIndex = this.state.index;
    
    if (this.activeSePlayers) {
      this.activeSePlayers.forEach(p => p.pause());
      this.activeSePlayers = [];
    }
    
    this.stopVoice();

    this.el.choiceUi.innerHTML = '';
    this.el.choiceUi.style.inset = '0'; this.el.choiceUi.style.transform = 'none';

    if (settings.choicePos) {
      const gapMatch = String(settings.choicePos).toLowerCase().match(/gap\s*:?\s*([\d.]+)/);
      if (gapMatch) this.el.choiceUi.style.gap = gapMatch[1] + 'px';
    }

    const isTtsActive = localStorage.getItem(lsKey('global_tts_mode')) === 'true';
    if (window.speechSynthesis && choices.length > 0 && isTtsActive) {
      const ttsParts = [];
      choices.forEach((c, idx) => {
        const rawBtnText = c.text_rubi || c.text || '';
        const btnText = this.formatWakachiText(rawBtnText);
        const textOnly = this.getVoiceText(this.parseTextToTokens(btnText));
        ttsParts.push(`選択肢、${idx + 1}。 ${textOnly}。`);
      });
      
      const ttsText = ttsParts.join(' ');
      const u = new SpeechSynthesisUtterance(ttsText);
      u.lang = 'ja-JP';
      u.volume = settings.voiceVolume; 
      
      const firstChoice = choices[0];
      if (firstChoice && firstChoice.voice_type && String(firstChoice.voice_type).toLowerCase() === 'web') {
        const voices = speechSynthesis.getVoices();
        const vId = String(firstChoice.voice_id || '');
        if (vId !== '') {
          const isIdx = /^\d+$/.test(vId);
          if (isIdx) {
            const idx = parseInt(vId, 10);
            if (voices[idx]) u.voice = voices[idx];
          } else {
            const match = voices.find(v => v.name.includes(vId) || v.voiceURI.includes(vId)); 
            if (match) u.voice = match;
          }
        }
      }
      window.speechSynthesis.speak(u);
    }

    const allGroupFlagNames = [];
    choices.forEach(c => {
      const nameStr = String(c.name || '').trim();
      if (nameStr) {
        const parts = nameStr.split(/[\s,，、]+/);
        parts.forEach(part => {
          const key = part.includes(':') ? part.split(':')[0] : part;
          if (key && !allGroupFlagNames.includes(key)) allGroupFlagNames.push(key);
        });
      } else if (c.text) {
        if (!allGroupFlagNames.includes(c.text)) allGroupFlagNames.push(c.text);
      }
    });

    choices.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn'; 
      
      const rawBtnText = c.text_rubi || c.text || '';
      const btnText = this.formatWakachiText(rawBtnText);
      
      const tokens = this.parseTextToTokens(btnText);
      const inner = document.createElement('span');
      inner.style.position = 'relative'; inner.style.display = 'inline-block'; inner.style.pointerEvents = 'none';
      inner.innerHTML = this.buildRubyHtml(tokens);
      btn.appendChild(inner);

      if (settings.choicePos) {
        const posStr = String(settings.choicePos).toLowerCase();
        if (posStr.includes('center')) btn.style.textAlign = 'center';
        else if (posStr.includes('right')) btn.style.textAlign = 'right';
        const getVal = (key) => { const match = posStr.match(new RegExp(`${key}\\s*:?\\s*([\\d.\\-]+)`)); return match ? match[1] + '%' : null; };
        const topV = getVal('top'); const botV = getVal('bottom'); const leftV = getVal('left'); const rightV = getVal('right');
        if (topV !== null) inner.style.top = topV; if (botV !== null) inner.style.bottom = botV;
        if (leftV !== null) inner.style.left = leftV; if (rightV !== null) inner.style.right = rightV;
      }
      
      if (settings.choiceFont) btn.style.fontFamily = settings.choiceFont;
      if (settings.choiceColor) btn.style.color = settings.choiceColor;
      if (settings.choiceSize) btn.style.fontSize = settings.choiceSize;
      if (settings.choiceOutline) this.applyTextOutline(btn, settings.choiceOutline);

      if (c.font) btn.style.fontFamily = c.font;
      if (c.color) btn.style.color = c.color;
      if (c.fontsize) { const strVal = String(c.fontsize).trim(); btn.style.fontSize = /^\d+$/.test(strVal) ? ((parseInt(strVal, 10) / 1920) * 100) + 'cqw' : strVal; }
      
      if (settings.choiceBg) { btn.classList.add('is-image-btn'); btn.style.backgroundImage = `url('${settings.choiceBg}')`; }
      if (settings.choiceBgPos) {
        const bgPos = String(settings.choiceBgPos).toLowerCase();
        const wMatch = bgPos.match(/width:\s*([\d.]+)/); const hMatch = bgPos.match(/height:\s*([\d.]+)/);
        if (wMatch) { btn.style.width = wMatch[1] + '%'; btn.dataset.fixedWidth = 'true'; }
        if (hMatch) btn.style.height = hMatch[1] + 'cqh';
      }
      
      btn.onclick = (e) => {
        e.stopPropagation();
        
        this.playSysSe(settings.seClick);
        
        const tempFlags = {};
        allGroupFlagNames.forEach(name => {
          if (typeof this.state.flags[name] === 'number') {
            tempFlags[name] = 0; 
          } else {
            tempFlags[name] = false; 
          }
        });

        const nameStr = String(c.name || '').trim();
        if (nameStr) {
          const parts = nameStr.split(/[\s,，、]+/);
          parts.forEach(part => {
            if (part.includes(':')) { 
              const [key, val] = part.split(':'); 
              tempFlags[key] = parseInt(val, 10); 
            } else { 
              tempFlags[part] = true; 
            }
          });
        } else { 
          tempFlags[c.text] = true; 
        }
        
        this.updateGlobalFlags(tempFlags);
        this.recordChoicePath(choiceIndex, this.state.flags);
        
        this.el.choiceUi.style.display = 'none'; this.state.index = nextIndex; 
        if (c.to) { this.jumpTo(c.to); } else { this.executeStep(); }
      };
      this.el.choiceUi.appendChild(btn);
    });
    this.el.choiceUi.style.display = 'flex';

    const choiceBtns = Array.from(this.el.choiceUi.querySelectorAll('.choice-btn')).filter(b => b.dataset.fixedWidth !== 'true');
    if (choiceBtns.length > 0) {
      const maxWidth = Math.max(...choiceBtns.map(b => b.offsetWidth));
      choiceBtns.forEach(b => { b.style.width = (maxWidth + 2) + 'px'; });
    }
  }

  jumpTo(markName) {
    const targetIdx = SCENARIO.findIndex(s => s.cmd === 'mark' && s.text === markName);
    if (targetIdx !== -1) { this.state.index = targetIdx; this.executeStep(); } else { this.state.index++; this.executeStep(); }
  }

  async handleCommand(step) {
    const getPath = (s) => this.getStepSrc(s); 
    const sceneCmds = ['bg', 'fade', 'hide', 'hideAll', 'chapter'];
    if (sceneCmds.includes(step.cmd)) this.el.dialogUi.classList.add('hidden');

    switch (step.cmd) {
      case 'bg': {
        const bgPath = getPath(step); 
        this.el.bgLayerNext.style.backgroundImage = `url('${bgPath}')`; this.el.bgLayerNext.style.opacity = '1';
        setTimeout(() => { this.el.bgLayer.style.backgroundImage = `url('${bgPath}')`; this.el.bgLayerNext.style.opacity = '0'; }, 800);
        break;
      }
      case 'bgm': { this.fadeBGM(getPath(step), true); break; }
      case 'flag': {
        if (!step.name) break;
        const t = String(step.text).trim().toLowerCase();
        const tempFlags = {};
        if (t === 'true') tempFlags[step.name] = true;
        else if (t === 'false') tempFlags[step.name] = false;
        else if (t === 'reset' || t === '0') tempFlags[step.name] = 0;
        else {
          const val = step.text ? parseFloat(step.text) : 1;
          tempFlags[step.name] = (this.state.flags[step.name] || 0) + val;
        }
        this.updateGlobalFlags(tempFlags);
        break;
      }
      case 'se': {
        if (!step.src) {
          this.activeSePlayers.forEach(p => p.pause());
          this.activeSePlayers = [];
          break;
        }
        if (this.state.isSkip) break;
        const sePath = getPath(step);
        const player = new Audio(sePath);
        player.volume = settings.seVolume;
        this.activeSePlayers.push(player);
        const removePlayer = () => {
          this.activeSePlayers = this.activeSePlayers.filter(p => p !== player);
        };
        player.addEventListener('ended', removePlayer);
        player.addEventListener('error', removePlayer);
        await new Promise(resolve => {
          const timeout = setTimeout(resolve, 800);
          player.addEventListener('canplaythrough', () => { clearTimeout(timeout); resolve(); }, { once: true });
          player.addEventListener('error', () => { clearTimeout(timeout); resolve(); }, { once: true });
          if (player.readyState >= 3) { clearTimeout(timeout); resolve(); }
        });
        player.play().catch(removePlayer); 
        break;
      }
      case 'item': {
        this.$('item-img').src = getPath(step); this.$('item-popup').classList.remove('hidden');
        await new Promise(r => { 
          const popup = this.$('item-popup'); 
          popup.onclick = (e) => { 
            if (e) e.stopPropagation(); 
            popup.classList.add('hidden'); 
            popup.onclick = null; 
            r(); 
          }; 
        }); 
        break;
      }
      case 'show': {
        const sprite = this.charMap[this.baseCharPos(step.pos)]; 
        if (sprite) { 
          sprite.src = getPath(step); sprite.classList.remove('hidden'); sprite.dataset.charName = step.name || ''; 
          if (this.isFloatPos(step.pos)) sprite.classList.add('char-float'); else sprite.classList.remove('char-float');
          if (step.name && step.voice_type) this.state.charVoices[step.name] = { type: String(step.voice_type).toLowerCase(), id: step.voice_id || '' };
        } 
        break;
      }
      case 'hide': { const hideEl = this.charMap[this.baseCharPos(step.pos)]; if (hideEl) hideEl.classList.add('hidden'); await new Promise(r => setTimeout(r, 400)); break; }
      case 'hideAll': { Object.values(this.charMap).forEach(e => e.classList.add('hidden')); await new Promise(r => setTimeout(r, 400)); break; }
      case 'fade': { 
        await new Promise(r => { 
          this.el.overlay.style.transition = `opacity ${step.duration||500}ms ease`; 
          const targetStr = String(step.to || step.color || step.text || '').toLowerCase();
          if (targetStr === 'in' || targetStr === 'clear' || targetStr === '') {
            this.el.overlay.style.opacity = '0';
          } else {
            this.el.overlay.style.opacity = '1';
                        if (step.color && targetStr !== 'out') {
              this.el.overlay.style.background = step.color;
            } else {
              this.el.overlay.style.background = 'black';
            }
          }
          
          setTimeout(r, (step.duration||500)+50); 
        }); 
        break; 
      }
      case 'effect': {
        const isScreen = step.pos === 'screen';
        if (step.name === 'clear') {
          if (isScreen) { this.clearScreenFx(); this.state.screenEffect = ''; }
          else { const el = this.charMap[this.baseCharPos(step.pos)]; if (el) Array.from(el.classList).forEach(c => { if(c.startsWith('fx-')) el.classList.remove(c); }); }
          break;
        }
        const fxClass = (isScreen && step.name === 'shake') ? 'fx-screen-shake' : 'fx-' + step.name;
        const targetEl = isScreen ? this.screenFxTarget(fxClass) : this.charMap[this.baseCharPos(step.pos)];
        if (!targetEl) break;
        const exitMs = FX_EXIT_MS[step.name];
        if (exitMs != null && isScreen) break;
        Array.from(targetEl.classList).forEach(c => { if(c.startsWith('fx-')) targetEl.classList.remove(c); });
        
        void targetEl.offsetWidth; targetEl.classList.add(fxClass);
        if (isScreen) this.state.screenEffect = fxClass;
        
        const shakeMs = (isScreen && step.name === 'shake' && !step.duration) ? FX_SHAKE_DEFAULT_MS : null;
        if (exitMs != null) { setTimeout(() => { targetEl.classList.add('hidden'); targetEl.classList.remove(fxClass); }, exitMs); }
        else if (step.duration) { setTimeout(() => { targetEl.classList.remove(fxClass); if (isScreen && this.state.screenEffect === fxClass) this.state.screenEffect = ''; }, step.duration); } 
        else if (shakeMs != null) { setTimeout(() => { targetEl.classList.remove(fxClass); if (isScreen && this.state.screenEffect === fxClass) this.state.screenEffect = ''; }, shakeMs); }
        else if (FX_ONESHOT_MS[step.name]) { setTimeout(() => { targetEl.classList.remove(fxClass); }, FX_ONESHOT_MS[step.name]); }
        break;
      }
      case 'particle': {
        this.state.particleType = step.name;
        if (step.name === 'clear' || !step.name) { if (this.particleSystem) this.particleSystem.stop(); } 
        else { if (!this.particleSystem) this.particleSystem = new ParticleSystem(this.$('particle-canvas')); this.particleSystem.start(step.name); }
        break;
      }
      case 'chapter': { await this.runChapterCommand(step); break; }
      case 'minigame': {
        this.stopSkip();
        this.$('game-menu-bar').classList.add('ui-hidden');
        const isPopup = (step.pos === 'popup'); 
        const container = document.createElement('div');
        if (isPopup) { container.style.cssText = 'position:absolute; inset:0; z-index:200; overflow:hidden; background:rgba(255,255,255,0.16); backdrop-filter:blur(20px);'; } 
        else { container.style.cssText = 'position:absolute; inset:0; z-index:200; overflow:hidden; background:#000;'; }
        
        const iframe = document.createElement('iframe'); 
        iframe.src = getPath(step);
        iframe.setAttribute('scrolling', 'no');
        
        /* 1920x1080を基準にした固定サイズで描画し、画面倍率でスケールする。
           ミニゲーム側がpx指定でも、どのモニターでも画面に対して同じ大きさで表示される。 */
        const stageW = isPopup ? 1536 : 1920;
        const stageH = isPopup ? 864 : 1080;
        iframe.style.cssText = `position:absolute; left:50%; top:50%; width:${stageW}px; height:${stageH}px;` +
          ' transform: translate(-50%, -50%) scale(var(--canvas-scale, 1)); transform-origin: center center;' +
          ` border:none; overflow:hidden; background:${isPopup ? 'transparent' : '#000'};`;
        
        container.appendChild(iframe); this.$('game-canvas').appendChild(container);
        await new Promise(resolve => {
          const timeout = setTimeout(() => { 
            window.removeEventListener('message', onMessage); container.remove(); 
            this.$('game-menu-bar').classList.remove('ui-hidden'); resolve(); 
          }, 300000); 
          const onMessage = (e) => {
            if (e.source !== iframe.contentWindow) return;
            if (e.data && e.data.type === 'MINIGAME_END') { 
              clearTimeout(timeout); window.removeEventListener('message', onMessage); container.remove(); 
              if (e.data.flags) {
                this.updateGlobalFlags(e.data.flags);
              }
              this.$('game-menu-bar').classList.remove('ui-hidden');
              resolve(); 
            }
          };
          window.addEventListener('message', onMessage);
        });
        break;
      }
      case 'end': {
        this.endGame(); 
        return true;
      }
    }
  }

  async runChapterCommand(step) {
    this.stopSkip();
    this.state.currentChapter = step.text || '';
    this.saveAutoSave(this.state.currentChapter);

    let lookAhead = this.state.index + 1;
    while (SCENARIO[lookAhead] && (SCENARIO[lookAhead].cmd === 'bgm' || SCENARIO[lookAhead].cmd === 'se')) {
      const nextStep = SCENARIO[lookAhead];
      const nextPath = this.getStepSrc(nextStep);
      if (nextStep.cmd === 'bgm') {
        this.fadeBGM(nextPath, true);
      } else if (nextStep.cmd === 'se') {
        this.el.sePlayer.src = nextPath;
        this.el.sePlayer.volume = settings.seVolume;
        this.el.sePlayer.play().catch(()=>{});
      }
      this.state.index++;
      lookAhead++;
    }

    this.el.dialogUi.style.display = 'none'; this.$('game-menu-bar').style.display = 'none';
    this.el.bgLayer.style.backgroundImage = ''; this.el.bgLayerNext.style.backgroundImage = '';
    this.state.screenEffect = ''; this.state.particleType = '';
    this.clearScreenFx();
    if (this.particleSystem) this.particleSystem.stop();
    Object.values(this.charMap).forEach(e => { e.classList.add('hidden'); e.src = ''; e.dataset.charName = ''; Array.from(e.classList).forEach(c => { if(c.startsWith('fx-')) e.classList.remove(c); }); });

    const chapSrc = this.getStepSrc(step);
    const srcStr = chapSrc ? String(chapSrc).toLowerCase() : '';
    const isImage = srcStr.endsWith('.png') || srcStr.endsWith('.jpg') || srcStr.endsWith('.jpeg') || srcStr.endsWith('.webp');
    if (chapSrc && !isImage) this.fadeBGM(chapSrc, false);

    const chapScreen = this.$('chapter-screen');
    if (isImage) { chapScreen.style.background = `url('${chapSrc}') center/cover no-repeat`; }
    else if (step.color) { chapScreen.style.background = step.color; }
    else { chapScreen.style.background = '#000'; }

    const chapText = this.$('chapter-text');

    chapText.style.color = step.color || settings.chapterColor || 'var(--ui-text-main)';
    chapText.style.fontFamily = step.font || settings.fontChapter || 'var(--font-main)';
    if (step.fontsize) { const strVal = String(step.fontsize).trim(); chapText.style.fontSize = /^\d+$/.test(strVal) ? ((parseInt(strVal, 10) / 1920) * 100) + 'cqw' : strVal; }
    else { chapText.style.fontSize = 'max(24px, 4cqw)'; }
    this.applyTextOutline(chapText, step.outline || settings.chapterOutline);

    const rawCText = step.text_rubi || step.text || '';
    const cText = this.formatWakachiText(rawCText);
    chapText.innerHTML = this.buildRubyHtml(this.parseTextToTokens(cText)).replace(/\n/g, '<br>');

    const isTtsActive = localStorage.getItem(lsKey('global_tts_mode')) === 'true';
    if (window.speechSynthesis && isTtsActive) {
      window.speechSynthesis.cancel();
      const ttsText = this.getVoiceText(this.parseTextToTokens(cText));
      const u = new SpeechSynthesisUtterance(ttsText);
      u.lang = 'ja-JP';
      u.volume = settings.voiceVolume;

      if (step.voice_type && String(step.voice_type).toLowerCase() === 'web') {
        const voices = speechSynthesis.getVoices();
        const vId = String(step.voice_id || '');
        if (vId !== '') {
          const isIdx = /^\d+$/.test(vId);
          if (isIdx) {
            const idx = parseInt(vId, 10);
            if (voices[idx]) u.voice = voices[idx];
          } else {
            const match = voices.find(v => v.name.includes(vId) || v.voiceURI.includes(vId));
            if (match) u.voice = match;
          }
        }
      }

      setTimeout(() => {
        if (!chapScreen.classList.contains('hidden')) {
          window.speechSynthesis.speak(u);
        }
      }, 1200);
    }

    chapScreen.classList.remove('hidden'); chapScreen.style.animation = 'none'; chapScreen.offsetHeight;
    chapScreen.style.animation = 'chapterFadeInOut 4.5s ease forwards';
    this.notifyDebugStep(); /* 章タイトル表示中（4.5秒待機の間）もサイドバーの表示が更新されるようにする */

    await new Promise(r => setTimeout(r, 4500));
    chapScreen.classList.add('hidden'); this.el.dialogUi.style.display = ''; this.$('game-menu-bar').style.display = '';
  }

  stopVoice() {
    if (this.state.currentVoice) { this.state.currentVoice.pause(); this.state.currentVoice = null; }
    if (this.state.currentVoiceBlobUrl) { URL.revokeObjectURL(this.state.currentVoiceBlobUrl); this.state.currentVoiceBlobUrl = null; }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  parseTextToTokens(text) {
    const tokens = []; let current = 0; const regex = /(?:｜([^《]+)《([^》]+)》)|([一-龠々]+)《([^》]+)》/g; let match;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > current) { const str = text.substring(current, match.index); for (const char of str) tokens.push(char); }
      const kanji = match[1] || match[3]; const ruby = match[2] || match[4];
      tokens.push({ kanji, ruby }); current = regex.lastIndex;
    }
    if (current < text.length) { const str = text.substring(current); for (const char of str) tokens.push(char); }
    return tokens;
  }

  getVoiceText(tokens) { return tokens.map(t => typeof t === 'string' ? t : t.ruby).join(''); }
  
  buildRubyHtml(tokens) { 
    const isHiragana = localStorage.getItem(lsKey('global_hiragana_mode')) === 'true';
    return tokens.map(t => {
      if (typeof t === 'string') return t;
      return isHiragana ? t.ruby : `<ruby>${t.kanji}<rt>${t.ruby}</rt></ruby>`;
    }).join(''); 
  }
  
  async displayDialog(step) {
    this.saveSnapshot(); 
    this.el.dialogUi.classList.remove('hidden');
    if (!this.state.uiHidden) this.$('game-menu-bar').classList.remove('ui-hidden');

    const name = step.name || '';
    
    const rawText = step.text_rubi || step.text || '';
    this.state.fullText = this.formatWakachiText(rawText);
    
    const textTokens = this.parseTextToTokens(this.state.fullText);
    const rubyHtml = this.buildRubyHtml(textTokens);
    const voiceText = this.getVoiceText(textTokens);
    
    this.el.dialogText.style.fontFamily = step.font || 'var(--font-main)';
    this.el.dialogText.style.color = step.color || 'var(--text-main)';
    if (step.fontsize) { const strVal = String(step.fontsize).trim(); this.el.dialogText.style.fontSize = /^\d+$/.test(strVal) ? ((parseInt(strVal, 10) / 1920) * 100) + 'cqw' : strVal; } 
    else { this.el.dialogText.style.fontSize = settings.dialogFontSize || 'max(15px, 1.6cqw)'; }
    this.applyTextOutline(this.el.dialogText, step.outline || settings.dialogOutline);

    const isHiddenName = (name === '（空白）' || name === '空白' || name === 'なし');
    const logName = isHiddenName ? '' : name;
    if (this.state.logs.length === 0 || this.state.logs[this.state.logs.length - 1].index !== this.state.index) {
      this.state.logs.push({ index: this.state.index, name: logName, text: rubyHtml });
    }

    if (name && !isHiddenName) { this.el.nameTag.textContent = name; this.el.nameTag.classList.remove('hidden'); } 
    else { this.el.nameTag.classList.add('hidden'); }

    const speakingNames = name ? name.split(/[＆&・、,\s]+/) : [];
    Object.values(this.charMap).forEach(charEl => {
      if (charEl.classList.contains('hidden')) return;
      const charName = charEl.dataset.charName || '';
      const isSpeaking = speakingNames.some(n => n === charName || n.toLowerCase() === charName.toLowerCase());
      charEl.classList.toggle('dimmed', name && !isSpeaking);
    });

    this.state.typing = true; this.el.dialogText.innerHTML = ''; this.el.nextArrow.classList.remove('visible'); 
    this.stopVoice();
    
    let audioSrc = this.getStepSrc(step); 
    let isWebSpeech = false; let webSpeechText = ''; let webSpeechVoiceId = '';
    const currentIndex = this.state.index; 
    const isTtsActive = localStorage.getItem(lsKey('global_tts_mode')) === 'true';
    if (!audioSrc) {
      let vConf = null;
      if (step.voice_type && isTtsActive) {
        vConf = { type: String(step.voice_type).toLowerCase(), id: step.voice_id !== undefined ? String(step.voice_id) : '' };
      } else if (name && !isHiddenName && isTtsActive) {
        for (const n of speakingNames) { if (this.state.charVoices[n]) { vConf = this.state.charVoices[n]; break; } }
      }
      
      if (vConf) {
        if (vConf.type === 'web') { isWebSpeech = true; webSpeechText = voiceText; webSpeechVoiceId = vConf.id; } 
        else if (vConf.type === 'voicevox') {
          const generateAndPlayVoicevox = async () => {
            try {
              const apiUrl = settings.ttsApiUrl.replace(/\/$/, '').replace('127.0.0.1', 'localhost');
              const qRes = await fetch(`${apiUrl}/audio_query?text=${encodeURIComponent(voiceText)}&speaker=${vConf.id}`, { method: 'POST', mode: 'cors' });
              if (qRes.ok) {
                const query = await qRes.json();
                const sRes = await fetch(`${apiUrl}/synthesis?speaker=${vConf.id}`, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(query) });
                if (sRes.ok) {
                  const blob = await sRes.blob(); 
                  if (currentIndex !== this.state.index || this.state.isSkip) return;
                  const blobUrl = URL.createObjectURL(blob); 
                  this.state.currentVoiceBlobUrl = blobUrl; this.state.currentVoice = new Audio(blobUrl); 
                  this.state.currentVoice.volume = settings.voiceVolume; this.state.currentVoice.play().catch(()=>{});
                }
              }
            } catch (e) { console.warn("VOICEVOX通信エラー", e); }
          };
          generateAndPlayVoicevox();
        }
      }
    }
    
    if (audioSrc) {
      this.state.currentVoice = new Audio(audioSrc); this.state.currentVoice.volume = settings.voiceVolume;
      const voiceLoadIndex = this.state.index;
      await new Promise(resolve => {
        const timeout = setTimeout(resolve, 800);
        if (this.state.currentVoice) {
          this.state.currentVoice.addEventListener('canplaythrough', () => { clearTimeout(timeout); resolve(); }, { once: true });
          this.state.currentVoice.addEventListener('error', () => { clearTimeout(timeout); resolve(); }, { once: true });
          if (this.state.currentVoice.readyState >= 3) { clearTimeout(timeout); resolve(); }
        } else {
          clearTimeout(timeout); resolve();
        }
      });
      if (this.state.index !== voiceLoadIndex || !this.state.currentVoice || this.state.isSkip) return;
      this.state.currentVoice.play().catch(()=>{});
      
    } else if (isWebSpeech && window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(webSpeechText); 
      u.lang = 'ja-JP'; 
      u.volume = settings.voiceVolume * 1.0;
      
      const voices = speechSynthesis.getVoices();
      if (webSpeechVoiceId !== '') {
        const isIdx = /^\d+$/.test(webSpeechVoiceId);
        if (isIdx) {
          const idx = parseInt(webSpeechVoiceId, 10);
          if (voices[idx]) {
            u.voice = voices[idx];
          }
        } else {
          const match = voices.find(v => v.name.includes(webSpeechVoiceId) || v.voiceURI.includes(webSpeechVoiceId)); 
          if (match) u.voice = match;
        }
      }
      if (this.state.typing) speechSynthesis.speak(u);
    }

    if (!this.state.typing) return;
    
      let i = 0;
      const typeChar = () => {
        if (i < textTokens.length) {
          const token = textTokens[i];
          if (typeof token === 'string') { 
            this.el.dialogText.appendChild(document.createTextNode(token)); 
          } else {
            const isHiragana = localStorage.getItem(lsKey('global_hiragana_mode')) === 'true';
            if (isHiragana) {
              this.el.dialogText.appendChild(document.createTextNode(token.ruby));
            } else {
              const rubyEl = document.createElement('ruby');
              const kanjiText = document.createTextNode(token.kanji);
              rubyEl.appendChild(kanjiText);
              const rtEl = document.createElement('rt');
              rtEl.textContent = token.ruby;
              rubyEl.appendChild(rtEl);
              this.el.dialogText.appendChild(rubyEl);
            }
          }
          i++; this.state.typingTimer = setTimeout(typeChar, this.state.isSkip ? 5 : settings.textSpeed);
        } else { this.finishTyping(); }
      };
    typeChar();
  }

scheduleAutoAdvance() {
    clearTimeout(this.state.autoTimer);
    const isSePlaying = this.activeSePlayers && this.activeSePlayers.length > 0;
    const isAudioVoicePlaying = this.state.currentVoice && !this.state.currentVoice.ended;
    const isWebSpeechSpeaking = window.speechSynthesis && window.speechSynthesis.speaking;
    const isAnyVoicePlaying = isAudioVoicePlaying || isWebSpeechSpeaking;
    
    if (isSePlaying || isAnyVoicePlaying) {
      this.state.autoTimer = setTimeout(() => this.scheduleAutoAdvance(), 200);
    } else {
      const finishedTime = this.state.textFinishedTime || Date.now();
      const elapsed = Date.now() - finishedTime;
      const remainingDelay = Math.max(0, settings.autoDelay - elapsed);
      this.state.autoTimer = setTimeout(() => this.advanceStory(), remainingDelay);
    }
  }

finishTyping() {
    this.state.typing = false; 
    this.el.dialogText.innerHTML = this.buildRubyHtml(this.parseTextToTokens(this.state.fullText)); 
    this.el.nextArrow.classList.add('visible');
    this.state.textFinishedTime = Date.now();
    if (this.state.isAuto) this.scheduleAutoAdvance();
  }

  stopTyping() { clearTimeout(this.state.typingTimer); clearTimeout(this.state.autoTimer); this.state.typingTimer = this.state.autoTimer = null; this.state.typing = false; }

  onDialogClick(e) { 
    if (e && e.target.closest('button')) return; 
    if (this.state.uiHidden || this.el.choiceUi.style.display === 'flex') return; 
    if (this.state.isSkip) this.stopSkip();
    if (this.state.typing) { this.stopTyping(); this.finishTyping(); } else { this.advanceStory(); } 
  }

  advanceStory() { if (this.state.index >= SCENARIO.length) return; if (!SCENARIO[this.state.index].cmd) { this.state.index++; this.executeStep(); } }

toggleAuto() { 
    this.playSysSe(settings.seClick); 
    this.state.isAuto = !this.state.isAuto; 
    this.$('btn-auto').classList.toggle('on', this.state.isAuto); 
    
    const autoBadge = this.$('auto-badge');
    if (autoBadge) {
      autoBadge.classList.toggle('hidden', !this.state.isAuto);
    }
    
    if (this.state.isAuto && !this.state.typing) { 
      this.scheduleAutoAdvance(); 
    } else { 
      clearTimeout(this.state.autoTimer); 
    }
  }

  startSkip() { 
    if (this.state.isSkip) return;
    this.playSysSe(settings.seClick); 
    this.state.isSkip = true; 
    this.$('skip-overlay').style.display = 'block'; 
    this.state.skipTimer = setInterval(() => { 
      if (this.el.choiceUi.style.display === 'flex') { this.stopSkip(); } 
      else if (this.state.index < SCENARIO.length) { 
        if (this.state.typing) { this.stopTyping(); this.finishTyping(); } 
        else { this.advanceStory(); } 
      } 
      else { this.stopSkip(); } 
    }, 60); 
  }

  stopSkip() { this.state.isSkip = false; clearInterval(this.state.skipTimer); this.$('skip-overlay').style.display = 'none'; }

endGame() { 
    this.stopTyping(); this.stopSkip(); this.state.isAuto = false; this.$('btn-auto').classList.remove('on'); 
    
    const autoBadge = this.$('auto-badge');
    if (autoBadge) autoBadge.classList.add('hidden');
    
    this.stopVoice(); this.fadeBGM(''); this.state.screenEffect = ''; this.state.particleType = '';

    
    if (this.activeSePlayers) {
      this.activeSePlayers.forEach(p => p.pause());
      this.activeSePlayers = []; }
    
    this.clearScreenFx();
    if (this.particleSystem) this.particleSystem.stop();
    for (const pos in this.charMap) { Array.from(this.charMap[pos].classList).forEach(c => { if(c.startsWith('fx-')) this.charMap[pos].classList.remove(c); }); }
    this.state.prevScreen = 'title-screen';
    
    this.fadeTransition(() => { 
      this.showScreen('title-screen'); 
      if (settings.titleBgm) {
        this.fadeBGM(settings.titleBgm); 
      } else {
        if (this.state.bgmFadeTimer) clearInterval(this.state.bgmFadeTimer);
        this.el.bgmPlayer.pause();
        this.el.bgmPlayer.src = '';
        this.state.currentBgm = '';
      }
    }); 
  }

  isTransientFx(fxClass) {
    const name = fxClass.replace(/^fx-/, '');
    return FX_ONESHOT_MS[name] != null || FX_EXIT_MS[name] != null;
  }

  computeCharFxUpTo(targetIndex) {
    const fxByPos = {};
    for (let i = 0; i < targetIndex && i < SCENARIO.length; i++) {
      const s = SCENARIO[i];
      if (s.cmd === 'show' && s.pos) { delete fxByPos[this.baseCharPos(s.pos)]; continue; }
      if (s.cmd === 'hide' && s.pos) { delete fxByPos[this.baseCharPos(s.pos)]; continue; }
      if (s.cmd === 'hideAll') { Object.keys(fxByPos).forEach(p => delete fxByPos[p]); continue; }
      if (s.cmd !== 'effect') continue;
      const pos = this.baseCharPos(s.pos);
      if (!pos || pos === 'screen') continue;
      if (s.name === 'clear' || FX_EXIT_MS[s.name] != null || FX_ONESHOT_MS[s.name] != null) { delete fxByPos[pos]; }
      else { fxByPos[pos] = 'fx-' + s.name; }
    }
    return fxByPos;
  }

  saveSnapshot() {
    if (this.state.history.length > 0 && this.state.history[this.state.history.length - 1].index === this.state.index) return;
    const charsSnap = {};
    for(const pos in this.charMap) { 
      const effect = Array.from(this.charMap[pos].classList).filter(c => c.startsWith('fx-') && !this.isTransientFx(c)).join(' ');
      charsSnap[pos] = { src: this.charMap[pos].src, hidden: this.charMap[pos].classList.contains('hidden'), name: this.charMap[pos].dataset.charName, effect: effect, float: this.charMap[pos].classList.contains('char-float') }; 
    }
    const targetBg = this.el.bgLayerNext.style.opacity === '1' ? this.el.bgLayerNext.style.backgroundImage : this.el.bgLayer.style.backgroundImage;
    this.state.history.push({ 
      index: this.state.index, 
      flags: JSON.parse(JSON.stringify(this.state.flags)), 
      charVoices: JSON.parse(JSON.stringify(this.state.charVoices)), 
      bg: targetBg, 
      bgm: this.state.currentBgm || '', 
      chars: charsSnap, 
      screenEffect: this.state.screenEffect, 
      particleType: this.state.particleType,
      currentChapter: this.state.currentChapter, 
      chapterStartData: this.state.chapterStartData,
      currentSrcKey: this.state.currentSrcKey
    });
    if (this.state.history.length > 1000) this.state.history.shift();
  }

  applyTextOutline(element, outlineStr) {
    element.style.webkitTextStroke = '';
    if (!outlineStr) { element.style.textShadow = '1px 1px 2px rgba(0,0,0,0.8)'; return; }
    const lower = outlineStr.toLowerCase();
    if (lower === 'none' || lower === 'off') { element.style.textShadow = 'none'; return; }
    
    let tempStr = outlineStr;
    const colorFuncs = [];
    tempStr = tempStr.replace(/(rgba?|hsla?)\([^)]+\)/gi, match => {
      colorFuncs.push(match);
      return `__COLOR_${colorFuncs.length - 1}__`;
    });

    let parts = tempStr.split(',').map(s => s.trim());
    if (parts.length === 1 && tempStr.includes(' ')) parts = tempStr.split(/\s+/).map(s => s.trim()); 
    
    parts = parts.map(p => p.replace(/__COLOR_(\d+)__/g, (_, i) => colorFuncs[i]));

    let hasDs = false; let strokeWidthStr = ''; let strokeColor = '';

    parts.forEach(p => { if (p.toLowerCase() === 'ds') { hasDs = true; } else if (/\d/.test(p)) { strokeWidthStr = p; } else { strokeColor = p; } });
    const widthMatch = strokeWidthStr.match(/[\d.]+/); const strokeWidth = widthMatch ? parseFloat(widthMatch[0]) : 0;
    
    let shadows = [];
    if (strokeWidth > 0 && strokeColor) {
      const steps = Math.min(36, Math.max(12, Math.ceil(strokeWidth * 5)));
      for (let i = 0; i < steps; i++) {
        const angle = (i * 2 * Math.PI) / steps; const x = (Math.cos(angle) * strokeWidth).toFixed(2); const y = (Math.sin(angle) * strokeWidth).toFixed(2);
        shadows.push(`${x}px ${y}px 0px ${strokeColor}`);
      }
      if (strokeWidth > 2) {
        const halfWidth = strokeWidth / 2; const halfSteps = Math.min(20, Math.ceil(steps / 2));
        for (let i = 0; i < halfSteps; i++) {
          const angle = (i * 2 * Math.PI) / halfSteps; const x = (Math.cos(angle) * halfWidth).toFixed(2); const y = (Math.sin(angle) * halfWidth).toFixed(2);
          shadows.push(`${x}px ${y}px 0px ${strokeColor}`);
        }
      }
    }
    if (hasDs) {
      let dropDistance = Math.max(4, strokeWidth * 0.5); const offsetY = strokeWidth + dropDistance; const blurRadius = dropDistance;
      const shadowColor = strokeColor ? `color-mix(in srgb, ${strokeColor} 30%, black)` : 'rgba(0,0,0,0.9)'; shadows.push(`0px ${offsetY}px ${blurRadius}px ${shadowColor}`);
    }
    element.style.textShadow = shadows.length > 0 ? shadows.join(', ') : 'none';
  }

  goBack() {
    this.playSysSe(settings.seClick);
    if (this.state.history.length === 0 || this.state.isSkip || this.state.isAuto) return;
    
    if (this.activeSePlayers) {
      this.activeSePlayers.forEach(p => p.pause());
      this.activeSePlayers = [];
    }
    
    this.stopVoice(); this.stopTyping(); this.el.choiceUi.style.display = 'none';
    
    let snap = this.state.history.pop();
    
    if (snap && snap.index === this.state.index && this.state.history.length > 0) {
      snap = this.state.history.pop();
    }
    
    this.state.logs = this.state.logs.filter(l => l.index < snap.index); 
    this.trimChoicePath(snap.index);
    this.state.index = snap.index; 
    this.state.flags = JSON.parse(localStorage.getItem(lsKey('global_flags')) || '{}'); 
    this.state.charVoices = JSON.parse(JSON.stringify(snap.charVoices || {})); 
    this.state.currentChapter = snap.currentChapter || ''; 
    this.state.chapterStartData = snap.chapterStartData || null;
    this.state.currentSrcKey = snap.currentSrcKey || 'src';
    this.el.bgLayer.style.backgroundImage = snap.bg;
    this.fadeBGM(snap.bgm || '', true); 
    
    const recomputedFx = this.computeCharFxUpTo(snap.index);
    for(const pos in this.charMap) {
      Array.from(this.charMap[pos].classList).forEach(c => { if(c.startsWith('fx-')) this.charMap[pos].classList.remove(c); });
      if(snap.chars[pos]) {
        this.charMap[pos].src = snap.chars[pos].src || ''; this.charMap[pos].dataset.charName = snap.chars[pos].name || '';
        if (snap.chars[pos].hidden) { this.charMap[pos].classList.add('hidden'); } else { this.charMap[pos].classList.remove('hidden'); }
        if (snap.chars[pos].float) { this.charMap[pos].classList.add('char-float'); } else { this.charMap[pos].classList.remove('char-float'); }
      }
      if (recomputedFx[pos]) this.charMap[pos].classList.add(recomputedFx[pos]);
    }
    
    this.clearScreenFx();
    this.state.screenEffect = (snap.screenEffect && snap.screenEffect !== 'fx-screen-shake') ? snap.screenEffect : '';
    if (this.state.screenEffect) this.$('game-canvas').classList.add(this.state.screenEffect);
    this.state.particleType = snap.particleType || '';
    if (!this.state.particleType || this.state.particleType === 'clear') { if (this.particleSystem) this.particleSystem.stop(); } 
    else { if (!this.particleSystem) this.particleSystem = new ParticleSystem(this.$('particle-canvas')); this.particleSystem.start(this.state.particleType); }
    this.executeStep();
  }

    async rewindTo(targetIndex) {
    const ok = await this.showConfirm('この時点まで巻き戻しますか？\n（一度獲得したフラグ・ポイントはそのまま引き継がれます）');
    if (!ok) return;
    
    this.playSysSe(settings.seClick);
    const targetSnapIndex = this.state.history.findIndex(h => h.index === targetIndex);
    if (targetSnapIndex === -1) { alert('履歴が古すぎるため、この時点までは戻れません。'); return; }
    
    this.stopVoice(); this.stopTyping(); this.el.choiceUi.style.display = 'none';
    const snap = this.state.history[targetSnapIndex];
    this.state.history = this.state.history.slice(0, targetSnapIndex); this.state.logs = this.state.logs.filter(l => l.index < targetIndex);
    this.trimChoicePath(targetIndex);
    this.state.index = snap.index; this.state.flags = JSON.parse(localStorage.getItem(lsKey('global_flags')) || '{}'); this.state.charVoices = JSON.parse(JSON.stringify(snap.charVoices || {}));
    this.state.currentChapter = snap.currentChapter || ''; 
    this.state.chapterStartData = snap.chapterStartData || null;
    this.state.currentSrcKey = snap.currentSrcKey || 'src';
    this.el.bgLayer.style.backgroundImage = snap.bg;
    if (snap.bgm && this.el.bgmPlayer.src !== snap.bgm) { this.fadeBGM(snap.bgm, true); } else if (!snap.bgm) { this.fadeBGM(''); }
    
    const recomputedFx = this.computeCharFxUpTo(snap.index);
    for(const pos in this.charMap) {
      Array.from(this.charMap[pos].classList).forEach(c => { if(c.startsWith('fx-')) this.charMap[pos].classList.remove(c); });
      if(snap.chars[pos]) {
        this.charMap[pos].src = snap.chars[pos].src || ''; this.charMap[pos].dataset.charName = snap.chars[pos].name || '';
        if (snap.chars[pos].hidden) { this.charMap[pos].classList.add('hidden'); } else { this.charMap[pos].classList.remove('hidden'); }
        if (snap.chars[pos].float) { this.charMap[pos].classList.add('char-float'); } else { this.charMap[pos].classList.remove('char-float'); }
      }
      if (recomputedFx[pos]) this.charMap[pos].classList.add(recomputedFx[pos]);
    }
    
    this.clearScreenFx();
    this.state.screenEffect = (snap.screenEffect && snap.screenEffect !== 'fx-screen-shake') ? snap.screenEffect : '';
    if (this.state.screenEffect) this.$('game-canvas').classList.add(this.state.screenEffect);
    this.state.particleType = snap.particleType || '';
    if (!this.state.particleType || this.state.particleType === 'clear') { if (this.particleSystem) this.particleSystem.stop(); } 
    else { if (!this.particleSystem) this.particleSystem = new ParticleSystem(this.$('particle-canvas')); this.particleSystem.start(this.state.particleType); }
    this.closeLog(); this.executeStep();
  }

  setPrevScreenForPopup() { const active = document.querySelector('.screen.active:not(.popup-overlay)')?.id; if (active) this.state.prevScreen = active; }

  openLog() {
    if (this.state.isSkip) this.stopSkip();
    this.playSysSe(settings.seClick); this.setPrevScreenForPopup();
    const container = this.$('log-list'); container.innerHTML = '';
    this.state.logs.forEach(l => {
      const item = document.createElement('div'); item.className = 'log-item'; item.innerHTML = `<div class="log-name">${l.name}</div><div class="log-text">${l.text}</div>`;
      item.title = 'クリックしてこの時点まで巻き戻す'; item.onclick = () => this.rewindTo(l.index); container.appendChild(item);
    });
    this.showScreen('log-screen'); container.scrollTop = container.scrollHeight;
  }
  closeLog() { this.playSysSe(settings.seClick); this.showScreen(this.state.prevScreen); }

  openSaveLoad(mode) { 
    if (this.state.isSkip) this.stopSkip();
    this.playSysSe(settings.seClick); this.setPrevScreenForPopup(); 
    this.$('save-mode-title').textContent = mode.toUpperCase(); this.renderSaveSlots(mode); this.showScreen('save-screen'); 
  }
  closeSaveLoad() { this.playSysSe(settings.seClick); this.showScreen(this.state.prevScreen); }
  
  createSaveData(label) {
    const charsData = {};
    for(const pos in this.charMap) { 
      const effect = Array.from(this.charMap[pos].classList).filter(c => c.startsWith('fx-') && !this.isTransientFx(c)).join(' ');
      charsData[pos] = { src: this.charMap[pos].src, hidden: this.charMap[pos].classList.contains('hidden'), name: this.charMap[pos].dataset.charName, effect: effect, float: this.charMap[pos].classList.contains('char-float') }; 
    }
    const targetBg = this.el.bgLayerNext.style.opacity === '1' ? this.el.bgLayerNext.style.backgroundImage : this.el.bgLayer.style.backgroundImage;
    return { 
      version: ENGINE_INFO.version,
      dataFormatVersion: ENGINE_INFO.dataFormatVersion,
      index: this.state.index, 
      flags: JSON.parse(JSON.stringify(this.state.flags)), 
      charVoices: JSON.parse(JSON.stringify(this.state.charVoices)), 
      bg: targetBg, 
      bgm: this.state.currentBgm || '', 
      chars: charsData, 
      label: label, 
      screenEffect: this.state.screenEffect, 
      particleType: this.state.particleType,
      currentChapter: this.state.currentChapter,
      currentSrcKey: this.state.currentSrcKey,
      choicePath: this.loadChoicePath()
    };
  }

  renderSaveSlots(mode) {
    const container = this.$('save-slots'); container.innerHTML = '';
    const usedSlots = []; for (let i = 1; i <= 99; i++) { if (localStorage.getItem(lsKey(`save_slot_${i}`))) usedSlots.push(i); }
    const maxSlotIndex = usedSlots.length > 0 ? Math.max(...usedSlots) : 0;
    let displayCount = 4; while (usedSlots.length >= displayCount || maxSlotIndex >= displayCount) { displayCount += 2; }

    for (let i = 1; i <= displayCount; i++) {
      const data = JSON.parse(localStorage.getItem(lsKey(`save_slot_${i}`)) || 'null');
      const slot = document.createElement('div'); slot.className = 'save-slot';
      slot.innerHTML = `<div class="save-slot-num">SLOT ${i}</div><div class="save-slot-info">${data ? data.label : 'NO DATA'}</div>`;
      slot.onclick = () => { if (mode === 'save') { this.saveToSlot(i); } else if (data) { this.loadFromSlot(i); } };

      if (data) {
        const delBtn = document.createElement('button'); delBtn.className = 'save-slot-del'; delBtn.textContent = 'DEL';
        delBtn.onclick = async (e) => { 
          e.stopPropagation(); 
          const ok = await this.showConfirm(`SLOT ${i} のセーブデータを削除しますか？`);
          if (ok) { 
            localStorage.removeItem(lsKey(`save_slot_${i}`)); 
            this.renderSaveSlots(mode); 
          } 
        };
        slot.appendChild(delBtn);
      }
      container.appendChild(slot);
    }

    if (mode === 'load') {
      const autoSaves = JSON.parse(localStorage.getItem(lsKey('save_auto_list')) || '[]'); autoSaves.sort((a, b) => a.index - b.index);
      autoSaves.forEach((autoData, idx) => {
        const autoSlot = document.createElement('div'); autoSlot.className = 'save-slot auto-save-slot';
        autoSlot.innerHTML = `<div class="save-slot-num">AUTO SAVE ${idx + 1}</div><div class="save-slot-info">再開：${autoData.label}</div>`;
        autoSlot.onclick = () => this.loadSaveData(autoData); container.appendChild(autoSlot);
      });
    }
    const resetBtn = this.$('reset-all-btn'); if (resetBtn) resetBtn.style.display = (mode === 'load') ? 'block' : 'none';
    const reflectionBtn = this.$('reflection-open-btn');
    if (reflectionBtn) {
      const showReflection = (mode === 'load') && settings.reflectionSheet;
      reflectionBtn.style.display = showReflection ? 'block' : 'none';
      if (showReflection) reflectionBtn.innerHTML = this.labelHtml(reflectionBtn.dataset.rfLabel);
    }
  }

  saveToSlot(slot) {
    const step = SCENARIO[this.state.index];
    const preview = step && !step.cmd && step.text ? step.text.replace(/\n/g, '').slice(0, 15) + '…' : `Save #${this.state.index}`;
    const now = new Date(); const label = `${now.getMonth()+1}/${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')} ${preview}`;
    const data = this.createSaveData(label); 
    localStorage.setItem(lsKey(`save_slot_${slot}`), JSON.stringify(data)); this.renderSaveSlots('save');
  }

  saveAutoSave(chapterText) {
    const labelStr = `【${chapterText}】`; 
    const data = this.createSaveData(labelStr);
    
    let autoSaves = [];
    try {
      autoSaves = JSON.parse(localStorage.getItem(lsKey('save_auto_list')) || '[]');
      if (!Array.isArray(autoSaves)) autoSaves = [];
    } catch(e) {
      autoSaves = [];
    }
    const existingIndex = autoSaves.findIndex(save => save.label === labelStr);
    if (existingIndex !== -1) {
      autoSaves[existingIndex] = data;
    } else {
      autoSaves.push(data);
    }
    
    autoSaves.sort((a, b) => a.index - b.index);
    localStorage.setItem(lsKey('save_auto_list'), JSON.stringify(autoSaves));
  }

  loadSaveData(data) {
    if (!data) return;
    if (data.dataFormatVersion !== ENGINE_INFO.dataFormatVersion) {
      console.warn(`セーブデータのdataFormatVersionが一致しません（データ: ${data.dataFormatVersion === undefined ? 'なし' : data.dataFormatVersion} / エンジン: ${ENGINE_INFO.dataFormatVersion}）。互換処理は将来対応予定です。`);
    }
    this.state.index = data.index; 
    this.state.flags = JSON.parse(localStorage.getItem(lsKey('global_flags')) || '{}'); 
    this.state.charVoices = data.charVoices || {}; 
    this.state.currentChapter = data.currentChapter || '';
    this.state.chapterStartData = data.chapterStartData || null;
    this.state.currentSrcKey = localStorage.getItem(lsKey('global_src_key')) || data.currentSrcKey || 'src';
    this.state.history = []; this.state.logs = []; this.closeSaveLoad(); this.state.prevScreen = 'game-screen';
    /* セーブ時点まで巻き戻すので、選択履歴もそのセーブのものに置き換える */
    if (Array.isArray(data.choicePath)) localStorage.setItem(lsKey('play_path'), JSON.stringify(data.choicePath));
    
    this.fadeTransition(() => { 
      this.showScreen('game-screen'); this.el.dialogUi.classList.add('hidden'); 
      if (data.bg) { this.el.bgLayer.style.backgroundImage = data.bg; } else { this.el.bgLayer.style.backgroundImage = ''; }
      if (data.bgm) { this.fadeBGM(data.bgm, true); } else { this.fadeBGM(''); }
      
      if (data.chars) {
        const recomputedFx = this.computeCharFxUpTo(data.index);
        for(const pos in this.charMap) {
          if(data.chars[pos]) {
            this.charMap[pos].src = data.chars[pos].src || ''; this.charMap[pos].dataset.charName = data.chars[pos].name || '';
            if (data.chars[pos].hidden) { this.charMap[pos].classList.add('hidden'); } else { this.charMap[pos].classList.remove('hidden'); }
            if (data.chars[pos].float) { this.charMap[pos].classList.add('char-float'); } else { this.charMap[pos].classList.remove('char-float'); }
            Array.from(this.charMap[pos].classList).forEach(c => { if(c.startsWith('fx-')) this.charMap[pos].classList.remove(c); });
            if (recomputedFx[pos]) this.charMap[pos].classList.add(recomputedFx[pos]);
          }
        }
      }

      this.clearScreenFx();
      this.state.screenEffect = (data.screenEffect && data.screenEffect !== 'fx-screen-shake') ? data.screenEffect : '';
      if (this.state.screenEffect) this.$('game-canvas').classList.add(this.state.screenEffect);
      this.state.particleType = data.particleType || '';
      if (!this.state.particleType || this.state.particleType === 'clear') { if (this.particleSystem) this.particleSystem.stop(); } 
      else { if (!this.particleSystem) this.particleSystem = new ParticleSystem(this.$('particle-canvas')); this.particleSystem.start(this.state.particleType); }
      this.executeStep(); 
    });
  }

  loadFromSlot(slot) { this.loadSaveData(JSON.parse(localStorage.getItem(lsKey(`save_slot_${slot}`)))); }

  async resetAllSaves() {
    this.playSysSe(settings.seClick);
    const ok = await this.showConfirm("すべてのセーブデータを削除します。\nよろしいですか？");
    if (ok) {
      for (let i = 1; i <= 99; i++) { localStorage.removeItem(lsKey(`save_slot_${i}`)); }
      localStorage.removeItem(lsKey('save_slot_auto')); localStorage.removeItem(lsKey('save_auto_list'));
      localStorage.removeItem(lsKey('global_src_key'));
      localStorage.removeItem(lsKey('global_flags')); 
      localStorage.removeItem(lsKey('play_path'));
      this.renderSaveSlots(this.state.saveMode); 
      this.$('continue-btn').disabled = true;
    }
  }


  // ===== REFLECTION SHEET / PATH TRACE =====
  gradeLabel(text) {
    /* 【】で囲んだ範囲は「ひらがなに開くなら丸ごと開く」単位。混在した中途半端な表記を防ぐ */
    const resolve = (body) => {
      const learned = Array.from(body.replace(/《[^》]*》/g, '')).every(ch => !/[一-龠々]/.test(ch) || (REFLECTION_KANJI_GRADE[ch] || 99) <= settings.rubyGrade);
      return learned ? body : body.replace(/｜([^《]+)《([^》]+)》/g, (m, kanji, yomi) => yomi);
    };
    return String(text || '')
      .replace(/【([^】]*)】/g, (m, body) => resolve(body))
      .replace(/｜[^《]+《[^》]+》/g, (m) => resolve(m));
  }

  labelHtml(raw) {
    return this.buildRubyHtml(this.reflectionTokens(this.gradeLabel(raw)));
  }

  applyReflectionLabels() {
    document.querySelectorAll('[data-rf-label]').forEach(el => { el.innerHTML = this.labelHtml(el.dataset.rfLabel); });
  }

  /* 選択直後のフラグ状態を選択肢グループの行番号ごとに保存する。
     global_flagsは同じフラグ名が後の選択肢で上書きされるため、これが無いと
     どの選択肢を選んだのかを後から判定できない。 */
  recordChoicePath(index, flags) {
    let path = this.loadChoicePath();
    path = path.filter(entry => entry.index !== index);
    path.push({ index, flags: JSON.parse(JSON.stringify(flags)) });
    if (path.length > 500) path.shift();
    localStorage.setItem(lsKey('play_path'), JSON.stringify(path));
  }

  loadChoicePath() {
    try {
      const path = JSON.parse(localStorage.getItem(lsKey('play_path')) || '[]');
      return Array.isArray(path) ? path : [];
    } catch (e) { return []; }
  }

  clearChoicePath() { localStorage.removeItem(lsKey('play_path')); }

  trimChoicePath(index) {
    localStorage.setItem(lsKey('play_path'), JSON.stringify(this.loadChoicePath().filter(entry => entry.index < index)));
  }

  /* 全セーブデータ（オート・手動）に記録された選択履歴を集める */
  savedChoicePaths() {
    const map = {};
    const consume = (data) => {
      if (!data || !Array.isArray(data.choicePath)) return;
      data.choicePath.forEach(entry => {
        if (entry && typeof entry.index === 'number') map[entry.index] = entry.flags || {};
      });
    };
    const parse = (raw) => { try { return JSON.parse(raw || 'null'); } catch (e) { return null; } };
    /* 進行の浅いセーブから順に取り込み、後のセーブの内容で上書きする */
    const autoList = parse(localStorage.getItem(lsKey('save_auto_list')));
    if (Array.isArray(autoList)) autoList.slice().sort((a, b) => (a.index || 0) - (b.index || 0)).forEach(consume);
    for (let slot = 1; slot <= 99; slot++) consume(parse(localStorage.getItem(lsKey(`save_slot_${slot}`))));
    return map;
  }

  /* オートセーブが持つ「その時点のフラグ」の時系列。
     選択履歴を持たない古いセーブデータから分岐を推定するための最後の手段。 */
  savedFlagTimeline() {
    try {
      const autoList = JSON.parse(localStorage.getItem(lsKey('save_auto_list')) || '[]');
      if (!Array.isArray(autoList)) return [];
      return autoList
        .filter(data => data && typeof data.index === 'number' && data.flags)
        .map(data => ({ index: data.index, flags: data.flags }))
        .sort((a, b) => a.index - b.index);
    } catch (e) { return []; }
  }

  /* 選択肢グループの行番号 → 選択直後のフラグ。
     セーブデータ → play_path → 同一セッションのhistory の順に上書きしていく。 */
  choiceFlagsByIndex() {
    const map = this.savedChoicePaths();
    this.loadChoicePath().forEach(entry => { map[entry.index] = entry.flags || {}; });
    const history = this.state.history || [];
    const finalFlags = this.state.flags && Object.keys(this.state.flags).length ? this.state.flags : this.getStoredFlags();
    history.forEach((snap, i) => {
      const step = SCENARIO[snap.index];
      if (step && step.cmd === 'choice') map[snap.index] = history[i + 1] ? history[i + 1].flags : finalFlags;
    });
    return map;
  }

  getStoredFlags() {
    try { return JSON.parse(localStorage.getItem(lsKey('global_flags')) || '{}'); } catch (e) { return {}; }
  }

  parseChoiceFlags(choice) {
    const assigned = {};
    const nameStr = String(choice.name || '').trim();
    if (nameStr) {
      nameStr.split(/[\s,，、]+/).forEach(part => {
        if (!part) return;
        if (part.includes(':')) { const [key, val] = part.split(':'); assigned[key] = parseInt(val, 10); }
        else { assigned[part] = true; }
      });
    } else if (choice.text) {
      assigned[choice.text] = true;
    }
    return assigned;
  }

  findChosenChoice(group, flags) {
    return group.find(choice => {
      const assigned = this.parseChoiceFlags(choice);
      const keys = Object.keys(assigned);
      if (keys.length === 0) return false;
      return keys.every(key => (typeof assigned[key] === 'number') ? flags[key] === assigned[key] : flags[key] === true);
    }) || null;
  }

  findQuestionText(choiceIndex) {
    for (let i = choiceIndex - 1; i >= 0 && i >= choiceIndex - 30; i--) {
      const s = SCENARIO[i];
      if (s && !s.cmd && (s.text || s.text_rubi)) return s.text_rubi || s.text;
    }
    return '';
  }

  traceReflectionPath() {
    const choiceFlags = this.choiceFlagsByIndex();
    const timeline = this.savedFlagTimeline();
    const finalFlags = this.getStoredFlags();
    /* 選択履歴が無い場合、その選択肢より後のオートセーブが持つフラグで代用する */
    const fallbackFlags = (index) => {
      const next = timeline.find(entry => entry.index > index);
      return next ? next.flags : finalFlags;
    };
    /* 歩いている位置での「そのときのフラグ」。選択肢を通過するたびに更新する */
    let flags = finalFlags;
    const firstSnap = (this.state.history || [])[0];
    if (firstSnap && firstSnap.flags) flags = firstSnap.flags;
    const evalCond = (cond) => {
      if (!cond) return true;
      try { return new Function('f', `try { with(f) { return !!(${cond}); } } catch(e){ return false; }`)(flags); } catch (e) { return false; }
    };
    const findMark = (name) => SCENARIO.findIndex(s => s.cmd === 'mark' && s.text === name);

    const entries = [];
    const visitedMarks = new Set();
    let chapter = '';
    let index = 0;
    let guard = 0;

    while (index >= 0 && index < SCENARIO.length && guard++ < SCENARIO.length * 2) {
      const step = SCENARIO[index];
      if (!step) break;
      if (!evalCond(step.cond)) { index++; continue; }

      if (step.cmd === 'choice') {
        const group = [];
        let tail = index;
        while (tail < SCENARIO.length && SCENARIO[tail].cmd === 'choice') {
          if (evalCond(SCENARIO[tail].cond)) group.push(SCENARIO[tail]);
          tail++;
        }
        if (group.length === 0) { index = tail; continue; }
        flags = choiceFlags[index] || fallbackFlags(index);
        const chosen = this.findChosenChoice(group, flags);
        /* どの選択肢とも一致しない＝まだ到達していない。推測せずにここで打ち切る */
        if (!chosen) break;
        entries.push({ type: 'choice', question: this.findQuestionText(index), answer: chosen.text_rubi || chosen.text || '' });
        const jumped = chosen.to ? findMark(chosen.to) : -1;
        index = (jumped === -1) ? tail : jumped;
        continue;
      }

      if (step.cmd === 'jump') {
        const target = findMark(step.to);
        if (target === -1 || visitedMarks.has(target)) break;
        visitedMarks.add(target);
        index = target;
        continue;
      }

      if (step.cmd === 'chapter') { chapter = step.text || chapter; index++; continue; }

      if (step.cmd === 'minigame') {
        entries.push({ type: 'minigame', title: step.name || String(step.src || '').replace(/\.html?$/i, '') });
        index++;
        continue;
      }

      if (step.cmd === 'end') { entries.push({ type: 'ending', name: step.text || chapter || '' }); break; }

      index++;
    }
    return entries;
  }

  buildReflectionBlocks() {
    const entries = this.traceReflectionPath();
    const flags = this.getStoredFlags();
    const blocks = [];

    const choices = entries.filter(e => e.type === 'choice');
    if (choices.length > 0) {
      blocks.push({ title: REFLECTION_TEXT.choices, rows: choices.map(e => ({ label: e.question, value: e.answer })) });
    }

    const games = entries.filter(e => e.type === 'minigame');
    if (games.length > 0) {
      blocks.push({ title: REFLECTION_TEXT.minigames, rows: games.map(e => ({ label: e.title, value: '' })) });
    }

    const scoreKeys = Object.keys(flags).filter(key => typeof flags[key] === 'number');
    if (scoreKeys.length > 0) {
      blocks.push({ title: REFLECTION_TEXT.scores, inline: true, rows: scoreKeys.map(key => ({ label: key, value: String(flags[key]) })) });
    }

    const ending = entries.filter(e => e.type === 'ending').pop();
    if (ending && ending.name) {
      blocks.push({ title: REFLECTION_TEXT.ending, rows: [{ label: '', value: ending.name }] });
    }
    return blocks;
  }

  reflectionTokens(raw) {
    const isHiragana = localStorage.getItem(lsKey('global_hiragana_mode')) === 'true';
    const tokens = this.parseTextToTokens(this.formatWakachiText(raw || ''));
    if (!isHiragana) return tokens;
    return Array.from(tokens.map(t => typeof t === 'string' ? t : t.ruby).join(''));
  }

  // ===== REFLECTION SHEET / SCREEN =====
  openReflection() {
    this.playSysSe(settings.seClick);
    this.applyReflectionLabels();
    const titleEl = this.$('rf-sheet-title');
    if (titleEl) titleEl.innerHTML = `${this.escapeHtml(this.reflectionGameTitle())}　${this.labelHtml(REFLECTION_TEXT.sheetSuffix)}`;
    const now = new Date();
    const month = this.$('rf-month'); const day = this.$('rf-day'); const week = this.$('rf-week');
    if (month && !month.value) month.value = String(now.getMonth() + 1);
    if (day && !day.value) day.value = String(now.getDate());
    if (week && !week.value) week.value = '日月火水木金土'.charAt(now.getDay());
    this.renderReflectionResult();
    this.$('reflection-screen').classList.remove('hidden');
  }

  closeReflection() {
    this.playSysSe(settings.seClick);
    this.$('reflection-screen').classList.add('hidden');
  }

  renderReflectionResult() {
    const container = this.$('rf-result');
    if (!container) return;
    const escapeHtml = (str) => this.escapeHtml(str);
    const toHtml = (raw) => this.buildRubyHtml(this.reflectionTokens(raw));
    const blocks = this.buildReflectionBlocks();

    if (blocks.length === 0) {
      container.innerHTML = `<div class="rf-empty">${this.labelHtml(REFLECTION_TEXT.empty)}</div>`;
      return;
    }
    container.innerHTML = blocks.map(block => {
      const rows = block.rows.map(row => {
        if (block.inline) return `<li class="rf-row rf-row-inline"><span class="rf-row-label">${escapeHtml(row.label)}</span><span class="rf-row-value">${escapeHtml(row.value)}</span></li>`;
        return `<li class="rf-row"><div class="rf-row-label">${toHtml(row.label)}</div><div class="rf-row-value">${toHtml(row.value)}</div></li>`;
      }).join('');
      return `<div class="rf-block"><div class="rf-block-title">${this.labelHtml(block.title)}</div><ul class="rf-list">${rows}</ul></div>`;
    }).join('');
  }

  // ===== REFLECTION SHEET / PDF =====
  reflectionGameTitle() {
    const pick = (name) => {
      const rows = (typeof CONFIG !== 'undefined' && Array.isArray(CONFIG)) ? CONFIG.filter(c => c.name === name && c.text) : [];
      return rows.length ? String(rows[rows.length - 1].text).trim() : '';
    };
    return [pick('title_text'), pick('title_sub')].filter(Boolean).join('　') || 'ノベルゲーム';
  }

  /* 「タイトル_年組_名前_年月日」。未入力の項目は区切りごと省く */
  reflectionFileName() {
    const valueOf = (id) => { const el = this.$(id); return el ? String(el.value || '').trim() : ''; };
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const month = parseInt(valueOf('rf-month'), 10);
    const day = parseInt(valueOf('rf-day'), 10);
    const stamp = `${now.getFullYear()}${pad(Number.isNaN(month) ? now.getMonth() + 1 : month)}${pad(Number.isNaN(day) ? now.getDate() : day)}`;
    const nen = valueOf('rf-nen');
    const kumi = valueOf('rf-kumi');
    const classLabel = `${nen ? nen + '年' : ''}${kumi ? kumi + '組' : ''}`;
    const parts = [this.reflectionGameTitle(), classLabel, valueOf('rf-name'), stamp].filter(Boolean);
    return parts.join('_').replace(/[\\/:*?"<>|]/g, '') + '.pdf';
  }

  escapeHtml(str) {
    return String(str).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  drawReflectionSheet(ctx, doDraw, pageIndex) {
    const { width: pageW, height: pageH, margin } = REFLECTION_PAGE;
    const contentW = pageW - margin * 2;
    const fontOf = (size, bold) => `${bold ? 'bold ' : ''}${size}px "Hiragino Sans", "Noto Sans JP", "Noto Sans CJK JP", "Yu Gothic", "Meiryo", sans-serif`;

    const line = (x1, y1, x2, y2, color, width, paint) => {
      if (!(paint === undefined ? doDraw : paint)) return;
      ctx.strokeStyle = color; ctx.lineWidth = width;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    };
    const textWidth = (text, size, bold) => { ctx.font = fontOf(size, bold); return ctx.measureText(String(text)).width; };
    const plain = (text, x, baseline, size, bold, paint) => {
      const w = textWidth(text, size, bold);
      if (paint) { ctx.fillStyle = '#111111'; ctx.font = fontOf(size, bold); ctx.fillText(String(text), x, baseline); }
      return w;
    };

    const rubySizeOf = (size) => Math.max(9, Math.round(size * 0.48));
    const tokenWidth = (token, size, bold) => {
      const main = (typeof token === 'string') ? token : token.kanji;
      const mainW = textWidth(main, size, bold);
      return (typeof token === 'string') ? mainW : Math.max(mainW, textWidth(token.ruby, rubySizeOf(size), false));
    };
    const paintToken = (token, x, baseline, size, bold, paint) => {
      const w = tokenWidth(token, size, bold);
      if (!paint) return w;
      ctx.fillStyle = '#111111';
      ctx.font = fontOf(size, bold);
      const main = (typeof token === 'string') ? token : token.kanji;
      const mainW = ctx.measureText(main).width;
      ctx.fillText(main, x + (w - mainW) / 2, baseline);
      if (typeof token !== 'string') {
        ctx.font = fontOf(rubySizeOf(size));
        const rubyW = ctx.measureText(token.ruby).width;
        ctx.fillText(token.ruby, x + (w - rubyW) / 2, baseline - size * 1.02);
      }
      return w;
    };
    const rubyGapOf = (tokens, size) => tokens.some(t => typeof t !== 'string') ? Math.round(size * 0.72) : 0;

    /* ルビ付きテキストを折り返して配置する。paint=false なら描画せず高さだけ返す */
    const flow = (raw, x, top, maxW, size, opts) => {
      const o = opts || {};
      const tokens = this.reflectionTokens(raw);
      const gap = o.lineH ? 0 : rubyGapOf(tokens, size);
      const lineH = o.lineH || (Math.round(size * 1.75) + gap);
      const firstBaseline = top + gap + Math.round(size * 0.95);
      let cx = x; let row = 0;
      tokens.forEach(token => {
        const w = tokenWidth(token, size, o.bold);
        const holdsLine = (typeof token === 'string') && REFLECTION_NO_LINE_START.includes(token);
        if (!holdsLine && cx + w > x + maxW && cx > x) { cx = x; row++; }
        paintToken(token, cx, firstBaseline + row * lineH, size, o.bold, !!o.paint);
        cx += w;
      });
      return (row + 1) * lineH;
    };
    const labelRun = (raw, x, baseline, size, bold, paint) => {
      let cx = x;
      this.reflectionTokens(this.gradeLabel(raw)).forEach(t => { cx += paintToken(t, cx, baseline, size, bold, paint); });
      return cx - x;
    };
    const labelWidth = (raw, size, bold) => this.reflectionTokens(this.gradeLabel(raw)).reduce((sum, t) => sum + tokenWidth(t, size, bold), 0);
    const valueOf = (id) => { const el = this.$(id); return el ? String(el.value || '') : ''; };

    // ===== FIXED AREA LAYOUT =====
    const titleBaseline = margin + 62;
    const titleRuleY = titleBaseline + 18;
    const profileBaseline = titleRuleY + 58;
    const resultTitleBaseline = profileBaseline + 90;
    const resultTitleRuleY = resultTitleBaseline + 22;
    const resultTop = resultTitleRuleY + 30;
    const noteLineH = 49;
    const noteMinLines = 5;
    const pageBottom = pageH - margin;
    /* 結果の終端から記入欄の罫線1本目までに必要な高さ（見出し＋区切り線ぶん） */
    const noteHeadGap = 114;
    const noteReserveFor = (lines) => noteHeadGap + noteLineH * lines;
    const contTitleBaseline = margin + 50;
    const contTitleRuleY = contTitleBaseline + 22;
    const contTop = contTitleRuleY + 34;

    if (doDraw) ctx.textBaseline = 'alphabetic';
    const isFirstPage = !pageIndex;

    // ===== ① タイトル・年組・名前・月日（1ページ目のみ） =====
    const gameTitle = this.reflectionGameTitle();
    let titleSize = 40;
    while (titleSize > 22 && textWidth(gameTitle + '　', titleSize, true) + labelWidth(REFLECTION_TEXT.sheetSuffix, titleSize, true) > contentW) titleSize -= 2;
    const gameTitleW = textWidth(gameTitle + '　', titleSize, true);
    const titleTotalW = gameTitleW + labelWidth(REFLECTION_TEXT.sheetSuffix, titleSize, true);
    const titleX = (pageW - titleTotalW) / 2;
    const paintFirst = doDraw && isFirstPage;
    plain(gameTitle + '　', titleX, titleBaseline, titleSize, true, paintFirst);
    labelRun(REFLECTION_TEXT.sheetSuffix, titleX + gameTitleW, titleBaseline, titleSize, true, paintFirst);
    line(margin, titleRuleY, pageW - margin, titleRuleY, '#111111', 3, paintFirst);

    const profileValueSize = 23;
    const profileLabelSize = 20;
    /* 記入幅は「年組・月日＝2桁分」「名前＝6文字分」を基準にし、それより長い入力が来たときだけ広げる */
    const slotFor = (value, sample) => Math.max(textWidth(sample, profileValueSize, false), textWidth(value, profileValueSize, false)) + 10;
    const renderProfile = (startX, paint) => {
      /* 下線は引かず、値の記入幅だけを枠として確保する */
      const field = (value, label, x, sample) => {
        const slotW = slotFor(value, sample);
        plain(value, x, profileBaseline, profileValueSize, false, paint);
        return x + slotW + labelRun(label, x + slotW, profileBaseline, profileLabelSize, true, paint);
      };
      const gap = 16;
      let x = startX;
      x = field(valueOf('rf-nen'), '｜年《ねん》', x, '00') + gap;
      x = field(valueOf('rf-kumi'), '｜組《くみ》', x, '00') + gap * 2;
      x += labelRun('【｜名《な》｜前《まえ》】', x, profileBaseline, profileLabelSize, true, paint) + 10;
      plain(valueOf('rf-name'), x, profileBaseline, profileValueSize, false, paint);
      x += slotFor(valueOf('rf-name'), '国国国国国国') + gap * 2;
      x = field(valueOf('rf-month'), '｜月《がつ》', x, '00') + gap;
      x = field(valueOf('rf-day'), '｜日《にち》', x, '00') + gap;
      x += plain('（', x, profileBaseline, profileLabelSize, true, paint);
      const weekW = slotFor(valueOf('rf-week'), '－');
      plain(valueOf('rf-week'), x + (weekW - textWidth(valueOf('rf-week'), profileValueSize, false)) / 2, profileBaseline, profileValueSize, false, paint);
      x += weekW;
      x += plain('）', x, profileBaseline, profileLabelSize, true, paint);
      return x - startX;
    };
    renderProfile(pageW - margin - renderProfile(0, false), paintFirst);

    // ===== ② ゲームのリザルト =====
    const blocks = this.buildReflectionBlocks();

    const buildResultItems = (scale) => {
      const px = (n) => Math.max(1, Math.round(n * scale));
      const titleSz = Math.max(13, Math.round(26 * scale));
      const labelSz = Math.max(12, Math.round(22 * scale));
      const valueSz = Math.max(13, Math.round(26 * scale));
      const items = [];
      blocks.forEach((block, bi) => {
        const lead = bi === 0 ? 0 : px(18);
        const titleTokens = this.reflectionTokens(this.gradeLabel(block.title));
        items.push({ kind: 'title', block, lead, size: titleSz,
          h: lead + rubyGapOf(titleTokens, titleSz) + Math.round(titleSz * 1.5), keepWithNext: true });
        block.rows.forEach(row => {
          if (block.inline) {
            items.push({ kind: 'inline', block, row, size: valueSz, h: Math.round(valueSz * 1.75) });
            return;
          }
          let h = px(4);
          if (row.label) h += flow(row.label, 0, 0, contentW - px(40), labelSz, {}) + px(4);
          if (row.value) h += flow(row.value, 0, 0, contentW - px(76), valueSz, {});
          items.push({ kind: 'row', block, row, labelSize: labelSz, valueSize: valueSz, indent: px(40), arrowIndent: px(76), h: h + px(6) });
        });
      });
      return items;
    };

    const itemCache = {};
    const itemsFor = (scale) => { if (!itemCache[scale]) itemCache[scale] = buildResultItems(scale); return itemCache[scale]; };
    const itemCount = itemsFor(1).length;

    const drawItem = (item, y, scale) => {
      const x = margin;
      if (item.kind === 'title') {
        labelRun(item.block.title, x + Math.round(20 * scale), y + item.h - Math.round(item.size * 0.42), item.size, true, true);
      } else if (item.kind === 'inline') {
        const baseline = y + Math.round(item.size * 1.1);
        const labelW = plain(item.row.label, x + Math.round(36 * scale), baseline, Math.round(item.size * 0.86), false, true);
        const valueW = textWidth(item.row.value, item.size, true);
        line(x + Math.round(44 * scale) + labelW, baseline - 6, x + contentW - valueW - 12, baseline - 6, '#dddddd', 2, true);
        plain(item.row.value, x + contentW - valueW, baseline, item.size, true, true);
      } else {
        let ry = y + Math.round(4 * scale);
        if (item.row.label) ry += flow(item.row.label, x + item.indent, ry, contentW - item.indent, item.labelSize, { paint: true }) + Math.round(4 * scale);
        if (item.row.value) {
          const gap = rubyGapOf(this.reflectionTokens(item.row.value), item.valueSize);
          plain('→', x + item.indent, ry + gap + Math.round(item.valueSize * 0.95), item.valueSize, true, true);
          flow(item.row.value, x + item.arrowIndent, ry, contentW - item.arrowIndent, item.valueSize, { paint: true });
        }
      }
    };

    /* from番目のアイテムから枠へ流し込み、次に持ち越すアイテムの番号を返す。
       描き終わりのY座標は placedEndY に入る */
    let placedEndY = resultTop;
    const placeItems = (scale, from, areaTop, areaBottom, paint) => {
      const list = itemsFor(scale);
      let y = areaTop;
      let i = from;
      while (i < list.length) {
        const item = list[i];
        let need = item.h;
        if (item.keepWithNext && list[i + 1]) need += list[i + 1].h;
        if (i > from && y + need > areaBottom) break;
        if (i > from && y + item.h > areaBottom) break;
        if (paint) drawItem(item, y, scale);
        y += item.h;
        i++;
      }
      placedEndY = y;
      return i;
    };

    /* 指定の縮小率で maxPages 以内に全部収まるなら、そのページ割りを返す。
       記入欄は必ず最終ページに置くので、そのぶんの高さを最終ページだけ空けておく */
    const noteReserve = noteReserveFor(noteMinLines);
    const fitWithin = (scale, maxPages) => {
      const result = [];
      let cursor = 0;
      while (cursor < itemCount) {
        if (result.length >= maxPages) return null;
        const top = result.length === 0 ? resultTop : contTop;
        /* このページを最終ページと仮定し、記入欄ぶんを残して残り全部が入るか試す */
        if (placeItems(scale, cursor, top, pageBottom - noteReserve, false) >= itemCount) {
          result.push({ from: cursor, to: itemCount, scale, last: true });
          return result;
        }
        let to = placeItems(scale, cursor, top, pageBottom, false);
        if (to <= cursor) to = cursor + 1;
        result.push({ from: cursor, to, scale, last: false });
        cursor = to;
      }
      /* 結果はページ末端まで使い切った。記入欄だけの最終ページを足す */
      if (result.length >= maxPages) return null;
      result.push({ from: itemCount, to: itemCount, scale, last: true });
      return result;
    };

    /* 文字サイズは全ページ共通。1ページに収めるためなら下限よりさらに詰め、それでも無理なら
       ページ数を増やして縮小率を1.0から探し直す。ページをまたいで文字サイズが変わらないようにするための手順。 */
    const planPages = () => {
      for (const scale of REFLECTION_SCALES.concat(REFLECTION_TIGHT_SCALES)) {
        const plan = fitWithin(scale, 1);
        if (plan) return plan;
      }
      for (let pageLimit = 2; pageLimit <= REFLECTION_MAX_PAGES; pageLimit++) {
        for (const scale of REFLECTION_SCALES) {
          const plan = fitWithin(scale, pageLimit);
          if (plan) return plan;
        }
      }
      return fitWithin(REFLECTION_SCALES[REFLECTION_SCALES.length - 1], REFLECTION_MAX_PAGES) || [{ from: 0, to: itemCount, scale: 1, last: true }];
    };

    const pages = itemCount > 0 ? planPages() : [{ from: 0, to: 0, scale: 1, last: true }];
    const page = pages[Math.min(Math.max(pageIndex || 0, 0), pages.length - 1)];
    const onFirst = page === pages[0];
    const singlePage = pages.length === 1;

    const headBaseline = onFirst ? resultTitleBaseline : contTitleBaseline;
    const headRuleY = onFirst ? resultTitleRuleY : contTitleRuleY;
    const areaTop = onFirst ? resultTop : contTop;
    /* 結果だけのページはページ末端まで、最終ページは記入欄ぶんを残す */
    const areaBottom = page.last ? pageBottom - noteReserve : pageBottom;

    if (page.from < itemCount || blocks.length === 0) {
      if (doDraw) { ctx.fillStyle = '#111111'; ctx.fillRect(margin, headBaseline - 30, 8, 38); }
      labelRun(onFirst ? REFLECTION_TEXT.result : REFLECTION_TEXT.resultCont, margin + 22, headBaseline, 30, true, doDraw);
      line(margin, headRuleY, pageW - margin, headRuleY, '#bbbbbb', 2);
    }

    placedEndY = areaTop;
    if (blocks.length === 0) {
      placedEndY = areaTop + flow(this.gradeLabel(REFLECTION_TEXT.empty), margin + 22, areaTop, contentW - 22, 24, { paint: doDraw });
    } else if (page.from < itemCount) {
      placeItems(page.scale, page.from, areaTop, areaBottom, doDraw);
    }

    // ===== ③ 学んだこと・考えたこと（最終ページの結果の直後。1ページだけならページ最下部に固定） =====
    if (page.last) {
      const note = valueOf('rf-note');
      /* 18px以上なら罫線に揃える。それ未満まで縮める場合は行間を詰めて罫線から外す */
      const lineHFor = (size) => (size >= 18 ? noteLineH : Math.round(size * 1.7));
      const usedHeight = (size) => note.split('\n').reduce((sum, part) => sum + flow(part, 0, 0, contentW - 24, size, { lineH: lineHFor(size) }), 0);

      /* 結果の終端からこれ以上は上に伸ばせない、という位置 */
      const noteCeiling = (page.from < itemCount ? placedEndY : areaTop) + noteHeadGap;
      const wantLines = note ? Math.ceil(usedHeight(26) / noteLineH) : 0;
      /* 文字を小さくする前に、まず空いている高さぶん行数を増やして受け止める */
      const roomLines = Math.max(noteMinLines, Math.floor((pageBottom - noteCeiling) / noteLineH));
      const noteLines = Math.max(noteMinLines, Math.min(roomLines, wantLines));
      const areaH = noteLineH * noteLines;
      /* 1ページだけなら下端を保ったまま上へ広げる。複数ページなら結果の直後から下へ流す */
      const noteTop = singlePage ? pageBottom - areaH : noteCeiling;

      let noteSize = 26;
      if (note) { while (noteSize > 10 && usedHeight(noteSize) > areaH) noteSize -= 1; }

      const noteTitleBaseline = noteTop - 46;
      if (doDraw) { ctx.fillStyle = '#111111'; ctx.fillRect(margin, noteTitleBaseline - 30, 8, 38); }
      labelRun(REFLECTION_TEXT.note, margin + 22, noteTitleBaseline, 30, true, doDraw);
      line(margin, noteTitleBaseline + 22, pageW - margin, noteTitleBaseline + 22, '#bbbbbb', 2);

      /* 罫線に揃わない大きさまで縮めたときは、文字に線が重なるので罫線を描かない */
      if (!note || noteSize >= 18) {
        for (let i = 0; i < noteLines; i++) {
          line(margin, noteTop + noteLineH * (i + 1), pageW - margin, noteTop + noteLineH * (i + 1), '#cccccc', 2);
        }
      } else {
        line(margin, noteTop + areaH, pageW - margin, noteTop + areaH, '#cccccc', 2);
      }

      if (note) {
        const noteStep = lineHFor(noteSize);
        let ny = noteTop + noteStep - Math.round(noteSize * 0.95) - (noteSize >= 18 ? 12 : 4);
        const limit = noteTop + areaH;
        note.split('\n').forEach(part => {
          if (ny >= limit) return;
          ny += flow(part, margin + 12, ny, contentW - 24, noteSize, { paint: doDraw, lineH: noteStep });
        });
      }
    }

    if (doDraw && pages.length > 1) {
      const folio = `${(pageIndex || 0) + 1} / ${pages.length}`;
      plain(folio, pageW - margin - textWidth(folio, 18, false), pageH - margin + 34, 18, false, true);
    }
    return pages.length;
  }

  buildReflectionPdf(images) {
    const { width: pxW, height: pxH, ptWidth, ptHeight } = REFLECTION_PAGE;
    const objects = [];
    const kids = images.map((_, i) => `${3 + i * 3} 0 R`);
    objects.push('<</Type/Catalog/Pages 2 0 R>>');
    objects.push(`<</Type/Pages/Kids[${kids.join(' ')}]/Count ${images.length}>>`);
    images.forEach((base64, i) => {
      const id = 3 + i * 3;
      const data = atob(base64);
      const content = `q ${ptWidth} 0 0 ${ptHeight} 0 0 cm /Im0 Do Q`;
      objects.push(`<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${ptWidth} ${ptHeight}]/Resources<</XObject<</Im0 ${id + 1} 0 R>>>>/Contents ${id + 2} 0 R>>`);
      objects.push(`<</Type/XObject/Subtype/Image/Width ${pxW}/Height ${pxH}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${data.length}>>\nstream\n${data}\nendstream`);
      objects.push(`<</Length ${content.length}>>\nstream\n${content}\nendstream`);
    });

    let pdf = '%PDF-1.4\n';
    const offsets = [];
    objects.forEach((body, i) => {
      offsets.push(pdf.length);
      pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xrefPos = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.forEach(offset => { pdf += String(offset).padStart(10, '0') + ' 00000 n \n'; });
    pdf += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefPos}\n%%EOF`;

    const bytes = new Uint8Array(pdf.length);
    for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
    return new Blob([bytes], { type: 'application/pdf' });
  }

  downloadReflectionPdf() {
    this.playSysSe(settings.seClick);
    const { width: pageW, height: pageH } = REFLECTION_PAGE;
    const pageCount = this.drawReflectionSheet(document.createElement('canvas').getContext('2d'), false, 0);
    const images = [];
    for (let p = 0; p < pageCount; p++) {
      const page = document.createElement('canvas');
      page.width = pageW; page.height = pageH;
      const pageCtx = page.getContext('2d');
      pageCtx.fillStyle = '#ffffff';
      pageCtx.fillRect(0, 0, pageW, pageH);
      this.drawReflectionSheet(pageCtx, true, p);
      images.push(page.toDataURL('image/jpeg', 0.92).split(',')[1]);
    }

    const url = URL.createObjectURL(this.buildReflectionPdf(images));
    const link = document.createElement('a');
    link.href = url;
    link.download = this.reflectionFileName();
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  openSystem() { 
    if (this.state.isSkip) this.stopSkip();
    this.playSysSe(settings.seClick); 
    this.setPrevScreenForPopup(); 
    this.updateWakachiButtonState(); 
    this.updateHiraganaButtonState();
    this.updateTtsButtonState();
    this.syncMuteButtons();
    this.showScreen('system-screen'); 
  }
  closeSystem() { this.playSysSe(settings.seClick); this.showScreen(this.state.prevScreen); }

  toggleMute(btn) {
    const slider = this.$(btn.dataset.muteFor);
    if (!slider) return;
    if (btn.classList.contains('muted')) {
      const restore = btn.dataset.prevVol !== undefined ? btn.dataset.prevVol : '50';
      slider.value = restore;
      btn.classList.remove('muted');
    } else {
      btn.dataset.prevVol = slider.value;
      slider.value = 0;
      btn.classList.add('muted');
    }
    slider.dispatchEvent(new Event('input'));
    this.updateMuteBtnIcon(btn);
    this.playSysSe(settings.seClick);
  }

  updateMuteBtnIcon(btn) {
    btn.textContent = btn.classList.contains('muted') ? '\u00d7' : '\u266a';
  }

  syncMuteButtons() {
    document.querySelectorAll('.mute-btn').forEach(btn => {
      const slider = this.$(btn.dataset.muteFor);
      if (!slider) return;
      const muted = parseFloat(slider.value) === 0;
      btn.classList.toggle('muted', muted);
      this.updateMuteBtnIcon(btn);
    });
  }

  openCharSelect() {
    const container = this.$('char-select-cards');
    container.innerHTML = '';
    
    if (!this.state.currentSrcKey || !window.app.availableSkins.some(s => s.posKey === this.state.currentSrcKey)) {
      this.state.currentSrcKey = window.app.availableSkins[0].posKey;
    }

    if (window.app.availableSkins) {
      window.app.availableSkins.forEach(skin => {
        const card = document.createElement('div');
        card.className = 'char-card' + (this.state.currentSrcKey === skin.posKey ? ' selected' : '');
        card.innerHTML = `<img class="char-card-img" src="${skin.thumb || ''}" alt="${skin.text}"><div class="char-card-name">${skin.text}</div>`;
        
        card.onclick = () => {
          this.playSysSe(settings.seClick);
          this.state.currentSrcKey = skin.posKey;
          container.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
        };
        container.appendChild(card);
      });
    }

    this.showScreen('char-select-screen');
  }

  startFromCharSelect() {
    this.playSysSe(settings.seStart || settings.seClick);
    localStorage.setItem(lsKey('global_src_key'), this.state.currentSrcKey);
    this.showScreen('game-screen');
    this.executeStep();
  }

  updateGlobalFlags(newFlags) {
    const currentGlobal = JSON.parse(localStorage.getItem(lsKey('global_flags')) || '{}');
    const merged = { ...currentGlobal, ...newFlags };
    this.state.flags = merged;
    localStorage.setItem(lsKey('global_flags'), JSON.stringify(merged));
  }

  formatWakachiText(text) {
    if (!text) return "";
    const isWakachi = localStorage.getItem(lsKey('global_wakachi_mode')) === 'true';
    if (isWakachi) {
      let t = text;
      t = t.replace(/[、，]/g, '');       
      t = t.replace(/\/+([。．])/g, '$1'); 
      t = t.replace(/\/+/g, '　');        
      return t;
    } else {
      return text.replace(/\/\/+/g, '/').replace(/\//g, ''); 
    }
  }

  toggleWakachi() {
    this.playSysSe(settings.seClick);
    const current = localStorage.getItem(lsKey('global_wakachi_mode')) === 'true';
    const next = !current;
    localStorage.setItem(lsKey('global_wakachi_mode'), String(next));
    this.updateWakachiButtonState();
  }

  toggleHiragana() {
    this.playSysSe(settings.seClick);
    const current = localStorage.getItem(lsKey('global_hiragana_mode')) === 'true';
    const next = !current;
    localStorage.setItem(lsKey('global_hiragana_mode'), String(next));
    this.updateHiraganaButtonState();
  }

  toggleTts() {
    this.playSysSe(settings.seClick);
    const current = localStorage.getItem(lsKey('global_tts_mode')) === 'true';
    const next = !current;
    localStorage.setItem(lsKey('global_tts_mode'), String(next));
    this.updateTtsButtonState();
  }

  updateTtsButtonState() {
    const isTts = localStorage.getItem(lsKey('global_tts_mode')) === 'true';
    const btn = this.$('tts-toggle-btn');
    if (btn) {
      btn.textContent = isTts ? "ON" : "OFF";
      btn.classList.toggle('on', isTts);
    }
  }

  updateHiraganaButtonState() {
    const isHiragana = localStorage.getItem(lsKey('global_hiragana_mode')) === 'true';
    const btn = this.$('hiragana-toggle-btn');
    if (btn) {
      btn.textContent = isHiragana ? "ON" : "OFF";
      btn.classList.toggle('on', isHiragana);
    }
    document.documentElement.classList.toggle('is-hiragana', isHiragana);
  }

  updateWakachiButtonState() {
    const isWakachi = localStorage.getItem(lsKey('global_wakachi_mode')) === 'true';
    const btn = this.$('wakachi-toggle-btn');
    if (btn) {
      btn.textContent = isWakachi ? "ON" : "OFF";
      btn.classList.toggle('on', isWakachi); 
    }
  }

  async preloadGameImages(scenarioList, configList = []) {
    const getSrc = (dir, src) => resolveAssetPath((dir && src) ? `${dir.replace(/\/$/, '')}/${src}` : src);
    const urlSet = new Set();
    const audioSet = new Set();

    configList.forEach(c => { 
      if ((c.name === 'title_bg' || c.name === 'title_image' || c.name === 'character_select') && c.src) {
        urlSet.add(getSrc(c.dir, c.src)); 
      }
    });

    const skinKeys = ['src'];
    if (window.app && window.app.availableSkins) {
      window.app.availableSkins.forEach(skin => {
        if (!skinKeys.includes(skin.posKey)) skinKeys.push(skin.posKey);
      });
    }

    const chapterImageExtRe = /\.(png|jpe?g|webp)$/i;
    scenarioList.forEach(s => { 
      if ((s.cmd === 'config' && (s.name === 'title_bg' || s.name === 'title_image')) || ['bg', 'show', 'item'].includes(s.cmd)) { 
        skinKeys.forEach(key => {
          if (s[key]) urlSet.add(getSrc(s.dir, s[key]));
        });
      } else if (s.cmd === 'chapter') {
        skinKeys.forEach(key => {
          if (s[key] && chapterImageExtRe.test(String(s[key]))) urlSet.add(getSrc(s.dir, s[key]));
        });
      }
    });

    const audioExtRe = /\.(mp3|wav|ogg|m4a|aac|flac|opus)$/i;
    scenarioList.forEach(s => {
      if (s.cmd === 'bgm' || s.cmd === 'se') {
        if (s.src) audioSet.add(getSrc(s.dir, s.src));
      } else if (s.src && audioExtRe.test(String(s.src))) {
        audioSet.add(getSrc(s.dir, s.src));
      }
    });

    const missingImages = [];
    const loadPromises = Array.from(urlSet).map(url => new Promise((res) => { const img = new Image(); img.onload = res; img.onerror = () => { missingImages.push(url); res(); }; img.src = url; }));
    
    if (!this.sysAudioCache) this.sysAudioCache = {};
    if (settings.seClick && !this.sysAudioCache[settings.seClick]) { this.sysAudioCache[settings.seClick] = new Audio(settings.seClick); this.sysAudioCache[settings.seClick].preload = 'auto'; this.sysAudioCache[settings.seClick].load(); }
    if (settings.seStart && !this.sysAudioCache[settings.seStart]) { this.sysAudioCache[settings.seStart] = new Audio(settings.seStart); this.sysAudioCache[settings.seStart].preload = 'auto'; this.sysAudioCache[settings.seStart].load(); }
    await Promise.all(loadPromises);

    this._reportAssetStatus(missingImages, Array.from(audioSet));
  }

  _reportAssetStatus(missingImages, audioPaths) {
    const debugEnabled = new URLSearchParams(window.location.search).get('debug_assets') === '1';
    if (missingImages.length === 0 && !debugEnabled) return;

    if (missingImages.length > 0) {
      console.warn(`[アセット検証] 読み込みに失敗した画像 ${missingImages.length}件`, missingImages);
    } else {
      console.warn('[アセット検証] 画像の欠落はありません。');
    }
    console.warn(`[アセット検証] シナリオが参照する音声パス ${audioPaths.length}件（ロード未検証）`, audioPaths);

    if (debugEnabled) this._showAssetDebugOverlay(missingImages, audioPaths);
  }

  _showAssetDebugOverlay(missingImages, audioPaths) {
    if (document.getElementById('asset-debug-overlay')) return;
    const box = document.createElement('div');
    box.id = 'asset-debug-overlay';
    const list = (items) => items.length ? items.map(p => `<code>${p}</code>`).join('<br>') : '（なし）';
    box.innerHTML =
      `<h4 class="missing">欠落画像 (${missingImages.length})</h4>${list(missingImages)}` +
      `<h4>参照音声パス (${audioPaths.length})</h4>${list(audioPaths)}`;
    document.body.appendChild(box);
  }
}

/* ======================================================================
 * Main Initialization Flow
 * DOM読み込み時のデータ取得、設定反映、プリロード処理
 * ====================================================================== */
document.addEventListener('DOMContentLoaded', async () => {
  console.info(`Texted-Novel-Game-Engine v${ENGINE_INFO.version} (dataFormat: ${ENGINE_INFO.dataFormatVersion})${ENGINE_INFO.build ? ' build: ' + ENGINE_INFO.build : ''}`);

  window.app = new NovelGameEngine();
  
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS) {
    document.documentElement.classList.add('is-ipad');
  }

  const isChromeOS = /CrOS/.test(navigator.userAgent);
  if (isChromeOS) {
    document.documentElement.classList.add('is-chromebook');
  }
  
  const loaderEl = document.getElementById('loading-overlay'); 
  let gasLoadFailed = false;
  const dL = new DataLoader();
  window.dL = dL; /* シナリオエディタ等の外部ツールからCONFIGの即時反映(applyConfigs再実行)に使う */

  if (typeof LOCAL_CONFIG !== 'undefined') {
    CONFIG = dL._parseData(LOCAL_CONFIG);
  }
  
  if (typeof LOCAL_SCENARIO !== 'undefined' && LOCAL_SCENARIO.length > 0) {
    SCENARIO = dL._parseData(LOCAL_SCENARIO); 
    console.log("ローカルのシナリオファイル (scenario.js) を読み込みました。");
  } else if (USER_SETTINGS.gasWebAppUrl) {
    const data = await dL.loadGasData(USER_SETTINGS.gasWebAppUrl);
    if (data.error) gasLoadFailed = true;
    if (data.scenario && data.scenario.length > 0) SCENARIO = data.scenario;
    if (data.config && data.config.length > 0) CONFIG = data.config;
    if (!gasLoadFailed) console.log("GASからデータを取得しました。");
  }
  
  const inlineConfigs = SCENARIO.filter(s => s.cmd === 'config');
  if (inlineConfigs.length > 0) { 
    CONFIG = [...CONFIG, ...inlineConfigs]; 
    SCENARIO = SCENARIO.filter(s => s.cmd !== 'config'); 
  }

  window.app.availableSkins = [];
  CONFIG.forEach(c => {
    if (c.name === 'character_select') {
      window.app.availableSkins.push({
        text: c.text,
        posKey: c.pos || 'src',
        thumb: resolveAssetPath((c.dir && c.src) ? `${c.dir.replace(/\/$/, '')}/${c.src}` : c.src)
      });
    }
  });

dL.applyConfigs(CONFIG); 
  window.app.setupReviewMode();
  await window.app.preloadGameImages(SCENARIO, CONFIG);

  const isHiragana = localStorage.getItem(lsKey('global_hiragana_mode')) === 'true';
  document.documentElement.classList.toggle('is-hiragana', isHiragana);

  window.app.updateTtsButtonState();

  if (!gasLoadFailed) {
  loaderEl.style.opacity = '0';
  setTimeout(() => {
    loaderEl.style.display = 'none'; 

    /* シナリオエディタ等から ?debug_index=120 のようなクエリで起動された場合は、
       タイトル画面を出さず、指定行から直接シナリオを開始する。 */
    const debugIndexParam = new URLSearchParams(window.location.search).get('debug_index');
    const debugIndex = debugIndexParam !== null ? parseInt(debugIndexParam, 10) : null;

    if (debugIndex !== null && !Number.isNaN(debugIndex) && debugIndex >= 0 && debugIndex < SCENARIO.length) {
      window.app.startNewGame(debugIndex);
    } else {
      window.app.showScreen('title-screen'); 
      document.getElementById('title-screen').classList.add('show');
      
      if (settings.titleBgm) {
        window.app.el.bgmPlayer.src = settings.titleBgm;
        window.app.el.bgmPlayer.play().catch(() => {
          const trg = () => { 
            if(document.getElementById('title-screen').classList.contains('active')) {
              window.app.el.bgmPlayer.play(); 
            }
            document.removeEventListener('click', trg); 
          };
          document.addEventListener('click', trg);
        });
      }
    }

    /* シナリオエディタ等から埋め込まれている場合、起動が完了したことを親フレームへ通知する。
       file://環境ではiframe.contentDocumentへの直接アクセスが制限されることがあるため、
       エディタ側はこの通知の有無で読み込み成否を判定する。
       あわせて、現在ゲームが使用しているシナリオ・CONFIGデータも送信し、
       エディタ側で同じデータを自動的に開けるようにする。 */
    if (window.parent !== window) {
      try {
        window.parent.postMessage({ type: 'novelgame-debug-ready', scenario: SCENARIO, config: CONFIG }, location.protocol === 'file:' ? '*' : location.origin);
      } catch (e) { /* オリジンが異なっていても処理を止めない */ }
    }
  }, 600);
  }

  /* シナリオエディタ等の外部ツールから「この行にジャンプして」という要求を受け取る。
     同一オリジンの親フレームに埋め込まれている場合のみ受け付ける（file://運用時は
     エディタ・ゲームの双方がorigin "null" になるため、この比較は成立し従来どおり動く）。 */
  window.addEventListener('message', (e) => {
    if (location.protocol !== 'file:' && e.origin !== location.origin) return;
    const data = e.data;
    if (!data) return;

    if (data.type === 'novelgame-debug-jump') {
      const targetIndex = parseInt(data.index, 10);
      if (Number.isNaN(targetIndex) || targetIndex < 0 || targetIndex >= SCENARIO.length) return;
      if (!window.app) return;
      window.app.startNewGame(targetIndex);
      return;
    }

    /* シナリオエディタのサイドバーから、フラグの値を直接書き換える要求を受け取る。
       デバッグ用の一時的な変更のため、localStorageの保存データには影響させない
       （updateGlobalFlagsではなくthis.state.flagsを直接書き換える）。 */
    if (data.type === 'novelgame-debug-set-flag') {
      if (!window.app || typeof data.name !== 'string' || !data.name) return;
      window.app.state.flags[data.name] = data.value;
      window.app.notifyDebugStep();
      return;
    }

    /* フラグを削除する要求を受け取る */
    if (data.type === 'novelgame-debug-delete-flag') {
      if (!window.app || typeof data.name !== 'string' || !data.name) return;
      delete window.app.state.flags[data.name];
      window.app.notifyDebugStep();
      return;
    }

    /* シナリオエディタで編集中のシナリオ・CONFIGを受け取り、現在の表示にその場で反映する。
       編集するたびに送られてくる想定のため、ここでは検証以外の重い処理は行わない。
       実際の反映処理（見た目の再構築・再表示）はreloadScenarioInPlace側で行う。 */
    if (data.type === 'novelgame-debug-update-scenario') {
      if (!window.app) return;
      window.app.reloadScenarioInPlace(data.scenario, data.config);
      return;
    }
  });
});
