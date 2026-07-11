import { useCallback, useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import MapView from './components/MapView'
import SearchBar from './components/SearchBar'
import LayerSwitcher from './components/LayerSwitcher'
import ZoomControls from './components/ZoomControls'
import LocateButton from './components/LocateButton'
import Toolbar from './components/Toolbar'
import MeasureTool from './components/MeasureTool'
import SwipeCompare from './components/SwipeCompare'
import {
  HILLSHADE_LAYER_ID,
  ROADMAP_ATTRIBUTION,
  ROADMAP_LAYER_ID,
  SATELLITE_ATTRIBUTION,
  SATELLITE_LAYER_ID,
  TERRAIN_EXAGGERATION,
  TERRAIN_SOURCE,
  type LayerType,
} from './lib/mapConfig'
import { locateAndFly } from './lib/userLocation'
import type { GeocodeResult } from './lib/geocode'
import { randomPlace, type Place } from './lib/places'
import './styles/app.css'

/**
 * 整体布局:地图铺满全屏,各控件绝对定位悬浮在地图之上
 */
export default function App() {
  const [map, setMap] = useState<maplibregl.Map | null>(null)
  const [activeLayer, setActiveLayer] = useState<LayerType>('roadmap')
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)
  // 搜索结果标记(红色大头针),始终只保留一个
  const searchMarkerRef = useRef<maplibregl.Marker | null>(null)

  // 功能模式开关:测量 / 卷帘对比 / 3D 地形
  const [measureOn, setMeasureOn] = useState(false)
  const [swipeOn, setSwipeOn] = useState(false)
  const [terrainOn, setTerrainOn] = useState(false)
  // 上一次随机传送的目的地,避免连续重复
  const lastPlaceRef = useRef<Place | undefined>(undefined)

  const handleMapReady = useCallback((m: maplibregl.Map) => {
    setMap(m)
    if (import.meta.env.DEV) {
      ;(window as unknown as { __appMap?: maplibregl.Map }).__appMap = m
    }
  }, [])

  // 打开页面自动定位到当前位置(失败时静默,不打扰用户)
  useEffect(() => {
    if (!map) return
    const run = () => locateAndFly(map)
    if (map.loaded()) run()
    else map.once('load', run)
  }, [map])

  /** 切换路网/卫星图层:通过图层显隐实现,不重建样式 */
  const handleSwitchLayer = useCallback(
    (layer: LayerType) => {
      if (!map) return
      map.setLayoutProperty(
        ROADMAP_LAYER_ID,
        'visibility',
        layer === 'roadmap' ? 'visible' : 'none',
      )
      map.setLayoutProperty(
        SATELLITE_LAYER_ID,
        'visibility',
        layer === 'satellite' ? 'visible' : 'none',
      )
      setActiveLayer(layer)
    },
    [map],
  )

  /** 显示一条会自动消失的提示(用于定位失败等) */
  const showToast = useCallback((message: string) => {
    setToast(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 4000)
  }, [])

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  /** 搜索选中地点:放置红色标记并飞到目标位置 */
  const handleSearchSelect = useCallback(
    (result: GeocodeResult) => {
      if (!map) return
      // 移除旧标记,放置新标记(MapLibre 默认大头针,改为谷歌红)
      searchMarkerRef.current?.remove()
      searchMarkerRef.current = new maplibregl.Marker({ color: '#EA4335' })
        .setLngLat([result.lng, result.lat])
        .addTo(map)

      // 有边界框且范围合理时按边界缩放,否则飞到点位
      if (result.bbox) {
        map.fitBounds(result.bbox, { padding: 80, maxZoom: 16, duration: 2000 })
      } else {
        map.flyTo({ center: [result.lng, result.lat], zoom: 14, duration: 2000, essential: true })
      }
    },
    [map],
  )

  /** 测量与卷帘互斥:开启一个时自动关闭另一个 */
  const handleToggleMeasure = useCallback(() => {
    setMeasureOn((on) => {
      if (!on) setSwipeOn(false)
      return !on
    })
  }, [])

  const handleToggleSwipe = useCallback(() => {
    setSwipeOn((on) => {
      if (!on) setMeasureOn(false)
      return !on
    })
  }, [])

  /** 3D 地形开关:设置 terrain + 山体阴影,并调整俯仰角 */
  const handleToggleTerrain = useCallback(() => {
    if (!map) return
    setTerrainOn((on) => {
      const next = !on
      if (next) {
        map.setTerrain({ source: TERRAIN_SOURCE, exaggeration: TERRAIN_EXAGGERATION })
        map.setLayoutProperty(HILLSHADE_LAYER_ID, 'visibility', 'visible')
        // 自动倾斜视角,突出 3D 效果
        map.easeTo({ pitch: 60, duration: 1200 })
      } else {
        map.setTerrain(null)
        map.setLayoutProperty(HILLSHADE_LAYER_ID, 'visibility', 'none')
        map.easeTo({ pitch: 0, duration: 1200 })
      }
      return next
    })
  }, [map])

  /** 随机传送:切换到卫星图并飞往一个随机精选目的地 */
  const handleTeleport = useCallback(() => {
    if (!map) return
    const place = randomPlace(lastPlaceRef.current)
    lastPlaceRef.current = place
    // 云旅游用卫星图观感最好
    handleSwitchLayer('satellite')
    map.flyTo({
      center: [place.lng, place.lat],
      zoom: place.zoom,
      // 开启 3D 时使用目的地推荐俯仰角
      pitch: terrainOn ? (place.pitch ?? 45) : 0,
      bearing: 0,
      duration: 3000,
      essential: true,
    })
    showToast(`已传送到:${place.name}(${place.country})`)
  }, [map, terrainOn, handleSwitchLayer, showToast])

  return (
    <div className="app">
      <MapView onMapReady={handleMapReady} />

      {/* 卷帘对比覆盖层(需在各控件之下) */}
      <SwipeCompare
        map={map}
        active={swipeOn}
        compareLayer={activeLayer === 'roadmap' ? 'satellite' : 'roadmap'}
        terrainOn={terrainOn}
      />

      {/* 左上角:搜索框(接入 Nominatim 地点搜索) */}
      <SearchBar onSelect={handleSearchSelect} onError={showToast} />

      {/* 右上角:功能工具栏 */}
      <Toolbar
        measureOn={measureOn}
        swipeOn={swipeOn}
        terrainOn={terrainOn}
        onToggleMeasure={handleToggleMeasure}
        onToggleSwipe={handleToggleSwipe}
        onToggleTerrain={handleToggleTerrain}
        onTeleport={handleTeleport}
      />

      {/* 测量模式:地图交互 + 底部信息面板 */}
      <MeasureTool map={map} active={measureOn} onExit={() => setMeasureOn(false)} />

      {/* 左下角:图层切换卡片(卷帘模式下两种图层同屏,隐藏切换卡片) */}
      {!swipeOn && (
        <div className="app__bottom-left">
          <LayerSwitcher active={activeLayer} onSwitch={handleSwitchLayer} />
        </div>
      )}

      {/* 右下角:定位按钮 + 缩放按钮组 */}
      <div className="app__bottom-right">
        <LocateButton map={map} onError={showToast} />
        <ZoomControls
          onZoomIn={() => map?.zoomIn({ duration: 300 })}
          onZoomOut={() => map?.zoomOut({ duration: 300 })}
        />
      </div>

      {/* 底部版权条:根据当前图层展示对应署名 */}
      <div
        className="app__attribution"
        // 署名文案来自本地常量,包含安全的链接 HTML
        dangerouslySetInnerHTML={{
          // 卷帘模式下两种图层同屏,同时展示两份署名
          __html: swipeOn
            ? `${ROADMAP_ATTRIBUTION} | ${SATELLITE_ATTRIBUTION}`
            : activeLayer === 'roadmap'
              ? ROADMAP_ATTRIBUTION
              : SATELLITE_ATTRIBUTION,
        }}
      />

      {/* 定位失败等提示 */}
      {toast && (
        <div className="app__toast" role="alert">
          {toast}
        </div>
      )}
    </div>
  )
}
