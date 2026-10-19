import { invert, multiply, type Mat4, type Vec3 } from "./math";
import type { MeshData } from "./mesh";

/**
 * "Chunky Alpine Toon" renderer — a small WebGL2 renderer built for this game's art style:
 *  - flat-shaded low-poly geometry with vertex colours,
 *  - 3-band toon lighting + sky/ground ambient + soft rim light,
 *  - thick ink outlines via an inflated hull (back faces only),
 *  - distance fog that blends into the sky.
 */

const VS = `#version 300 es
in vec3 aPos; in vec3 aNrm; in vec3 aCol; in vec3 aSmooth;
uniform mat4 uModel; uniform mat4 uViewProj;
uniform float uOutline; uniform float uTime; uniform float uWave;
out vec3 vNrm; out vec3 vCol; out vec3 vWorld; out vec3 vSmooth;
void main() {
  vec3 p = aPos;
  if (uWave > 0.0) p.y += sin(p.x * 0.35 + uTime * 1.6) * 0.06 + cos(p.z * 0.4 + uTime * 1.1) * 0.06;
  vec4 w = uModel * vec4(p, 1.0);
  vec3 sm = normalize(mat3(uModel) * aSmooth);
  if (uOutline > 0.0) w.xyz += sm * uOutline;
  vWorld = w.xyz;
  vNrm = normalize(mat3(uModel) * aNrm);
  vSmooth = sm;
  vCol = aCol;
  gl_Position = uViewProj * w;
}`;

const FS = `#version 300 es
precision highp float;
in vec3 vNrm; in vec3 vCol; in vec3 vWorld; in vec3 vSmooth;
uniform vec3 uLightDir; uniform vec3 uCamPos;
uniform vec3 uSkyTop; uniform vec3 uSkyHorizon; uniform vec3 uGround;
uniform float uFogNear; uniform float uFogFar;
uniform vec4 uTint; uniform float uUnlit; uniform float uNoFog; uniform float uOutline; uniform vec3 uInk; uniform float uAlpha;
out vec4 outColor;
void main() {
  vec3 viewDir = normalize(uCamPos - vWorld);
  if (uOutline > 0.0) {
    // Only the back of the hull is drawn, so it reads as an outline around the silhouette.
    if (dot(vSmooth, viewDir) > 0.15) discard;
    outColor = vec4(uInk, 1.0);
    return;
  }
  vec3 n = normalize(vNrm);
  vec3 base = mix(vCol, uTint.rgb, uTint.a);
  vec3 col;
  if (uUnlit > 0.5) {
    col = base;
  } else {
    float ndl = dot(n, normalize(uLightDir));
    // Soft, postcard-like daylight. The half-Lambert term preserves detail in
    // rounded faces while the bands retain the illustrated Alpine-toon style.
    float halfLambert = ndl * 0.5 + 0.5;
    float band = halfLambert > 0.76 ? 1.12 : halfLambert > 0.48 ? 0.88 : 0.64;
    vec3 ambient = mix(uGround, uSkyTop, n.y * 0.5 + 0.5) * 0.18;
    float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 3.2) * 0.14;
    vec3 halfDir = normalize(normalize(uLightDir) + viewDir);
    float sunKiss = pow(max(dot(n, halfDir), 0.0), 26.0) * 0.18;
    col = base * (band * vec3(1.0, 0.97, 0.9) * 0.94 + ambient) + rim * vec3(1.0, 0.95, 0.85) + sunKiss * vec3(1.0, 0.86, 0.58);
    // Keep the vertex palette intact. The former filmic division here compressed every
    // colour toward grey, which made the whole village look foggy even at noon.
    // A small display curve keeps snow readable and stops the sunny palette from
    // clipping into neon white/green on high-brightness displays.
    col = pow(clamp(col, 0.0, 1.0), vec3(1.10));
  }
  float d = length(uCamPos - vWorld);
  float f = clamp((d - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
  vec3 fogCol = mix(uSkyHorizon, uSkyTop, clamp((vWorld.y - uCamPos.y) / 120.0, 0.0, 0.6));
  if (uNoFog < 0.5) col = mix(col, fogCol, f * f);
  outColor = vec4(col, uAlpha);
}`;

export interface GpuMesh {
  vao: WebGLVertexArrayObject;
  count: number;
  buffers: WebGLBuffer[];
}

export interface DrawOpts {
  outline?: number; // ink width in world units (0 = none)
  tint?: [number, number, number, number];
  unlit?: boolean;
  wave?: boolean;
  alpha?: number;
  noFog?: boolean;
}

export interface Environment {
  skyTop: Vec3;
  skyHorizon: Vec3;
  ground: Vec3;
  lightDir: Vec3;
  fogNear: number;
  fogFar: number;
  ink: Vec3;
}

