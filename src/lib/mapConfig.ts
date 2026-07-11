import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl'
import type { Feature, Polygon } from 'geojson'

/** 图层类型:路网(roadmap)与卫星(satellite) */
export type LayerType = 'roadmap' | 'satellite'

/** OpenFreeMap 矢量样式(免费无需密钥,基于 OpenMapTiles) */
export const VECTOR_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

/** 路网图层署名 */
export const ROADMAP_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> 贡献者 © <a href="https://openfreemap.org/" target="_blank">OpenFreeMap</a>'

/** 卫星图层署名 */
export const SATELLITE_ATTRIBUTION =
  '© <a href="https://www.esri.com/" target="_blank">Esri</a> — Source: Esri, Maxar, Earthstar Geographics'

/** 卫星 source / layer id */
export const SATELLITE_SOURCE = 'satellite'
export const SATELLITE_LAYER_ID = 'satellite-tiles'

/** 3D 地形相关的 source / layer id */
export const TERRAIN_SOURCE = 'terrain-dem'
export const HILLSHADE_SOURCE = 'hillshade-dem'
export const HILLSHADE_LAYER_ID = 'hillshade'

/** 地形夸张系数 */
export const TERRAIN_EXAGGERATION = 1.3

/** AWS 开放高程瓦片(Terrarium 编码) */
const DEM_TILES = ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png']

const SATELLITE_TILES = [
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
]

/** 样式加载时记录的主图各层原始可见性(不含卫星层) */
export type VisibilitySnapshot = Record<string, 'visible' | 'none'>

let mainSnapshot: VisibilitySnapshot = {}

/** 模块级样式缓存:主图 / 卷帘 / StrictMode 双挂载共享一次网络请求 */
let stylePromise: Promise<StyleSpecification> | null = null

async function fetchStyleWithSatellite(): Promise<StyleSpecification> {
  const res = await fetch(VECTOR_STYLE_URL)
  if (!res.ok) throw new Error(`矢量样式加载失败: ${res.status}`)
  const style = (await res.json()) as StyleSpecification

  style.sources = {
    ...style.sources,
    [SATELLITE_SOURCE]: {
      type: 'raster',
      tiles: SATELLITE_TILES,
      tileSize: 256,
      maxzoom: 19,
    },
  }

  const layers = [...(style.layers ?? [])]
  const satLayer: StyleSpecification['layers'][number] = {
    id: SATELLITE_LAYER_ID,
    type: 'raster',
    source: SATELLITE_SOURCE,
    layout: { visibility: 'none' },
  }
  // 插在 background 之后,卫星模式下盖住底色
  const bgIdx = layers.findIndex((l) => l.id === 'background')
  if (bgIdx >= 0) layers.splice(bgIdx + 1, 0, satLayer)
  else layers.unshift(satLayer)
  style.layers = layers
  return style
}

/**
 * 拉取 OpenFreeMap 矢量样式并注入卫星栅格层(默认隐藏)。
 * 结果缓存;每次返回深拷贝,避免多张地图共享可变对象。
 */
export async function loadMapStyle(): Promise<StyleSpecification> {
  if (!stylePromise) {
    stylePromise = fetchStyleWithSatellite().catch((err) => {
      // 失败不缓存,下次可重试
      stylePromise = null
      throw err
    })
  }
  const style = await stylePromise
  return JSON.parse(JSON.stringify(style)) as StyleSpecification
}

/** 生成卷帘对比图样式:复用缓存,按指定底图预置可见性 */
export async function loadCompareStyle(visibleLayer: LayerType): Promise<StyleSpecification> {
  const style = await loadMapStyle()
  for (const layer of style.layers) {
    if (layer.id === SATELLITE_LAYER_ID) {
      layer.layout = {
        ...layer.layout,
        visibility: visibleLayer === 'satellite' ? 'visible' : 'none',
      }
    } else if (visibleLayer === 'satellite') {
      layer.layout = { ...layer.layout, visibility: 'none' }
    }
  }
  return style
}

/** 记录一张地图当前各层可见性(卫星层除外),供底图切换时按原样恢复 */
export function captureVisibilitySnapshot(map: MapLibreMap): VisibilitySnapshot {
  const snap: VisibilitySnapshot = {}
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.id === SATELLITE_LAYER_ID) continue
    snap[layer.id] =
      (layer.layout as { visibility?: 'visible' | 'none' } | undefined)?.visibility ?? 'visible'
  }
  return snap
}

/** 主图 load 后调用:保存矢量层可见性快照 */
export function captureBasemapLayerIds(map: MapLibreMap): void {
  mainSnapshot = captureVisibilitySnapshot(map)
}

/**
 * 按快照切换路网(矢量) / 卫星:
 * 切回路网时恢复各层原始可见性,而非一律设为 visible
 */
export function applyBasemapVisibility(
  map: MapLibreMap,
  snapshot: VisibilitySnapshot,
  layer: LayerType,
): void {
  const showRoad = layer === 'roadmap'
  for (const [id, vis] of Object.entries(snapshot)) {
    if (!map.getLayer(id) || id === HILLSHADE_LAYER_ID) continue
    map.setLayoutProperty(id, 'visibility', showRoad ? vis : 'none')
  }
  if (map.getLayer(SATELLITE_LAYER_ID)) {
    map.setLayoutProperty(SATELLITE_LAYER_ID, 'visibility', showRoad ? 'none' : 'visible')
  }
}

/** 主图切换路网 / 卫星 */
export function setBasemap(map: MapLibreMap, layer: LayerType): void {
  applyBasemapVisibility(map, mainSnapshot, layer)
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
    // 插在业务图层(路线/测距/定位)之下,避免山影盖住它们
    const businessLayer = (map.getStyle().layers ?? []).find((l) =>
      /^(directions-|measure-|user-)/.test(l.id),
    )
    map.addLayer(
      {
        id: HILLSHADE_LAYER_ID,
        type: 'hillshade',
        source: HILLSHADE_SOURCE,
        layout: { visibility: 'none' },
        paint: { 'hillshade-exaggeration': 0.4 },
      },
      businessLayer?.id,
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
