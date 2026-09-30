<template>
	<view class="container">
		<view class="item" v-for="(item,index) in list" :key="index" @click="toPage(item.pagePath,index)">
			<image v-if="selectIndex==index" :src="item.selectedIconPath" mode=""></image>
			<image v-else :src="item.iconPath" mode=""></image>
			<text v-if="selectIndex==index" style="color: #f5cb2b;">{{item.text}}</text>
			<text v-else style="color: #999999;">{{item.text}}</text>
		</view>
	</view>
</template>

<script>
	export default {
		name: "tabBar",
		data() {
			return {
				identity: '',
				list: [{
						"pagePath": "pages/index/index",
						"text": "首页",
						"iconPath": "/static/images/defindex.png",
						"selectedIconPath": "/static/images/selindex.png"
					},
					{
						"pagePath": "receiving/receivingOrders/receivingOrders",
						"text": "最新家教信息",
						"iconPath": "/static/images/deflist.png",
						"selectedIconPath": "/static/images/sellist.png"
					},
					{
						"pagePath": "pages/grocery/grocery ",
						"text": "杂货铺",
						"iconPath": "/static/images/defpyq.png",
						"selectedIconPath": "/static/images/selpyq.png"
					},
					{
						"pagePath": "pages/my/my",
						"text": "我的",
						"iconPath": "/static/images/defmine.png",
						"selectedIconPath": "/static/images/selmine.png"
					}
				]
			};
		},
		props: ['selectIndex'],
		created() {
			uni.hideTabBar()
		},
		methods: {
			toPage(page, index) {
				console.log(page)
				console.log(index)

				if (index == 1) {
					uni.navigateTo({
						url: '/' + page
					})
					return
				}
				uni.switchTab({
					url: '/' + page
				})
			}
		}

	}
</script>

<style lang="less" scoped>
	.container {
		width: 100%;

		background-color: #fff;
		display: flex;
		position: fixed;
		bottom: 0;
		left: 0;
		padding-bottom: constant(safe-area-inset-bottom); // 底部安全区
		padding-bottom: env(safe-area-inset-bottom); // 底部安全区

		.item {
			width: 25%;
			height: 98rpx;
			display: flex;
			flex-direction: column;
			align-items: center;
			z-index: 999;

			image {
				width: 50rpx;
				height: 50rpx;
				z-index: 999;
			}

			text {
				margin-top: 5rpx;
				z-index: 999;
			}
		}
	}
</style>