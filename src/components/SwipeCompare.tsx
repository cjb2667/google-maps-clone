import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import maplibregl from 'maplibre-gl'
import {
  applyMapDisplay,
  loadMapStyle,
  registerMapDisplay,
  setTerrainEnabled,
  type MapDisplay,
} from '../lib/mapConfig'
import { useMap } from '../lib/useMap'
import '../styles/swipe.css'

/** 卷帘对比模式:底图(路网/卫星)、2D/3D、日/夜 */
export type SwipeMode = 'basemap' | 'terrain' | 'theme'

interface SwipeCompareProps {
  active: boolean
  /** 当前对比模式 */
  mode: SwipeMode
  onModeChange: (mode: SwipeMode) => void
  /** 主图当前展示状态 */
  mainDisplay: MapDisplay
  /** 主图 3D 地形是否开启 */
  terrainOn: boolean
}

/** 计算对比图(右侧)的展示状态:取主图对应维度的"另一面" */
function compareDisplayFor(mode: SwipeMode, main: MapDisplay): MapDisplay {
  switch (mode) {
    case 'basemap':
      return { basemap: main.basemap === 'roadmap' ? 'satellite' : 'roadmap', theme: main.theme }
    case 'terrain':
      return { ...main }
    case 'theme':
      return { basemap: 'roadmap', theme: main.theme === 'dark' ? 'light' : 'dark' }
  }
}

/** 两侧标签文案 [左(主图), 右(对比图)] */
function sideLabels(mode: SwipeMode, main: MapDisplay, terrainOn: boolean): [string, string] {
  switch (mode) {
    case 'basemap':
      return main.basemap === 'roadmap' ? ['路网', '卫星'] : ['卫星', '路网']
    case 'terrain':
      return terrainOn ? ['3D', '2D'] : ['2D', '3D']
    case 'theme':
      return main.theme === 'dark' ? ['黑夜', '白天'] : ['白天', '黑夜']
  }
}

const MODE_LABELS: Record<SwipeMode, string> = {
  basemap: '路网 / 卫星',
  terrain: '2D / 3D',
  theme: '日 / 夜',
}

/**
 * 卷帘对比:在主地图上方叠加第二张地图(pointer-events: none,交互穿透到主图),
 * 通过 clip-path 只显示滑块右侧部分,相机跟随主图实时同步。
 * 支持三种对比维度:底图、2D/3D 地形、日夜主题
 */
