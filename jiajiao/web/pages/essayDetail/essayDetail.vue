<template>
	<view class="msg_detail">
		<view class="msg_title">{{info.title}}</view>
		<view class="time_box">发布于{{info.create_time}}
		</view>
		<view class="msg_content_box">
			<rich-text :nodes="info.detail"></rich-text>
		</view>
		<!-- 	<view class="bottom_btn">
			<view bindtap="shoucang" class="item">
				<image class="icon" src="/static/images/ui_r28_c44.png" v-if="isSc"></image>
				<image class="icon" src="/static/images/menu_r4_c25.png" v-else></image>
				<view class="name">收藏</view>
			</view>
			<view bindtap="fenxiang" class="item share_box">
				<image class="icon" src="/static/images/yjfx.png"></image>
				<view class="name">分享</view>
				<button class="btn" openType="share"></button>
			</view>
		</view> -->
	</view>
</template>

<script>
	export default {
		data() {
			return {
				isSc: false,
				info: {}
			}
		},
		onLoad(options) {
			this.info = JSON.parse(decodeURIComponent(options.item))

		},
		methods: {

		}
	}
</script>

<style scoped>
	page {
		background: #f8f8f7;
	}

	.msg_detail {
		width: 100%;
		padding-bottom: 120rpx;
	}

	.msg_detail .msg_title {
		font-size: 40rpx;
		font-weight: 600;
		padding: 20rpx;
	}

	.msg_detail .time_box {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: flex-end;
		font-size: 26rpx;
		color: #9b9b9b;
		padding: 20rpx;
		box-sizing: border-box;
	}

	.msg_detail .time_box .see_icon {
		width: 35rpx;
		height: 25rpx;
		margin: 0 20rpx;
	}

	.msg_content_box {
		padding: 0 15rpx;
		width: 100%;
		display: flex;
		flex-direction: column;
	}



	.msg_content_box text {
		text-indent: 2rem;
	}

	.msg_content_box img {
		width: 100%;
		margin: 20rpx 0;
	}

	.msg_detail .bottom_btn {
		position: fixed;
		bottom: 0;
		left: 0;
		height: 80rpx;
		background: #fff;
		border-top: 1rpx solid #f0f0f0;
		display: flex;
		flex-direction: row;
		width: 100%;
		align-items: center;
	}

	.msg_detail .bottom_btn .item {
		display: flex;
		flex: 1;
		justify-content: center;
		align-items: center;
		border-right: 1rpx solid #9b9b9b;
	}

	.msg_detail .bottom_btn .icon {
		width: 50rpx;
		height: 50rpx;
		margin-right: 20rpx;
	}

	.msg_detail .bottom_btn .name {
		font-size: 26rpx;
	}

	.share_box {
		position: relative;
	}

	.btn {
		position: absolute;
		left: 80rpx;
		width: 228rpx;
		z-index: 1000;
		opacity: 0;
		height: 80rpx;
	}
</style>
