import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchPlaces } from './geocode'

const ITEM = {
  place_id: 1,
  display_name: '天安门, 东城区, 北京市, 中国',
  lat: '39.9087',
  lon: '116.3975',
  boundingbox: ['39.90', '39.92', '116.39', '116.41'] as [string, string, string, string],
}

describe('searchPlaces', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('解析主名称/次名称与 bbox 顺序([w,s,e,n])', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify([ITEM])))
    const [r] = await searchPlaces('天安门')
    expect(r.primaryName).toBe('天安门')
    expect(r.secondaryName).toBe('东城区, 北京市, 中国')
    expect(r.lng).toBeCloseTo(116.3975)
    // Nominatim boundingbox 是 [south, north, west, east],需转成 [w, s, e, n]
    expect(r.bbox).toEqual([116.39, 39.9, 116.41, 39.92])
  })

  it('无 boundingbox 时 bbox 为 null', async () => {
    const noBox = { ...ITEM, boundingbox: undefined }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify([noBox])))
    const [r] = await searchPlaces('x')
    expect(r.bbox).toBeNull()
  })

  it('带 viewbox 时请求包含 viewbox 与 bounded=0', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify([])))
    await searchPlaces('咖啡', { viewbox: [116.3, 39.8, 116.5, 40.0] })
    const url = String(spy.mock.calls[0][0])
    expect(url).toContain('viewbox=116.3%2C39.8%2C116.5%2C40')
    expect(url).toContain('bounded=0')
  })

  it('429 时抛出限流提示', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 429 }))
    await expect(searchPlaces('x')).rejects.toThrow('频繁')
  })
})
