/** 天气服务:Open-Meteo 点位天气 + RainViewer 降雨雷达瓦片(均免费无需密钥) */

/** 点位当前天气 */
export interface PointWeather {
  /** 气温(°C) */
  temperature: number
  /** 体感温度(°C) */
  apparentTemperature: number
  /** 相对湿度(%) */
  humidity: number
  /** 风速(km/h) */
  windSpeed: number
  /** 风向(度,0=北) */
  windDirection: number
  /** WMO 天气码 */
  weatherCode: number
  /** 天气描述(中文) */
  description: string
  /** 天气 emoji 图标 */
  icon: string
}

/** WMO 天气码 → 中文描述与图标 */
const WMO_CODES: Record<number, [string, string]> = {
  0: ['晴', '☀️'],
  1: ['基本晴朗', '🌤️'],
  2: ['局部多云', '⛅'],
  3: ['阴', '☁️'],
  45: ['雾', '🌫️'],
  48: ['冻雾', '🌫️'],
  51: ['小毛毛雨', '🌦️'],
  53: ['毛毛雨', '🌦️'],
  55: ['大毛毛雨', '🌧️'],
  56: ['冻毛毛雨', '🌧️'],
  57: ['强冻毛毛雨', '🌧️'],
  61: ['小雨', '🌦️'],
  63: ['中雨', '🌧️'],
  65: ['大雨', '🌧️'],
  66: ['冻雨', '🌧️'],
  67: ['强冻雨', '🌧️'],
  71: ['小雪', '🌨️'],
  73: ['中雪', '🌨️'],
  75: ['大雪', '❄️'],
  77: ['米雪', '🌨️'],
  80: ['小阵雨', '🌦️'],
  81: ['阵雨', '🌧️'],
  82: ['强阵雨', '⛈️'],
  85: ['小阵雪', '🌨️'],
  86: ['大阵雪', '❄️'],
  95: ['雷阵雨', '⛈️'],
  96: ['雷阵雨伴小冰雹', '⛈️'],
  99: ['雷阵雨伴大冰雹', '⛈️'],
}

export function describeWeatherCode(code: number): [string, string] {
  return WMO_CODES[code] ?? ['未知', '❓']
}

/** 风向(度)→ 中文方位 */
export function windDirectionText(deg: number): string {
  const dirs = ['北', '东北', '东', '东南', '南', '西南', '西', '西北']
  return dirs[Math.round(((deg % 360) + 360) % 360 / 45) % 8] + '风'
}

interface OpenMeteoResponse {
  current: {
    temperature_2m: number
    apparent_temperature: number
    relative_humidity_2m: number
    wind_speed_10m: number
    wind_direction_10m: number
    weather_code: number
  }
}

/** 查询点位当前天气(Open-Meteo,免费无需密钥) */
export async function fetchPointWeather(
  lng: number,
  lat: number,
  signal?: AbortSignal,
): Promise<PointWeather> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lng.toFixed(4),
    current:
      'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code',
    timezone: 'auto',
  })
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal })
  if (!res.ok) throw new Error(`天气服务响应异常: ${res.status}`)
  const data = (await res.json()) as OpenMeteoResponse
  const c = data.current
  const [description, icon] = describeWeatherCode(c.weather_code)
  return {
    temperature: c.temperature_2m,
    apparentTemperature: c.apparent_temperature,
    humidity: c.relative_humidity_2m,
    windSpeed: c.wind_speed_10m,
    windDirection: c.wind_direction_10m,
    weatherCode: c.weather_code,
    description,
    icon,
  }
}

interface RainViewerMaps {
  host: string
  radar: { past: { time: number; path: string }[] }
}

/** 获取最新一帧降雨雷达的瓦片 URL 模板与时间戳 */
export async function fetchLatestRadar(
  signal?: AbortSignal,
): Promise<{ tiles: string[]; time: Date } | null> {
  const res = await fetch('https://api.rainviewer.com/public/weather-maps.json', { signal })
  if (!res.ok) throw new Error(`雷达服务响应异常: ${res.status}`)
  const data = (await res.json()) as RainViewerMaps
  const latest = data.radar?.past?.at(-1)
  if (!latest) return null
  return {
    // 256 尺寸、配色方案 2(通用蓝紫)、smooth=1 snow=1
    // RainViewer 仅提供低级别雷达瓦片,更高级别由 MapLibre 放大(source maxzoom 控制)
    tiles: [`${data.host}${latest.path}/256/{z}/{x}/{y}/2/1_1.png`],
    time: new Date(latest.time * 1000),
  }
}
