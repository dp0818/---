/**
 * 3D 家庭地图页
 * - SVG 绘制房屋平面图
 * - 悬浮 AQI 气泡云
 * - 点击房间放大动画 + 底部详情面板
 */
const api = require('../../utils/api')
const app = getApp()

const ROOM_NAMES = {
  living_room: '客厅',
  kitchen: '厨房',
  bedroom: '卧室',
  bathroom: '厕所',
  balcony: '阳台',
  study: '书房',
  hallway: '走廊'
}

const ROOM_ICONS = {
  living_room: '🛋️',
  kitchen: '🍳',
  bedroom: '🛏️',
  bathroom: '🚿',
  balcony: '🌿',
  study: '📚',
  hallway: '🚪'
}

Page({
  data: {
    deviceList: [],
    selectedRoom: '',
    selectedRoomDevices: [],
    roomNames: ROOM_NAMES,
    roomIcons: ROOM_ICONS,
    onlineCount: 0,
    refreshing: false,

    zoomedRoom: false,
    isZooming: false,
    zoomScale: 1,
    panX: 0,
    panY: 0,

    livingRoom: { devices: [], aqi: 0, aqiClass: '', borderColor: '#E2E8F0', glowColor: 'rgba(226,232,240,0)' },
    kitchen: { devices: [], aqi: 0, aqiClass: '', borderColor: '#E2E8F0', glowColor: 'rgba(226,232,240,0)' },
    bedroom: { devices: [], aqi: 0, aqiClass: '', borderColor: '#E2E8F0', glowColor: 'rgba(226,232,240,0)' },
    bathroom: { devices: [], aqi: 0, aqiClass: '', borderColor: '#E2E8F0', glowColor: 'rgba(226,232,240,0)' },
    balcony: { devices: [], aqi: 0, aqiClass: '', borderColor: '#E2E8F0', glowColor: 'rgba(226,232,240,0)' },
    study: { devices: [], aqi: 0, aqiClass: '', borderColor: '#E2E8F0', glowColor: 'rgba(226,232,240,0)' },
    hallway: { devices: [], aqi: 0, aqiClass: '', borderColor: '#E2E8F0', glowColor: 'rgba(226,232,240,0)' },

    roomDataMap: {},
    _containerInfo: null
  },

  onShow() {
    this.loadDeviceData()
  },

  /**
   * 加载设备 + AQI 数据
   */
  async loadDeviceData() {
    const open_id = app.globalData.open_id
    if (!open_id) return

    this.setData({ refreshing: true })

    try {
      const res = await api.getDeviceList(open_id)
      const list = res.data || []
      if (list.length === 0) {
        this.setData({ deviceList: [], refreshing: false })
        return
      }

      const onlineCount = list.filter(d => d.status === 1).length

      // 并行获取所有设备的实时AQI
      const aqiPromises = list.map(device =>
        api.getCurrentData(device.device_id)
          .then(r => ({
            aqi: r.data.aqi || 0,
            pm2_5: r.data.pm2_5,
            no2: r.data.no2,
            so2: r.data.so2,
            o3: r.data.o3,
            sample_time: r.data.sample_time,
            device_id: device.device_id
          }))
          .catch(() => ({
            aqi: 0, pm2_5: null, no2: null, so2: null, o3: null,
            sample_time: '', device_id: device.device_id
          }))
      )
      const aqiResults = await Promise.all(aqiPromises)

      const aqiMap = {}
      const detailMap = {}
      aqiResults.forEach(r => {
        aqiMap[r.device_id] = r.aqi
        detailMap[r.device_id] = r
      })

      // 丰富设备数据
      const enrichedList = list.map(device => {
        const aqi = aqiMap[device.device_id] || 0
        const details = detailMap[device.device_id] || {}
        const levelInfo = this.getAQILevel(aqi)
        return {
          ...device,
          latestAqi: aqi,
          pm2_5: details.pm2_5,
          no2: details.no2,
          so2: details.so2,
          o3: details.o3,
          sampleTime: details.sample_time,
          ...levelInfo
        }
      })

      // 按房间分组
      const rooms = {
        living_room: [], kitchen: [], bedroom: [],
        bathroom: [], balcony: [], study: [], hallway: []
      }
      enrichedList.forEach(device => {
        const room = device.room_location || 'living_room'
        if (rooms[room]) rooms[room].push(device)
        else rooms.living_room.push(device)
      })

      // 计算每个房间的平均 AQI 和边框颜色
      const roomStates = {}
      const roomDataMap = {}
      Object.keys(rooms).forEach(roomKey => {
        const devices = rooms[roomKey]
        const validAqi = devices.filter(d => d.latestAqi > 0).map(d => d.latestAqi)
        const avgAqi = validAqi.length > 0
          ? Math.round(validAqi.reduce((s, v) => s + v, 0) / validAqi.length)
          : 0
        const levelInfo = this.getAQILevel(avgAqi)
        const borderColor = this.getBorderColor(avgAqi)
        const glowColor = this.getGlowColor(avgAqi)
        roomStates[roomKey] = {
          devices, aqi: avgAqi,
          aqiClass: levelInfo.aqiClass,
          borderColor,
          glowColor
        }
        roomDataMap[roomKey] = { aqi: avgAqi, aqiClass: levelInfo.aqiClass }
      })

      this.setData({
        deviceList: enrichedList,
        onlineCount,
        refreshing: false,
        livingRoom: roomStates.living_room,
        kitchen: roomStates.kitchen,
        bedroom: roomStates.bedroom,
        bathroom: roomStates.bathroom,
        balcony: roomStates.balcony,
        study: roomStates.study,
        hallway: roomStates.hallway,
        roomDataMap
      })

      if (this.data.selectedRoom) {
        this.updateSelectedRoomDevices()
      }
    } catch (e) {
      this.setData({ refreshing: false })
    }
  },

  getAQILevel(aqi) {
    if (aqi <= 0)   return { levelText: '未知', aqiClass: '' }
    if (aqi <= 50)  return { levelText: '优', aqiClass: 'aqi-excellent' }
    if (aqi <= 100) return { levelText: '良', aqiClass: 'aqi-good' }
    if (aqi <= 150) return { levelText: '轻度', aqiClass: 'aqi-mild' }
    if (aqi <= 200) return { levelText: '中度', aqiClass: 'aqi-moderate' }
    return { levelText: '重度', aqiClass: 'aqi-severe' }
  },

  getBorderColor(aqi) {
    if (aqi <= 0)   return '#E2E8F0'
    if (aqi <= 50)  return '#4CAF50'
    if (aqi <= 100) return '#FFC107'
    if (aqi <= 150) return '#FF9800'
    if (aqi <= 200) return '#F44336'
    return '#9C27B0'
  },

  getGlowColor(aqi) {
    if (aqi <= 0)   return 'rgba(226,232,240,0)'
    if (aqi <= 50)  return 'rgba(76,175,80,0.2)'
    if (aqi <= 100) return 'rgba(255,193,7,0.2)'
    if (aqi <= 150) return 'rgba(255,152,0,0.2)'
    if (aqi <= 200) return 'rgba(244,67,54,0.2)'
    return 'rgba(156,39,176,0.2)'
  },

  /**
   * 点击房间 → 动态计算中心位置 → 放大移动到该房间
   */
  onRoomTap(e) {
    const room = e.currentTarget.dataset.room

    if (this.data.selectedRoom === room) {
      this.setData({
        isZooming: true,
        selectedRoom: '',
        zoomedRoom: false,
        zoomScale: 1,
        panX: 0,
        panY: 0,
        selectedRoomDevices: []
      })
      setTimeout(() => { this.setData({ isZooming: false }) }, 600)
      return
    }

    const query = wx.createSelectorQuery().in(this)
    query.select('.rooms-grid').boundingClientRect()
    query.selectAll('.room-card').boundingClientRect()
    query.exec((res) => {
      const gridRect = res[0]
      const cardRects = res[1]
      if (!gridRect || !cardRects || cardRects.length === 0) return

      const roomOrder = ['living_room', 'bedroom', 'study', 'kitchen', 'bathroom', 'balcony', 'hallway']
      const idx = roomOrder.indexOf(room)
      if (idx < 0 || idx >= cardRects.length) return

      const card = cardRects[idx]
      const gridCX = gridRect.left + gridRect.width / 2
      const gridCY = gridRect.top + gridRect.height / 2
      const cardCX = card.left + card.width / 2
      const cardCY = card.top + card.height / 2

      const targetScale = (room === 'living_room' || room === 'hallway') ? 2.0 : 2.4
      const panX = -(cardCX - gridCX) * targetScale
      const panY = -(cardCY - gridCY) * targetScale

      this.setData({
        isZooming: true,
        selectedRoom: room,
        zoomedRoom: true,
        zoomScale: targetScale,
        panX: Math.round(panX),
        panY: Math.round(panY)
      }, () => {
        setTimeout(() => {
          this.updateSelectedRoomDevices()
          this.setData({ isZooming: false })
        }, 500)
      })
    })
  },

  closeRoomPanel() {
    this.setData({
      isZooming: true,
      selectedRoom: '',
      zoomedRoom: false,
      zoomScale: 1,
      panX: 0,
      panY: 0,
      selectedRoomDevices: []
    })
    setTimeout(() => {
      this.setData({ isZooming: false })
    }, 600)
  },

  updateSelectedRoomDevices() {
    const roomMap = {
      living_room: this.data.livingRoom,
      kitchen: this.data.kitchen,
      bedroom: this.data.bedroom,
      bathroom: this.data.bathroom,
      balcony: this.data.balcony,
      study: this.data.study,
      hallway: this.data.hallway
    }
    const roomData = roomMap[this.data.selectedRoom]
    this.setData({
      selectedRoomDevices: roomData ? roomData.devices : []
    })
  },

  goDeviceDetail(e) {
    const deviceId = e.currentTarget.dataset.deviceId
    const deviceName = e.currentTarget.dataset.deviceName
    wx.navigateTo({
      url: `/pages/device-detail/device-detail?deviceId=${deviceId}&deviceName=${deviceName || ''}`
    })
  },

  // 触摸处理（预留，可用于拖拽）
  onTouchStart(e) {},
  onTouchMove(e) {},
  onTouchEnd(e) {}
})
