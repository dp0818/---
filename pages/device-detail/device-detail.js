/**
 * 设备详情页逻辑
 * - 设备信息展示 + 在线状态
 * - 收藏/取消收藏
 * - 位置更新（GPS + 上传）
 * - 告警阈值设置
 * - 解绑确认
 */
const api = require('../../utils/api')
const app = getApp()

Page({
  data: {
    deviceId: '',
    deviceName: '',
    status: 0,
    isActive: false,
    isFavorite: false,
    longitude: '',
    latitude: '',
    roomLocation: '',
    roomLocationLabel: '',
    battery: '',
    simStatus: '',
    simRunning: false,
    showRoomPicker: false,
    selectedRoom: '',
    selectedRoomLabel: '',
    selectedRoomIcon: '',
    roomOptions: [
      { value: 'living_room', label: '客厅', icon: '🛋️' },
      { value: 'kitchen', label: '厨房', icon: '🍳' },
      { value: 'bedroom', label: '卧室', icon: '🛏️' },
      { value: 'bathroom', label: '厕所', icon: '🚿' },
      { value: 'balcony', label: '阳台', icon: '🌿' },
      { value: 'study', label: '书房', icon: '📚' }
    ],
    pm25Limit: 75,
    aqiLimit: 100,
    showAlertModal: false,
    pm25Input: '',
    aqiInput: '',
    updatingLocation: false
  },

  onLoad(options) {
    this.setData({
      deviceId: options.deviceId || '',
      deviceName: options.deviceName || ''
    })
  },

  onShow() {
    this.loadDeviceInfo()
    this.checkFavoriteStatus()
  },

  /**
   * 加载设备完整信息
   */
  loadDeviceInfo() {
    const open_id = app.globalData.open_id
    if (!open_id || !this.data.deviceId) return

    api.getDeviceList(open_id).then(res => {
      const list = res.data || []
      const device = list.find(d => d.device_id === this.data.deviceId)
      if (device) {
        const roomNames = {
          living_room: '客厅', kitchen: '厨房', bedroom: '卧室',
          bathroom: '厕所', balcony: '阳台', study: '书房'
        }
        this.setData({
          deviceName: device.device_name || device.device_id,
          status: device.status || 0,
          isActive: device.is_active === 1,
          longitude: device.last_longitude || '',
          latitude: device.last_latitude || '',
          roomLocation: device.room_location || '',
          roomLocationLabel: (device.room_location && roomNames[device.room_location]) ? roomNames[device.room_location] : '',
          battery: device.battery != null ? device.battery : ''
        })
      }
      this.loadAlertSettings()
      this.loadSimulatorStatus()
    })
  },

  loadSimulatorStatus() {
    api.getSimulatorStatus().then(res => {
      const data = res.data
      if (!data || !data.simulators) return

      const sims = data.simulators
      const did = this.data.deviceId || ''
      const simInfo = sims[did]

      let isOnline = false
      if (simInfo) {
        isOnline = (simInfo.status === 'online')
      }

      this.setData({
        simRunning: isOnline,
        simStatus: isOnline ? '运行中' : '已停止',
        status: isOnline ? 1 : 0
      })
    }).catch(e => {
      console.warn('[Detail-Status] 获取状态失败:', e)
    })
  },

  /**
   * 从后端加载告警阈值
   */
  loadAlertSettings() {
    const open_id = app.globalData.open_id
    api.getAlertSettings(open_id, this.data.deviceId).then(res => {
      const data = res.data || {}
      if (data.aqi_max) this.setData({ aqiLimit: data.aqi_max })
      if (data.pm2_5_max) this.setData({ pm25Limit: data.pm2_5_max })
    }).catch(() => {
      // API失败时尝试从本地缓存读取（兼容旧数据）
      const savedPm25 = wx.getStorageSync('alert_pm25_' + this.data.deviceId)
      const savedAqi = wx.getStorageSync('alert_aqi_' + this.data.deviceId)
      if (savedPm25) this.setData({ pm25Limit: savedPm25 })
      if (savedAqi) this.setData({ aqiLimit: savedAqi })
    })
  },

  /**
   * 检查当前设备是否已收藏
   */
  checkFavoriteStatus() {
    const open_id = app.globalData.open_id
    if (!open_id) return
    api.getFavoriteList(open_id).then(res => {
      const favList = res.data || []
      const isFav = favList.some(f => f.device_id === this.data.deviceId)
      this.setData({ isFavorite: isFav })
    }).catch(() => {})
  },

  /**
   * 点击收藏/取消收藏
   */
  handleToggleFavorite() {
    const open_id = app.globalData.open_id
    if (this.data.isFavorite) {
      api.removeFavorite(open_id, this.data.deviceId).then(() => {
        wx.showToast({ title: '已取消收藏', icon: 'none' })
        this.setData({ isFavorite: false })
      })
    } else {
      api.addFavorite(open_id, this.data.deviceId).then(() => {
        wx.showToast({ title: '已添加收藏', icon: 'success' })
        this.setData({ isFavorite: true })
      })
    }
  },

  /**
   * 刷新模拟器状态
   */
  handleRefreshStatus() {
    this.setData({ simStatus: '检测中...' })
    this.loadSimulatorStatus()
    wx.showToast({ title: '已刷新', icon: 'success' })
  },

  /**
   * 打开房间选择弹窗
   */
  handleUpdateLocation() {
    const currentRoom = this.data.roomLocation || 'living_room'
    const options = this.data.roomOptions
    const found = options.find(o => o.value === currentRoom) || options[0]
    this.setData({
      showRoomPicker: true,
      selectedRoom: found.value,
      selectedRoomLabel: found.label,
      selectedRoomIcon: found.icon
    })
  },

  onRoomChange(e) {
    const index = parseInt(e.detail.value)
    const options = this.data.roomOptions
    this.setData({
      selectedRoom: options[index].value,
      selectedRoomLabel: options[index].label,
      selectedRoomIcon: options[index].icon
    })
  },

  hideRoomPicker() {
    this.setData({ showRoomPicker: false })
  },

  confirmRoomChange() {
    const open_id = app.globalData.open_id
    const deviceId = this.data.deviceId
    const newRoom = this.data.selectedRoom

    wx.showLoading({ title: '更新中...', mask: true })
    api.bindDevice(open_id, deviceId, newRoom).then(() => {
      wx.hideLoading()
      this.setData({
        showRoomPicker: false,
        roomLocation: newRoom,
        roomLocationLabel: this.data.selectedRoomLabel
      })
      wx.showToast({ title: '已更新为' + this.data.selectedRoomLabel, icon: 'success' })
    }).catch(() => {
      wx.hideLoading()
      wx.showToast({ title: '更新失败', icon: 'none' })
    })
  },

  /**
   * 打开告警设置弹窗
   */
  handleModifyAlert() {
    this.setData({
      showAlertModal: true,
      pm25Input: String(this.data.pm25Limit),
      aqiInput: String(this.data.aqiLimit)
    })
  },

  closeAlertModal() { this.setData({ showAlertModal: false }) },
  onPm25Input(e) { this.setData({ pm25Input: e.detail.value }) },
  onAqiInput(e) { this.setData({ aqiInput: e.detail.value }) },

  /**
   * 保存告警阈值（调用API）
   */
  saveAlertSettings() {
    const pm25 = parseFloat(this.data.pm25Input)
    const aqi = parseFloat(this.data.aqiInput)
    if (isNaN(pm25) || pm25 <= 0) {
      wx.showToast({ title: '请输入有效的PM2.5值', icon: 'none' })
      return
    }
    if (isNaN(aqi) || aqi <= 0) {
      wx.showToast({ title: '请输入有效的AQI值', icon: 'none' })
      return
    }

    const open_id = app.globalData.open_id
    api.setAlertSettings(open_id, this.data.deviceId, aqi, pm25).then(() => {
      this.setData({ pm25Limit: pm25, aqiLimit: aqi, showAlertModal: false })
      wx.showToast({ title: '保存成功', icon: 'success' })
    }).catch(() => {
      wx.showToast({ title: '保存失败，请重试', icon: 'none' })
    })
  },

  /**
   * 解绑设备（二次确认）
   */
  handleUnbind() {
    wx.showModal({
      title: '确认解绑',
      content: '解绑后该设备数据将不再同步，确定要继续吗？',
      confirmText: '确认解绑',
      confirmColor: '#F44336',
      success: r => {
        if (!r.confirm) return
        const open_id = app.globalData.open_id
        api.unbindDevice(open_id, this.data.deviceId).then(() => {
          wx.showToast({ title: '解绑成功', icon: 'success' })
          wx.removeStorageSync('currentDeviceId')
          wx.removeStorageSync('currentDeviceName')
          setTimeout(() => wx.navigateBack(), 800)
        })
      }
    })
  },

  /**
   * 跳转到首页查看实时数据
   */
  goToData() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  noop() {}
})
