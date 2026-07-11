import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { DEFAULT_CENTER, DEFAULT_ZOOM, MAP_STYLE } from '../lib/mapConfig'
import '../styles/mapview.css'

interface MapViewProps {
  /** 地图实例创建完成后回调,供父组件持有实例操作图层/相机 */
  onMapReady: (map: maplibregl.Map) => void
}

/**
 * MapLibre 地图容器:负责初始化地图、比例尺控件,
 * 拖拽平移 / 滚轮缩放 / 双击缩放 / Ctrl+拖拽旋转倾斜 均为 MapLibre 默认交互
 */
export default function MapView({ onMapReady }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      // 关闭默认版权控件,由底部自定义版权条统一展示
      attributionControl: false,
      // 稍微放宽最大倾斜角,接近谷歌地图 3D 手感
      maxPitch: 70,
    })

    // 比例尺(谷歌地图位于右下角)
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 90, unit: 'metric' }), 'bottom-right')

    mapRef.current = map
    onMapReady(map)

    // 开发模式下暴露地图实例,便于调试与自动化验证
    if (import.meta.env.DEV) {
      ;(window as unknown as { __map?: maplibregl.Map }).__map = map
    }

    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={containerRef} className="map-container" />
}
