<template>
	<view class="login_phonebox">
		<view class="container_box">
			<view class="page_boxone">
				<view class="page_auto">
					<text class="title">手机号：</text>
					<view class="input_box">
						<input type="number" v-model="phone_num" placeholder="请输入手机号"
							placeholder-style="font-size:28rpx;color:#999;">
					</view>
					<text class="title">验证码：</text>
					<view class="input_box">
						<input type="number" v-model="yzm_text" placeholder="请输入验证码"
							placeholder-style="font-size:28rpx;color:#999;">
						<text @click="get_yzmfun">{{time_num}}</text>
						<text v-if="show_s">s</text>
					</view>
					<view class="submt_btn">
						<button @click="loginbtnfun">立即登录</button>
					</view>
				</view>
			</view>
			<!-- <view class="page_boxtwo" :style="page_num==1?'top:0':''">
				<view class="page_auto">
					<text class="title">验证码已发送至：</text>
					<view class="phone_text_num">
						<text class="phone">{{phone_num}}</text>
						<text class="time" v-if="time_num!=0">{{time_num}}s</text>
						<text class="getyzm" v-else>重新获取</text>
					</view>

				</view>
			</view> -->

		</view>
		<!-- <view class="bottom_messagebox">
			<view class="center_mesg">
				<view class="aduio_chose" @click='is_check=!is_check'>
					<text v-if='is_check' class='audio_dot'></text>
				</view>
				<text class='text_info'>登陆即同意</text>
				<text class='mest_text' @click='look_info(0)'>《用户协议》</text>
				<text class='mest_text' @click='look_info(1)'>《免责声明》</text>
				<text class='mest_text' @click='look_info(2)'>《隐私保护》</text>
			</view>
		</view> -->
	</view>
</template>

<script>
	export default {
		data() {
			return {
				// page_num: 0,
				code: "",
				phone_num: "",
				yzm_text: "",
				time_num: '获取验证码',
				show_s: false,
				btn_back: false,
				is_check: true,
			}
		},
		onLoad() {
			this.get_codefun()
		},
		methods: {
			look_info(n) {
				uni.navigateTo({
					url: "../../component/look_infopage/look_infopage?type=" + n
				})
			},
			// 获取code
			get_codefun() {
				let that = this;
				wx.login({
					success: res => {
						that.code = res.code
					}
				})
			},
			get_yzmfun() {
				if (this.phone_num == '') {
					uni.showToast({
						title: "请输入手机号",
						icon: "none"
					})
					return false
				}
				if (this.time_num != '获取验证码') {
					return false
				}
				let data = {
					mobile: this.phone_num
				};
				if (this.btn_back) {
					return false
				}
				this.btn_back = true;
				this.api("/login/sendMobileCode", 'post', data).then(res => {
					console.log(res)
					if (res.status == 200) {
						this.time_num = 60;
						this.show_s = true;
						// 执行倒计时
						this.time_countfun()

						uni.showToast({
							title: "验证码发送成功",
							icon: "none"
						})
					} else {
						uni.showToast({
							title: res.msg,
							icon: "none"
						})
					}


				})




			},
			// upload_avatar_imgfun() {
			// 	let imginfo = require("../../static/upload_avator.png")
			// 	let that = this;
			// 	wx.uploadFile({
			// 		url: that.pic_url + '/Base/upload',
			// 		filePath: imginfo,
			// 		name: 'file',
			// 		formData: {
			// 			user: 'text'
			// 		},
			// 		success(result) {
			// 			let imgdata = JSON.parse(result.data);
			// 			// if (type == 0) {
			// 			// 	that.id_card_zheng = imgdata.data
			// 			// } else {
			// 			// 	that.id_card_fan = imgdata.data
			// 			// }
			// 			console.log(imgdata)
			// 			return imgdata.data
			// 			// thtat.registrfun()



			// 		},
			// 	});
			// },
			registrfun(data) {

			},

			// 获取验证码倒计时
			time_countfun() {
				let intervarfun = setInterval(() => {
					if (this.time_num == 0) {
						this.time_num = '获取验证码'
						this.btn_back = false;
						this.show_s = false;
						clearInterval(intervarfun)
					} else {
						this.time_num--;
					}

				}, 1000)
			},



			loginbtnfun() {
				console.log(this.phone_num)
				if (!this.is_check) {
					uni.showToast({
						title: "请勾选用户协议",
						icon: "none"
					})
					return false
				}
				if (this.phone_num == '') {
					uni.showToast({
						title: "请输入手机号",
						icon: "none"
					})
					return false
				}
				if (this.yzm_text == '') {
					uni.showToast({
						title: "请输入验证码",
						icon: "none"
					})
					return false
				}

				let data = {
					code: this.code,
					mobile: this.phone_num,
					verify: this.yzm_text
				}

				// this.upload_avatar_imgfun()

				this.api("/login/mobileLogin", 'post', data).then(res => {
					console.log(res)

					if (res.status == 200) {
						uni.setStorageSync("token", res.data.token)
						uni.setStorageSync("user", res.data.user)
						// that.get_userinfo(1)
						uni.showToast({
							title: "登录成功",
							icon: "none"
						})
						setTimeout(() => {
							uni.navigateBack({
								delta: 2
							})
						}, 1000)
					} else {
						uni.showToast({
							title: res.msg,
							icon: "none"
						})
						return false
					}
				})
			}

		}
	}
