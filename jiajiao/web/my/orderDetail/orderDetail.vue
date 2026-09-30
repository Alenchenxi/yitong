<template>
	<view class="order_detail">
		<view class="teacher_box" style="align-items: center;">
			<image class="img" :src="url+detail.head_img">
			</image>
			<view class="desc">
				<view class="tip">{{detail.linkman}}老师</view>
				<view @click="callphone(detail.mobile)" class="tip" v-if="(detail.status==1)||(detail.status==2)">
					{{detail.mobile}}
				</view>
			</view>
			<view class="status"></view>
		</view>
		<view class="msg_box">
			<view class="title">
				<view class="line"></view>
				<view class="word">课程信息</view>
			</view>
			<view class="item">
				<view class="name">授课方式</view>
				<view class="left" v-if="detail.teaching_way==1">上门授课</view>
				<view class="left" v-if="detail.teaching_way==2">在线授课</view>
			</view>
			<view class="item">
				<view class="name">上课地点</view>
				<view class="left">
					{{detail.province}}{{detail.city}}{{detail.area}}{{detail.address}}
				</view>
			</view>
			<view class="item" v-for="(item,index) in detail.schooltime" :key="index">
				<view class="name" v-if="index==0">上课时间</view>
				<view class="name" v-else></view>
				<view class="left">{{item.week}} {{item.start_time}}-{{item.end_time}}</view>
			</view>
		</view>
		<view class="msg_box">
			<view class="title">
				<view class="line"></view>
				<view class="word">价格信息</view>
			</view>
			<view class="item">
				<view class="name">课程单价</view>
				<view class="left">￥{{detail.price}}/课时</view>
			</view>
			<view class="item">
				<view class="name">课次课时</view>
				<view class="left">{{detail.hour}}次×2小时</view>
			</view>
			<view class="item">
				<view class="name">总课时数</view>
				<view class="left">{{detail.hour*2}}小时</view>
			</view>
			<view class="small_line"></view>
			<!-- 	<view class="item">
				<view class="name">课程总价</view>
				<view class="left">￥{{detail.amount}}</view>
			</view> -->
			<view class="item">
				<view class="allmoneyColor">实际付款</view>
				<view class="left3">￥{{detail.amount}}</view>
			</view>
		</view>
		<view class="msg_box">
			<view class="title">
				<view class="line"></view>
				<view class="word">订单信息</view>
			</view>
			<view class="item">
				<view class="name">订单类型</view>
				<view class="left" v-if="detail.teaching_way==1">上门</view>
				<view class="left" v-if="detail.teaching_way==2">在线</view>
			</view>
			<view class="item">
				<view class="name">订单编号</view>
				<view class="left">{{detail.sn}}</view>
			</view>
			<view class="item">
				<view class="name">订单时间</view>
				<view class="left">{{detail.create_time}}</view>
			</view>
		</view>
		<view class="botton_btn_zw"></view>

		<view class=" botton_btn" v-if="detail.status==0">
			<view @clcik="payMoney" class="btn">立即支付</view>
		</view>
		<view class="botton_btn" v-if="detail.status==1">
			<view class="btn">已支付</view>
		</view>
		<view class="botton_btn" v-if="detail.status==2">
			<view class="btn">已完成</view>
		</view>
	</view>

</template>

<script>
	export default {
		data() {
			return {

				detail: {},
				url: this.imgUrl
			}
		},
		onLoad(options) {
			this.detail = JSON.parse(decodeURIComponent(options.item))
		},
		methods: {
			callphone(phone) {
				uni.makePhoneCall({
					phoneNumber: phone
				})
			}
		}
	}
</script>

<style scoped>
	.order_detail {
		padding: 0 20rpx;
	}

	.teacher_box {
		display: flex;
		flex-direction: row;
		margin-top: 20rpx;
		border-bottom: 1rpx solid #f0f0f0;
		padding-bottom: 20rpx;
	}

	.teacher_box .img {
		height: 120rpx;
		width: 120rpx;
		border-radius: 8rpx;
	}

	.teacher_box .desc {
		display: flex;
		flex-direction: column;
		margin-left: 30rpx;
		flex: 1;
	}

	.teacher_box .desc .name {
		font-size: 30rpx;
	}

	.teacher_box .desc .tip {
		font-size: 28rpx;
		color: #666;
	}

	.status {
		font-size: 28rpx;
		color: #fc9023;
		display: flex;
		align-items: center;
		flex-direction: row;
	}

	.msg_box {
		display: flex;
		flex-direction: column;
		border-bottom: 1rpx solid #f0f0f0;
		padding-bottom: 30rpx;
	}

	.small_line {
		width: 100%;
		border: 1rpx solid #f0f0f0;
		margin-top: 10rpx;
	}

	.msg_box .title {
		height: 60rpx;
		font-size: 28rpx;
		display: flex;
		align-items: center;
	}

	.line {
		height: 35rpx;
		width: 8rpx;
		background: #fc9023;
		margin-right: 8rpx;
		border-radius: 2rpx;
	}

	.word {
		font-size: 28rpx;
	}

	.msg_box .item {
		display: flex;
		align-items: center;
		margin-top: 5rpx;
		padding: 10rpx 0;
	}

	.msg_box .item .name {
		font-size: 28rpx;
		color: #666;
		margin-right: 30rpx;
	}

	.left2,
	.msg_box .item .left {
		font-size: 28rpx;
		flex: 1;
		display: flex;
		justify-content: flex-end;
	}

	.left2 {
		color: #666;
	}

	.allmoneyColor {
		margin-right: 30rpx;
	}

	.allmoneyColor,
	.left3 {
		font-size: 28rpx;
		color: #fc9023;
	}

	.left3 {
		flex: 1;
	}

	.botton_btn,
	.left3 {
		display: flex;
		justify-content: flex-end;
	}

	.botton_btn {
		position: fixed;
		bottom: 0;
		left: 0;
		height: 80rpx;
		align-items: center;
		background: #fff;
		z-index: 100;
		width: 100%;
		border-top: 1rpx solid #ccc;
	}

	.botton_btn .btn {
		font-size: 26rpx;
		height: 50rpx;
		padding: 0 20rpx;
		border-radius: 25rpx;
		color: #fff;
		background: linear-gradient(90deg, #f7ca8f, #db9e55);
		margin-right: 30rpx;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.botton_btn_zw {
		height: 120rpx;
		width: 100%;
		background: #f8f8f7;
	}

	.colorWord {
		font-size: 28rpx;
		margin-right: 20rpx;
		color: #fc9023;
	}
</style>