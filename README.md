# 谷歌地图前端克隆(google-maps-clone)

用 React 18 + Vite + TypeScript + MapLibre GL JS 实现的谷歌地图风格前端克隆,基于免费无需密钥的开源地图数据。

## 启动

```bash
npm install
npm run dev
```

## 功能

- **地图浏览**:拖拽平移、滚轮/双击缩放、Ctrl+拖拽旋转倾斜(MapLibre WebGL 渲染)
- **图层切换**:路网(CARTO Voyager,配色接近谷歌地图)与卫星(Esri World Imagery),左下角卡片带缩略图预览
- **定位**:点击右下角定位按钮,通过浏览器 Geolocation API 获取当前位置,绘制蓝点 + 精度圈并 flyTo,权限拒绝/失败时给出提示
- **谷歌风格 UI**:左上角搜索框(仅外观)、右下角缩放与定位控件(Material 阴影)、比例尺与版权署名

## 数据来源与署名

- 路网瓦片:© OpenStreetMap contributors © CARTO
- 卫星瓦片:© Esri — Source: Esri, Maxar, Earthstar Geographics
