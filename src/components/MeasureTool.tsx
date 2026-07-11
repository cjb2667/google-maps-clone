import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import type { Feature, FeatureCollection, LineString } from 'geojson'
import { formatArea, formatDistance, haversine, pathLength, polygonArea } from '../lib/geo'
import { useMap } from '../lib/useMap'
import '../styles/measure.css'

interface MeasureToolProps {
  active: boolean
  /** 用户点击"退出"或按 Esc 时回调,由父组件关闭测量模式 */
  onExit: () => void
}

/** 测量相关的 source / layer id */
const GEO_SOURCE = 'measure-geo'
const PTS_SOURCE = 'measure-pts'
const PREVIEW_SOURCE = 'measure-preview'
const FILL_LAYER = 'measure-fill'
const LINE_LAYER = 'measure-line'
const PREVIEW_LAYER = 'measure-preview-line'
const PTS_HALO_LAYER = 'measure-pts-halo'
const PTS_CORE_LAYER = 'measure-pts-core'

/** 面板展示用的统计数据 */
interface Stats {
  count: number
  total: number
  area: number | null
  drawing: boolean
}

const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] }

/**
 * 测距/测面积工具:
 * 点击加点、双击结束、点击起点闭合成多边形测面积、拖拽顶点实时调整,
 * 每段中点用 HTML 标签显示该段距离
 */
