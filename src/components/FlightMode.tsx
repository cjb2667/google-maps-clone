import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { startFlight, type FlightHandle } from '../lib/flight'
import { formatDistance, haversine } from '../lib/geo'
import { useMap } from '../lib/useMap'
import '../styles/flight.css'

interface FlightModeProps {
  active: boolean
  onExit: () => void
}

type Stage = 'pick-from' | 'pick-to' | 'flying'

/** 创建起降点标记 DOM(小圆徽标) */
function makeBadge(text: string, color: string): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'flight-badge'
  el.style.background = color
  el.textContent = text
  return el
}

/**
 * 飞行模式:点选起点与终点后播放电影式飞行动画(起飞→巡航→降落)
 */
export default function FlightMode({ active, onExit }: FlightModeProps) {
  const map = useMap()
  const [stage, setStage] = useState<Stage>('pick-from')
  const [distance, setDistance] = useState<number | null>(null)

  const fromRef = useRef<[number, number] | null>(null)
  const flightRef = useRef<FlightHandle | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const onExitRef = useRef(onExit)
  onExitRef.current = onExit

  useEffect(() => {
    if (!map || !active) return
    setStage('pick-from')
    setDistance(null)
    fromRef.current = null

    const onClick = (e: maplibregl.MapMouseEvent) => {
      // 飞行中点击不再选点(交互事件会触发取消,由 flight 内部处理)
      if (flightRef.current) return
      const point: [number, number] = [e.lngLat.lng, e.lngLat.lat]

      if (!fromRef.current) {
        fromRef.current = point
        markersRef.current.push(
          new maplibregl.Marker({ element: makeBadge('起', '#34A853') }).setLngLat(point).addTo(map),
        )
        setStage('pick-to')
        return
      }

      const from = fromRef.current
      markersRef.current.push(
        new maplibregl.Marker({ element: makeBadge('终', '#EA4335') }).setLngLat(point).addTo(map),
      )
      setDistance(haversine(from, point))
      setStage('flying')
      flightRef.current = startFlight(map, from, point, {
        onFinish: () => {
          flightRef.current = null
          // 一次飞行结束后回到选起点状态,可继续飞下一程
          fromRef.current = null
          markersRef.current.forEach((m) => m.remove())
          markersRef.current = []
          setStage('pick-from')
          setDistance(null)
        },
      })
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExitRef.current()
    }

    map.on('click', onClick)
    document.addEventListener('keydown', onKeyDown)
    map.getCanvas().style.cursor = 'crosshair'

    return () => {
      map.off('click', onClick)
      document.removeEventListener('keydown', onKeyDown)
      flightRef.current?.cancel()
      flightRef.current = null
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      fromRef.current = null
      map.getCanvas().style.cursor = ''
    }
  }, [map, active])

  if (!active) return null

  const hint =
    stage === 'pick-from'
      ? '点击地图选择起点'
      : stage === 'pick-to'
        ? '再点击选择终点,即刻起飞'
        : `飞行中${distance ? ` · 航程 ${formatDistance(distance)}` : ''}(拖动地图可中断)`

  return (
    <div className="flight-panel" role="status">
      <span className="flight-panel__icon">✈️</span>
      <span className="flight-panel__hint">{hint}</span>
      <button className="flight-panel__exit" onClick={onExit} type="button">
        退出
      </button>
    </div>
  )
}
