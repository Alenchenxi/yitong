<template>
	<view class="container">
		<view class="item" v-for="(item,index) in list" :key="index" v-if="item.type==1">
			<text>{{item.title}}</text>
			<text>{{item.content}}</text>

			<view class="">
				<text>老师姓名：</text>
				<text>{{item.linkman}}</text>
			</view>
			<view class="">
				<text>科目：</text>
				<text>{{item.grade_name}}/{{item.subject_name}}</text>
			</view>
			<view class="">
				<text>电话：</text>
				<text>{{item.mobile}}</text>
			</view>
			<view class="bom" v-if="item.status==0">
				<text style="color: red;" @click="sub(2,index)">拒绝</text>
				<text style="color: blue;" @click="sub(1,index)">确认</text>
			</view>
			<view class="boms" v-if="item.status==1">
				<text style="color: blue;">已确认</text>
			</view>
			<view class="boms" v-if="item.status==2">
				<text style="color: red;">已拒绝</text>
			</view>
		</view>
		<view class="item" v-for="(item,index) in list" :key="index" v-if="item.type==2" style="padding-bottom:20rpx">
			<text>{{item.title}}</text>
			<text>{{item.content}}</text>
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
		onShow() {
			this.getList()
		},
		methods: {
			getList() {
				this.api('/user/getMsgList', 'post').then(res => {
					console.log(res)
					this.list = res.data
				})
			},
			sub(i, index) {

				this.api('/order/msgConfirmOrCancel', 'post', {
					msg_id: this.list[index].msg_id,
					status: i
				}).then(res => {
					if (res.status == 200) {
						this.list[index].status = i
						if (i == 1) {
							uni.showToast({
								title: '已确认',
								icon: "none"
							})
						} else if (i == 2) {
							uni.showToast({
								title: '已拒绝',
								icon: "none"
							})
						}
					} else {
						uni.showToast({
							title: res.msg,
							icon: "none"
						})
					}

				})
			}
		}
	}
</script>

<style lang="less" scoped>
	.container {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		padding: 0 20rpx;

		.item {
			margin-top: 20rpx;
			width: 48%;
			background-color: #fff;
			border-radius: 12rpx;
			padding: 0 20rpx;
			display: flex;
			flex-direction: column;
			align-items: center;

			&>text {
				&:nth-of-type(1) {
					font-size: 30rpx;
					font-weight: bold;
					margin-top: 20rpx;
				}

				&:nth-of-type(2) {
					font-size: 28rpx;
					margin-top: 10rpx;
				}
			}

			.bom {
				width: 100%;
				display: flex;

				text {
					width: 50%;
					text-align: center;
					height: 80rpx;
					line-height: 80rpx;
					display: block;
				}
			}

			.boms {
				width: 100%;
				height: 80rpx;
				line-height: 80rpx;
				text-align: center;
			}
		}
	}
</style>
