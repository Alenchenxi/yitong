<template>
	<view class="login">
		<image src="/static/images/logoo.jpg"></image>
		<view class="title">献新家教</view>
		<view class="box">
			<!-- #ifdef MP-WEIXIN -->
			<view class="h3">微信小程序，请确认授权以下信息</view>
			<!-- #endif -->
			<!-- #ifdef MP-BAIDU -->
			<view class="h3">百度小程序，请确认授权以下信息</view>
			<!-- #endif -->
			<!-- #ifdef MP-TOUTIAO -->
			<view class="h3">抖音小程序，请确认授权以下信息</view>
			<!-- #endif -->
			<view class="text">
				<view class="dot"></view>
				<text>获得你的联系方式</text>
			</view>
			<!-- #ifndef MP-TOUTIAO -->
			<button @getphonenumber="getPhoneNumber" class="y-btn" open-type="getPhoneNumber">手机号一键登录</button>
			<!-- #endif -->


			<button style="margin-top: 30rpx;" class="y-btn" @click="codeLogin">手机验证码登录</button>
		</view>
	</view>

</template>

<script>
	export default {
		data() {
			return {
				code: ''
			}
		},
		onLoad() {
			this.login()
		},
		methods: {
			codeLogin() {
				uni.navigateTo({
					url: '/my/codeLogin/codeLogin'
				})
			},
			login() {
				let that = this
				uni.login({
					success(res) {
						that.code = res.code
					}
				})
			},
			getPhoneNumber(e) {
				let that = this
				// #ifdef MP-WEIXIN
				that.api('/login/mobile', 'post', {
					code: that.code,
					iv: e.detail.iv,
					encryptedData: e.detail.encryptedData
				}).then(res1 => {

					uni.setStorageSync('user', res1.data.user)
					uni.setStorageSync('token', res1.data.token)
					uni.showToast({
						title: '登录成功',
						icon: 'none'
					})
					setTimeout(() => {
						uni.navigateBack()
					}, 1000)

				})
				// #endif
				// #ifdef MP-BAIDU

				swan.getLoginCode({
					success(res) {
						console.log(res)
						that.api('/login/baiDuLogin', 'post', {
							code: res.code,
							iv: e.detail.iv,
							encryptedData: e.detail.encryptedData
						}).then(res1 => {
							console.log(res1)
							uni.setStorageSync('user', res1.data.user)
							uni.setStorageSync('token', res1.data.token)
							uni.showToast({
								title: '登录成功',
								icon: 'none'
							})
							setTimeout(() => {
								uni.navigateBack()
							}, 1000)

						})
					}
				})
				// #endif
				// #ifdef MP-TOUTIAO
				that.api('/login/dyLogin', 'post', {
					code: that.code,
					iv: e.detail.iv,
					encryptedData: e.detail.encryptedData
				}).then(res1 => {

					uni.setStorageSync('user', res1.data.user)
					uni.setStorageSync('token', res1.data.token)
					uni.showToast({
						title: '登录成功',
						icon: 'none'
					})
					setTimeout(() => {
						uni.navigateBack()
					}, 1000)

				})
				// #endif
				console.log(e)
			}
		}
	}
</script>

<style scoped>
	.login {
		position: absolute;
		left: 0;
		right: 0;
		top: 0;
		bottom: 0;
		background: #fff;
	}

	.login image {
		display: block;
		width: 140rpx;
		height: 140rpx;
		margin: 60rpx auto 30rpx;
		border-radius: 20rpx;
	}

	.login .title {
		font-size: 15px;
		font-weight: 500;
		color: #333;
		text-align: center;
	}

	.login .box {
		margin: 60rpx;
		border-top: 1rpx solid #eee;
	}

	.login .box .h3 {
		font-size: 16px;
		margin-top: 40rpx;
	}

	.login .box .text {
		padding-left: 25rpx;
		font-size: 13px;
		color: #999;
		position: relative;
		line-height: 40rpx;
		margin-top: 20rpx;
	}

	.login .box .text .dot {
		width: 8rpx;
		height: 8rpx;
		border-radius: 50%;
		background: #999;
		position: absolute;
		left: 5rpx;
		top: 16rpx;
	}

	.y-btn {
		margin: 70rpx 50rpx;
		background: linear-gradient(90deg, #db9e55, #f7ca8f);
	}

	.back-btn,
	.y-btn {
		border-radius: 10rpx;
		font-size: 35rpx;
		color: #fff;
	}

	.back-btn {
		height: 82rpx;
		width: 545rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #eee;
		margin: 0 auto;
	}
</style>