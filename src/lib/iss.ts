/** 国际空间站实时位置与轨迹:wheretheiss.at(免费,无需密钥,CORS 开放) */

export interface IssPosition {
  lng: number
  lat: number
  /** 海拔(公里) */
  altitudeKm: number
  /** 速度(km/h) */
  velocityKmh: number
  /** 日照状态:daylight / eclipsed */
  visibility: string
  timestamp: number
}

interface IssApiItem {
  latitude: number
  longitude: number
  altitude: number
  velocity: number
  visibility: string
  timestamp: number
}

const BASE = 'https://api.wheretheiss.at/v1/satellites/25544'

function toPosition(d: IssApiItem): IssPosition {
  return {
    lng: d.longitude,
    lat: d.latitude,
    altitudeKm: d.altitude,
    velocityKmh: d.velocity,
    visibility: d.visibility,
    timestamp: d.timestamp,
  }
}

/** 当前位置 */
export async function fetchIssNow(signal?: AbortSignal): Promise<IssPosition> {
  const res = await fetch(BASE, { signal })
  if (!res.ok) throw new Error(`ISS 服务异常: ${res.status}`)
  return toPosition((await res.json()) as IssApiItem)
}

/**
 * 未来/过去约 ±46 分钟的地面轨迹(约一整圈轨道)。
 * 接口单次最多 10 个时间戳,分 3 批串行请求(遵守 1 req/s 限流)。
 */
export async function fetchIssTrack(signal?: AbortSignal): Promise<[number, number][]> {
  const now = Math.floor(Date.now() / 1000)
  const span = 46 * 60
  const step = Math.floor((span * 2) / 29)
  const stamps: number[] = []
  for (let t = now - span; t <= now + span; t += step) stamps.push(t)

  const coords: [number, number][] = []
  for (let i = 0; i < stamps.length; i += 10) {
    const batch = stamps.slice(i, i + 10)
    const res = await fetch(`${BASE}/positions?timestamps=${batch.join(',')}`, { signal })
    if (!res.ok) throw new Error(`ISS 轨迹服务异常: ${res.status}`)
    const items = (await res.json()) as IssApiItem[]
    for (const d of items) coords.push([d.longitude, d.latitude])
  }
  return coords
}

/**
 * 按反子午线拆分轨迹:相邻两点经度差 >180° 时断开,
 * 避免地图上出现横穿全图的直线(纯函数,便于测试)
 */
export function splitAtAntimeridian(coords: [number, number][]): [number, number][][] {
  const segments: [number, number][][] = []
  let current: [number, number][] = []
  for (const c of coords) {
    const prev = current[current.length - 1]
    if (prev && Math.abs(c[0] - prev[0]) > 180) {
      if (current.length >= 2) segments.push(current)
      current = []
    }
    current.push(c)
  }
  if (current.length >= 2) segments.push(current)
  return segments
}
