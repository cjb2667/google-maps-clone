import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  WEATHER_ATTRIBUTION,
  setBasemap,
  setMapTheme,
  setTerrainEnabled,
  type LayerType,
  type MapDisplay,
} from './lib/mapConfig'
import {
  getSystemTheme,
  loadThemeSetting,
  resolveTheme,
  saveThemeSetting,
  type Theme,
  type ThemeSetting,
} from './lib/theme'
import { MapProvider } from './lib/MapContext'
import { locateAndFly } from './lib/userLocation'
import type { GeocodeResult } from './lib/geocode'
import { randomPlace, type Place } from './lib/places'
import type { SwipeMode } from './components/SwipeCompare'
import './styles/app.css'

const MeasureTool = lazy(() => import('./components/MeasureTool'))
const SwipeCompare = lazy(() => import('./components/SwipeCompare'))
const DirectionsPanel = lazy(() => import('./components/DirectionsPanel'))
const WeatherOverlay = lazy(() => import('./components/WeatherOverlay'))
const FlightMode = lazy(() => import('./components/FlightMode'))

/**
 * 整体布局:地图铺满全屏,各控件绝对定位悬浮在地图之上
 */
export default function App() {
  const [map, setMap] = useState<maplibregl.Map | null>(null)
  const [activeLayer, setActiveLayer] = useState<LayerType>('roadmap')
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)
  const searchMarkerRef = useRef<maplibregl.Marker | null>(null)

  const [directionsOn, setDirectionsOn] = useState(false)
  const [measureOn, setMeasureOn] = useState(false)
  const [swipeOn, setSwipeOn] = useState(false)
  const [swipeMode, setSwipeMode] = useState<SwipeMode>('basemap')
  const [terrainOn, setTerrainOn] = useState(false)
  const [weatherOn, setWeatherOn] = useState(false)
  const [flightOn, setFlightOn] = useState(false)
  const lastPlaceRef = useRef<Place | undefined>(undefined)

  // 日夜主题:用户设置(auto/light/dark)+ 系统偏好 → 实际主题
  const [themeSetting, setThemeSetting] = useState<ThemeSetting>(() => loadThemeSetting())
  const [systemTheme, setSystemTheme] = useState<Theme>(() => getSystemTheme())
  const theme = resolveTheme(themeSetting, systemTheme)
  // MapView 只在初始化时用一次主题,后续切换走 setMapTheme
  const initialThemeRef = useRef(theme)

  // 监听系统深色模式变化(auto 模式下自动联动)
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? 'dark' : 'light')
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  // 主题变化时应用到主图
  useEffect(() => {
    if (!map) return
    setMapTheme(map, theme)
  }, [map, theme])

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

  /**
   * 抢占地图点击的模式(路线/测距/天气/飞行)与卷帘相互互斥:
   * 开启任意一个时关闭其余
   */
  const exclusiveToggle = useCallback(
    (
      setter: React.Dispatch<React.SetStateAction<boolean>>,
      opts: { clearSearch?: boolean } = {},
    ) => {
      setter((on) => {
        if (!on) {
          // 关闭除自身外的其他抢占模式
          const others = [setDirectionsOn, setMeasureOn, setSwipeOn, setWeatherOn, setFlightOn]
          for (const s of others) {
            if (s !== setter) s(false)
          }
          if (opts.clearSearch) handleSearchClear()
        }
        return !on
      })
    },
    [handleSearchClear],
  )

  const handleToggleDirections = useCallback(
    () => exclusiveToggle(setDirectionsOn, { clearSearch: true }),
    [exclusiveToggle],
  )
  const handleToggleMeasure = useCallback(
    () => exclusiveToggle(setMeasureOn),
    [exclusiveToggle],
  )
  const handleToggleSwipe = useCallback(() => exclusiveToggle(setSwipeOn), [exclusiveToggle])
  const handleToggleWeather = useCallback(
    () => exclusiveToggle(setWeatherOn),
    [exclusiveToggle],
  )
  const handleToggleFlight = useCallback(
    () => exclusiveToggle(setFlightOn),
    [exclusiveToggle],
  )

  const handleToggleTerrain = useCallback(() => {
    if (!map) return
    setTerrainOn((on) => {
      const next = !on
      setTerrainEnabled(map, next)
      map.easeTo({ pitch: next ? 60 : 0, duration: 1200 })
      return next
    })
  }, [map])

  /** 主题循环:跟随系统 → 白天 → 黑夜 → 跟随系统 */
  const handleCycleTheme = useCallback(() => {
    setThemeSetting((cur) => {
      const next: ThemeSetting = cur === 'auto' ? 'light' : cur === 'light' ? 'dark' : 'auto'
      saveThemeSetting(next)
      const labels: Record<ThemeSetting, string> = {
        auto: '主题:跟随系统',
        light: '主题:白天',
        dark: '主题:黑夜',
      }
      showToast(labels[next])
      return next
    })
  }, [showToast])

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

  /** 主图当前展示状态(供卷帘对比取"另一面") */
  const mainDisplay = useMemo<MapDisplay>(
    () => ({ basemap: activeLayer, theme }),
    [activeLayer, theme],
  )

  /** 版权署名:卷帘或黑夜等场景组合展示 */
  const attribution = useMemo(() => {
    const parts: string[] = []
    if (swipeOn && swipeMode === 'basemap') {
      parts.push(ROADMAP_ATTRIBUTION, SATELLITE_ATTRIBUTION)
    } else {
      parts.push(activeLayer === 'roadmap' ? ROADMAP_ATTRIBUTION : SATELLITE_ATTRIBUTION)
    }
    if (weatherOn) parts.push(WEATHER_ATTRIBUTION)
    return parts.join(' | ')
  }, [swipeOn, swipeMode, activeLayer, weatherOn])

  return (
    <MapProvider value={map}>
      <div className="app">
        <MapView
          onMapReady={handleMapReady}
          onError={showToast}
          initialTheme={initialThemeRef.current}
        />

        <Suspense fallback={null}>
          <SwipeCompare
            active={swipeOn}
            mode={swipeMode}
            onModeChange={setSwipeMode}
            mainDisplay={mainDisplay}
            terrainOn={terrainOn}
          />
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
          weatherOn={weatherOn}
          flightOn={flightOn}
          themeSetting={themeSetting}
          onToggleDirections={handleToggleDirections}
          onToggleMeasure={handleToggleMeasure}
          onToggleSwipe={handleToggleSwipe}
          onToggleTerrain={handleToggleTerrain}
          onToggleWeather={handleToggleWeather}
          onToggleFlight={handleToggleFlight}
          onCycleTheme={handleCycleTheme}
          onTeleport={handleTeleport}
        />

        <Suspense fallback={null}>
          <DirectionsPanel
            active={directionsOn}
            onExit={() => setDirectionsOn(false)}
            onError={showToast}
          />
          <MeasureTool active={measureOn} onExit={() => setMeasureOn(false)} />
          <WeatherOverlay active={weatherOn} onError={showToast} />
          <FlightMode active={flightOn} onExit={() => setFlightOn(false)} />
        </Suspense>

        {!swipeOn && (
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

        <div
          className="app__attribution"
          dangerouslySetInnerHTML={{ __html: attribution }}
        />

        {toast && (
          <div className="app__toast" role="alert">
            {toast}
          </div>
        )}
      </div>
    </MapProvider>
  )
}
