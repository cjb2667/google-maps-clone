/** 地理计算工具:大圆距离、球面多边形面积与格式化 */

/** 地球平均半径(米) */
const EARTH_RADIUS = 6371008.8

const toRad = (deg: number) => (deg * Math.PI) / 180

/** 两点间大圆距离(Haversine 公式),单位:米 */
export function haversine(a: [number, number], b: [number, number]): number {
  const [lng1, lat1] = a
  const [lng2, lat2] = b
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(h))
}

/** 折线总长度(米);closed 为 true 时把末点到首点的闭合段也计入 */
export function pathLength(coords: [number, number][], closed = false): number {
  let total = 0
  for (let i = 1; i < coords.length; i++) {
    total += haversine(coords[i - 1], coords[i])
  }
  if (closed && coords.length >= 3) {
    total += haversine(coords[coords.length - 1], coords[0])
  }
  return total
}

/**
 * 球面多边形面积(平方米),坐标为 [lng, lat] 环(无需重复首点)。
 * 采用与 turf.js 相同的球面近似算法
 */
export function polygonArea(coords: [number, number][]): number {
  if (coords.length < 3) return 0
  let total = 0
  for (let i = 0; i < coords.length; i++) {
    const p1 = coords[i]
    const p2 = coords[(i + 1) % coords.length]
    total += (toRad(p2[0]) - toRad(p1[0])) * (2 + Math.sin(toRad(p1[1])) + Math.sin(toRad(p2[1])))
  }
  return Math.abs((total * EARTH_RADIUS * EARTH_RADIUS) / 2)
}

/**
 * 球面插值(Slerp):沿大圆弧从 a 到 b,t∈[0,1],返回 [lng, lat]。
 * 用于飞行模式沿最短航线推进相机
 */
export function slerp(a: [number, number], b: [number, number], t: number): [number, number] {
  const toVec = ([lng, lat]: [number, number]) => {
    const φ = toRad(lat)
    const λ = toRad(lng)
    return [Math.cos(φ) * Math.cos(λ), Math.cos(φ) * Math.sin(λ), Math.sin(φ)]
  }
  const va = toVec(a)
  const vb = toVec(b)
  const dot = Math.min(1, Math.max(-1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]))
  const ω = Math.acos(dot)
  // 两点几乎重合时退化为线性插值,避免除零
  if (ω < 1e-9) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
  }
  const k1 = Math.sin((1 - t) * ω) / Math.sin(ω)
  const k2 = Math.sin(t * ω) / Math.sin(ω)
  const x = k1 * va[0] + k2 * vb[0]
  const y = k1 * va[1] + k2 * vb[1]
  const z = k1 * va[2] + k2 * vb[2]
  const lat = (Math.atan2(z, Math.sqrt(x * x + y * y)) * 180) / Math.PI
  const lng = (Math.atan2(y, x) * 180) / Math.PI
  return [lng, lat]
}

/** a 指向 b 的初始方位角(度,0=正北,顺时针) */
export function bearingBetween(a: [number, number], b: [number, number]): number {
  const φ1 = toRad(a[1])
  const φ2 = toRad(b[1])
  const Δλ = toRad(b[0] - a[0])
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

/** 距离格式化:小于 1km 显示米,否则显示公里 */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters.toFixed(meters < 100 ? 1 : 0)} 米`
  return `${(meters / 1000).toFixed(2)} 公里`
}

/** 面积格式化:小于 1km² 显示平方米,否则显示平方公里 */
export function formatArea(sqMeters: number): string {
  if (sqMeters < 1_000_000) return `${sqMeters.toFixed(0)} 平方米`
  return `${(sqMeters / 1_000_000).toFixed(2)} 平方公里`
}
