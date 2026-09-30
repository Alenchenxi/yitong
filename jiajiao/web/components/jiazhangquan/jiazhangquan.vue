<template>
	<view class="jiazhangquan">
		<view @click="toDetail(item)" class="item_box" v-for="(item,index) in articleList" :key="item.content_id">
			<view class="top">
				<image v-if="item.pic" class="header" :src="url+item.pic"></image>
				<image class="header" v-else src="/static/images/bigImg.png" mode=""></image>
			</view>
			<view class="bottom">
				<view class="title">{{item.title}}</view>
				<view class="desc"></view>
			</view>
		</view>
	</view>
</template>


<script>
	export default {
		name: "jiazhangquan",
		data() {
			return {
				url: this.imgUrl
			};
		},
		props: ['articleList'],
		methods: {
			toDetail(item) {
				uni.navigateTo({
					url: '/pages/essayDetail/essayDetail?item=' + encodeURIComponent(JSON.stringify(item))
				})
			}
		}
	}
</script>

<style scoped>
	.jiazhangquan .item_box {
		display: flex;
		flex-direction: column;
		background: #fff;
		margin: 20rpx 10rpx;
		border-radius: 10rpx;
	}

	.jiazhangquan .top {
		height: 340rpx;
		border-radius: 10rpx;
		background: #fff;
	}

	.jiazhangquan .header {
		height: 340rpx;
		border-radius: 10rpx;
		width: 100%;
	}

	.jiazhangquan .bottom {
		display: flex;
		flex-direction: column;
	}

	.jiazhangquan .bottom .title {
		font-size: 30rpx;
		margin: 20rpx 10rpx 0;
		text-indent: 10rpx;
		color: #414040;
		font-weight: 600;
		width: 640rpx;
	}

	.jiazhangquan .bottom .desc {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: flex-end;
		margin: 15rpx 0;
	}

	.jiazhangquan .desc .icon {
		width: 30rpx;
		height: 25rpx;
	}

	.jiazhangquan .desc .num {
		font-size: 24rpx;
		margin-left: 10rpx;
		margin-right: 20rpx;
	}
</style>