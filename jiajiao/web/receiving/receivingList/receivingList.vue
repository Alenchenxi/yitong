<template>
	<view class="student_list">
		<image src="/static/images/hezi.png" style="margin:0 auto" v-if="dataList.length==0"></image>
		<view class="item" v-for="(item,index) in dataList" :key="index" @click="toDetail(item.demand_id)">
			<view class="desc">
				<view class="name">年级：{{item.grade_name}}</view>
			</view>
			<view class="desc">
				<view class="name">科目：{{item.subject_name}}</view>
			</view>
			<view class="desc">
				<view class="name dz" style="width: 100%;">
					地址：{{item.province}}{{item.city}}{{item.area}}{{item.address}}</view>
			</view>
			<view class="btn-box-bottom">
				<!-- <view class="btn_box" v-if="item.status==0">
					<view class="btn-detail" style="width: 50%;" @click.stop="cloneYu(index,item.appointment_id)">取消预约
					</view>
					<view class="btn-detail" style="width: 50%;">预约中</view>
				</view>
				<view class=" btn_box" v-if="item.status==1">
					<view class="btn-detail">待支付</view>
				</view>
				<view class=" btn_box" v-if="item.status==2">
					<view class="btn-detail">已完成</view>
				</view> -->
				<view class=" btn_box" >
					<view class="btn-detail">去联系</view>
				</view>
			</view>
		</view>
	</view>

</template>

<script>
	export default {
		data() {
			return {
				dataList: [],
				btnDel: " 取消接单",
				page: 1,
				isList: true
			}
		},
		onLoad() {
			this.getList2()
			uni.setNavigationBarTitle({
				title: '联系列表'
			})
		},
		onReachBottom() {
			if (this.isList) {
				++this.page
				this.getList2()
			}
		},
		methods: {
			cloneYu(index, id) {
				let that = this
				uni.showModal({
					title: '提示',
					content: '确认取消预约',
					success(res) {
						if (res.confirm) {
							that.api('/user/cancelAppointment', 'post', {
								appointment_id: id
							}).then(res => {
								if (res.status == 200) {
									that.dataList.splice(index, 1)
								}
							})
						}
					}
				})
			},
			getList() {
				this.api('/user/getTeacherAppointmentList', 'post', {
					page: this.page
				}).then(res => {
					if (res.data.length == 0) {
						this.isList = false
					}
					if (this.page == 1) {
						this.dataList = res.data
					} else {
						this.dataList = this.dataList.concat(res.data)
					}

				})
			},
			
			getList2() {
				this.api('/user/getTeacheOrder', 'post', {
					page: this.page
				}).then(res => {
					if (res.data.length == 0) {
						this.isList = false
					}
					if (this.page == 1) {
						this.dataList = res.data
					} else {
						this.dataList = this.dataList.concat(res.data)
					}
			
				})
			},
			delItem() {},
			toDetail(id) {
				uni.navigateTo({
					url: '/receiving/receDetail/receDetail?id=' + id
				})
			}
		}
	}
</script>

<style scoped>
	page {
		background: #f8f8f7;
	}

	.zw {
		height: 30rpx;
	}

	.select_box .picker {
		height: 60rpx;
		font-size: 26rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		border-right: 1px solid #f0f0f0;
		color: #5e5e5e;
	}

	.pickerval {
		width: 410rpx;
	}

	.pickerobj {
		width: 167rpx;
	}

	.select_box .pull_down {
		width: 20rpx;
		height: 10rpx;
		margin: 8rpx 0 0 20rpx;
	}

	.student_list {
		width: 95%;
		margin: 30rpx auto 40rpx;
	}

	.student_list,
	.student_list .item {
		display: flex;
		flex-direction: column;
	}

	.student_list .item {
		background: #fff;
		border-radius: 10rpx;
		margin-bottom: 30rpx;
		box-sizing: border-box;
		width: 100%;
	}

	.student_list .desc {
		padding: 10rpx;
		display: flex;
		align-items: center;
		flex-direction: row;
		width: 100%;
	}

	.student_list .name {
		font-size: 28rpx;
		margin-right: 20rpx;
		width: 500rpx;
		overflow: hidden;
		flex-wrap: wrap;
	}

	.dz {
		margin-bottom: 30rpx;
	}

	.student_list .pice {
		background-color: #f8c400;
		padding: 6rpx 20rpx;
		font-size: 24rpx;
		border-radius: 20rpx;
	}

	.loaclhost {
		display: flex;
		flex-direction: row;
		align-items: center;
	}

	.loaclhost .img {
		width: 28rpx;
		height: 26rpx;
		margin-right: 10rpx;
	}

	.jl {
		font-size: 26rpx;
		color: #ccc;
	}

	.btn_box {
		display: flex;
		justify-content: flex-end;
		height: 80rpx;
		align-items: center;
		flex: 1;
	}

	.btn {
		background: grey;
		color: #fff;
		border-radius: 0 0 0 10rpx;
	}

	.btn,
	.btn-detail {
		height: 80rpx;
		flex: 1;
		font-size: 25rpx;
		text-align: center;
		line-height: 80rpx;
	}

	.btn-detail {
		background: #f1ba46;
		color: #221b15;
		border-radius: 0 0 10rpx 0;
	}

	.btn-box-bottom {
		display: flex;
		flex-direction: row;
	}
</style>