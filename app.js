/* ======================================================================
 * Settings & Global Variables
 * ====================================================================== */
const settings = { 
  textSpeed: 40, autoDelay: 2500, bgmVolume: 0.07, seVolume: 0.07, voiceVolume: 0.07, sysSeVolume: 0.07,
  titleBgm: '', seStart: '', seClick: '', fontChapter: '', chapterColor: '', chapterOutline: '', ttsApiUrl: 'http://127.0.0.1:50021',
  choiceBg: '', choiceFont: '', choiceColor: '', choiceSize: '', choiceOutline: '', choicePos: '', choiceBgPos: '',
  dialogFontSize: ''
};

const USER_SETTINGS = { 
  gasWebAppUrl: 'https://script.google.com/macros/s/AKfycbybvhYD9MKidQwf0c3tiNt23qOeQcnksYdLKjC-BGXUXuT0oLsxQ97f4kfNZQO8OZuVow/exec'
};

let SCENARIO = [ { cmd: 'config', name: 'title_text', text: 'NOVEL GAME' }, { cmd: 'end' } ];
let CONFIG = [];
window.app = null;

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
      return { scenario: [], config: [] }; 
    }
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
  
  applyPos(el, posStr, defParams, useTransform, preserveSize = false) {
    const str = String(posStr || '').toLowerCase();
    
    if (!preserveSize) { el.style.top = 'auto'; el.style.bottom = 'auto'; el.style.left = 'auto'; el.style.right = 'auto'; }
    
    let tx = '0', ty = '0';
    const getVal = (key) => { const match = str.match(new RegExp(`${key}:\\s*([\\d.\\-]+)`)); return match ? match[1] + '%' : null; };
    const hasWord = (word) => new RegExp(`\\b${word}\\b`).test(str);

    let topV = getVal('top'); let botV = getVal('bottom'); let leftV = getVal('left'); let rightV = getVal('right');
    let widthV = getVal('width'); let heightV = getVal('height');

    if (hasWord('center')) { if (!leftV && !rightV) leftV = '50%'; tx = '-50%'; }
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
    const formatSize = (val) => {
      if (!val) return null; 
      const strVal = String(val).trim();
      if (/^\d+$/.test(strVal)) return ((parseInt(strVal, 10) / 1920) * 100) + 'cqw';
      return strVal;
    };
  
    configArray.forEach(c => {
      if (c.name === 'title_text') {
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
      }
      
      if (c.name === 'title_sub') {
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
      }
      
      if (c.name === 'title_rogo' || c.name === 'title_logo') {
        const logoCont = document.getElementById('title-logo-container');
        if (c.src) {
          const imgEl = document.getElementById('title-logo-image');
          imgEl.src = (c.dir && c.src) ? `${c.dir.replace(/\/$/, '')}/${c.src}` : c.src;
          imgEl.style.display = 'block'; 
          document.getElementById('title-logo-text').style.display = 'none';
        }
        if (c.pos) {
          logoCont.style.position = 'absolute'; logoCont.style.margin = '0';
          this.applyPos(logoCont, c.pos, { top: null, bottom: null, left: null, right: null }, true, false);
        }
      }

      if (c.name === 'title_menu_btn') {
        if (c.text) { document.querySelectorAll('.title-btn, .game-btn, .sys-btn, .choice-btn').forEach(btn => btn.style.borderRadius = c.text); }
        if (c.pos) {
          const menu = document.getElementById('title-menu');
          menu.style.position = 'absolute'; menu.style.margin = '0';
          this.applyPos(menu, c.pos, { top: null, bottom: null, left: null, right: null }, true, false);
        }
      }

      if (c.name === 'game_btn') {
        const fontName = c.font || c.text;
        if (c.src || c.color || fontName || c.fontsize) {
          const rawSrc = (c.dir && c.src) ? `${c.dir.replace(/\/$/, '')}/${c.src}` : c.src;
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
          const res = this.applyPos(bar, c.pos, { top: null, bottom: null, left: null, right: null }, false, false);
          if (res.rightV !== null) bar.classList.add('menu-right-pos'); else bar.classList.remove('menu-right-pos');
        }
      }
      
      if (c.name === 'title_bg') {
        const bgUrl = `url('${(c.dir && c.src) ? `${c.dir.replace(/\/$/, '')}/${c.src}` : c.src}')`;
        document.getElementById('title-bg').style.backgroundImage = bgUrl; 
        document.documentElement.style.setProperty('--title-bg-url', bgUrl); 
      }
      
      if (c.name === 'title_bgm') settings.titleBgm = (c.dir && c.src) ? `${c.dir.replace(/\/$/, '')}/${c.src}` : c.src;
      if (c.name === 'se_start') settings.seStart = (c.dir && c.src) ? `${c.dir.replace(/\/$/, '')}/${c.src}` : c.src;
      if (c.name === 'se_click') settings.seClick = (c.dir && c.src) ? `${c.dir.replace(/\/$/, '')}/${c.src}` : c.src;
      
      if (c.name === 'font_main') {
        if (c.font || c.text) document.documentElement.style.setProperty('--font-main', c.font || c.text);
        if (c.color) document.documentElement.style.setProperty('--text-main', c.color);
        if (c.outline) settings.dialogOutline = c.outline;
        if (c.fontsize) settings.dialogFontSize = formatSize(c.fontsize);
        
        if (c.pos) {
          const dialogText = document.getElementById('dialog-text');
          dialogText.style.position = 'absolute'; dialogText.style.margin = '0';
          this.applyPos(dialogText, c.pos, { top: null, bottom: null, left: null, right: null }, false, false);
        }
      }

      if (c.name === 'name' || c.name === 'name_tag') {
        const nameEl = document.getElementById('name-tag');
        if (c.font) nameEl.style.setProperty('font-family', c.font, 'important');
        if (c.color) nameEl.style.setProperty('color', c.color, 'important');
        if (c.fontsize) nameEl.style.setProperty('font-size', formatSize(c.fontsize), 'important');
        if (c.outline) window.app.applyTextOutline(nameEl, c.outline);
        
        if (c.pos) {
          nameEl.style.position = 'absolute'; nameEl.style.margin = '0';
          this.applyPos(nameEl, c.pos, { top: null, bottom: null, left: null, right: null }, false, false);
        }
      }
      
      if (c.name === 'main_color') { const colorVal = c.color || c.text; if (colorVal) this.applyColors(colorVal); }
      if (c.name === 'bg_color' && c.text) { document.documentElement.style.setProperty('--bg-dark', c.text); }
      if (c.name === 'font_chapter') {
        if (c.font || c.text) settings.fontChapter = c.font || c.text; 
        if (c.color) settings.chapterColor = c.color; 
        if (c.outline) settings.chapterOutline = c.outline;
      }
      if (c.name === 'tts_api_url' && c.text) settings.ttsApiUrl = c.text; 

      if (c.name === 'dialog_bg') {
        const dialogBg = document.getElementById('dialog-bg');
        if (c.src) {
          const bgUrl = `url('${(c.dir && c.src) ? `${c.dir.replace(/\/$/, '')}/${c.src}` : c.src}')`;
          dialogBg.style.background = `${bgUrl} center / 100% 100% no-repeat`;
        } else if (c.color || c.text) {
          const color = c.color || c.text;
          dialogBg.style.background = `linear-gradient(to top, color-mix(in srgb, ${color} 95%, transparent) 0%, color-mix(in srgb, ${color} 80%, transparent) 30%, transparent 100%)`;
        }
        if (c.pos) {
          dialogBg.style.position = 'absolute'; dialogBg.style.margin = '0';
          this.applyPos(dialogBg, c.pos, { top: null, bottom: null, left: null, right: null }, false, false);
        }
      }

      const imgBtns = ['start', 'continue', 'system', 'back', 'log', 'auto', 'skip', 'save', 'load', 'toggle'];
      imgBtns.forEach(btnType => {
        if ((c.name === `title_btn_${btnType}` || c.name === `game_btn_${btnType}`) && c.src) {
          let btnId = '';
          if (btnType === 'start') btnId = 'title-btn-start';
          else if (btnType === 'continue') btnId = 'continue-btn';
          else if (btnType === 'system') btnId = 'title-btn-system';
          else if (btnType === 'auto') btnId = 'btn-auto';
          else if (btnType === 'toggle') btnId = 'menu-toggle-btn';
          else btnId = `game-btn-${btnType}`;

          const btn = document.getElementById(btnId);
          if (btn) {
            const imgUrl = `url('${(c.dir && c.src) ? `${c.dir.replace(/\/$/, '')}/${c.src}` : c.src}')`;
            btn.classList.add('is-image-btn');
            btn.style.backgroundImage = imgUrl;
            btn.style.backgroundSize = 'contain';
            btn.style.backgroundRepeat = 'no-repeat';
            btn.style.backgroundPosition = 'center';
            if (c.fontsize) btn.style.width = btn.style.height = formatSize(c.fontsize);
          }
        }
      });

      if (c.name === 'choice_bg') {
        if (c.src) settings.choiceBg = (c.dir && c.src) ? `${c.dir.replace(/\/$/, '')}/${c.src}` : c.src;
        if (c.pos) settings.choiceBgPos = c.pos; 
      }
      
      if (c.name === 'choice_text') {
        if (c.font) settings.choiceFont = c.font;
        if (c.color) settings.choiceColor = c.color;
        if (c.fontsize) settings.choiceSize = formatSize(c.fontsize);
        if (c.outline) settings.choiceOutline = c.outline;
        if (c.pos) settings.choicePos = c.pos; 
      }
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
    if (!this.animId) this.update(); 
  }

  stop() { 
    this.type = null; 
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); 
    cancelAnimationFrame(this.animId); 
    this.animId = null; 
  }

  update() {
    if (!this.type) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    if (this.type === 'rain' && this.particles.length < 150) {
      this.particles.push({ x: Math.random() * this.canvas.width, y: -20, vy: 15 + Math.random() * 10, vx: Math.random() * 2 - 1, l: 15 + Math.random() * 20 });
    } else if (this.type === 'snow' && this.particles.length < 150) {
      this.particles.push({ x: Math.random() * this.canvas.width, y: -10, vy: 1 + Math.random() * 2, vx: Math.random() * 2 - 1, r: 1.5 + Math.random() * 2.5 });
    } else if (this.type === 'sparkle' && this.particles.length < 50 && Math.random() < 0.4) {
      this.particles.push({ x: Math.random() * this.canvas.width, y: Math.random() * this.canvas.height, vy: -0.5 - Math.random() * 1.5, vx: Math.random() * 1.5 - 0.75, r: 3 + Math.random() * 5, life: 0, maxLife: 40 + Math.random() * 30, hue: 40 + Math.random() * 20 });
    } else if (this.type === 'wind' && this.particles.length < 40 && Math.random() < 0.2) {
      this.particles.push({ x: this.canvas.width + 50, y: Math.random() * this.canvas.height, vx: -(15 + Math.random() * 15), vy: -0.2 + Math.random() * 0.4, l: 40 + Math.random() * 80, opacity: 0.1 + Math.random() * 0.2 });
    }
    
    if (this.type === 'rain' || this.type === 'snow') {
      this.ctx.fillStyle = 'white'; 
      this.ctx.strokeStyle = 'rgba(200, 220, 255, 0.6)'; 
      this.ctx.lineWidth = 1.5; 
      this.ctx.beginPath();
      
      for (let i = this.particles.length - 1; i >= 0; i--) {
        let p = this.particles[i]; 
        p.x += p.vx; p.y += p.vy;
        if (this.type === 'rain') { this.ctx.moveTo(p.x, p.y); this.ctx.lineTo(p.x - p.vx * 2, p.y - p.l); } 
        else if (this.type === 'snow') { this.ctx.moveTo(p.x, p.y); this.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); }
        if (p.y > this.canvas.height || p.x < -50 || p.x > this.canvas.width + 50) this.particles.splice(i, 1);
      }
      if (this.type === 'rain') this.ctx.stroke(); 
      else if (this.type === 'snow') this.ctx.fill();

    } else if (this.type === 'sparkle') {
      this.ctx.globalCompositeOperation = 'lighter'; 
      for (let i = this.particles.length - 1; i >= 0; i--) {
        let p = this.particles[i]; 
        p.x += p.vx; p.y += p.vy; p.life++;
        if (p.life > p.maxLife) { this.particles.splice(i, 1); continue; }
        
        let scale = Math.sin((p.life / p.maxLife) * Math.PI);
        let alpha = scale;
        
        this.ctx.save(); 
        this.ctx.translate(p.x, p.y); 
        this.ctx.rotate(p.life * 0.05);
        this.ctx.beginPath(); 
        this.ctx.arc(0, 0, p.r * scale * 3.5, 0, Math.PI * 2); 
        this.ctx.fillStyle = `hsla(${p.hue}, 100%, 50%, ${alpha * 0.3})`; 
        this.ctx.fill();
        
        let rayL = p.r * scale * 4.5;
        let rayW = p.r * scale * 0.6;
        this.ctx.fillStyle = `hsla(${p.hue}, 100%, 80%, ${alpha})`;
        this.ctx.fillRect(-rayW/2, -rayL, rayW, rayL*2); 
        this.ctx.fillRect(-rayL, -rayW/2, rayL*2, rayW);
        this.ctx.rotate(Math.PI / 4);
        this.ctx.fillRect(-rayW/2, -rayL*0.6, rayW, rayL*1.2); 
        this.ctx.fillRect(-rayL*0.6, -rayW/2, rayL*1.2, rayW);
        this.ctx.beginPath(); 
        this.ctx.arc(0, 0, p.r * scale * 0.8, 0, Math.PI * 2); 
        this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`; 
        this.ctx.fill();
        this.ctx.restore();
      }
      this.ctx.globalCompositeOperation = 'source-over'; 

    } else if (this.type === 'wind') {
      this.ctx.lineWidth = 2;
      for (let i = this.particles.length - 1; i >= 0; i--) {
        let p = this.particles[i]; 
        p.x += p.vx; p.y += p.vy;
        if (p.x < -p.l) { this.particles.splice(i, 1); continue; }
        this.ctx.strokeStyle = `rgba(220, 230, 240, ${p.opacity})`; 
        this.ctx.beginPath();
        this.ctx.moveTo(p.x, p.y); 
        this.ctx.lineTo(p.x + p.l, p.y - (p.vy/p.vx) * p.l); 
        this.ctx.stroke();
      }
    }
    
    this.animId = requestAnimationFrame(() => this.update());
  }

  destroy() { 
    this.stop(); 
    window.removeEventListener('resize', this.resize); 
  }
}

/* ======================================================================
 * Class: NovelGameEngine
 * ノベルゲームのメインロジック（シナリオ進行、演出、UI管理、セーブ）
 * ====================================================================== */
class NovelGameEngine {
  constructor() {
    this.$ = id => document.getElementById(id);
    
    this.state = {
      index: 0, typing: false, fullText: '', typingTimer: null, autoTimer: null, 
      isAuto: false, isSkip: false, skipTimer: null, prevScreen: 'title-screen', 
      saveMode: 'save', flags: {}, history: [], logs: [], uiHidden: false, 
      screenEffect: '', particleType: '', currentVoice: null, bgmFadeTimer: null, 
      charVoices: {}, currentVoiceBlobUrl: null, currentChapter: '',
      chapterStartData: null, currentSrcKey: 'src'
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

    this.setupWindowResizer();
    this.setupShortcuts();
    
    this.$('text-speed-slider').value = settings.textSpeed;
    this.$('bgm-slider').value = settings.bgmVolume * 100;
    this.$('se-slider').value = settings.seVolume * 100;
    this.$('voice-slider').value = settings.voiceVolume * 100;
    this.$('sys-se-slider').value = settings.sysSeVolume * 100;
    this.el.bgmPlayer.volume = settings.bgmVolume;
    
    if (window.speechSynthesis) window.speechSynthesis.getVoices();
  }

  getStepSrc(step) {
    if (!step) return null;
    const key = this.state.currentSrcKey || 'src';
    const val = (step[key] !== undefined && step[key] !== '') ? step[key] : step.src;
    if (!val) return null;
    return (step.dir && val) ? `${step.dir.replace(/\/$/, '')}/${val}` : val;
  }

  setVoiceVolume(val) { settings.voiceVolume = val / 100; if (this.state.currentVoice) this.state.currentVoice.volume = settings.voiceVolume; }
  setBgmVolume(sliderValue) { settings.bgmVolume = sliderValue / 100; this.el.bgmPlayer.volume = settings.bgmVolume; }

  setupWindowResizer() {
    window.addEventListener('resize', () => {
      const targetW = 1920; const targetH = 1080; const targetRatio = targetH / targetW;
      const w = window.innerWidth; const h = window.innerHeight; const c = this.$('game-canvas');
      if (h / w > targetRatio) { c.style.width = w + 'px'; c.style.height = (w * targetRatio) + 'px'; } 
      else { c.style.height = h + 'px'; c.style.width = (h / targetRatio) + 'px'; }
    });
    window.dispatchEvent(new Event('resize'));
  }

  setupShortcuts() {
    window.addEventListener('contextmenu', e => {
      const active = document.querySelector('.screen.active:not(.popup-overlay)')?.id || document.querySelector('.screen.active')?.id;
      if (active === 'game-screen' && this.el.choiceUi.style.display !== 'flex') { e.preventDefault(); this.toggleUI(); }
    });
    window.addEventListener('mousedown', e => { if (this.state.uiHidden && e.button === 0) this.toggleUI(); });
    window.addEventListener('wheel', e => {
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
          this.el.bgmPlayer.src = ''; 
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
    const hasManualSave = [...Array(99)].some((_,i) => localStorage.getItem(`save_slot_${i+1}`));
    let hasAutoSave = false;
    try {
      const autoList = JSON.parse(localStorage.getItem('save_auto_list') || '[]');
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

  startNewGame() {
    this.playSysSe(settings.seStart); 
    this.state.index = 0;
    this.state.flags = {}; 
    localStorage.setItem('global_flags', JSON.stringify({})); 
    
    this.state.history = []; this.state.logs = []; this.state.charVoices = {}; this.state.currentChapter = '';
    Object.values(this.charMap).forEach(e => { e.classList.add('hidden'); e.src = ''; e.dataset.charName = ''; });
    
    this.el.bgLayer.style.backgroundImage = ''; this.el.bgLayerNext.style.backgroundImage = ''; this.el.overlay.style.opacity = '0';
    this.state.screenEffect = ''; this.state.particleType = '';
    
    const gc = this.$('game-canvas'); 
    Array.from(gc.classList).forEach(c => { if(c.startsWith('fx-')) gc.classList.remove(c); });
    
    if (this.particleSystem) this.particleSystem.stop();
    this.el.bgmPlayer.pause(); 
    this.state.prevScreen = 'game-screen';
    
    // ▼ 保存されているスキン設定を読み込む
    const savedSrcKey = localStorage.getItem('global_src_key');
    this.state.currentSrcKey = savedSrcKey || 'src';
    
    // ▼ スキンが未選択の場合のみキャラ選択を出す
    if (window.app.availableSkins && window.app.availableSkins.length > 1 && !savedSrcKey) {
      this.fadeTransition(() => {
        this.openCharSelect();
      });
    } else {
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

  showChoices(choices, nextIndex) {
    this.stopSkip();
    this.state.isAuto = false; this.$('btn-auto').classList.remove('on');
    this.el.choiceUi.innerHTML = '';
    this.el.choiceUi.style.inset = '0'; this.el.choiceUi.style.transform = 'none';

    if (settings.choicePos) {
      const gapMatch = String(settings.choicePos).toLowerCase().match(/gap\s*:?\s*([\d.]+)/);
      if (gapMatch) this.el.choiceUi.style.gap = gapMatch[1] + 'px';
    }

    choices.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn'; 
      const btnText = c.text_rubi || c.text || '';
      const tokens = this.parseTextToTokens(btnText);
      const inner = document.createElement('span');
      inner.style.position = 'relative'; inner.style.display = 'block'; inner.style.pointerEvents = 'none';
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
        if (wMatch) btn.style.width = wMatch[1] + '%'; if (hMatch) btn.style.height = hMatch[1] + 'cqh';
      }
      
      btn.onclick = (e) => {
        e.stopPropagation();
        const nameStr = String(c.name || '').trim();
        if (nameStr) {
          const parts = nameStr.split(/[\s,，、]+/);
          parts.forEach(part => {
            if (part.includes(':')) { const [key, val] = part.split(':'); this.state.flags[key] = (this.state.flags[key] || 0) + parseInt(val, 10); } 
            else { this.state.flags[part] = true; }
          });
        } else { this.state.flags[c.text] = true; }
        localStorage.setItem('global_flags', JSON.stringify(this.state.flags));
        
        this.el.choiceUi.style.display = 'none'; this.state.index = nextIndex; 
        if (c.to) { this.jumpTo(c.to); } else { this.executeStep(); }
      };
      this.el.choiceUi.appendChild(btn);
    });
    this.el.choiceUi.style.display = 'flex';
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
        if (t === 'true') this.state.flags[step.name] = true;
        else if (t === 'false') this.state.flags[step.name] = false;
        else if (t === 'reset' || t === '0') this.state.flags[step.name] = 0;
        else {
          const val = step.text ? parseFloat(step.text) : 1;
          this.state.flags[step.name] = (this.state.flags[step.name] || 0) + val;
        }
        localStorage.setItem('global_flags', JSON.stringify(this.state.flags));
        break;
      }
      case 'se': {
        if (this.state.isSkip) break;
        this.el.sePlayer.src = getPath(step); this.el.sePlayer.volume = settings.seVolume; 
        await new Promise(resolve => {
          const timeout = setTimeout(resolve, 800);
          this.el.sePlayer.addEventListener('canplaythrough', () => { clearTimeout(timeout); resolve(); }, { once: true });
          this.el.sePlayer.addEventListener('error', () => { clearTimeout(timeout); resolve(); }, { once: true });
          if (this.el.sePlayer.readyState >= 3) { clearTimeout(timeout); resolve(); }
        });
        this.el.sePlayer.play().catch(()=>{}); 
        break;
      }
      case 'item': {
        this.$('item-img').src = getPath(step); this.$('item-popup').classList.remove('hidden');
        await new Promise(r => { const popup = this.$('item-popup'); popup.onclick = () => { popup.classList.add('hidden'); popup.onclick = null; r(); }; }); 
        break;
      }
      case 'show': {
        const sprite = this.charMap[step.pos]; 
        if (sprite) { 
          sprite.src = getPath(step); sprite.classList.remove('hidden'); sprite.dataset.charName = step.name || ''; 
          if (step.name && step.voice_type) this.state.charVoices[step.name] = { type: String(step.voice_type).toLowerCase(), id: step.voice_id || '' };
        } 
        break;
      }
      case 'hide': { if (this.charMap[step.pos]) this.charMap[step.pos].classList.add('hidden'); await new Promise(r => setTimeout(r, 400)); break; }
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
        const targetEl = step.pos === 'screen' ? this.$('game-canvas') : this.charMap[step.pos];
        if (!targetEl) break;
        Array.from(targetEl.classList).forEach(c => { if(c.startsWith('fx-')) targetEl.classList.remove(c); });
        
        if (step.name === 'clear') { if (step.pos === 'screen') this.state.screenEffect = ''; break; }
        const fxClass = (step.pos === 'screen' && step.name === 'shake') ? 'fx-screen-shake' : 'fx-' + step.name;
        void targetEl.offsetWidth; targetEl.classList.add(fxClass);
        if (step.pos === 'screen') this.state.screenEffect = fxClass;
        
        if (step.duration) { setTimeout(() => { targetEl.classList.remove(fxClass); if (step.pos === 'screen' && this.state.screenEffect === fxClass) this.state.screenEffect = ''; }, step.duration); } 
        else if (step.name === 'hop') { setTimeout(() => { targetEl.classList.remove(fxClass); }, 400); }
        break;
      }
      case 'particle': {
        this.state.particleType = step.name;
        if (step.name === 'clear' || !step.name) { if (this.particleSystem) this.particleSystem.stop(); } 
        else { if (!this.particleSystem) this.particleSystem = new ParticleSystem(this.$('particle-canvas')); this.particleSystem.start(step.name); }
        break;
      }
      case 'chapter': {
        this.stopSkip();
        this.state.isAuto = false; this.$('btn-auto').classList.remove('on');
        this.state.currentChapter = step.text || '';
        this.saveAutoSave(this.state.currentChapter);

        const chapterIndex = this.state.index;
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
        
        const tempIndex = this.state.index;
        this.state.index = chapterIndex;
        this.state.index = tempIndex;

        this.el.dialogUi.style.display = 'none'; this.$('game-menu-bar').style.display = 'none';
        this.el.bgLayer.style.backgroundImage = ''; this.el.bgLayerNext.style.backgroundImage = '';
        this.state.screenEffect = ''; this.state.particleType = '';
        Array.from(this.$('game-canvas').classList).forEach(c => { if(c.startsWith('fx-')) this.$('game-canvas').classList.remove(c); });
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
        
        const cText = step.text_rubi || step.text || '';
        chapText.innerHTML = this.buildRubyHtml(this.parseTextToTokens(cText)).replace(/\n/g, '<br>');
        
        chapScreen.classList.remove('hidden'); chapScreen.style.animation = 'none'; chapScreen.offsetHeight; 
        chapScreen.style.animation = 'chapterFadeInOut 4.5s ease forwards';
        
        await new Promise(r => setTimeout(r, 4500)); 
        chapScreen.classList.add('hidden'); this.el.dialogUi.style.display = ''; this.$('game-menu-bar').style.display = '';
        break;
      }
      case 'minigame': {
        this.stopSkip();
        this.state.isAuto = false; this.$('btn-auto').classList.remove('on');
        this.$('game-menu-bar').classList.add('ui-hidden');
        const isPopup = (step.pos === 'popup'); 
        const container = document.createElement('div');
        if (isPopup) { container.style.cssText = 'position:absolute; inset:0; z-index:200; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center;'; } 
        else { container.style.cssText = 'position:absolute; inset:0; z-index:200; background:#000;'; }
        
        const iframe = document.createElement('iframe'); 
        iframe.src = getPath(step);
        iframe.setAttribute('scrolling', 'no');
        
        if (isPopup) { 
          iframe.style.cssText = 'width: 80cqw; height: 80cqh; max-width: 90%; max-height: 90%; border:none; border-radius:1.5cqw; box-shadow:0 2cqw 5cqw rgba(0,0,0,0.8); background:#050508; overflow:hidden;'; 
        } else { 
          iframe.style.cssText = 'width: 100%; height: 100%; border:none; background:#000; overflow:hidden;'; 
        }
        
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
                this.state.flags = { ...this.state.flags, ...e.data.flags }; 
                localStorage.setItem('global_flags', JSON.stringify(this.state.flags));
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
        if (this.state.currentChapter) {
          this.saveAutoSave(this.state.currentChapter + " (クリア)");
        }
        this.endGame(); 
        return true;
      }
    }
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
  buildRubyHtml(tokens) { return tokens.map(t => typeof t === 'string' ? t : `<ruby>${t.kanji}<rt>${t.ruby}</rt></ruby>`).join(''); }

  async displayDialog(step) {
    this.saveSnapshot(); 
    this.el.dialogUi.classList.remove('hidden');
    if (!this.state.uiHidden) this.$('game-menu-bar').classList.remove('ui-hidden');

    const name = step.name || '';
    this.state.fullText = step.text_rubi || step.text || '';
    
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

    const speakingNames = name ? name.split(/[＆&・、,と\s]+/) : [];
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

    if (!audioSrc && name && !isHiddenName) {
      let vConf = null;
      for (const n of speakingNames) { if (this.state.charVoices[n]) { vConf = this.state.charVoices[n]; break; } }
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
      if (this.state.index !== voiceLoadIndex || !this.state.typing || !this.state.currentVoice || this.state.isSkip) return;
      this.state.currentVoice.play().catch(()=>{});
    } else if (isWebSpeech && window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(webSpeechText); u.lang = 'ja-JP'; u.volume = Math.min(1.0, settings.voiceVolume * 2);
      const voices = speechSynthesis.getVoices();
      if (webSpeechVoiceId) { const match = voices.find(v => v.name.includes(webSpeechVoiceId) || v.voiceURI.includes(webSpeechVoiceId)); if (match) u.voice = match; }
      if (this.state.typing) speechSynthesis.speak(u);
    }

    if (!this.state.typing) return;
    
    let i = 0;
    const typeChar = () => {
      if (i < textTokens.length) {
        const token = textTokens[i];
        if (typeof token === 'string') { this.el.dialogText.appendChild(document.createTextNode(token)); } 
        else {
          const rubyEl = document.createElement('ruby'); rubyEl.textContent = token.kanji;
          const rtEl = document.createElement('rt'); rtEl.textContent = token.ruby;
          rubyEl.appendChild(rtEl); this.el.dialogText.appendChild(rubyEl);
        }
        i++; this.state.typingTimer = setTimeout(typeChar, this.state.isSkip ? 5 : settings.textSpeed);
      } else { this.finishTyping(); }
    };
    typeChar();
  }

  finishTyping() {
    this.state.typing = false; this.el.dialogText.innerHTML = this.buildRubyHtml(this.parseTextToTokens(this.state.fullText)); 
    this.el.nextArrow.classList.add('visible');
    if (this.state.isAuto) this.state.autoTimer = setTimeout(() => this.advanceStory(), settings.autoDelay);
  }

  stopTyping() { clearTimeout(this.state.typingTimer); clearTimeout(this.state.autoTimer); this.state.typingTimer = this.state.autoTimer = null; this.state.typing = false; }

  onDialogClick(e) { 
    if (e && e.target.closest('button')) return; 
    if (this.state.uiHidden || this.el.choiceUi.style.display === 'flex') return; 
    this.playSysSe(settings.seClick); 
    if (this.state.typing) { this.stopTyping(); this.finishTyping(); } else { this.advanceStory(); } 
  }

  advanceStory() { if (this.state.index >= SCENARIO.length) return; if (!SCENARIO[this.state.index].cmd) { this.state.index++; this.executeStep(); } }

  toggleAuto() { 
    this.playSysSe(settings.seClick); this.state.isAuto = !this.state.isAuto; this.$('btn-auto').classList.toggle('on', this.state.isAuto); 
    if (this.state.isAuto && !this.state.typing) { this.state.autoTimer = setTimeout(() => this.advanceStory(), settings.autoDelay); } else { clearTimeout(this.state.autoTimer); }
  }

  startSkip() { 
    this.playSysSe(settings.seClick); this.state.isSkip = true; this.$('skip-overlay').style.display = 'block'; 
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
    this.stopVoice(); this.fadeBGM(''); this.state.screenEffect = ''; this.state.particleType = '';
    Array.from(this.$('game-canvas').classList).forEach(c => { if(c.startsWith('fx-')) this.$('game-canvas').classList.remove(c); });
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

  saveSnapshot() {
    if (this.state.history.length > 0 && this.state.history[this.state.history.length - 1].index === this.state.index) return;
    const charsSnap = {};
    for(const pos in this.charMap) { 
      const effect = Array.from(this.charMap[pos].classList).filter(c => c.startsWith('fx-')).join(' ');
      charsSnap[pos] = { src: this.charMap[pos].src, hidden: this.charMap[pos].classList.contains('hidden'), name: this.charMap[pos].dataset.charName, effect: effect }; 
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
    this.stopVoice(); this.stopTyping(); this.el.choiceUi.style.display = 'none';
    
    const snap = this.state.history.pop();
    this.state.logs = this.state.logs.filter(l => l.index < snap.index); 
    this.state.index = snap.index; 
    this.state.flags = JSON.parse(JSON.stringify(snap.flags)); 
    this.state.charVoices = JSON.parse(JSON.stringify(snap.charVoices || {})); 
    this.state.currentChapter = snap.currentChapter || ''; 
    this.state.chapterStartData = snap.chapterStartData || null;
    this.state.currentSrcKey = snap.currentSrcKey || 'src';
    this.el.bgLayer.style.backgroundImage = snap.bg;
    if (snap.bgm && this.el.bgmPlayer.src !== snap.bgm) this.fadeBGM(snap.bgm, true); 
    
    for(const pos in this.charMap) {
      if(snap.chars[pos]) {
        this.charMap[pos].src = snap.chars[pos].src || ''; this.charMap[pos].dataset.charName = snap.chars[pos].name || '';
        if (snap.chars[pos].hidden) { this.charMap[pos].classList.add('hidden'); } else { this.charMap[pos].classList.remove('hidden'); }
        Array.from(this.charMap[pos].classList).forEach(c => { if(c.startsWith('fx-')) this.charMap[pos].classList.remove(c); });
        if (snap.chars[pos].effect) { snap.chars[pos].effect.split(' ').forEach(e => { if(e) this.charMap[pos].classList.add(e); }); }
      }
    }
    
    const gameCanvas = this.$('game-canvas'); Array.from(gameCanvas.classList).forEach(c => { if(c.startsWith('fx-')) gameCanvas.classList.remove(c); });
    this.state.screenEffect = snap.screenEffect || ''; if (this.state.screenEffect) gameCanvas.classList.add(this.state.screenEffect);
    this.state.particleType = snap.particleType || '';
    if (!this.state.particleType || this.state.particleType === 'clear') { if (this.particleSystem) this.particleSystem.stop(); } 
    else { if (!this.particleSystem) this.particleSystem = new ParticleSystem(this.$('particle-canvas')); this.particleSystem.start(this.state.particleType); }
    this.executeStep();
  }

  rewindTo(targetIndex) {
    if (!confirm('この時点まで巻き戻しますか？\n（以降の選択肢や獲得したフラグ、ポイントはやり直しになります）')) return;
    this.playSysSe(settings.seClick);
    const targetSnapIndex = this.state.history.findIndex(h => h.index === targetIndex);
    if (targetSnapIndex === -1) { alert('履歴が古すぎるため、この時点までは戻れません。'); return; }
    
    this.stopVoice(); this.stopTyping(); this.el.choiceUi.style.display = 'none';
    const snap = this.state.history[targetSnapIndex];
    this.state.history = this.state.history.slice(0, targetSnapIndex); this.state.logs = this.state.logs.filter(l => l.index < targetIndex);
    this.state.index = snap.index; this.state.flags = JSON.parse(JSON.stringify(snap.flags)); this.state.charVoices = JSON.parse(JSON.stringify(snap.charVoices || {}));
    this.state.currentChapter = snap.currentChapter || ''; 
    this.state.chapterStartData = snap.chapterStartData || null;
    this.state.currentSrcKey = snap.currentSrcKey || 'src';
    this.el.bgLayer.style.backgroundImage = snap.bg;
    if (snap.bgm && this.el.bgmPlayer.src !== snap.bgm) { this.fadeBGM(snap.bgm, true); } else if (!snap.bgm) { this.fadeBGM(''); }
    
    for(const pos in this.charMap) {
      if(snap.chars[pos]) {
        this.charMap[pos].src = snap.chars[pos].src || ''; this.charMap[pos].dataset.charName = snap.chars[pos].name || '';
        if (snap.chars[pos].hidden) { this.charMap[pos].classList.add('hidden'); } else { this.charMap[pos].classList.remove('hidden'); }
        Array.from(this.charMap[pos].classList).forEach(c => { if(c.startsWith('fx-')) this.charMap[pos].classList.remove(c); });
        if (snap.chars[pos].effect) { snap.chars[pos].effect.split(' ').forEach(e => { if(e) this.charMap[pos].classList.add(e); }); }
      }
    }
    
    const gameCanvas = this.$('game-canvas'); Array.from(gameCanvas.classList).forEach(c => { if(c.startsWith('fx-')) gameCanvas.classList.remove(c); });
    this.state.screenEffect = snap.screenEffect || ''; if (this.state.screenEffect) gameCanvas.classList.add(this.state.screenEffect);
    this.state.particleType = snap.particleType || '';
    if (!this.state.particleType || this.state.particleType === 'clear') { if (this.particleSystem) this.particleSystem.stop(); } 
    else { if (!this.particleSystem) this.particleSystem = new ParticleSystem(this.$('particle-canvas')); this.particleSystem.start(this.state.particleType); }
    this.closeLog(); this.executeStep();
  }

  setPrevScreenForPopup() { const active = document.querySelector('.screen.active:not(.popup-overlay)')?.id; if (active) this.state.prevScreen = active; }

  openLog() {
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
    this.playSysSe(settings.seClick); this.setPrevScreenForPopup(); this.state.saveMode = mode; 
    this.$('save-mode-title').textContent = mode.toUpperCase(); this.renderSaveSlots(mode); this.showScreen('save-screen'); 
  }
  closeSaveLoad() { this.playSysSe(settings.seClick); this.showScreen(this.state.prevScreen); }
  
  createSaveData(label) {
    const charsData = {};
    for(const pos in this.charMap) { 
      const effect = Array.from(this.charMap[pos].classList).filter(c => c.startsWith('fx-')).join(' ');
      charsData[pos] = { src: this.charMap[pos].src, hidden: this.charMap[pos].classList.contains('hidden'), name: this.charMap[pos].dataset.charName, effect: effect }; 
    }
    const targetBg = this.el.bgLayerNext.style.opacity === '1' ? this.el.bgLayerNext.style.backgroundImage : this.el.bgLayer.style.backgroundImage;
    return { 
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
      currentSrcKey: this.state.currentSrcKey
    };
  }

  renderSaveSlots(mode) {
    const container = this.$('save-slots'); container.innerHTML = '';
    const usedSlots = []; for (let i = 1; i <= 99; i++) { if (localStorage.getItem(`save_slot_${i}`)) usedSlots.push(i); }
    const maxSlotIndex = usedSlots.length > 0 ? Math.max(...usedSlots) : 0;
    let displayCount = 4; while (usedSlots.length >= displayCount || maxSlotIndex >= displayCount) { displayCount += 2; }

    for (let i = 1; i <= displayCount; i++) {
      const data = JSON.parse(localStorage.getItem(`save_slot_${i}`) || 'null');
      const slot = document.createElement('div'); slot.className = 'save-slot';
      slot.innerHTML = `<div class="save-slot-num">SLOT ${i}</div><div class="save-slot-info">${data ? data.label : 'NO DATA'}</div>`;
      slot.onclick = () => { if (mode === 'save') { this.saveToSlot(i); } else if (data) { this.loadFromSlot(i); } };

      if (data) {
        const delBtn = document.createElement('button'); delBtn.className = 'save-slot-del'; delBtn.textContent = 'DEL';
        delBtn.onclick = (e) => { e.stopPropagation(); if (confirm(`SLOT ${i} のセーブデータを削除しますか？`)) { localStorage.removeItem(`save_slot_${i}`); this.renderSaveSlots(mode); } };
        slot.appendChild(delBtn);
      }
      container.appendChild(slot);
    }

    if (mode === 'load') {
      const autoSaves = JSON.parse(localStorage.getItem('save_auto_list') || '[]'); autoSaves.sort((a, b) => a.index - b.index);
      autoSaves.forEach((autoData, idx) => {
        const autoSlot = document.createElement('div'); autoSlot.className = 'save-slot auto-save-slot';
        autoSlot.innerHTML = `<div class="save-slot-num">AUTO SAVE ${idx + 1}</div><div class="save-slot-info">再開：${autoData.label}</div>`;
        autoSlot.onclick = () => this.loadSaveData(autoData); container.appendChild(autoSlot);
      });
    }
    const resetBtn = this.$('reset-all-btn'); if (resetBtn) resetBtn.style.display = (mode === 'load') ? 'block' : 'none';
  }

  saveToSlot(slot) {
    const step = SCENARIO[this.state.index];
    const preview = step && !step.cmd && step.text ? step.text.replace(/\n/g, '').slice(0, 15) + '…' : `Save #${this.state.index}`;
    const now = new Date(); const label = `${now.getMonth()+1}/${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')} ${preview}`;
    const data = this.createSaveData(label); 
    localStorage.setItem(`save_slot_${slot}`, JSON.stringify(data)); this.renderSaveSlots('save');
  }

  saveAutoSave(chapterText) {
    const labelStr = `【${chapterText}】`; 
    const data = this.createSaveData(labelStr);
    
    let autoSaves = [];
    try {
      autoSaves = JSON.parse(localStorage.getItem('save_auto_list') || '[]');
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
    localStorage.setItem('save_auto_list', JSON.stringify(autoSaves));
  }

  loadSaveData(data) {
    if (!data) return;
    this.state.index = data.index; 
    this.state.flags = JSON.parse(localStorage.getItem('global_flags') || '{}'); 
    this.state.charVoices = data.charVoices || {}; 
    this.state.currentChapter = data.currentChapter || '';
    this.state.chapterStartData = data.chapterStartData || null;
    this.state.currentSrcKey = localStorage.getItem('global_src_key') || data.currentSrcKey || 'src';
    this.state.history = []; this.state.logs = []; this.closeSaveLoad(); this.state.prevScreen = 'game-screen';
    
    this.fadeTransition(() => { 
      this.showScreen('game-screen'); this.el.dialogUi.classList.add('hidden'); 
      if (data.bg) { this.el.bgLayer.style.backgroundImage = data.bg; } else { this.el.bgLayer.style.backgroundImage = ''; }
      if (data.bgm) { this.fadeBGM(data.bgm, true); } else { this.fadeBGM(''); }
      
      if (data.chars) {
        for(const pos in this.charMap) {
          if(data.chars[pos]) {
            this.charMap[pos].src = data.chars[pos].src || ''; this.charMap[pos].dataset.charName = data.chars[pos].name || '';
            if (data.chars[pos].hidden) { this.charMap[pos].classList.add('hidden'); } else { this.charMap[pos].classList.remove('hidden'); }
            Array.from(this.charMap[pos].classList).forEach(c => { if(c.startsWith('fx-')) this.charMap[pos].classList.remove(c); });
            if (data.chars[pos].effect) { data.chars[pos].effect.split(' ').forEach(e => { if(e) this.charMap[pos].classList.add(e); }); }
          }
        }
      }

      const gameCanvas = this.$('game-canvas'); Array.from(gameCanvas.classList).forEach(c => { if(c.startsWith('fx-')) gameCanvas.classList.remove(c); });
      this.state.screenEffect = data.screenEffect || ''; if (this.state.screenEffect) gameCanvas.classList.add(this.state.screenEffect);
      this.state.particleType = data.particleType || '';
      if (!this.state.particleType || this.state.particleType === 'clear') { if (this.particleSystem) this.particleSystem.stop(); } 
      else { if (!this.particleSystem) this.particleSystem = new ParticleSystem(this.$('particle-canvas')); this.particleSystem.start(this.state.particleType); }
      this.executeStep(); 
    });
  }

  loadFromSlot(slot) { this.loadSaveData(JSON.parse(localStorage.getItem(`save_slot_${slot}`))); }

  resetAllSaves() {
    this.playSysSe(settings.seClick);
    if (confirm("すべてのセーブデータとオートセーブを完全に削除します。\nよろしいですか？")) {
      for (let i = 1; i <= 99; i++) { localStorage.removeItem(`save_slot_${i}`); }
      localStorage.removeItem('save_slot_auto'); localStorage.removeItem('save_auto_list');
      localStorage.removeItem('global_src_key');
      alert("すべてのセーブデータと設定を削除しました。"); this.renderSaveSlots(this.state.saveMode); this.$('continue-btn').disabled = true;
    }
  }

  openSystem() { 
    this.playSysSe(settings.seClick); 
    this.setPrevScreenForPopup(); 
    this.showScreen('system-screen'); 
  }
  closeSystem() { this.playSysSe(settings.seClick); this.showScreen(this.state.prevScreen); }

  openCharSelect() {
    this.playSysSe(settings.seClick);
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
    localStorage.setItem('global_src_key', this.state.currentSrcKey);
    this.showScreen('game-screen');
    this.executeStep();
  }

  async preloadGameImages(scenarioList, configList = []) {
    const getSrc = (dir, src) => (dir && src) ? `${dir.replace(/\/$/, '')}/${src}` : src;
    const urlSet = new Set();

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

    scenarioList.forEach(s => { 
      if ((s.cmd === 'config' && (s.name === 'title_bg' || s.name === 'title_image')) || ['bg', 'show', 'item'].includes(s.cmd)) { 
        skinKeys.forEach(key => {
          if (s[key]) urlSet.add(getSrc(s.dir, s[key]));
        });
      } 
    });
    
    const loadPromises = Array.from(urlSet).map(url => new Promise((res) => { const img = new Image(); img.onload = res; img.onerror = res; img.src = url; }));
    
    if (!this.sysAudioCache) this.sysAudioCache = {};
    if (settings.seClick && !this.sysAudioCache[settings.seClick]) { this.sysAudioCache[settings.seClick] = new Audio(settings.seClick); this.sysAudioCache[settings.seClick].preload = 'auto'; this.sysAudioCache[settings.seClick].load(); }
    if (settings.seStart && !this.sysAudioCache[settings.seStart]) { this.sysAudioCache[settings.seStart] = new Audio(settings.seStart); this.sysAudioCache[settings.seStart].preload = 'auto'; this.sysAudioCache[settings.seStart].load(); }
    await Promise.all(loadPromises);
  }
}

/* ======================================================================
 * Main Initialization Flow
 * DOM読み込み時のデータ取得、設定反映、プリロード処理
 * ====================================================================== */
document.addEventListener('DOMContentLoaded', async () => {
  window.app = new NovelGameEngine();
  const loaderEl = document.getElementById('loading-overlay'); 
  const dL = new DataLoader();

  if (typeof LOCAL_CONFIG !== 'undefined') {
    CONFIG = dL._parseData(LOCAL_CONFIG);
  }
  
  if (typeof LOCAL_SCENARIO !== 'undefined' && LOCAL_SCENARIO.length > 0) {
    SCENARIO = dL._parseData(LOCAL_SCENARIO); 
    console.log("ローカルのシナリオファイル (scenario.js) を読み込みました。");
  } else if (USER_SETTINGS.gasWebAppUrl) {
    const data = await dL.loadGasData(USER_SETTINGS.gasWebAppUrl);
    if (data.scenario && data.scenario.length > 0) SCENARIO = data.scenario;
    if (data.config && data.config.length > 0) CONFIG = data.config;
    console.log("GASからデータを取得しました。");
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
        thumb: (c.dir && c.src) ? `${c.dir.replace(/\/$/, '')}/${c.src}` : c.src
      });
    }
  });

  dL.applyConfigs(CONFIG); 
  await window.app.preloadGameImages(SCENARIO, CONFIG);

  loaderEl.style.opacity = '0';
  setTimeout(() => {
    loaderEl.style.display = 'none'; 
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
  }, 600);
});
