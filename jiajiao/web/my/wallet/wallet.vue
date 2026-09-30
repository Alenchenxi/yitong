<template>
	<view class="wallet">
		<view class="img_zw"></view>
		<image class="img" src="/static/images/mineBg.png"></image>
		<view class="all_money">
			<view class="name">总余额（元）</view>
			<view class="money">￥{{allMoney}}</view>
		</view>
		<view @click="history" class="item_box">
			<view class="name">提现记录</view>
			<image class="jt" src="/static/images/jt.png"></image>
		</view>
	</view>

</template>

<script>
	export default {
		data() {
			return {
				allMoney: 0,
				zfb: "",
				money: 0,
				zfbname: ""
			}
		},
		methods: {
			history() {
				uni.navigateTo({
					url: '/my/walletEd/walletEd'
				})
			}
		}
	}
</script>

<style scoped>
	page {
		background: #f8f8f7;
	}

	.wallet .img_zw {
		height: 300rpx;
		width: 100%;
	}

	.wallet .img {
		height: 300rpx;
	}

	.all_money,
	.wallet .img {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
	}

	.all_money {
		font-size: 30rpx;
		flex-direction: column;
		font-weight: 600;
	}

	.all_money,
	.all_money_detail {
		height: 150rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
	}

	.all_money_detail {
		position: absolute;
		top: 150rpx;
		left: 0;
		font-size: 28rpx;
		flex-direction: row;
		width: 100%;
	}

	.all_money_detail .name {
		display: flex;
		height: 50rpx;
		flex: 1;
		align-items: center;
		justify-content: center;
	}

	.border-right {
		border-right: 1rpx solid #fff;
	}

	.item_box {
		background: #fff;
		width: 95%;
		margin: 20rpx auto;
		display: flex;
		align-items: center;
		padding: 20rpx;
		box-sizing: border-box;
		border-radius: 6rpx;
	}

	.item_box .name {
		font-size: 28rpx;
		flex: 1;
	}

	.item_box .jt {
		width: 13rpx;
		height: 18rpx;
	}

	.bottom_btn {
		height: 60rpx;
		width: 80%;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 6rpx;
		font-size: 28rpx;
		color: #fff;
		background: #fbce30;
		margin: 200rpx auto 0;
	}

	.desc {
		width: 70%;
		font-size: 26rpx;
		text-align: center;
	}

	.desc,
	.money_input_box {
		display: flex;
		margin: 30rpx auto 0;
	}

	.money_input_box {
		flex-direction: column;
		border-radius: 6rpx;
		width: 95%;
		background: #fff;
		padding: 0 20rpx;
		box-sizing: border-box;
	}

	.money_input_box .name {
		font-size: 26rpx;
		height: 60rpx;
		display: flex;
		align-items: center;
	}

	.money_input_box .input {
		height: 60rpx;
		font-size: 28rpx;
		margin: 20rpx 0;
		width: 100%;
		border: 1px solid #ccc;
		border-radius: 6rpx;
		text-indent: 10rpx;
	}
</style>
