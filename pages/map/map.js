/**
 * 地图模式页
 * - 加载设备经纬度 → 地图标记
 * - 标记颜色按 AQI 等级（绿/黄/橙/红/紫）
 * - 底部横向滑动设备列表
 * - 点击标记/列表项定位地图
 */
const api = require('../../utils/api')
const app = getApp()

Page({
  data: {
    deviceList: [],
    markers: [],
    selectedDeviceId: '',
    centerLat: 29.56,
    centerLng: 106.50,
    scale: 12
  },

  onShow() {
    this.loadDeviceData()
  },

  /**
   * 加载设备 + AQI 数据 → 构建地图标记
   */
  async loadDeviceData() {
    const open_id = app.globalData.open_id
    if (!open_id) return

    try {
      const res = await api.getDeviceList(open_id)
      const list = res.data || []
      if (list.length === 0) {
        this.setData({ deviceList: [], markers: [] })
        return
      }

      // 并行获取所有设备的实时AQI
      const aqiPromises = list.map(device =>
        api.getCurrentData(device.device_id)
          .then(r => ({ aqi: r.data.aqi || 0, device_id: device.device_id }))
          .catch(() => ({ aqi: 0, device_id: device.device_id }))
      )
      const aqiResults = await Promise.all(aqiPromises)

      // 构建 aqi 映射表
      const aqiMap = {}
      aqiResults.forEach(r => { aqiMap[r.device_id] = r.aqi })

      // 丰富设备数据
      const enrichedList = list.map(device => {
        const aqi = aqiMap[device.device_id] || 0
        const levelInfo = this.getAQILevel(aqi)
        return {
          ...device,
          latestAqi: aqi,
          ...levelInfo
        }
      })

      const markers = this.buildMarkers(enrichedList)
      const center = this.calculateCenter(enrichedList)

      this.setData({
        deviceList: enrichedList,
        markers,
        centerLat: center.lat,
        centerLng: center.lng
      })
    } catch (e) {
      // 错误已在 request 中处理
    }
  },

  /**
   * 构建设备地图标记
   */
  buildMarkers(devices) {
    return devices
      .filter(d => d.last_latitude && d.last_longitude)
      .map((device, index) => ({
        id: index,
        latitude: device.last_latitude,
        longitude: device.last_longitude,
        title: device.device_name || device.device_id,
        callout: {
          content: `${device.device_name || device.device_id}\nAQI: ${device.latestAqi} (${device.levelText})`,
          fontSize: 12,
          borderRadius: 8,
          padding: 8,
          display: 'BYCLICK'
        },
        label: {
          content: `${device.latestAqi || '--'}`,
          fontSize: 11,
          color: '#FFFFFF',
          bgColor: device.markerColor || '#CCCCCC',
          borderRadius: 16,
          padding: 4,
          anchorX: 0,
          anchorY: -32
        }
      }))
  },

  /**
   * 计算地图中心点
   */
  calculateCenter(devices) {
    const valid = devices.filter(d => d.last_latitude && d.last_longitude)
    if (valid.length === 0) return { lat: 29.56, lng: 106.50 }
    const sumLat = valid.reduce((s, d) => s + d.last_latitude, 0)
    const sumLng = valid.reduce((s, d) => s + d.last_longitude, 0)
    return {
      lat: parseFloat((sumLat / valid.length).toFixed(6)),
      lng: parseFloat((sumLng / valid.length).toFixed(6))
    }
  },

  /**
   * AQI → 等级颜色
   */
  getAQILevel(aqi) {
    if (aqi <= 0)   return { levelText: '未知', aqiClass: '', markerColor: '#CCCCCC' }
    if (aqi <= 50)  return { levelText: '优', aqiClass: 'aqi-excellent', markerColor: '#4CAF50' }
    if (aqi <= 100) return { levelText: '良', aqiClass: 'aqi-good', markerColor: '#FFC107' }
    if (aqi <= 150) return { levelText: '轻度污染', aqiClass: 'aqi-mild', markerColor: '#FF9800' }
    if (aqi <= 200) return { levelText: '中度污染', aqiClass: 'aqi-moderate', markerColor: '#F44336' }
    return { levelText: '重度污染', aqiClass: 'aqi-severe', markerColor: '#9C27B0' }
  },

  /**
   * 地图标记点击
   */
  onMarkerTap(e) {
    const device = this.data.deviceList[e.detail.markerId]
    if (device) this.setData({ selectedDeviceId: device.device_id })
  },

  /**
   * 底部设备列表项点击 → 居中地图到该设备
   */
  onBarItemTap(e) {
    const device = this.data.deviceList[e.currentTarget.dataset.index]
    if (!device.last_latitude || !device.last_longitude) {
      wx.showToast({ title: '该设备暂无位置信息', icon: 'none' })
      return
    }
    this.setData({
      selectedDeviceId: device.device_id,
      centerLat: device.last_latitude,
      centerLng: device.last_longitude,
      scale: 15
    })
  }
})
