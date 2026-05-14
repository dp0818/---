/**
 * 首页逻辑
 * - 读取当前设备，调用 /api/current 获取实时数据
 * - 支持设备切换弹窗
 * - 下拉刷新重新获取数据
 */
const api = require('../../utils/api')
const app = getApp()

Page({
  data: {
    // 设备相关
    currentDeviceId: '',
    currentDeviceName: '',
    deviceList: [],
    showDevicePicker: false,
    battery: '--',
    signal: '--',

    // 空气质量数据
    aqi: '--',
    pm2_5: '--',
    no2: '--',
    so2: '--',
    o3: '--',
    sampleTime: '',

    // UI 状态
    aqiClass: '',
    levelText: '',
    levelClass: ''
  },

  onShow() {
    // 每次页面显示时，检查是否有当前设备
    const deviceId = wx.getStorageSync('currentDeviceId')
    const deviceName = wx.getStorageSync('currentDeviceName')

    if (deviceId) {
      this.setData({
        currentDeviceId: deviceId,
        currentDeviceName: deviceName || deviceId
      })
      this.loadDeviceList()
      this.loadCurrentData()
    } else {
      // 没有选中设备，尝试加载设备列表让用户选择
      this.loadDeviceList()
    }
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    if (this.data.currentDeviceId) {
      this.loadCurrentData().then(() => {
        wx.stopPullDownRefresh()
      })
    } else {
      wx.stopPullDownRefresh()
    }
  },

  /**
   * 加载已绑定的设备列表
   */
  loadDeviceList() {
    const open_id = app.globalData.open_id
    if (!open_id) return

    api.getDeviceList(open_id).then((res) => {
      const list = res.data || []
      this.setData({ deviceList: list })

      // 如果还没有选中设备但列表有数据，自动选中第一个
      if (!this.data.currentDeviceId && list.length > 0) {
        const first = list[0]
        this.setData({
          currentDeviceId: first.device_id,
          currentDeviceName: first.device_name || first.device_id,
          battery: first.battery != null ? first.battery : '--',
          signal: first.signal != null ? first.signal : '--'
        })
        wx.setStorageSync('currentDeviceId', first.device_id)
        wx.setStorageSync('currentDeviceName', first.device_name || first.device_id)
        this.loadCurrentData()
      }
    })
  },

  /**
   * 获取当前设备的实时空气质量数据
   */
  loadCurrentData() {
    if (!this.data.currentDeviceId) return Promise.resolve()

    return api.getCurrentData(this.data.currentDeviceId).then((res) => {
      const d = res.data
      const aqi = d.aqi || 0

      // 根据 AQI 值确定等级和颜色
      const levelInfo = this.getAQILevel(aqi)

      this.setData({
        aqi: d.aqi != null ? d.aqi : '--',
        pm2_5: d.pm2_5 != null ? d.pm2_5 : '--',
        no2: d.no2 != null ? d.no2 : '--',
        so2: d.so2 != null ? d.so2 : '--',
        o3: d.o3 != null ? d.o3 : '--',
        sampleTime: d.sample_time || '',
        aqiClass: levelInfo.aqiClass,
        levelText: levelInfo.levelText,
        levelClass: levelInfo.levelClass,
        bgClass: levelInfo.levelClass.replace('level-', 'bg-aqi-')
      })
    })
  },

  /**
   * 根据 AQI 数值返回对应的 CSS 类名和描述文字
   * @param {number} aqi
   * @returns {Object} { aqiClass, levelText, levelClass }
   */
  getAQILevel(aqi) {
    if (aqi <= 50)  return { aqiClass: 'aqi-excellent', levelText: '优',  levelClass: 'level-excellent' }
    if (aqi <= 100) return { aqiClass: 'aqi-good',      levelText: '良',  levelClass: 'level-good' }
    if (aqi <= 150) return { aqiClass: 'aqi-mild',      levelText: '轻度污染', levelClass: 'level-mild' }
    if (aqi <= 200) return { aqiClass: 'aqi-moderate',  levelText: '中度污染', levelClass: 'level-moderate' }
    return { aqiClass: 'aqi-severe', levelText: '重度污染', levelClass: 'level-severe' }
  },

  /**
   * 点击设备栏 —— 弹出设备选择弹窗
   */
  handleSwitchDevice() {
    this.setData({ showDevicePicker: true })
  },

  /**
   * 关闭弹窗
   */
  closePicker() {
    this.setData({ showDevicePicker: false })
  },

  /**
   * 从弹窗中选择设备
   */
  selectDevice(e) {
    const index = e.currentTarget.dataset.index
    const device = this.data.deviceList[index]

    this.setData({
      currentDeviceId: device.device_id,
      currentDeviceName: device.device_name || device.device_id,
      battery: device.battery != null ? device.battery : '--',
      signal: device.signal != null ? device.signal : '--',
      showDevicePicker: false
    })

    // 持久化选中设备
    wx.setStorageSync('currentDeviceId', device.device_id)
    wx.setStorageSync('currentDeviceName', device.device_name || device.device_id)

    // 重新加载数据
    this.loadCurrentData()
  },

  /**
   * 阻止弹窗内容区域的点击冒泡
   */
  noop() {},

  /**
   * 快捷操作 —— 跳转到分析页
   */
  goAnalysis() {
    wx.switchTab({ url: '/pages/analysis/analysis' })
  },

  /**
   * 快捷操作 —— 跳转到地图页
   */
  goMap() {
    wx.switchTab({ url: '/pages/map/map' })
  },

  /**
   * 快捷操作 —— 跳转到设备详情页
   */
  goDetail() {
    if (!this.data.currentDeviceId) {
      wx.showToast({ title: '请先选择设备', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: `/pages/device-detail/device-detail?deviceId=${this.data.currentDeviceId}&deviceName=${this.data.currentDeviceName}`
    })
  }
})
