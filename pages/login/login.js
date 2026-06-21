/**
 * 登录页逻辑
 * - 用户先选择微信头像、填写昵称（必填）
 * - 再调 wx.login 拿 code，连同头像/昵称一并提交到后端
 * - 后端入库 users 表
 */
const api = require('../../utils/api')
const app = getApp()

Page({
  data: {
    loading: false,
    avatarUrl: '',
    nickname: '',
    canSubmit: false
  },

  onLoad() {
    const open_id = wx.getStorageSync('open_id')
    const profile = wx.getStorageSync('user_profile') || {}
    if (profile.avatar_url) this.setData({ avatarUrl: profile.avatar_url })
    if (profile.nickname) this.setData({ nickname: profile.nickname })
    this.checkCanSubmit()
    if (open_id && profile.nickname) {
      app.globalData.open_id = open_id
      app.setUserProfile(profile)
      wx.switchTab({ url: '/pages/index/index' })
    }
  },

  onChooseAvatar(e) {
    const url = e.detail.avatarUrl
    if (!url) return
    this.setData({ avatarUrl: url }, () => this.checkCanSubmit())
  },

  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value }, () => this.checkCanSubmit())
  },

  onNicknameBlur(e) {
    this.setData({ nickname: (e.detail.value || '').trim() }, () => this.checkCanSubmit())
  },

  checkCanSubmit() {
    const canSubmit = !!(this.data.avatarUrl && (this.data.nickname || '').trim())
    this.setData({ canSubmit })
  },

  handleLogin() {
    const { nickname, avatarUrl } = this.data
    if (!avatarUrl || !nickname.trim()) {
      wx.showToast({ title: '请先选择头像并填写昵称', icon: 'none' })
      return
    }
    this.setData({ loading: true })

    wx.login({
      success: (loginRes) => {
        if (!loginRes.code) {
          wx.showToast({ title: '获取授权码失败', icon: 'none' })
          this.setData({ loading: false })
          return
        }
        const profile = { nickname: nickname.trim(), avatar_url: avatarUrl, gender: 0 }
        api.login(loginRes.code, profile).then((res) => {
          const data = res.data || {}
          app.globalData.open_id = data.open_id
          const fullProfile = {
            nickname: data.nickname || profile.nickname,
            avatar_url: data.avatar_url || profile.avatar_url,
            gender: data.gender,
            email: data.email,
            phone: data.phone
          }
          app.setUserProfile(fullProfile)
          wx.setStorageSync('open_id', data.open_id)
          wx.showToast({ title: '登录成功', icon: 'success' })
          setTimeout(() => {
            wx.switchTab({ url: '/pages/index/index' })
          }, 600)
        }).catch(() => {
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
