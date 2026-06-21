/**
 * 登录页逻辑
 * - 头像、昵称（必填）
 * - 手机号：微信 getPhoneNumber 或手动输入（二选一）
 */
const api = require('../../utils/api')
const app = getApp()

Page({
  data: {
    loading: false,
    avatarUrl: '',
    nickname: '',
    phoneNumber: '',
    phoneCode: '',
    manualPhone: '',
    showManualPhone: false,
    canSubmit: false
  },

  onLoad() {
    const open_id = wx.getStorageSync('open_id')
    const profile = wx.getStorageSync('user_profile') || {}
    if (profile.avatar_url) this.setData({ avatarUrl: profile.avatar_url })
    if (profile.nickname) this.setData({ nickname: profile.nickname })
    if (profile.phone) this.setData({ phoneNumber: profile.phone })
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

  onManualPhoneInput(e) {
    this.setData({ manualPhone: e.detail.value })
  },

  toggleManualPhone() {
    this.setData({ showManualPhone: !this.data.showManualPhone })
  },

  onGetPhoneNumber(e) {
    const errMsg = e.detail.errMsg || ''
    if (errMsg !== 'getPhoneNumber:ok') {
      if (errMsg.includes('user deny') || errMsg.includes('deny')) {
        wx.showToast({ title: '可手动输入手机号', icon: 'none' })
        this.setData({ showManualPhone: true })
        return
      }
      console.warn('[手机号] 获取失败:', errMsg)
      wx.showToast({ title: '当前环境不支持手机号绑定', icon: 'none', duration: 2000 })
      this.setData({ showManualPhone: true })
      return
    }
    const code = e.detail.code
    this.setData({ phoneCode: code })

    const open_id = app.globalData.open_id || wx.getStorageSync('open_id')
    if (open_id && code) {
      wx.showLoading({ title: '绑定手机号...', mask: true })
      api.bindPhone(open_id, code).then(res => {
        wx.hideLoading()
        if (res.code === 200 && res.data && res.data.phone) {
          this.setData({ phoneNumber: res.data.phone, phoneCode: '' })
          const profile = wx.getStorageSync('user_profile') || {}
          profile.phone = res.data.phone
          wx.setStorageSync('user_profile', profile)
          if (app.globalData.userProfile) app.globalData.userProfile.phone = res.data.phone
          wx.showToast({ title: '手机号已绑定', icon: 'success' })
        } else {
          wx.showToast({ title: (res && res.message) || '绑定失败', icon: 'none' })
        }
      }).catch(err => {
        wx.hideLoading()
        const msg = (err && err.message) || '绑定失败，请稍后重试'
        wx.showToast({ title: msg, icon: 'none' })
      })
    }
  },

  checkCanSubmit() {
    const canSubmit = !!(this.data.avatarUrl && (this.data.nickname || '').trim())
    this.setData({ canSubmit })
  },

  handleLogin() {
    const { nickname, avatarUrl, phoneCode, manualPhone } = this.data
    if (!avatarUrl || !nickname.trim()) {
      wx.showToast({ title: '请先选择头像并填写昵称', icon: 'none' })
      return
    }
    const finalPhone = manualPhone.trim()
    if (finalPhone && !/^1\d{10}$/.test(finalPhone)) {
      wx.showToast({ title: '手机号格式不正确（11位）', icon: 'none' })
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

          // 先尝试微信手机号绑定
          const bindPhonePromise = phoneCode
            ? api.bindPhone(data.open_id, phoneCode).then(r => {
                if (r.code === 200 && r.data) {
                  data.phone = r.data.phone || data.phone
                }
                return r
              }).catch(() => {})
            : Promise.resolve()

          return bindPhonePromise.then(() => {
            // 如果微信绑定没拿到手机号但有手动输入的，调 profile 更新写手机
            const finalPhonePhone = data.phone || this.data.phoneNumber
            const profileUpdatePromise = (!finalPhonePhone && finalPhone)
              ? api.updateProfile(data.open_id, { phone: finalPhone }).catch(() => {})
              : Promise.resolve()

            return profileUpdatePromise.then(() => {
              const fullProfile = {
                nickname: data.nickname || profile.nickname,
                avatar_url: data.avatar_url || profile.avatar_url,
                gender: data.gender,
                email: data.email,
                phone: data.phone || this.data.phoneNumber || finalPhone
              }
              app.setUserProfile(fullProfile)
              wx.setStorageSync('open_id', data.open_id)
              wx.showToast({ title: '登录成功', icon: 'success' })
              setTimeout(() => {
                wx.switchTab({ url: '/pages/index/index' })
              }, 600)
            })
          })
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
