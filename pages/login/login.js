/**
 * 登录页逻辑
 * - 调用 wx.login 获取临时 code
 * - 调用后端 /api/login 换取 open_id
 * - 将 open_id 存入 globalData 和本地缓存
 * - 成功后跳转到首页
 */
const api = require('../../utils/api')
const app = getApp()

Page({
  data: {
    loading: false  // 按钮加载状态
  },

  onLoad() {
    // 如果已经登录过，直接跳转到首页，不需要重复登录
    const open_id = wx.getStorageSync('open_id')
    if (open_id) {
      app.globalData.open_id = open_id
      wx.switchTab({ url: '/pages/index/index' })
    }
  },

  /**
   * 微信一键登录按钮点击事件
   */
  handleLogin() {
    this.setData({ loading: true })

    // 第一步：调用微信登录接口获取临时授权码
    wx.login({
      success: (loginRes) => {
        if (!loginRes.code) {
          wx.showToast({ title: '获取授权码失败', icon: 'none' })
          this.setData({ loading: false })
          return
        }

        // 第二步：将授权码发送到后端，换取 open_id
        api.login(loginRes.code).then((res) => {
          const open_id = res.data.open_id

          // 存入全局变量
          app.globalData.open_id = open_id

          // 持久化到本地缓存
          wx.setStorageSync('open_id', open_id)

          wx.showToast({ title: '登录成功', icon: 'success' })

          // 跳转到首页（tabBar 页面需要用 switchTab）
          setTimeout(() => {
            wx.switchTab({ url: '/pages/index/index' })
          }, 800)
        }).catch(() => {
          // api.js 中已统一处理错误提示
          this.setData({ loading: false })
        })
      },
      fail: () => {
        wx.showToast({ title: '微信登录失败', icon: 'none' })
        this.setData({ loading: false })
      }
    })
  }
})
