import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl'
import type { Feature, Polygon } from 'geojson'

/** 图层类型:路网(roadmap)与卫星(satellite),对应谷歌地图的"地图/卫星"切换 */
export type LayerType = 'roadmap' | 'satellite'

/** 路网图层署名(OSM 要求) */
export const ROADMAP_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> 贡献者 © <a href="https://carto.com/attributions" target="_blank">CARTO</a>'

/** 卫星图层署名 */
export const SATELLITE_ATTRIBUTION =
  '© <a href="https://www.esri.com/" target="_blank">Esri</a> — Source: Esri, Maxar, Earthstar Geographics'

/** 图层 id 常量,供显隐切换使用 */
export const ROADMAP_LAYER_ID = 'roadmap-tiles'
export const SATELLITE_LAYER_ID = 'satellite-tiles'

/** 3D 地形相关的 source / layer id */
export const TERRAIN_SOURCE = 'terrain-dem'
export const HILLSHADE_SOURCE = 'hillshade-dem'
export const HILLSHADE_LAYER_ID = 'hillshade'

/** 地形夸张系数:略微放大高差,视觉更震撼 */
export const TERRAIN_EXAGGERATION = 1.3

/** AWS 开放高程瓦片(Terrarium 编码,免费无需密钥) */
const DEM_TILES = ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png']

/** 低 DPR 或省流模式用 1x 瓦片,否则用 @2x */
function roadmapTileUrls(): string[] {
  const saveData =
    typeof navigator !== 'undefined' &&
    (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
  const lowDpr = typeof window !== 'undefined' && window.devicePixelRatio < 1.5
  const suffix = saveData || lowDpr ? '.png' : '@2x.png'
  return ['a', 'b', 'c', 'd'].map(
    (s) => `https://${s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}${suffix}`,
  )
}

/**
 * 地图样式:仅含路网与卫星栅格源。
 * DEM / hillshade 在首次开启 3D 时再挂载,避免冷启动拉高程瓦片。
 */
export const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    // 路网:CARTO Voyager 栅格瓦片,配色接近谷歌地图默认样式,免费无需密钥
    roadmap: {
      type: 'raster',
      tiles: roadmapTileUrls(),
      tileSize: 256,
      maxzoom: 20,
    },
    // 卫星:Esri World Imagery 瓦片,免费无需密钥
    satellite: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: ROADMAP_LAYER_ID,
      type: 'raster',
      source: 'roadmap',
      layout: { visibility: 'visible' },
    },
    {
      id: SATELLITE_LAYER_ID,
      type: 'raster',
      source: 'satellite',
      // 卫星图层默认隐藏
      layout: { visibility: 'none' },
    },
  ],
}

/**
 * 按需挂载 DEM + hillshade(幂等)。
 * 开启 3D 地形前调用,避免首屏加载高程瓦片。
 */
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
      // 山体阴影放在两种底图之上,卫星 + 3D 时也能看见立体感
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

/**
 * 生成指定底图可见的样式副本(供卷帘对比的第二张地图使用)
 */
export function makeStyle(visibleLayer: LayerType): StyleSpecification {
  const style = JSON.parse(JSON.stringify(MAP_STYLE)) as StyleSpecification
  for (const layer of style.layers) {
    if (layer.id === ROADMAP_LAYER_ID || layer.id === SATELLITE_LAYER_ID) {
      layer.layout = {
        ...layer.layout,
        visibility:
          (layer.id === ROADMAP_LAYER_ID) === (visibleLayer === 'roadmap') ? 'visible' : 'none',
      }
    }
  }
  return style
}

/** 默认视角:北京 */
export const DEFAULT_CENTER: [number, number] = [116.3972, 39.9075]
export const DEFAULT_ZOOM = 11

/**
 * 以给定经纬度为圆心、meters 为半径生成近似圆形多边形(GeoJSON),
 * 用于绘制定位精度圈
 */
export function circlePolygon(
  center: [number, number],
  meters: number,
  points = 64,
): Feature<Polygon> {
  const [lng, lat] = center
  // 每度纬度约 111320 米;经度需按纬度余弦修正
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
