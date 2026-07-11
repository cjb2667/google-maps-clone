import type { Feature, LineString } from 'geojson'
import { formatDistance, haversine } from './geo'

/** 出行方式:对应 OSRM profile */
export type TravelMode = 'driving' | 'walking' | 'cycling'

export interface RoutePoint {
  lng: number
  lat: number
  /** 展示名称(搜索选中或"地图选点") */
  label: string
}

export interface RouteResult {
  /** 路线几何 */
  geometry: Feature<LineString>
  /** 距离(米) */
  distance: number
  /** 时长(秒) */
  duration: number
  distanceText: string
  durationText: string
}

interface OsrmResponse {
  code: string
  message?: string
  routes?: Array<{
    distance: number
    duration: number
    geometry: { type: 'LineString'; coordinates: [number, number][] }
  }>
}

const OSRM_BASE = 'https://router.project-osrm.org'

/** 将秒格式化为"约 x 分钟 / x 小时" */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return '不到 1 分钟'
  const mins = Math.round(seconds / 60)
  if (mins < 60) return `${mins} 分钟`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h} 小时 ${m} 分钟` : `${h} 小时`
}

/**
 * 请求 OSRM 路线规划(公共演示服务,免费无需密钥)。
 * 生产环境建议自建 OSRM / Valhalla。
 */
export async function fetchRoute(
  from: RoutePoint,
  to: RoutePoint,
  mode: TravelMode,
  signal?: AbortSignal,
): Promise<RouteResult> {
  // 起终点过近(<10 米)直接短路,避免无意义请求
  if (haversine([from.lng, from.lat], [to.lng, to.lat]) < 10) {
    throw new Error('起点与终点距离过近')
  }
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`
  const url =
    `${OSRM_BASE}/route/v1/${mode}/${coords}` +
    `?overview=full&geometries=geojson&alternatives=false&steps=false`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`路线服务异常: ${res.status}`)
  const data = (await res.json()) as OsrmResponse
  if (data.code !== 'Ok' || !data.routes?.[0]) {
    throw new Error(data.message || '未找到可行路线')
  }
  const route = data.routes[0]
  return {
    geometry: {
      type: 'Feature',
      properties: {},
      geometry: route.geometry,
    },
    distance: route.distance,
    duration: route.duration,
    distanceText: formatDistance(route.distance),
    durationText: formatDuration(route.duration),
  }
}
