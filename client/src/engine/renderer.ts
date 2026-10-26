import { invert, lookAt, multiply, ortho, transformPoint, type Mat4, type Vec3 } from "./math";
import type { MeshData } from "./mesh";

/**
 * Beaver Banff renderer — a small WebGL2 renderer tuned for a warm, storybook "golden hour" look:
 *  - soft wrapped sunlight with real shadows from a sun shadow map (4-tap PCF),
 *  - sky/ground ambient, a golden backlight rim and a gentle specular sheen,
 *  - a procedural painted sky (gradient, sun glow, drifting clouds),
 *  - aerial perspective: distance haze that warms toward the sun and thins with altitude,
 *  - water with moving ripples, sky reflection (fresnel) and sun glints; animated waterfalls,
 *  - wind sway for grass and foliage, optional ink outlines for characters.
 *
 * Draw calls are queued between begin() and end(), so the shadow pass can reuse them.
 */

const VS = `#version 300 es
in vec3 aPos; in vec3 aNrm; in vec3 aCol; in vec3 aSmooth;
uniform mat4 uModel; uniform mat4 uViewProj; uniform mat4 uShadowMat;
uniform float uOutline; uniform float uTime; uniform float uWave; uniform float uSway;
out vec3 vNrm; out vec3 vCol; out vec3 vWorld; out vec3 vSmooth; out vec4 vShadow;
void main() {
  vec3 p = aPos;
  if (uWave > 0.5 && uWave < 1.5) p.y += sin(p.x * 0.35 + uTime * 1.6) * 0.03 + cos(p.z * 0.4 + uTime * 1.1) * 0.03;
  vec4 w = uModel * vec4(p, 1.0);
  vec3 sm;
  if (uSway > 0.0) {
    // Per-vertex wind weight lives in aSmooth.x (0 at the root, 1 at the tip).
    float k = aSmooth.x;
    float ph = w.x * 0.23 + w.z * 0.19;
    float gust = 0.6 + 0.4 * sin(uTime * 0.5 + w.x * 0.05);
    w.x += sin(uTime * 1.9 + ph) * k * uSway * gust;
    w.z += cos(uTime * 1.4 + ph * 1.3) * k * uSway * 0.7 * gust;
    sm = vec3(0.0, 1.0, 0.0);
  } else {
    sm = normalize(mat3(uModel) * aSmooth);
  }
  if (uOutline > 0.0) w.xyz += sm * uOutline;
  vWorld = w.xyz;
  vNrm = normalize(mat3(uModel) * aNrm);
  vSmooth = sm;
  vCol = aCol;
  vShadow = uShadowMat * vec4(w.xyz + vNrm * 0.06, 1.0);
  gl_Position = uViewProj * w;
}`;

