import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import maplibregl from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import { searchPlaces, type GeocodeResult } from '../lib/geocode'
import { fetchRoute, type RoutePoint, type TravelMode } from '../lib/routing'
import { useMap } from '../lib/useMap'
import '../styles/directions.css'

interface DirectionsPanelProps {
  active: boolean
  onExit: () => void
  onError: (message: string) => void
}

const ROUTE_SOURCE = 'directions-route'
const ROUTE_CASING = 'directions-route-casing'
const ROUTE_LINE = 'directions-route-line'

const MODE_LABELS: Record<TravelMode, string> = {
  driving: '驾车',
  walking: '步行',
  cycling: '骑行',
}

const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] }

/** 创建带字母的起终点标记 DOM */
function makePin(letter: string, color: string): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'directions-pin'
  el.style.background = color
  const label = document.createElement('span')
  label.className = 'directions-pin__label'
  label.textContent = letter
  el.appendChild(label)
  return el
}

/**
 * 路线规划面板:起终点搜索 / 地图点选 + OSRM 驾车/步行/骑行
 */
export default function DirectionsPanel({ active, onExit, onError }: DirectionsPanelProps) {
  const map = useMap()
  const [origin, setOrigin] = useState<RoutePoint | null>(null)
  const [destination, setDestination] = useState<RoutePoint | null>(null)
  const [originText, setOriginText] = useState('')
  const [destText, setDestText] = useState('')
  const [mode, setMode] = useState<TravelMode>('driving')
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<{ distanceText: string; durationText: string } | null>(
    null,
  )
  const [focusField, setFocusField] = useState<'origin' | 'dest'>('origin')
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([])
  const [suggestOpen, setSuggestOpen] = useState(false)

  const originMarker = useRef<maplibregl.Marker | null>(null)
  const destMarker = useRef<maplibregl.Marker | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const searchAbort = useRef<AbortController | null>(null)
  const debounceRef = useRef<number | undefined>(undefined)

  /** 确保路线 source/layer 存在 */
  const ensureRouteLayers = useCallback(() => {
    if (!map) return
    if (!map.getSource(ROUTE_SOURCE)) {
      map.addSource(ROUTE_SOURCE, { type: 'geojson', data: EMPTY_FC })
      map.addLayer({
        id: ROUTE_CASING,
        type: 'line',
        source: ROUTE_SOURCE,
        paint: {
          'line-color': '#1967d2',
          'line-width': 8,
          'line-opacity': 0.35,
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      })
      map.addLayer({
        id: ROUTE_LINE,
        type: 'line',
        source: ROUTE_SOURCE,
        paint: {
          'line-color': '#4285F4',
          'line-width': 5,
          'line-opacity': 1,
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      })
    }
  }, [map])

  const clearRoute = useCallback(() => {
    if (!map) return
    const src = map.getSource(ROUTE_SOURCE) as maplibregl.GeoJSONSource | undefined
    src?.setData(EMPTY_FC)
    setSummary(null)
  }, [map])

  const placeMarker = useCallback(
    (which: 'origin' | 'dest', point: RoutePoint) => {
      if (!map) return
      if (which === 'origin') {
        originMarker.current?.remove()
        originMarker.current = new maplibregl.Marker({ element: makePin('A', '#34a853') })
          .setLngLat([point.lng, point.lat])
          .addTo(map)
      } else {
        destMarker.current?.remove()
        destMarker.current = new maplibregl.Marker({ element: makePin('B', '#ea4335') })
          .setLngLat([point.lng, point.lat])
          .addTo(map)
      }
    },
    [map],
  )

  /** 起终点齐全时请求路线 */
  const runRoute = useCallback(
    async (from: RoutePoint, to: RoutePoint, travelMode: TravelMode) => {
      if (!map) return
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setLoading(true)
      try {
        ensureRouteLayers()
        const result = await fetchRoute(from, to, travelMode, controller.signal)
        ;(map.getSource(ROUTE_SOURCE) as maplibregl.GeoJSONSource).setData({
          type: 'FeatureCollection',
          features: [result.geometry],
        })
        setSummary({ distanceText: result.distanceText, durationText: result.durationText })
        const bounds = new maplibregl.LngLatBounds()
        for (const c of result.geometry.geometry.coordinates) {
          bounds.extend(c as [number, number])
        }
        map.fitBounds(bounds, { padding: 80, maxZoom: 16, duration: 1200 })
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          clearRoute()
          onError((err as Error).message || '路线规划失败')
        }
      } finally {
        // 仅当仍是最新请求时才清 loading,避免被 abort 的旧请求打灭新请求的状态
        if (abortRef.current === controller) setLoading(false)
      }
    },
    [map, ensureRouteLayers, clearRoute, onError],
  )

  // 起终点或模式变化时自动算路
  useEffect(() => {
    if (!active || !origin || !destination) {
      if (active) clearRoute()
      return
    }
    void runRoute(origin, destination, mode)
  }, [active, origin, destination, mode, runRoute, clearRoute])

  // 地图点击设点
  useEffect(() => {
    if (!map || !active) return
    const onClick = (e: maplibregl.MapMouseEvent) => {
      const point: RoutePoint = {
        lng: e.lngLat.lng,
        lat: e.lngLat.lat,
        label: '地图上的点',
      }
      if (focusField === 'origin' || !origin) {
        setOrigin(point)
        setOriginText(point.label)
        setFocusField('dest')
        placeMarker('origin', point)
      } else {
        setDestination(point)
        setDestText(point.label)
        placeMarker('dest', point)
      }
      setSuggestOpen(false)
    }
    map.getCanvas().style.cursor = 'crosshair'
    map.on('click', onClick)
    return () => {
      map.off('click', onClick)
      map.getCanvas().style.cursor = ''
    }
  }, [map, active, focusField, origin, placeMarker])

  // 退出时清理
  useEffect(() => {
    if (active) return
    window.clearTimeout(debounceRef.current)
    abortRef.current?.abort()
    searchAbort.current?.abort()
    originMarker.current?.remove()
    destMarker.current?.remove()
    originMarker.current = null
    destMarker.current = null
    clearRoute()
    if (map) {
      for (const id of [ROUTE_LINE, ROUTE_CASING]) {
        if (map.getLayer(id)) map.removeLayer(id)
      }
      if (map.getSource(ROUTE_SOURCE)) map.removeSource(ROUTE_SOURCE)
    }
    setOrigin(null)
    setDestination(null)
    setOriginText('')
    setDestText('')
    setSummary(null)
    setLoading(false)
    setSuggestions([])
    setSuggestOpen(false)
  }, [active, map, clearRoute])

  const searchSuggest = (q: string, field: 'origin' | 'dest') => {
    window.clearTimeout(debounceRef.current)
    if (q.trim().length < 2) {
      setSuggestions([])
      setSuggestOpen(false)
      return
    }
    debounceRef.current = window.setTimeout(async () => {
      searchAbort.current?.abort()
      const controller = new AbortController()
      searchAbort.current = controller
      try {
        const b = map?.getBounds()
        const viewbox: [number, number, number, number] | undefined = b
          ? [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]
          : undefined
        const list = await searchPlaces(q.trim(), { signal: controller.signal, viewbox })
        setSuggestions(list)
        setSuggestOpen(true)
        setFocusField(field)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') onError('地点搜索失败')
      }
    }, 350)
  }

  const pickSuggestion = (r: GeocodeResult) => {
    const point: RoutePoint = {
      lng: r.lng,
      lat: r.lat,
      label: r.primaryName,
    }
    if (focusField === 'origin') {
      setOrigin(point)
      setOriginText(r.primaryName)
      placeMarker('origin', point)
      setFocusField('dest')
    } else {
      setDestination(point)
      setDestText(r.primaryName)
      placeMarker('dest', point)
    }
    setSuggestOpen(false)
    setSuggestions([])
  }

  const swapEnds = () => {
    const o = origin
    const d = destination
    const ot = originText
    const dt = destText
    setOrigin(d)
    setDestination(o)
    setOriginText(dt)
    setDestText(ot)
    if (d) placeMarker('origin', d)
    else originMarker.current?.remove()
    if (o) placeMarker('dest', o)
    else destMarker.current?.remove()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      // 先关建议下拉,再次 Esc 才退出面板
      if (suggestOpen) setSuggestOpen(false)
      else onExit()
    }
  }

  if (!active) return null

  return (
    <div className="directions-panel" onKeyDown={onKeyDown}>
      <div className="directions-panel__header">
        <span className="directions-panel__title">路线</span>
        <button type="button" className="directions-panel__close" onClick={onExit} aria-label="关闭">
          ×
        </button>
      </div>

      <div className="directions-panel__modes" role="tablist">
        {(Object.keys(MODE_LABELS) as TravelMode[]).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            className={`directions-panel__mode${mode === m ? ' directions-panel__mode--active' : ''}`}
            onClick={() => setMode(m)}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      <div className="directions-panel__fields">
        <div className="directions-panel__row">
          <span className="directions-panel__dot directions-panel__dot--a" />
          <input
            className="directions-panel__input"
            placeholder="起点(搜索或点击地图)"
            value={originText}
            onFocus={() => setFocusField('origin')}
            onChange={(e) => {
              setOriginText(e.target.value)
              // 文本被编辑后旧坐标不再有效,清除待重新选点
              setOrigin(null)
              originMarker.current?.remove()
              originMarker.current = null
              searchSuggest(e.target.value, 'origin')
            }}
            aria-label="起点"
          />
        </div>
        <button
          type="button"
          className="directions-panel__swap"
          onClick={swapEnds}
          aria-label="交换起终点"
          title="交换起终点"
        >
          ⇅
        </button>
        <div className="directions-panel__row">
          <span className="directions-panel__dot directions-panel__dot--b" />
          <input
            className="directions-panel__input"
            placeholder="终点(搜索或点击地图)"
            value={destText}
            onFocus={() => setFocusField('dest')}
            onChange={(e) => {
              setDestText(e.target.value)
              setDestination(null)
              destMarker.current?.remove()
              destMarker.current = null
              searchSuggest(e.target.value, 'dest')
            }}
            aria-label="终点"
          />
        </div>
      </div>

      {suggestOpen && suggestions.length > 0 && (
        <ul className="directions-panel__suggest" role="listbox">
          {suggestions.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => pickSuggestion(r)}>
                <strong>{r.primaryName}</strong>
                {r.secondaryName ? <span>{r.secondaryName}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="directions-panel__hint">
        {loading
          ? '正在规划路线…'
          : summary
            ? `${summary.durationText} · ${summary.distanceText}`
            : '选择起点和终点,或直接在地图上点击'}
      </div>
    </div>
  )
}
