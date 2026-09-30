<template>
	<view>
		<view @click="toys(1)" class="myhetong">
			<view class="name">用户协议</view>
			<image class="jt_icon" src="/static/images/jt.png"></image>
		</view>
		<view @click="toys(2)" class="myhetong">
			<view class="name">免责声明</view>
			<image class="jt_icon" src="/static/images/jt.png"></image>
		</view>
		<view @click="toys(3)" class="myhetong">
			<view class="name">隐私保护</view>
			<image class="jt_icon" src="/static/images/jt.png"></image>
		</view>

	</view>
</template>

<script>
	export default {
		data() {
			return {

			}
		},
		methods: {
			toys(type) {
				uni.navigateTo({
					url: '/my/xieyi/xieyi?type=' + type
				})
			}
		}
	}
</script>

<style scoped>
	.myhetong {
		display: flex;
		flex-direction: row;
		height: 80rpx;
		align-items: center;
		width: 100%;
		padding: 0 30rpx;
		box-sizing: border-box;
		border-bottom: 1rpx solid #f8f8f7;
	}

	.name {
		font-size: 28rpx;
		flex: 1;
	}

	.jt_icon {
		width: 18rpx;
		height: 23rpx;
	}
</style>
