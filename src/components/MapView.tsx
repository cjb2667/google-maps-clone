import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import {
  captureBasemapLayerIds,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  loadMapStyle,
} from '../lib/mapConfig'
import '../styles/mapview.css'

interface MapViewProps {
  /** 地图实例创建完成后回调,供父组件持有实例操作图层/相机 */
  onMapReady: (map: maplibregl.Map) => void
  /** 矢量样式加载失败时回调 */
  onError?: (message: string) => void
}

/**
 * MapLibre 地图容器:异步加载 OpenFreeMap 矢量样式后初始化,
 * 拖拽平移 / 滚轮缩放 / 双击缩放 / Ctrl+拖拽旋转倾斜 均为默认交互
 */
export default function MapView({ onMapReady, onError }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let cancelled = false
    let map: maplibregl.Map | null = null

    const init = async () => {
      try {
        const style = await loadMapStyle()
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

        map.addControl(new maplibregl.ScaleControl({ maxWidth: 90, unit: 'metric' }), 'bottom-right')

        map.once('load', () => {
          if (cancelled || !map) {
            map?.remove()
            return
          }
          captureBasemapLayerIds(map)
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
