/**
 * Phosphor screen: the WebGL post-processing layer from docs/demos/crt-phosphor-shader.html,
 * turned into a reusable renderer for instrument screens.
 *
 * Each frame the caller draws the NEW beam trace into a 2D canvas, in three independent
 * colour channels: red = CH1, green = CH2, blue = on-screen text and markers. The screen then
 *  1. merges it into a persistence buffer that fades exponentially (afterglow),
 *  2. adds a tight bloom and a wide halation,
 *  3. composites the tube: barrel curvature, tone curve with near-white hot cores,
 *     a graticule on the glass that catches nearby glow, scanlines, vignette and grain.
 * CH1 glows phosphor green and CH2 cyan, like a two-channel DSO drawn on a P31 tube.
 */

const VS = `#version 300 es
out vec2 uv;
void main(){ vec2 p = vec2(float((gl_VertexID<<1)&2), float(gl_VertexID&2)); uv = p; gl_Position = vec4(p*2.0-1.0, 0.0, 1.0); }`;

const PERSIST_FS = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D src, prev; uniform float decay;
void main(){
  vec3 s = texture(src, uv).rgb;
  vec3 p = texture(prev, uv).rgb * decay;
  o = vec4(max(s, p), 1.0);
}`;

const COPY_FS = `#version 300 es
precision highp float; in vec2 uv; out vec4 o; uniform sampler2D t;
void main(){ o = texture(t, uv); }`;

const BLUR_FS = `#version 300 es
precision highp float; in vec2 uv; out vec4 o; uniform sampler2D t; uniform vec2 dir;
void main(){
  vec3 c = texture(t, uv).rgb * 0.2270270270;
  c += texture(t, uv + dir * 1.3846153846).rgb * 0.3162162162;
  c += texture(t, uv - dir * 1.3846153846).rgb * 0.3162162162;
  c += texture(t, uv + dir * 3.2307692308).rgb * 0.0702702703;
  c += texture(t, uv - dir * 3.2307692308).rgb * 0.0702702703;
  o = vec4(c, 1.0);
}`;

const FINAL_FS = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D persist, bloomA, bloomB, grat;
uniform vec2 res; uniform float time, soft, curv, fxOn;

const vec3 C1 = vec3(0.20, 1.00, 0.52);   // CH1: P31 green
const vec3 C2 = vec3(0.22, 0.80, 1.00);   // CH2: cyan
const vec3 CT = vec3(0.36, 1.00, 0.62);   // text and markers

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

vec2 barrel(vec2 u, float k){
  vec2 c = u * 2.0 - 1.0;
  c *= 1.0 + k * dot(c, c) * 0.85;
  c /= 1.0 + k * 0.9;
  return c * 0.5 + 0.5;
}

vec3 tone(float I, vec3 col){
  vec3 body = col * (1.0 - exp(-2.4 * I));
  vec3 hot = vec3(0.80, 1.00, 0.90) * smoothstep(0.55, 1.4, I) * 0.5;
  return body + hot;
}

void main(){
  vec2 fc = gl_FragCoord.xy;
  if (fxOn < 0.5) {
    vec3 e = clamp(texture(persist, uv).rgb, 0.0, 1.0);
    float g = texture(grat, uv).r;
    o = vec4(C1 * e.r + C2 * e.g + CT * e.b * 0.8 + CT * g * 0.22, 1.0);
    return;
  }

  vec2 u = barrel(uv, curv);
  vec2 edge = smoothstep(vec2(0.0), vec2(0.012), u) * smoothstep(vec2(0.0), vec2(0.012), 1.0 - u);
  float inside = edge.x * edge.y;

  vec2 px = 1.0 / res;
  vec3 core = texture(persist, u).rgb * 0.5
    + (texture(persist, u + vec2(px.x, 0.0)).rgb + texture(persist, u - vec2(px.x, 0.0)).rgb
    +  texture(persist, u + vec2(0.0, px.y)).rgb + texture(persist, u - vec2(0.0, px.y)).rgb) * 0.125;
  vec3 bA = texture(bloomA, u).rgb;
  vec3 bB = texture(bloomB, u).rgb;

  vec3 col = tone(core.r, C1) + tone(core.g, C2) + tone(core.b * 0.75, CT);
  vec3 b = bA * 3.2 * soft + bB * 4.5 * soft;
  col += C1 * b.r * 0.9 + C2 * b.g * 0.9 + CT * b.b * 0.5;

  float g = texture(grat, u).r;
  float lit = dot(bA + bB, vec3(1.0, 1.0, 0.4));
  col += vec3(0.30, 0.85, 0.55) * g * (0.14 + lit * 5.0);

  col += vec3(0.010, 0.030, 0.018);
  col += vec3(0.02, 0.06, 0.035) * (bB.r + bB.g) * 3.0;

  float scan = 0.94 + 0.06 * sin(fc.y * 3.14159 * 0.66);
  col *= scan;

  vec2 q = u * (1.0 - u.yx);
  float vig = pow(clamp(q.x * q.y * 18.0, 0.0, 1.0), 0.22);
  col *= mix(0.55, 1.0, vig);
  col += vec3(1.0) * 0.035 * smoothstep(0.9, 0.0, length(uv - vec2(0.18, 0.86)));
  col += (hash(fc + fract(time) * 100.0) - 0.5) * 0.035;

  o = vec4(col * inside, 1.0);
}`;

