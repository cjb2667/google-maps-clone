# 谷歌地图前端克隆(google-maps-clone)

用 React 19 + Vite + TypeScript + MapLibre GL JS 实现的谷歌地图风格前端克隆,基于免费无需密钥的开源地图数据。

## 启动

```bash
npm install
npm run dev
```

## 功能

- **地图浏览**:拖拽平移、滚轮/双击缩放、Ctrl+拖拽旋转倾斜(MapLibre WebGL 渲染)
- **地点搜索**:左上角搜索框接入 OSM Nominatim,防抖联想、键盘选择、清除标记
- **图层切换**:路网(CARTO Voyager)与卫星(Esri World Imagery),左下角卡片带缩略图预览
- **测距 / 测面积**:点击加点、双击结束、闭合测面积、拖拽顶点、撤销上一点
- **卷帘对比**:路网与卫星同屏对比,拖动滑块切换可见区域
- **3D 地形**:AWS Terrarium DEM + 山体阴影,支持倾斜俯视
- **随机传送**:飞往精选自然奇观 / 地标(云旅游)
- **定位**:右下角定位按钮通过 Geolocation API 绘制蓝点 + 精度圈并 flyTo;已授权时打开页面会自动定位
- **谷歌风格 UI**:搜索框、缩放与定位控件(Material 阴影)、比例尺与版权署名

## 数据来源与署名

- 路网瓦片:© OpenStreetMap contributors © CARTO
- 卫星瓦片:© Esri — Source: Esri, Maxar, Earthstar Geographics
- 地理编码:© OpenStreetMap contributors (Nominatim)
- 高程:AWS Terrain Tiles (Terrarium)
