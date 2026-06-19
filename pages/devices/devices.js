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
    showDialog: false,  // 手动输入弹窗（步骤1）
    inputDeviceId: '',   // 输入的设备ID
    inputDeviceName: '', // 输入的设备名称
    showDetailDialog: false, // 手动输入弹窗（步骤2）
    showRoomPicker: false, // 房间选择弹窗（扫码流程）
    selectedRoom: 'living_room', // 默认客厅
    selectedRoomLabel: '客厅', // 当前选中房间的显示标签
    selectedRoomIcon: '🛋️',
    pendingDeviceId: '',  // 待绑定的设备ID
    statusError: '',      // 状态检测错误信息

    // 行政区划
    regionList: [],
    regionProvinceIndex: -1,
    regionProvinceName: '',
    regionCityOptions: [],
    regionCityIndex: -1,
    regionCityName: '',
    regionDistrictOptions: [],
    regionDistrictIndex: -1,
    regionDistrictName: '',

    // 用户类型 + 行业
    customerType: 'individual',
    industryOptions: ['办公', '工厂', '酒店', '学校', '商业', '医疗', '餐饮', '其他'],
    industryIndex: 0,
    industryName: '办公',

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
      const [deviceRes, favRes, statusRes] = await Promise.all([
        api.getDeviceList(open_id),
        api.getFavoriteList(open_id),
        api.getSimulatorStatus().catch(e => {
          console.warn('[Status] 获取模拟器状态失败:', e)
          return null
        })
      ])
      let deviceList = deviceRes.data || []
      const favoriteList = favRes.data || []
      const favIds = new Set(favoriteList.map(f => f.device_id))

      const simStatusMap = {}
      if (statusRes && statusRes.data && statusRes.data.simulators) {
        Object.keys(statusRes.data.simulators).forEach(key => {
          const sim = statusRes.data.simulators[key]
          simStatusMap[key] = sim
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

        const did = d.device_id || ''
        const simInfo = simStatusMap[did]
        let isOnline = false
        if (simInfo) {
          isOnline = (simInfo.status === 'online')
        }

        return { ...d, aqiClass, levelText, latestAqi: aqi, status: isOnline ? 1 : 0, roomIcons, roomNames }
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

  onNameChange(e) {
    this.setData({ inputDeviceName: e.detail.value })
  },

  handleManualBind() {
    const deviceId = this.data.inputDeviceId.trim()
    const deviceName = this.data.inputDeviceName.trim()
    if (!deviceId) {
      wx.showToast({ title: '请输入设备ID', icon: 'none' })
      return
    }
    if (!deviceName) {
      wx.showToast({ title: '请输入设备名称', icon: 'none' })
      return
    }
    this.setData({
      showDialog: false,
      pendingDeviceId: deviceId,
      showDetailDialog: true
    })
    if (this.data.regionList.length === 0) {
      this.loadRegions()
    }
  },

  hideDetailDialog() {
    this.setData({ showDetailDialog: false, pendingDeviceId: '' })
  },

  async loadRegions() {
    try {
      const res = await api.getRegions()
      const list = (res.data && res.data.regions) || []
      const flat = list.map(r => ({
        name: r.province,
        cities: r.cities.map(c => ({ name: c.city, districts: (c.districts || []).map(d => ({ name: d })) }))
      }))
      this.setData({ regionList: flat })
    } catch (e) {
      console.warn('[Regions] 加载失败:', e)
    }
  },

  onRegionProvinceChange(e) {
    const idx = parseInt(e.detail.value)
    const province = this.data.regionList[idx]
    if (!province) return
    this.setData({
      regionProvinceIndex: idx,
      regionProvinceName: province.name,
      regionCityIndex: 0,
      regionCityName: '',
      regionDistrictIndex: 0,
      regionDistrictName: '',
      regionCityOptions: province.cities || [],
      regionDistrictOptions: []
    })
  },

  onRegionCityChange(e) {
    const idx = parseInt(e.detail.value)
    const city = this.data.regionCityOptions[idx]
    if (!city) return
    this.setData({
      regionCityIndex: idx,
      regionCityName: city.name,
      regionDistrictIndex: 0,
      regionDistrictName: ''
    })
    this.setData({ regionDistrictOptions: city.districts || [] })
  },

  onRegionDistrictChange(e) {
    const idx = parseInt(e.detail.value)
    const district = this.data.regionDistrictOptions[idx]
    if (!district) return
    this.setData({ regionDistrictIndex: idx, regionDistrictName: district.name })
  },

  onCustomerTypeChange(e) {
    const t = e.currentTarget.dataset.type
    this.setData({ customerType: t })
  },

  onIndustryChange(e) {
    const idx = parseInt(e.detail.value)
    this.setData({
      industryIndex: idx,
      industryName: this.data.industryOptions[idx]
    })
  },

  confirmDetailBind() {
    const open_id = app.globalData.open_id
    const deviceId = this.data.pendingDeviceId
    if (!deviceId) return

    if (this.data.customerType === 'enterprise' && !this.data.industryName) {
      wx.showToast({ title: '请选择行业', icon: 'none' })
      return
    }

    wx.showLoading({ title: '绑定中...', mask: true })
    api.bindDevice(
      open_id,
      deviceId,
      this.data.selectedRoom,
      {
        device_name: this.data.inputDeviceName.trim(),
        province: this.data.regionProvinceName,
        city: this.data.regionCityName,
        district: this.data.regionDistrictName,
        customer_type: this.data.customerType,
        industry: this.data.customerType === 'enterprise' ? this.data.industryName : ''
      }
    ).then(() => {
      wx.hideLoading()
      wx.showToast({ title: '绑定成功', icon: 'success' })
      this.setData({
        showDetailDialog: false,
        pendingDeviceId: '',
        inputDeviceId: '',
        inputDeviceName: '',
        regionProvinceName: '',
        regionCityName: '',
        regionDistrictName: '',
        customerType: 'individual'
      })
      this.loadAll()
    }).catch(() => {
      wx.hideLoading()
      this.setData({ showDetailDialog: false, pendingDeviceId: '' })
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