interface Prog { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> }
interface Target { tex: WebGLTexture; fb: WebGLFramebuffer; w: number; h: number }

export interface PhosphorOptions {
  /** Afterglow time constant, seconds. */
  afterglow: number;
  /** Full tube treatment (false = flat trace, for readability or weak GPUs). */
  fx: boolean;
  soft?: number;
  curvature?: number;
}

/** Draws this frame's new light into a 2D context: red = CH1, green = CH2, blue = text. */
export type BeamPainter = (ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number) => void;

export class PhosphorScreen {
  readonly gl: WebGL2RenderingContext;
  private floatOK: boolean;
  private src = document.createElement('canvas');
  private sctx: CanvasRenderingContext2D;
  private grat = document.createElement('canvas');
  private gctx: CanvasRenderingContext2D;
  private persistP: Prog; private copyP: Prog; private blurP: Prog; private finalP: Prog;
  private W = 0; private H = 0; private dpr = 1;
  private t: Partial<Record<'pA' | 'pB' | 'd2' | 'tmpA' | 'bloomA' | 'd8' | 'tmpB' | 'bloomB', Target>> = {};
  private srcTex: WebGLTexture | null = null;
  private gratTex: WebGLTexture | null = null;
  private last = 0;

  /** Returns null when WebGL2 isn't available (the caller shows a fallback). */
  static create(canvas: HTMLCanvasElement): PhosphorScreen | null {
    const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false });
    return gl ? new PhosphorScreen(canvas, gl) : null;
  }

  private constructor(private canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.floatOK = !!gl.getExtension('EXT_color_buffer_float');
    this.sctx = this.src.getContext('2d')!;
    this.gctx = this.grat.getContext('2d')!;
    this.persistP = this.program(PERSIST_FS);
    this.copyP = this.program(COPY_FS);
    this.blurP = this.program(BLUR_FS);
    this.finalP = this.program(FINAL_FS);
    gl.bindVertexArray(gl.createVertexArray());
  }

  get width() { return this.W; }
  get height() { return this.H; }

  private program(fs: string): Prog {
    const gl = this.gl;
    const p = gl.createProgram()!;
    for (const [type, code] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, fs]] as const) {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, code); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader error');
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link error');
    const u: Prog['u'] = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i)!.name; u[name] = gl.getUniformLocation(p, name); }
    return { p, u };
  }

  private makeTex(w: number, h: number, float: boolean) {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    if (float && this.floatOK) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  private target(w: number, h: number): Target {
    const gl = this.gl;
    const tex = this.makeTex(w, h, true), fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fb, w, h };
  }

  private freeTargets() {
    const gl = this.gl;
    for (const t of Object.values(this.t)) { if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); } }
    if (this.srcTex) gl.deleteTexture(this.srcTex);
    if (this.gratTex) gl.deleteTexture(this.gratTex);
    this.t = {};
  }

  /** Match the canvas's CSS size. Clears the afterglow. */
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = this.canvas.getBoundingClientRect();
    const W = Math.max(2, Math.round(r.width * dpr)), H = Math.max(2, Math.round(r.height * dpr));
    if (W === this.W && H === this.H && dpr === this.dpr) return;
    this.dpr = dpr; this.W = W; this.H = H;
    this.canvas.width = this.src.width = this.grat.width = W;
    this.canvas.height = this.src.height = this.grat.height = H;
    this.freeTargets();
    const q = (s: number): [number, number] => [Math.max(1, W >> s), Math.max(1, H >> s)];
    this.t = {
      pA: this.target(W, H), pB: this.target(W, H),
      d2: this.target(...q(1)), tmpA: this.target(...q(2)), bloomA: this.target(...q(2)),
      d8: this.target(...q(3)), tmpB: this.target(...q(4)), bloomB: this.target(...q(4)),
    };
    this.srcTex = this.makeTex(W, H, false);
    this.gratTex = this.makeTex(W, H, false);
    this.drawGraticule();
    this.upload(this.gratTex, this.grat);
    this.clear();
  }

  /** Wipe the afterglow (e.g. when the timebase changes). */
  clear() {
    const gl = this.gl;
    for (const t of [this.t.pA, this.t.pB]) {
      if (!t) continue;
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    }
  }

  private drawGraticule() {
    const { gctx: g, W, H, dpr } = this;
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#fff';
    const dx = W / 10, dy = H / 8;
    g.lineWidth = Math.max(1, dpr * 0.9);
    for (let i = 1; i < 10; i++) {
      g.globalAlpha = i === 5 ? 0.75 : 0.35;
      g.setLineDash(i === 5 ? [] : [2 * dpr, 6 * dpr]);
      g.beginPath(); g.moveTo(i * dx, 0); g.lineTo(i * dx, H); g.stroke();
    }
    for (let j = 1; j < 8; j++) {
      g.globalAlpha = j === 4 ? 0.75 : 0.35;
      g.setLineDash(j === 4 ? [] : [2 * dpr, 6 * dpr]);
      g.beginPath(); g.moveTo(0, j * dy); g.lineTo(W, j * dy); g.stroke();
    }
    g.setLineDash([]); g.globalAlpha = 0.8;
    for (let k = 0; k <= 50; k++) { const x = (k * dx) / 5; g.beginPath(); g.moveTo(x, H / 2 - 5 * dpr); g.lineTo(x, H / 2 + 5 * dpr); g.stroke(); }
    for (let k = 0; k <= 40; k++) { const y = (k * dy) / 5; g.beginPath(); g.moveTo(W / 2 - 5 * dpr, y); g.lineTo(W / 2 + 5 * dpr, y); g.stroke(); }
    g.globalAlpha = 0.6; g.strokeRect(dpr, dpr, W - 2 * dpr, H - 2 * dpr);
    g.globalAlpha = 1;
  }

  private upload(tex: WebGLTexture, canvas: HTMLCanvasElement) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  }

  private pass(prog: Prog, out: Target | null, setup: (bind: (name: string, tex: WebGLTexture) => void, u: Prog['u']) => void) {
    const gl = this.gl;
    gl.useProgram(prog.p);
    if (out) { gl.bindFramebuffer(gl.FRAMEBUFFER, out.fb); gl.viewport(0, 0, out.w, out.h); }
    else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, this.W, this.H); }
    let unit = 0;
    const bind = (name: string, tex: WebGLTexture) => {
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(prog.u[name] ?? null, unit++);
    };
    setup(bind, prog.u);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Draw one frame: `paint` adds this frame's light, the rest is the tube. */
  frame(now: number, paint: BeamPainter, opts: PhosphorOptions) {
    const gl = this.gl;
    const t = this.t;
    if (!t.pA || !t.pB || !t.d2 || !t.tmpA || !t.bloomA || !t.d8 || !t.tmpB || !t.bloomB || !this.srcTex || !this.gratTex) return;
    const dt = Math.min(0.064, this.last ? (now - this.last) / 1000 : 0.016);
    this.last = now;

    const s = this.sctx;
    s.globalCompositeOperation = 'source-over';
    s.globalAlpha = 1;
    s.fillStyle = '#000'; s.fillRect(0, 0, this.W, this.H);
    s.globalCompositeOperation = 'lighter';
    paint(s, this.W, this.H, this.dpr);
    this.upload(this.srcTex, this.src);

    const decay = Math.exp(-dt / Math.max(0.02, opts.afterglow));
    const [pA, pB] = [t.pA, t.pB];
    this.pass(this.persistP, pB, (bind, u) => { bind('src', this.srcTex!); bind('prev', pA.tex); gl.uniform1f(u.decay ?? null, decay); });
    t.pA = pB; t.pB = pA;

    const hw = t.bloomA.w, hh = t.bloomA.h, qw = t.bloomB.w, qh = t.bloomB.h;
    this.pass(this.copyP, t.d2, (bind) => bind('t', t.pA!.tex));
    this.pass(this.copyP, t.bloomA, (bind) => bind('t', t.d2!.tex));
    this.pass(this.blurP, t.tmpA, (bind, u) => { bind('t', t.bloomA!.tex); gl.uniform2f(u.dir ?? null, 1.6 / hw, 0); });
    this.pass(this.blurP, t.bloomA, (bind, u) => { bind('t', t.tmpA!.tex); gl.uniform2f(u.dir ?? null, 0, 1.6 / hh); });
    this.pass(this.copyP, t.d8, (bind) => bind('t', t.bloomA!.tex));
    this.pass(this.copyP, t.bloomB, (bind) => bind('t', t.d8!.tex));
    this.pass(this.blurP, t.tmpB, (bind, u) => { bind('t', t.bloomB!.tex); gl.uniform2f(u.dir ?? null, 1.4 / qw, 0); });
    this.pass(this.blurP, t.bloomB, (bind, u) => { bind('t', t.tmpB!.tex); gl.uniform2f(u.dir ?? null, 0, 1.4 / qh); });

    this.pass(this.finalP, null, (bind, u) => {
      bind('persist', t.pA!.tex); bind('bloomA', t.bloomA!.tex); bind('bloomB', t.bloomB!.tex); bind('grat', this.gratTex!);
      gl.uniform2f(u.res ?? null, this.W, this.H);
      gl.uniform1f(u.time ?? null, now / 1000);
      gl.uniform1f(u.soft ?? null, opts.soft ?? 0.9);
      gl.uniform1f(u.curv ?? null, opts.fx ? opts.curvature ?? 0.09 : 0);
      gl.uniform1f(u.fxOn ?? null, opts.fx ? 1 : 0);
    });
  }

  /** Free GPU memory. The context itself stays with the canvas (React may mount it again). */
  dispose() {
    this.freeTargets();
    this.W = this.H = 0;
  }
}
