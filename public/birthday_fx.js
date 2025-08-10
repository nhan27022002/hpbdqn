
/*! BirthdayFX - overlay canvas effects (starfield, matrix rain, countdown, confetti)
 *  Drop-in script. Exposes global `BirthdayFX` with mount/start/pause/destroy.
 *  v1.0
 */
(function (global) {
  const clamp = (v,min,max)=> Math.max(min, Math.min(max, v));
  const easeOutCubic = p => 1 - Math.pow(1-p, 3);

  function gradient(ctx, SW, SH){
    const g = ctx.createRadialGradient(SW/2, SH*0.2, 10, SW/2, SH/2, Math.max(SW,SH));
    g.addColorStop(0,'#ffffff');
    g.addColorStop(0.35,'#ffd1e7');
    g.addColorStop(0.7,'#ff4fa3');
    g.addColorStop(1,'#8a1d59');
    return g;
  }

  function createCanvas(z){
    const c = document.createElement('canvas');
    c.style.position = 'absolute';
    c.style.inset = '0';
    c.style.width = '100%';
    c.style.height = '100%';
    c.style.pointerEvents = 'none';
    c.style.zIndex = String(z||0);
    return c;
  }

  function createContainer(target, zIndex){
    const wrap = document.createElement('div');
    wrap.className = 'birthdayfx-overlay';
    wrap.style.position = 'fixed';
    wrap.style.inset = '0';
    wrap.style.pointerEvents = 'none';
    wrap.style.zIndex = String(zIndex || 9999);
    target.appendChild(wrap);
    return wrap;
  }

  function BirthdaySystem(target, opts){
    this.opts = Object.assign({
      startDelay: 2000,
      message: 'HAPPY BIRTHDAY',
      lineSpacing: 2.0,
      rainSpeed: 0.35,
      showMatrix: true,
      confettiBurst: 240,
      backdrop: false,          // set to 'black' to cover background, or css color string
      zIndex: 9999,
      hotkeys: false            // set true to enable 'M' pause/resume
    }, opts||{});
    this.DPR = Math.min(global.devicePixelRatio || 1, 2);
    this.running = false;
    this._raf = null;
    this._nodes = [];
    this.SW = 0; this.SH = 0;

    // container
    this.wrap = createContainer(target || document.body, this.opts.zIndex);
    if (this.opts.backdrop) {
      this.wrap.style.background = typeof this.opts.backdrop === 'string' ? this.opts.backdrop : 'black';
    }

    // canvases
    this.starCanvas = createCanvas(0);
    this.fxCanvas   = createCanvas(1);
    this.matrixCanvas = createCanvas(2);
    this.countCanvas = createCanvas(3); // countdown + word animation

    this.wrap.appendChild(this.starCanvas);
    this.wrap.appendChild(this.fxCanvas);
    this.wrap.appendChild(this.matrixCanvas);
    this.wrap.appendChild(this.countCanvas);
    this._nodes.push(this.wrap);

    // contexts
    this.starCtx = this.starCanvas.getContext('2d');
    this.fxCtx   = this.fxCanvas.getContext('2d');
    this.mctx    = this.matrixCanvas.getContext('2d');
    this.ctnCtx  = this.countCanvas.getContext('2d');

    // state
    this.stars = []; this.hearts = [];
    this.confetti = [];
    this.letters = ' HAPPY BIRTHDAY '.split('');
    this.fontSize = 26; this.lineSpacing = this.opts.lineSpacing; this.cols = 0;
    this.drops = []; this.positions = [];

    // binders
    this._onResize = this.resizeAll.bind(this);
    this._onKey = (e)=>{ if(this.opts.hotkeys && e.key.toLowerCase()==='m'){ this.toggle(); } };
    global.addEventListener('resize', this._onResize);
    global.addEventListener('keydown', this._onKey);

    this.resizeAll();
    this.initStars();
  }

  BirthdaySystem.prototype.resizeCanvas = function(c, ctx){
    const w = global.innerWidth, h = global.innerHeight;
    this.SW = w; this.SH = h;
    const DPR = this.DPR;
    c.width = Math.floor(w*DPR);
    c.height = Math.floor(h*DPR);
    ctx.setTransform(DPR,0,0,DPR,0,0);
  };

  BirthdaySystem.prototype.initStars = function(){
    this.stars.length = 0;
    const count = Math.floor((this.SW*this.SH)/18000);
    for(let i=0;i<count;i++){
      this.stars.push({
        x: Math.random()*this.SW,
        y: Math.random()*this.SH,
        r: Math.random()*1.6 + 0.4,
        tw: Math.random()*Math.PI*2,
        sp: Math.random()*0.25 + 0.05
      });
    }
  };

  BirthdaySystem.prototype.drawStars = function(t){
    const ctx = this.starCtx, SW = this.SW, SH = this.SH;
    ctx.clearRect(0,0,SW,SH);
    // subtle vignette
    const g = ctx.createRadialGradient(SW/2, SH/2, Math.min(SW,SH)/4, SW/2, SH/2, Math.max(SW,SH));
    g.addColorStop(0,'rgba(0,0,0,.0)'); g.addColorStop(1,'rgba(0,0,0,.25)');
    ctx.fillStyle=g; ctx.fillRect(0,0,SW,SH);
    // stars
    for(const s of this.stars){
      const twinkle = (Math.sin(s.tw + t*0.002) + 1)/2;
      ctx.globalAlpha = 0.55 + twinkle*0.45;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill();
      s.tw += s.sp*0.05;
    }
    ctx.globalAlpha = 1;
    // hearts floating up
    if(this.hearts.length < 10 && Math.random()<0.05){
      const size = Math.random()*10 + 8;
      this.hearts.push({ x: Math.random()*SW, y: SH + 20, size,
        vy: 0.6 + Math.random()*0.8, vx:(Math.random()-.5)*0.4, a: 1, rot: Math.random()*Math.PI });
    }
    for(let i=this.hearts.length-1;i>=0;i--){
      const h = this.hearts[i];
      h.y -= h.vy; h.x += h.vx; h.a -= 0.007; h.rot += 0.02;
      if(h.a<=0 || h.y < -30) { this.hearts.splice(i,1); continue; }
      this.drawHeart(h.x, h.y, h.size, `rgba(255,79,163,${Math.max(0,h.a)})`, h.rot);
    }
  };

  BirthdaySystem.prototype.drawHeart = function(x,y,size,color,rot){
    const ctx = this.starCtx;
    ctx.save(); ctx.translate(x,y); ctx.rotate(rot);
    ctx.fillStyle = color; ctx.beginPath();
    const s = size/2;
    ctx.moveTo(0, s);
    ctx.bezierCurveTo(s, s, s, -s*0.2, 0, -s*0.6);
    ctx.bezierCurveTo(-s, -s*0.2, -s, s, 0, s);
    ctx.closePath(); ctx.fill(); ctx.restore();
  };

  BirthdaySystem.prototype.resizeMatrix = function(){
    const SW = this.SW, SH = this.SH, mctx = this.mctx;
    this.matrixCanvas.width = Math.floor(SW*this.DPR);
    this.matrixCanvas.height = Math.floor(SH*this.DPR);
    mctx.setTransform(this.DPR,0,0,this.DPR,0,0);
    this.fontSize = Math.max(18, Math.floor(SW/60));
    this.cols = Math.floor(SW / this.fontSize);
    this.drops = new Array(this.cols).fill(0).map(()=> 0);
    this.positions = new Array(this.cols).fill(0).map(()=> (Math.random()*this.letters.length)|0);
    mctx.font = `${this.fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace`;
    mctx.textBaseline='top';
  };

  BirthdaySystem.prototype.drawMatrix = function(){
    const mctx = this.mctx, SW = this.SW, SH = this.SH;
    mctx.fillStyle = 'rgba(0,0,0,0.08)';
    mctx.fillRect(0,0,SW,SH);
    mctx.fillStyle = '#ff4fa3';
    mctx.shadowColor = '#ff4fa3';
    mctx.shadowBlur = 14;
    const lineSpacing = this.lineSpacing;
    for(let i=0;i<this.cols;i++){
      const text = this.letters[this.positions[i]];
      const x = i * this.fontSize; const y = this.drops[i] * this.fontSize * lineSpacing;
      mctx.fillText(text, x, y);
      if(y > SH && Math.random() > 0.975){
        this.drops[i] = 0; this.positions[i] = 0;
      } else if (y <= SH){
        this.positions[i] = (this.positions[i] + 1) % this.letters.length;
      }
      this.drops[i] += this.opts.rainSpeed;
    }
    mctx.shadowBlur = 0; mctx.shadowColor = 'transparent';
  };

  BirthdaySystem.prototype.resizeCountdown = function(){
    this.countCanvas.width = Math.floor(this.SW*this.DPR);
    this.countCanvas.height = Math.floor(this.SH*this.DPR);
    this.ctnCtx.setTransform(this.DPR,0,0,this.DPR,0,0);
  };

  BirthdaySystem.prototype.drawDigitDots = function(ch){
    const ctnCtx = this.ctnCtx, SW = this.SW, SH = this.SH;
    ctnCtx.clearRect(0,0,SW,SH);
    const off = document.createElement('canvas');
    const octx = off.getContext('2d');
    off.width = Math.floor(SW*this.DPR); off.height = Math.floor(SH*this.DPR);
    octx.setTransform(this.DPR,0,0,this.DPR,0,0);
    let fz = Math.min(SW, SH) * 0.35;
    octx.fillStyle = '#fff';
    octx.font = `900 ${fz}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace`;
    octx.textAlign = 'center'; octx.textBaseline = 'middle';
    octx.fillText(ch, SW/2, SH/2);

    const step = Math.max(4, Math.floor(Math.min(SW, SH)/120));
    const { data } = octx.getImageData(0,0,SW,SH);
    const dots = [];
    for(let y=0;y<SH;y+=step){
      for(let x=0;x<SW;x+=step){
        const a = data[(y*SW + x)*4 + 3];
        if(a>10) dots.push({x,y});
      }
    }
    const grad = gradient(ctnCtx, SW, SH);
    ctnCtx.fillStyle = grad;
    ctnCtx.shadowColor = '#ff4fa3';
    ctnCtx.shadowBlur = 16;
    for(const d of dots){
      ctnCtx.beginPath(); ctnCtx.arc(d.x, d.y, step/2.2, 0, Math.PI*2); ctnCtx.fill();
    }
    ctnCtx.shadowBlur = 0; ctnCtx.shadowColor = 'transparent';
    return { dots, step };
  };

  BirthdaySystem.prototype.disperseDots = function(dots, step, duration, done){
    const ctnCtx = this.ctnCtx, SW = this.SW, SH = this.SH;
    const parts = dots.map(d=>({ x:d.x, y:d.y, vx:(Math.random()-.5)*4, vy:(Math.random()-.5)*4, r: step/2.2 }));
    const start = performance.now();
    const tick = (t)=>{
      const p = Math.min(1, (t-start)/duration);
      ctnCtx.clearRect(0,0,SW,SH);
      ctnCtx.globalAlpha = 1-p;
      ctnCtx.fillStyle = gradient(ctnCtx, SW, SH);
      ctnCtx.shadowColor = '#ff4fa3';
      ctnCtx.shadowBlur = 16*(1-p);
      for(const pt of parts){
        pt.x += pt.vx; pt.y += pt.vy;
        ctnCtx.beginPath(); ctnCtx.arc(pt.x, pt.y, Math.max(0.1, pt.r*(1-p)), 0, Math.PI*2); ctnCtx.fill();
      }
      ctnCtx.globalAlpha = 1; ctnCtx.shadowBlur = 0; ctnCtx.shadowColor = 'transparent';
      if(p < 1) this._raf = requestAnimationFrame(tick); else { if(done) done(); }
    };
    this._raf = requestAnimationFrame(tick);
  };

  BirthdaySystem.prototype.getWordDots = function(text){
    const SW = this.SW, SH = this.SH, DPR = this.DPR;
    const off = document.createElement('canvas');
    const octx = off.getContext('2d');
    off.width = Math.floor(SW*DPR); off.height = Math.floor(SH*DPR);
    octx.setTransform(DPR,0,0,DPR,0,0);
    let fz = Math.min(SW, SH) * 0.18;
    octx.font = `900 ${fz}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace`;
    octx.textAlign = 'center'; octx.textBaseline = 'middle';
    let metrics = octx.measureText(text), tries=0;
    while(metrics.width > SW*0.9 && tries < 12){
      fz *= 0.92; octx.font = `900 ${fz}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace`;
      metrics = octx.measureText(text); tries++;
    }
    octx.fillStyle = '#fff'; octx.fillText(text, SW/2, SH/2);
    const step = Math.max(4, Math.floor(Math.min(SW, SH)/130));
    const { data } = octx.getImageData(0,0,SW,SH);
    const dots = [];
    for(let y=0;y<SH;y+=step){
      for(let x=0;x<SW;x+=step){
        const a = data[(y*SW + x)*4 + 3];
        if(a>10) dots.push({x,y});
      }
    }
    return {dots, step};
  };

  BirthdaySystem.prototype.animateWordSequence = function(text, onDone){
    const ctnCtx = this.ctnCtx, SW = this.SW, SH = this.SH;
    const {dots, step} = this.getWordDots(text || this.opts.message);
    const parts = dots.map(d=>({ tx:d.x, ty:d.y, x: SW/2 + (Math.random()-0.5)*50, y: SH/2 + (Math.random()-0.5)*50, r: 0, tr: step/2.2, vx:(Math.random()-.5)*0.8, vy:(Math.random()-.5)*0.8 }));
    const inDur = 900, holdDur = 1200, outDur = 900;
    const startIn = performance.now();
    const render = (alpha=1)=>{
      ctnCtx.clearRect(0,0,SW,SH);
      ctnCtx.fillStyle = gradient(ctnCtx, SW, SH);
      ctnCtx.shadowColor = '#ff4fa3'; ctnCtx.shadowBlur = 18*alpha;
      for(const p of parts){ ctnCtx.beginPath(); ctnCtx.arc(p.x, p.y, Math.max(0.1, p.r), 0, Math.PI*2); ctnCtx.fill(); }
      ctnCtx.shadowBlur = 0; ctnCtx.shadowColor = 'transparent';
    };
    const stepIn = (t)=>{
      const p = Math.min(1, (t-startIn)/inDur); const e = easeOutCubic(p);
      for(const pt of parts){ pt.x += (pt.tx - pt.x)*e; pt.y += (pt.ty - pt.y)*e; pt.r = pt.tr*e; }
      render(1);
      if(p<1) this._raf = requestAnimationFrame(stepIn); else setTimeout(()=>{
        const startOut = performance.now();
        const stepOut = (t2)=>{
          const q = Math.min(1, (t2 - startOut)/outDur); const fade = 1-q;
          ctnCtx.clearRect(0,0,SW,SH);
          ctnCtx.globalAlpha = fade;
          ctnCtx.fillStyle = gradient(ctnCtx, SW, SH); ctnCtx.shadowColor='#ff4fa3'; ctnCtx.shadowBlur=18*fade;
          for(const pt of parts){ pt.x += pt.vx; pt.y += pt.vy + 0.02; ctnCtx.beginPath(); ctnCtx.arc(pt.x, pt.y, Math.max(0.1, pt.tr*fade), 0, Math.PI*2); ctnCtx.fill(); }
          ctnCtx.globalAlpha = 1; ctnCtx.shadowBlur=0; ctnCtx.shadowColor='transparent';
          if(q<1) this._raf = requestAnimationFrame(stepOut); else { ctnCtx.clearRect(0,0,SW,SH); if(onDone) onDone(); }
        };
        this._raf = requestAnimationFrame(stepOut);
      }, holdDur);
    };
    this._raf = requestAnimationFrame(stepIn);
  };

  BirthdaySystem.prototype.emitConfetti = function(n){
    const SW = this.SW, SH = this.SH;
    const colors = ['#ffffff','#ffd1e7','#ff4fa3','#8a1d59','#f9a8d4','#fecdd3'];
    for(let i=0;i<n;i++){
      const ang = Math.random()*Math.PI*2;
      const speed = 2 + Math.random()*4;
      this.confetti.push({
        x: SW/2, y: SH/3, vx: Math.cos(ang)*speed, vy: Math.sin(ang)*speed - 2,
        size: 2 + Math.random()*3, rot: Math.random()*Math.PI, vr: (Math.random()-.5)*0.3,
        life: 120+Math.random()*120, color: colors[(Math.random()*colors.length)|0]
      });
    }
  };

  BirthdaySystem.prototype.drawConfetti = function(dt){
    const ctx = this.fxCtx, SW = this.SW, SH = this.SH;
    ctx.clearRect(0,0,SW,SH);
    for(let i=this.confetti.length-1;i>=0;i--){
      const p = this.confetti[i];
      p.vy += 0.02; // gravity
      p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= 1;
      if(p.life<=0 || p.y>SH+20){ this.confetti.splice(i,1); continue; }
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color; ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size*1.6);
      ctx.restore();
    }
  };

  BirthdaySystem.prototype.loop = function(ts){
    if(!this.running) return;
    const dt = ts - (this._last||ts); this._last = ts;
    this.drawStars(ts);
    if(this.opts.showMatrix) this.drawMatrix();
    this.drawConfetti(dt);
    this._raf = requestAnimationFrame(this.loop.bind(this));
  };

  BirthdaySystem.prototype.startSequence = function(){
    // 2s after mount -> countdown 3,2,1 -> disperse -> word -> confetti
    setTimeout(()=>{
      const runCountdown = (numbers, done)=>{
        let idx = 0;
        const step = ()=>{
          const {dots, step:dotSize} = this.drawDigitDots(numbers[idx]);
          const isLast = idx === numbers.length - 1;
          idx++;
          if(!isLast){
            setTimeout(step, 1000);
          }else{
            setTimeout(()=>{
              this.disperseDots(dots, dotSize, 700, ()=>{
                this.animateWordSequence(this.opts.message, done);
                this.emitConfetti(this.opts.confettiBurst);
              });
            }, 800);
          }
        };
        step();
      };
      runCountdown(['3','2','1']);
    }, this.opts.startDelay);
  };

  BirthdaySystem.prototype.resizeAll = function(){
    this.resizeCanvas(this.starCanvas, this.starCtx);
    this.resizeCanvas(this.fxCanvas, this.fxCtx);
    this.resizeMatrix();
    this.resizeCountdown();
    this.initStars();
  };

  BirthdaySystem.prototype.start = function(){
    if(this.running) return this;
    this.running = true; this._last = 0;
    this._raf = requestAnimationFrame(this.loop.bind(this));
    this.startSequence();
    return this;
  };

  BirthdaySystem.prototype.pause = function(){
    this.running = false;
    if(this._raf) cancelAnimationFrame(this._raf);
    return this;
  };

  BirthdaySystem.prototype.toggle = function(){
    if(this.running) this.pause(); else this.start();
  };

  BirthdaySystem.prototype.destroy = function(){
    try{
      this.pause();
      global.removeEventListener('resize', this._onResize);
      global.removeEventListener('keydown', this._onKey);
      this._nodes.forEach(n=> n && n.parentNode && n.parentNode.removeChild(n));
    }catch(e){}
  };

  // Public API
  const API = {
    mount(target, opts){
      const sys = new BirthdaySystem(target || document.body, opts || {});
      sys.start();
      return sys;
    },
    destroy(instance){
      instance && instance.destroy();
    }
  };

  global.BirthdayFX = API;
})(window);
