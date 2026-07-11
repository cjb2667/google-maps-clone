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

/** 样式加载时记录的矢量底图层 id(不含卫星/自定义业务层) */
let basemapLayerIds: string[] = []

/**
 * 拉取 OpenFreeMap 矢量样式,并注入卫星栅格层(默认隐藏)。
 * 通过显隐切换路网/卫星,避免 setStyle 导致业务图层丢失。
 */
export async function loadMapStyle(): Promise<StyleSpecification> {
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

/** 地图 load 后调用:记下当前底图层,供路网/卫星切换 */
export function captureBasemapLayerIds(map: MapLibreMap): void {
  basemapLayerIds = (map.getStyle().layers ?? [])
    .map((l) => l.id)
    .filter((id) => id !== SATELLITE_LAYER_ID)
}

/** 切换路网(矢量) / 卫星;山影由地形开关单独控制 */
export function setBasemap(map: MapLibreMap, layer: LayerType): void {
  const showRoad = layer === 'roadmap'
  for (const id of basemapLayerIds) {
    if (!map.getLayer(id) || id === HILLSHADE_LAYER_ID) continue
    map.setLayoutProperty(id, 'visibility', showRoad ? 'visible' : 'none')
  }
  if (map.getLayer(SATELLITE_LAYER_ID)) {
    map.setLayoutProperty(SATELLITE_LAYER_ID, 'visibility', showRoad ? 'none' : 'visible')
  }
}

/** 仅卫星的样式(供卷帘对比图使用) */
export function makeSatelliteStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      [SATELLITE_SOURCE]: {
        type: 'raster',
        tiles: SATELLITE_TILES,
        tileSize: 256,
        maxzoom: 19,
      },
    },
    layers: [
      {
        id: SATELLITE_LAYER_ID,
        type: 'raster',
        source: SATELLITE_SOURCE,
        layout: { visibility: 'visible' },
      },
    ],
  }
}

/**
 * 生成卷帘对比图样式:路网用矢量 URL,卫星用栅格样式。
 * 返回 string 时 MapLibre 会自行拉取样式 JSON。
 */
export function makeCompareStyle(visibleLayer: LayerType): string | StyleSpecification {
  return visibleLayer === 'roadmap' ? VECTOR_STYLE_URL : makeSatelliteStyle()
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
    map.addLayer({
      id: HILLSHADE_LAYER_ID,
      type: 'hillshade',
      source: HILLSHADE_SOURCE,
      layout: { visibility: 'none' },
      paint: { 'hillshade-exaggeration': 0.4 },
    })
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
