/** 随机传送的精选目的地:适合卫星图观赏的自然奇观与地标 */

export interface Place {
  /** 地点名称 */
  name: string
  /** 所在国家/地区 */
  country: string
  lng: number
  lat: number
  /** 建议缩放级别 */
  zoom: number
  /** 建议俯仰角(配合 3D 效果,可选) */
  pitch?: number
}

export const PLACES: Place[] = [
  { name: '珠穆朗玛峰', country: '中国/尼泊尔', lng: 86.925, lat: 27.9881, zoom: 12, pitch: 60 },
  { name: '科罗拉多大峡谷', country: '美国', lng: -112.1401, lat: 36.0544, zoom: 13, pitch: 55 },
  { name: '富士山', country: '日本', lng: 138.7274, lat: 35.3606, zoom: 12, pitch: 55 },
  { name: '马累环礁', country: '马尔代夫', lng: 73.5093, lat: 4.1755, zoom: 12 },
  { name: '朱美拉棕榈岛', country: '阿联酋迪拜', lng: 55.1381, lat: 25.1124, zoom: 13 },
  { name: '乌尤尼盐湖', country: '玻利维亚', lng: -67.4891, lat: -20.1338, zoom: 11 },
  { name: '撒哈拉之眼', country: '毛里塔尼亚', lng: -11.3983, lat: 21.124, zoom: 10 },
  { name: '大堡礁', country: '澳大利亚', lng: 145.7, lat: -16.3, zoom: 10 },
  { name: '圣托里尼岛', country: '希腊', lng: 25.4615, lat: 36.3932, zoom: 13 },
  { name: '威尼斯', country: '意大利', lng: 12.3155, lat: 45.4408, zoom: 13 },
  { name: '曼哈顿', country: '美国纽约', lng: -73.9712, lat: 40.7831, zoom: 13, pitch: 50 },
  { name: '吉萨金字塔群', country: '埃及', lng: 31.1342, lat: 29.9792, zoom: 15 },
  { name: '马丘比丘', country: '秘鲁', lng: -72.545, lat: -13.1631, zoom: 15, pitch: 55 },
  { name: '尼亚加拉瀑布', country: '加拿大/美国', lng: -79.0742, lat: 43.0799, zoom: 14 },
  { name: '桂林漓江', country: '中国', lng: 110.4, lat: 24.78, zoom: 12, pitch: 55 },
  { name: '张掖七彩丹霞', country: '中国', lng: 100.135, lat: 38.96, zoom: 13 },
  { name: '布达拉宫', country: '中国西藏', lng: 91.1175, lat: 29.6579, zoom: 15 },
  { name: '慕田峪长城', country: '中国', lng: 116.5681, lat: 40.4319, zoom: 14, pitch: 55 },
  { name: '米尔福德峡湾', country: '新西兰', lng: 167.9256, lat: -44.6717, zoom: 12, pitch: 60 },
  { name: '盖朗厄尔峡湾', country: '挪威', lng: 7.2054, lat: 62.1049, zoom: 12, pitch: 60 },
  { name: '马特洪峰', country: '瑞士', lng: 7.6586, lat: 45.9763, zoom: 13, pitch: 60 },
  { name: '黄石大棱镜泉', country: '美国', lng: -110.8382, lat: 44.5251, zoom: 15 },
  { name: '里约热内卢', country: '巴西', lng: -43.2105, lat: -22.9519, zoom: 13, pitch: 50 },
  { name: '悉尼歌剧院', country: '澳大利亚', lng: 151.2153, lat: -33.8568, zoom: 15 },
  { name: '稻城亚丁', country: '中国', lng: 100.33, lat: 28.43, zoom: 12, pitch: 60 },
  { name: '索苏斯盐沼红沙丘', country: '纳米比亚', lng: 15.2916, lat: -24.7275, zoom: 12 },
  { name: '瓦特纳冰川', country: '冰岛', lng: -16.8, lat: 64.4, zoom: 10 },
  { name: '圣米歇尔山', country: '法国', lng: -1.5115, lat: 48.6361, zoom: 15 },
  { name: '帕劳群岛', country: '帕劳', lng: 134.5825, lat: 7.515, zoom: 11 },
  { name: '维多利亚瀑布', country: '赞比亚/津巴布韦', lng: 25.8572, lat: -17.9243, zoom: 14 },
]

/** 随机取一个目的地(避免与上一次重复) */
export function randomPlace(exclude?: Place): Place {
  let place: Place
  do {
    place = PLACES[Math.floor(Math.random() * PLACES.length)]
  } while (PLACES.length > 1 && place === exclude)
  return place
}
