import type maplibregl from 'maplibre-gl'
import type { Feature, Point } from 'geojson'
import { circlePolygon } from './mapConfig'

/** 定位相关的 source / layer id */
const ACCURACY_SOURCE = 'user-accuracy'
const ACCURACY_LAYER = 'user-accuracy-fill'
const DOT_SOURCE = 'user-dot'
const DOT_HALO_LAYER = 'user-dot-halo'
const DOT_LAYER = 'user-dot-core'

/**
 * 在地图上绘制/更新"蓝点 + 精度圈"(还原谷歌地图定位样式)
 */
export function drawLocation(map: maplibregl.Map, lng: number, lat: number, accuracy: number) {
  const circle = circlePolygon([lng, lat], accuracy)
  const point: Feature<Point> = {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Point', coordinates: [lng, lat] },
  }

  const accuracySrc = map.getSource(ACCURACY_SOURCE) as maplibregl.GeoJSONSource | undefined
  if (accuracySrc) {
    accuracySrc.setData(circle)
    ;(map.getSource(DOT_SOURCE) as maplibregl.GeoJSONSource).setData(point)
    return
  }

  // 精度圈:半透明蓝色填充 + 细边框
  map.addSource(ACCURACY_SOURCE, { type: 'geojson', data: circle })
  map.addLayer({
    id: ACCURACY_LAYER,
    type: 'fill',
    source: ACCURACY_SOURCE,
    paint: {
      'fill-color': '#4285F4',
      'fill-opacity': 0.15,
      'fill-outline-color': 'rgba(66, 133, 244, 0.4)',
    },
  })

  // 蓝点:白色光环 + 谷歌蓝实心圆
  map.addSource(DOT_SOURCE, { type: 'geojson', data: point })
  map.addLayer({
    id: DOT_HALO_LAYER,
    type: 'circle',
    source: DOT_SOURCE,
    paint: {
      'circle-radius': 11,
      'circle-color': '#ffffff',
      'circle-opacity': 1,
    },
  })
  map.addLayer({
    id: DOT_LAYER,
    type: 'circle',
    source: DOT_SOURCE,
    paint: {
      'circle-radius': 7,
      'circle-color': '#4285F4',
    },
  })
}

interface LocateOptions {
  /** 定位失败回调(自动定位时可传空实现静默失败) */
  onError?: (message: string) => void
  /** 定位结束(无论成败)回调,用于复位按钮状态 */
  onSettled?: () => void
}

/**
 * 请求浏览器定位,成功后绘制蓝点+精度圈并 flyTo 到当前位置。
 * 供"定位按钮"与"打开页面自动定位"共用。
 */
export function locateAndFly(map: maplibregl.Map, { onError, onSettled }: LocateOptions = {}) {
  if (!('geolocation' in navigator)) {
    onError?.('当前浏览器不支持定位功能')
    onSettled?.()
    return
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      onSettled?.()
      const { longitude, latitude, accuracy } = pos.coords
      drawLocation(map, longitude, latitude, accuracy)
      // 飞行动画到当前位置,还原谷歌地图定位体验
      map.flyTo({ center: [longitude, latitude], zoom: 15, duration: 2000, essential: true })
    },
    (err) => {
      onSettled?.()
      // 按错误类型给出友好提示
      const messages: Record<number, string> = {
        [err.PERMISSION_DENIED]: '定位权限被拒绝,请在浏览器设置中允许获取位置信息',
        [err.POSITION_UNAVAILABLE]: '无法获取当前位置,请稍后重试',
        [err.TIMEOUT]: '定位超时,请检查网络后重试',
      }
      onError?.(messages[err.code] ?? '定位失败,请重试')
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
  )
}