export default function SwipeCompare({
  active,
  mode,
  onModeChange,
  mainDisplay,
  terrainOn,
}: SwipeCompareProps) {
  const map = useMap()
  const containerRef = useRef<HTMLDivElement>(null)
  const compareMapRef = useRef<maplibregl.Map | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const mapClipRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)
  const ratioRef = useRef(0.5)

  const applyRatio = (ratio: number) => {
    ratioRef.current = ratio
    const pct = `${ratio * 100}%`
    if (mapClipRef.current) mapClipRef.current.style.clipPath = `inset(0 0 0 ${pct})`
    if (handleRef.current) {
      handleRef.current.style.left = pct
      handleRef.current.setAttribute('aria-valuenow', String(Math.round(ratio * 100)))
    }
  }

  // 创建/销毁对比地图(样式复用模块级缓存,不再重复拉取)
  useEffect(() => {
    if (!map || !active || !containerRef.current) return

    let cancelled = false
    let compareMap: maplibregl.Map | null = null
    let detachSync: (() => void) | null = null

    const init = async () => {
      try {
        // 初始展示状态仅用于首帧;后续模式/主题变化由下方 effect 切换
        const display = compareDisplayFor(mode, mainDisplay)
        const style = await loadMapStyle(display)
        if (cancelled || !containerRef.current) return

        compareMap = new maplibregl.Map({
          container: containerRef.current,
          style,
          center: map.getCenter(),
          zoom: map.getZoom(),
          bearing: map.getBearing(),
          pitch: map.getPitch(),
          interactive: false,
          attributionControl: false,
          maxPitch: 70,
          fadeDuration: 0,
        })
        registerMapDisplay(compareMap, display)
        compareMapRef.current = compareMap

        let raf = 0
        const sync = () => {
          if (raf) return
          raf = requestAnimationFrame(() => {
            raf = 0
            compareMap?.jumpTo({
              center: map.getCenter(),
              zoom: map.getZoom(),
              bearing: map.getBearing(),
              pitch: map.getPitch(),
            })
          })
        }
        map.on('move', sync)
        detachSync = () => {
          map.off('move', sync)
          cancelAnimationFrame(raf)
        }
      } catch {
        // 样式加载失败时静默;主图 onError 已有提示
      }
    }
    void init()

    return () => {
      cancelled = true
      detachSync?.()
      compareMap?.remove()
      compareMapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, active])

  // 模式 / 主图状态变化:更新对比图显隐与地形,不重建地图
  useEffect(() => {
    const compareMap = compareMapRef.current
    if (!compareMap || !active) return
    const apply = () => {
      applyMapDisplay(compareMap, compareDisplayFor(mode, mainDisplay))
      // 2D/3D 模式下对比图地形取主图的反面,其余模式与主图一致
      const compareTerrain = mode === 'terrain' ? !terrainOn : terrainOn
      setTerrainEnabled(compareMap, compareTerrain)
    }
    if (compareMap.isStyleLoaded()) apply()
    else compareMap.once('load', apply)
  }, [active, mode, mainDisplay, terrainOn])

  // 切到 2D/3D 对比且主图视角很平时,自动倾斜以突出地形差异
  useEffect(() => {
    if (!map || !active || mode !== 'terrain') return
    if (map.getPitch() < 30) map.easeTo({ pitch: 60, duration: 1200 })
  }, [map, active, mode])

  useEffect(() => {
    if (active) applyRatio(0.5)
  }, [active])

  const handlePointerDown = (e: ReactPointerEvent) => {
    e.preventDefault()
    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)
    const parent = overlayRef.current
    if (!parent) return
    const rect = parent.getBoundingClientRect()
    const onMove = (ev: PointerEvent) => {
      const next = (ev.clientX - rect.left) / rect.width
      applyRatio(Math.min(0.95, Math.max(0.05, next)))
    }
    const onUp = (ev: PointerEvent) => {
      try {
        target.releasePointerCapture(ev.pointerId)
      } catch {
        // 已释放时忽略
      }
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  if (!active) return null

  const [leftLabel, rightLabel] = sideLabels(mode, mainDisplay, terrainOn)

  return (
    <div className="swipe-overlay" ref={overlayRef}>
      <div
        ref={(node) => {
          containerRef.current = node
          mapClipRef.current = node
        }}
        className="swipe-overlay__map"
        style={{ clipPath: `inset(0 0 0 ${ratioRef.current * 100}%)` }}
      />

      {/* 对比模式切换(顶部居中分段控件) */}
      <div className="swipe-overlay__modes" role="tablist" aria-label="卷帘对比模式">
        {(Object.keys(MODE_LABELS) as SwipeMode[]).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={m === mode}
            className={`swipe-overlay__mode-btn${m === mode ? ' swipe-overlay__mode-btn--active' : ''}`}
            onClick={() => onModeChange(m)}
            type="button"
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      {/* 两侧内容标签 */}
      <span className="swipe-overlay__side-label swipe-overlay__side-label--left">{leftLabel}</span>
      <span className="swipe-overlay__side-label swipe-overlay__side-label--right">
        {rightLabel}
      </span>

      <div
        ref={handleRef}
        className="swipe-overlay__handle"
        style={{ left: `${ratioRef.current * 100}%` }}
        onPointerDown={handlePointerDown}
        role="slider"
        aria-label="卷帘对比滑块"
        aria-valuemin={5}
        aria-valuemax={95}
        aria-valuenow={Math.round(ratioRef.current * 100)}
      >
        <div className="swipe-overlay__grip">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
            <path d="M8 7l-5 5 5 5V7zm8 10l5-5-5-5v10z" />
          </svg>
        </div>
      </div>
    </div>
  )
}