export default function MeasureTool({ active, onExit }: MeasureToolProps) {
  const map = useMap()
  const [stats, setStats] = useState<Stats | null>(null)
  // 供面板"清除"按钮调用 effect 内部的重置函数
  const clearRef = useRef<(() => void) | null>(null)
  const undoRef = useRef<(() => void) | null>(null)
  const onExitRef = useRef(onExit)
  onExitRef.current = onExit

  useEffect(() => {
    if (!map || !active) {
      setStats(null)
      return
    }

    // ---- 内部可变状态(不走 React,避免频繁重建事件监听) ----
    let vertices: [number, number][] = []
    let closed = false
    let drawing = true
    let labelMarkers: maplibregl.Marker[] = []
    let statsRaf = 0

    // ---- 初始化 source 与 layer ----
    map.addSource(GEO_SOURCE, { type: 'geojson', data: EMPTY_FC })
    map.addSource(PTS_SOURCE, { type: 'geojson', data: EMPTY_FC })
    map.addSource(PREVIEW_SOURCE, { type: 'geojson', data: EMPTY_FC })

    // 闭合后的多边形填充
    map.addLayer({
      id: FILL_LAYER,
      type: 'fill',
      source: GEO_SOURCE,
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: { 'fill-color': '#4285F4', 'fill-opacity': 0.18 },
    })
    // 已确定的折线
    map.addLayer({
      id: LINE_LAYER,
      type: 'line',
      source: GEO_SOURCE,
      filter: ['==', ['geometry-type'], 'LineString'],
      paint: { 'line-color': '#4285F4', 'line-width': 3 },
    })
    // 跟随鼠标的虚线预览段
    map.addLayer({
      id: PREVIEW_LAYER,
      type: 'line',
      source: PREVIEW_SOURCE,
      paint: { 'line-color': '#5f6368', 'line-width': 2, 'line-dasharray': [2, 2] },
    })
    // 顶点:白底蓝边圆点(仿谷歌测距样式)
    map.addLayer({
      id: PTS_HALO_LAYER,
      type: 'circle',
      source: PTS_SOURCE,
      paint: { 'circle-radius': 8, 'circle-color': '#4285F4' },
    })
    map.addLayer({
      id: PTS_CORE_LAYER,
      type: 'circle',
      source: PTS_SOURCE,
      paint: { 'circle-radius': 5.5, 'circle-color': '#ffffff' },
    })

    map.getCanvas().style.cursor = 'crosshair'
    map.doubleClickZoom.disable()

    /** 复用或补齐段距离标签,避免拖拽时反复创建 DOM */
    const syncLabels = (segments: [[number, number], [number, number]][]) => {
      while (labelMarkers.length > segments.length) {
        labelMarkers.pop()?.remove()
      }
      for (let i = 0; i < segments.length; i++) {
        const [a, b] = segments[i]
        const text = formatDistance(haversine(a, b))
        const lngLat: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
        const existing = labelMarkers[i]
        if (existing) {
          const el = existing.getElement()
          if (el.textContent !== text) el.textContent = text
          existing.setLngLat(lngLat)
        } else {
          const el = document.createElement('div')
          el.className = 'measure-label'
          el.textContent = text
          labelMarkers.push(
            new maplibregl.Marker({ element: el }).setLngLat(lngLat).addTo(map),
          )
        }
      }
    }

    /** 重新计算图形、段距离标签与统计面板 */
    const update = (opts?: { throttleStats?: boolean }) => {
      const features: Feature[] = []
      if (vertices.length >= 2) {
        const lineCoords = closed ? [...vertices, vertices[0]] : vertices
        features.push({
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: lineCoords },
        })
      }
      if (closed && vertices.length >= 3) {
        features.push({
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: [[...vertices, vertices[0]]] },
        })
      }
      ;(map.getSource(GEO_SOURCE) as maplibregl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features,
      })
      ;(map.getSource(PTS_SOURCE) as maplibregl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: vertices.map((v, idx) => ({
          type: 'Feature',
          properties: { idx },
          geometry: { type: 'Point', coordinates: v },
        })),
      })

      const segments: [[number, number], [number, number]][] = []
      for (let i = 1; i < vertices.length; i++) segments.push([vertices[i - 1], vertices[i]])
      if (closed && vertices.length >= 3) segments.push([vertices[vertices.length - 1], vertices[0]])
      syncLabels(segments)

      const nextStats: Stats = {
        count: vertices.length,
        total: pathLength(vertices, closed),
        area: closed && vertices.length >= 3 ? polygonArea(vertices) : null,
        drawing,
      }

      // 拖拽顶点时用 rAF 合并面板更新,减少 React 重渲染
      if (opts?.throttleStats) {
        cancelAnimationFrame(statsRaf)
        statsRaf = requestAnimationFrame(() => setStats(nextStats))
      } else {
        setStats(nextStats)
      }
    }

    const clearPreview = () => {
      ;(map.getSource(PREVIEW_SOURCE) as maplibregl.GeoJSONSource).setData(EMPTY_FC)
    }

    /** 重置为初始绘制状态 */
    const clear = () => {
      vertices = []
      closed = false
      drawing = true
      clearPreview()
      update()
    }
    clearRef.current = clear

    /** 撤销上一个顶点 */
    const undo = () => {
      if (vertices.length === 0) return
      if (closed) {
        closed = false
        drawing = true
      } else {
        vertices.pop()
      }
      if (vertices.length === 0) clearPreview()
      update()
    }
    undoRef.current = undo

    // ---- 交互事件 ----
    const onClick = (e: maplibregl.MapMouseEvent) => {
      if (!drawing) return
      // 双击产生的第二次 click 不加点(detail > 1)
      if ((e.originalEvent as MouseEvent).detail > 1) return
      // 点击起点(且已有 >=3 个点)则闭合成多边形;触控阈值略放宽
      if (vertices.length >= 3) {
        const first = map.project(vertices[0])
        const dx = first.x - e.point.x
        const dy = first.y - e.point.y
        if (Math.sqrt(dx * dx + dy * dy) < 18) {
          closed = true
          drawing = false
          clearPreview()
          update()
          return
        }
      }
      vertices.push([e.lngLat.lng, e.lngLat.lat])
      update()
    }

    const onDblClick = (e: maplibregl.MapMouseEvent) => {
      if (!drawing) return
      e.preventDefault()
      drawing = false
      clearPreview()
      update()
    }

    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      if (!drawing || vertices.length === 0) return
      // 跟随鼠标的虚线预览段
      const preview: Feature<LineString> = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: [vertices[vertices.length - 1], [e.lngLat.lng, e.lngLat.lat]],
        },
      }
      ;(map.getSource(PREVIEW_SOURCE) as maplibregl.GeoJSONSource).setData(preview)
    }

    // 拖拽顶点:按下顶点后跟随鼠标移动,松开结束
    const onPointDown = (
      e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] },
    ) => {
      const feature = e.features?.[0]
      if (!feature) return
      e.preventDefault() // 阻止地图拖拽
      const idx = feature.properties.idx as number
      const onMove = (ev: maplibregl.MapMouseEvent) => {
        vertices[idx] = [ev.lngLat.lng, ev.lngLat.lat]
        update({ throttleStats: true })
      }
      const onUp = () => {
        map.off('mousemove', onMove)
        // 松手时立刻刷新一次面板
        update()
      }
      map.on('mousemove', onMove)
      map.once('mouseup', onUp)
    }

    // 悬停顶点时显示可拖拽光标
    const onPointEnter = () => {
      map.getCanvas().style.cursor = 'move'
    }
    const onPointLeave = () => {
      map.getCanvas().style.cursor = 'crosshair'
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExitRef.current()
      // Ctrl/Cmd+Z 或 Backspace 撤销上一点
      if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        undo()
      }
      if (e.key === 'Backspace' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault()
        undo()
      }
    }

    map.on('click', onClick)
    map.on('dblclick', onDblClick)
    map.on('mousemove', onMouseMove)
    map.on('mousedown', PTS_CORE_LAYER, onPointDown)
    map.on('mouseenter', PTS_CORE_LAYER, onPointEnter)
    map.on('mouseleave', PTS_CORE_LAYER, onPointLeave)
    document.addEventListener('keydown', onKeyDown)

    update()

    // ---- 清理 ----
    return () => {
      cancelAnimationFrame(statsRaf)
      map.off('click', onClick)
      map.off('dblclick', onDblClick)
      map.off('mousemove', onMouseMove)
      map.off('mousedown', PTS_CORE_LAYER, onPointDown)
      map.off('mouseenter', PTS_CORE_LAYER, onPointEnter)
      map.off('mouseleave', PTS_CORE_LAYER, onPointLeave)
      document.removeEventListener('keydown', onKeyDown)
      labelMarkers.forEach((m) => m.remove())
      for (const id of [FILL_LAYER, LINE_LAYER, PREVIEW_LAYER, PTS_HALO_LAYER, PTS_CORE_LAYER]) {
        if (map.getLayer(id)) map.removeLayer(id)
      }
      for (const id of [GEO_SOURCE, PTS_SOURCE, PREVIEW_SOURCE]) {
        if (map.getSource(id)) map.removeSource(id)
      }
      map.getCanvas().style.cursor = ''
      map.doubleClickZoom.enable()
      clearRef.current = null
      undoRef.current = null
      setStats(null)
    }
  }, [map, active])

  if (!active || !stats) return null

  return (
    <div className="measure-panel" role="status">
      <div className="measure-panel__title">测距 / 测面积</div>
      {stats.count === 0 ? (
        <div className="measure-panel__hint">点击地图开始添加测量点</div>
      ) : (
        <>
          <div className="measure-panel__row">
            <span>总长度</span>
            <strong>{formatDistance(stats.total)}</strong>
          </div>
          {stats.area !== null && (
            <div className="measure-panel__row">
              <span>面积</span>
              <strong>{formatArea(stats.area)}</strong>
            </div>
          )}
          <div className="measure-panel__hint">
            {stats.drawing
              ? '双击结束;点击起点闭合测面积;Backspace 撤销;拖拽顶点可调整'
              : '拖拽顶点可继续调整;Backspace 可取消闭合'}
          </div>
        </>
      )}
      <div className="measure-panel__actions">
        <button
          className="measure-panel__btn"
          onClick={() => undoRef.current?.()}
          disabled={stats.count === 0}
        >
          撤销
        </button>
        <button className="measure-panel__btn" onClick={() => clearRef.current?.()}>
          清除
        </button>
        <button className="measure-panel__btn measure-panel__btn--primary" onClick={onExit}>
          退出测量
        </button>
      </div>
    </div>
  )
}
