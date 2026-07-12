import { useEffect, useRef } from 'react'
import './ExposureTriangleExplorer.css'

interface Preset {
  name: string
  goal: string
  ai: number
  si: number
  isoi: number
  required: number
  scene: string
}

export default function ExposureTriangleExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const apSliderRef = useRef<HTMLInputElement>(null)
  const shSliderRef = useRef<HTMLInputElement>(null)
  const isSliderRef = useRef<HTMLInputElement>(null)
  const apValRef = useRef<HTMLSpanElement>(null)
  const shValRef = useRef<HTMLSpanElement>(null)
  const isValRef = useRef<HTMLSpanElement>(null)
  const readoutRef = useRef<HTMLSpanElement>(null)
  const sceneTagRef = useRef<HTMLSpanElement>(null)
  const noteRef = useRef<HTMLDivElement>(null)
  const mIconRef = useRef<HTMLSpanElement>(null)
  const mStateRef = useRef<HTMLSpanElement>(null)
  const mSubRef = useRef<HTMLSpanElement>(null)
  const mMarkerRef = useRef<HTMLDivElement>(null)
  const meterLiveRef = useRef<HTMLDivElement>(null)
  const autoToggleRef = useRef<HTMLInputElement>(null)
  const pauseToggleRef = useRef<HTMLInputElement>(null)
  const presetBtnsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const cv = canvasRef.current!
    const ctx = cv.getContext('2d')!
    const apSlider = apSliderRef.current!
    const shSlider = shSliderRef.current!
    const isSlider = isSliderRef.current!
    const apVal = apValRef.current!
    const shVal = shValRef.current!
    const isVal = isValRef.current!
    const readout = readoutRef.current!
    const sceneTag = sceneTagRef.current!
    const note = noteRef.current!
    const mIcon = mIconRef.current!
    const mState = mStateRef.current!
    const mSub = mSubRef.current!
    const mMarker = mMarkerRef.current!
    const meterLive = meterLiveRef.current!
    const autoToggle = autoToggleRef.current!
    const pauseToggle = pauseToggleRef.current!
    const pWrap = presetBtnsRef.current!

    // ---------- Data (real full-stop values) ----------
    const apertureVals = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16] // index 0..7, low f = more light
    const shutterLabels = [
      '1s', '1/2', '1/4', '1/8', '1/15', '1/30', '1/60', '1/125', '1/250', '1/500', '1/1000',
    ]
    const shutterSpoken = [
      '1 second', '1/2 second', '1/4 second', '1/8 second', '1/15 second', '1/30 second',
      '1/60 second', '1/125 second', '1/250 second', '1/500 second', '1/1000 second',
    ]
    const shutterSecs = [1, 0.5, 0.25, 0.125, 1 / 15, 1 / 30, 1 / 60, 1 / 125, 1 / 250, 1 / 500, 1 / 1000]
    const isoVals = [100, 200, 400, 800, 1600, 3200, 6400] // index 0..6, high = more light

    interface ControlState {
      ai: number
      si: number
      isoi: number
      required: number
      auto: boolean
      paused: boolean
      last: 'aperture' | 'shutter' | 'iso' | null
      scene: string
    }

    // Light contribution in stops (higher = more light captured):
    //   aperture: 7 - ai   |  shutter: 10 - si  |  iso: isoi
    const apLight = () => 7 - state.ai
    const shLight = () => 10 - state.si
    const isLight = () => state.isoi
    const tally = () => apLight() + shLight() + isLight()

    const state: ControlState = {
      ai: 3, si: 7, isoi: 2, required: 9, auto: false, paused: false, last: null, scene: 'Bright daylight',
    }

    // ---------- Presets ----------
    // Each lands on a correct exposure (tally === required).
    const presets: Preset[] = [
      {
        name: 'Blur the background', goal: 'Wide aperture for a soft, out-of-focus backdrop.',
        ai: 1, si: 7, isoi: 0, required: 9, scene: 'Bright daylight',
      }, // f/2 . 1/125 . ISO100  -> 6+3+0=9
      {
        name: 'Freeze the motion', goal: 'Very fast shutter to catch the blades razor-sharp.',
        ai: 1, si: 10, isoi: 3, required: 9, scene: 'Bright daylight',
      }, // f/2 . 1/1000 . ISO800 -> 6+0+3=9
      {
        name: 'Low light, no tripod', goal: 'Dim room: keep the shutter hand-holdable, so ISO must climb.',
        ai: 2, si: 6, isoi: 4, required: 13, scene: 'Dim indoor',
      }, // f/2.8 . 1/60 . ISO1600 -> 5+4+4=13
    ]

    // ---------- Control helpers ----------
    // Shift one control by a number of light-stops (+ = brighter). Returns light actually applied.
    const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)
    function shift(name: 'aperture' | 'shutter' | 'iso', light: number) {
      if (name === 'aperture') {
        const t = clamp(state.ai - light, 0, 7)
        const a = state.ai - t
        state.ai = t
        return a
      }
      if (name === 'shutter') {
        const t2 = clamp(state.si - light, 0, 10)
        const a2 = state.si - t2
        state.si = t2
        return a2
      }
      /* iso */
      const t3 = clamp(state.isoi + light, 0, 6)
      const a3 = t3 - state.isoi
      state.isoi = t3
      return a3
    }
    const partners: Record<'aperture' | 'shutter' | 'iso', ('aperture' | 'shutter' | 'iso')[]> = {
      aperture: ['shutter', 'iso'],
      shutter: ['aperture', 'iso'],
      iso: ['shutter', 'aperture'],
    }

    // Apply a manual change on `name`, then auto-compensate if enabled.
    function manualChange(name: 'aperture' | 'shutter' | 'iso', newIndex: number) {
      const before = tally()
      if (name === 'aperture') state.ai = newIndex
      else if (name === 'shutter') state.si = newIndex
      else state.isoi = newIndex
      state.last = name

      if (state.auto) {
        const added = tally() - before // light added by this change
        let remaining = -added // remove it from partners
        const list = partners[name]
        for (let i = 0; i < list.length && Math.abs(remaining) > 0.001; i++) {
          remaining -= shift(list[i], remaining)
        }
      }
      syncSliders()
      refreshUI()
    }

    function syncSliders() {
      apSlider.value = String(state.ai)
      shSlider.value = String(state.si)
      isSlider.value = String(state.isoi)
      apSlider.setAttribute('aria-valuetext', 'f/' + apertureVals[state.ai])
      shSlider.setAttribute('aria-valuetext', shutterSpoken[state.si])
      isSlider.setAttribute('aria-valuetext', 'ISO ' + isoVals[state.isoi])
    }

    // ---------- Side-effect note ----------
    function noteText() {
      const n = state.last
      if (n === 'aperture') {
        if (state.ai <= 2) return '<b>Wide aperture (f/' + apertureVals[state.ai] + ')</b> — the background is strongly blurred (shallow depth of field).'
        if (state.ai >= 5) return '<b>Narrow aperture (f/' + apertureVals[state.ai] + ')</b> — front and back stay sharp (deep depth of field).'
        return '<b>Medium aperture (f/' + apertureVals[state.ai] + ')</b> — the background is a little soft.'
      }
      if (n === 'shutter') {
        if (state.si <= 5) return '<b>Slow shutter (' + shutterLabels[state.si] + 's)</b> — the spinning blades streak into a blur.'
        if (state.si >= 8) return '<b>Fast shutter (' + shutterLabels[state.si] + 's)</b> — the motion is frozen crisp.'
        return '<b>Medium shutter (' + shutterLabels[state.si] + 's)</b> — the blades show a light streak.'
      }
      if (n === 'iso') {
        if (state.isoi >= 4) return '<b>High ISO (' + isoVals[state.isoi] + ')</b> — brighter, but grain (noise) becomes visible.'
        if (state.isoi <= 1) return '<b>Low ISO (' + isoVals[state.isoi] + ')</b> — a clean image with almost no grain.'
        return '<b>ISO ' + isoVals[state.isoi] + '</b> — a small amount of grain.'
      }
      return 'Move any slider to see its effect.'
    }

    // ---------- Meter ----------
    function refreshUI() {
      apVal.textContent = 'f/' + apertureVals[state.ai]
      shVal.textContent = shutterLabels[state.si] + 's'
      isVal.textContent = String(isoVals[state.isoi])
      readout.textContent =
        'f/' + apertureVals[state.ai] + ' · ' + shutterLabels[state.si] + 's · ISO ' + isoVals[state.isoi]
      sceneTag.textContent = state.scene
      note.innerHTML = '<span>' + noteText() + '</span>'

      const err = tally() - state.required // + = over, - = under
      // marker position: clamp to +/-5 stops across the bar
      const frac = clamp(err / 5, -1, 1)
      mMarker.style.left = 50 + frac * 46 + '%'

      let stateWord: string, sub: string, icon: string, color: string, live: string
      if (err === 0) {
        stateWord = 'Balanced'
        sub = 'exposure looks right'
        icon = '✓'
        color = 'var(--ok)'
        live = 'Exposure balanced. The photo looks correctly exposed.'
      } else if (err > 0) {
        stateWord = 'Too bright'
        icon = '☀'
        color = 'var(--over)'
        sub = '+' + err + ' stop' + (err > 1 ? 's' : '') + ' over'
        live = 'Over-exposed by ' + err + ' stop' + (err > 1 ? 's' : '') + '. The photo is too bright.'
      } else {
        const u = -err
        stateWord = 'Too dark'
        icon = '☾'
        color = 'var(--under)'
        sub = '−' + u + ' stop' + (u > 1 ? 's' : '') + ' under'
        live = 'Under-exposed by ' + u + ' stop' + (u > 1 ? 's' : '') + '. The photo is too dark.'
      }
      mIcon.textContent = icon
      mState.textContent = stateWord
      mSub.textContent = sub
      mState.style.color = color
      mMarker.style.borderColor = color
      meterLive.textContent = live
    }

    // ---------- Scene rendering ----------
    const W = cv.width
    const H = cv.height
    const bgCanvas = document.createElement('canvas')
    bgCanvas.width = W
    bgCanvas.height = H
    const bgCtx = bgCanvas.getContext('2d')!

    interface Bokeh { x: number; y: number; r: number; c: string; a: number }
    const bokeh: Bokeh[] = []
    ;(function seedBokeh() {
      const palette = ['#ffd27a', '#ffe6a1', '#a7c9ff', '#ffb3a1', '#bfe6b0', '#f6c1e0', '#c9b8ff']
      for (let i = 0; i < 14; i++) {
        bokeh.push({
          x: Math.random() * W,
          y: 20 + Math.random() * (H * 0.7),
          r: 16 + Math.random() * 40,
          c: palette[i % palette.length],
          a: 0.28 + Math.random() * 0.4,
        })
      }
    })()

    function drawBackground() {
      const g = bgCtx.createLinearGradient(0, 0, 0, H)
      g.addColorStop(0, '#2b3f57')
      g.addColorStop(0.55, '#3c5878')
      g.addColorStop(1, '#6d5544')
      bgCtx.fillStyle = g
      bgCtx.fillRect(0, 0, W, H)
      // ground band
      bgCtx.fillStyle = '#4a3b30'
      bgCtx.fillRect(0, H * 0.72, W, H * 0.28)
      // soft bokeh highlights (these smear beautifully when blurred by wide apertures)
      for (let i = 0; i < bokeh.length; i++) {
        const b = bokeh[i]
        bgCtx.globalAlpha = b.a
        bgCtx.fillStyle = b.c
        bgCtx.beginPath()
        bgCtx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
        bgCtx.fill()
      }
      bgCtx.globalAlpha = 1
    }
    drawBackground()

    // Noise tile for grain
    const noiseCanvas = document.createElement('canvas')
    noiseCanvas.width = 160
    noiseCanvas.height = 120
    const noiseCtx = noiseCanvas.getContext('2d')!
    function regenNoise() {
      const img = noiseCtx.createImageData(noiseCanvas.width, noiseCanvas.height)
      const d = img.data
      for (let i = 0; i < d.length; i += 4) {
        const v = (Math.random() * 255) | 0
        d[i] = d[i + 1] = d[i + 2] = v
        d[i + 3] = 255
      }
      noiseCtx.putImageData(img, 0, 0)
    }
    regenNoise()

    let angle = 0
    let lastT = 0
    let noiseFrame = 0
    let rafId = 0

    function drawBlades(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, base: number, smear: number) {
      const N = Math.min(44, Math.max(1, Math.round(smear / 0.05)))
      const step = N > 1 ? smear / (N - 1) : 0
      const start = base - smear / 2
      const ghostA = Math.max(0.035, Math.min(1, 1.5 / N))
      const petalCols = ['#e2624a', '#f0a63e', '#3f9e8f', '#4a72c4']
      for (let g = 0; g < N; g++) {
        const ang = start + g * step
        c.save()
        c.globalAlpha = ghostA
        c.translate(cx, cy)
        c.rotate(ang)
        for (let p = 0; p < 4; p++) {
          c.save()
          c.rotate((p * Math.PI) / 2)
          c.fillStyle = petalCols[p]
          c.beginPath()
          c.moveTo(0, 0)
          c.quadraticCurveTo(r * 0.72, -r * 0.5, r, 0)
          c.quadraticCurveTo(r * 0.55, r * 0.18, 0, 0)
          c.fill()
          c.restore()
        }
        c.restore()
      }
      // crisp hub (does not move)
      c.save()
      c.globalAlpha = 1
      c.translate(cx, cy)
      c.fillStyle = '#20242c'
      c.beginPath()
      c.arc(0, 0, r * 0.14, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = '#c9cfd6'
      c.beginPath()
      c.arc(0, 0, r * 0.06, 0, Math.PI * 2)
      c.fill()
      c.restore()
    }

    function render(t: number) {
      if (!lastT) lastT = t
      const dt = (t - lastT) / 1000
      lastT = t
      if (!state.paused) angle += dt * 1.3 // gentle continuous spin

      // 1. Background, blurred by aperture (wide = blurry, narrow = sharp)
      const blurPx = ((7 - state.ai) / 7) * 15 // f/1.4 -> ~15px, f/16 -> 0px
      ctx.clearRect(0, 0, W, H)
      ctx.save()
      ctx.filter = blurPx > 0.2 ? 'blur(' + blurPx.toFixed(1) + 'px)' : 'none'
      ctx.drawImage(bgCanvas, 0, 0)
      ctx.restore()

      // 2. Subject: pole + pinwheel (focal plane -> always sharp for depth of field)
      const cx = W * 0.5
      const cy = H * 0.44
      const r = 64
      ctx.strokeStyle = '#6b5842'
      ctx.lineWidth = 8
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(cx, cy + r * 0.1)
      ctx.lineTo(cx, H * 0.9)
      ctx.stroke()
      // motion-blur smear arc from shutter speed
      const smear = Math.min(2.9, shutterSecs[state.si] * 9)
      drawBlades(ctx, cx, cy, r, angle, smear)

      // 3. Grain overlay from ISO
      if (state.isoi > 0) {
        noiseFrame = (noiseFrame + 1) % 4
        if (noiseFrame === 0) regenNoise()
        ctx.save()
        ctx.globalAlpha = 0.05 + state.isoi * 0.05 // ISO6400 -> ~0.35
        ctx.globalCompositeOperation = 'overlay'
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(noiseCanvas, 0, 0, W, H)
        ctx.restore()
      }

      // 4. Exposure brightness overlay (over -> wash white, under -> wash black)
      const err = tally() - state.required
      if (err !== 0) {
        ctx.save()
        ctx.globalAlpha = Math.min(0.82, Math.abs(err) * 0.13)
        ctx.fillStyle = err > 0 ? '#ffffff' : '#000000'
        ctx.fillRect(0, 0, W, H)
        ctx.restore()
      }

      // 5. Viewfinder brackets (UI overlay, unaffected by exposure)
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'
      ctx.lineWidth = 2
      ctx.lineCap = 'butt'
      const m = 14
      const L = 20
      const corners: [number, number, number, number][] = [
        [m, m, 1, 1],
        [W - m, m, -1, 1],
        [m, H - m, 1, -1],
        [W - m, H - m, -1, -1],
      ]
      for (let i = 0; i < corners.length; i++) {
        const C = corners[i]
        ctx.beginPath()
        ctx.moveTo(C[0] + C[2] * L, C[1])
        ctx.lineTo(C[0], C[1])
        ctx.lineTo(C[0], C[1] + C[3] * L)
        ctx.stroke()
      }
      // center focus tick
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'
      ctx.beginPath()
      ctx.moveTo(W / 2 - 6, cy)
      ctx.lineTo(W / 2 + 6, cy)
      ctx.moveTo(W / 2, cy - 6)
      ctx.lineTo(W / 2, cy + 6)
      ctx.stroke()

      rafId = requestAnimationFrame(render)
    }

    // ---------- Events ----------
    const onApInput = () => manualChange('aperture', parseInt(apSlider.value, 10))
    const onShInput = () => manualChange('shutter', parseInt(shSlider.value, 10))
    const onIsInput = () => manualChange('iso', parseInt(isSlider.value, 10))
    apSlider.addEventListener('input', onApInput)
    shSlider.addEventListener('input', onShInput)
    isSlider.addEventListener('input', onIsInput)

    const onAutoChange = () => { state.auto = autoToggle.checked }
    const onPauseChange = () => { state.paused = pauseToggle.checked }
    autoToggle.addEventListener('change', onAutoChange)
    pauseToggle.addEventListener('change', onPauseChange)

    // Presets
    const presetButtons: HTMLButtonElement[] = []
    const presetHandlers: (() => void)[] = []
    presets.forEach((p) => {
      const b = document.createElement('button')
      b.className = 'preset'
      b.type = 'button'
      b.innerHTML = '<span class="p-name">' + p.name + '</span><br><span class="p-goal">' + p.goal + '</span>'
      const handler = () => {
        state.ai = p.ai
        state.si = p.si
        state.isoi = p.isoi
        state.required = p.required
        state.scene = p.scene
        state.last = null
        syncSliders()
        refreshUI()
        note.innerHTML = '<span><b>' + p.name + ':</b> ' + p.goal + '</span>'
      }
      b.addEventListener('click', handler)
      pWrap.appendChild(b)
      presetButtons.push(b)
      presetHandlers.push(handler)
    })

    // Respect reduced-motion: start paused
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      state.paused = true
      pauseToggle.checked = true
    }

    // Init
    syncSliders()
    refreshUI()
    rafId = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(rafId)
      apSlider.removeEventListener('input', onApInput)
      shSlider.removeEventListener('input', onShInput)
      isSlider.removeEventListener('input', onIsInput)
      autoToggle.removeEventListener('change', onAutoChange)
      pauseToggle.removeEventListener('change', onPauseChange)
      presetButtons.forEach((b, i) => {
        b.removeEventListener('click', presetHandlers[i])
        b.remove()
      })
    }
  }, [])

  return (
    <div className="exposure-explorer">
      <div className="wrap">
        <h1>The Exposure Triangle Explorer</h1>
        <p className="lede">
          Three settings control how much light reaches the photo. Each step is one <b>stop</b> — it
          doubles or halves the light. Brighten one setting and you have to darken another to keep the
          photo correctly exposed, and each change alters how the picture looks. Move the sliders and
          watch.
        </p>

        <div className="app">
          {/* SCENE */}
          <div className="stage">
            <div className="frame">
              <canvas
                ref={canvasRef}
                id="scene"
                width={520}
                height={380}
                role="img"
                aria-label="Simulated photo: a spinning pinwheel in front of a background. Its sharpness, blur, brightness and grain change with your settings."
              />
              <div className="hud">
                <span className="readout" ref={readoutRef} aria-hidden="true">f/4 · 1/125s · ISO 400</span>
                <span className="scene-tag" ref={sceneTagRef}>Bright daylight</span>
              </div>
            </div>

            {/* METER */}
            <div className="meter">
              <div className="meter-head">
                <span className="meter-icon" ref={mIconRef} aria-hidden="true">✓</span>
                <span className="meter-state" ref={mStateRef}>Balanced</span>
                <span className="meter-sub" ref={mSubRef}>exposure looks right</span>
              </div>
              <div className="bar" aria-hidden="true">
                <div className="center" />
                <div className="marker" ref={mMarkerRef} />
              </div>
              <div className="bar-labels" aria-hidden="true">
                <span>Too dark</span>
                <span>Balanced</span>
                <span>Too bright</span>
              </div>
              <div className="sr-only" ref={meterLiveRef} role="status" aria-live="polite">
                Exposure balanced. The photo looks correctly exposed.
              </div>
            </div>

            <div className="note" ref={noteRef}>
              <span>Move any slider to see its effect.</span>
            </div>
          </div>

          {/* CONTROLS */}
          <div className="panel">
            <div className="controls">
              <div className="ctrl">
                <div className="ctrl-top">
                  <span className="ctrl-name" id="apName">Aperture</span>
                  <span className="ctrl-val" ref={apValRef}>f/4</span>
                </div>
                <div className="ctrl-def">
                  How wide the lens opens. Lower f-number = more light + blurrier background (shallow{' '}
                  <b>depth&nbsp;of&nbsp;field</b>).
                </div>
                <input
                  ref={apSliderRef}
                  type="range"
                  id="apSlider"
                  min={0}
                  max={7}
                  step={1}
                  defaultValue={3}
                  aria-labelledby="apName"
                  aria-valuetext="f/4"
                />
                <div className="scale"><span>f/1.4 · wide</span><span>f/16 · narrow</span></div>
              </div>

              <div className="ctrl">
                <div className="ctrl-top">
                  <span className="ctrl-name" id="shName">Shutter speed</span>
                  <span className="ctrl-val" ref={shValRef}>1/125s</span>
                </div>
                <div className="ctrl-def">
                  How long the shutter stays open. Slower = more light + more motion blur on moving things.
                </div>
                <input
                  ref={shSliderRef}
                  type="range"
                  id="shSlider"
                  min={0}
                  max={10}
                  step={1}
                  defaultValue={7}
                  aria-labelledby="shName"
                  aria-valuetext="1/125 second"
                />
                <div className="scale"><span>1s · slow</span><span>1/1000 · fast</span></div>
              </div>

              <div className="ctrl">
                <div className="ctrl-top">
                  <span className="ctrl-name" id="isName">ISO</span>
                  <span className="ctrl-val" ref={isValRef}>400</span>
                </div>
                <div className="ctrl-def">
                  The sensor's sensitivity to light. Higher = brighter + more grain (speckly noise).
                </div>
                <input
                  ref={isSliderRef}
                  type="range"
                  id="isSlider"
                  min={0}
                  max={6}
                  step={1}
                  defaultValue={2}
                  aria-labelledby="isName"
                  aria-valuetext="ISO 400"
                />
                <div className="scale"><span>100 · clean</span><span>6400 · grainy</span></div>
              </div>

              <div className="toggles">
                <label className="switch">
                  <input ref={autoToggleRef} type="checkbox" id="autoToggle" aria-describedby="autoDesc" />
                  <span className="track" aria-hidden="true" />
                  <span>Auto-compensate exposure</span>
                </label>
                <label className="switch">
                  <input ref={pauseToggleRef} type="checkbox" id="pauseToggle" />
                  <span className="track" aria-hidden="true" />
                  <span>Pause motion</span>
                </label>
              </div>
              <div className="sr-only" id="autoDesc">
                When on, changing one setting automatically shifts another to keep the exposure balanced,
                so you can watch the trade-off.
              </div>
            </div>

            <div className="presets">
              <div className="presets-title">Try a scenario</div>
              <div className="preset-btns" ref={presetBtnsRef} />
            </div>
          </div>
        </div>

        <footer>
          A learning simulation — the scene is drawn, not a real photo. Every control works with arrow
          keys once focused.
        </footer>
      </div>
    </div>
  )
}
