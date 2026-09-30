<template>
	<view>
		<view class="msg_content_box">
			<text>{{info.title}}</text>
			<rich-text :nodes="info.content"></rich-text>
		</view>
	</view>
</template>

<script>
	export default {
		data() {
			return {
				info: {}
			}
		},
		onLoad(options) {
			this.info = JSON.parse(decodeURIComponent(options.item))
		}
	}
</script>

<style scoped>
	.msg_content_box {
		width: 100%;
		padding: 15rpx;
		box-sizing: border-box;
	}

	.msg_content_box text:first-of-type {
		display: block;
		width: 100%;
		text-align: center;
		margin: 20rpx 0;
		text-decoration: underline;
		font-size: 35rpx;
	}

	.msg_content_box text:last-of-type {
		font-size: 24rpx;
	}
</style>
