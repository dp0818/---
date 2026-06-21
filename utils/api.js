/**
 * API 接口封装模块 —— 城市空气质量检测小程序
 * 所有后端请求统一封装，页面引入后直接调用
 * baseUrl = http://47.109.191.13:5000
 */

const app = getApp()

// ==================== 1. 用户登录 ====================
function login(code, profile) {
  return new Promise((resolve, reject) => {
    const data = { code }
    if (profile) {
      if (profile.nickname) data.nickname = profile.nickname
      if (profile.avatar_url) data.avatar_url = profile.avatar_url
      if (profile.gender !== undefined && profile.gender !== null) data.gender = profile.gender
    }
    app.request({
      url: '/api/login',
      method: 'POST',
      data,
      success: resolve,
      fail: reject
    })
  })
}

// ==================== 1b. 更新个人资料 ====================
function updateProfile(open_id, profile) {
  return new Promise((resolve, reject) => {
    app.request({
      url: '/api/user/profile',
      method: 'POST',
      data: Object.assign({ open_id }, profile || {}),
      success: resolve,
      fail: reject
    })
  })
}

function getUserProfile(open_id) {
  return new Promise((resolve, reject) => {
    app.request({
      url: '/api/user/profile',
      method: 'POST',
      data: { open_id, _query: true },
      success: resolve,
      fail: reject
    })
  })
}

// ==================== 1c. 绑定手机号 ====================
function bindPhone(open_id, phone_code) {
  return new Promise((resolve, reject) => {
    app.request({
      url: '/api/user/bind-phone',
      method: 'POST',
      data: { open_id, phone_code },
      success: resolve,
      fail: reject
    })
  })
}

// ==================== 2. 设备管理 ====================
function bindDevice(open_id, device_id, room_location, extra) {
  return new Promise((resolve, reject) => {
    app.request({
      url: '/api/devices/bind',
      method: 'POST',
      data: Object.assign(
        { open_id, device_id, room_location: room_location || 'living_room' },
        extra || {}
      ),
      success: resolve,
      fail: reject
    })
  })
}

function unbindDevice(open_id, device_id) {
  return new Promise((resolve, reject) => {
    app.request({
      url: '/api/devices/unbind',
      method: 'POST',
      data: { open_id, device_id },
      success: resolve,
      fail: reject
    })
  })
}

function getDeviceList(open_id) {
  return new Promise((resolve, reject) => {
    app.request({
      url: '/api/devices/list',
      method: 'GET',
      data: { open_id },
      success: resolve,
      fail: reject
    })
  })
}

function updateDeviceLocation(device_id, longitude, latitude) {
  return new Promise((resolve, reject) => {
    app.request({
      url: '/api/devices/location',
      method: 'PUT',
      data: { device_id, longitude, latitude },
      success: resolve,
      fail: reject
    })
  })
}

// ==================== 3. 数据查询 ====================
function getCurrentData(device_id) {
  return new Promise((resolve, reject) => {
    app.request({
      url: '/api/current',
      method: 'GET',
      data: { device_id },
      success: resolve,
      fail: reject
    })
  })
}

function getHistoryData(device_id, hours) {
  return new Promise((resolve, reject) => {
    app.request({
      url: '/api/history',
      method: 'GET',
      data: { device_id, hours: hours || 24 },
      success: resolve,
      fail: reject
    })
  })
}

function getDailySummary(date, device_id) {
  return new Promise((resolve, reject) => {
    app.request({
      url: '/api/daily_summary',
      method: 'GET',
      data: { date, device_id },
      success: resolve,
      fail: reject
    })
  })
}

// ==================== 4. 收藏管理 ====================
function addFavorite(open_id, device_id) {
  return new Promise((resolve, reject) => {
    app.request({
      url: '/api/favorites/add',
      method: 'POST',
      data: { open_id, device_id },
      success: resolve,
      fail: reject
    })
  })
}

function removeFavorite(open_id, device_id) {
  return new Promise((resolve, reject) => {
    app.request({
      url: '/api/favorites/remove',
      method: 'POST',
      data: { open_id, device_id },
      success: resolve,
      fail: reject
    })
  })
}

function getFavoriteList(open_id) {
  return new Promise((resolve, reject) => {
    app.request({
      url: '/api/favorites/list',
      method: 'GET',
      data: { open_id },
      success: resolve,
      fail: reject
    })
  })
}

// ==================== 5. 运维监控（可选） ====================
// GET /api/status → { total, online, offline, simulators: { "CQ_001": {"status":"online",...}, ... } }
function getSimulatorStatus() {
  return new Promise((resolve, reject) => {
    wx.request({
      url: app.globalData.baseUrl + '/api/status',
      method: 'GET',
      header: { 'content-type': 'application/json' },
      success(res) {
        if (res.statusCode === 200) {
          resolve({ data: res.data })
        } else if (res.statusCode === 404) {
          resolve({ data: null })
        } else {
          reject(res)
        }
      },
      fail: reject
    })
  })
}

// ==================== 4b. 行政区划 ====================
// GET /api/regions → { regions: [{province, cities: [{city, districts: [...]}]}] }
function getRegions() {
  return new Promise((resolve, reject) => {
    app.request({
      url: '/api/regions',
      method: 'GET',
      showLoading: false,
      success: resolve,
      fail: reject
    })
  })
}

// ==================== 6. 告警管理 ====================
function getAlertSettings(open_id, device_id) {
  return new Promise((resolve, reject) => {
    app.request({
      url: '/api/alerts',
      method: 'GET',
      data: { open_id, device_id },
      success: resolve,
      fail: reject
    })
  })
}

function setAlertSettings(open_id, device_id, aqi_max, pm25_max) {
  return new Promise((resolve, reject) => {
    app.request({
      url: '/api/alerts/set',
      method: 'POST',
      data: { open_id, device_id, aqi_max, pm2_5_max: pm25_max },
      success: resolve,
      fail: reject
    })
  })
}

// ==================== 7. AI 分析 ====================
function aiAnalyze(device_id, hours) {
  return new Promise((resolve, reject) => {
    app.request({
      url: '/api/ai/analyze',
      method: 'POST',
      data: { device_id, hours: hours || 24 },
      success: resolve,
      fail: reject
    })
  })
}

module.exports = {
  login,
  updateProfile,
  getUserProfile,
  bindPhone,
  bindDevice,
  unbindDevice,
  getDeviceList,
  updateDeviceLocation,
  getCurrentData,
  getHistoryData,
  getDailySummary,
  addFavorite,
  removeFavorite,
  getFavoriteList,
  getSimulatorStatus,
  getRegions,
  getAlertSettings,
  setAlertSettings,
  aiAnalyze
}
