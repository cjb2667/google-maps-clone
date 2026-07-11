import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl'
import type { Feature, Polygon } from 'geojson'
import type { Theme } from './theme'

/** 图层类型:路网(roadmap)与卫星(satellite) */
export type LayerType = 'roadmap' | 'satellite'

/** 地图展示状态:底图 + 日夜主题 */
export interface MapDisplay {
  basemap: LayerType
  theme: Theme
}

/** OpenFreeMap 矢量样式(免费无需密钥,基于 OpenMapTiles) */
export const VECTOR_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
/** OpenFreeMap 暗色矢量样式(与 liberty 同源同字体,可合并进同一 style) */
export const DARK_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark'

/** 路网图层署名 */
export const ROADMAP_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> 贡献者 © <a href="https://openfreemap.org/" target="_blank">OpenFreeMap</a>'

/** 卫星图层署名 */
export const SATELLITE_ATTRIBUTION =
  '© <a href="https://www.esri.com/" target="_blank">Esri</a> — Source: Esri, Maxar, Earthstar Geographics'

/** 天气数据署名 */
export const WEATHER_ATTRIBUTION =
  '雷达 © <a href="https://www.rainviewer.com/" target="_blank">RainViewer</a> · 天气 © <a href="https://open-meteo.com/" target="_blank">Open-Meteo</a>'

/** 卫星 source / layer id */
export const SATELLITE_SOURCE = 'satellite'
export const SATELLITE_LAYER_ID = 'satellite-tiles'

/** 3D 地形相关的 source / layer id */
export const TERRAIN_SOURCE = 'terrain-dem'
export const HILLSHADE_SOURCE = 'hillshade-dem'
export const HILLSHADE_LAYER_ID = 'hillshade'

/** 暗色主题图层 id 前缀(合并样式时加在 dark 样式所有图层上) */
export const DARK_LAYER_PREFIX = 'dark-'

/** 地形夸张系数 */
export const TERRAIN_EXAGGERATION = 1.3

/** AWS 开放高程瓦片(Terrarium 编码) */
const DEM_TILES = ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png']

const SATELLITE_TILES = [
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
]

/** 各图层在其原始样式中的可见性 */
export type VisibilitySnapshot = Record<string, 'visible' | 'none'>

/** 合并样式中每层的原始可见性(亮/暗图层统一记录,模块级共享) */
let baseVisibility: VisibilitySnapshot = {}
/** 暗色主题图层 id 集合 */
let darkLayerIds = new Set<string>()

/** 模块级样式缓存:主图 / 卷帘 / StrictMode 双挂载共享一次网络请求 */
let stylePromise: Promise<StyleSpecification> | null = null

/** 每张地图当前的展示状态(底图 + 主题) */
const mapDisplays = new WeakMap<MapLibreMap, MapDisplay>()

async function fetchJson(url: string): Promise<StyleSpecification> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`矢量样式加载失败: ${res.status}`)
  return (await res.json()) as StyleSpecification
}

/**
 * 拉取亮色(liberty)与暗色(dark)两套矢量样式并合并为一个 style:
 * - 暗色图层 id 统一加 DARK_LAYER_PREFIX 前缀,避免与亮色冲突
 * - 注入卫星栅格层(排在所有底图层之上、业务层之下)
 * - 同时记录每层原始可见性与暗色图层集合,供日夜/底图切换使用
 * 两套样式共享 sources / glyphs / sprite(已验证一致),可无缝显隐切换
 */
async function fetchCombinedStyle(): Promise<StyleSpecification> {
  const [light, dark] = await Promise.all([fetchJson(VECTOR_STYLE_URL), fetchJson(DARK_STYLE_URL)])

  const visibility: VisibilitySnapshot = {}
  const darkIds = new Set<string>()

  for (const layer of light.layers ?? []) {
    visibility[layer.id] =
      ((layer.layout as { visibility?: 'visible' | 'none' } | undefined)?.visibility) ?? 'visible'
  }

  const darkLayers = (dark.layers ?? []).map((layer) => {
    const renamed = { ...layer, id: `${DARK_LAYER_PREFIX}${layer.id}` }
    visibility[renamed.id] =
      ((renamed.layout as { visibility?: 'visible' | 'none' } | undefined)?.visibility) ??
      'visible'
    darkIds.add(renamed.id)
    return renamed
  })

  const style = light
  style.sources = {
    ...dark.sources,
    ...light.sources,
    [SATELLITE_SOURCE]: {
      type: 'raster',
      tiles: SATELLITE_TILES,
      tileSize: 256,
      maxzoom: 19,
    },
  }
  style.layers = [
    ...(light.layers ?? []),
    ...darkLayers,
    {
      id: SATELLITE_LAYER_ID,
      type: 'raster',
      source: SATELLITE_SOURCE,
      layout: { visibility: 'none' },
    },
  ]

  baseVisibility = visibility
  darkLayerIds = darkIds
  return style
}