</script>

<style lang="less">
	.login_phonebox {
		width: 100%;
		min-height: 100vh;


		.container_box {
			width: 100%;
			height: 100vh;
			display: flex;
			position: relative;
			overflow: hidden;

			.page_boxone {
				width: 100%;
				height: 100%;
				background-image: linear-gradient(to bottom, #f7ca8f, #F7F2F5);
				transition-duration: 0.3s;
				display: flex;

				.page_auto {
					margin: 200rpx auto;
					width: 90%;

					.title {
						margin-top: 30rpx;
						width: 100%;
						font-size: 32rpx;
						font-weight: 600;
						color: #000;
						display: block;
						padding: 10rpx 20rpx;
					}

					.input_box {
						width: 100%;
						padding: 4rpx 30rpx;
						border: 1px solid rgba(0, 0, 0, 0.2);
						border-radius: 40rpx;
						display: flex;

						input {
							margin: auto 0;
							width: 100%;
							padding: 10rpx 0;
							background-color: rgba(255, 255, 255, 0);
						}

						text {
							margin: auto 0;
							white-space: nowrap;
						}
					}

					.submt_btn {
						width: 100%;
						margin-top: 100rpx;

						button {
							width: 100%;
							padding: 5rpx 0;
							border-radius: 50rpx;
							background: linear-gradient(90deg, #db9e55, #f7ca8f);
							color: #fff;
							font-size: 28rpx;

						}

						button::after {
							border: none;
						}
					}
				}
			}

			.page_boxtwo {
				position: absolute;
				background-image: linear-gradient(to bottom, #F3D7C9, #F7F2F5);
				top: 100%;
				z-index: 10;
				width: 100%;
				height: 100%;
				background-color: blue;
				transition-duration: 0.3s;

				.page_auto {
					margin: 200rpx auto;
					width: 90%;

					.title {
						width: 100%;
						font-size: 34rpx;
						font-weight: 600;
						color: #000;
						display: block;
						padding: 10rpx 20rpx;
					}

					.phone_text_num {
						width: 100%;
						display: flex;
						justify-content: space-between;
					}

					// 	.input_box {
					// 		width: 100%;
					// 		padding: 4rpx 30rpx;
					// 		border: 1px solid rgba(0, 0, 0, 0.2);
					// 		border-radius: 40rpx;

					// 		input {
					// 			width: 100%;
					// 			padding: 10rpx 0;
					// 			background-color: rgba(255, 255, 255, 0);
					// 		}
					// 	}

					// 	.submt_btn {
					// 		width: 100%;
					// 		margin-top: 100rpx;

					// 		button {
					// 			width: 100%;
					// 			padding: 5rpx 0;
					// 			border-radius: 50rpx;
					// 			background-color: #FB7206;
					// 			color: #fff;
					// 			font-size: 28rpx;

					// 		}

					// 		button::after {
					// 			border: none;
					// 		}
					// 	}
				}

			}
		}

		.bottom_messagebox {
			width: 100%;
			display: flex;
			position: fixed;
			bottom: 0;
			z-index: 10;
			flex-direction: column;
			padding-bottom: constant(safe-area-inset-bottom);
			padding-bottom: env(safe-area-inset-bottom);

			.center_mesg {
				margin: auto;
				padding-bottom: 250rpx;
				display: flex;

				.aduio_chose {
					width: 36rpx;
					height: 36rpx;
					display: flex;
					border-radius: 100%;
					border: 1px solid #FB7206;

					.audio_dot {
						width: 22rpx;
						margin: auto;
						height: 22rpx;
						border-radius: 100%;
						background-color: #FB7206;
					}

				}

				.mest_text {
					font-size: 26rpx;
					font-weight: 600;
					margin: auto;
					color: #000;
				}

				.text_info {
					font-size: 26rpx;
					font-weight: 500;
					margin: auto;
					color: #000;
				}
			}
		}


	}
</style>