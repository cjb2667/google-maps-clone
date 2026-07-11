import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import MapView from './components/MapView'
import SearchBar from './components/SearchBar'
import LayerSwitcher from './components/LayerSwitcher'
import ZoomControls from './components/ZoomControls'
import LocateButton from './components/LocateButton'
import Toolbar from './components/Toolbar'
import CompassButton from './components/CompassButton'
import {
  ROADMAP_ATTRIBUTION,
  SATELLITE_ATTRIBUTION,
  setBasemap,
  setTerrainEnabled,
  type LayerType,
} from './lib/mapConfig'
import { MapProvider } from './lib/MapContext'
import { locateAndFly } from './lib/userLocation'
import type { GeocodeResult } from './lib/geocode'
import { randomPlace, type Place } from './lib/places'
import './styles/app.css'

const MeasureTool = lazy(() => import('./components/MeasureTool'))
const SwipeCompare = lazy(() => import('./components/SwipeCompare'))
const DirectionsPanel = lazy(() => import('./components/DirectionsPanel'))
const TimeMachine = lazy(() => import('./components/TimeMachine'))
const FlightsLayer = lazy(() => import('./components/FlightsLayer'))
const IssLayer = lazy(() => import('./components/IssLayer'))

/** Wayback 历史影像署名 */
const WAYBACK_ATTRIBUTION =
  '© <a href="https://livingatlas.arcgis.com/wayback/" target="_blank">Esri Wayback</a> — Source: Esri, Maxar, Earthstar Geographics'

/**
 * 整体布局:地图铺满全屏,各控件绝对定位悬浮在地图之上
 */