const FS = `#version 300 es
precision highp float;
precision highp sampler2DShadow;
in vec3 vNrm; in vec3 vCol; in vec3 vWorld; in vec3 vSmooth; in vec4 vShadow;
uniform vec3 uLightDir; uniform vec3 uSunColor; uniform vec3 uCamPos; uniform float uSunIntensity;
uniform vec3 uSkyTop; uniform vec3 uSkyHorizon; uniform vec3 uGround;
uniform float uFogNear; uniform float uFogDensity; uniform float uFogHeight; uniform float uAmbient; uniform float uExposure;
uniform vec4 uTint; uniform float uUnlit; uniform float uNoFog; uniform float uOutline; uniform vec3 uInk; uniform float uAlpha;
uniform sampler2D uTexture; uniform float uUseTexture; uniform float uTextureScale; uniform float uTextureStrength;
uniform float uWave; uniform float uTime; uniform float uEmissive;
uniform float uSeasonOn; uniform vec4 uSeasonCol; uniform float uSnow; uniform float uWet;
uniform float uCutOn; uniform vec3 uCutFocus; uniform float uCutRadius; uniform float uCutPass;
uniform float uFx; uniform float uCloudShade;
uniform vec2 uFade;
uniform sampler2DShadow uShadowMap; uniform float uShadowOn; uniform float uShadowTexel;
out vec4 outColor;

float shadowAt() {
  if (uShadowOn < 0.5) return 1.0;
  vec3 c = vShadow.xyz / vShadow.w * 0.5 + 0.5;
  if (c.x <= 0.0 || c.x >= 1.0 || c.y <= 0.0 || c.y >= 1.0 || c.z >= 1.0) return 1.0;
  float t = uShadowTexel * 1.25;
  float s = texture(uShadowMap, vec3(c.xy + vec2(-t, -t * 0.4), c.z))
          + texture(uShadowMap, vec3(c.xy + vec2(t * 0.4, -t), c.z))
          + texture(uShadowMap, vec3(c.xy + vec2(t, t * 0.4), c.z))
          + texture(uShadowMap, vec3(c.xy + vec2(-t * 0.4, t), c.z));
  s *= 0.25;
  vec2 e = smoothstep(0.0, 0.06, c.xy) * smoothstep(0.0, 0.06, 1.0 - c.xy);
  return mix(1.0, s, e.x * e.y);
}

float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

vec3 skyColor(vec3 d) {
  vec3 L = normalize(uLightDir);
  float h = clamp(d.y, 0.0, 1.0);
  vec3 col = mix(uSkyHorizon, uSkyTop, pow(h, 0.5));
  float sd = max(dot(d, L), 0.0);
  col += uSunColor * (pow(sd, 10.0) * 0.35 + pow(sd, 400.0) * 2.0);
  return col;
}

vec3 tonemap(vec3 x) {
  x *= uExposure;
  // Linear up to 0.8, then a soft shoulder: keeps the painted palette, never clips harshly.
  return min(x, vec3(0.8)) + 0.2 * (1.0 - exp(-max(x - 0.8, 0.0) / 0.2));
}

vec3 waterNormal(vec2 p, float t) {
  vec2 d1 = normalize(vec2(1.0, 0.6)), d2 = normalize(vec2(-0.7, 1.0)), d3 = normalize(vec2(0.25, -1.0)), d4 = normalize(vec2(-1.0, -0.3));
  vec2 g = d1 * 0.050 * 0.9 * cos(dot(d1, p) * 0.9 + t * 1.3)
         + d2 * 0.035 * 1.7 * cos(dot(d2, p) * 1.7 + t * 1.7)
         + d3 * 0.022 * 3.1 * cos(dot(d3, p) * 3.1 + t * 2.3)
         + d4 * 0.012 * 6.3 * cos(dot(d4, p) * 6.3 + t * 3.1);
  return normalize(vec3(-g.x, 1.0, -g.y));
}

void main() {
  vec3 V = normalize(uCamPos - vWorld);
  vec3 L = normalize(uLightDir);
  if (uFade.y > 0.0) {
    // Things near the edge of the draw distance dissolve in (dithered) instead of popping.
    float fd = length(vWorld.xz - uCamPos.xz);
    float k = clamp((fd - uFade.x) / max(uFade.y - uFade.x, 1.0), 0.0, 1.0);
    float dz = fract(sin(dot(floor(gl_FragCoord.xy), vec2(41.13, 289.71))) * 13758.5453);
    if (k > dz) discard;
  }
  // See-through, in two clean layers instead of random noise. Anything between the camera and your
  // beaver, inside a round window around that line of sight, is cut out of the solid pass (uCutPass 0)
  // and redrawn in the translucent pass (uCutPass 1), fading smoothly from solid at the window's rim to
  // a faint ghost in the middle. So you see yourself through the wall, and the wall is still there.
  float cutGhost = 1.0;
  if (uCutOn > 0.5 && uCutRadius > 0.0) {
    vec3 seg = uCutFocus - uCamPos;
    float len = length(seg);
    vec3 dir = seg / max(len, 1e-3);
    vec3 rel = vWorld - uCamPos;
    float t = dot(rel, dir);
    bool inWindow = false;
    float edge = 1.0;
    if (t > 0.0 && t < len - 0.6) {
      float d = length(rel - dir * t);
      float rad = uCutRadius * mix(0.45, 1.0, clamp(t / len, 0.0, 1.0));
      if (d < rad) { inWindow = true; edge = smoothstep(rad * 0.45, rad, d); }
    }
    if (uCutPass < 0.5) { if (inWindow) discard; }
    else { if (!inWindow) discard; cutGhost = mix(0.045, 1.0, edge * edge); }
  } else if (uCutPass > 0.5) {
    discard;
  }
  if (uOutline > 0.0) {
    // Only the back of the hull is drawn, so it reads as an outline around the silhouette.
    if (dot(vSmooth, V) > 0.15) discard;
    outColor = vec4(uInk, 1.0);
    return;
  }
  vec3 n = normalize(vNrm);
  vec3 textureCol = texture(uTexture, vWorld.xz * uTextureScale).rgb;
  float grassness = smoothstep(0.045, 0.16, vCol.g - max(vCol.r, vCol.b));
  vec3 materialCol = mix(vCol, textureCol, uUseTexture * uTextureStrength * grassness);
  vec3 base = mix(materialCol, uTint.rgb, uTint.a);
  if (uSeasonOn > 0.5) {
    // Seasons: tint the greenery (golden autumn, fresh spring), settle snow on upward faces, darken when wet.
    float green = smoothstep(0.03, 0.14, base.g - max(base.r, base.b));
    float lum = dot(base, vec3(0.299, 0.587, 0.114));
    base = mix(base, uSeasonCol.rgb * lum * 2.1, green * uSeasonCol.a);
    float up = smoothstep(0.5, 0.88, n.y);
    base = mix(base, vec3(0.94, 0.97, 1.0), up * uSnow * (0.6 + 0.4 * green));
    base *= 1.0 - uWet * 0.2;
  }
  vec3 col;
  float alpha = uAlpha;

  if (uWave > 0.5 && uWave < 1.5) {
    // Still water: ripples, sky reflection, sun glints, deep body colour.
    vec3 nw = waterNormal(vWorld.xz, uTime);
    float fres = 0.05 + 0.95 * pow(1.0 - max(dot(nw, V), 0.0), 4.0);
    vec3 R = reflect(-V, nw);
    R.y = abs(R.y);
    vec3 refl = skyColor(R);
    float sh = shadowAt();
    vec3 body = base * (0.35 + 0.65 * (uSunColor * uSunIntensity * max(dot(n, L), 0.0) * sh * 0.5 + uSkyTop * 0.45));
    col = mix(body, refl, clamp(fres * 0.85, 0.0, 1.0));
    float glint = pow(max(dot(R, L), 0.0), 220.0) * 3.5 * sh;
    col += uSunColor * glint;
    alpha = mix(uAlpha, 1.0, fres * 0.6);
    col = tonemap(col);
  } else if (uWave > 1.5) {
    // Falling water: bright streaks that race downward.
    float streak = fract(vWorld.y * 0.45 + uTime * 1.6 + sin(vWorld.x * 3.1 + vWorld.z * 2.3) * 0.35);
    float foam = smoothstep(0.55, 0.95, streak);
    col = mix(base, vec3(0.97, 0.99, 1.0), 0.35 + foam * 0.55);
    col *= 0.85 + 0.25 * max(dot(n, L), 0.0);
    alpha = uAlpha * (0.7 + foam * 0.3);
  } else if (uUnlit > 0.5) {
    col = base * (1.0 + uEmissive);
  } else {
    float ndl = dot(n, L);
    // Wrapped diffuse keeps rounded forms soft and painterly rather than hard-edged.
    float wrap = clamp((ndl + 0.25) / 1.25, 0.0, 1.0);
    float sh = shadowAt();
    // Cloud shadows: soft patches of shade drifting slowly across the land (a few sines, daytime only).
    if (uCloudShade > 0.0) {
      vec2 q = vWorld.xz * 0.021 + vec2(uTime * 0.011, uTime * 0.0045);
      float c = sin(q.x * 1.7 + sin(q.y * 2.3)) * sin(q.y * 1.3 - q.x * 0.9) * 0.5 + 0.5;
      sh *= 1.0 - uCloudShade * smoothstep(0.35, 0.8, c);
    }
    vec3 sky = mix(uGround, uSkyTop, n.y * 0.5 + 0.5);
    vec3 light = uSunColor * uSunIntensity * wrap * sh + sky * uAmbient;
    // Golden backlight halo on silhouettes when looking toward the sun.
    float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0) * clamp(dot(-V, L) * 0.6 + 0.4, 0.0, 1.0) * (0.35 + 0.65 * sh);
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(n, H), 0.0), 36.0) * 0.12 * sh;
    col = base * light + uSunColor * (rim * 0.32 + spec);
    if (uFx > 0.5) {
      float up = smoothstep(0.6, 0.9, n.y);
      float camD = length(vWorld - uCamPos);
      // Fresh snow glitters: tiny round prism-coloured glints that twinkle (they must be coloured: a white
      // glint on white snow would never show), up close only.
      if (uSnow > 0.1 && uSeasonOn > 0.5 && up > 0.0 && camD < 38.0) {
        vec2 gp = vWorld.xz * 11.0;
        float hs = hash21(floor(gp));
        float tw = pow(0.5 + 0.5 * sin(uTime * 2.4 + hs * 60.0), 2.0);
        float dot2 = smoothstep(0.3, 0.05, length(fract(gp) - 0.5));
        float g = step(0.92, hs) * tw * dot2 * up * uSnow * smoothstep(38.0, 12.0, camD);
        vec3 prism = 0.62 + 0.38 * cos(6.2832 * (hs * 9.0 + vec3(0.0, 0.33, 0.67)));
        col = mix(col, prism * 1.15, clamp(g * 0.9, 0.0, 0.9));
      }
      // Wet ground in the rain: a glassy sheen that mirrors the sky, and a sharper sun glint.
      if (uWet > 0.05) {
        float fr = pow(1.0 - max(dot(n, V), 0.0), 3.0);
        col += mix(uSkyHorizon, uSkyTop, 0.35) * fr * up * uWet * 0.4;
        col += uSunColor * pow(max(dot(n, H), 0.0), 80.0) * 0.45 * uWet * up * sh;
      }
    }
    col = tonemap(col);
    // Warm highlights, slightly cooler shadows: a gentle golden-hour grade.
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    col *= mix(vec3(0.94, 0.98, 1.06), vec3(1.05, 1.0, 0.92), smoothstep(0.15, 0.75, lum));
    col = mix(vec3(lum), col, 1.08);
  }

  if (uNoFog < 0.5) {
    float d = length(vWorld - uCamPos);
    float fog = 1.0 - exp(-max(d - uFogNear, 0.0) * uFogDensity);
    fog *= mix(0.25, 1.0, exp(-max(vWorld.y - 4.0, 0.0) * uFogHeight));
    float sunAmt = pow(max(dot(-V, L), 0.0), 6.0);
    vec3 fc = mix(uSkyHorizon, uSunColor * 0.92, sunAmt * 0.45);
    col = mix(col, fc, clamp(fog, 0.0, 1.0));
  }
  outColor = vec4(clamp(col, 0.0, 1.0), alpha * cutGhost);
}`;

