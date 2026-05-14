/**
 * 数据分析页逻辑
 * - 加载当前设备的历史数据和每日统计
 * - 支持切换设备和时间范围
 * - AQI 等级颜色标记
 */
const api = require('../../utils/api')
const app = getApp()

Page({
  data: {
    currentDeviceId: '',
    currentDeviceName: '',
    deviceList: [],
    showDevicePicker: false,
    hours: 24,
    timeOptions: [
      { label: '6h', value: 6 },
      { label: '12h', value: 12 },
      { label: '24h', value: 24 },
      { label: '48h', value: 48 },
      { label: '7d', value: 168 }
    ],

    // 每日统计摘要
    summary: {
      avgAqi: '--',
      maxAqi: '--',
      avgPm25: '--',
      date: ''
    },

    // 历史数据列表
    historyList: []
  },

  onShow() {
    const deviceId = wx.getStorageSync('currentDeviceId')
    const deviceName = wx.getStorageSync('currentDeviceName')
    if (deviceId) {
      this.setData({
        currentDeviceId: deviceId,
        currentDeviceName: deviceName || deviceId
      })
    }
    this.loadDeviceList()
    if (deviceId) {
      this.loadHistoryData()
      this.loadDailySummary()
    }
  },

  onPullDownRefresh() {
    Promise.all([
      this.loadHistoryData(),
      this.loadDailySummary()
    ]).then(() => wx.stopPullDownRefresh())
     .catch(() => wx.stopPullDownRefresh())
  },

  /**
   * 加载设备列表（仅用于切换弹窗）
   */
  loadDeviceList() {
    const open_id = app.globalData.open_id
    if (!open_id) return
    api.getDeviceList(open_id).then(res => {
      const list = res.data || []
      this.setData({ deviceList: list })
      // 没有选中设备但有列表，自动选第一个
      if (!this.data.currentDeviceId && list.length > 0) {
        const first = list[0]
        this.setData({
          currentDeviceId: first.device_id,
          currentDeviceName: first.device_name || first.device_id
        })
        wx.setStorageSync('currentDeviceId', first.device_id)
        wx.setStorageSync('currentDeviceName', first.device_name || first.device_id)
        this.loadHistoryData()
        this.loadDailySummary()
      }
    })
  },

  /**
   * 加载历史数据
   */
  loadHistoryData() {
    if (!this.data.currentDeviceId) return Promise.resolve()
    return api.getHistoryData(this.data.currentDeviceId, this.data.hours).then(res => {
      const list = (res.data || []).map(item => {
        const aqi = item.aqi || 0
        const levelInfo = this.getAQILevel(aqi)
        // 提取时间部分 HH:mm
        const timeStr = (item.sample_time || '').substr(-8, 5)
        return {
          ...item,
          timeStr,
          aqi,
          ...levelInfo
        }
      })
      this.setData({ historyList: list })
    })
  },

  /**
   * 加载每日统计摘要
   */
  loadDailySummary() {
    const today = this.formatDate(new Date())
    return api.getDailySummary(today).then(res => {
      const dataList = res.data || []
      // 找到当前设备的统计数据
      const stat = dataList.find(d => d.device_id === this.data.currentDeviceId)
      if (stat) {
        this.setData({
          summary: {
            avgAqi: stat.avg_aqi != null ? stat.avg_aqi.toFixed(1) : '--',
            maxAqi: stat.max_aqi != null ? stat.max_aqi : '--',
            avgPm25: stat.avg_pm2_5 != null ? stat.avg_pm2_5.toFixed(1) : '--',
            date: stat.stat_date || today
          }
        })
      } else {
        this.setData({
          summary: { avgAqi: '--', maxAqi: '--', avgPm25: '--', date: today }
        })
      }
    }).catch(() => {})
  },

  /**
   * AQI 等级判断
   */
  getAQILevel(aqi) {
    if (aqi <= 0)   return { aqiClass: '',            levelText: '未知', levelClass: 'level-unknown' }
    if (aqi <= 50)  return { aqiClass: 'aqi-excellent', levelText: '优',  levelClass: 'level-excellent' }
    if (aqi <= 100) return { aqiClass: 'aqi-good',      levelText: '良',  levelClass: 'level-good' }
    if (aqi <= 150) return { aqiClass: 'aqi-mild',      levelText: '轻度', levelClass: 'level-mild' }
    if (aqi <= 200) return { aqiClass: 'aqi-moderate',  levelText: '中度', levelClass: 'level-moderate' }
    return { aqiClass: 'aqi-severe', levelText: '重度', levelClass: 'level-severe' }
  },

  /**
   * 格式化日期 YYYY-MM-DD
   */
  formatDate(date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  },

  /**
   * 切换时间范围
   */
  switchHours(e) {
    const hours = e.currentTarget.dataset.hours
    this.setData({ hours })
    this.loadHistoryData()
  },

  /**
   * 设备选择弹窗 — 打开
   */
  handleSwitchDevice() {
    this.setData({ showDevicePicker: true })
  },

  closePicker() {
    this.setData({ showDevicePicker: false })
  },

  selectDevice(e) {
    const index = e.currentTarget.dataset.index
    const device = this.data.deviceList[index]
    this.setData({
      currentDeviceId: device.device_id,
      currentDeviceName: device.device_name || device.device_id,
      showDevicePicker: false
    })
    wx.setStorageSync('currentDeviceId', device.device_id)
    wx.setStorageSync('currentDeviceName', device.device_name || device.device_id)
    this.loadHistoryData()
    this.loadDailySummary()
  },

  noop() {}
})
