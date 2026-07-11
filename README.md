# 谷歌地图前端克隆(google-maps-clone)

用 React 19 + Vite + TypeScript + MapLibre GL JS 实现的谷歌地图风格前端克隆,基于免费无需密钥的开源地图数据。

## 启动

```bash
npm install
npm run dev
```

## 功能

- **矢量路网**:OpenFreeMap Liberty 矢量底图(道路/建筑/标注可缩放清晰渲染)
- **卫星图层**:Esri World Imagery,左下角卡片一键切换
- **地点搜索**:Nominatim 防抖联想、键盘选择、清除标记、视野偏置
- **路线规划**:OSRM 驾车 / 步行 / 骑行;搜索或点击地图设起终点,绘制路线并显示时长距离
- **测距 / 测面积**:加点、闭合、拖拽顶点、撤销
- **卷帘对比**:三种维度同屏对比 —— 路网/卫星、2D/3D 地形、白天/黑夜
- **历史影像时光机**:Esri Wayback 十余年卫星影像存档,拖动时间轴对比城市变迁
- **3D 地形**:AWS Terrarium DEM + 山体阴影(按需加载)
- **天气**:RainViewer 实时降雨雷达叠加;点击地图任意位置查看该点天气(Open-Meteo)
- **日夜主题**:OpenFreeMap 亮/暗矢量底图切换,支持跟随系统深色模式
- **飞行模式**:点选两点,播放起飞 → 巡航 → 降落的电影式飞行动画(沿大圆航线)
- **实时航班**:airplanes.live ADS-B 数据,当前视野航班位置按航向渲染,点击看呼号/高度/速度
- **国际空间站**:wheretheiss.at 实时位置(5s 刷新)+ 前后一圈地面轨迹
- **随机传送**:飞往精选自然奇观 / 地标
- **定位与指北**:Geolocation 蓝点 + 精度圈;旋转后可一键复位
- **谷歌风格 UI**:搜索框、工具栏、缩放控件、比例尺与版权署名

## 数据来源与署名

- 矢量路网:© OpenStreetMap contributors © OpenFreeMap
- 卫星瓦片:© Esri — Source: Esri, Maxar, Earthstar Geographics
- 历史影像:Esri World Imagery Wayback
- 地理编码:© OpenStreetMap contributors (Nominatim)
- 路线规划:OSRM (Open Source Routing Machine)
- 降雨雷达:© RainViewer
- 天气数据:© Open-Meteo
- 实时航班:airplanes.live(社区 ADS-B)
- 空间站数据:wheretheiss.at
- 高程:AWS Terrain Tiles (Terrarium)
