import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { firstOverlayLayerId } from '../lib/mapConfig'
import { fetchLatestRadar, fetchPointWeather, windDirectionText } from '../lib/weather'
import { useMap } from '../lib/useMap'
import '../styles/weather.css'

interface WeatherOverlayProps {
  active: boolean
  onError: (message: string) => void
}

const RADAR_SOURCE = 'weather-radar'
const RADAR_LAYER = 'weather-radar-tiles'

/**
 * 天气模式:叠加 RainViewer 降雨雷达图层,
 * 点击地图任意位置弹出该点当前天气(Open-Meteo)
 */
export default function WeatherOverlay({ active, onError }: WeatherOverlayProps) {
  const map = useMap()
  const [radarTime, setRadarTime] = useState<Date | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)

  // 降雨雷达图层
  useEffect(() => {
    if (!map || !active) return
    let cancelled = false
    const controller = new AbortController()

    const addRadar = async () => {
      try {
        const radar = await fetchLatestRadar(controller.signal)
        if (cancelled || !radar) return
        if (!map.getSource(RADAR_SOURCE)) {
          map.addSource(RADAR_SOURCE, {
            type: 'raster',
            tiles: radar.tiles,
            tileSize: 256,
            // RainViewer 高级别返回占位图,超过后放大低级别瓦片
            maxzoom: 7,
          })
          // 雷达层压在底图之上、其余业务层之下
          map.addLayer(
            {
              id: RADAR_LAYER,
              type: 'raster',
              source: RADAR_SOURCE,
              paint: { 'raster-opacity': 0.7 },
            },
            firstOverlayLayerId(map),
          )
        }
        setRadarTime(radar.time)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          onError('降雨雷达加载失败,请稍后重试')
        }
      }
    }
    void addRadar()

    return () => {
      cancelled = true
      controller.abort()
      if (map.getLayer(RADAR_LAYER)) map.removeLayer(RADAR_LAYER)
      if (map.getSource(RADAR_SOURCE)) map.removeSource(RADAR_SOURCE)
      setRadarTime(null)
    }
  }, [map, active, onError])

  // 点击查天气
  useEffect(() => {
    if (!map || !active) return
    let controller: AbortController | null = null

    const onClick = async (e: maplibregl.MapMouseEvent) => {
      const { lng, lat } = e.lngLat
      controller?.abort()
      controller = new AbortController()

      // 先弹加载中,再填充数据
      popupRef.current?.remove()
      const popup = new maplibregl.Popup({
        closeButton: true,
        closeOnClick: false,
        maxWidth: '260px',
        className: 'weather-popup',
      })
        .setLngLat([lng, lat])
        .setHTML('<div class="weather-card weather-card--loading">正在查询天气…</div>')
        .addTo(map)
      popupRef.current = popup

      try {
        const w = await fetchPointWeather(lng, lat, controller.signal)
        // 弹窗可能已被用户关闭
        if (!popup.isOpen()) return
        popup.setHTML(`
          <div class="weather-card">
            <div class="weather-card__head">
              <span class="weather-card__icon">${w.icon}</span>
              <span class="weather-card__temp">${Math.round(w.temperature)}°C</span>
              <span class="weather-card__desc">${w.description}</span>
            </div>
            <div class="weather-card__rows">
              <span>体感 ${Math.round(w.apparentTemperature)}°C</span>
              <span>湿度 ${w.humidity}%</span>
              <span>${windDirectionText(w.windDirection)} ${w.windSpeed.toFixed(1)} km/h</span>
            </div>
            <div class="weather-card__coord">${lat.toFixed(3)}, ${lng.toFixed(3)}</div>
          </div>
        `)
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        popup.remove()
        onError('天气查询失败,请检查网络后重试')
      }
    }

    map.on('click', onClick)
    map.getCanvas().style.cursor = 'help'

    return () => {
      map.off('click', onClick)
      controller?.abort()
      popupRef.current?.remove()
      popupRef.current = null
      map.getCanvas().style.cursor = ''
    }
  }, [map, active, onError])

  if (!active) return null

  return (
    <div className="weather-badge" role="status">
      <span className="weather-badge__dot" />
      降雨雷达
      {radarTime &&
        ` · ${radarTime.getHours().toString().padStart(2, '0')}:${radarTime
          .getMinutes()
          .toString()
          .padStart(2, '0')}`}
      <span className="weather-badge__hint">点击地图查看天气</span>
    </div>
  )
}