export class Renderer {
  readonly gl: WebGL2RenderingContext;
  private prog: WebGLProgram;
  private u: Record<string, WebGLUniformLocation | null> = {};
  viewProj: Mat4 = new Float32Array(16);
  camPos: Vec3 = [0, 0, 0];
  time = 0;
  env: Environment = {
    skyTop: [0.36, 0.66, 0.93],
    skyHorizon: [0.98, 0.86, 0.74],
    ground: [0.42, 0.55, 0.3],
    lightDir: [0.45, 0.8, 0.35],
    fogNear: 70,
    fogFar: 260,
    ink: [0.18, 0.11, 0.07],
  };
  private transparent: { mesh: GpuMesh; model: Mat4; opts: DrawOpts }[] = [];

  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", { antialias: true, alpha: false, powerPreference: "high-performance" });
    if (!gl) throw new Error("WebGL2 is not available in this browser.");
    this.gl = gl;
    this.prog = this.link(VS, FS);
    for (const name of ["uModel", "uViewProj", "uOutline", "uTime", "uWave", "uLightDir", "uCamPos", "uSkyTop", "uSkyHorizon", "uGround", "uFogNear", "uFogFar", "uTint", "uUnlit", "uInk", "uAlpha", "uNoFog"]) {
      this.u[name] = gl.getUniformLocation(this.prog, name);
    }
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
  }

  private link(vs: string, fs: string): WebGLProgram {
    const gl = this.gl;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader error");
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, "aPos");
    gl.bindAttribLocation(p, 1, "aNrm");
    gl.bindAttribLocation(p, 2, "aCol");
    gl.bindAttribLocation(p, 3, "aSmooth");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link error");
    return p;
  }

  upload(data: MeshData): GpuMesh {
    const gl = this.gl;
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buffers: WebGLBuffer[] = [];
    [data.positions, data.normals, data.colors, data.smooth].forEach((arr, i) => {
      const b = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, 3, gl.FLOAT, false, 0, 0);
      buffers.push(b);
    });
    gl.bindVertexArray(null);
    return { vao, count: data.count, buffers };
  }

  dispose(m: GpuMesh) {
    for (const b of m.buffers) this.gl.deleteBuffer(b);
    this.gl.deleteVertexArray(m.vao);
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(this.canvas.clientWidth * dpr), h = Math.floor(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, w, h);
  }

  begin(view: Mat4, proj: Mat4, camPos: Vec3): void {
    const gl = this.gl;
    this.viewProj = multiply(proj, view);
    this.camPos = camPos;
    const [r, g, b] = this.env.skyHorizon;
    gl.clearColor(r, g, b, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.prog);
    const e = this.env;
    gl.uniformMatrix4fv(this.u.uViewProj, false, this.viewProj);
    gl.uniform3fv(this.u.uLightDir, e.lightDir);
    gl.uniform3fv(this.u.uCamPos, camPos);
    gl.uniform3fv(this.u.uSkyTop, e.skyTop);
    gl.uniform3fv(this.u.uSkyHorizon, e.skyHorizon);
    gl.uniform3fv(this.u.uGround, e.ground);
    gl.uniform3fv(this.u.uInk, e.ink);
    gl.uniform1f(this.u.uFogNear, e.fogNear);
    gl.uniform1f(this.u.uFogFar, e.fogFar);
    gl.uniform1f(this.u.uTime, this.time);
    this.transparent = [];
  }

  draw(mesh: GpuMesh, model: Mat4, opts: DrawOpts = {}): void {
    if ((opts.alpha ?? 1) < 1) {
      this.transparent.push({ mesh, model, opts });
      return;
    }
    this.drawNow(mesh, model, opts);
  }

  private drawNow(mesh: GpuMesh, model: Mat4, opts: DrawOpts): void {
    const gl = this.gl;
    gl.bindVertexArray(mesh.vao);
    gl.uniformMatrix4fv(this.u.uModel, false, model);
    gl.uniform4fv(this.u.uTint, opts.tint ?? [0, 0, 0, 0]);
    gl.uniform1f(this.u.uUnlit, opts.unlit ? 1 : 0);
    gl.uniform1f(this.u.uWave, opts.wave ? 1 : 0);
    gl.uniform1f(this.u.uAlpha, opts.alpha ?? 1);
    gl.uniform1f(this.u.uNoFog, opts.noFog ? 1 : 0);
    gl.uniform1f(this.u.uOutline, 0);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
    if (opts.outline) {
      // Push the hull slightly back so it never z-fights with the surface it outlines.
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(2, 4);
      gl.uniform1f(this.u.uOutline, opts.outline);
      gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
      gl.uniform1f(this.u.uOutline, 0);
      gl.disable(gl.POLYGON_OFFSET_FILL);
    }
  }

  end(): void {
    const gl = this.gl;
    if (this.transparent.length) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      for (const t of this.transparent) this.drawNow(t.mesh, t.model, t.opts);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }
    this.gl.bindVertexArray(null);
  }

  /** World → CSS pixel position (for name tags and speech bubbles). Returns null if behind the camera. */
  project(x: number, y: number, z: number): { x: number; y: number; depth: number } | null {
    const m = this.viewProj;
    const cx = m[0] * x + m[4] * y + m[8] * z + m[12];
    const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
    const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (cw <= 0.1) return null;
    return {
      x: ((cx / cw) * 0.5 + 0.5) * this.canvas.clientWidth,
      y: (1 - ((cy / cw) * 0.5 + 0.5)) * this.canvas.clientHeight,
      depth: cw,
    };
  }

  /** Screen point → intersection with the horizontal plane y = planeY. */
  pickGround(px: number, py: number, planeY = 0): { x: number; z: number } | null {
    const inv = invert(this.viewProj);
    if (!inv) return null;
    const nx = (px / this.canvas.clientWidth) * 2 - 1;
    const ny = 1 - (py / this.canvas.clientHeight) * 2;
    const unproject = (z: number) => {
      const x = inv[0] * nx + inv[4] * ny + inv[8] * z + inv[12];
      const y = inv[1] * nx + inv[5] * ny + inv[9] * z + inv[13];
      const zz = inv[2] * nx + inv[6] * ny + inv[10] * z + inv[14];
      const w = inv[3] * nx + inv[7] * ny + inv[11] * z + inv[15];
      return [x / w, y / w, zz / w];
    };
    const a = unproject(-1), b = unproject(1);
    const dy = b[1] - a[1];
    if (Math.abs(dy) < 1e-6) return null;
    const t = (planeY - a[1]) / dy;
    if (t < 0) return null;
    return { x: a[0] + (b[0] - a[0]) * t, z: a[2] + (b[2] - a[2]) * t };
  }
}
