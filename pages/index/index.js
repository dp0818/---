const api = require('../../utils/api')
const app = getApp()

Page({
  data: {
    currentDeviceId: '',
    currentDeviceName: '',
    deviceList: [],
    showDevicePicker: false,
    battery: '--',
    signal: '--',

    aqi: '--',
    pm2_5: '--',
    no2: '--',
    so2: '--',
    o3: '--',
    sampleTime: '',

    alert: false,
    alertLevel: '',
    alertLevelText: '',
    showAlertDialog: false,
    alertAqi: 0,
    alertTime: '',
    alertAdvice: '',

    aqiClass: '',
    levelText: '',
    levelClass: '',

    _alertShown: false,
    _lastAlert: false,
    _timer: null,
    _pollInterval: 60000,
    _bannerDismissed: false
  },

  onShow() {
    const deviceId = wx.getStorageSync('currentDeviceId')
    const deviceName = wx.getStorageSync('currentDeviceName')

    if (deviceId) {
      this.setData({ currentDeviceId: deviceId, currentDeviceName: deviceName || deviceId })
      this.loadDeviceList()
      this.loadCurrentData()
    } else {
      this.loadDeviceList()
    }

    this.startPolling()
  },

  onHide() {
    this.stopPolling()
  },

  onLoad() {
    this._alertShown = false
    this._lastAlert = false
  },

  onUnload() {
    this.stopPolling()
  },

  startPolling() {
    this.stopPolling()
    const interval = this.data.alert ? 10000 : 60000
    this._timer = setInterval(() => {
      if (this.data.currentDeviceId) {
        this.loadCurrentData()
      }
    }, interval)
  },

  stopPolling() {
    if (this._timer) {
      clearInterval(this._timer)
      this._timer = null
    }
  },

  updatePolling() {
    const newInterval = this.data.alert ? 10000 : 60000
    if (newInterval !== this.data._pollInterval) {
      this.setData({ _pollInterval: newInterval })
      this.startPolling()
    }
  },

  onPullDownRefresh() {
    if (this.data.currentDeviceId) {
      this.loadCurrentData().then(() => { wx.stopPullDownRefresh() })
    } else {
      wx.stopPullDownRefresh()
    }
  },

  loadDeviceList() {
    const open_id = app.globalData.open_id
    if (!open_id) return

    api.getDeviceList(open_id).then((res) => {
      const list = res.data || []
      this.setData({ deviceList: list })

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

  loadCurrentData() {
    if (!this.data.currentDeviceId) return Promise.resolve()

    return api.getCurrentData(this.data.currentDeviceId).then((res) => {
      const d = res.data
      const aqi = d.aqi || 0
      const levelInfo = this.getAQILevel(aqi)

      const alert = d.alert === true || d.alert === 'true'
      let alertLevel = ''
      let alertLevelText = ''
      let alertAdvice = ''

      if (alert) {
        alertLevel = d.alert_level || this.getAlertLevelText(aqi)
        alertLevelText = this.getAlertLevelDisplay(alertLevel)
        alertAdvice = this.getAlertAdvice(alertLevel)

        if (!this._alertShown) {
          this._alertShown = true
          wx.vibrateLong({ fail() {} })
          this.setData({
            showAlertDialog: true,
            alertAqi: aqi,
            alertTime: d.sample_time || '',
            alertAdvice
          })
        }

        wx.setTabBarBadge({ index: 0, text: '!' })
      } else {
        this._alertShown = false
        wx.removeTabBarBadge({ index: 0 })
      }

      if (alert && !this._lastAlert) {
        this.setData({ _bannerDismissed: false })
      }
      this._lastAlert = alert

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
        bgClass: levelInfo.levelClass.replace('level-', 'bg-aqi-'),
        alert,
        alertLevel,
        alertLevelText,
        alertAdvice
      })

      this.updatePolling()
    })
  },

  getAQILevel(aqi) {
    if (aqi <= 50)  return { aqiClass: 'aqi-excellent', levelText: '优',  levelClass: 'level-excellent' }
    if (aqi <= 100) return { aqiClass: 'aqi-good',      levelText: '良',  levelClass: 'level-good' }
    if (aqi <= 150) return { aqiClass: 'aqi-mild',      levelText: '轻度污染', levelClass: 'level-mild' }
    if (aqi <= 200) return { aqiClass: 'aqi-moderate',  levelText: '中度污染', levelClass: 'level-moderate' }
    return { aqiClass: 'aqi-severe', levelText: '重度污染', levelClass: 'level-severe' }
  },

  getAlertLevelText(aqi) {
    if (aqi > 200) return 'severe'
    if (aqi > 150) return 'moderate'
    if (aqi > 100) return 'mild'
    return 'good'
  },

  getAlertLevelDisplay(level) {
    const map = { severe: '严重污染', moderate: '中度污染', mild: '轻度污染', good: '轻度异常' }
    return map[level] || '异常'
  },

  getAlertAdvice(level) {
    const map = {
      severe: '建议立即关闭门窗，开启空气净化器，避免外出。如需外出请佩戴N95口罩。',
      moderate: '建议减少户外活动，关闭门窗，敏感人群应采取防护措施。',
      mild: '敏感人群应减少户外活动，注意关窗通风交替。',
      good: '空气质量略有异常，注意观察变化。'
    }
    return map[level] || '请注意空气质量变化。'
  },

  closeAlertDialog() {
    this.setData({ showAlertDialog: false })
  },

  closeAlert() {
    this.setData({ alert: false, _bannerDismissed: true })
  },

  onAlertBannerTouchStart(e) {
    this._bannerStartY = e.touches[0].clientY
  },

  onAlertBannerTouchMove(e) {
    const dy = e.touches[0].clientY - this._bannerStartY
    if (dy > 40) {
      this.setData({ alert: false, _bannerDismissed: true })
    }
  },

  handleSwitchDevice() { this.setData({ showDevicePicker: true }) },
  closePicker() { this.setData({ showDevicePicker: false }) },

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
    wx.setStorageSync('currentDeviceId', device.device_id)
    wx.setStorageSync('currentDeviceName', device.device_name || device.device_id)
    this.loadCurrentData()
  },

  noop() {},

  goAnalysis() { wx.switchTab({ url: '/pages/analysis/analysis' }) },
  goMap() { wx.switchTab({ url: '/pages/map/map' }) },

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