<template>
	<view>
		<view class="order_page">
			<view class="tab_box">
				<view @click="clickTab(0)" :class="selectIndex==0?'active':''" class="tab">待付款</view>
				<view @click="clickTab(1)" :class="selectIndex==1?'active':''" class="tab">全部订单</view>
			</view>
		</view>
		<view class="order_box">
			<view @click="toOrderDetail(item)" class="order-list" v-for="(item,index) in waitOrder"
				:key="item.order_id">
				<view>
					<view class="time">订单时间：{{item.create_time}}</view>
					<view class="detail">
						<view class="teacher">
							<image v-if="item.head_img.indexOf('http')==-1" class="img" :src="url+item.head_img">
							</image>
							<image v-else class="img" :src="item.head_img"></image>
							<view class="desc">
								<view class="name">{{item.grade_name}}{{item.subject_name}}</view>
								<view class="teacher_name">{{item.linkman}}老师</view>
							</view>
						</view>
						<view class="time_box">
							<view class="left">订单类型:</view>
							<view class="money" v-if="item.teaching_way==1">上门授课</view>
							<view class="money" v-if="item.teaching_way==2">在线授课</view>
						</view>
						<view class="time_box">
							<view class="left">共计{{item.hour}}次课，{{item.hour*2}}小时</view>
							<view class="money">应付款：<text style="color:#fc9023">￥{{item.amount}}</text>
							</view>
						</view>
					</view>
					<view class="btn_box">
						<view class="status">
							{{item.status==0?'待支付':item.status==1?'已支付':item.status==2?'已完成':''}}
						</view>
						<view @click="toRate(item.teacher_id)" class="btn" v-if="(item.status==2)">
							去评价
						</view>
						<view @click.stop="nowpay(item.order_id)" class="btn" v-if="item.status==0">立即支付
						</view>
						<view class="" v-if="item.status==1">

						</view>
					</view>
				</view>
			</view>
		</view>

	</view>
</template>

<script>
	export default {
		data() {
			return {

				waitOrder: [],
				selectIndex: 0,
				page: 1,
				isList: true,
				url: this.imgUrl
			}
		},
		onReachBottom() {
			if (this.isList) {
				++this.page
				this.getOrderList(this.selectIndex)
			}
		},
		onLoad() {
			this.getOrderList(this.selectIndex)
		},
		methods: {
			toRate(id) {
				uni.navigateTo({
					url: '/division/ratePage/ratePage?id=' + id
				})
			},
			nowpay(id) {
				this.api('/order/wxPay', 'post', {
					order_id: id
				}).then(res => {
					uni.requestPayment({
						timeStamp: res.data.timeStamp,
						nonceStr: res.data.nonceStr,
						package: res.data.package,
						signType: 'MD5',
						paySign: res.data.paySign,
						success(res2) {
							uni.showToast({
								title: '支付成功',
								icon: 'success',
								duration: 1000
							})
							setTimeout(function() {
								uni.navigateBack()
							}, 1000);
						},
						fail(err) {
							uni.showToast({
								title: '支付失败',
								icon: 'none',
								duration: 1000
							})
						}
					})
				})

			},
			getOrderList(status) {
				this.api('/order/getStuOrderList', 'post', {
					page: this.page,
					order_state: status
				}).then(res => {
					console.log(res)
					if (res.data.length == 0) {
						this.isList = false
					}
					if (this.page == 1) {
						this.waitOrder = res.data
					} else {
						this.waitOrder = this.waitOrder.concat(res.data)
					}
				})
			},
			clickTab(index) {
				this.page = 1
				this.isList = true
				this.selectIndex = index
				this.getOrderList(index)
			},
			toOrderDetail(item) {
				uni.navigateTo({
					url: '/my/orderDetail/orderDetail?item=' + encodeURIComponent(JSON.stringify(item))
				})
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

	.order_box {
		display: flex;
		flex-direction: column;
		margin-top: 120rpx;
	}

	.order-list {
		background: #fff;
		width: 95%;
		margin: 0 auto 30rpx;
		border-radius: 8rpx;
	}

	.order-list .time {
		flex-direction: row;
		align-items: center;
		height: 60rpx;
		font-size: 26rpx;
		color: #666;
		text-indent: 20rpx;
	}

	.order-list .detail,
	.order-list .time {
		display: flex;
		border-bottom: 1rpx solid #f8f8f7;
	}

	.order-list .detail {
		flex-direction: column;
		margin: 10rpx 20rpx;
	}

	.order-list .teacher {
		display: flex;
		flex-direction: row;
		margin: 20rpx 0;
	}

	.order-list .img {
		width: 120rpx;
		height: 120rpx;
		border-radius: 6rpx;
	}

	.order-list .desc {
		display: flex;
		flex-direction: column;
		margin-left: 30rpx;
	}

	.order-list .desc .name {
		font-size: 30rpx;
	}

	.teacher_name {
		font-size: 28rpx;
		color: #666;
		margin-top: 20rpx;
	}

	.time_box {
		display: flex;
		flex-direction: row;
		align-items: center;
		height: 60rpx;
		font-size: 28rpx;
	}

	.left {
		flex: 1;
	}

	.left,
	.money {
		color: #666;
	}

	.btn_box {
		display: flex;
		align-items: center;
		flex-direction: row;
		font-size: 26rpx;
		margin: 0 20rpx 20rpx;
	}

	.status {
		color: #fc9023;
		flex: 1;
	}

	.btn {
		height: 50rpx;
		padding: 0 30rpx;
		display: flex;
		align-items: center;
		background: linear-gradient(90deg, #f7ca8f, #db9e55);
		color: #fff;
		border-radius: 25rpx;
		font-size: 26rpx;
		margin-left: 10rpx;
	}
</style>