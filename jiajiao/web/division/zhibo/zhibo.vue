<template>
	<view class="container">
		<block v-if="list.length>0">
			<view class="playItem" @click="goZhibo(item.roomid)" v-for="(item,index) in list" :key="item.roomid">
				<image :src="item.feeds_img" mode=""></image>
				<text>{{item.name}}</text>
			</view>
		</block>

		<view v-else style="margin-top: 40rpx;width: 100%;text-align: center;">
			<text>暂无直播</text>
		</view>
	</view>
</template>

<script>
	export default {
		data() {
			return {
				list: []
			}
		},
		onLoad() {
			this.getList()
		},
		methods: {
			getList() {
				this.api('/index/getLiveList', 'post').then(res => {
					console.log(res)
					this.list = res.data
				})
			},
			goZhibo(id) {
				// #ifdef MP-WEIXIN
				let roomId = [id] // 填写具体的房间号，可通过下面【获取直播房间列表】 API 获取
				let customParams = encodeURIComponent(JSON.stringify({
					// path: '/pages/index/index',
					// pid: 1
				}))
				uni.navigateTo({
					url: `plugin-private://wx2b03c6e691cd7370/pages/live-player-plugin?room_id=${roomId}&custom_params=${customParams}`,
				})

				// #endif

			}
		}
	}
</script>
<style>
	page {
		background-color: #f6f6f6;
	}
</style>
<style lang="less" scoped>
	.container {
		width: 100%;
		height: 100%;
		padding: 0 25rpx;
		display: flex;
		justify-content: space-between;
		flex-wrap: wrap;

		.playItem {
			width: 49%;
			margin-top: 20rpx;
			display: flex;
			flex-direction: column;
			align-items: flex-start;
			background-color: #fff;
			border-radius: 12rpx;

			image {
				width: 100%;
				height: 300rpx;
				border-radius: 12rpx 12rpx 0 0;
			}

			text {
				display: block;
				margin: 20rpx;

			}
		}
	}
</style>