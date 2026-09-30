<template>
	<view>
		<view class="list_box" v-for="(item,index) in historyArr" :key="index">
			<view class="time">{{item.createdTime}}</view>
			<view class="money">{{item.status==1?'提现中':'已提现'}}￥{{item.money}}</view>
		</view>
	</view>

</template>

<script>
	export default {
		data() {
			return {
				historyArr: [{
						createdTime: '2022-3-3',
						status: 1,
						money: 10
					},
					{
						createdTime: '2022-3-3',
						status: 2,
						money: 10
					}
				]
			}
		},
		methods: {

		}
	}
</script>

<style scoped>
	.list_box {
		display: flex;
		height: 80rpx;
		align-items: center;
		border-bottom: 1px solid #ccc;
	}

	.time {
		flex: 1;
		padding-left: 20rpx;
	}

	.money,
	.time {
		font-size: 30rpx;
	}

	.money {
		padding-right: 20rpx;
	}
</style>
