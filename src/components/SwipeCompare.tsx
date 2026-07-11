import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import maplibregl from 'maplibre-gl'
import {
  makeStyle,
  ROADMAP_LAYER_ID,
  SATELLITE_LAYER_ID,
  setTerrainEnabled,
  type LayerType,
} from '../lib/mapConfig'
import { useMap } from '../lib/useMap'
import '../styles/swipe.css'

interface SwipeCompareProps {
  active: boolean
  /** 对比图(右侧)展示的图层,取主图当前图层的"另一个" */
  compareLayer: LayerType
  /** 3D 地形是否开启(开启时对比图同步启用地形) */
  terrainOn: boolean
}

/**
 * 卷帘对比:在主地图上方叠加第二张地图(pointer-events: none,交互穿透到主图),
 * 通过 clip-path 只显示滑块右侧部分,相机跟随主图实时同步
 */
export default function SwipeCompare({ active, compareLayer, terrainOn }: SwipeCompareProps) {
  const map = useMap()
  const containerRef = useRef<HTMLDivElement>(null)
  const compareMapRef = useRef<maplibregl.Map | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const mapClipRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)
  // 滑块位置用 ref 驱动 DOM,拖拽时不触发 React 重渲染
  const ratioRef = useRef(0.5)

  /** 把当前 ratio 同步到 clip-path / 滑块位置 / aria */
  const applyRatio = (ratio: number) => {
    ratioRef.current = ratio
    const pct = `${ratio * 100}%`
    if (mapClipRef.current) mapClipRef.current.style.clipPath = `inset(0 0 0 ${pct})`
    if (handleRef.current) {
      handleRef.current.style.left = pct
      handleRef.current.setAttribute('aria-valuenow', String(Math.round(ratio * 100)))
    }
  }

  // 创建/销毁对比地图,并与主图同步相机(图层切换不重建地图)
  useEffect(() => {
    if (!map || !active || !containerRef.current) return

    const compareMap = new maplibregl.Map({
      container: containerRef.current,
      style: makeStyle(compareLayer),
      center: map.getCenter(),
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch(),
      // 交互全部由主图承担,对比图只做展示
      interactive: false,
      attributionControl: false,
      maxPitch: 70,
      // 栅格底图无需淡入动画,减少叠绘开销
      fadeDuration: 0,
    })
    compareMapRef.current = compareMap

    // 主图相机变化时用 rAF 合并同步,避免 move 事件风暴打满双 WebGL
    let raf = 0
    const sync = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        compareMap.jumpTo({
          center: map.getCenter(),
          zoom: map.getZoom(),
          bearing: map.getBearing(),
          pitch: map.getPitch(),
        })
      })
    }
    map.on('move', sync)

    return () => {
      map.off('move', sync)
      cancelAnimationFrame(raf)
      compareMap.remove()
      compareMapRef.current = null
    }
    // compareLayer 变化时用显隐切换,不销毁重建
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, active])

  // 对比图层切换:只改 visibility,避免重建 WebGL 上下文
  useEffect(() => {
    const compareMap = compareMapRef.current
    if (!compareMap || !active) return
    const apply = () => {
      compareMap.setLayoutProperty(
        ROADMAP_LAYER_ID,
        'visibility',
        compareLayer === 'roadmap' ? 'visible' : 'none',
      )
      compareMap.setLayoutProperty(
        SATELLITE_LAYER_ID,
        'visibility',
        compareLayer === 'satellite' ? 'visible' : 'none',
      )
    }
    if (compareMap.isStyleLoaded()) apply()
    else compareMap.once('load', apply)
  }, [active, compareLayer])

  // 3D 地形开关同步到对比图(按需挂载 DEM)
  useEffect(() => {
    const compareMap = compareMapRef.current
    if (!compareMap || !active) return
    const apply = () => setTerrainEnabled(compareMap, terrainOn)
    if (compareMap.isStyleLoaded()) apply()
    else compareMap.once('load', apply)
  }, [active, terrainOn])

  // 激活时复位滑块到中间
  useEffect(() => {
    if (active) applyRatio(0.5)
  }, [active])

  // 拖拽滑块:直接改 DOM,避免每帧 setState
  const handlePointerDown = (e: ReactPointerEvent) => {
    e.preventDefault()
    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)
    const parent = overlayRef.current
    if (!parent) return
    const rect = parent.getBoundingClientRect()
    const onMove = (ev: PointerEvent) => {
      const next = (ev.clientX - rect.left) / rect.width
      // 两侧各保留 5%,避免滑块被拖出可视范围
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

  return (
    <div className="swipe-overlay" ref={overlayRef}>
      {/* 对比地图:只显示滑块右侧部分 */}
      <div
        ref={(node) => {
          containerRef.current = node
          mapClipRef.current = node
        }}
        className="swipe-overlay__map"
        style={{ clipPath: `inset(0 0 0 ${ratioRef.current * 100}%)` }}
      />
      {/* 卷帘滑块 */}
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
