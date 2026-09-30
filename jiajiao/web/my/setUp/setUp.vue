<template>
	<view class="container">
		<view class="head">
			<view class="headLeft">
				<text>头像</text>
				<img :src="avatarUrl" alt="">
			</view>
			<view class="headRi">
				<text>更改</text>
				<img src="/static/images/link-icon.png" alt="">
			</view>
			<button open-type="chooseAvatar" @chooseavatar="onChooseAvatar"></button>
		</view>
		<view class="personal">
			<view class="pName">
				<text>昵称</text>
				<input class="ipt" type="nickname" placeholder="请点击修改昵称~" placeholder-class="ipts" v-model="nickName">
			</view>
			<view class="phone">
				<text>手机号</text>
				<input type="number" placeholder="请输入手机号" placeholder-class="ipts" v-model="phone">
			</view>
		</view>
		<view class="submitUser" @click="preserInfo">
			<text>保存</text>
		</view>
	</view>
</template>

<script>
	export default {
		data() {
			return {
				avatarUrl: '',
				nickName: '',
				phone: ''
			}
		},
		computed: {

		},
		onLoad(option) {
			console.log(option)

		},
		methods: {
			preserInfo() {
				uni.setStorageSync('user', {
					avatarUrl: this.avatarUrl,
					nickName: this.nickName
				})
				uni.showToast({
					title: '保存成功',
					icon: "none"
				})
			},
			onChooseAvatar(e) {
				this.avatarUrl = e.detail.avatarUrl
			},

		}
	}
</script>

<style lang="less" scoped>
	.submitUser {
		width: calc(100% - 48rpx);
		height: 92rpx;
		background-color: #f8c400;
		border-radius: 12rpx;
		text-align: center;
		line-height: 92rpx;
		position: fixed;
		bottom: 20rpx;
		left: 24rpx;

		text {
			font-size: 32rpx;
			font-family: PingFang SC-Bold, PingFang SC;
			font-weight: bold;
			color: #FFFFFF;
		}
	}

	.container {
		width: 100%;

		.ipts {
			font-size: 28rpx;
			font-family: PingFang SC-Regular, PingFang SC;
			font-weight: 400;
			color: #999999;
		}

		.head {
			width: calc(100% - 48rpx);
			height: 144rpx;
			background-color: #FFFFFF;
			border-radius: 24rpx;
			display: flex;
			align-items: center;
			padding: 0 24rpx;
			justify-content: space-between;
			margin: 0 auto;
			margin-top: 20rpx;
			position: relative;

			button {
				width: 100%;
				height: 100%;
				position: absolute;
				top: 0;
				left: 0;
				background-color: transparent;

				&::after {
					display: none;
				}
			}

			.headLeft {
				display: flex;
				align-items: center;

				text {
					font-size: 28rpx;
					font-family: PingFang SC-Regular, PingFang SC;
					font-weight: 400;
					color: #333333;
					margin-right: 66rpx;
				}

				img {
					width: 96rpx;
					height: 96rpx;
					border-radius: 50%;
				}
			}

			.headRi {
				display: flex;
				align-items: center;

				text {
					font-size: 28rpx;
					font-family: PingFang SC-Regular, PingFang SC;
					font-weight: 400;
					color: #999999;
				}

				img {
					width: 13rpx;
					height: 24rpx;
					margin-left: 20rpx;
				}
			}
		}

		.personal {
			width: calc(100% - 48rpx);
			border-radius: 24rpx;
			background-color: #FFFFFF;
			padding: 0 24rpx;
			margin: 0 auto;
			margin-top: 20rpx;

			.pName {
				display: flex;
				align-items: center;
				width: 100%;
				height: 88rpx;

				text {
					font-size: 28rpx;
					font-family: PingFang SC-Regular, PingFang SC;
					font-weight: 400;
					color: #333333;
					display: block;
					width: 124rpx;
				}

				input {
					width: calc(100% - 124rpx);
					border: none;
				}

				/deep/.ipts {
					font-size: 28rpx;
					font-family: PingFang SC-Regular, PingFang SC;
					font-weight: 400;
					color: #999999;
				}

			}

			.sex {
				display: flex;
				align-items: center;
				width: 100%;
				height: 88rpx;

				&>text {
					font-size: 28rpx;
					font-family: PingFang SC-Regular, PingFang SC;
					font-weight: 400;
					color: #333333;
					display: block;
					width: 124rpx;
				}

				.ck {
					display: flex;
					align-items: center;
					margin-right: 68rpx;

					img {
						width: 28rpx;
						height: 28rpx;
						margin-right: 10rpx;
					}

					text {
						font-size: 28rpx;
						font-family: PingFang SC-Regular, PingFang SC;
						font-weight: 400;
						color: #999999;
					}
				}
			}

			.phone {
				display: flex;
				align-items: center;
				width: 100%;
				height: 88rpx;

				text {
					font-size: 28rpx;
					font-family: PingFang SC-Regular, PingFang SC;
					font-weight: 400;
					color: #333333;
					display: block;
					width: 124rpx;
				}

				input {
					width: calc(100% - 124rpx);
					border: none;
				}

				/deep/.ipts {
					font-size: 28rpx;
					font-family: PingFang SC-Regular, PingFang SC;
					font-weight: 400;
					color: #999999;
				}

			}

			.birth {
				display: flex;
				align-items: center;
				width: 100%;
				height: 88rpx;

				text {
					font-size: 28rpx;
					font-family: PingFang SC-Regular, PingFang SC;
					font-weight: 400;
					color: #333333;
					display: block;
					width: 124rpx;
				}

				picker {
					width: calc(100% - 124rpx);
					height: 100%;
					line-height: 88rpx;


				}

			}
		}
	}
</style>
