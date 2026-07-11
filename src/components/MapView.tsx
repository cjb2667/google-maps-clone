import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  loadMapStyle,
  registerMapDisplay,
} from '../lib/mapConfig'
import type { Theme } from '../lib/theme'
import '../styles/mapview.css'

interface MapViewProps {
  /** 地图实例创建完成后回调,供父组件持有实例操作图层/相机 */
  onMapReady: (map: maplibregl.Map) => void
  /** 矢量样式加载失败时回调 */
  onError?: (message: string) => void
  /** 初始日夜主题(仅初始化时生效,后续切换由父组件调用 setMapTheme) */
  initialTheme: Theme
}

/**
 * MapLibre 地图容器:异步加载合并矢量样式(亮/暗/卫星)后初始化,
 * 拖拽平移 / 滚轮缩放 / 双击缩放 / Ctrl+拖拽旋转倾斜 均为默认交互
 */
export default function MapView({ onMapReady, onError, initialTheme }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  // 仅取首次渲染的主题,避免主题切换触发地图重建
  const initialThemeRef = useRef(initialTheme)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let cancelled = false
    let map: maplibregl.Map | null = null

    const init = async () => {
      try {
        const display = { basemap: 'roadmap' as const, theme: initialThemeRef.current }
        const style = await loadMapStyle(display)
        if (cancelled || !containerRef.current) return

        map = new maplibregl.Map({
          container: containerRef.current,
          style,
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          attributionControl: false,
          maxPitch: 70,
          fadeDuration: 0,
        })
        registerMapDisplay(map, display)

        map.addControl(new maplibregl.ScaleControl({ maxWidth: 90, unit: 'metric' }), 'bottom-right')

        map.once('load', () => {
          if (cancelled || !map) {
            map?.remove()
            return
          }
          mapRef.current = map
          onMapReady(map)
          if (import.meta.env.DEV) {
            ;(window as unknown as { __map?: maplibregl.Map }).__map = map
          }
        })
      } catch {
        if (!cancelled) onError?.('矢量地图样式加载失败,请检查网络后刷新')
      }
    }

    void init()

    return () => {
      cancelled = true
      map?.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={containerRef} className="map-container" />
}
