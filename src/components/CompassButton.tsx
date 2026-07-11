import { useEffect, useState } from 'react'
import { useMap } from '../lib/useMap'
import '../styles/compass.css'

/**
 * 指北 / 复位按钮:地图旋转或倾斜后出现,点击复位方位与俯仰
 */
export default function CompassButton() {
  const map = useMap()
  const [visible, setVisible] = useState(false)
  const [bearing, setBearing] = useState(0)

  useEffect(() => {
    if (!map) return
    const update = () => {
      const b = map.getBearing()
      const p = map.getPitch()
      setBearing(b)
      // 有旋转或俯仰时显示复位按钮
      setVisible(Math.abs(b) > 0.5 || p > 0.5)
    }
    update()
    map.on('rotate', update)
    map.on('pitch', update)
    return () => {
      map.off('rotate', update)
      map.off('pitch', update)
    }
  }, [map])

  if (!map || !visible) return null

  return (
    <button
      className="compass-button"
      type="button"
      aria-label="复位地图方向"
      title="复位地图方向"
      onClick={() => map.easeTo({ bearing: 0, pitch: 0, duration: 500 })}
    >
      {/* 箭头随地图方位旋转,始终指向正北 */}
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        style={{ transform: `rotate(${-bearing}deg)` }}
      >
        <path d="M12 2L7 14h10L12 2z" fill="#EA4335" />
        <path d="M12 22l5-12H7l5 12z" fill="#5f6368" />
      </svg>
    </button>
  )
}
