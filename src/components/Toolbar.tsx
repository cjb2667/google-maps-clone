import type { ThemeSetting } from '../lib/theme'
import '../styles/toolbar.css'

interface ToolbarProps {
  directionsOn: boolean
  measureOn: boolean
  swipeOn: boolean
  terrainOn: boolean
  weatherOn: boolean
  flightOn: boolean
  themeSetting: ThemeSetting
  onToggleDirections: () => void
  onToggleMeasure: () => void
  onToggleSwipe: () => void
  onToggleTerrain: () => void
  onToggleWeather: () => void
  onToggleFlight: () => void
  onCycleTheme: () => void
  onTeleport: () => void
}

const THEME_TITLES: Record<ThemeSetting, string> = {
  auto: '主题:跟随系统(点击切换)',
  light: '主题:白天(点击切换)',
  dark: '主题:黑夜(点击切换)',
}

/**
 * 右上角功能工具栏:路线、测距、卷帘、3D、天气、飞行、日夜主题、随机传送
 */
export default function Toolbar({
  directionsOn,
  measureOn,
  swipeOn,
  terrainOn,
  weatherOn,
  flightOn,
  themeSetting,
  onToggleDirections,
  onToggleMeasure,
  onToggleSwipe,
  onToggleTerrain,
  onToggleWeather,
  onToggleFlight,
  onCycleTheme,
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
        aria-label="卷帘对比"
        title="卷帘对比(底图 / 2D3D / 日夜)"
        type="button"
      >
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
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14 6l-3.75 5 2.85 3.8-1.6 1.2C9.81 13.75 7 10 7 10l-6 8h22L14 6z" />
        </svg>
      </button>
      <button
        className={`toolbar__btn${weatherOn ? ' toolbar__btn--active' : ''}`}
        onClick={onToggleWeather}
        aria-pressed={weatherOn}
        aria-label="天气"
        title="天气(降雨雷达 + 点击查天气)"
        type="button"
      >
        {/* 云 + 雨滴图标 */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95A5.469 5.469 0 0 1 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11A2.98 2.98 0 0 1 22 15c0 1.65-1.35 3-3 3z" />
          <path d="M8 21.5l1.5-2.5M12 22l1.5-2.5M16 21.5l1.5-2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        </svg>
      </button>
      <button
        className={`toolbar__btn${flightOn ? ' toolbar__btn--active' : ''}`}
        onClick={onToggleFlight}
        aria-pressed={flightOn}
        aria-label="飞行模式"
        title="飞行模式(两点间电影式飞行)"
        type="button"
      >
        {/* 飞机图标 */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21.5 15.5v-2l-8.5-5V3a1.5 1.5 0 0 0-3 0v5.5l-8.5 5v2l8.5-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8.5 2z" />
        </svg>
      </button>
      <button
        className="toolbar__btn"
        onClick={onCycleTheme}
        aria-label={THEME_TITLES[themeSetting]}
        title={THEME_TITLES[themeSetting]}
        type="button"
      >
        {themeSetting === 'dark' ? (
          // 月亮
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z" />
          </svg>
        ) : themeSetting === 'light' ? (
          // 太阳
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z" />
          </svg>
        ) : (
          // 自动(半日半月)
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18V4a8 8 0 0 1 0 16z" />
          </svg>
        )}
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
