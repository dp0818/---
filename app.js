/**
 * 全局应用实例
 * - onLaunch:  检查登录状态，自动跳转
 * - globalData: open_id、当前设备等全局数据
 * - request:   统一封装的网络请求（loading + 错误处理
 */
App({
  globalData: {
    open_id: '',
    currentDeviceId: '',
    currentDeviceName: '',
    userProfile: null,
    baseUrl: 'https://47.109.191.13'
  },

  onLaunch() {
    const open_id = wx.getStorageSync('open_id')
    const profile = wx.getStorageSync('user_profile')
    if (open_id) this.globalData.open_id = open_id
    if (profile) this.globalData.userProfile = profile
  },

  setUserProfile(profile) {
    this.globalData.userProfile = profile
    if (profile) wx.setStorageSync('user_profile', profile)
    else wx.removeStorageSync('user_profile')
  },

  /**
   * 统一网络请求封装
   * 自动拼接 baseUrl，统一显示 loading / toast 错误
   * @param {Object} opts - { url, method, data, success, fail, showLoading }
   */
  request(opts) {
    const {
      url,
      method = 'GET',
      data = {},
      success,
      fail,
      showLoading = true
    } = opts

    if (showLoading) {
      wx.showLoading({ title: '加载中...', mask: true })
    }

    wx.request({
      url: this.globalData.baseUrl + url,
      method,
      data,
      header: { 'content-type': 'application/json' },
      success(res) {
        if (showLoading) wx.hideLoading()

        if (res.statusCode === 200 && res.data && res.data.code === 200) {
          success && success(res.data)
        } else if (res.statusCode === 404) {
          wx.showToast({ title: '接口不存在(404)', icon: 'none' })
          fail && fail(res.data)
        } else if (res.statusCode === 500) {
          wx.showToast({ title: '服务器错误(500)', icon: 'none' })
          fail && fail(res.data)
        } else {
          const msg = (res.data && res.data.message) || '请求失败'
          wx.showToast({ title: msg, icon: 'none' })
          fail && fail(res.data)
        }
      },
      fail(err) {
        if (showLoading) wx.hideLoading()
        wx.showToast({ title: '网络异常，请检查网络', icon: 'none', duration: 2000 })
        fail && fail(err)
      }
    })
  }
})
