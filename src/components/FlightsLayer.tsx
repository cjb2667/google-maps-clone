import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import { fetchFlights } from '../lib/flights'
import { useMap } from '../lib/useMap'
import '../styles/flights.css'

interface FlightsLayerProps {
  active: boolean
  onError: (message: string) => void
}

const SOURCE_ID = 'flights'
const LAYER_ID = 'flights-icons'
const ICON_ID = 'flight-icon'
const POLL_MS = 12_000
/** 覆盖当前视野的查询半径上限(海里) */
const MAX_RADIUS_NM = 250

const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] }

/** 用 canvas 画一个机头朝上的飞机图标(避免依赖字体字形) */
function drawPlaneIcon(size = 40): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const s = size / 24
  ctx.translate(size / 2, size / 2)
  ctx.scale(s, s)
  ctx.beginPath()
  // 简化的飞机轮廓(机头朝上,原点居中,单位 24x24)
  ctx.moveTo(0, -10)
  ctx.bezierCurveTo(1.2, -10, 1.6, -8.5, 1.6, -6.5)
  ctx.lineTo(1.6, -3)
  ctx.lineTo(10, 2)
  ctx.lineTo(10, 4)
  ctx.lineTo(1.6, 1.8)
  ctx.lineTo(1.6, 6.5)
  ctx.lineTo(4, 8.5)
  ctx.lineTo(4, 10)
  ctx.lineTo(0, 9)
  ctx.lineTo(-4, 10)
  ctx.lineTo(-4, 8.5)
  ctx.lineTo(-1.6, 6.5)
  ctx.lineTo(-1.6, 1.8)
  ctx.lineTo(-10, 4)
  ctx.lineTo(-10, 2)
  ctx.lineTo(-1.6, -3)
  ctx.lineTo(-1.6, -6.5)
  ctx.bezierCurveTo(-1.6, -8.5, -1.2, -10, 0, -10)
  ctx.closePath()
  ctx.fillStyle = '#7b1fa2'
  ctx.fill()
  ctx.lineWidth = 1.2
  ctx.strokeStyle = '#ffffff'
  ctx.stroke()
  return ctx.getImageData(0, 0, size, size)
}

/** 视野对角线一半的近似海里数,用作查询半径 */
function viewRadiusNm(map: maplibregl.Map): number {
  const b = map.getBounds()
  const center = b.getCenter()
  const corner = b.getNorthEast()
  const dLat = corner.lat - center.lat
  const dLng = (corner.lng - center.lng) * Math.cos((center.lat * Math.PI) / 180)
  const deg = Math.sqrt(dLat * dLat + dLng * dLng)
  return deg * 60 // 1 度纬度 ≈ 60 海里
}

/**
 * 实时航班图层:airplanes.live ADS-B 数据,
 * 12s 轮询当前视野,飞机图标按航向旋转,点击查看详情
 */
export default function FlightsLayer({ active, onError }: FlightsLayerProps) {
  const map = useMap()
  const [count, setCount] = useState<number | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const errorNotifiedRef = useRef(false)

  useEffect(() => {
    if (!map || !active) {
      setCount(null)
      return
    }

    if (!map.hasImage(ICON_ID)) {
      map.addImage(ICON_ID, drawPlaneIcon(), { pixelRatio: 2 })
    }
    map.addSource(SOURCE_ID, { type: 'geojson', data: EMPTY_FC })
    map.addLayer({
      id: LAYER_ID,
      type: 'symbol',
      source: SOURCE_ID,
      layout: {
        'icon-image': ICON_ID,
        'icon-size': ['interpolate', ['linear'], ['zoom'], 4, 0.7, 10, 1.1],
        'icon-rotate': ['get', 'track'],
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
      },
    })

    let timer = 0
    let controller: AbortController | null = null
    let disposed = false

    const poll = async () => {
      controller?.abort()
      controller = new AbortController()
      try {
        const center = map.getCenter()
        const radius = Math.min(MAX_RADIUS_NM, viewRadiusNm(map))
        const flights = await fetchFlights(center.lat, center.lng, radius, controller.signal)
        if (disposed) return
        const src = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined
        src?.setData({
          type: 'FeatureCollection',
          features: flights.map((f) => ({
            type: 'Feature',
            properties: {
              track: f.track,
              callsign: f.callsign,
              type: f.aircraftType,
              alt: f.altitudeM,
              speed: f.speedKmh,
            },
            geometry: { type: 'Point', coordinates: [f.lng, f.lat] },
          })),
        })
        setCount(flights.length)
        errorNotifiedRef.current = false
      } catch (err) {
        if ((err as Error).name !== 'AbortError' && !errorNotifiedRef.current) {
          errorNotifiedRef.current = true
          onError('航班数据加载失败,稍后自动重试')
        }
      }
    }

    void poll()
    timer = window.setInterval(() => void poll(), POLL_MS)
    // 视野大幅移动后立即刷新一次(moveend 节流由轮询间隔兜底)
    const onMoveEnd = () => void poll()
    map.on('moveend', onMoveEnd)

    const onClick = (
      e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] },
    ) => {
      const f = e.features?.[0]
      if (!f) return
      const p = f.properties as { callsign: string; type: string; alt: number | null; speed: number | null }
      popupRef.current?.remove()
      popupRef.current = new maplibregl.Popup({ offset: 12, closeButton: false })
        .setLngLat(e.lngLat)
        .setHTML(
          `<div class="flight-popup">` +
            `<strong>${p.callsign}</strong>` +
            `<span>${p.type}</span>` +
            `<span>高度 ${p.alt != null ? `${p.alt} 米` : '—'} · 速度 ${p.speed != null ? `${p.speed} km/h` : '—'}</span>` +
            `</div>`,
        )
        .addTo(map)
    }
    const onEnter = () => {
      map.getCanvas().style.cursor = 'pointer'
    }
    const onLeave = () => {
      map.getCanvas().style.cursor = ''
    }
    map.on('click', LAYER_ID, onClick)
    map.on('mouseenter', LAYER_ID, onEnter)
    map.on('mouseleave', LAYER_ID, onLeave)

    return () => {
      disposed = true
      window.clearInterval(timer)
      controller?.abort()
      map.off('moveend', onMoveEnd)
      map.off('click', LAYER_ID, onClick)
      map.off('mouseenter', LAYER_ID, onEnter)
      map.off('mouseleave', LAYER_ID, onLeave)
      popupRef.current?.remove()
      popupRef.current = null
      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID)
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
      map.getCanvas().style.cursor = ''
      setCount(null)
    }
  }, [map, active, onError])

  if (!active || count === null) return null

  return (
    <div className="flights-chip" role="status">
      当前视野 {count} 架航班
    </div>
  )
}
