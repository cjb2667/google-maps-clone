/** 地点搜索:基于 OSM Nominatim 免费地理编码服务(无需密钥) */

export interface GeocodeResult {
  /** 唯一 id(place_id) */
  id: number
  /** 展示名称(完整地址) */
  displayName: string
  /** 主名称(第一段,用于下拉列表加粗展示) */
  primaryName: string
  /** 除主名称外的地址剩余部分 */
  secondaryName: string
  /** 经度 */
  lng: number
  /** 纬度 */
  lat: number
  /** 建议缩放的边界框 [west, south, east, north],可能为空 */
  bbox: [number, number, number, number] | null
}

/** Nominatim 返回的原始条目(只声明用到的字段) */
interface NominatimItem {
  place_id: number
  display_name: string
  lat: string
  lon: string
  boundingbox?: [string, string, string, string]
}

/**
 * 搜索地点,返回最多 limit 条结果。
 * 传入 AbortSignal 以便在用户继续输入时取消过期请求。
 */
export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
  limit = 5,
): Promise<GeocodeResult[]> {
  const params = new URLSearchParams({
    format: 'jsonv2',
    q: query,
    limit: String(limit),
    // 优先返回中文名称
    'accept-language': 'zh-CN,zh,en',
  })
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { signal })
  if (!res.ok) throw new Error(`搜索服务响应异常: ${res.status}`)
  const items = (await res.json()) as NominatimItem[]

  return items.map((item) => {
    const [primaryName, ...rest] = item.display_name.split(', ')
    // Nominatim 的 boundingbox 顺序为 [south, north, west, east]
    const bb = item.boundingbox
    return {
      id: item.place_id,
      displayName: item.display_name,
      primaryName,
      secondaryName: rest.join(', '),
      lng: parseFloat(item.lon),
      lat: parseFloat(item.lat),
      bbox: bb
        ? [parseFloat(bb[2]), parseFloat(bb[0]), parseFloat(bb[3]), parseFloat(bb[1])]
        : null,
    }
  })
}
