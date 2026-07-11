import type { Map as MapLibreMap } from 'maplibre-gl'
import { bearingBetween, haversine, slerp } from './geo'

/** 飞行动画句柄:可随时取消 */
export interface FlightHandle {
  cancel: () => void
}

interface FlightOptions {
  /** 每个阶段结束的回调(用于 UI 提示) */
  onFinish?: () => void
}

/** 缓动:三次方先加速后减速 */
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
const easeIn = (t: number) => t * t * t

/**
 * 两点间电影式飞行:起飞(拉升俯冲视角)→ 巡航(沿大圆航线、机头朝向前方)→ 降落。
 * 全程手动驱动 rAF,不依赖 flyTo,便于控制俯仰与航向
 */
export function startFlight(
  map: MapLibreMap,
  from: [number, number],
  to: [number, number],
  { onFinish }: FlightOptions = {},
): FlightHandle {
  const distance = haversine(from, to)

  // 按距离决定巡航高度(zoom)与时长:越远飞得越高、越久
  const cruiseZoom = Math.max(3, 11 - Math.log2(Math.max(1, distance / 10000)))
  const groundZoom = 14
  const takeoffMs = 2200
  const cruiseMs = Math.min(14000, Math.max(3500, distance / 350))
  const landMs = 2600

  let raf = 0
  let cancelled = false
  let phase: 'takeoff' | 'cruise' | 'land' = 'takeoff'
  let phaseStart = performance.now()

  // 巡航段的航向随位置更新;起飞时从当前 bearing 平滑转向航线方向
  const initialBearing = map.getBearing()
  const routeBearing = bearingBetween(from, to)
  /** 角度插值(走最短方向) */
  const lerpAngle = (a: number, b: number, t: number) => {
    let d = ((b - a + 540) % 360) - 180
    return a + d * t
  }

  const stop = () => {
    cancelled = true
    cancelAnimationFrame(raf)
  }

  // 用户主动拖拽/缩放时取消飞行
  const onUserInput = () => {
    stop()
    detach()
    onFinish?.()
  }
  const detach = () => {
    map.off('mousedown', onUserInput)
    map.off('wheel', onUserInput)
    map.off('touchstart', onUserInput)
  }
  map.on('mousedown', onUserInput)
  map.on('wheel', onUserInput)
  map.on('touchstart', onUserInput)

  const frame = (now: number) => {
    if (cancelled) return

    if (phase === 'takeoff') {
      const t = Math.min(1, (now - phaseStart) / takeoffMs)
      const e = easeInOut(t)
      map.jumpTo({
        center: from,
        zoom: groundZoom + (cruiseZoom - groundZoom) * e,
        pitch: 60 * easeOut(t),
        bearing: lerpAngle(initialBearing, routeBearing, e),
      })
      if (t >= 1) {
        phase = 'cruise'
        phaseStart = now
      }
    } else if (phase === 'cruise') {
      const t = Math.min(1, (now - phaseStart) / cruiseMs)
      const e = easeInOut(t)
      const pos = slerp(from, to, e)
      // 机头朝向:当前位置指向稍前方的点
      const ahead = slerp(from, to, Math.min(1, e + 0.02))
      map.jumpTo({
        center: pos,
        zoom: cruiseZoom,
        pitch: 60,
        bearing: bearingBetween(pos, ahead),
      })
      if (t >= 1) {
        phase = 'land'
        phaseStart = now
      }
    } else {
      const t = Math.min(1, (now - phaseStart) / landMs)
      const e = easeInOut(t)
      map.jumpTo({
        center: to,
        zoom: cruiseZoom + (groundZoom - cruiseZoom) * e,
        // 降落时俯仰角逐渐回平
        pitch: 60 * (1 - easeIn(t)),
        bearing: lerpAngle(bearingBetween(from, to), 0, e),
      })
      if (t >= 1) {
        detach()
        onFinish?.()
        return
      }
    }
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)

  return {
    cancel: () => {
      stop()
      detach()
    },
  }
}
