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
    battery: '',
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
        this.setData({
          deviceName: device.device_name || device.device_id,
          status: device.status || 0,
          isActive: device.is_active === 1,
          longitude: device.last_longitude || '',
          latitude: device.last_latitude || '',
          battery: device.battery != null ? device.battery : ''
        })
      }
      // 恢复告警设置
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
   * 更新设备位置（获取手机GPS → 上传到后端）
   */
  handleUpdateLocation() {
    this.setData({ updatingLocation: true })
    wx.getLocation({
      type: 'gcj02',
      success: locRes => {
        const { longitude, latitude } = locRes
        api.updateDeviceLocation(this.data.deviceId, longitude, latitude).then(() => {
          this.setData({
            longitude: longitude.toFixed(4),
            latitude: latitude.toFixed(4),
            updatingLocation: false
          })
          wx.showToast({ title: '位置更新成功', icon: 'success' })
        }).catch(() => {
          this.setData({ updatingLocation: false })
        })
      },
      fail: err => {
        this.setData({ updatingLocation: false })
        if (err.errMsg && err.errMsg.includes('auth deny')) {
          wx.showModal({
            title: '需要位置权限',
            content: '请在设置中允许获取位置信息',
            confirmText: '去设置',
            success: r => { if (r.confirm) wx.openSetting() }
          })
        } else {
          wx.showToast({ title: '获取位置失败', icon: 'none' })
        }
      }
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
   * 保存告警阈值（本地存储）
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
    this.setData({ pm25Limit: pm25, aqiLimit: aqi, showAlertModal: false })
    wx.setStorageSync('alert_pm25_' + this.data.deviceId, pm25)
    wx.setStorageSync('alert_aqi_' + this.data.deviceId, aqi)
    wx.showToast({ title: '保存成功', icon: 'success' })
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
