import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import "@dotlottie/player-component";
import "./App.css";
import { Cake } from "./components/Cake";
import { CakeActions } from "./components/CakeActions";
import Joyride, { ACTIONS, CallBackProps } from "react-joyride";

// ====== AUDIO ======
const src = new URL("/assets/hbd2.mp3", import.meta.url).href;

// ====== JOYRIDE STEPS ======
const steps = [
  { target: "#start", content: "Nhấn 'Bắt đầu' để phát nhạc và thắp nến.", placement: "top", disableBeacon: true },
  { target: "#candle", content: "Thổi vào cổng sạc Lightning để tắt nến.", placement: "bottom" },
  { target: "#pause", content: "Nhấn 'Tạm dừng' nếu muốn tạm dừng nhạc.", placement: "top" },
  { target: "#stop", content: "Nhấn 'Dừng' nếu muốn hủy và quay lại.", placement: "top" },
  { target: "#toggle-candle", content: "Nhấn nút này để thắp hoặc tắt nến.", placement: "top" },
] as any;

const sharedSteps = [
  { target: "#start", content: "Nhấn vào đây để bắt đầu.", placement: "top", disableBeacon: true },
] as any;

// ====== INTRO (Canvas) CONFIG ======
const INTRO_START_DELAY = 2000; // 2s chờ rồi hiện số 3
const INTRO_RAIN_SPEED = 0.35; // tốc độ mưa chữ
const INTRO_LINE_SPACING = 2.0; // giãn dòng theo cột
const INTRO_MESSAGE = "HAPPY BIRTHDAY";
const INTRO_CONFETTI = 240; // số mảnh confetti khi chúc mừng
const INTRO_WORD_SHIFT = -0.05; // dịch chữ HBD sang trái ~5% chiều rộng màn hình
const INTRO_MARGIN = 0.04; // lề an toàn 4% để không bị cắt cạnh

// ====== UTILS CHUNG ======
const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

function gradColor(ctx: CanvasRenderingContext2D, SW: number, SH: number) {
  const g = ctx.createRadialGradient(SW / 2, SH * 0.2, 10, SW / 2, SH / 2, Math.max(SW, SH));
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.35, "#ffd1e7");
  g.addColorStop(0.7, "#ff4fa3");
  g.addColorStop(1, "#8a1d59");
  return g;
}

