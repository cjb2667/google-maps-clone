import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchRoute, formatDuration, type RoutePoint } from './routing'

const A: RoutePoint = { lng: 116.397, lat: 39.908, label: 'A' }
const B: RoutePoint = { lng: 116.407, lat: 39.918, label: 'B' }

describe('formatDuration', () => {
  it('小于 1 分钟', () => {
    expect(formatDuration(30)).toBe('不到 1 分钟')
  })

  it('分钟', () => {
    expect(formatDuration(150)).toBe('3 分钟')
  })

  it('整小时', () => {
    expect(formatDuration(7200)).toBe('2 小时')
  })

  it('小时 + 分钟', () => {
    expect(formatDuration(3900)).toBe('1 小时 5 分钟')
  })
})

describe('fetchRoute', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('起终点过近时直接抛错,不发请求', async () => {
    const spy = vi.spyOn(globalThis, 'fetch')
    await expect(fetchRoute(A, { ...A, label: 'B' }, 'driving')).rejects.toThrow('距离过近')
    expect(spy).not.toHaveBeenCalled()
  })

  it('正常解析 OSRM 响应', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'Ok',
          routes: [
            {
              distance: 2014.4,
              duration: 196.9,
              geometry: {
                type: 'LineString',
                coordinates: [
                  [116.397, 39.908],
                  [116.407, 39.918],
                ],
              },
            },
          ],
        }),
      ),
    )
    const result = await fetchRoute(A, B, 'driving')
    expect(result.distance).toBeCloseTo(2014.4)
    expect(result.durationText).toBe('3 分钟')
    expect(result.geometry.geometry.coordinates).toHaveLength(2)
  })

  it('OSRM 返回非 Ok 时抛出其 message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: 'NoRoute', message: 'No route found' })),
    )
    await expect(fetchRoute(A, B, 'walking')).rejects.toThrow('No route found')
  })

  it('HTTP 错误时抛出状态码', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 503 }))
    await expect(fetchRoute(A, B, 'cycling')).rejects.toThrow('503')
  })
})
