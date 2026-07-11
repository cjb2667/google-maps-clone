import { useContext } from 'react'
import type maplibregl from 'maplibre-gl'
import { MapContext } from './mapContextValue'

/** 读取当前地图实例(地图未就绪时为 null) */
export function useMap(): maplibregl.Map | null {
  return useContext(MapContext)
}
