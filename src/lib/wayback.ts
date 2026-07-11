/** Esri World Imagery Wayback:历史卫星影像存档(免费,无需密钥) */

const CONFIG_URL =
  'https://s3-us-west-2.amazonaws.com/config.maptiles.arcgis.com/waybackconfig.json'

export interface WaybackRelease {
  /** WMTS release 编号 */
  releaseNum: number
  /** 影像发布日期(YYYY-MM-DD) */
  date: string
  /** 年份,用于时间轴展示 */
  year: number
  /** 瓦片 URL 模板({z}/{y}/{x}) */
  tileUrl: string
}

interface WaybackConfigItem {
  itemTitle: string
  itemURL: string
}

/** 从 itemTitle(如 "World Imagery (Wayback 2014-02-20)")提取日期 */
function parseDate(title: string): string | null {
  const m = title.match(/(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

/** 解析配置为按日期升序的 release 列表(纯函数,便于测试) */
export function parseWaybackConfig(config: Record<string, WaybackConfigItem>): WaybackRelease[] {
  const releases: WaybackRelease[] = []
  for (const [key, item] of Object.entries(config)) {
    const date = parseDate(item.itemTitle)
    if (!date || !item.itemURL) continue
    releases.push({
      releaseNum: Number(key),
      date,
      year: Number(date.slice(0, 4)),
      tileUrl: item.itemURL
        .replace('{level}', '{z}')
        .replace('{row}', '{y}')
        .replace('{col}', '{x}'),
    })
  }
  releases.sort((a, b) => a.date.localeCompare(b.date))
  return releases
}

/** 每年取最后一个 release,作为时间轴刻度(纯函数,便于测试) */
export function pickYearlyReleases(releases: WaybackRelease[]): WaybackRelease[] {
  const byYear = new Map<number, WaybackRelease>()
  for (const r of releases) {
    // 列表已按日期升序,后写入的覆盖前面 → 得到每年最后一版
    byYear.set(r.year, r)
  }
  return [...byYear.values()].sort((a, b) => a.date.localeCompare(b.date))
}

let releasesPromise: Promise<WaybackRelease[]> | null = null

/** 拉取并缓存年度 release 列表 */
export async function fetchYearlyReleases(): Promise<WaybackRelease[]> {
  if (!releasesPromise) {
    releasesPromise = (async () => {
      const res = await fetch(CONFIG_URL)
      if (!res.ok) throw new Error(`Wayback 配置加载失败: ${res.status}`)
      const config = (await res.json()) as Record<string, WaybackConfigItem>
      const yearly = pickYearlyReleases(parseWaybackConfig(config))
      if (yearly.length === 0) throw new Error('Wayback 配置为空')
      return yearly
    })().catch((err) => {
      releasesPromise = null
      throw err
    })
  }
  return releasesPromise
}
