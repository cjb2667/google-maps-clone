import { describe, expect, it } from 'vitest'
import { splitAtAntimeridian } from './iss'
import { parseAircraft } from './flights'

describe('splitAtAntimeridian', () => {
  it('不跨反子午线时保持单段', () => {
    const coords: [number, number][] = [
      [10, 0],
      [20, 5],
      [30, 10],
    ]
    expect(splitAtAntimeridian(coords)).toEqual([coords])
  })

  it('经度跳变 >180° 时拆分为两段', () => {
    const coords: [number, number][] = [
      [170, 0],
      [179, 2],
      [-179, 4],
      [-170, 6],
    ]
    const segments = splitAtAntimeridian(coords)
    expect(segments).toHaveLength(2)
    expect(segments[0]).toEqual([
      [170, 0],
      [179, 2],
    ])
    expect(segments[1]).toEqual([
      [-179, 4],
      [-170, 6],
    ])
  })

  it('丢弃不足 2 点的碎段', () => {
    const coords: [number, number][] = [
      [179, 0],
      [-179, 1],
    ]
    // 拆分后两段各只有 1 个点,全部丢弃
    expect(splitAtAntimeridian(coords)).toEqual([])
  })
})

describe('parseAircraft', () => {
  it('转换单位:英尺→米,节→km/h', () => {
    const f = parseAircraft({
      hex: 'abc123',
      flight: 'CCA1234 ',
      desc: 'AIRBUS A-320',
      lat: 30.5,
      lon: 120.2,
      track: 270,
      alt_baro: 38000,
      gs: 431.6,
    })
    expect(f).not.toBeNull()
    expect(f!.callsign).toBe('CCA1234')
    expect(f!.altitudeM).toBe(Math.round(38000 * 0.3048))
    expect(f!.speedKmh).toBe(Math.round(431.6 * 1.852))
  })

  it('无坐标时返回 null', () => {
    expect(parseAircraft({ hex: 'abc' })).toBeNull()
  })

  it('地面状态(alt_baro="ground")高度为 null,无呼号回退 hex', () => {
    const f = parseAircraft({ hex: 'def456', lat: 1, lon: 2, alt_baro: 'ground' })
    expect(f!.altitudeM).toBeNull()
    expect(f!.callsign).toBe('DEF456')
  })
})
