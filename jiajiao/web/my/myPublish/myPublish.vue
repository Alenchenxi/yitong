<template>
	<view class="student_list">
		<view @click="toDetail(item.demand_id)" class="item" v-for="(item,index) in stuDemandList" :key="index">
			<view class="desc">
				<view class="name">科目：{{item.subject_name}}</view>
			</view>
			<view class="desc">
				<view class="name">地址：{{item.province}}{{item.city}}{{item.area}}{{item.address}}</view>
			</view>
			<view class="desc">
				<view class="name">年级：{{item.grade_name}}</view>
			</view>
			<view class="desc">
				<view class="name">创建时间：{{item.create_time}}</view>
			</view>
			<view class="btn_box">
				<view class="tiem" v-if="item.status==0">审核中</view>
				<view class="tiem" v-if="item.status==1">匹配中</view>
				<view @click.stop="delItem(item.demand_id)" class="btn btn1" v-if="(item.status==0)||(item.status==1)">
					取消订单</view>
				<view @click.stop="changeItem(item.demand_id)" class="btn btn2"
					v-if="(item.status==0)||(item.status==1)">修改
				</view>
				<view @click.stop="seeTeacher(item.demand_id)" class="btn btn2" v-if="item.status==1">接单老师</view>
			</view>
		</view>
		<view @click="showMapFun(stuDemandList[0])" class="btn_submit" v-if="stuDemandList.length>0">发布其他岗位</view>
		<view class="zw"></view>
	</view>

</template>

<script>
	export default {
		data() {
			return {
				dataList: [],
				isMine: 1,
				stuDemandList: [],
				page: 1,
				isList: true
			}
		},
		onShow() {
			this.getStuDemandList()
		},
		onReachBottom() {
			if (this.isList) {
				++this.page
				this.getStuDemandList()
			}
		},
		methods: {
			showMapFun(item) {
				var item = encodeURIComponent(JSON.stringify(item))
				uni.navigateTo({
					url: '/division/divisions/divisions?item=' + item
				})
			},
			seeTeacher(id) {
				uni.navigateTo({
					url: '/my/myTeacher/myTeacher?id=' + id
				})
			},
			getStuDemandList() {
				this.api('/user/getStuDemandList', 'post', {
					page: this.page
				}).then(res => {
					console.log(res)
					if (res.data.length < 10) {
						this.isList = false
					}
					if (this.page == 1) {
						this.stuDemandList = res.data
					} else {
						this.stuDemandList = this.stuDemandList.concat(res.data)
					}
				})
			},
			delItem(id) {
				let that = this
				uni.showModal({
					title: '提示',
					content: '确认取消订单',
					success(res) {
						if (res.confirm) {
							that.api('/user/getDelDemand', 'post', {
								demand_id: id
							}).then(res => {
								uni.showToast({
									title: res.msg,
									icon: "none"
								})
							})
						}
					}
				})
			},
			changeItem(id) {
				uni.navigateTo({
					url: '/my/updatePu/updatePu?id=' + id
				})
			},
			toDetail(id) {
				uni.navigateTo({
					url: `/receiving/receDetail/receDetail?id=${id}&mode=owner`
				})
			}
		}
	}
</script>

<style scoped>
	page {
		background: #f8f8f7;
	}

	.student_list {
		width: 95%;
		margin: 40rpx auto;
	}

	.student_list,
	.student_list .item {
		display: flex;
		flex-direction: column;
	}

	.student_list .item {
		background: #fff;
		border-radius: 6rpx;
		margin-bottom: 30rpx;
		padding: 20rpx;
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
		width: 100%;
		overflow: hidden;
		flex-wrap: wrap;
	}

	.statusColor {
		color: red;
	}

	.student_list .pice {
		font-size: 28rpx;
		color: red;
	}

	.btn_box {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		height: 60rpx;
	}

	.tiem {
		color: #fc9023;
		flex: 1;
	}

	.btn,
	.tiem {
		font-size: 25rpx;
	}

	.btn {
		height: 50rpx;
		width: 110rpx;
		border-radius: 8rpx;
		color: #fff;
		text-align: center;
		line-height: 50rpx;
	}

	.btn2 {
		background: #eca33d;
		margin-left: 20rpx;
	}

	.btn1 {
		background: grey;
	}

	.tip {
		display: flex;
		align-items: center;
		justify-content: center;
		text-indent: 20rpx;
		height: 60rpx;
	}

	.status,
	.tip {
		font-size: 28rpx;
		color: red;
	}

	.btn_submit {
		height: 80rpx;
		margin: 20rpx auto;
		background: linear-gradient(90deg, #eca33d, #f1b833);
		color: #41210d;
		letter-spacing: 35rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 30rpx;
		width: 80%;
		border-radius: 10rpx;
		font-weight: 600;
		position: fixed;
		bottom: 20rpx;
		left: 10%;
	}

	.zw {
		height: 90rpx;
		width: 100%;
	}
</style>
