import '../styles/zoomcontrols.css'

interface ZoomControlsProps {
  onZoomIn: () => void
  onZoomOut: () => void
}

/**
 * 右下角缩放 +/- 按钮组,还原谷歌地图样式(白底、分隔线、Material 阴影)
 */
export default function ZoomControls({ onZoomIn, onZoomOut }: ZoomControlsProps) {
  return (
    <div className="zoom-controls">
      <button className="zoom-controls__btn" onClick={onZoomIn} aria-label="放大" title="放大">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
        </svg>
      </button>
      <div className="zoom-controls__divider" />
      <button className="zoom-controls__btn" onClick={onZoomOut} aria-label="缩小" title="缩小">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 13H5v-2h14v2z" />
        </svg>
      </button>
    </div>
  )
}
