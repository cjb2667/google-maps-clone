import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import { fetchIssNow, fetchIssTrack, splitAtAntimeridian, type IssPosition } from '../lib/iss'
import { useMap } from '../lib/useMap'
import '../styles/iss.css'

interface IssLayerProps {
  active: boolean
  onError: (message: string) => void
}

const TRACK_SOURCE = 'iss-track'
const TRACK_LAYER = 'iss-track-line'
const POSITION_POLL_MS = 5_000
/** 轨道约 92 分钟一圈,轨迹线每 10 分钟刷新即可 */
const TRACK_REFRESH_MS = 10 * 60_000

const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] }

/**
 * ISS 国际空间站图层:实时位置标记(5s 刷新)+ 前后约一圈的地面轨迹,
 * 开启时自动飞到空间站上空
 */
export default function IssLayer({ active, onError }: IssLayerProps) {
  const map = useMap()
  const [info, setInfo] = useState<IssPosition | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const errorNotifiedRef = useRef(false)

  useEffect(() => {
    if (!map || !active) {
      setInfo(null)
      return
    }

    map.addSource(TRACK_SOURCE, { type: 'geojson', data: EMPTY_FC })
    map.addLayer({
      id: TRACK_LAYER,
      type: 'line',
      source: TRACK_SOURCE,
      paint: {
        'line-color': '#fbbc04',
        'line-width': 2,
        'line-dasharray': [2, 2],
        'line-opacity': 0.9,
      },
    })

    // 空间站标记:发光圆点 + 🛰 emoji
    const el = document.createElement('div')
    el.className = 'iss-marker'
    el.textContent = '🛰️'
    const marker = new maplibregl.Marker({ element: el })
    markerRef.current = marker
    let markerAdded = false

    let disposed = false
    let posTimer = 0
    let trackTimer = 0
    let controller: AbortController | null = null
    let followed = false

    const pollPosition = async () => {
      controller?.abort()
      controller = new AbortController()
      try {
        const pos = await fetchIssNow(controller.signal)
        if (disposed) return
        marker.setLngLat([pos.lng, pos.lat])
        if (!markerAdded) {
          marker.addTo(map)
          markerAdded = true
        }
        setInfo(pos)
        errorNotifiedRef.current = false
        // 首次定位成功后飞过去(缩小到能看到轨迹的级别)
        if (!followed) {
          followed = true
          map.flyTo({ center: [pos.lng, pos.lat], zoom: 3, duration: 2500, essential: true })
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError' && !errorNotifiedRef.current) {
          errorNotifiedRef.current = true
          onError('ISS 位置获取失败,稍后自动重试')
        }
      }
    }

    const refreshTrack = async () => {
      try {
        const coords = await fetchIssTrack()
        if (disposed) return
        const segments = splitAtAntimeridian(coords)
        const src = map.getSource(TRACK_SOURCE) as maplibregl.GeoJSONSource | undefined
        src?.setData({
          type: 'FeatureCollection',
          features: segments.map((seg) => ({
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: seg },
          })),
        })
      } catch {
        // 轨迹失败不打扰,位置标记仍可用
      }
    }

    void pollPosition()
    void refreshTrack()
    posTimer = window.setInterval(() => void pollPosition(), POSITION_POLL_MS)
    trackTimer = window.setInterval(() => void refreshTrack(), TRACK_REFRESH_MS)

    return () => {
      disposed = true
      window.clearInterval(posTimer)
      window.clearInterval(trackTimer)
      controller?.abort()
      marker.remove()
      markerRef.current = null
      if (map.getLayer(TRACK_LAYER)) map.removeLayer(TRACK_LAYER)
      if (map.getSource(TRACK_SOURCE)) map.removeSource(TRACK_SOURCE)
      setInfo(null)
    }
  }, [map, active, onError])

  if (!active || !info) return null

  return (
    <div className="iss-chip" role="status">
      <strong>国际空间站</strong>
      <span>
        高度 {Math.round(info.altitudeKm)} km · 速度 {Math.round(info.velocityKmh).toLocaleString()}{' '}
        km/h · {info.visibility === 'daylight' ? '日照区' : '地影区'}
      </span>
    </div>
  )
}