export default function App() {
  const [map, setMap] = useState<maplibregl.Map | null>(null)
  const [activeLayer, setActiveLayer] = useState<LayerType>('roadmap')
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)
  const searchMarkerRef = useRef<maplibregl.Marker | null>(null)

  // 独占模式:路线 / 测距 / 卷帘 / 时光机(同屏交互冲突,互斥)
  const [directionsOn, setDirectionsOn] = useState(false)
  const [measureOn, setMeasureOn] = useState(false)
  const [swipeOn, setSwipeOn] = useState(false)
  const [timeMachineOn, setTimeMachineOn] = useState(false)
  // 叠加图层:3D / 航班 / ISS(可与任意模式共存)
  const [terrainOn, setTerrainOn] = useState(false)
  const [flightsOn, setFlightsOn] = useState(false)
  const [issOn, setIssOn] = useState(false)
  const lastPlaceRef = useRef<Place | undefined>(undefined)

  const handleMapReady = useCallback((m: maplibregl.Map) => {
    setMap(m)
    if (import.meta.env.DEV) {
      ;(window as unknown as { __appMap?: maplibregl.Map }).__appMap = m
    }
  }, [])

  // 仅在已授权定位时自动飞到当前位置
  useEffect(() => {
    if (!map) return
    const run = async () => {
      try {
        const status = await navigator.permissions?.query({ name: 'geolocation' })
        if (status?.state === 'granted') locateAndFly(map)
      } catch {
        // Permissions API 不可用时跳过
      }
    }
    if (map.loaded()) void run()
    else map.once('load', () => void run())
  }, [map])

  useEffect(() => {
    if (!map) return
    const onError = (e: maplibregl.ErrorEvent) => {
      const msg = e.error?.message ?? '地图加载出错'
      if (/failed|error|denied/i.test(msg)) {
        setToast('地图资源加载失败,请检查网络')
        window.clearTimeout(toastTimer.current)
        toastTimer.current = window.setTimeout(() => setToast(null), 4000)
      }
    }
    map.on('error', onError)
    return () => {
      map.off('error', onError)
      searchMarkerRef.current?.remove()
      searchMarkerRef.current = null
    }
  }, [map])

  /** 切换路网(矢量) / 卫星 */
  const handleSwitchLayer = useCallback(
    (layer: LayerType) => {
      if (!map) return
      setBasemap(map, layer)
      setActiveLayer(layer)
    },
    [map],
  )

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 4000)
  }, [])

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  const handleSearchClear = useCallback(() => {
    searchMarkerRef.current?.remove()
    searchMarkerRef.current = null
  }, [])

  const handleSearchSelect = useCallback(
    (result: GeocodeResult) => {
      if (!map) return
      searchMarkerRef.current?.remove()
      searchMarkerRef.current = new maplibregl.Marker({ color: '#EA4335' })
        .setLngLat([result.lng, result.lat])
        .addTo(map)

      if (result.bbox) {
        map.fitBounds(result.bbox, { padding: 80, maxZoom: 16, duration: 2000 })
      } else {
        map.flyTo({ center: [result.lng, result.lat], zoom: 14, duration: 2000, essential: true })
      }
    },
    [map],
  )

  /** 关闭所有独占模式 */
  const closeExclusiveModes = useCallback(() => {
    setDirectionsOn(false)
    setMeasureOn(false)
    setSwipeOn(false)
    setTimeMachineOn(false)
  }, [])

  const handleToggleDirections = useCallback(() => {
    setDirectionsOn((on) => {
      if (!on) {
        closeExclusiveModes()
        handleSearchClear()
      }
      return !on
    })
  }, [closeExclusiveModes, handleSearchClear])

  const handleToggleMeasure = useCallback(() => {
    setMeasureOn((on) => {
      if (!on) closeExclusiveModes()
      return !on
    })
  }, [closeExclusiveModes])

  const handleToggleSwipe = useCallback(() => {
    setSwipeOn((on) => {
      if (!on) closeExclusiveModes()
      return !on
    })
  }, [closeExclusiveModes])

  /** 时光机:开启时切主图为卫星,便于"过去 vs 现在"对比 */
  const handleToggleTimeMachine = useCallback(() => {
    setTimeMachineOn((on) => {
      if (!on) {
        closeExclusiveModes()
        handleSwitchLayer('satellite')
      }
      return !on
    })
  }, [closeExclusiveModes, handleSwitchLayer])

  const handleToggleTerrain = useCallback(() => {
    if (!map) return
    setTerrainOn((on) => {
      const next = !on
      setTerrainEnabled(map, next)
      map.easeTo({ pitch: next ? 60 : 0, duration: 1200 })
      return next
    })
  }, [map])

  const handleToggleFlights = useCallback(() => setFlightsOn((on) => !on), [])
  const handleToggleIss = useCallback(() => setIssOn((on) => !on), [])

  const handleTeleport = useCallback(() => {
    if (!map) return
    const place = randomPlace(lastPlaceRef.current)
    lastPlaceRef.current = place
    handleSwitchLayer('satellite')
    map.flyTo({
      center: [place.lng, place.lat],
      zoom: place.zoom,
      pitch: terrainOn ? (place.pitch ?? 45) : 0,
      bearing: 0,
      duration: 3000,
      essential: true,
    })
    showToast(`已传送到:${place.name}(${place.country})`)
  }, [map, terrainOn, handleSwitchLayer, showToast])

  const attributionHtml = timeMachineOn
    ? `${WAYBACK_ATTRIBUTION} | ${SATELLITE_ATTRIBUTION}`
    : swipeOn
      ? `${ROADMAP_ATTRIBUTION} | ${SATELLITE_ATTRIBUTION}`
      : activeLayer === 'roadmap'
        ? ROADMAP_ATTRIBUTION
        : SATELLITE_ATTRIBUTION

  return (
    <MapProvider value={map}>
      <div className="app">
        <MapView onMapReady={handleMapReady} onError={showToast} />

        <Suspense fallback={null}>
          <SwipeCompare
            active={swipeOn}
            compareLayer={activeLayer === 'roadmap' ? 'satellite' : 'roadmap'}
            terrainOn={terrainOn}
          />
          <TimeMachine active={timeMachineOn} onError={showToast} />
          <FlightsLayer active={flightsOn} onError={showToast} />
          <IssLayer active={issOn} onError={showToast} />
        </Suspense>

        {/* 路线模式下隐藏普通搜索,避免与起终点输入冲突 */}
        {!directionsOn && (
          <SearchBar
            onSelect={handleSearchSelect}
            onClear={handleSearchClear}
            onError={showToast}
          />
        )}

        <Toolbar
          directionsOn={directionsOn}
          measureOn={measureOn}
          swipeOn={swipeOn}
          terrainOn={terrainOn}
          timeMachineOn={timeMachineOn}
          flightsOn={flightsOn}
          issOn={issOn}
          onToggleDirections={handleToggleDirections}
          onToggleMeasure={handleToggleMeasure}
          onToggleSwipe={handleToggleSwipe}
          onToggleTerrain={handleToggleTerrain}
          onToggleTimeMachine={handleToggleTimeMachine}
          onToggleFlights={handleToggleFlights}
          onToggleIss={handleToggleIss}
          onTeleport={handleTeleport}
        />

        <Suspense fallback={null}>
          <DirectionsPanel
            active={directionsOn}
            onExit={() => setDirectionsOn(false)}
            onError={showToast}
          />
          <MeasureTool active={measureOn} onExit={() => setMeasureOn(false)} />
        </Suspense>

        {/* 卷帘/时光机下两种影像同屏,隐藏图层切换卡片 */}
        {!swipeOn && !timeMachineOn && (
          <div className="app__bottom-left">
            <LayerSwitcher active={activeLayer} onSwitch={handleSwitchLayer} />
          </div>
        )}

        <div className="app__bottom-right">
          <CompassButton />
          <LocateButton onError={showToast} />
          <ZoomControls
            onZoomIn={() => map?.zoomIn({ duration: 300 })}
            onZoomOut={() => map?.zoomOut({ duration: 300 })}
          />
        </div>

        <div className="app__attribution" dangerouslySetInnerHTML={{ __html: attributionHtml }} />

        {toast && (
          <div className="app__toast" role="alert">
            {toast}
          </div>
        )}
      </div>
    </MapProvider>
  )
}
