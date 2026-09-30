<template>
	<view>
		<view class="student_box" v-for="(item,index) in list" :key="index">
			<view class="item">
				<view class="left">学生家长</view>
				<view class="right">{{item.linkman.charAt(0)+'家长'}}</view>
			</view>
			<view class="item">
				<view class="left">年级/科目</view>
				<view class="right">{{item.grade_name}}/{{item.subject_name}}</view>
			</view>
			<view class="item">
				<view class="left" style="white-space: nowrap;margin-right: 30rpx;">上课地址</view>
				<view class="right">{{item.province}}{{item.city}}{{item.area}}{{item.address}}</view>
			</view>
			<view class="item">
				<view class="left">上课时间</view>
				<view class="right">
					<text v-for="(item1,index1) in item.schooltime" :key="index1"
						style="white-space: nowrap;">{{item1.week}}{{item1.start_time}}-{{item1.end_time}}</text>
				</view>
			</view>
			<view class="item">
				<view class="left">上课次数(剩余)</view>
				<view class="right" style="display: flex;align-items: center;flex-direction: row;">
					<text>{{item.remain_hour}}</text>

				</view>
			</view>
			<view class="item">
				<view class="left">消课(次数)</view>
				<view class="right" style="display: flex;width: 50%;flex-direction: row;">
					<input type="number" placeholder="点击输入次数" v-model="item.num" />
					<text style="white-space: nowrap;" @click="orderHours(item)">确认</text>
				</view>
			</view>
		</view>

	</view>
</template>

<script>
	export default {
		data() {
			return {
				list: [],
				page: 1,
				isList: true,

			}
		},
		onLoad() {
			uni.setNavigationBarTitle({
				title: '我的订单'
			})
			this.getList()
		},
		onReachBottom() {
			if (this.isList) {
				++this.page
				this.getList()
			}
		},
		methods: {
			orderHours(item) {
				if (!item.num) {
					uni.showToast({
						title: '请输入次数',
						icon: "none"
					})
					return
				}
				this.api('/order/reduceOrderHours', 'post', {
					order_id: item.order_id,
					num: item.num
				}).then(res => {
					uni.showToast({
						title: res.msg,
						icon: "none"
					})
					console.log(res)
				})
			},

			getList() {
				this.api('/order/getTeaOrderList', 'post', {
					page: this.page
				}).then(res => {
					if (res.status == 200) {
						if (res.data.length == 0) {
							this.isList = false
							return
						}
						res.data.forEach(item => {
							this.$set(item, 'num', '')
						})

						if (this.page == 1) {
							this.list = res.data
						} else {
							this.list = this.list.concat(res.data)
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

<style>
	page {
		background-color: #f6f6f6;
	}
</style>
<style scoped>
	.box {
		width: 40rpx;
		height: 40rpx;
		text-align: center;
		line-height: 40rpx;
	}

	.student_box {
		width: 95%;
		margin: 30rpx auto;
		border-radius: 6rpx;
		background: #fff;
		padding-bottom: 30rpx;


	}

	.top {
		height: 80rpx;
		display: flex;
		align-items: center;
		padding: 0 20rpx;
		box-sizing: border-box;
		flex-direction: row;
	}

	.img {
		height: 60rpx;
		width: 60rpx;
		border-radius: 50%;
		margin-right: 30rpx;
	}

	.item,
	.name {
		font-size: 26rpx;
	}

	.item {
		display: flex;
		flex-direction: row;
		align-items: flex-start;
		padding: 20rpx;
		box-sizing: border-box;
		border-bottom: 1rpx solid #f8f8f7;
	}

	.left {
		flex: 1;
	}

	.right {
		display: flex;
		flex-direction: column;
	}

	.mode {
		color: #ccc;
		text-align: center;
		padding: 15rpx 0;
	}
</style>