import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { makeStyle, TERRAIN_EXAGGERATION, TERRAIN_SOURCE, type LayerType } from '../lib/mapConfig'
import '../styles/swipe.css'

interface SwipeCompareProps {
  /** 主地图实例 */
  map: maplibregl.Map | null
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
export default function SwipeCompare({ map, active, compareLayer, terrainOn }: SwipeCompareProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const compareMapRef = useRef<maplibregl.Map | null>(null)
  // 滑块位置(占容器宽度的比例)
  const [ratio, setRatio] = useState(0.5)

  // 创建/销毁对比地图,并与主图同步相机
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
      canvasContextAttributes: { preserveDrawingBuffer: true },
    })
    compareMapRef.current = compareMap

    // 主图相机变化时同步到对比图
    const sync = () => {
      compareMap.jumpTo({
        center: map.getCenter(),
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
      })
    }
    map.on('move', sync)

    return () => {
      map.off('move', sync)
      compareMap.remove()
      compareMapRef.current = null
    }
  }, [map, active, compareLayer])

  // 3D 地形开关同步到对比图
  useEffect(() => {
    const compareMap = compareMapRef.current
    if (!compareMap || !active) return
    const apply = () => {
      compareMap.setTerrain(
        terrainOn ? { source: TERRAIN_SOURCE, exaggeration: TERRAIN_EXAGGERATION } : null,
      )
    }
    if (compareMap.isStyleLoaded()) apply()
    else compareMap.once('load', apply)
  }, [active, terrainOn, compareLayer])

  // 拖拽滑块
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    const parent = (e.currentTarget as HTMLElement).parentElement
    if (!parent) return
    const rect = parent.getBoundingClientRect()
    const onMove = (ev: PointerEvent) => {
      const next = (ev.clientX - rect.left) / rect.width
      // 两侧各保留 5%,避免滑块被拖出可视范围
      setRatio(Math.min(0.95, Math.max(0.05, next)))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  if (!active) return null

  return (
    <div className="swipe-overlay">
      {/* 对比地图:只显示滑块右侧部分 */}
      <div
        ref={containerRef}
        className="swipe-overlay__map"
        style={{ clipPath: `inset(0 0 0 ${ratio * 100}%)` }}
      />
      {/* 卷帘滑块 */}
      <div
        className="swipe-overlay__handle"
        style={{ left: `${ratio * 100}%` }}
        onPointerDown={handlePointerDown}
        role="slider"
        aria-label="卷帘对比滑块"
        aria-valuenow={Math.round(ratio * 100)}
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
