import '../styles/toolbar.css'

interface ToolbarProps {
  directionsOn: boolean
  measureOn: boolean
  swipeOn: boolean
  terrainOn: boolean
  timeMachineOn: boolean
  flightsOn: boolean
  issOn: boolean
  onToggleDirections: () => void
  onToggleMeasure: () => void
  onToggleSwipe: () => void
  onToggleTerrain: () => void
  onToggleTimeMachine: () => void
  onToggleFlights: () => void
  onToggleIss: () => void
  onTeleport: () => void
}

/**
 * 右上角功能工具栏:路线、测距、卷帘、3D 地形、时光机、航班、ISS、随机传送
 */
export default function Toolbar({
  directionsOn,
  measureOn,
  swipeOn,
  terrainOn,
  timeMachineOn,
  flightsOn,
  issOn,
  onToggleDirections,
  onToggleMeasure,
  onToggleSwipe,
  onToggleTerrain,
  onToggleTimeMachine,
  onToggleFlights,
  onToggleIss,
  onTeleport,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <button
        className={`toolbar__btn${directionsOn ? ' toolbar__btn--active' : ''}`}
        onClick={onToggleDirections}
        aria-pressed={directionsOn}
        aria-label="路线规划"
        title="路线规划"
        type="button"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21.71 11.29l-9-9a.996.996 0 0 0-1.41 0l-9 9a.996.996 0 0 0 0 1.41l9 9c.39.39 1.02.39 1.41 0l9-9a.996.996 0 0 0 0-1.41zM14 14.5V12h-4v3H8v-4c0-.55.45-1 1-1h5V7.5l3.5 3.5-3.5 3.5z" />
        </svg>
      </button>
      <button
        className={`toolbar__btn${measureOn ? ' toolbar__btn--active' : ''}`}
        onClick={onToggleMeasure}
        aria-pressed={measureOn}
        aria-label="测距 / 测面积"
        title="测距 / 测面积"
        type="button"
      >
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
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11 2h2v20h-2V2zM3 5v14c0 1.1.9 2 2 2h4v-2H5V5h4V3H5c-1.1 0-2 .9-2 2zm16-2h-4v2h4v14h-4v2h4c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
        </svg>
      </button>
      <button
        className={`toolbar__btn${timeMachineOn ? ' toolbar__btn--active' : ''}`}
        onClick={onToggleTimeMachine}
        aria-pressed={timeMachineOn}
        aria-label="历史影像时光机"
        title="历史影像时光机"
        type="button"
      >
        {/* 时钟回溯图标 */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6a7 7 0 1 1 7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.95 8.95 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
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
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14 6l-3.75 5 2.85 3.8-1.6 1.2C9.81 13.75 7 10 7 10l-6 8h22L14 6z" />
        </svg>
      </button>
      <button
        className={`toolbar__btn${flightsOn ? ' toolbar__btn--active' : ''}`}
        onClick={onToggleFlights}
        aria-pressed={flightsOn}
        aria-label="实时航班"
        title="实时航班"
        type="button"
      >
        {/* 飞机图标 */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
        </svg>
      </button>
      <button
        className={`toolbar__btn${issOn ? ' toolbar__btn--active' : ''}`}
        onClick={onToggleIss}
        aria-pressed={issOn}
        aria-label="国际空间站"
        title="国际空间站(ISS)"
        type="button"
      >
        {/* 卫星图标 */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M5 18l-3 3 1 1 3-3-1-1zm14.5-3.5L17 12l-1.5 1.5 2.5 2.5 1.5-1.5zM9.5 6.5L12 4l-2.5-2.5L8 3l1.5 1.5L8 6l1.5.5zM21 11l1-1-8-8-1 1 1.5 1.5L12 7l-2-2-5.5 5.5 2 2-2.5 2.5L2.5 13.5 1 15l8 8 1.5-1.5-1.5-1.5 2.5-2.5 2 2L19 14l-2-2 2.5-2.5L21 11zm-9.5 7.5L6 13l4.5-4.5L16 14l-4.5 4.5z" />
        </svg>
      </button>
      <button
        className="toolbar__btn"
        onClick={onTeleport}
        aria-label="随机传送"
        title="随机传送(云旅游盲盒)"
        type="button"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM7.5 18a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm0-9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm4.5 4.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm4.5 4.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm0-9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
        </svg>
      </button>
    </div>
  )
}
