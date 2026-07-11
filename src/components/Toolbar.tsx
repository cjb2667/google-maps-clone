import '../styles/toolbar.css'

interface ToolbarProps {
  measureOn: boolean
  swipeOn: boolean
  terrainOn: boolean
  onToggleMeasure: () => void
  onToggleSwipe: () => void
  onToggleTerrain: () => void
  onTeleport: () => void
}

/**
 * 右上角功能工具栏:测距、卷帘对比、3D 地形、随机传送
 */
export default function Toolbar({
  measureOn,
  swipeOn,
  terrainOn,
  onToggleMeasure,
  onToggleSwipe,
  onToggleTerrain,
  onTeleport,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <button
        className={`toolbar__btn${measureOn ? ' toolbar__btn--active' : ''}`}
        onClick={onToggleMeasure}
        aria-pressed={measureOn}
        aria-label="测距 / 测面积"
        title="测距 / 测面积"
        type="button"
      >
        {/* 直尺图标 */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.7 6.3l-3-3a.996.996 0 0 0-1.41 0L3.3 16.29a.996.996 0 0 0 0 1.41l3 3c.39.39 1.02.39 1.41 0L20.7 7.71a.996.996 0 0 0 0-1.41zM7 18.59L5.41 17l1.29-1.29 1.09 1.09 1.06-1.06-1.09-1.09 1.3-1.3 1.09 1.09 1.06-1.06-1.09-1.09 1.3-1.3 1.09 1.09 1.06-1.06-1.09-1.09 1.3-1.3 1.09 1.09 1.06-1.06-1.09-1.09L17 5.41 18.59 7 7 18.59z" />
        </svg>
      </button>
      <button
        className={`toolbar__btn${swipeOn ? ' toolbar__btn--active' : ''}`}
        onClick={onToggleSwipe}
        aria-pressed={swipeOn}
        aria-label="卷帘对比(路网 / 卫星)"
        title="卷帘对比(路网 / 卫星)"
        type="button"
      >
        {/* 左右分屏对比图标 */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11 2h2v20h-2V2zM3 5v14c0 1.1.9 2 2 2h4v-2H5V5h4V3H5c-1.1 0-2 .9-2 2zm16-2h-4v2h4v14h-4v2h4c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
        </svg>
      </button>
      <button
        className={`toolbar__btn${terrainOn ? ' toolbar__btn--active' : ''}`}
        onClick={onToggleTerrain}
        aria-pressed={terrainOn}
        aria-label="3D 地形"
        title="3D 地形"
        type="button"
      >
        {/* 山峰图标 */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14 6l-3.75 5 2.85 3.8-1.6 1.2C9.81 13.75 7 10 7 10l-6 8h22L14 6z" />
        </svg>
      </button>
      <button
        className="toolbar__btn"
        onClick={onTeleport}
        aria-label="随机传送"
        title="随机传送(云旅游盲盒)"
        type="button"
      >
        {/* 骰子图标 */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM7.5 18a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm0-9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm4.5 4.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm4.5 4.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm0-9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
        </svg>
      </button>
    </div>
  )
}
