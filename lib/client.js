window.__ModuleLoader__.load({
  id: 'dsh-deepseek-flow',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    /**
     * dsh-deepseek-flow — a pixel-exact reproduction of the animated hero
     * backdrop on https://www.deepseek.com/.
     *
     * The original is a WebGL2 "pattern" shader (checks shape + curl noise
     * distortion + iterative swirl) composited under two CSS layers:
     *
     *   hero gradient : linear-gradient(180deg, #9cc1e7 0%, rgba(250,250,250,0) 100%)
     *   page colour   : #f9f8f8
     *   canvas mask   : linear-gradient(#000000fc 0%, #000000e8 8.98%, transparent 100%)
     *
     * Both the fragment shader and the uniform mapping below are transcribed
     * verbatim from the site's bundle so the motion, palette and falloff match
     * rather than merely resemble it.
     */

    const VERTEX_SHADER = `#version 300 es
in vec4 a_position;
void main() {
  gl_Position = a_position;
}`

    const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform float u_time;
uniform float u_pixelRatio;
uniform vec2 u_resolution;

uniform float u_scale;
uniform float u_rotation;
uniform vec4 u_color1;
uniform vec4 u_color2;
uniform vec4 u_color3;
uniform vec4 u_color4;
uniform vec4 u_color5;
uniform vec4 u_color6;
uniform float u_colorCount;
uniform float u_grain;
uniform float u_proportion;
uniform float u_softness;
uniform float u_shape;
uniform float u_shapeScale;
uniform float u_distortion;
uniform float u_swirl;
uniform float u_swirlIterations;
uniform vec2 u_offset;

out vec4 fragColor;

#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846

vec2 rotate(vec2 uv, float th) {
  return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
}

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float noise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = random(i);
  float b = random(i + vec2(1.0, 0.0));
  float c = random(i + vec2(0.0, 1.0));
  float d = random(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  float x1 = mix(a, b, u.x);
  float x2 = mix(c, d, u.x);
  return mix(x1, x2, u.y);
}

vec3 blend_multi(float mixer, float softness) {
  float edge = 1.0 - softness;
  vec3 col = u_color1.rgb;
  if (u_colorCount > 1.5) {
    float r1 = smoothstep(0.0 + 0.35 * edge, 0.7 - 0.35 * edge, mixer);
    col = mix(col, u_color2.rgb, r1);
  }
  if (u_colorCount > 2.5) {
    float r2 = smoothstep(0.3 + 0.35 * edge, 1.0 - 0.35 * edge, mixer);
    col = mix(col, u_color3.rgb, r2);
  }
  if (u_colorCount > 3.5) {
    col = mix(col, u_color4.rgb, smoothstep(0.4, 0.75, mixer));
  }
  if (u_colorCount > 4.5) {
    col = mix(col, u_color5.rgb, smoothstep(0.55, 0.85, mixer));
  }
  if (u_colorCount > 5.5) {
    col = mix(col, u_color6.rgb, smoothstep(0.7, 0.95, mixer));
  }
  return col;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;

  float t = .5 * u_time;
  float noise_scale = .0005 + .006 * u_scale;

  uv -= .5;
  uv *= (noise_scale * u_resolution);
  uv = rotate(uv, u_rotation * .5 * PI);
  uv /= u_pixelRatio;
  uv += .5;
  uv += u_offset;

  float n1 = noise(uv * 1. + t);
  float n2 = noise(uv * 2. - t);
  float angle = n1 * TWO_PI;
  uv.x += 4. * u_distortion * n2 * cos(angle);
  uv.y += 4. * u_distortion * n2 * sin(angle);

  float iterations_number = ceil(clamp(u_swirlIterations, 1., 30.));
  for (float i = 1.; i <= 30.0; i++) {
    if (i > iterations_number) break;
    uv.x += clamp(u_swirl, 0., 2.) / i * cos(t + i * 1.5 * uv.y);
    uv.y += clamp(u_swirl, 0., 2.) / i * cos(t + i * 1. * uv.x);
  }

  float proportion = clamp(u_proportion, 0., 1.);

  float shape = 0.;
  float mixer = 0.;
  if (u_shape < .5) {
    vec2 checks_shape_uv = uv * (.5 + 3.5 * u_shapeScale);
    shape = .5 + .5 * sin(checks_shape_uv.x) * cos(checks_shape_uv.y);
    mixer = shape + .48 * sign(proportion - .5) * pow(abs(proportion - .5), .5);
  } else if (u_shape < 1.5) {
    vec2 stripes_shape_uv = uv * (.25 + 3. * u_shapeScale);
    float f = fract(stripes_shape_uv.y);
    shape = smoothstep(.0, .55, f) * smoothstep(1., .45, f);
    mixer = shape + .48 * sign(proportion - .5) * pow(abs(proportion - .5), .5);
  } else {
    float sh = 1. - uv.y;
    sh -= .5;
    sh /= (noise_scale * u_resolution.y);
    sh += .5;
    float shape_scaling = .2 * (1. - u_shapeScale);
    shape = smoothstep(.45 - shape_scaling, .55 + shape_scaling, sh + .3 * (proportion - .5));
    mixer = shape;
  }

  vec3 col = blend_multi(mixer, clamp(u_softness, 0., 1.));
  fragColor = vec4(col, 1.0);

  if (u_grain > 0.0) {
    float g = random(gl_FragCoord.xy + vec2(u_time * 100.0));
    fragColor.rgb += (g - 0.5) * u_grain;
  }
}`

    /** The site's <AnimatedCanvas type="pattern" …/> props, verbatim. */
    const SITE_PROPS = {
      colors: ['#8AA3D6', '#FFFFFF', '#FFFFFF'],
      speed: 14,
      distortion: 20,
      swirl: 12,
      swirlIterations: 8,
      scale: 0.5,
      rotation: -5,
      proportion: 50,
      softness: 100,
      shape: 'checks',
      shapeScale: 10,
      offsetX: 0,
      offsetY: 65,
      grain: 0,
    }

    const SHAPE_INDEX = { checks: 0, stripes: 1, gradient: 2 }

    function hexToRgb(hex) {
      const s = hex.replace('#', '')
      return [
        parseInt(s.slice(0, 2), 16) / 255,
        parseInt(s.slice(2, 4), 16) / 255,
        parseInt(s.slice(4, 6), 16) / 255,
      ]
    }

    const API = '/api/deepseek-flow/settings'

    /** Plugin state shared by the painter and the settings row. */
    const state = {
      value: {
        enabled: true,
        speed: 14,
        intensity: 100,
        scrim: 6,
        opacity: 100,
        // Composer card fill, in percent of white — 20 matches the site's
        // --ds-color-bg-input (hsla(0,0%,100%,.2)).
        cardOpacity: 20,
      },
      listeners: new Set(),
    }

    function notify() {
      for (const fn of state.listeners) {
        try {
          fn()
        } catch (error) {
          console.error('[dsh-deepseek-flow] listener failed', error)
        }
      }
    }

    async function loadSettings() {
      try {
        const res = await fetch(API, { headers: { accept: 'application/json' } })
        if (!res.ok) return
        const body = await res.json()
        if (body && body.ok && body.value) {
          state.value = { ...state.value, ...body.value }
          notify()
        }
      } catch {
        /* keep defaults; the painter still runs */
      }
    }

    /** Save one patch; resolves to "ok" | "failed". */
    async function saveSettings(patch) {
      const next = { ...state.value, ...patch }
      state.value = next
      notify()
      try {
        const res = await fetch(API, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(next),
        })
        if (!res.ok) return 'failed'
        const body = await res.json()
        if (!body || !body.ok) return 'failed'
        state.value = { ...state.value, ...body.value }
        notify()
        return 'ok'
      } catch (error) {
        console.error('[dsh-deepseek-flow] save failed', error)
        return 'failed'
      }
    }

    /** Subscribe a listener; returns the disposer. */
    function subscribe(fn) {
      state.listeners.add(fn)
      return () => state.listeners.delete(fn)
    }

    function getSnapshot() {
      return state.value
    }

    const STYLE_ID = 'dsh-deepseek-flow/style'
    const CSS = `
  /* The WebGL canvas sits behind everything, above the app's own page fill.
     Opacity fades the whole wallpaper toward the page colour, so lowering it
     keeps the official look as the floor rather than revealing a black hole. */
  .dsh-flow-layer {
    position: fixed; inset: 0; z-index: -2; pointer-events: none;
    overflow: hidden;
    background: #f9f8f8;
    opacity: var(--dsh-flow-opacity, 1);
  }
  body[data-ds-dark-theme] .dsh-flow-layer {
    background: #0a0a0a;
  }
  .dsh-flow-layer canvas {
    position: absolute; inset: 0; width: 100%; height: 100%; display: block;
    pointer-events: none;
  }
  /* The scrim is the site's own readability veil, theme aware. */
  .dsh-flow-scrim {
    position: fixed; inset: 0; z-index: -1; pointer-events: none;
    background: rgba(249, 248, 248, var(--dsh-flow-scrim, 0.06));
  }
  body[data-ds-dark-theme] .dsh-flow-scrim {
    background: rgba(10, 10, 10, var(--dsh-flow-scrim, 0.06));
  }
  /* Desktop shells collect app-region boxes by geometry; these two
     full-viewport body children would otherwise swallow the window drag. */
  body > .dsh-flow-layer,
  body > .dsh-flow-scrim {
    -webkit-app-region: initial !important;
  }
  /* Let the wallpaper show through the app frame + sidebar. */
  body[data-dsh-flow] {
    --dsw-alias-bg-base: transparent;
    --dsw-specific-sidebar-fill: transparent;
  }

  /* ---- frosted composer, copied from the deepseek.com hero input ---------
     The site's <div class="ds-glass-card ds-input-wrapper"> resolves to:

       background-color: hsla(0, 0%, 100%, .2)      /* --ds-color-bg-input */
       border:           2px solid hsla(0,0%,100%,.8)
       backdrop-filter:  blur(12px)                 /* --ds-blur-glass */
       :hover / :focus-within -> hsla(0,0%,100%,.36) + border hsla(0,0%,100%,.25)

     dsh paints the same card with --dsw-specific-input-major, which resolves to
     plain #fff in the light theme (#2c2c2e in the dark one) — that opaque fill
     is what hid the wallpaper.

     IMPORTANT: dsh declares it with the background SHORTHAND
     (.RlGAzG_card{background:var(--dsw-specific-input-major)}). A longhand
     background-color does NOT override a shorthand from an earlier
     declaration in the same origin — the shorthand resets every longhand it
     covers, so the card kept its opaque white. We must write the shorthand
     here too, or nothing changes.

     The translucent fill goes on the CARD, and the blur goes on a ::before
     that sits *behind* it (z-index:-1). Two reasons for this split:
       · a fill on the card is what a card-level backdrop-filter would sample,
         turning the glass flat grey — so the blur must not be on the card;
       · keeping the fill on the card means it always wins over dsh's opaque
         white (same shorthand, higher specificity), which is what makes the
         effect show up at all. */
  body[data-dsh-flow] [data-composer-card] {
    position: relative;
    isolation: isolate;
    z-index: 0;
    /* Shorthand, to beat dsh's shorthand. !important because dsh's rule may be
       emitted into a later stylesheet than this one. */
    background: hsla(0, 0%, 100%, var(--dsh-flow-card-alpha, 0.2)) !important;
    border-color: hsla(0, 0%, 100%, 0.8);
    transition: background-color .2s ease, border-color .2s ease;
  }
  body[data-dsh-flow] [data-composer-card]:hover,
  body[data-dsh-flow] [data-composer-card]:focus-within {
    background: hsla(0, 0%, 100%, var(--dsh-flow-card-alpha-hover, 0.36)) !important;
    border-color: hsla(0, 0%, 100%, 0.25);
  }
  /* The blur sheet sits behind the card's own fill and below its content. */
  body[data-dsh-flow] [data-composer-card]::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    border-radius: inherit;
    pointer-events: none;
    -webkit-backdrop-filter: blur(var(--dsh-flow-card-blur, 12px));
    backdrop-filter: blur(var(--dsh-flow-card-blur, 12px));
  }
  /* Dark theme: the site swaps to hsla(0,0%,100%,.08) over a near-black page. */
  body[data-ds-dark-theme][data-dsh-flow] [data-composer-card] {
    background: hsla(0, 0%, 100%, calc(var(--dsh-flow-card-alpha, 0.2) * 0.4)) !important;
    border-color: hsla(0, 0%, 100%, 0.2);
  }
  body[data-ds-dark-theme][data-dsh-flow] [data-composer-card]:hover,
  body[data-ds-dark-theme][data-dsh-flow] [data-composer-card]:focus-within {
    background: hsla(0, 0%, 100%, calc(var(--dsh-flow-card-alpha-hover, 0.36) * 0.34)) !important;
    border-color: hsla(0, 0%, 100%, 0.25);
  }

  /* ---- settings row -------------------------------------------------- */
  .dsh-flow-row {
    display: flex; flex-direction: column; gap: 14px; padding: 16px 0;
    border-bottom: 1px solid var(--dsw-alias-border-l2);
    /* The accent used by every control in this row. --dsw-alias-brand-primary
       is the neutral ink scale, NOT the brand blue, so resolve the real accent
       token first and fall back to DeepSeek's #4176e6 when it is absent. */
    --dsh-flow-accent: var(--dsw-alias-brand-primary-new-color, #4176e6);
  }
  .dsh-flow-header { display: flex; flex-direction: column; gap: 4px; }
  .dsh-flow-title-row {
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; min-height: 22px;
  }
  .dsh-flow-title {
    color: var(--dsw-alias-label-primary);
    font-size: 14px; font-weight: 400; line-height: 22px;
  }
  .dsh-flow-desc {
    color: var(--dsw-alias-label-tertiary);
    font-size: 12px; font-weight: 400; line-height: 18px;
  }
  .dsh-flow-preview {
    position: relative; overflow: hidden; flex: none; width: 100%; height: 120px;
    border: 1px solid var(--dsw-alias-border-l2);
    border-radius: 12px;
    background: linear-gradient(180deg, #9cc1e7 0%, #f9f8f8 72%);
  }
  .dsh-flow-preview-canvas {
    position: absolute; inset: 0; width: 100%; height: 100%; display: block;
  }
  .dsh-flow-preview-scrim {
    position: absolute; inset: 0;
    background: rgba(249, 248, 248, var(--dsh-flow-preview-scrim, 0.06));
  }
  .dsh-flow-preview-badge {
    position: absolute; right: 8px; bottom: 8px;
    padding: 1px 8px; border-radius: 999px;
    background: rgba(15, 23, 42, 0.45); color: #fff;
    font-size: 11px; line-height: 17px;
    backdrop-filter: blur(4px);
  }
  .dsh-flow-slider-row { display: flex; align-items: center; gap: 10px; }
  .dsh-flow-slider-label {
    flex: 0 0 96px;
    color: var(--dsw-alias-label-primary);
    font-size: 13px; line-height: 1.5;
  }
  .dsh-flow-slider {
    flex: 1; min-width: 0; height: 18px; margin: 0;
    background: 0 0; cursor: pointer;
    -webkit-appearance: none; appearance: none;
  }
  /* NOTE: --dsw-alias-brand-primary is the *neutral* ink scale (#0f1115 in the
     light theme), not the brand blue — filling a track with it paints the
     control black. The real accent is brand-primary-new-color (#4176e6). */
  .dsh-flow-slider::-webkit-slider-runnable-track {
    height: 4px; border-radius: 2px;
    background: linear-gradient(90deg,
      var(--dsh-flow-accent) var(--dsh-flow-fill, 0%),
      var(--dsw-alias-border-l3) var(--dsh-flow-fill, 0%));
  }
  .dsh-flow-slider::-moz-range-track {
    height: 4px; border-radius: 2px; background: var(--dsw-alias-border-l3);
  }
  .dsh-flow-slider::-moz-range-progress {
    height: 4px; border-radius: 2px; background: var(--dsh-flow-accent);
  }
  .dsh-flow-slider::-webkit-slider-thumb {
    -webkit-appearance: none; appearance: none;
    width: 14px; height: 14px; margin-top: -5px;
    border: 2px solid var(--dsh-flow-accent); border-radius: 50%;
    background: #fff;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsh-flow-accent) 14%, transparent),
                0 1px 3px rgba(0, 0, 0, 0.28);
  }
  .dsh-flow-slider::-moz-range-thumb {
    width: 14px; height: 14px;
    border: 2px solid var(--dsh-flow-accent); border-radius: 50%;
    background: #fff;
  }
  .dsh-flow-slider:focus-visible::-webkit-slider-thumb {
    outline: 2px solid var(--dsh-flow-accent); outline-offset: 2px;
  }
  .dsh-flow-slider-value {
    flex: 0 0 52px; text-align: right;
    color: var(--dsw-alias-label-secondary);
    font-size: 13px; line-height: 1.5; font-variant-numeric: tabular-nums;
  }
  .dsh-flow-switch-row { display: flex; align-items: center; gap: 10px; }
  .dsh-flow-switch {
    position: relative; flex: none; width: 40px; height: 22px; padding: 0;
    border: none; border-radius: 11px; cursor: pointer;
    background: var(--dsw-alias-border-l3);
    transition: background-color .15s;
  }
  .dsh-flow-switch[aria-checked="true"] { background: var(--dsh-flow-accent); }
  .dsh-flow-switch:focus-visible {
    outline: 2px solid var(--dsh-flow-accent); outline-offset: 2px;
  }
  .dsh-flow-switch-knob {
    position: absolute; top: 3px; left: 3px;
    width: 16px; height: 16px; border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.28);
    transition: transform .15s;
  }
  .dsh-flow-switch[aria-checked="true"] .dsh-flow-switch-knob {
    transform: translate(18px);
  }
  .dsh-flow-error {
    color: var(--dsw-alias-label-error);
    font-size: 12px; line-height: 1.5;
  }
  @media (prefers-reduced-motion: reduce) {
    .dsh-flow-switch, .dsh-flow-switch-knob { transition: none; }
  }
`

    function ensureStyle() {
      // Idempotent: one <style> per page. The attribute is written with
      // setAttribute so the lookup must use a quoted value — an unquoted
      // attribute selector containing "/" is a parse error and would throw
      // out of here, leaving the sheet (and the composer glass) unapplied.
      const selector = `style[data-plugin-css="${STYLE_ID}"]`
      let existing = null
      try {
        existing = document.querySelector(selector)
      } catch {
        existing = null
      }
      if (existing !== null) {
        // Keep the tag but refresh its contents, so a hot-reloaded bundle
        // never runs against a stale copy of the rules.
        if (existing.textContent !== CSS) existing.textContent = CSS
        return
      }
      const tag = document.createElement('style')
      tag.setAttribute('data-plugin-css', STYLE_ID)
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    const ACTIVE_ATTR = 'data-dsh-flow'

    /** Owns the canvas, the GL program and the animation loop. */
    class FlowPainter {
      constructor() {
        this.layer = null
        this.canvas = null
        this.gl = null
        this.program = null
        this.uniforms = {}
        this.raf = 0
        this.startedAt = 0
        this.visible = true
        this.resizeObserver = null
        this.intersection = null
        this.saved = new Map()
        this.active = false
        this.boundTick = this.tick.bind(this)
      }

      /** Create (or recreate) the GL surface and start rendering. */
      start() {
        ensureStyle()
        if (!this.layer) {
          this.layer = document.createElement('div')
          this.layer.className = 'dsh-flow-layer'
          this.canvas = document.createElement('canvas')
          this.canvas.setAttribute('aria-hidden', 'true')
          this.layer.appendChild(this.canvas)
          this.scrim = document.createElement('div')
          this.scrim.className = 'dsh-flow-scrim'
        }
        if (!this.gl) {
          const gl = this.canvas.getContext('webgl2', {
            alpha: false,
            antialias: false,
            depth: false,
            stencil: false,
            premultipliedAlpha: false,
            powerPreference: 'low-power',
          })
          if (!gl) {
            // No WebGL2: fall back to the CSS gradient so the look degrades
            // gracefully instead of leaving a blank page.
            this.layer.style.background =
              'linear-gradient(180deg, #9cc1e7 0%, #f9f8f8 72%)'
            this.gl = null
            this.mount()
            return
          }
          this.gl = gl
          this.buildProgram()
        }
        this.mount()
        this.startLoop()
      }

      buildProgram() {
        const gl = this.gl
        const compile = (type, source) => {
          const shader = gl.createShader(type)
          gl.shaderSource(shader, source)
          gl.compileShader(shader)
          if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('[dsh-deepseek-flow] shader compile failed:', gl.getShaderInfoLog(shader))
            gl.deleteShader(shader)
            return null
          }
          return shader
        }
        const vs = compile(gl.VERTEX_SHADER, VERTEX_SHADER)
        const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
        if (!vs || !fs) return
        const program = gl.createProgram()
        gl.attachShader(program, vs)
        gl.attachShader(program, fs)
        gl.linkProgram(program)
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
          console.error('[dsh-deepseek-flow] program link failed:', gl.getProgramInfoLog(program))
          return
        }
        gl.useProgram(program)
        this.program = program

        const buffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
        const position = gl.getAttribLocation(program, 'a_position')
        gl.enableVertexAttribArray(position)
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

        for (const name of [
          'u_time', 'u_pixelRatio', 'u_resolution', 'u_scale', 'u_rotation',
          'u_color1', 'u_color2', 'u_color3', 'u_color4', 'u_color5', 'u_color6',
          'u_colorCount', 'u_grain', 'u_proportion', 'u_softness', 'u_shape',
          'u_shapeScale', 'u_distortion', 'u_swirl', 'u_swirlIterations', 'u_offset',
        ]) {
          this.uniforms[name] = gl.getUniformLocation(program, name)
        }
        this.startedAt = performance.now()
      }

      /**
       * Bind this painter to an already-existing canvas (used by the settings
       * preview card, which owns its own small GL surface and never mounts the
       * full-viewport layers).
       * @param canvas - the target canvas element.
       * @returns whether a GL context could be created.
       */
      attach(canvas) {
        ensureStyle()
        this.canvas = canvas
        const gl = canvas.getContext('webgl2', {
          alpha: false,
          antialias: false,
          depth: false,
          stencil: false,
          premultipliedAlpha: false,
          powerPreference: 'low-power',
        })
        if (!gl) return false
        this.gl = gl
        this.buildProgram()
        this.detached = true
        this.active = true
        this.resizeDetached()
        return true
      }

      /** Size a detached preview canvas from its CSS box. */
      resizeDetached() {
        if (!this.gl || !this.canvas) return
        const rect = this.canvas.getBoundingClientRect()
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
        const width = Math.max(1, Math.round((rect.width || 320) * dpr))
        const height = Math.max(1, Math.round((rect.height || 120) * dpr))
        if (this.canvas.width !== width || this.canvas.height !== height) {
          this.canvas.width = width
          this.canvas.height = height
          this.gl.viewport(0, 0, width, height)
        }
        this.dpr = dpr
      }

      /** Draw exactly one frame (preview path, driven by knob changes). */
      redraw() {
        if (!this.gl) return
        this.resizeDetached()
        this.draw(performance.now())
      }

      mount() {
        if (!this.layer.isConnected) {
          document.body.appendChild(this.layer)
          document.body.appendChild(this.scrim)
        }
        document.body.setAttribute(ACTIVE_ATTR, '')
        this.active = true
        this.resize()
        window.addEventListener('resize', this.onResize)
      }

      onResize = () => this.resize()

      resize() {
        if (this.detached) {
          this.resizeDetached()
          return
        }
        if (!this.gl || !this.canvas) return
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
        const width = Math.max(1, Math.round(window.innerWidth * dpr))
        const height = Math.max(1, Math.round(window.innerHeight * dpr))
        if (this.canvas.width === width && this.canvas.height === height) return
        this.canvas.width = width
        this.canvas.height = height
        this.gl.viewport(0, 0, width, height)
        this.dpr = dpr
        if (!this.raf) this.draw(performance.now())
      }

      startLoop() {
        if (this.raf) return
        const tick = () => {
          this.raf = 0
          if (!this.active || document.hidden) return
          this.draw(performance.now())
          this.raf = requestAnimationFrame(tick)
        }
        this.boundTick = tick
        this.raf = requestAnimationFrame(tick)
      }

      stopLoop() {
        if (this.raf) cancelAnimationFrame(this.raf)
        this.raf = 0
      }

      tick() {
        this.boundTick()
      }

      draw(now) {
        const gl = this.gl
        if (!gl || !this.program || !this.canvas) return
        const props = SITE_PROPS
        const settings = state.value
        const intensity = Math.max(0, Math.min(1, settings.intensity / 100))
        const colors = props.colors.map(hexToRgb)
        const u = this.uniforms

        gl.useProgram(this.program)
        gl.uniform1f(u.u_scale, props.scale)
        gl.uniform2f(u.u_offset, props.offsetX / 100, props.offsetY / 100)
        gl.uniform1f(u.u_rotation, props.rotation / 90)
        gl.uniform4f(u.u_color1, colors[0][0], colors[0][1], colors[0][2], 1)
        gl.uniform4f(u.u_color2, colors[1][0], colors[1][1], colors[1][2], 1)
        gl.uniform4f(u.u_color3, colors[2][0], colors[2][1], colors[2][2], 1)
        gl.uniform4f(u.u_color4, 0, 0, 0, 1)
        gl.uniform4f(u.u_color5, 0, 0, 0, 1)
        gl.uniform4f(u.u_color6, 0, 0, 0, 1)
        gl.uniform1f(u.u_colorCount, props.colors.length)
        gl.uniform1f(u.u_grain, props.grain)
        gl.uniform1f(u.u_proportion, props.proportion / 100)
        gl.uniform1f(u.u_softness, props.softness / 100)
        gl.uniform1f(u.u_shape, SHAPE_INDEX[props.shape])
        gl.uniform1f(u.u_shapeScale, props.shapeScale / 100)
        // "intensity" scales the two motion terms: at 0 the field is frozen
        // into the site's resting frame, at 100 it matches the site exactly.
        gl.uniform1f(u.u_distortion, (props.distortion / 100) * intensity)
        gl.uniform1f(u.u_swirl, (props.swirl / 50) * intensity)
        gl.uniform1f(u.u_swirlIterations, props.swirlIterations)

        // The live layer follows the wall clock so the motion never jumps when
        // a knob changes; the detached preview keeps its own short timeline.
        const elapsed = this.detached
          ? ((now - this.startedAt) * 0.001) * 0.35 * (settings.speed / 14)
          : (now - this.startedAt) * 0.001 * (settings.speed / 100)
        gl.uniform1f(u.u_time, elapsed)
        gl.uniform1f(u.u_pixelRatio, this.dpr || 1)
        gl.uniform2f(u.u_resolution, this.canvas.width, this.canvas.height)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      }

      /** Push the current settings onto the DOM without rebuilding GL. */
      applySettings() {
        const settings = state.value
        if (!this.active) return
        document.body.style.setProperty('--dsh-flow-scrim', String((settings.scrim || 0) / 100))
        document.body.style.setProperty('--dsh-flow-opacity', String((settings.opacity ?? 100) / 100))
        // Composer glass: the card fill is a white alpha, so percent -> 0..1.
        const cardAlpha = Math.max(0, Math.min(100, settings.cardOpacity ?? 20)) / 100
        document.body.style.setProperty('--dsh-flow-card-alpha', String(cardAlpha))
        // Hover/focus lift mirrors the site's .2 -> .36 ratio.
        document.body.style.setProperty(
          '--dsh-flow-card-alpha-hover',
          String(Math.min(1, cardAlpha * 1.8)),
        )
        if (this.scrim) this.scrim.style.display = settings.scrim > 0 ? '' : 'none'
      }

      dispose() {
        this.stopLoop()
        window.removeEventListener('resize', this.onResize)
        if (this.intersection) {
          this.intersection.disconnect()
          this.intersection = null
        }
        if (this.gl) {
          const lose = this.gl.getExtension('WEBGL_lose_context')
          if (lose) lose.loseContext()
        }
        this.gl = null
        this.program = null
        this.canvas = null
        this.active = false
        // A detached preview owns no body-level state: it must not clear the
        // attributes and variables the live wallpaper installed.
        if (this.detached) return
        if (this.layer) this.layer.remove()
        if (this.scrim) this.scrim.remove()
        this.layer = null
        this.scrim = null
        document.body.removeAttribute(ACTIVE_ATTR)
        document.body.style.removeProperty('--dsh-flow-scrim')
        document.body.style.removeProperty('--dsh-flow-opacity')
        document.body.style.removeProperty('--dsh-flow-card-alpha')
        document.body.style.removeProperty('--dsh-flow-card-alpha-hover')
        for (const [prop, value] of this.saved) document.body.style.setProperty(prop, value)
        this.saved.clear()
      }
    }

    const painter = new FlowPainter()

    function syncPainter() {
      const settings = state.value
      if (settings.enabled) {
        painter.start()
        painter.applySettings()
      } else if (painter.active) {
        painter.dispose()
      }
    }

    //#region settings row ---------------------------------------------------
    const react = require('react')
    const jsx = require('react/jsx-runtime')

    const SLIDERS = [
      { name: 'speed', min: 0, max: 100, step: 1, unit: 'num', labelKey: 'flow.speed' },
      { name: 'intensity', min: 0, max: 100, step: 1, unit: 'percent', labelKey: 'flow.intensity' },
      { name: 'opacity', min: 0, max: 100, step: 5, unit: 'percent', labelKey: 'flow.opacity' },
      { name: 'scrim', min: 0, max: 100, step: 5, unit: 'percent', labelKey: 'flow.scrim' },
      { name: 'cardOpacity', min: 0, max: 100, step: 5, unit: 'percent', labelKey: 'flow.cardOpacity' },
    ]

    /** Paint the filled fraction of a range track (webkit has no progress pseudo). */
    function syncTrackFill(el, spec) {
      const span = spec.max - spec.min
      const pct = span === 0 ? 0 : ((Number(el.value) - spec.min) / span) * 100
      el.style.setProperty('--dsh-flow-fill', `${pct}%`)
    }

    function formatValue(spec, value) {
      if (spec.unit === 'percent') return `${Math.round(value)}%`
      return String(Math.round(value))
    }

    /**
     * A stepped range control. Dragging updates local state and pushes the knob
     * straight into the live shader; release commits once through the host route.
     */
    function FlowSlider({ spec, label, value, onLive, onCommit }) {
      const [local, setLocal] = react.useState(value)
      const localRef = react.useRef(value)
      const dragging = react.useRef(false)
      const liveRef = react.useRef(onLive)
      const commitRef = react.useRef(onCommit)
      liveRef.current = onLive
      commitRef.current = onCommit

      react.useEffect(() => {
        if (!dragging.current && localRef.current !== value) {
          localRef.current = value
          setLocal(value)
        }
      }, [value])

      const handleLive = (event) => {
        dragging.current = true
        const next = Number(event.currentTarget.value)
        localRef.current = next
        setLocal(next)
        syncTrackFill(event.currentTarget, spec)
        liveRef.current(spec.name, next)
      }
      const handleCommit = () => {
        if (!dragging.current) return
        dragging.current = false
        commitRef.current()
      }

      return jsx.jsxs('div', {
        className: 'dsh-flow-slider-row',
        children: [
          jsx.jsx('span', { className: 'dsh-flow-slider-label', children: label }),
          jsx.jsx('input', {
            type: 'range',
            className: 'dsh-flow-slider',
            ref: (el) => {
              if (el) syncTrackFill(el, spec)
            },
            min: spec.min,
            max: spec.max,
            step: spec.step,
            value: String(local),
            'aria-label': label,
            onInput: handleLive,
            onPointerUp: handleCommit,
            onKeyUp: (event) => {
              if (
                event.key.startsWith('Arrow') ||
                ['Home', 'End', 'PageUp', 'PageDown'].includes(event.key)
              ) {
                handleCommit()
              }
            },
            onBlur: handleCommit,
          }),
          jsx.jsx('span', {
            className: 'dsh-flow-slider-value',
            children: formatValue(spec, local),
          }),
        ],
      })
    }

    /**
     * The General-settings row: a live mini canvas preview plus the four knobs
     * and an enable switch. The preview runs its own tiny GL context so it shows
     * the real shader rather than a static swatch.
     */
    function FlowSettingsRow({ t }) {
      const snapshot = react.useSyncExternalStore(subscribe, getSnapshot)
      const [draft, setDraft] = react.useState(snapshot)
      const [error, setError] = react.useState('')
      const draftRef = react.useRef(snapshot)
      const editingRef = react.useRef(false)
      const editingTimer = react.useRef()
      const commitTimer = react.useRef()

      const label = (key, fallback) => {
        try {
          const text = typeof t === 'function' ? t(key) : undefined
          return typeof text === 'string' && text !== '' && text !== key ? text : fallback
        } catch {
          return fallback
        }
      }

      const markEditing = () => {
        editingRef.current = true
        clearTimeout(editingTimer.current)
        editingTimer.current = window.setTimeout(() => {
          editingRef.current = false
        }, 600)
      }

      // Adopt external changes unless the user is mid-drag.
      react.useEffect(() => {
        if (editingRef.current) return
        draftRef.current = snapshot
        setDraft(snapshot)
      }, [snapshot])

      const onLive = react.useCallback((key, value) => {
        const next = { ...draftRef.current, [key]: value }
        draftRef.current = next
        markEditing()
        // Push straight into the live painter: no round trip while dragging.
        state.value = { ...state.value, [key]: value }
        notify()
      }, [])

      const commit = react.useCallback(() => {
        clearTimeout(commitTimer.current)
        commitTimer.current = window.setTimeout(async () => {
          commitTimer.current = undefined
          const result = await saveSettings(draftRef.current)
          setError(result === 'ok' ? '' : label('flow.saveFailed', '保存失败'))
        }, 120)
      }, [])

      react.useEffect(() => () => {
        clearTimeout(editingTimer.current)
        editingRef.current = false
        if (commitTimer.current !== undefined) {
          clearTimeout(commitTimer.current)
          saveSettings(draftRef.current)
        }
      }, [])

      const toggleEnabled = () => {
        const next = { ...draftRef.current, enabled: !draftRef.current.enabled }
        draftRef.current = next
        setDraft(next)
        saveSettings(next).then((result) => {
          setError(result === 'ok' ? '' : label('flow.saveFailed', '保存失败'))
        })
      }

      // The preview card runs its own tiny GL surface, so what the sliders show
      // is the real shader rather than a hand-drawn swatch.
      const previewCanvas = react.useRef(null)
      const previewPainter = react.useRef(null)
      const previewScrim = react.useRef(null)

      react.useEffect(() => {
        const canvas = previewCanvas.current
        if (!canvas) return undefined
        const mini = new FlowPainter()
        if (!mini.attach(canvas)) {
          // No WebGL2 in this renderer: the card keeps its CSS gradient.
          return undefined
        }
        previewPainter.current = mini
        mini.redraw()
        const onResize = () => mini.redraw()
        window.addEventListener('resize', onResize)
        return () => {
          window.removeEventListener('resize', onResize)
          previewPainter.current = null
          mini.dispose()
        }
      }, [])

      // Re-drive the preview shader whenever a knob changes.
      react.useEffect(() => {
        if (previewPainter.current) previewPainter.current.redraw()
      }, [draft.speed, draft.intensity, draft.opacity])

      // Scrim is a pure CSS veil; paint it on the card directly.
      react.useEffect(() => {
        const el = previewScrim.current
        if (!el) return
        el.style.setProperty('--dsh-flow-preview-scrim', String((draft.scrim || 0) / 100))
      }, [draft.scrim])

      return jsx.jsxs('div', {
        className: 'dsh-flow-row',
        children: [
          jsx.jsxs('div', {
            className: 'dsh-flow-header',
            children: [
              jsx.jsxs('div', {
                className: 'dsh-flow-title-row',
                children: [
                  jsx.jsx('div', {
                    className: 'dsh-flow-title',
                    children: label('flow.title', 'DeepSeek 流动背景'),
                  }),
                  jsx.jsx('button', {
                    type: 'button',
                    className: 'dsh-flow-switch',
                    role: 'switch',
                    'aria-checked': draft.enabled ? 'true' : 'false',
                    'aria-label': label('flow.enabled', '启用流动背景'),
                    onClick: toggleEnabled,
                    children: jsx.jsx('span', { className: 'dsh-flow-switch-knob' }),
                  }),
                ],
              }),
              jsx.jsx('div', {
                className: 'dsh-flow-desc',
                children: label(
                  'flow.description',
                  '复刻 deepseek.com 首屏的流动光场：实时着色器渲染，不是图片',
                ),
              }),
            ],
          }),
          jsx.jsxs('div', {
            className: 'dsh-flow-preview',
            children: [
              jsx.jsx('canvas', { ref: previewCanvas, className: 'dsh-flow-preview-canvas' }),
              jsx.jsx('div', { ref: previewScrim, className: 'dsh-flow-preview-scrim' }),
              jsx.jsx('span', {
                className: 'dsh-flow-preview-badge',
                children: label('flow.previewBadge', '实时预览'),
              }),
            ],
          }),
          ...SLIDERS.map((spec) =>
            jsx.jsx(
              FlowSlider,
              {
                spec,
                label: label(spec.labelKey, spec.labelKey),
                value: draft[spec.name] ?? 0,
                onLive,
                onCommit: commit,
              },
              spec.name,
            ),
          ),
          error !== '' && jsx.jsx('div', { className: 'dsh-flow-error', children: error }),
        ],
      })
    }
    //#endregion

    /**
     * Client plugin body: keep the canvas in sync with the persisted section and
     * register the General-settings row.
     * @param ctx - client cordis context.
     */
    function apply(ctx) {
      state.listeners.add(syncPainter)
      ctx.effect(() => () => {
        state.listeners.delete(syncPainter)
        painter.dispose()
      }, 'dsh-deepseek-flow: background canvas')

      if (ctx.locale && typeof ctx.locale.register === 'function') {
        ctx.effect(
          () => ctx.locale.register('dsh-flow', { zh: ZH, en: EN }),
          'dsh-deepseek-flow: dictionaries',
        )
      }

      if (ctx.slots && typeof ctx.slots.register === 'function') {
        ctx.slots.inject('settings.general.item', () =>
          ctx.slots.register(
            {
              name: 'settings.general.item',
              id: 'dsh-deepseek-flow',
              order: 640,
              locale: 'dsh-flow',
            },
            FlowSettingsRow,
          ),
        )
      }

      loadSettings()
      syncPainter()
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) painter.stopLoop()
        else if (painter.active) painter.startLoop()
      })
    }

    const ZH = {
      'flow.title': 'DeepSeek 流动背景',
      'flow.description': '复刻 deepseek.com 首屏的流动光场：实时着色器渲染，不是图片',
      'flow.speed': '流动速度',
      'flow.intensity': '形变强度',
      'flow.opacity': '壁纸不透明度',
      'flow.scrim': '可读性薄纱',
      'flow.cardOpacity': '输入框玻璃',
      'flow.previewBadge': '实时预览',
      'flow.enabled': '启用流动背景',
      'flow.saveFailed': '保存失败，请重试',
    }

    const EN = {
      'flow.title': 'DeepSeek Flow Background',
      'flow.description':
        'The hero flow field from deepseek.com, rendered live by a shader — not an image',
      'flow.speed': 'Flow speed',
      'flow.intensity': 'Distortion',
      'flow.opacity': 'Wallpaper opacity',
      'flow.scrim': 'Readability veil',
      'flow.cardOpacity': 'Composer glass',
      'flow.previewBadge': 'Live preview',
      'flow.enabled': 'Enable flow background',
      'flow.saveFailed': 'Save failed, please retry',
    }

    exports.apply = apply
    exports.inject = ['slots', 'locale']
    exports.FlowSettingsRow = FlowSettingsRow
    return module.exports
  },
})
