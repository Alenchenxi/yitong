<template>
	<view class="box">
		<view class="title">
			<image class="img" src="/static/images/ui_r3_c4.png"></image>请选择你所在的区域
		</view>
		<view class="section">
			<picker @change="bindRegionChange" mode="region" :value="region">
				<view class="picker">
					当前选择：{{region[0]}}，{{region[1]}}，{{region[2]}}
				</view>
			</picker>
		</view>
		<view @click="submit" class="btn">确定</view>
	</view>

</template>

<script>
	export default {
		data() {
			return {
				region: ["北京市", "北京市", "东城区"],
			}
		},
		onLoad() {},
		methods: {
			getjingwei() {
				const qqmap = require('@/comm/qqmap-wx-jssdk.min.js');
				const showmap = new qqmap({
					key: 'GADBZ-GTUEX-KFC4Q-T7HRD-HS7DF-PWF4M'
				});
				showmap.geocoder({
					//获取表单传入地址
					address: this.region.join(''), //地址参数，例：固定地址，address: '北京市海淀区彩和坊路海淀西大街74号'
					success: function(res) {
						uni.setStorageSync('longitude', res.result.location.lng)
						uni.setStorageSync('latitude', res.result.location.lat)
					}
				})
			},
			bindRegionChange(e) {
				this.region = e.detail.value
			},
			submit() {
				this.getjingwei()
				uni.setStorageSync('address', this.region[2])
				uni.switchTab({
					url: '/pages/index/index'
				})
			}
		}
	}
</script>

<style scoped>
	.box {
		display: flex;
		flex-direction: column;
	}

	.img {
		width: 30rpx;
		height: 35rpx;
		margin: 0 20rpx;
	}

	.title {
		width: 100%;
		font-size: 30rpx;
		height: 80rpx;
		display: flex;
		flex-direction: row;
		align-items: center;
		border-bottom: 1rpx solid #999;
	}

	.section {
		margin: 20rpx;
	}

	.picker {
		font-size: 32rpx;
	}

	.btn {
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
		top: 300rpx;
		left: 10%;
	}
</style>
