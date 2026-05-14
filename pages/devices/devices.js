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
    inputDeviceId: ''   // 输入的设备ID
  },

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
      // 并行请求设备列表和收藏列表
      const [deviceRes, favRes] = await Promise.all([
        api.getDeviceList(open_id),
        api.getFavoriteList(open_id)
      ])

      const deviceList = deviceRes.data || []
      const favoriteList = favRes.data || []
      const favIds = new Set(favoriteList.map(f => f.device_id))

      // 收藏设备取完整信息（从全部设备列表中匹配）
      const enrichedFavs = []
      for (const fav of favoriteList) {
        const device = deviceList.find(d => d.device_id === fav.device_id)
        if (device) {
          enrichedFavs.push({ ...device, isFavorited: true })
        } else {
          enrichedFavs.push({ ...fav, device_name: fav.location_name || fav.device_id, isFavorited: true })
        }
      }

      this.setData({
        deviceList,
        favoriteList: enrichedFavs,
        favDeviceIds: favIds
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
        api.bindDevice(open_id, deviceId).then(() => {
          wx.showToast({ title: '绑定成功', icon: 'success' })
          this.loadAll()
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
    const open_id = app.globalData.open_id
    wx.showLoading({ title: '绑定中...', mask: true })
    api.bindDevice(open_id, deviceId).then(() => {
      wx.hideLoading()
      wx.showToast({ title: '绑定成功', icon: 'success' })
      this.setData({ showDialog: false, inputDeviceId: '' })
      this.loadAll()
    }).catch(() => {
      wx.hideLoading()
      this.setData({ showDialog: false })
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
