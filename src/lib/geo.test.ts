import { describe, expect, it } from 'vitest'
import { formatArea, formatDistance, haversine, pathLength, polygonArea } from './geo'

describe('haversine', () => {
  it('同一点距离为 0', () => {
    expect(haversine([116.4, 39.9], [116.4, 39.9])).toBe(0)
  })

  it('北京到上海约 1067 公里', () => {
    const d = haversine([116.4074, 39.9042], [121.4737, 31.2304])
    expect(d).toBeGreaterThan(1_050_000)
    expect(d).toBeLessThan(1_090_000)
  })

  it('赤道上经度差 1 度约 111.3 公里', () => {
    const d = haversine([0, 0], [1, 0])
    expect(d).toBeGreaterThan(111_000)
    expect(d).toBeLessThan(112_000)
  })
})

describe('pathLength', () => {
  const square: [number, number][] = [
    [0, 0],
    [0.01, 0],
    [0.01, 0.01],
    [0, 0.01],
  ]

  it('少于 2 点长度为 0', () => {
    expect(pathLength([])).toBe(0)
    expect(pathLength([[0, 0]])).toBe(0)
  })

  it('闭合路径比开放路径多一段', () => {
    const open = pathLength(square, false)
    const closed = pathLength(square, true)
    expect(closed).toBeGreaterThan(open)
    expect(closed - open).toBeCloseTo(haversine(square[3], square[0]), 6)
  })
})

describe('polygonArea', () => {
  it('少于 3 点面积为 0', () => {
    expect(polygonArea([])).toBe(0)
    expect(
      polygonArea([
        [0, 0],
        [1, 1],
      ]),
    ).toBe(0)
  })

  it('赤道附近 0.01°×0.01° 方块约 1.23 平方公里', () => {
    const area = polygonArea([
      [0, 0],
      [0.01, 0],
      [0.01, 0.01],
      [0, 0.01],
    ])
    expect(area).toBeGreaterThan(1_180_000)
    expect(area).toBeLessThan(1_280_000)
  })

  it('顶点顺序(顺/逆时针)不影响面积', () => {
    const cw: [number, number][] = [
      [0, 0],
      [0, 0.01],
      [0.01, 0.01],
      [0.01, 0],
    ]
    const ccw = [...cw].reverse() as [number, number][]
    expect(polygonArea(cw)).toBeCloseTo(polygonArea(ccw), 6)
  })
})

describe('formatDistance', () => {
  it('小于 100 米保留 1 位小数', () => {
    expect(formatDistance(56.78)).toBe('56.8 米')
  })

  it('100-1000 米取整', () => {
    expect(formatDistance(345.6)).toBe('346 米')
  })

  it('超过 1 公里显示公里', () => {
    expect(formatDistance(1234)).toBe('1.23 公里')
  })
})

describe('formatArea', () => {
  it('小于 1 平方公里显示平方米', () => {
    expect(formatArea(999_999)).toBe('999999 平方米')
  })

  it('超过 1 平方公里显示平方公里', () => {
    expect(formatArea(2_500_000)).toBe('2.50 平方公里')
  })
})
