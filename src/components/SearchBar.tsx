import { useEffect, useRef, useState } from 'react'
import { searchPlaces, type GeocodeResult } from '../lib/geocode'
import '../styles/searchbar.css'

interface SearchBarProps {
  /** 用户从下拉列表选中某个地点时回调 */
  onSelect: (result: GeocodeResult) => void
  /** 搜索出错时向上抛出提示文案 */
  onError: (message: string) => void
}

/**
 * 左上角搜索框:接入 Nominatim 地理编码,
 * 输入防抖联想 + 回车直接搜索,选中后飞到目标位置
 */
export default function SearchBar({ onSelect, onError }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeocodeResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [highlight, setHighlight] = useState(-1)

  const rootRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<number | undefined>(undefined)

  /** 发起搜索请求(取消上一次未完成的请求) */
  const doSearch = async (q: string) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    try {
      const list = await searchPlaces(q, controller.signal)
      setResults(list)
      setOpen(true)
      setHighlight(-1)
      if (list.length === 0) setOpen(true) // 展示"未找到结果"
    } catch (err) {
      // 主动取消不算错误
      if ((err as Error).name !== 'AbortError') {
        onError('搜索失败,请检查网络后重试')
      }
    } finally {
      setLoading(false)
    }
  }

  /** 输入变化:400ms 防抖后自动联想 */
  const handleChange = (value: string) => {
    setQuery(value)
    window.clearTimeout(debounceRef.current)
    if (value.trim().length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    debounceRef.current = window.setTimeout(() => doSearch(value.trim()), 400)
  }

  /** 选中某条结果 */
  const handleSelect = (result: GeocodeResult) => {
    setQuery(result.primaryName)
    setOpen(false)
    onSelect(result)
  }

  /** 键盘操作:上下选择、回车确认/搜索、Esc 关闭 */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (open && highlight >= 0 && highlight < results.length) {
        handleSelect(results[highlight])
      } else if (open && results.length > 0) {
        handleSelect(results[0])
      } else if (query.trim().length >= 1) {
        window.clearTimeout(debounceRef.current)
        doSearch(query.trim())
      }
    } else if (e.key === 'ArrowDown' && open) {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, results.length - 1))
    } else if (e.key === 'ArrowUp' && open) {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  // 点击组件外部时收起下拉
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  // 卸载时清理防抖与在途请求
  useEffect(
    () => () => {
      window.clearTimeout(debounceRef.current)
      abortRef.current?.abort()
    },
    [],
  )

  return (
    <div className="search-bar-root" ref={rootRef}>
      <div className={`search-bar${open ? ' search-bar--open' : ''}`} role="search">
        {/* 汉堡菜单图标 */}
        <button className="search-bar__icon-btn" aria-label="菜单" title="菜单">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#5f6368">
            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
          </svg>
        </button>
        <input
          className="search-bar__input"
          type="text"
          placeholder="在谷歌地图中搜索"
          aria-label="搜索"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {/* 放大镜图标:点击直接搜索 */}
        <button
          className="search-bar__icon-btn"
          aria-label="搜索"
          title="搜索"
          onClick={() => query.trim() && doSearch(query.trim())}
        >
          {loading ? (
            <span className="search-bar__spinner" aria-hidden />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#4285F4">
              <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
            </svg>
          )}
        </button>
        {/* 路线图标(仅外观) */}
        <button
          className="search-bar__icon-btn search-bar__directions"
          aria-label="路线"
          title="路线"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#4285F4">
            <path d="M21.71 11.29l-9-9a.996.996 0 0 0-1.41 0l-9 9a.996.996 0 0 0 0 1.41l9 9c.39.39 1.02.39 1.41 0l9-9a.996.996 0 0 0 0-1.41zM14 14.5V12h-4v3H8v-4c0-.55.45-1 1-1h5V7.5l3.5 3.5-3.5 3.5z" />
          </svg>
        </button>
      </div>

      {/* 搜索结果下拉列表 */}
      {open && (
        <ul className="search-results" role="listbox">
          {results.length === 0 ? (
            <li className="search-results__empty">未找到相关地点</li>
          ) : (
            results.map((r, i) => (
              <li
                key={r.id}
                role="option"
                aria-selected={i === highlight}
                className={`search-results__item${i === highlight ? ' search-results__item--active' : ''}`}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => handleSelect(r)}
              >
                {/* 地点图标 */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#5f6368" className="search-results__pin">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z" />
                </svg>
                <span className="search-results__text">
                  <span className="search-results__primary">{r.primaryName}</span>
                  {r.secondaryName && (
                    <span className="search-results__secondary">{r.secondaryName}</span>
                  )}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