const SHADOW_VS = `#version 300 es
in vec3 aPos; in vec3 aSmooth;
uniform mat4 uModel; uniform mat4 uLightVP; uniform float uSway; uniform float uTime;
void main() {
  vec4 w = uModel * vec4(aPos, 1.0);
  if (uSway > 0.0) {
    float k = aSmooth.x;
    float ph = w.x * 0.23 + w.z * 0.19;
    float gust = 0.6 + 0.4 * sin(uTime * 0.5 + w.x * 0.05);
    w.x += sin(uTime * 1.9 + ph) * k * uSway * gust;
    w.z += cos(uTime * 1.4 + ph * 1.3) * k * uSway * 0.7 * gust;
  }
  gl_Position = uLightVP * w;
}`;
const SHADOW_FS = `#version 300 es
precision mediump float;
void main() {}`;

const SKY_VS = `#version 300 es
in vec2 aPos;
out vec2 vNdc;
void main() { vNdc = aPos; gl_Position = vec4(aPos, 0.9999, 1.0); }`;

const SKY_FS = `#version 300 es
precision highp float;
in vec2 vNdc;
uniform mat4 uInvViewProj; uniform vec3 uLightDir; uniform vec3 uSunColor;
uniform vec3 uSkyTop; uniform vec3 uSkyHorizon; uniform float uTime; uniform float uClouds;
uniform float uStars; uniform vec3 uMoonDir; uniform float uFx;
out vec4 outColor;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += noise(p) * a; p = p * 2.02 + vec2(17.1, -9.7); a *= 0.5; }
  return s;
}
void main() {
  vec4 a = uInvViewProj * vec4(vNdc, -1.0, 1.0);
  vec4 b = uInvViewProj * vec4(vNdc, 1.0, 1.0);
  vec3 d = normalize(b.xyz / b.w - a.xyz / a.w);
  vec3 L = normalize(uLightDir);
  float h = d.y;
  vec3 col = mix(uSkyHorizon, uSkyTop, pow(clamp(h, 0.0, 1.0), 0.5));
  if (h < 0.0) col = mix(uSkyHorizon, uSkyHorizon * 0.92, clamp(-h * 3.0, 0.0, 1.0));
  float sd = max(dot(d, L), 0.0);
  // Warm horizon band on the sun side, then the glow and the disc itself.
  float az = max(dot(normalize(d.xz + 1e-4), normalize(L.xz + 1e-4)), 0.0);
  col = mix(col, uSunColor * 0.98, pow(az, 3.0) * exp(-max(h, 0.0) * 7.0) * 0.45);
  col += uSunColor * (pow(sd, 8.0) * 0.28 + pow(sd, 60.0) * 0.4);
  col = mix(col, vec3(1.0, 0.98, 0.9), smoothstep(0.9994, 0.9998, sd));
  if (uStars > 0.0 && h > 0.0) {
    // Twinkling stars on a sphere grid, and a soft moon with a halo.
    vec2 sp = vec2(atan(d.z, d.x) * 110.0, asin(clamp(d.y, -1.0, 1.0)) * 110.0);
    vec2 cell = floor(sp);
    float r = hash(cell);
    float tw = 0.6 + 0.4 * sin(uTime * (1.5 + r * 3.0) + r * 40.0);
    float star = step(0.985, r) * smoothstep(0.32, 0.0, length(fract(sp) - 0.5)) * tw;
    col += vec3(0.9, 0.95, 1.0) * star * uStars * smoothstep(0.0, 0.2, h);
    // A faint milky band across the sky.
    float band = exp(-pow((d.y - d.x * 0.6) * 3.0, 2.0)) * fbm(d.xz * 6.0);
    col += vec3(0.25, 0.28, 0.4) * band * uStars * 0.25;
    vec3 M = normalize(uMoonDir);
    float md = max(dot(d, M), 0.0);
    col += vec3(0.75, 0.82, 1.0) * pow(md, 40.0) * 0.25 * uStars;
    col = mix(col, vec3(0.97, 0.96, 0.9), smoothstep(0.99955, 0.9998, md) * uStars);
  }
  if (uFx > 0.5 && uStars > 0.35 && h > 0.06) {
    // Aurora: slow green-to-violet curtains that ripple high in the north, hidden behind cloud.
    vec2 ap = d.xz / (h + 0.32) * 0.9;
    float t = uTime * 0.05;
    float fold = noise(ap * 0.9 + vec2(t, -t * 0.6));
    float ribbon = exp(-pow((fold - 0.5) * 8.5, 2.0));
    float rays = 0.25 + 0.75 * noise(vec2(ap.x * 11.0 + t * 7.0, ap.y * 1.5));
    float fade = smoothstep(0.06, 0.2, h) * (1.0 - smoothstep(0.5, 0.9, h));
    vec3 aur = mix(vec3(0.1, 0.95, 0.55), vec3(0.5, 0.3, 0.95), smoothstep(0.22, 0.6, h));
    col += aur * ribbon * rays * fade * smoothstep(0.35, 0.8, uStars) * (1.0 - clamp(uClouds * 0.7, 0.0, 1.0)) * 1.7;
  }
  if (uClouds > 0.0 && h > 0.0) {
    vec2 uv = d.xz / (h + 0.1) * 0.85 + vec2(uTime * 0.004, uTime * 0.0015);
    float n = fbm(uv * 1.1);
    float cov = smoothstep(0.44, 0.72, n) * smoothstep(0.0, 0.16, h) * uClouds;
    float n2 = fbm(uv * 1.1 + L.xz * 0.09);
    float lit = clamp(0.55 + (n - n2) * 4.0, 0.0, 1.0);
    vec3 shade = mix(uSkyTop, vec3(0.62, 0.66, 0.78), 0.55);
    vec3 cc = mix(shade, vec3(1.0, 0.98, 0.95), lit);
    cc = mix(cc, uSunColor * 1.08, pow(sd, 5.0) * 0.55 + (1.0 - lit) * 0.0);
    // Silver lining where the cloud is thin.
    cc += uSunColor * smoothstep(0.72, 0.44, n) * pow(sd, 3.0) * 0.4;
    col = mix(col, cc, cov * 0.95);
  }
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export interface GpuMesh {
  vao: WebGLVertexArrayObject | null;
  count: number;
  buffers: WebGLBuffer[];
  /** Bounding sphere in model space (for culling). */
  bounds?: { c: Vec3; r: number };
  /** A chunked mesh: drawn as these spatial pieces so off-screen and far-away pieces are skipped. */
  parts?: GpuMesh[];
  /**
   * Lighter versions for distance (ascending `dist`): the same mesh without the triangles too small
   * to cover a pixel from that far away. `lods[0]` also draws the shadow map, whose texels are ~4 cm,
   * unless it's marked `follow` (a hand-made version): then shadows use whichever version is shown.
   */
  lods?: { dist: number; mesh: GpuMesh; follow?: boolean }[];
  /** Hidden closer than this (the far half of a hand-made LOD pair). */
  minDist?: number;
}

/** Level-of-detail steps: beyond `dist` metres, triangles under `area` m² are dropped. */
const LOD_STEPS = [{ dist: 40, area: 0.001 }, { dist: 80, area: 0.005 }, { dist: 140, area: 0.02 }];
/** Only meshes at least this big get LODs (small ones aren't worth the extra buffers). */
const LOD_MIN_VERTS = 4500;

export interface DrawOpts {
  outline?: number; // ink width in world units (0 = none)
  tint?: [number, number, number, number];
  unlit?: boolean;
  /** true / 1: still water (ripples, reflections). 2: falling water (waterfalls, cascades). */
  wave?: boolean | number;
  alpha?: number;
  noFog?: boolean;
  texture?: WebGLTexture;
  textureScale?: number;
  textureStrength?: number;
  /** Wind sway amplitude in world units (uses per-vertex weights). */
  sway?: number;
  /** Don't cast a shadow (terrain, decals, tiny details). */
  noCast?: boolean;
  /** Seasonal tint, snow cover and rain wetness apply to this draw (terrain, foliage, buildings). */
  season?: boolean;
  /** This draw dissolves where it blocks the view of the player (see Renderer.cutFocus). */
  cut?: boolean;
  /** Extra brightness for unlit glowing things (windows, lanterns). */
  emissive?: number;
  /** Always draw regardless of the draw distance (terrain, water, mountains). Still frustum culled. */
  always?: boolean;
  /** A shorter draw distance just for this (grass, flowers). */
  maxDist?: number;
}

export interface Environment {
  skyTop: Vec3;
  skyHorizon: Vec3;
  ground: Vec3;
  /** Direction toward the sun. */
  lightDir: Vec3;
  sunColor: Vec3;
  /** Multiplier on direct sunlight (sky glow uses sunColor alone). */
  sunIntensity: number;
  ambient: number;
  exposure: number;
  fogNear: number;
  fogFar: number;
  /** Fog thins out above this many metres (smaller = thinner at altitude). */
  fogHeight: number;
  ink: Vec3;
  clouds: number;
  /** Night sky: 0 = none, 1 = full starry sky with the moon at moonDir. */
  stars: number;
  moonDir: Vec3;
  /** Season tint for greenery (rgb target, amount), snow cover (0..1) and wetness (0..1). */
  seasonCol: [number, number, number, number];
  snow: number;
  wet: number;
  /** Draw the procedural sky before the scene. */
  sky: boolean;
}

interface Item { mesh: GpuMesh; smesh: GpuMesh; model: Mat4; opts: DrawOpts; view: boolean; shadow: boolean; fade: number; ink: number; depth?: number; ghost?: boolean }

/** Beyond this the ink outline is thinner than a pixel, so its second pass is skipped. */
const INK_DIST = 45;

const NO_TINT: readonly [number, number, number, number] = [0, 0, 0, 0];
/** Scratch for the per-draw uniform comparison, so `drawNow` allocates nothing. */
const SCRATCH_UNIFORMS = new Float32Array(17);

function boundsOf(P: Float32Array): { c: Vec3; r: number } {
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < P.length; i += 3) {
    const x = P[i], y = P[i + 1], z = P[i + 2];
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
    if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  if (!Number.isFinite(x0)) return { c: [0, 0, 0], r: 0 };
  const c: Vec3 = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
  return { c, r: Math.hypot(x1 - c[0], y1 - c[1], z1 - c[2]) };
}

const SHADOW_SIZE = 2048;
const SHADOW_EXTENT = 42; // half-width in metres covered around the focus point

export class Renderer {
  readonly gl: WebGL2RenderingContext;
  private prog: WebGLProgram;
  private shadowProg: WebGLProgram;
  private skyProg: WebGLProgram;
  private skyVao: WebGLVertexArrayObject;
  private whiteTexture: WebGLTexture;
  private shadowTex: WebGLTexture;
  private shadowFbo: WebGLFramebuffer;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private us: Record<string, WebGLUniformLocation | null> = {};
  private uk: Record<string, WebGLUniformLocation | null> = {};
  viewProj: Mat4 = new Float32Array(16);
  camPos: Vec3 = [0, 0, 0];
  time = 0;
  /** World point the sun's shadow map is centred on (usually the player). null = no shadows. */
  shadowFocus: Vec3 | null = null;
  shadowsEnabled = true;
  /** When set, draws marked `cut` turn see-through between the camera and this point (the player). */
  cutFocus: Vec3 | null = null;
  cutRadius = 1.8;
  /** Which see-through layer the shader is currently drawing (0 solid, 1 ghost). */
  private cutPass = 0;
  /** Graphics setting: "low" renders at 1x resolution without sun shadows. */
  quality: "high" | "low" = "high";
  /** How far (metres, from the camera) world detail is drawn; things fade in as you approach. */
  drawDistance = Infinity;
  /** Resolution scale picked automatically from the frame rate (0.55..1). */
  autoScale = 1;
  /**
   * Extra atmosphere (aurora, cloud shadows, snow glitter, wet sheen, light pools). The first thing the
   * adaptive-quality ladder gives up when frames run slow, and the last it brings back.
   */
  fx = true;
  get fxOn(): boolean { return this.fx && this.quality !== "low"; }
  /** Set by the frame-rate governor: shortens every draw distance (1 = as chosen in settings). */
  autoDist = 1;
  private frustum: Float32Array = new Float32Array(24);
  /** Draw calls submitted last frame (for the debug overlay). */
  debugQueue = false;
  lastQueue: { mesh: GpuMesh; view: boolean; shadow: boolean }[] = [];
  private inked: Item[] = [];
  stats = { items: 0, culled: 0, verts: 0, shadowVerts: 0 };
  private shadowSupported = true;
  env: Environment = {
    skyTop: [0.24, 0.5, 0.82],
    skyHorizon: [0.78, 0.86, 0.92],
    ground: [0.42, 0.4, 0.3],
    lightDir: [0.62, 0.42, -0.66],
    sunColor: [1.0, 0.86, 0.66],
    sunIntensity: 1.3,
    ambient: 0.5,
    exposure: 1.05,
    fogNear: 70,
    fogFar: 600,
    fogHeight: 0.012,
    ink: [0.18, 0.11, 0.07],
    clouds: 1,
    stars: 0,
    moonDir: [-0.5, 0.6, 0.4],
    seasonCol: [0, 0, 0, 0],
    snow: 0,
    wet: 0,
    sky: true,
  };
  private queue: Item[] = [];
  /** Reused every frame, so splitting the draw list costs no allocation. */
  private opaque: Item[] = [];
  private clear: Item[] = [];
  /**
   * The per-draw uniforms last sent to the GPU.
   *
   * Nearly every draw in a frame shares the same handful of flags, and `uniform1f` is not free
   * when it happens sixteen times per call across hundreds of calls. Only what actually
   * changed is re-sent; `end()` clears this so a new frame starts from a known state.
   */
  private lastUniforms: Float32Array | null = null;
  private lastTexture: WebGLTexture | null = null;
  private shadowMat: Mat4 = new Float32Array(16);

  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", { antialias: true, alpha: false, powerPreference: "high-performance" });
    if (!gl) throw new Error("WebGL2 is not available in this browser.");
    this.gl = gl;
    this.prog = this.link(VS, FS, ["aPos", "aNrm", "aCol", "aSmooth"]);
    for (const name of ["uModel", "uViewProj", "uShadowMat", "uOutline", "uTime", "uWave", "uSway", "uLightDir", "uSunColor", "uSunIntensity", "uCamPos", "uSkyTop", "uSkyHorizon", "uGround", "uFogNear", "uFogDensity", "uFogHeight", "uAmbient", "uExposure", "uTint", "uUnlit", "uInk", "uAlpha", "uNoFog", "uTexture", "uUseTexture", "uTextureScale", "uTextureStrength", "uEmissive", "uCutOn", "uCutPass", "uFx", "uCloudShade", "uCutFocus", "uCutRadius", "uSeasonOn", "uSeasonCol", "uSnow", "uWet", "uShadowMap", "uShadowOn", "uShadowTexel", "uFade"]) {
      this.u[name] = gl.getUniformLocation(this.prog, name);
    }
    this.shadowProg = this.link(SHADOW_VS, SHADOW_FS, ["aPos", "", "", "aSmooth"]);
    for (const name of ["uModel", "uLightVP", "uSway", "uTime"]) this.us[name] = gl.getUniformLocation(this.shadowProg, name);
    this.skyProg = this.link(SKY_VS, SKY_FS, ["aPos"]);
    for (const name of ["uInvViewProj", "uLightDir", "uSunColor", "uSkyTop", "uSkyHorizon", "uTime", "uClouds", "uStars", "uMoonDir", "uFx"]) this.uk[name] = gl.getUniformLocation(this.skyProg, name);

    // Fullscreen triangle for the sky.
    this.skyVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.skyVao);
    const sb = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, sb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    this.whiteTexture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.whiteTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));

    // Sun shadow map: a depth texture with hardware comparison (bilinear PCF).
    this.shadowTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, SHADOW_SIZE, SHADOW_SIZE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    this.shadowFbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTex, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) this.shadowSupported = false;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  /** Loads a repeatable albedo texture; a neutral placeholder is used until the image is ready. */
  loadTexture(url: string): WebGLTexture {
    const gl = this.gl;
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([196, 214, 166, 255]));
    const image = new Image();
    image.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
    };
    image.src = url;
    return texture;
  }

  private link(vs: string, fs: string, attribs: string[]): WebGLProgram {
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
    attribs.forEach((a, i) => a && gl.bindAttribLocation(p, i, a));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link error");
    return p;
  }

  upload(data: MeshData): GpuMesh {
    const m = this.uploadOne(data);
    if (data.count >= LOD_MIN_VERTS) {
      const P = data.positions;
      const tris = data.count / 3;
      const area = new Float32Array(tris);
      for (let t = 0; t < tris; t++) {
        const i = t * 9;
        const ax = P[i + 3] - P[i], ay = P[i + 4] - P[i + 1], az = P[i + 5] - P[i + 2];
        const bx = P[i + 6] - P[i], by = P[i + 7] - P[i + 1], bz = P[i + 8] - P[i + 2];
        area[t] = 0.5 * Math.hypot(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx);
      }
      let prev = data.count;
      for (const step of LOD_STEPS) {
        let keep = 0;
        for (let t = 0; t < tris; t++) if (area[t] >= step.area) keep++;
        // Not worth it unless it saves a good share (and never leave a mesh empty).
        if (keep === 0 || keep * 3 > prev * 0.85) continue;
        const pick = (src: Float32Array) => {
          const out = new Float32Array(keep * 9);
          let o = 0;
          for (let t = 0; t < tris; t++) if (area[t] >= step.area) { out.set(src.subarray(t * 9, t * 9 + 9), o); o += 9; }
          return out;
        };
        const lod = this.uploadOne({ positions: pick(P), normals: pick(data.normals), colors: pick(data.colors), smooth: pick(data.smooth), count: keep * 3 });
        lod.bounds = m.bounds;
        (m.lods ??= []).push({ dist: step.dist, mesh: lod });
        prev = keep * 3;
      }
    }
    return m;
  }

  private uploadOne(data: MeshData): GpuMesh {
    const gl = this.gl;
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buffers: WebGLBuffer[] = [];
    const { positions: P, normals: N, colors: C, smooth: S, count } = data;
    // Pack each vertex into 24 bytes instead of 48: position as floats, normal and outline/wind
    // direction as signed bytes, colour as unsigned bytes, all in one interleaved buffer. Half the
    // memory and half the vertex bandwidth for the GPU, which is what limits weaker laptops and
    // phones. (A mesh whose colours or directions don't fit those ranges keeps the float layout.)
    let packable = true;
    for (let i = 0; i < count * 3 && packable; i++) {
      const c = C[i], sm = S[i], n = N[i];
      if (!(c >= 0 && c <= 1 && sm >= -1 && sm <= 1 && n >= -1.0001 && n <= 1.0001)) packable = false;
    }
    if (packable) {
      const buf = new ArrayBuffer(count * 24);
      const f = new Float32Array(buf), i8 = new Int8Array(buf), u8 = new Uint8Array(buf);
      const q = (v: number) => Math.max(-127, Math.min(127, Math.round(v * 127)));
      for (let v = 0; v < count; v++) {
        const o = v * 24, k = v * 3;
        f[o / 4] = P[k]; f[o / 4 + 1] = P[k + 1]; f[o / 4 + 2] = P[k + 2];
        i8[o + 12] = q(N[k]); i8[o + 13] = q(N[k + 1]); i8[o + 14] = q(N[k + 2]);
        u8[o + 16] = Math.round(C[k] * 255); u8[o + 17] = Math.round(C[k + 1] * 255); u8[o + 18] = Math.round(C[k + 2] * 255);
        i8[o + 20] = q(S[k]); i8[o + 21] = q(S[k + 1]); i8[o + 22] = q(S[k + 2]);
      }
      const b = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.BYTE, true, 24, 12);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.UNSIGNED_BYTE, true, 24, 16);
      gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 3, gl.BYTE, true, 24, 20);
      buffers.push(b);
    } else {
      [P, N, C, S].forEach((arr, i) => {
        const b = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(i);
        gl.vertexAttribPointer(i, 3, gl.FLOAT, false, 0, 0);
        buffers.push(b);
      });
    }
    gl.bindVertexArray(null);
    return { vao, count, buffers, bounds: boundsOf(P) };
  }

  /** Splits a mesh into a grid of cells (by triangle centre). */
  private cells(data: MeshData, cell: number): Map<number, MeshData> {
    const P = data.positions;
    const tris = data.count / 3;
    const lists = new Map<number, number[]>();
    for (let t = 0; t < tris; t++) {
      const i = t * 9;
      const cx = (P[i] + P[i + 3] + P[i + 6]) / 3, cz = (P[i + 2] + P[i + 5] + P[i + 8]) / 3;
      const k = (Math.floor(cx / cell) + 512) * 1024 + Math.floor(cz / cell) + 512;
      let l = lists.get(k);
      if (!l) lists.set(k, (l = []));
      l.push(t);
    }
    const out = new Map<number, MeshData>();
    for (const [k, list] of lists) {
      const n = list.length * 9;
      const pick = (src: Float32Array) => {
        const o = new Float32Array(n);
        let j = 0;
        for (const t of list) { o.set(src.subarray(t * 9, t * 9 + 9), j); j += 9; }
        return o;
      };
      out.set(k, { positions: pick(P), normals: pick(data.normals), colors: pick(data.colors), smooth: pick(data.smooth), count: list.length * 3 });
    }
    return out;
  }

  /** Uploads a big static mesh as a grid of chunks (by triangle centre) so each can be culled. */
  uploadChunked(data: MeshData, cell = 24): GpuMesh {
    const parts = [...this.cells(data, cell).values()].map((d) => this.upload(d));
    return { vao: null, count: data.count, buffers: [], parts, bounds: boundsOf(data.positions) };
  }

  /**
   * Like `uploadChunked`, with a hand-made low-detail version of the same things (e.g. trees with
   * fewer branch tiers) that each chunk switches to beyond `dist` metres.
   */
  uploadChunkedLod(near: MeshData, far: MeshData, dist: number, cell = 24): GpuMesh {
    const n = this.cells(near, cell), f = this.cells(far, cell);
    const parts: GpuMesh[] = [];
    for (const [k, d] of n) {
      const part = this.uploadOne(d);
      const fd = f.get(k);
      if (fd) { const fm = this.uploadOne(fd); fm.bounds = part.bounds; part.lods = [{ dist, mesh: fm, follow: true }]; }
      parts.push(part);
    }
    // Far pieces whose near twin landed in the next cell over: only drawn from far away.
    for (const [k, d] of f) if (!n.has(k)) { const m = this.uploadOne(d); m.minDist = dist; parts.push(m); }
    return { vao: null, count: near.count, buffers: [], parts, bounds: boundsOf(near.positions) };
  }

  dispose(m: GpuMesh) {
    for (const p of m.parts ?? []) this.dispose(p);
    for (const l of m.lods ?? []) this.dispose(l.mesh);
    for (const b of m.buffers) this.gl.deleteBuffer(b);
    if (m.vao) this.gl.deleteVertexArray(m.vao);
  }

  resize(): void {
    // Phones get a slightly lower render resolution to keep the frame rate smooth.
    const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
    const dpr = (this.quality === "low" ? Math.min(1, window.devicePixelRatio || 1) : Math.min(window.devicePixelRatio || 1, 1.5)) * this.autoScale;
    const w = Math.floor(this.canvas.clientWidth * dpr), h = Math.floor(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  /** Starts a frame. Draw calls are queued until end(). */
  begin(view: Mat4, proj: Mat4, camPos: Vec3): void {
    this.viewProj = multiply(proj, view);
    this.camPos = camPos;
    this.queue = [];
    this.stats = { items: 0, culled: 0, verts: 0, shadowVerts: 0 };
    // Frustum planes (Gribb–Hartmann), normalised: left, right, bottom, top, near, far.
    const m = this.viewProj, f = this.frustum;
    const rows = [[3, 0, 1], [3, 0, -1], [3, 1, 1], [3, 1, -1], [3, 2, 1], [3, 2, -1]] as const;
    rows.forEach(([w, a, sgn], i) => {
      const x = m[w] + sgn * m[a], y = m[4 + w] + sgn * m[4 + a], z = m[8 + w] + sgn * m[8 + a], d = m[12 + w] + sgn * m[12 + a];
      const l = Math.hypot(x, y, z) || 1;
      f[i * 4] = x / l; f[i * 4 + 1] = y / l; f[i * 4 + 2] = z / l; f[i * 4 + 3] = d / l;
    });
  }

  draw(mesh: GpuMesh, model: Mat4, opts: DrawOpts = {}): void {
    if (mesh.parts) {
      for (const p of mesh.parts) this.draw(p, model, opts);
      return;
    }
    let view = true, shadow = true, fade = 0, ink = opts.outline ?? 0;
    let vmesh = mesh, smesh = mesh;
    const b = mesh.bounds;
    if (b) {
      // World-space bounding sphere (model matrices here are rotation/translation/scale).
      const sc = Math.max(Math.hypot(model[0], model[1], model[2]), Math.hypot(model[4], model[5], model[6]), Math.hypot(model[8], model[9], model[10]));
      const x = model[0] * b.c[0] + model[4] * b.c[1] + model[8] * b.c[2] + model[12];
      const y = model[1] * b.c[0] + model[5] * b.c[1] + model[9] * b.c[2] + model[13];
      const z = model[2] * b.c[0] + model[6] * b.c[1] + model[10] * b.c[2] + model[14];
      const r = b.r * sc + (opts.sway ? 1 : 0);
      const f = this.frustum;
      for (let i = 0; i < 6 && view; i++) if (f[i * 4] * x + f[i * 4 + 1] * y + f[i * 4 + 2] * z + f[i * 4 + 3] < -r) view = false;
      const dist = Math.hypot(x - this.camPos[0], z - this.camPos[2]) - r;
      const limit = Math.min(opts.maxDist ?? Infinity, opts.always ? Infinity : this.drawDistance) * this.autoDist;
      if (dist > limit || (mesh.minDist && dist < mesh.minDist)) view = false;
      // Small things far away cover a pixel or two: not worth a draw call.
      else if (!opts.always && r < dist * 0.005) view = false;
      else if (Number.isFinite(limit) && r < 60) fade = limit;
      if (dist > INK_DIST) ink = 0;
      if (mesh.minDist && dist < mesh.minDist) shadow = false;
      if (mesh.lods && sc > 0.6 && sc < 1.7) {
        if (!mesh.lods[0].follow) smesh = mesh.lods[0].mesh;
        // Glowing things (bulbs, lanterns, neon) stay whole: at night they're the bright dots you see.
        if (!opts.unlit && !opts.emissive) for (const l of mesh.lods) if (dist > l.dist) vmesh = l.mesh;
        if (mesh.lods[0].follow) smesh = vmesh;
      }
      const sf = this.shadowFocus;
      shadow = !!sf && Math.hypot(x - sf[0], z - sf[2]) - r < SHADOW_EXTENT * 1.15 && (!Number.isFinite(limit) || dist < limit + 20);
    }
    if (!view && !(shadow && this.casts(opts))) { this.stats.culled++; return; }
    this.stats.items++;
    if (view) this.stats.verts += vmesh.count * (ink ? 2 : 1);
    if (shadow && this.casts(opts)) this.stats.shadowVerts += smesh.count;
    this.queue.push({ mesh: vmesh, smesh, model, opts, view, shadow, fade, ink });
  }

  private casts(o: DrawOpts): boolean {
    return !o.unlit && !o.noCast && !o.noFog && !o.wave && (o.alpha ?? 1) >= 1;
  }

  /** Frames since the shadow map was last drawn (it's redrawn every other frame). */
  private shadowAge = 99;
  private shadowAt: Vec3 = [1e9, 0, 1e9];
  /** Redraw the sun's shadow map on every frame instead of every other one. */
  shadowEveryFrame = false;

  private renderShadows(): boolean {
    const gl = this.gl;
    const f = this.shadowFocus;
    if (!f || !this.shadowsEnabled || !this.shadowSupported || this.quality === "low") { this.shadowAge = 99; return false; }
    // The shadow map plus the light matrix it was drawn with stay consistent with each other, so
    // reusing last frame's pair is exact for everything that didn't move and one frame late for
    // what did. Halving the redraws saves the whole shadow pass on alternate frames.
    const jumped = Math.hypot(f[0] - this.shadowAt[0], f[2] - this.shadowAt[2]) > 8; // a new scene or a teleport
    if (!this.shadowEveryFrame && this.shadowAge === 0 && !jumped) { this.shadowAge++; return true; }
    this.shadowAge = 0;
    this.shadowAt = [f[0], f[1], f[2]];
    const L = this.env.lightDir;
    const len = Math.hypot(L[0], L[1], L[2]) || 1;
    const dist = 220;
    const eye: Vec3 = [f[0] + (L[0] / len) * dist, f[1] + (L[1] / len) * dist, f[2] + (L[2] / len) * dist];
    const view = lookAt(eye, f, [0, 1, 0]);
    const proj = ortho(-SHADOW_EXTENT, SHADOW_EXTENT, -SHADOW_EXTENT, SHADOW_EXTENT, 1, dist * 2);
    // Snap to whole shadow texels so shadows don't shimmer as the player walks.
    let vp = multiply(proj, view);
    const o = transformPoint(vp, 0, 0, 0);
    const texel = 2 / SHADOW_SIZE;
    proj[12] += Math.round(o[0] / texel) * texel - o[0];
    proj[13] += Math.round(o[1] / texel) * texel - o[1];
    vp = multiply(proj, view);
    this.shadowMat = vp;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
    gl.viewport(0, 0, SHADOW_SIZE, SHADOW_SIZE);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.shadowProg);
    gl.uniformMatrix4fv(this.us.uLightVP, false, vp);
    gl.uniform1f(this.us.uTime, this.time);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1.6, 3);
    for (const it of this.queue) {
      if (!it.shadow || !this.casts(it.opts)) continue;
      gl.bindVertexArray(it.smesh.vao);
      gl.uniformMatrix4fv(this.us.uModel, false, it.model);
      gl.uniform1f(this.us.uSway, it.opts.sway ?? 0);
      gl.drawArrays(gl.TRIANGLES, 0, it.smesh.count);
    }
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return true;
  }

  private drawSky(): void {
    const gl = this.gl;
    const e = this.env;
    const inv = invert(this.viewProj);
    if (!inv) return;
    gl.useProgram(this.skyProg);
    gl.uniformMatrix4fv(this.uk.uInvViewProj, false, inv);
    gl.uniform3fv(this.uk.uLightDir, e.lightDir);
    gl.uniform3fv(this.uk.uSunColor, e.sunColor);
    gl.uniform3fv(this.uk.uSkyTop, e.skyTop);
    gl.uniform3fv(this.uk.uSkyHorizon, e.skyHorizon);
    gl.uniform1f(this.uk.uTime, this.time);
    gl.uniform1f(this.uk.uFx, this.fxOn ? 1 : 0);
    gl.uniform1f(this.uk.uClouds, e.clouds);
    gl.uniform1f(this.uk.uStars, e.stars);
    gl.uniform3fv(this.uk.uMoonDir, e.moonDir);
    // Drawn after everything solid, and only where nothing solid was drawn (the depth test), so the
    // sky's heavy cloud and star maths never runs on pixels that a hill or a house then covers.
    gl.depthMask(false);
    gl.bindVertexArray(this.skyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.depthMask(true);
    gl.useProgram(this.prog);
  }

  end(): void {
    const gl = this.gl;
    const shadows = this.renderShadows();

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    const [r, g, b] = this.env.skyHorizon;
    gl.clearColor(r, g, b, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // (the sky is drawn further down, after the solid things)

    gl.useProgram(this.prog);
    const e = this.env;
    gl.uniformMatrix4fv(this.u.uViewProj, false, this.viewProj);
    gl.uniformMatrix4fv(this.u.uShadowMat, false, this.shadowMat);
    gl.uniform3fv(this.u.uLightDir, e.lightDir);
    gl.uniform3fv(this.u.uSunColor, e.sunColor);
    gl.uniform1f(this.u.uSunIntensity, e.sunIntensity);
    gl.uniform3fv(this.u.uCamPos, this.camPos);
    gl.uniform3fv(this.u.uSkyTop, e.skyTop);
    gl.uniform3fv(this.u.uSkyHorizon, e.skyHorizon);
    gl.uniform3fv(this.u.uGround, e.ground);
    gl.uniform3fv(this.u.uInk, e.ink);
    gl.uniform1f(this.u.uFogNear, e.fogNear);
    gl.uniform1f(this.u.uFogDensity, 2.2 / Math.max(1, e.fogFar - e.fogNear));
    gl.uniform1f(this.u.uFogHeight, e.fogHeight);
    gl.uniform1f(this.u.uAmbient, e.ambient);
    gl.uniform1f(this.u.uExposure, e.exposure);
    gl.uniform1f(this.u.uTime, this.time);
    gl.uniform1f(this.u.uShadowOn, shadows ? 1 : 0);
    gl.uniform4fv(this.u.uSeasonCol, e.seasonCol);
    gl.uniform3fv(this.u.uCutFocus, this.cutFocus ?? [0, 0, 0]);
    gl.uniform1f(this.u.uCutRadius, this.cutFocus ? this.cutRadius : 0);
    gl.uniform1f(this.u.uCutPass, 0);
    this.cutPass = 0;
    gl.uniform1f(this.u.uFx, this.fxOn ? 1 : 0);
    // Cloud shadows only by day, and more of them when it's cloudier.
    const dayness = Math.max(0, Math.min(1, (e.sunIntensity - 1.0) / 0.4));
    gl.uniform1f(this.u.uCloudShade, this.fxOn ? Math.min(0.45, 0.14 + 0.2 * e.clouds) * dayness : 0);
    gl.uniform1f(this.u.uSnow, e.snow);
    gl.uniform1f(this.u.uWet, e.wet);
    gl.uniform1f(this.u.uShadowTexel, 1 / SHADOW_SIZE);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.uniform1i(this.u.uShadowMap, 1);

    // Split into opaque and translucent in one pass, into arrays that live across frames.
    const opaque = this.opaque, clear = this.clear;
    opaque.length = 0;
    clear.length = 0;
    for (const it of this.queue) {
      if (!it.view) continue;
      ((it.opts.alpha ?? 1) >= 1 ? opaque : clear).push(it);
    }
    // Near to far: the depth test then throws away hidden pixels before the (fairly heavy) lighting
    // shader runs on them, instead of shading a wall and then painting the tree in front over it.
    // Big always-drawn things (terrain, water, mountains) go last; they cover most of the screen
    // and are mostly hidden behind everything else.
    const c0 = this.camPos;
    for (const it of opaque) {
      const m = it.model, b = it.mesh.bounds;
      const x = b ? m[0] * b.c[0] + m[4] * b.c[1] + m[8] * b.c[2] + m[12] : m[12];
      const z = b ? m[2] * b.c[0] + m[6] * b.c[1] + m[10] * b.c[2] + m[14] : m[14];
      it.depth = it.opts.always || (b && b.r > 60) ? 1e9 : (x - c0[0]) ** 2 + (z - c0[2]) ** 2;
    }
    // Outlined things (beavers, mostly) keep the order they were queued in and go after the rest: an
    // ink hull drawn before the parts behind it would hide them.
    const inked = this.inked;
    inked.length = 0;
    let j = 0;
    for (const it of opaque) { if (it.ink) inked.push(it); else opaque[j++] = it; }
    opaque.length = j;
    opaque.sort((a, b) => a.depth! - b.depth!);
    for (const it of opaque) this.drawNow(it);
    for (const it of inked) this.drawNow(it);
    if (this.env.sky) this.drawSky();
    // See-through ghosts: the solid things that were cut open around your line of sight, redrawn
    // translucent where they were cut (see the shader). Only those the window actually touches.
    const focus = this.cutFocus;
    if (focus && this.cutRadius > 0) {
      const sx = focus[0] - c0[0], sy = focus[1] - c0[1], sz = focus[2] - c0[2];
      const sl = Math.hypot(sx, sy, sz) || 1;
      const dx = sx / sl, dy = sy / sl, dz = sz / sl;
      for (const it of opaque) {
        if (!it.opts.cut) continue;
        const b = it.mesh.bounds;
        if (b) {
          const m = it.model;
          const sc = Math.max(Math.hypot(m[0], m[1], m[2]), Math.hypot(m[4], m[5], m[6]), Math.hypot(m[8], m[9], m[10]));
          const x = m[0] * b.c[0] + m[4] * b.c[1] + m[8] * b.c[2] + m[12] - c0[0];
          const y = m[1] * b.c[0] + m[5] * b.c[1] + m[9] * b.c[2] + m[13] - c0[1];
          const z = m[2] * b.c[0] + m[6] * b.c[1] + m[10] * b.c[2] + m[14] - c0[2];
          const t = x * dx + y * dy + z * dz;
          const r = b.r * sc + this.cutRadius;
          if (t < -r || t > sl + r || Math.hypot(x - dx * t, y - dy * t, z - dz * t) > r) continue;
        }
        clear.push({ ...it, ghost: true });
      }
    }
    if (clear.length) {
      // Far to near, so overlapping translucent things blend correctly.
      const c = this.camPos;
      const d = (it: Item) => (it.model[12] - c[0]) ** 2 + (it.model[13] - c[1]) ** 2 + (it.model[14] - c[2]) ** 2;
      clear.sort((a, b) => d(b) - d(a));
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      for (const it of clear) this.drawNow(it);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.uniform1f(this.u.uCutPass, 0);
    }
    gl.bindVertexArray(null);
    if (this.debugQueue && this.queue.length) this.lastQueue = this.queue;
    this.queue = [];
    this.cutFocus = null;
    this.lastUniforms = null;
    this.lastTexture = null;
    this.drawDistance = Infinity; // scenes that want a draw distance set it every frame
  }

  private drawNow({ mesh, model, opts, fade, ink, ghost }: Item): void {
    const gl = this.gl;
    gl.bindVertexArray(mesh.vao);
    const pass = ghost ? 1 : 0;
    if (pass !== this.cutPass) { gl.uniform1f(this.u.uCutPass, pass); this.cutPass = pass; }
    gl.uniformMatrix4fv(this.u.uModel, false, model);

    const tint = opts.tint ?? NO_TINT;
    const next = SCRATCH_UNIFORMS;
    next[0] = opts.unlit ? 1 : 0;
    next[1] = opts.wave === true ? 1 : typeof opts.wave === "number" ? opts.wave : 0;
    next[2] = opts.sway ?? 0;
    next[3] = opts.alpha ?? 1;
    next[4] = opts.noFog ? 1 : 0;
    next[5] = opts.emissive ?? 0;
    next[6] = opts.season ? 1 : 0;
    next[7] = opts.cut ? 1 : 0;
    next[8] = opts.texture ? 1 : 0;
    next[9] = opts.textureScale ?? 1;
    next[10] = opts.textureStrength ?? 1;
    next[11] = tint[0]; next[12] = tint[1]; next[13] = tint[2]; next[14] = tint[3];
    next[15] = fade ? fade * 0.82 : 0; next[16] = fade;

    const prev = this.lastUniforms;
    const set = (i: number, loc: WebGLUniformLocation | null) => {
      if (!prev || prev[i] !== next[i]) gl.uniform1f(loc, next[i]);
    };
    set(0, this.u.uUnlit);
    set(1, this.u.uWave);
    set(2, this.u.uSway);
    set(3, this.u.uAlpha);
    set(4, this.u.uNoFog);
    set(5, this.u.uEmissive);
    set(6, this.u.uSeasonOn);
    set(7, this.u.uCutOn);
    set(8, this.u.uUseTexture);
    set(9, this.u.uTextureScale);
    set(10, this.u.uTextureStrength);
    if (!prev || prev[11] !== next[11] || prev[12] !== next[12] || prev[13] !== next[13] || prev[14] !== next[14]) {
      gl.uniform4f(this.u.uTint, next[11], next[12], next[13], next[14]);
    }
    if (!prev || prev[15] !== next[15] || prev[16] !== next[16]) gl.uniform2f(this.u.uFade, next[15], next[16]);
    const tex = opts.texture ?? this.whiteTexture;
    if (tex !== this.lastTexture) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(this.u.uTexture, 0);
      this.lastTexture = tex;
    }
    if (!this.lastUniforms) this.lastUniforms = new Float32Array(17);
    this.lastUniforms.set(next);

    gl.uniform1f(this.u.uOutline, 0);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
    if (ink) {
      // Push the hull slightly back so it never z-fights with the surface it outlines.
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(2, 4);
      gl.uniform1f(this.u.uOutline, ink);
      gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
      gl.uniform1f(this.u.uOutline, 0);
      gl.disable(gl.POLYGON_OFFSET_FILL);
    }
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