// ====== MAIN APP ======
function App() {
  // ---- States gốc ----
  const [candleVisible, setCandleVisible] = useState(false);
  const [showLetterButton, setShowLetterButton] = useState(false);
  const [showLetter, setShowLetter] = useState(false);

// Nội dung thư — dùng \n để xuống dòng theo ý bạn
  const letterText = `Chúc em sinh nhật vui vẻ nhé
   Tuổi mới thêm niềm vui mới
Cầu gì được nấy
 Cầu tiền được tiền
 Cầu tình được tình
 Cầu tài được tài
Chúc em sống mãi trong ánh sáng của 10 phương chư phật.
Lớp bờ du :)) 🎂🎉
😘😘`;

  const audioRef = useRef<HTMLAudioElement>(new Audio(src));
  const microphoneStreamRef = useRef<MediaStream | undefined>(undefined);
  const micIntervalRef = useRef<number | null>(null);

  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [run, setRun] = useState(true);
  const [shareMode, setShareMode] = useState(false);

  const visibility = shareMode || playing;

  // ---- States intro overlay ----
  const [entered, setEntered] = useState(false);     // Đã vào phần bánh kem (ẩn intro)
  const [showEnter, setShowEnter] = useState(false); // Hiện nút "Nhận bánh kem"
  const [introButtonTop, setIntroButtonTop] = useState<number | null>(null);
  // vị trí chấm hướng dẫn (beacon) dưới bánh
  // ---- Refs canvas intro ----
  const starsRef = useRef<HTMLCanvasElement | null>(null);
  const fxRef = useRef<HTMLCanvasElement | null>(null);
  const matrixRef = useRef<HTMLCanvasElement | null>(null);
  const ctnRef = useRef<HTMLCanvasElement | null>(null);

  const dprRef = useRef(Math.min(window.devicePixelRatio || 1, 2));
  const SWRef = useRef(window.innerWidth);
  const SHRef = useRef(window.innerHeight);
  const rafRef = useRef<number | null>(null);

  // stars/hearts
  const stars = useRef<Array<{ x: number; y: number; r: number; tw: number; sp: number }>>([]);
  const hearts = useRef<Array<{ x: number; y: number; size: number; vy: number; vx: number; a: number; rot: number }>>([]);

  // confetti
  const confetti = useRef<Array<{ x: number; y: number; vx: number; vy: number; size: number; rot: number; vr: number; life: number; color: string }>>([]);

  // flag: đang animate chữ HBD để giảm tải render
  const wordAnimActiveRef = useRef(false);
  const wordBBoxRef = useRef<{minX:number;maxX:number;minY:number;maxY:number} | null>(null);

  // matrix
  const letters = useMemo(() => " HAPPY BIRTHDAY ".split(""), []);
  const mFontSizeRef = useRef(26);
  const mColsRef = useRef(0);
  const mDropsRef = useRef<number[]>([]);
  const mPosRef = useRef<number[]>([]);

  // ====== LOGIC GỐC: Candle & Audio ======
  const lightCandle = useCallback(() => setCandleVisible(true), []);
  const turnOffTheCandle = useCallback(() => setCandleVisible(false), []);
  const toggleLightCandle = useCallback(() => setCandleVisible((prev) => !prev), []);

  const startAudio = useCallback(() => {
    setPlaying(true);
    audioRef.current.load();
    audioRef.current.play();
    setPaused(false);
  }, []);

  const pause = useCallback(() => {
    audioRef.current.pause();
    setPaused(true);
  }, []);

  const stopAudio = useCallback(() => {
    setPlaying(false);
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setPaused(false);
  }, []);

  const start = useCallback(() => {
    startAudio();
    lightCandle();
    setShowLetterButton(false);
    setShowLetter(false);
  }, [lightCandle, startAudio]);

  const stop = useCallback(() => {
    stopAudio();
    turnOffTheCandle();
  }, [stopAudio, turnOffTheCandle]);

  const blowCandles = useCallback(async (stream: MediaStream) => {
    try {
      microphoneStreamRef.current = stream;
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      source.connect(analyser);
      analyser.fftSize = 2048;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const detectBlow = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((acc, val) => acc + val, 0) / bufferLength;
        const threshold = 43;
        if (average > threshold) {
          setCandleVisible(false);
          setShowLetterButton(true);
        }
      };

      // Clear nếu đang tồn tại trước đó
      if (micIntervalRef.current) window.clearInterval(micIntervalRef.current);
      micIntervalRef.current = window.setInterval(detectBlow, 80);
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  }, []);

  const handleJoyrideCallback = useCallback((data: CallBackProps) => {
    const { action } = data;
    if (action === ACTIONS.RESET || action === ACTIONS.CLOSE) {
      setRun(false);
    }
  }, []);

  // Chỉ xin microphone SAU KHI đã vào app (sau intro)
  useEffect(() => {
    if (!entered) return;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (stream) blowCandles(stream);
      } catch (error) {
        console.error("Error accessing microphone:", error);
      }
    })();

    return () => {
      if (micIntervalRef.current) window.clearInterval(micIntervalRef.current);
      if (microphoneStreamRef.current) {
        microphoneStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [entered, blowCandles]);

  useLayoutEffect(() => {
    const sharedParam = new URLSearchParams(window.location.search).get("shared");
    if (sharedParam) {
      setCandleVisible(true);
      setShareMode(true);
    }
  }, []);

  

  

  // ====== INTRO (Canvas) – Helpers ======
  const resizeCanvas = (c: HTMLCanvasElement | null, ctx: CanvasRenderingContext2D | null) => {
    if (!c || !ctx) return;
    const w = window.innerWidth, h = window.innerHeight;
    SWRef.current = w; SHRef.current = h;
    const DPR = dprRef.current;
    c.width = Math.floor(w * DPR);
    c.height = Math.floor(h * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  };

  const initStars = () => {
    const SW = SWRef.current, SH = SHRef.current;
    stars.current.length = 0;
    const count = Math.floor((SW * SH) / 18000);
    for (let i = 0; i < count; i++) {
      stars.current.push({ x: Math.random() * SW, y: Math.random() * SH, r: Math.random() * 1.6 + 0.4, tw: Math.random() * Math.PI * 2, sp: Math.random() * 0.25 + 0.05 });
    }
  };

  const drawHeart = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, rot: number) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.fillStyle = color; ctx.beginPath();
    const s = size / 2;
    ctx.moveTo(0, s);
    ctx.bezierCurveTo(s, s, s, -s * 0.2, 0, -s * 0.6);
    ctx.bezierCurveTo(-s, -s * 0.2, -s, s, 0, s);
    ctx.closePath(); ctx.fill(); ctx.restore();
  };

  const drawStars = (ctx: CanvasRenderingContext2D, t: number) => {
    const SW = SWRef.current, SH = SHRef.current;
    ctx.clearRect(0, 0, SW, SH);
    const g = ctx.createRadialGradient(SW / 2, SH / 2, Math.min(SW, SH) / 4, SW / 2, SH / 2, Math.max(SW, SH));
    g.addColorStop(0, "rgba(0,0,0,.0)"); g.addColorStop(1, "rgba(0,0,0,.25)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, SW, SH);

    for (const s of stars.current) {
      const tw = (Math.sin(s.tw + t * 0.002) + 1) / 2;
      ctx.globalAlpha = 0.55 + tw * 0.45;
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      s.tw += s.sp * 0.05;
    }
    ctx.globalAlpha = 1;

    if (hearts.current.length < 10 && Math.random() < 0.05) {
      const size = Math.random() * 10 + 8;
      hearts.current.push({ x: Math.random() * SW, y: SH + 20, size, vy: 0.6 + Math.random() * 0.8, vx: (Math.random() - .5) * 0.4, a: 1, rot: Math.random() * Math.PI });
    }
    for (let i = hearts.current.length - 1; i >= 0; i--) {
      const h = hearts.current[i];
      h.y -= h.vy; h.x += h.vx; h.a -= 0.007; h.rot += 0.02;
      if (h.a <= 0 || h.y < -30) { hearts.current.splice(i, 1); continue; }
      drawHeart(ctx, h.x, h.y, h.size, `rgba(255,79,163,${Math.max(0, h.a)})`, h.rot);
    }
  };

  const emitConfetti = (n = INTRO_CONFETTI) => {
    const SW = SWRef.current, SH = SHRef.current;
    const colors = ["#ffffff", "#ffd1e7", "#ff4fa3", "#8a1d59", "#f9a8d4", "#fecdd3"];
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      confetti.current.push({ x: SW / 2, y: SH / 3, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed - 2, size: 2 + Math.random() * 3, rot: Math.random() * Math.PI, vr: (Math.random() - .5) * 0.3, life: 120 + Math.random() * 120, color: colors[(Math.random() * colors.length) | 0] });
    }
  };

  const drawConfetti = (ctx: CanvasRenderingContext2D) => {
    const SW = SWRef.current, SH = SHRef.current;
    ctx.clearRect(0, 0, SW, SH);
    for (let i = confetti.current.length - 1; i >= 0; i--) {
      const p = confetti.current[i];
      p.vy += 0.02;
      p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= 1;
      if (p.life <= 0 || p.y > SH + 20) { confetti.current.splice(i, 1); continue; }
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.6);
      ctx.restore();
    }
  };

  const resizeMatrix = (ctx: CanvasRenderingContext2D | null) => {
    if (!matrixRef.current || !ctx) return;
    const SW = SWRef.current, SH = SHRef.current, DPR = dprRef.current;
    matrixRef.current.width = Math.floor(SW * DPR);
    matrixRef.current.height = Math.floor(SH * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    mFontSizeRef.current = Math.max(18, Math.floor(SW / 60));
    mColsRef.current = Math.floor(SW / mFontSizeRef.current);
    mDropsRef.current = new Array(mColsRef.current).fill(0).map(() => 0);
    mPosRef.current = new Array(mColsRef.current).fill(0).map(() => (Math.random() * letters.length) | 0);
    ctx.font = `${mFontSizeRef.current}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace`;
    ctx.textBaseline = "top";
  };

  const drawMatrix = (ctx: CanvasRenderingContext2D) => {
    const SW = SWRef.current, SH = SHRef.current;
    const fontSize = mFontSizeRef.current;
    const cols = mColsRef.current;
    const drops = mDropsRef.current;
    const positions = mPosRef.current;

    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.fillRect(0, 0, SW, SH);

    ctx.fillStyle = "#ff4fa3";
    ctx.shadowColor = "#ff4fa3";
    ctx.shadowBlur = 14;

    const lineSpacing = INTRO_LINE_SPACING;
    for (let i = 0; i < cols; i++) {
      const text = letters[positions[i]];
      const x = i * fontSize; const y = drops[i] * fontSize * lineSpacing;
      ctx.fillText(text, x, y);
      if (y > SH && Math.random() > 0.975) {
        drops[i] = 0; positions[i] = 0;
      } else if (y <= SH) {
        positions[i] = (positions[i] + 1) % letters.length;
      }
      drops[i] += INTRO_RAIN_SPEED;
    }
    ctx.shadowBlur = 0; ctx.shadowColor = "transparent";
  };

  const drawDigitDots = (ctx: CanvasRenderingContext2D, ch: string) => {
    const SW = SWRef.current, SH = SHRef.current;
    ctx.clearRect(0, 0, SW, SH);
    const off = document.createElement("canvas");
    const octx = off.getContext("2d")!;
    off.width = SW; off.height = SH;
    let fz = Math.min(SW, SH) * 0.35;
    octx.fillStyle = "#fff";
    octx.font = `900 ${fz}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace`;
    octx.textAlign = "center"; octx.textBaseline = "middle";
    octx.fillText(ch, SW / 2, SH / 2);

    const step = Math.max(4, Math.floor(Math.min(SW, SH) / 120));
    const { data } = octx.getImageData(0, 0, SW, SH);
    const dots: { x: number; y: number }[] = [];
    let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
    for (let y = 0; y < SH; y += step) {
      for (let x = 0; x < SW; x += step) {
        const a = data[(y * SW + x) * 4 + 3];
        if (a > 10) {
          dots.push({ x, y });
          if(x<minX)minX=x; if(y<minY)minY=y; if(x>maxX)maxX=x; if(y>maxY)maxY=y;
        }
      }
    }
    if (dots.length) {
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
      const marginX = SW * INTRO_MARGIN, marginY = SH * INTRO_MARGIN;
      let dx = SW/2 - cx + SW*INTRO_WORD_SHIFT;
      let dy = SH/2 - cy;
      dx = clamp(dx, marginX - minX, (SW - marginX) - maxX);
      dy = clamp(dy, marginY - minY, (SH - marginY) - maxY);
      for (const d of dots) { d.x += dx; d.y += dy; }
    }

    ctx.fillStyle = gradColor(ctx, SW, SH);
    ctx.shadowColor = "#ff4fa3";
    ctx.shadowBlur = 12;
    for (const d of dots) {
      ctx.beginPath(); ctx.arc(d.x, d.y, step / 2.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0; ctx.shadowColor = "transparent";
    return { dots, step };
  };

  const disperseDots = (ctx: CanvasRenderingContext2D, dots: { x: number; y: number }[], step: number, duration = 700) => new Promise<void>((resolve) => {
    const SW = SWRef.current, SH = SHRef.current;
    const parts = dots.map(d => ({ x: d.x, y: d.y, vx: (Math.random() - .5) * 4, vy: (Math.random() - .5) * 4, r: step / 2.2 }));
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      ctx.clearRect(0, 0, SW, SH);
      ctx.globalAlpha = 1 - p;
      ctx.fillStyle = gradColor(ctx, SW, SH);
      ctx.shadowColor = "#ff4fa3"; ctx.shadowBlur = 16 * (1 - p);
      for (const pt of parts) {
        pt.x += pt.vx; pt.y += pt.vy;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, Math.max(0.1, pt.r * (1 - p)), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.shadowColor = "transparent";
      if (p < 1) { rafRef.current = requestAnimationFrame(tick); } else { resolve(); }
    };
    rafRef.current = requestAnimationFrame(tick);
  });

  const WORD_MAX_DOTS = 1800;
  const getWordDots = (text: string) => {
    const SW = SWRef.current, SH = SHRef.current;
    const off = document.createElement("canvas");
    const octx = off.getContext("2d")!;
    off.width = SW; off.height = SH; // dùng kích thước CSS để lấy mẫu, tránh lỗi cắt khi DPR>1
    let fz = Math.min(SW, SH) * 0.18;
    octx.font = `900 ${fz}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace`;
    octx.textAlign = "center"; octx.textBaseline = "middle";
    let metrics = octx.measureText(text), tries = 0;
    while (metrics.width > SW * 0.9 && tries < 12) { fz *= 0.92; octx.font = `900 ${fz}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace`; metrics = octx.measureText(text); tries++; }
    octx.fillStyle = "#fff"; octx.fillText(text, SW / 2, SH / 2);
    const step = Math.max(6, Math.floor(Math.min(SW, SH) / 100));
    const { data } = octx.getImageData(0, 0, SW, SH);
    const dots: { x: number; y: number }[] = [];
    let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
    for (let y = 0; y < SH; y += step) {
      for (let x = 0; x < SW; x += step) {
        const a = data[(y * SW + x) * 4 + 3];
        if (a > 10) {
          dots.push({ x, y });
          if(x<minX)minX=x; if(y<minY)minY=y; if(x>maxX)maxX=x; if(y>maxY)maxY=y;
        }
      }
    }
    if (dots.length) {
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
      const marginX = SW * INTRO_MARGIN, marginY = SH * INTRO_MARGIN;
      let dx = SW/2 - cx + SW*INTRO_WORD_SHIFT; // lệch trái nhẹ theo yêu cầu
      let dy = SH/2 - cy;
      dx = clamp(dx, marginX - minX, (SW - marginX) - maxX);
      dy = clamp(dy, marginY - minY, (SH - marginY) - maxY);
      for (const d of dots) { d.x += dx; d.y += dy; }
      wordBBoxRef.current = { minX: minX+dx, maxX: maxX+dx, minY: minY+dy, maxY: maxY+dy };
    }
    // giảm số lượng chấm để bớt lag
    let sampled = dots;
    let baseR = step/2.2;
    if (dots.length > WORD_MAX_DOTS) {
      const ratio = WORD_MAX_DOTS / dots.length;
      sampled = dots.filter(() => Math.random() < ratio);
      baseR = Math.min(baseR * Math.sqrt(1/ratio), baseR*2.0);
    }
    return { dots: sampled, step, radius: baseR };
  };

  const animateWordSequence = (ctx: CanvasRenderingContext2D, text = INTRO_MESSAGE) => new Promise<void>((resolve) => {
    // Giữ chữ "HAPPY BIRTHDAY" lại trên màn hình, KHÔNG fade-out
    wordAnimActiveRef.current = true; // tắt layer matrix trong lúc hiển thị chữ
    const SW = SWRef.current, SH = SHRef.current;
    const { dots, radius } = getWordDots(text);
    const parts = dots.map(d => ({ tx: d.x, ty: d.y, x: SW / 2 + (Math.random() - 0.5) * 50, y: SH / 2 + (Math.random() - 0.5) * 50, r: 0, tr: radius }));
    const inDur = 800; // chỉ animate bay vào
    const startIn = performance.now();

    const render = () => {
      ctx.clearRect(0, 0, SW, SH);
      ctx.fillStyle = gradColor(ctx, SW, SH);
      ctx.shadowColor = "#ff4fa3"; (ctx as any).shadowBlur = 12;
      for (const p of parts) { ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.1, p.r), 0, Math.PI * 2); ctx.fill(); }
      (ctx as any).shadowBlur = 0; ctx.shadowColor = "transparent";
    };

    const stepIn = (t: number) => {
      const p = Math.min(1, (t - startIn) / inDur); const e = easeOutCubic(p);
      for (const pt of parts) { pt.x += (pt.tx - pt.x) * e; pt.y += (pt.ty - pt.y) * e; pt.r = pt.tr * e; }
      render();
      if (p < 1) { rafRef.current = requestAnimationFrame(stepIn); }
      else {
        // Kết thúc: để nguyên chữ trên canvas; không xoá, không fade-out
        resolve();
      }
    };

    rafRef.current = requestAnimationFrame(stepIn);
  });

  // ====== INTRO SEQUENCE ======
  useEffect(() => {
    if (entered) return; // không chạy nếu đã vào app chính

    const starsCtx = starsRef.current?.getContext("2d") ?? null;
    const fxCtx = fxRef.current?.getContext("2d") ?? null;
    const mCtx = matrixRef.current?.getContext("2d") ?? null;
    const cCtx = ctnRef.current?.getContext("2d") ?? null;

    const resizeAll = () => {
      const ctnCtx = cCtx;
      const mtxCtx = mCtx;
      const stx = starsCtx; const ftx = fxCtx;
      // canvas sizes
      if (starsRef.current && stx) resizeCanvas(starsRef.current, stx);
      if (fxRef.current && ftx) resizeCanvas(fxRef.current, ftx);
      if (ctnRef.current && ctnCtx) resizeCanvas(ctnRef.current, ctnCtx);
      if (mtxCtx) resizeMatrix(mtxCtx);
      initStars();
    };

    const loop = (ts: number) => {
      if (entered) return; // stop when entered
      if (starsCtx) drawStars(starsCtx, ts);
      if (mCtx) {
      if (!wordAnimActiveRef.current) drawMatrix(mCtx);
      else mCtx.clearRect(0, 0, SWRef.current, SHRef.current);
    }
      if (fxCtx) drawConfetti(fxCtx);
      rafRef.current = requestAnimationFrame(loop);
    };

    const onResize = () => resizeAll();
    window.addEventListener("resize", onResize);
    resizeAll();
    rafRef.current = requestAnimationFrame(loop);

    // countdown -> disperse -> word -> confetti -> show button
    const startCountdown = async () => {
      if (!cCtx) return;
      await new Promise((r) => setTimeout(r, INTRO_START_DELAY));
      const digits = ["3", "2", "1"];
      for (let i = 0; i < digits.length; i++) {
        const { dots, step } = drawDigitDots(cCtx, digits[i]);
        if (i < digits.length - 1) {
          await new Promise((r) => setTimeout(r, 1000));
        } else {
          await new Promise((r) => setTimeout(r, 800));
          await disperseDots(cCtx, dots, step, 700);
        }
      }
      emitConfetti(INTRO_CONFETTI);
      await animateWordSequence(cCtx, INTRO_MESSAGE);
      // đặt nút ngay bên dưới chữ HBD
      const bbox = wordBBoxRef.current;
      const SH = SHRef.current;
      const top = bbox ? Math.min(bbox.maxY + 48, SH - 100) : Math.min(SH*0.65, SH-100);
      setIntroButtonTop(top);
      setShowEnter(true);
    };

    startCountdown();

    return () => {
      window.removeEventListener("resize", onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [entered]);

  const handleEnter = () => {
    setEntered(true); // ẩn intro, hiện app chính
  };

  // ====== UI: Thư chúc (nếu mở) ======
  if (entered && showLetter) {
    return (
      <div style={{ padding: "20px", textAlign: "center", backgroundColor: "#7a3a54ff", height: "100vh" }}>
        <h1>💌 Gửi đến Như 💌</h1>
        <p style={{ fontSize: "18px", maxWidth: "680px", margin: "24px auto", lineHeight: "1.7", whiteSpace: "pre-line", textAlign: "center" }}>
          {letterText}
        </p>
        <button
          style={{
            padding: "10px 20px",
            fontSize: "16px",
            backgroundColor: "#8f1313ff",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            marginTop: "16px",
          }}
          onClick={() => setShowLetter(false)}
        >
          ⬅️ Quay lại
        </button>
      </div>
    );
  }

  // ====== UI: Intro overlay (canvases + nút vào) ======
  if (!entered) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#000", overflow: "hidden" }}>
        {/* Stack canvases */}
        <canvas ref={starsRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />
        <canvas ref={fxRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />
        <canvas ref={matrixRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />
        <canvas ref={ctnRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />

        {/* Nút vào bánh kem, xuất hiện sau khi intro xong */}
        {showEnter && (
          <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", top: introButtonTop ? `${introButtonTop}px` : "65%" }}>
            <button
              onClick={handleEnter}
              style={{
                padding: "14px 22px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,.25)",
                background: "radial-gradient(120% 120% at 50% 20%, #fff 0%, #ffd1e7 35%, #ff4fa3 70%, #8a1d59 100%)",
                color: "#000",
                fontWeight: 800,
                letterSpacing: ".03em",
                boxShadow: "0 8px 24px rgba(255,79,163,.35), 0 2px 6px rgba(0,0,0,.2)",
                cursor: "pointer"
              }}
              aria-label="Nhận bánh kem"
            >
              Nhận bánh kem 🎂
            </button>
          </div>
        )}
      </div>
    );
  }

  // ====== UI: Màn hình bánh sinh nhật (app chính giữ nguyên) ======
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", justifyContent: "space-between" }}>
      {/* Joyride share mode */}
      <Joyride
        styles={{ options: { zIndex: shareMode ? 10000 : -10000 } }}
        steps={sharedSteps}
        run={run}
        showSkipButton
        continuous
        callback={handleJoyrideCallback}
        hideBackButton
        hideCloseButton
        showProgress
        spotlightClicks
      />

      {/* Joyride bình thường */}
      <Joyride
        styles={{ options: { zIndex: !shareMode ? 10000 : -10000 } }}
        steps={steps}
        run={run}
        showSkipButton
        continuous
        callback={handleJoyrideCallback}
        hideBackButton
        hideCloseButton
        showProgress
        spotlightClicks
      />

      <audio {...{ src, ref: audioRef, preload: "auto" }} />

      {/* Bánh sinh nhật */}
      <Cake candleVisible={candleVisible} />

      {/* Anchor cho beacon Joyride: đặt dưới bánh */}
      

      {/* Nút mở thư */}
      {showLetterButton && (
        <div
          style={{
            position: "absolute",
            top: "calc(50% + 180px)",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 50,
          }}
        >
          <button
            style={{
              padding: "10px 20px",
              fontSize: "18px",
              backgroundColor: "#c46c1bff",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
            }}
            onClick={() => setShowLetter(true)}
          >
            ✉️ Mở thư
          </button>
        </div>
      )}

      {/* Hiệu ứng chữ HBD */}
      <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)" }}>
        <dotlottie-player
          src="/assets/hbd.lottie"
          autoplay
          loop
          style={{ zIndex: 20, visibility: visibility ? "visible" : "hidden", width: 400 }}
        />
      </div>

      {/* Hiệu ứng confetti */}
      <div style={{ position: "absolute", top: "25%", left: "50%", transform: "translateX(-50%)" }}>
        <dotlottie-player
          src="/assets/confetti.lottie"
          autoplay
          loop
          style={{ zIndex: 30, visibility: visibility ? "visible" : "hidden", width: 400 }}
        />
      </div>

      {/* Nút điều khiển */}
      <div style={{ position: "absolute", bottom: "1.25%", left: "50%", transform: "translateX(-50%)" }}>
        <CakeActions
          {...{
            run,
            start,
            pause,
            stop,
            toggleLightCandle,
            setRun,
            playing,
            paused,
            candleVisible,
          }}
        />
      </div>
    </div>
  );
}

export default App;
