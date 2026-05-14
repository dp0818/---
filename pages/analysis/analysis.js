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

    summary: {
      avgAqi: '--',
      maxAqi: '--',
      avgPm25: '--',
      date: ''
    },

    historyList: [],

    chartWidth: 335,
    chartHeight: 280,

    tooltip: {
      show: false,
      x: 0, y: 0,
      time: '', aqi: 0, pm: 0, no2: 0
    },

    aiResult: '',
    aiLoading: false,
    aiShow: false,
    aiError: ''
  },

  onShow() {
    const deviceId = wx.getStorageSync('currentDeviceId')
    const deviceName = wx.getStorageSync('currentDeviceName')
    if (deviceId) {
      this.setData({ currentDeviceId: deviceId, currentDeviceName: deviceName || deviceId })
    }
    this.loadDeviceList()
    this.initChartSize()
    if (deviceId) {
      this.loadHistoryData()
      this.loadDailySummary()
    }
  },

  onPullDownRefresh() {
    Promise.all([
      this.loadHistoryData(),
      this.loadDailySummary()
    ]).then(() => wx.stopPullDownRefresh()).catch(() => wx.stopPullDownRefresh())
  },

  initChartSize() {
    const sysInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    const width = sysInfo.windowWidth - 64
    this.setData({ chartWidth: width, chartHeight: 280 })
  },

  loadDeviceList() {
    const open_id = app.globalData.open_id
    if (!open_id) return
    api.getDeviceList(open_id).then(res => {
      const list = res.data || []
      this.setData({ deviceList: list })
      if (!this.data.currentDeviceId && list.length > 0) {
        const first = list[0]
        this.setData({ currentDeviceId: first.device_id, currentDeviceName: first.device_name || first.device_id })
        wx.setStorageSync('currentDeviceId', first.device_id)
        wx.setStorageSync('currentDeviceName', first.device_name || first.device_id)
        this.loadHistoryData()
        this.loadDailySummary()
      }
    })
  },

  loadHistoryData() {
    if (!this.data.currentDeviceId) return Promise.resolve()
    return api.getHistoryData(this.data.currentDeviceId, this.data.hours).then(res => {
      const list = res.data || []
      this.setData({ historyList: list }, () => {
        this.drawChart(list)
      })
    })
  },

  loadDailySummary() {
    const today = this.formatDate(new Date())
    return api.getDailySummary(today, this.data.currentDeviceId).then(res => {
      const dataList = res.data || []
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
        this.setData({ summary: { avgAqi: '--', maxAqi: '--', avgPm25: '--', date: today } })
      }
    }).catch(() => {})
  },

  getAQILevel(aqi) {
    if (aqi <= 0)   return { aqiClass: '', levelText: '未知', levelClass: 'level-unknown' }
    if (aqi <= 50)  return { aqiClass: 'aqi-excellent', levelText: '优',  levelClass: 'level-excellent' }
    if (aqi <= 100) return { aqiClass: 'aqi-good',      levelText: '良',  levelClass: 'level-good' }
    if (aqi <= 150) return { aqiClass: 'aqi-mild',      levelText: '轻度', levelClass: 'level-mild' }
    if (aqi <= 200) return { aqiClass: 'aqi-moderate',  levelText: '中度', levelClass: 'level-moderate' }
    return { aqiClass: 'aqi-severe', levelText: '重度', levelClass: 'level-severe' }
  },

  formatDate(date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  },

  switchHours(e) {
    const hours = e.currentTarget.dataset.hours
    this.setData({ hours, tooltip: { show: false } })
    this.loadHistoryData()
  },

  handleSwitchDevice() { this.setData({ showDevicePicker: true }) },
  closePicker() { this.setData({ showDevicePicker: false }) },

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

  noop() {},

  // ========== AI 分析 ==========
  loadAIAnalysis() {
    if (!this.data.currentDeviceId) {
      wx.showToast({ title: '请先选择设备', icon: 'none' })
      return
    }
    this.setData({ aiLoading: true, aiError: '', aiShow: true })
    api.aiAnalyze(this.data.currentDeviceId, this.data.hours)
      .then(res => {
        this.setData({
          aiResult: (res.data && res.data.analysis) || res.data || '暂无分析结果',
          aiLoading: false
        })
      })
      .catch(err => {
        this.setData({
          aiError: (err && err.errMsg) || '分析请求失败，请稍后重试',
          aiLoading: false
        })
      })
  },

  closeAI() {
    this.setData({ aiShow: false, aiResult: '' })
  },

  // ========== 导出 & 分享 ==========
  exportChart() {
    wx.canvasToTempFilePath({
      canvasId: 'trendChart',
      success(res) {
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success() { wx.showToast({ title: '已保存到相册', icon: 'success' }) },
          fail() { wx.showToast({ title: '保存失败', icon: 'none' }) }
        })
      },
      fail() { wx.showToast({ title: '导出失败', icon: 'none' }) }
    }, this)
  },

  shareChart() {
    wx.canvasToTempFilePath({
      canvasId: 'trendChart',
      success(res) {
        wx.shareFileMessage({
          filePath: res.tempFilePath,
          fileName: 'aqi_trend.png',
          fail() { wx.showToast({ title: '分享失败', icon: 'none' }) }
        })
      },
      fail() { wx.showToast({ title: '导出失败', icon: 'none' }) }
    }, this)
  },

  // ========== Canvas 折线图绘制 ==========
  drawChart(dataList) {
    if (!dataList || dataList.length === 0) return

    const ctx = wx.createCanvasContext('trendChart', this)
    const W = this.data.chartWidth
    const H = this.data.chartHeight

    const padT = 30, padR = 20, padB = 36, padL = 42
    const chartW = W - padL - padR
    const chartH = H - padT - padB

    const times = dataList.map(item => ((item.sample_time || '').slice(-8, 5)))
    const aqiData = dataList.map(item => item.aqi || 0)
    const pmData = dataList.map(item => item.pm2_5 || 0)
    const no2Data = dataList.map(item => item.no2 || 0)

    const maxAqi = Math.max(...aqiData, 10)
    const maxPm = Math.max(...pmData, 10)
    const maxNo2 = Math.max(...no2Data, 10)
    const len = aqiData.length

    ctx.clearRect(0, 0, W, H)

    // AQI 等级背景色带
    const bands = [
      { max: 50,  color: 'rgba(76,175,80,0.06)' },
      { max: 100, color: 'rgba(255,193,7,0.06)' },
      { max: 150, color: 'rgba(255,152,0,0.06)' },
      { max: 200, color: 'rgba(244,67,54,0.06)' },
      { max: 999, color: 'rgba(156,39,176,0.06)' }
    ]
    const yScale = chartH / Math.max(maxAqi, 1)
    let prevY = padT + chartH
    bands.forEach(band => {
      const bandTop = padT + chartH - Math.min(band.max, maxAqi) * yScale
      if (bandTop < prevY) {
        ctx.setFillStyle(band.color)
        ctx.fillRect(padL, Math.max(bandTop, padT), chartW, prevY - Math.max(bandTop, padT))
        prevY = bandTop
      }
    })

    // 网格线
    ctx.setStrokeStyle('#E8ECF0')
    ctx.setLineWidth(0.5)
    for (let i = 0; i <= 4; i++) {
      const y = padT + (chartH / 4) * i
      ctx.beginPath()
      ctx.moveTo(padL, y)
      ctx.lineTo(W - padR, y)
      ctx.stroke()
    }

    // Y轴标签
    ctx.setFillStyle('#95A5A6')
    ctx.setFontSize(10)
    ctx.setTextAlign('right')
    for (let i = 0; i <= 4; i++) {
      const val = Math.round(maxAqi - (maxAqi / 4) * i)
      const y = padT + (chartH / 4) * i
      ctx.fillText(String(val), padL - 6, y + 4)
    }

    // X轴时间标签
    ctx.setTextAlign('center')
    const labelStep = this.getTimeLabelStep(this.data.hours, len)
    for (let i = 0; i < len; i += labelStep) {
      const x = padL + (chartW / (len - 1 || 1)) * i
      ctx.fillText(times[i], x, H - padB + 16)
    }

    function toX(i) { return padL + (chartW / (len - 1 || 1)) * i }
    function toY_AQI(v) { return padT + chartH - (v / maxAqi) * chartH }
    function toY_PM(v) { return padT + chartH - (v / maxPm) * chartH }
    function toY_NO2(v) { return padT + chartH - (v / maxNo2) * chartH }

    // AQI 折线 + 渐变填充
    ctx.beginPath()
    ctx.setStrokeStyle('#FF5722')
    ctx.setLineWidth(2)
    aqiData.forEach((val, i) => {
      const x = toX(i), y = toY_AQI(val)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()

    const grad = ctx.createLinearGradient(0, padT, 0, H - padB)
    grad.addColorStop(0, 'rgba(255,87,34,0.15)')
    grad.addColorStop(1, 'rgba(255,87,34,0)')
    ctx.lineTo(toX(len - 1), H - padB)
    ctx.lineTo(padL, H - padB)
    ctx.closePath()
    ctx.setFillStyle(grad)
    ctx.fill()

    // PM2.5 折线
    ctx.beginPath()
    ctx.setStrokeStyle('#2196F3')
    ctx.setLineWidth(2)
    pmData.forEach((val, i) => {
      const x = toX(i), y = toY_PM(val)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()

    // NO₂ 折线
    if (maxNo2 > 0) {
      ctx.beginPath()
      ctx.setStrokeStyle('#9C27B0')
      ctx.setLineWidth(1.5)
      ctx.setLineDash([4, 3])
      no2Data.forEach((val, i) => {
        const x = toX(i), y = toY_NO2(val)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()
      ctx.setLineDash([])
    }

    // 数据点
    aqiData.forEach((val, i) => {
      ctx.beginPath()
      ctx.arc(toX(i), toY_AQI(val), 2.5, 0, 2 * Math.PI)
      ctx.setFillStyle('#FF5722')
      ctx.fill()
    })

    pmData.forEach((val, i) => {
      ctx.beginPath()
      ctx.arc(toX(i), toY_PM(val), 2.5, 0, 2 * Math.PI)
      ctx.setFillStyle('#2196F3')
      ctx.fill()
    })

    if (maxNo2 > 0) {
      no2Data.forEach((val, i) => {
        ctx.beginPath()
        ctx.arc(toX(i), toY_NO2(val), 2, 0, 2 * Math.PI)
        ctx.setFillStyle('#9C27B0')
        ctx.fill()
      })
    }

    ctx.draw(false)

    this._chartParams = { padL, padR, padT, padB, chartW, chartH, times, aqiData, pmData, no2Data, maxAqi, maxPm, maxNo2, W, H }
  },

  getTimeLabelStep(hours, dataLen) {
    if (hours <= 6) return Math.max(1, Math.floor(dataLen / 12))
    if (hours <= 12) return Math.max(1, Math.floor(dataLen / 12))
    if (hours <= 24) return Math.max(1, Math.floor(dataLen / 12))
    if (hours <= 48) return Math.max(1, Math.floor(dataLen / 12))
    return Math.max(1, Math.floor(dataLen / 8))
  },

  onTouchStart(e) {
    this.handleTouch(e.touches[0])
  },

  onTouchMove(e) {
    this.handleTouch(e.touches[0])
  },

  onTouchEnd(e) {
    setTimeout(() => this.setData({ tooltip: { show: false } }), 2000)
  },

  handleTouch(touch) {
    const p = this._chartParams
    if (!p) return

    const x = touch.x
    const idx = Math.round(((x - p.padL) / p.chartW) * (p.times.length - 1))
    if (idx < 0 || idx >= p.times.length) return

    const itemX = p.padL + (p.chartW / (p.times.length - 1 || 1)) * idx
    const aqiY = p.padT + p.chartH - (p.aqiData[idx] / p.maxAqi) * p.chartH

    this.setData({
      tooltip: {
        show: true,
        x: itemX - 60,
        y: aqiY - 80,
        time: p.times[idx],
        aqi: p.aqiData[idx],
        pm: p.pmData[idx],
        no2: p.no2Data[idx] || '--'
      }
    })
  }
})