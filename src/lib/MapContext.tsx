import type { ReactNode } from 'react'
import type maplibregl from 'maplibre-gl'
import { MapContext } from './mapContextValue'

interface MapProviderProps {
  value: maplibregl.Map | null
  children: ReactNode
}

/** 向子树提供地图实例 */
export function MapProvider({ value, children }: MapProviderProps) {
  return <MapContext.Provider value={value}>{children}</MapContext.Provider>
}
