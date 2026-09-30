<script>
	export default {
		onLaunch: function() {
			uni.hideTabBar()
			uni.removeStorageSync('address')
			console.log('App Launch')
			const updateManager = wx.getUpdateManager()
			updateManager.onCheckForUpdate(function(res) {
				// 请求完新版本信息的回调
			})
			updateManager.onUpdateReady(function() {
				wx.showModal({
					title: '更新提示',
					content: '新版本已经准备好，是否重启应用？',
					success: function(res) {
						if (res.confirm) {
							// 新的版本已经下载好，调用 applyUpdate 应用新版本并重启
							updateManager.applyUpdate()
						}
					}
				})
			})
		},
		onShow: function() {
			console.log('App Show')
		},
		onHide: function() {
			console.log('App Hide')
		},

	}
</script>

<style lang="scss">
	/*每个页面公共css */

	@import "./uni_modules/vk-uview-ui/index.scss";

	// 全选选择器
	:not(not) {
		box-sizing: border-box
	}

	page {
		background-color: #f8f8f7;
	}
</style>
