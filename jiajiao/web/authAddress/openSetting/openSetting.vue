<template>
	<view class="openSetting">
		<view class="tip">经纬度获取失败，请允许获取地理位置,否则将影响用户体验，谢谢！</view>
		<button @click="openSetting" class="bg1">去开启定位</button>
		<button @click="openSettingads" class="bg2">手动设置位置</button>
	</view>

</template>

<script>
	export default {
		data() {
			return {

			}
		},
		methods: {
			openSetting() {
				// uni.chooseLocation({
				// 	success(e) {
				// 		uni.setStorageSync('address', e.name)
				// 		uni.switchTab({
				// 			url: '/pages/index/index'
				// 		})
				// 	}
				// })
				uni.openSetting({
					success(res) {
						if (res.authSetting['scope.userLocation']) {
							uni.switchTab({
								url: '/pages/index/index'
							})
						}
					}
				})
			},
			openSettingads() {
				uni.navigateTo({
					url: '/authAddress/setAddress/setAddress'
				})
			}
		}
	}
</script>

<style scoped>
	.openSetting {
		height: 100vh;
		align-items: center;
		flex-direction: column;
	}

	.openSetting,
	.tip {
		display: flex;
		justify-content: center;
	}

	.tip {
		font-size: 28rpx;
		width: 70%;
		text-align: center;
	}

	button {
		margin-top: 30rpx;
		height: 60rpx;
		width: 300rpx;
		color: #fff;
		font-size: 30rpx;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.bg1 {
		background: #f8c400;
	}

	.bg2 {
		background: #00aa94;
	}
</style>
