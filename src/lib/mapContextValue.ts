import { createContext } from 'react'
import type maplibregl from 'maplibre-gl'

/** 地图实例上下文对象(与 Provider 组件分文件,避免 Fast Refresh 警告) */
export const MapContext = createContext<maplibregl.Map | null>(null)
