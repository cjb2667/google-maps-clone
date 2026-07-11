/** 实时航班:airplanes.live 社区 ADS-B 数据(免费,无需密钥,CORS 开放) */

export interface Flight {
  /** ICAO 24 位地址(唯一 id) */
  hex: string
  /** 航班号/呼号 */
  callsign: string
  /** 机型描述 */
  aircraftType: string
  lng: number
  lat: number
  /** 航向角(度,0=北) */
  track: number
  /** 气压高度(米) */
  altitudeM: number | null
  /** 地速(km/h) */
  speedKmh: number | null
}

interface AdsbAircraft {
  hex: string
  flight?: string
  desc?: string
  t?: string
  lat?: number
  lon?: number
  track?: number
  alt_baro?: number | 'ground'
  gs?: number
}

const FEET_TO_M = 0.3048
const KNOTS_TO_KMH = 1.852

/** 将 API 原始条目转为展示模型(纯函数,便于测试);无坐标的条目返回 null */
export function parseAircraft(ac: AdsbAircraft): Flight | null {
  if (typeof ac.lat !== 'number' || typeof ac.lon !== 'number') return null
  return {
    hex: ac.hex,
    callsign: (ac.flight ?? '').trim() || ac.hex.toUpperCase(),
    aircraftType: ac.desc ?? ac.t ?? '未知机型',
    lng: ac.lon,
    lat: ac.lat,
    track: typeof ac.track === 'number' ? ac.track : 0,
    altitudeM:
      typeof ac.alt_baro === 'number' ? Math.round(ac.alt_baro * FEET_TO_M) : null,
    speedKmh: typeof ac.gs === 'number' ? Math.round(ac.gs * KNOTS_TO_KMH) : null,
  }
}

/**
 * 拉取以 (lat, lng) 为圆心、radiusNm 海里(最大 250)内的航班。
 * airplanes.live 匿名接口,请保持 ≥10s 轮询间隔。
 */
export async function fetchFlights(
  lat: number,
  lng: number,
  radiusNm: number,
  signal?: AbortSignal,
): Promise<Flight[]> {
  const r = Math.min(250, Math.max(10, Math.round(radiusNm)))
  const url = `https://api.airplanes.live/v2/point/${lat.toFixed(4)}/${lng.toFixed(4)}/${r}`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`航班服务异常: ${res.status}`)
  const data = (await res.json()) as { ac?: AdsbAircraft[] }
  const flights: Flight[] = []
  for (const ac of data.ac ?? []) {
    const f = parseAircraft(ac)
    if (f) flights.push(f)
  }
  return flights
}
