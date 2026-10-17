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
        panelOpacity: 18,
        darkMode: 'auto',
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

    async function saveSettings(patch) {
      const next = { ...state.value, ...patch }
      state.value = next
      notify()
      try {
        await fetch(API, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(next),
        })
      } catch (error) {
        console.error('[dsh-deepseek-flow] save failed', error)
      }
    }

    const STYLE_ID = 'dsh-deepseek-flow/style'
    const CSS = `
  /* The WebGL canvas sits behind everything, above the app's own page fill. */
  .dsh-flow-layer {
    position: fixed; inset: 0; z-index: -2; pointer-events: none;
    overflow: hidden;
    background: #f9f8f8;
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
`

    function ensureStyle() {
      if (document.querySelector(`style[data-plugin-css=${JSON.stringify(STYLE_ID)}]`)) return
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

        const elapsed = (now - this.startedAt) * 0.001 * (settings.speed / 100)
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
        const scrimVisible = settings.scrim > 0
        if (this.scrim) this.scrim.style.display = scrimVisible ? '' : 'none'
        const glassOn = settings.panelOpacity < 100
        if (glassOn) document.body.setAttribute('data-dsh-flow-glass', '')
        else document.body.removeAttribute('data-dsh-flow-glass')
      }

      dispose() {
        this.stopLoop()
        window.removeEventListener('resize', this.onResize)
        if (this.intersection) {
          this.intersection.disconnect()
          this.intersection = null
        }
        if (this.layer) this.layer.remove()
        if (this.scrim) this.scrim.remove()
        this.layer = null
        this.scrim = null
        this.canvas = null
        if (this.gl) {
          const lose = this.gl.getExtension('WEBGL_lose_context')
          if (lose) lose.loseContext()
        }
        this.gl = null
        this.program = null
        document.body.removeAttribute(ACTIVE_ATTR)
        document.body.removeAttribute('data-dsh-flow-glass')
        for (const [prop, value] of this.saved) document.body.style.setProperty(prop, value)
        this.saved.clear()
        this.active = false
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

    /**
     * Client plugin body: keep the canvas in sync with the persisted section.
     * @param ctx - client cordis context.
     */
    function apply(ctx) {
      const unsubscribe = () => state.listeners.delete(syncPainter)
      state.listeners.add(syncPainter)
      ctx.effect(() => () => {
        unsubscribe()
        painter.dispose()
      }, 'dsh-deepseek-flow: background canvas')
      loadSettings()
      syncPainter()
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) painter.stopLoop()
        else if (painter.active) painter.startLoop()
      })
    }

    exports.apply = apply
    exports.inject = []
    exports.FlowSettingsRow = null
    return module.exports
  },
})
