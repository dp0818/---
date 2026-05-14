/**
 * 设备列表页逻辑
 * - 加载已绑定设备列表 + 收藏设备列表
 * - 收藏设备置顶显示
 * - 扫码绑定新设备
 * - 下拉刷新
 */
const api = require('../../utils/api')
const app = getApp()

Page({
  data: {
    deviceList: [],     // 全部设备
    favoriteList: [],   // 收藏的设备
    favDeviceIds: new Set(),  // 收藏设备ID集合，用于快速判断
    showDialog: false,  // 手动输入弹窗
    inputDeviceId: '',   // 输入的设备ID
    showRoomPicker: false, // 房间选择弹窗
    selectedRoom: 'living_room', // 默认客厅
    selectedRoomLabel: '客厅', // 当前选中房间的显示标签
    selectedRoomIcon: '🛋️',
    pendingDeviceId: '',  // 待绑定的设备ID
    statusError: '',      // 状态检测错误信息
    roomOptions: [
      { value: 'living_room', label: '客厅', icon: '🛋️' },
      { value: 'kitchen', label: '厨房', icon: '🍳' },
      { value: 'bedroom', label: '卧室', icon: '🛏️' },
      { value: 'bathroom', label: '厕所', icon: '🚿' },
      { value: 'balcony', label: '阳台', icon: '🌿' },
      { value: 'study', label: '书房', icon: '📚' }
    ]
  },

  // 房间选项（保留实例属性供JS内部使用）
  _roomOptions: [
    { value: 'living_room', label: '客厅', icon: '🛋️' },
    { value: 'kitchen', label: '厨房', icon: '🍳' },
    { value: 'bedroom', label: '卧室', icon: '🛏️' },
    { value: 'bathroom', label: '厕所', icon: '🚿' },
    { value: 'balcony', label: '阳台', icon: '🌿' },
    { value: 'study', label: '书房', icon: '📚' }
  ],

  onShow() {
    this.loadAll()
  },

  onPullDownRefresh() {
    this.loadAll().then(() => wx.stopPullDownRefresh())
                    .catch(() => wx.stopPullDownRefresh())
  },

  /**
   * 同时加载设备列表和收藏列表
   */
  async loadAll() {
    const open_id = app.globalData.open_id
    if (!open_id) return

    wx.showLoading({ title: '加载中...', mask: true })

    try {
      let statusRes = null
      try {
        statusRes = await api.getSimulatorStatus()
        console.log('[Status] /api/status 返回:', JSON.stringify(statusRes))
      } catch (e) {
        console.warn('[Status] 获取模拟器状态失败:', e)
        const errMsg = (e && e.errMsg) || (e && e.message) || String(e)
        this.setData({ statusError: '状态检测失败: ' + errMsg })
      }

      const [deviceRes, favRes] = await Promise.all([
        api.getDeviceList(open_id),
        api.getFavoriteList(open_id)
      ])

      let deviceList = deviceRes.data || []
      const favoriteList = favRes.data || []
      const favIds = new Set(favoriteList.map(f => f.device_id))

      const simStatusMap = {}
      if (statusRes && statusRes.data && statusRes.data.simulators) {
        Object.keys(statusRes.data.simulators).forEach(key => {
          const sim = statusRes.data.simulators[key]
          simStatusMap[key] = sim.status || 'offline'
        })
      }

      // 为设备列表计算AQI等级和文字
      const roomIcons = {
        living_room: '🛋️',
        kitchen: '🍳',
        bedroom: '🛏️',
        bathroom: '🚿',
        balcony: '🌿',
        study: '📚'
      }
      const roomNames = {
        living_room: '客厅',
        kitchen: '厨房',
        bedroom: '卧室',
        bathroom: '厕所',
        balcony: '阳台',
        study: '书房'
      }
      deviceList = deviceList.map(d => {
        const aqi = d.latest_aqi || d.latestAqi || 0
        let aqiClass = 'aqi-excellent'
        let levelText = '优'
        if (aqi > 300) { aqiClass = 'aqi-severe'; levelText = '严重' }
        else if (aqi > 200) { aqiClass = 'aqi-severe'; levelText = '重度' }
        else if (aqi > 150) { aqiClass = 'aqi-moderate'; levelText = '中度' }
        else if (aqi > 100) { aqiClass = 'aqi-mild'; levelText = '轻度' }
        else if (aqi > 50) { aqiClass = 'aqi-good'; levelText = '良' }

        let status = d.status || 0
        const did = d.device_id || ''
        if (Object.keys(simStatusMap).length > 0) {
          const didLower = did.toLowerCase()
          for (const skey of Object.keys(simStatusMap)) {
            const sLower = skey.toLowerCase()
            if (did === skey || didLower === sLower ||
                sLower.includes(didLower) || didLower.includes(sLower)) {
              status = (simStatusMap[skey] === 'running') ? 1 : 0
              break
            }
          }
        }

        return { ...d, aqiClass, levelText, latestAqi: aqi, status, roomIcons, roomNames }
      })

      // 收藏设备取完整信息（从全部设备列表中匹配）
      const enrichedFavs = []
      for (const fav of favoriteList) {
        const device = deviceList.find(d => d.device_id === fav.device_id)
        if (device) {
          enrichedFavs.push({ ...device, isFavorited: true })
        } else {
          enrichedFavs.push({ ...fav, device_name: fav.location_name || fav.device_id, isFavorited: true, aqiClass: 'aqi-excellent', levelText: '未知', latestAqi: 0 })
        }
      }

      this.setData({
        deviceList,
        favoriteList: enrichedFavs,
        favDeviceIds: favIds,
        roomIcons,
        roomNames
      })
    } catch (e) {
      // 错误已在 request 中统一处理
    }

    wx.hideLoading()
  },

  /**
   * 扫码绑定新设备
   */
  handleScan() {
    const open_id = app.globalData.open_id
    wx.scanCode({
      scanType: ['qrCode', 'barCode'],
      success: scanRes => {
        const deviceId = scanRes.result.trim()
        if (!deviceId) {
          wx.showToast({ title: '未识别到设备ID', icon: 'none' })
          return
        }
        this.setData({
          pendingDeviceId: deviceId,
          showRoomPicker: true,
          selectedRoom: 'living_room',
          selectedRoomLabel: '客厅'
        })
      }
    })
  },

  // ==================== 手动绑定设备 ====================

  showInputDialog() {
    this.setData({ showDialog: true, inputDeviceId: '' })
  },

  hideInputDialog() {
    this.setData({ showDialog: false })
  },

  stopPropagation() {},

  onInputChange(e) {
    this.setData({ inputDeviceId: e.detail.value })
  },

  handleManualBind() {
    const deviceId = this.data.inputDeviceId.trim()
    if (!deviceId) {
      wx.showToast({ title: '请输入设备ID', icon: 'none' })
      return
    }
    this.setData({
      showDialog: false,
      pendingDeviceId: deviceId,
      showRoomPicker: true,
      selectedRoom: 'living_room',
      selectedRoomLabel: '客厅'
    })
  },

  // ==================== 房间选择 ====================

  onRoomChange(e) {
    const index = parseInt(e.detail.value)
    const options = this.data.roomOptions || this._roomOptions
    const room = options[index].value
    this.setData({
      selectedRoom: room,
      selectedRoomLabel: options[index].label,
      selectedRoomIcon: options[index].icon
    })
  },

  hideRoomPicker() {
    this.setData({ showRoomPicker: false, pendingDeviceId: '' })
  },

  confirmRoomBind() {
    const open_id = app.globalData.open_id
    const deviceId = this.data.pendingDeviceId
    const room = this.data.selectedRoom
    if (!deviceId) return

    wx.showLoading({ title: '绑定中...', mask: true })
    api.bindDevice(open_id, deviceId, room).then(() => {
      wx.hideLoading()
      wx.showToast({ title: '绑定成功', icon: 'success' })
      this.setData({ showRoomPicker: false, pendingDeviceId: '', inputDeviceId: '' })
      this.loadAll()
    }).catch(() => {
      wx.hideLoading()
      this.setData({ showRoomPicker: false, pendingDeviceId: '' })
    })
  },

  /**
   * 点击设备卡片 → 详情页
   */
  goDetail(e) {
    const { deviceId, deviceName } = e.currentTarget.dataset
    wx.setStorageSync('currentDeviceId', deviceId)
    wx.setStorageSync('currentDeviceName', deviceName || deviceId)
    wx.navigateTo({
      url: `/pages/device-detail/device-detail?deviceId=${deviceId}&deviceName=${deviceName || ''}`
    })
  },

  /**
   * 点击收藏设备 → 详情页
   */
  goFavDetail(e) {
    const { deviceId, deviceName } = e.currentTarget.dataset
    wx.setStorageSync('currentDeviceId', deviceId)
    wx.setStorageSync('currentDeviceName', deviceName || deviceId)
    wx.navigateTo({
      url: `/pages/device-detail/device-detail?deviceId=${deviceId}&deviceName=${deviceName || ''}`
    })
  }
})
