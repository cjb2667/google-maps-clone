import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import maplibregl from 'maplibre-gl'
import type { StyleSpecification } from 'maplibre-gl'
import { fetchYearlyReleases, type WaybackRelease } from '../lib/wayback'
import { useMap } from '../lib/useMap'
import '../styles/swipe.css'
import '../styles/timemachine.css'

interface TimeMachineProps {
  active: boolean
  onError: (message: string) => void
}

/** 用指定 wayback release 构造纯栅格样式 */
function waybackStyle(release: WaybackRelease): StyleSpecification {
  return {
    version: 8,
    sources: {
      wayback: {
        type: 'raster',
        tiles: [release.tileUrl],
        tileSize: 256,
        maxzoom: 19,
      },
    },
    layers: [{ id: 'wayback-tiles', type: 'raster', source: 'wayback' }],
  }
}

/**
 * 历史影像时光机:左侧显示历史卫星影像(Esri Wayback),右侧为当前底图,
 * 拖动卷帘滑块对比;底部时间轴选择年份
 */
export default function TimeMachine({ active, onError }: TimeMachineProps) {
  const map = useMap()
  const [releases, setReleases] = useState<WaybackRelease[]>([])
  const [index, setIndex] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const historyMapRef = useRef<maplibregl.Map | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const mapClipRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)
  const ratioRef = useRef(0.5)

  const applyRatio = (ratio: number) => {
    ratioRef.current = ratio
    const pct = `${ratio * 100}%`
    // 历史影像显示在滑块左侧(与卷帘对比方向相反,强调"过去在左")
    if (mapClipRef.current) mapClipRef.current.style.clipPath = `inset(0 ${100 - ratio * 100}% 0 0)`
    if (handleRef.current) {
      handleRef.current.style.left = pct
      handleRef.current.setAttribute('aria-valuenow', String(Math.round(ratio * 100)))
    }
  }

  // 激活时拉取 release 列表(缓存),默认选最早年份突出对比
  useEffect(() => {
    if (!active) return
    let cancelled = false
    fetchYearlyReleases()
      .then((list) => {
        if (cancelled) return
        setReleases(list)
        setIndex(0)
      })
      .catch(() => {
        if (!cancelled) onError('历史影像列表加载失败,请检查网络')
      })
    return () => {
      cancelled = true
    }
  }, [active, onError])

  const release = releases[index] ?? null

  // 创建/销毁历史影像地图,与主图同步相机
  useEffect(() => {
    if (!map || !active || !release || !containerRef.current) return
    let historyMap: maplibregl.Map | null = null

    historyMap = new maplibregl.Map({
      container: containerRef.current,
      style: waybackStyle(release),
      center: map.getCenter(),
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch(),
      interactive: false,
      attributionControl: false,
      maxPitch: 70,
      fadeDuration: 0,
    })
    historyMapRef.current = historyMap

    let raf = 0
    const sync = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        historyMap?.jumpTo({
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
      historyMap?.remove()
      historyMapRef.current = null
    }
    // 切换年份时不重建地图,由下方 effect 换瓦片源
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, active, releases.length > 0])

  // 年份切换:直接替换整个样式(纯栅格样式极轻,替换开销可忽略)
  useEffect(() => {
    const historyMap = historyMapRef.current
    if (!historyMap || !release) return
    historyMap.setStyle(waybackStyle(release))
  }, [release])

  useEffect(() => {
    if (active) applyRatio(0.5)
  }, [active])

  const handlePointerDown = (e: ReactPointerEvent) => {
    e.preventDefault()
    const parent = overlayRef.current
    if (!parent) return
    const rect = parent.getBoundingClientRect()
    const onMove = (ev: PointerEvent) => {
      const next = (ev.clientX - rect.left) / rect.width
      applyRatio(Math.min(0.95, Math.max(0.05, next)))
    }
    const onUp = () => {
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
    <>
      <div className="swipe-overlay" ref={overlayRef}>
        <div
          ref={(node) => {
            containerRef.current = node
            mapClipRef.current = node
          }}
          className="swipe-overlay__map"
          style={{ clipPath: `inset(0 ${100 - ratioRef.current * 100}% 0 0)` }}
        />
        <div
          ref={handleRef}
          className="swipe-overlay__handle"
          style={{ left: `${ratioRef.current * 100}%` }}
          onPointerDown={handlePointerDown}
          role="slider"
          aria-label="历史影像对比滑块"
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
        {/* 左右角标:标明历史/现在 */}
        {release && <div className="time-machine__badge time-machine__badge--left">{release.date}</div>}
        <div className="time-machine__badge time-machine__badge--right">现在</div>
      </div>

      {/* 底部时间轴 */}
      <div className="time-machine__timeline">
        <span className="time-machine__label">
          {release ? `${release.year} 年影像` : '加载中…'}
        </span>
        {releases.length > 0 && (
          <input
            type="range"
            className="time-machine__slider"
            min={0}
            max={releases.length - 1}
            step={1}
            value={index}
            onChange={(e) => setIndex(Number(e.target.value))}
            aria-label="选择影像年份"
          />
        )}
        {releases.length > 0 && (
          <div className="time-machine__ticks" aria-hidden>
            <span>{releases[0].year}</span>
            <span>{releases[releases.length - 1].year}</span>
          </div>
        )}
      </div>
    </>
  )
}