/** 按展示状态计算某图层应有的可见性 */
function layerVisibilityFor(id: string, display: MapDisplay): 'visible' | 'none' {
  if (id === SATELLITE_LAYER_ID) {
    return display.basemap === 'satellite' ? 'visible' : 'none'
  }
  if (display.basemap !== 'roadmap') return 'none'
  const isDark = darkLayerIds.has(id)
  if (isDark !== (display.theme === 'dark')) return 'none'
  return baseVisibility[id] ?? 'visible'
}

/**
 * 加载合并样式(缓存 + 深拷贝),并按初始展示状态预置各层可见性,
 * 避免地图创建后再切换导致的闪烁
 */
export async function loadMapStyle(
  display: MapDisplay = { basemap: 'roadmap', theme: 'light' },
): Promise<StyleSpecification> {
  if (!stylePromise) {
    stylePromise = fetchCombinedStyle().catch((err) => {
      // 失败不缓存,下次可重试
      stylePromise = null
      throw err
    })
  }
  const cached = await stylePromise
  const style = JSON.parse(JSON.stringify(cached)) as StyleSpecification
  for (const layer of style.layers) {
    layer.layout = { ...layer.layout, visibility: layerVisibilityFor(layer.id, display) }
  }
  return style
}

/** 地图创建后登记其初始展示状态 */
export function registerMapDisplay(map: MapLibreMap, display: MapDisplay): void {
  mapDisplays.set(map, { ...display })
}

/** 读取地图当前展示状态 */
export function getMapDisplay(map: MapLibreMap): MapDisplay {
  return mapDisplays.get(map) ?? { basemap: 'roadmap', theme: 'light' }
}

/**
 * 应用底图/主题(可部分更新):按合并时记录的原始可见性恢复各层,
 * hillshade 与业务图层(路线/测距/定位/天气)不受影响
 */
export function applyMapDisplay(map: MapLibreMap, patch: Partial<MapDisplay>): void {
  const display = { ...getMapDisplay(map), ...patch }
  mapDisplays.set(map, display)
  for (const id of [...Object.keys(baseVisibility), SATELLITE_LAYER_ID]) {
    if (!map.getLayer(id) || id === HILLSHADE_LAYER_ID) continue
    map.setLayoutProperty(id, 'visibility', layerVisibilityFor(id, display))
  }
}

/** 切换路网 / 卫星 */
export function setBasemap(map: MapLibreMap, layer: LayerType): void {
  applyMapDisplay(map, { basemap: layer })
}

/** 切换日夜主题(仅影响矢量底图) */
export function setMapTheme(map: MapLibreMap, theme: Theme): void {
  applyMapDisplay(map, { theme })
}

/** 找到第一个业务图层(路线/测距/定位/天气),叠加层应插在其下 */
export function firstOverlayLayerId(map: MapLibreMap): string | undefined {
  return (map.getStyle().layers ?? []).find((l) =>
    /^(directions-|measure-|user-|weather-)/.test(l.id),
  )?.id
}

/** 按需挂载 DEM + hillshade(幂等) */
export function ensureTerrainSources(map: MapLibreMap): void {
  if (!map.getSource(TERRAIN_SOURCE)) {
    map.addSource(TERRAIN_SOURCE, {
      type: 'raster-dem',
      tiles: DEM_TILES,
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 15,
    })
  }
  if (!map.getSource(HILLSHADE_SOURCE)) {
    map.addSource(HILLSHADE_SOURCE, {
      type: 'raster-dem',
      tiles: DEM_TILES,
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 15,
    })
  }
  if (!map.getLayer(HILLSHADE_LAYER_ID)) {
    // 插在业务图层之下,避免山影盖住路线/测距/定位
    map.addLayer(
      {
        id: HILLSHADE_LAYER_ID,
        type: 'hillshade',
        source: HILLSHADE_SOURCE,
        layout: { visibility: 'none' },
        paint: { 'hillshade-exaggeration': 0.4 },
      },
      firstOverlayLayerId(map),
    )
  }
}

/** 开启或关闭 3D 地形与山影 */
export function setTerrainEnabled(map: MapLibreMap, enabled: boolean): void {
  if (enabled) {
    ensureTerrainSources(map)
    map.setTerrain({ source: TERRAIN_SOURCE, exaggeration: TERRAIN_EXAGGERATION })
    map.setLayoutProperty(HILLSHADE_LAYER_ID, 'visibility', 'visible')
  } else {
    map.setTerrain(null)
    if (map.getLayer(HILLSHADE_LAYER_ID)) {
      map.setLayoutProperty(HILLSHADE_LAYER_ID, 'visibility', 'none')
    }
  }
}

/** 默认视角:北京 */
export const DEFAULT_CENTER: [number, number] = [116.3972, 39.9075]
export const DEFAULT_ZOOM = 11

/** 以给定经纬度为圆心、meters 为半径生成近似圆形多边形 */
export function circlePolygon(
  center: [number, number],
  meters: number,
  points = 64,
): Feature<Polygon> {
  const [lng, lat] = center
  const degLat = meters / 111320
  const degLng = meters / (111320 * Math.cos((lat * Math.PI) / 180))
  const coords: [number, number][] = []
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * Math.PI * 2
    coords.push([lng + Math.cos(angle) * degLng, lat + Math.sin(angle) * degLat])
  }
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [coords] },
  }
}
