import { useState } from 'react'
import type maplibregl from 'maplibre-gl'
import { locateAndFly } from '../lib/userLocation'
import '../styles/locatebutton.css'

interface LocateButtonProps {
  map: maplibregl.Map | null
  /** 定位失败时向上抛出提示文案 */
  onError: (message: string) => void
}

/**
 * 右下角"定位到我的位置"按钮:
 * 调用浏览器 Geolocation API,成功后 flyTo 并绘制蓝点+精度圈
 */
export default function LocateButton({ map, onError }: LocateButtonProps) {
  const [locating, setLocating] = useState(false)

  const handleClick = () => {
    if (!map || locating) return
    setLocating(true)
    locateAndFly(map, { onError, onSettled: () => setLocating(false) })
  }

  return (
    <button
      className={`locate-button${locating ? ' locate-button--busy' : ''}`}
      onClick={handleClick}
      aria-label="显示您的位置"
      title="显示您的位置"
    >
      {/* 谷歌地图的准星定位图标 */}
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
      </svg>
    </button>
  )
}
