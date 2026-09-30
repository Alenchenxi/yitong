<template>
	<view>
		<view class="order_page">
			<view class="tab_box">
				<view :class="item.active==1?'active':''" class="tab" v-for="(item,index) in tabArr" :key="index">
					{{item.name}}
				</view>
			</view>
		</view>
		<view style="height:110rpx"></view>
		<view v-if="isShow">
			<TeacherList :teacherList="list"></TeacherList>
		</view>
		<!-- 	<view class="jiazhangquan" v-else>
			<view @click="toDetail" class="item_box" v-for="(item,index) in pageArr" :key="index">
				<view class="top">
					<image class="header" :src="item.image"></image>
				</view>
				<view class="bottom">
					<view class="title">{{item.title}}</view>
					<view class="desc">
						<image class="icon" src="/static/images/yjxll.png"></image>
						<view class="num">{{item.see}}</view>
						<image class="icon" src="/static/images/syjdz.png"></image>
						<view class="num">{{item.zan}}</view>
					</view>
				</view>
			</view>
		</view> -->

	</view>
</template>

<script>
	import TeacherList from '@/components/teacher_list/teacher_list.vue'
	export default {
		data() {
			return {
				tabArr: [{
					name: "老师",
					id: "0",
					active: 1
				}],
				teacherList: [],
				pageArr: [{
					image: '/static/images/mineBg.png',
					title: '标题',
					see: '122',
					zan: '22'
				}, {
					image: '/static/images/mineBg.png',
					title: '标题',
					see: '122',
					zan: '22'
				}],
				isShow: true,
				list: [],
				page: 1,
				isList: true
			}
		},
		components: {
			TeacherList
		},
		onShow() {
			this.getMyCollectList()
		},
		onReachBottom() {
			if (this.isList) {
				++this.page
				this.getMyCollectList()
			}
		},
		methods: {
			getMyCollectList() {
				this.api('/user/getMyCollectList', 'post', {
					page: this.page,
					latitude: uni.getStorageSync('latitude'),
					longitude: uni.getStorageSync('longitude')
				}).then(res => {
					console.log(res)
					if (res.data.length <= 0) {
						this.isList = false

					}
					let arr = []
					res.data.forEach((item, index) => {
						console.log(item.label)
						if (item.teacher_id) {
							item.label = item.label.split(',')
							arr.push(item)
						}
					})
					if (this.page == 1) {
						this.list = arr

					} else {
						this.list = this.list.concat(arr)

					}
					this.list.forEach(item => {
						item.min_price = item.teaching_subject[0].price
					})

				})
			},
			// clickTab(eitem) {
			// 	this.tabArr.forEach(item => {
			// 		item.active = 0
			// 	})
			// 	eitem.active = 1
			// 	if (eitem.id == 0) {
			// 		this.isShow = true
			// 	} else {
			// 		this.isShow = false
			// 	}
			// },
			toDetail() {
				uni.navigateTo({
					url: '/pages/essayDetail/essayDetail'
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

	.jiazhangquan .item_box {
		display: flex;
		flex-direction: column;
		background: #fff;
		margin: 0 10rpx 20rpx;
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

	.teacher_item {
		background: #fff;
		display: flex;
		flex-direction: row;
		align-items: center;
		padding: 10rpx 0;
		border-radius: 10rpx;
		margin-bottom: 20rpx;
		border-bottom: 1rpx solid #dbdbdb;
	}

	.teacher_item .left {
		width: 160rpx;
		margin-right: 10rpx;
	}

	.teacher_item .left .teacher_pic {
		height: 160rpx;
		width: 160rpx;
		border-radius: 10rpx;
	}

	.teacher_item .right {
		flex: 1;
	}

	.teacher_item .right .desc_item {
		display: flex;
		flex-direction: row;
		height: 50rpx;
		align-items: center;
	}

	.teacher_item .desc_item .desc_name {
		font-size: 28rpx;
		margin-right: 15rpx;
	}

	.teacher_item .desc_item .xueli {
		font-size: 28rpx;
		color: #fc9023;
		margin-left: 20rpx;
	}

	.teacher_item .desc_item .desc_price {
		color: red;
		font-size: 32rpx;
		display: flex;
		flex: 1;
		justify-content: flex-end;
		margin-right: 20rpx;
	}

	.teacher_item .desc_item .desc_jl {
		color: #999;
		font-size: 30rpx;
		display: flex;
		flex: 1;
		justify-content: flex-end;
		margin-right: 20rpx;
	}

	.teacher_item .flex1 {
		flex: 1;
	}

	.teacher_item .yellowbg {
		background: linear-gradient(90deg, #f1b832, #eca339);
		border-radius: 6rpx;
		padding: 2rpx;
		font-size: 20rpx;
	}

	.teacher_item .teacherName {
		max-width: 190rpx;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		font-size: 32rpx !important;
	}

	.teacher_item .tipName {
		color: #009d8b;
		border: 1rpx solid #009d8b;
		font-size: 20rpx;
		padding: 4rpx;
		border-radius: 6rpx;
		margin-right: 8rpx;
	}
</style>