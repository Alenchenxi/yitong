<template>
	<view class="container">
		<view class="con">
			<image src="/static/images/ruzhu.png" mode=""></image>
			<button class="btn" @click="nav"></button>
		</view>
	</view>
</template>

<script>
	export default {
		data() {
			return {

			}
		},
		onShow() {

		},
		methods: {
			nav() {
				if (!uni.getStorageSync('token')) {
					uni.navigateTo({
						url: '/my/getPhone/getPhone'
					})
					return
				}
				uni.setStorageSync('identity', 2)
				uni.navigateTo({
					url: `/pages_teacher/register?tipImage`
				})
				
			}
		}
	}
</script>

<style lang="less" scoped>
	.container {
		width: 100%;

		.con {
			width: 100%;
			height: 1708rpx;
			position: relative;

			image {
				width: 100%;
				height: 1708rpx;
				position: absolute;
				top: 0;
				left: 0;
			}

			.btn {
				width: 400rpx;
				height: 110rpx;
				position: absolute;
				right: 0;
				bottom: 250rpx;

				&::after {
					display: none;
				}

				background-color: transparent;
			}
		}

	}
</style>