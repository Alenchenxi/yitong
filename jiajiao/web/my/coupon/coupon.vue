<template>
	<view>
		<view class="order_page">
			<view class="tab_box">
				<view @click="clickTab(item)" :class="item.active==1?'active':''" class="tab"
					v-for="(item,index) in tabArr" :key="index">{{item.name}}</view>
			</view>
		</view>
		<view style="height:90rpx"></view>
		<view class="coupon_item" v-for="(item,index) in couponList" :key="index">
			<view class="right">
				<image class="img" src="/static/images/youhuijuan.png">
				</image>
				<view class="right_money">￥{{item.price}}</view>
			</view>
			<view class="left">
				<view class="money">{{item.price}}元</view>
				<view class="time color">仅限购课程，不支持兑现</view>
				<view class="time">有效期：{{item.startime}}~{{item.endtime}}</view>
			</view>
		</view>

	</view>
</template>

<script>
	export default {
		data() {
			return {
				tabArr: [{
					name: "未使用",
					id: 1,
					active: 1
				}, {
					name: "已使用",
					id: 2,
					active: 0
				}, {
					name: "过期/无效",
					id: 3,
					active: 0
				}],
				couponList: [{
					price: 100,
					startime: '2022-3-3',
					endtime: '2023-2-2'
				}]
			}
		},
		methods: {
			clickTab(eitem) {
				this.tabArr.forEach(item => {
					item.active = 0
				})
				eitem.active = 1
			}
		}
	}
</script>

<style scoped>
	page {
		background: #f8f8f7;
	}

	.order_page {
		background: #fff;
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		z-index: 10000;
	}

	.order_page .tab_box {
		height: 90rpx;
		flex-direction: row;
		align-content: center;
		display: flex;
	}

	.order_page .tab_box .tab {
		font-size: 28rpx;
		height: 90rpx;
		flex: 1;
		color: #999;
		text-align: center;
		line-height: 90rpx;
		border-right: 1rpx solid #f8f8f7;
	}

	.order_page .tab_box .active {
		color: #fc9023;
		font-weight: 600;
	}

	.coupon_item {
		width: 95%;
		margin: 30rpx auto 0;
		background: #fff;
		display: flex;
		flex-direction: row;
		padding: 20rpx;
		box-sizing: border-box;
	}

	.coupon_item .right {
		position: relative;
	}

	.coupon_item .right_money {
		color: #f8c400;
		position: absolute;
		top: 48rpx;
		right: 55rpx;
		font-size: 40rpx;
		font-weight: 600;
	}

	.coupon_item .right .img {
		width: 240rpx;
		height: 150rpx;
		margin-right: 20rpx;
	}

	.coupon_item .left {
		display: flex;
		flex-direction: column;
		height: 150rpx;
		justify-content: space-between;
	}

	.coupon_item .left .money {
		font-size: 28rpx;
	}

	.coupon_item .left .time {
		font-size: 24rpx;
	}

	.coupon_item .left .color {
		color: #f8c400;
	}
</style>
