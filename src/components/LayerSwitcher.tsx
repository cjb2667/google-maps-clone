import type { LayerType } from '../lib/mapConfig'
import '../styles/layerswitcher.css'

interface LayerSwitcherProps {
  active: LayerType
  onSwitch: (layer: LayerType) => void
}

/** 缩略图瓦片:北京附近 zoom 8 的一张瓦片,分别取自两个数据源 */
const ROADMAP_THUMB =
  'https://a.basemaps.cartocdn.com/rastertiles/voyager/8/210/97@2x.png'
const SATELLITE_THUMB =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/8/97/210'

/**
 * 左下角图层切换卡片:还原谷歌地图交互——
 * 卡片显示"另一个"图层的缩略图,点击后切换过去
 */
export default function LayerSwitcher({ active, onSwitch }: LayerSwitcherProps) {
  // 卡片上展示与当前相反的图层
  const target: LayerType = active === 'roadmap' ? 'satellite' : 'roadmap'
  const thumb = target === 'satellite' ? SATELLITE_THUMB : ROADMAP_THUMB
  const label = target === 'satellite' ? '卫星图像' : '地图'

  return (
    <button
      className="layer-switcher"
      onClick={() => onSwitch(target)}
      aria-label={`切换到${label}`}
      title={`切换到${label}`}
    >
      <img className="layer-switcher__thumb" src={thumb} alt={label} draggable={false} />
      <span className="layer-switcher__label">{label}</span>
    </button>
  )
}
