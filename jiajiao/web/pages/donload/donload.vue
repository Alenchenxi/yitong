<template>
	<view>
		<view class="right">
			<image class="search_icon" src="/static/images/ui_r27_c2.png"></image>
			<input @confirm="search" v-model="searchVal" class="search_input" placeholder="请输入关键字"></input>
		</view>
		<view class="myhetong" v-for="(item,index) in listArr" :key="index">
			<view class="name">{{item.name}}</view>
			<view @click="toDownload(item)" class="btn">{{item.price*1>0?'立即购买':'免费获取'}}</view>
		</view>
		<view class="mask" v-if="showMark">
			<view class="content">
				<view class="item">
					<view class="word">成为献新教员免费获取</view>
					<view @click="jiedan" class="btn">立即接单</view>
				</view>
				<view class="item">
					<view class="word">成为献新学员免费获取</view>
					<view @click="shangke" class="btn">立即上课</view>
				</view>
				<view class="item">
					<view class="word">有钱任性</view>
					<view @click="zhifu" class="btn">{{price}}元</view>
				</view>
			</view>
			<view class="line"></view>
			<image @click="gbfun" class="gb" src="/static/images/guanbi.png"></image>
		</view>

	</view>
</template>

<script>
	export default {
		data() {
			return {
				showMark: false,
				listArr: [],
				type: '',
				price: '',
				id: '',
				page: 1,
				searchVal: '',
				user_type: ''
			}
		},
		onLoad(options) {
			this.type = options.type
			this.user_type = options.user_type
			this.getList()
		},
		onShow() {},
		onReachBottom() {
			this.getList()
		},
		methods: {
			search() {
				this.page = 1
				this.listArr = []
				this.getList()
			},
			getList() {
				this.api('/index/getDownloadList', 'post', {
					type: this.type,
					page: this.page,
					keyword: this.searchVal,
					user_type: this.user_type
				}).then(res => {
					this.page = this.page + 1
					console.log(res)
					this.listArr = this.listArr.concat(res.data)
				})
			},
			zhifu() {
				this.api('/order/createFileDownloadOrder', 'post', {
					file_download_id: this.id
				}).then(res => {
					console.log(res)
					if (res.status == 404) {
						uni.showToast({
							title: res.msg,
							icon: "none"
						})
						return
					}
					let that = this

					// #ifdef MP-WEIXIN
					that.api('/order/wxPayFileDownloadOrder', 'post', {
						file_download_order_id: res.data
					}).then(res1 => {
						console.log(res1)
						if (res1.status == '201') {
							uni.showToast({
								title: '支付成功',
								icon: 'success',
								duration: 1000
							})
							setTimeout(function() {
								uni.navigateBack()
							}, 1000);
							return
						}
						uni.requestPayment({
							timeStamp: res1.data.timeStamp,
							nonceStr: res1.data.nonceStr,
							package: res1.data.package,
							signType: 'MD5',
							paySign: res1.data.paySign,
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
								console.log(err)
								if (err.errMsg.indexOf('cancel') != -1) {
									uni.showToast({
										title: '取消支付',
										icon: 'none',
										duration: 1000
									})
								} else {
									uni.showToast({
										title: '支付失败',
										icon: 'none',
										duration: 1000
									})
								}

							}
						})
					})
					// #endif
					// #ifdef MP-BAIDU
					that.api('/order/baiDuPayFileDownloadOrder', 'post', {
						file_download_order_id: res.data
					}).then(res1 => {
						console.log(res1)
						if (res1.status == '201') {
							uni.showToast({
								title: '支付成功',
								icon: 'success',
								duration: 1000
							})
							setTimeout(function() {
								uni.navigateBack()
							}, 1000);
							return
						}
						uni.requestPayment({
							"orderInfo": res1.data,
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
								console.log(err)
								if (err.errMsg.indexOf('cancel') != -1) {
									uni.showToast({
										title: '取消支付',
										icon: 'none',
										duration: 1000
									})
								} else {
									uni.showToast({
										title: '支付失败',
										icon: 'none',
										duration: 1000
									})
								}

							}
						})
					})
					// #endif

				})
			},
			toDownload(item) {
				if (!uni.getStorageSync('token')) {
					uni.navigateTo({
						url: '/my/getPhone/getPhone'
					})
					return
				}
				if (this.user_type == 1) {
					this.api('/user/getStuDemandList', 'post', {
						page: this.page
					}).then(res => {
						console.log("res: ", res);
						if (res.data.length <= 0) {
							uni.showModal({
								title: '提示',
								content: '请家长入驻后再点击免费获取',
								success(res) {
									if (res.confirm) {
										uni.navigateTo({
											url: '/division/divisions/divisions'
										})
									}
								}
							})
							return false
						} else {
							this.price = item.price
							this.id = item.file_download_id
							this.zhifu()
						}
					})
				} else if (this.user_type == 2) {
					if (uni.getStorageSync('user').teacher_info && uni.getStorageSync('user').teacher_info.status == 1) {
						this.price = item.price
						this.id = item.file_download_id
						this.zhifu()
					} else {
						uni.showModal({
							title: '提示',
							content: '请注册老师通过后再点击免费获取',
							success(res) {
								if (res.confirm) {
									uni.navigateTo({
										url: '/pages_teacher/register'
									})
								}
							}
						})
					}
				}

			},
			jiedan() {
				uni.navigateTo({
					url: '/receiving/receivingOrders/receivingOrders'
				})
			},
			shangke() {

				uni.switchTab({
					url: '/pages/teacher/teacher'
				})
			},
			gbfun() {
				this.showMark = false
			}
		}
	}
</script>

<style scoped>
	.search_input {
		font-size: 26rpx;
		width: 90%;
		height: 50rpx;
	}

	.search_icon {
		width: 28rpx;
		height: 26rpx;
		margin: 0 20rpx;
	}

	.right {
		display: flex;
		flex-direction: row;
		justify-content: center;
		align-items: center;
		background: #f0f0f0;
		border-radius: 8rpx;
		width: 100%;
	}

	.myhetong {
		display: flex;
		flex-direction: row;
		/* height: 80rpx; */
		margin: 20rpx 0;
		align-items: center;
		width: 100%;
		padding: 0 30rpx;
		box-sizing: border-box;
		border-bottom: 1rpx solid #f8f8f7;
	}

	.name {
		font-size: 28rpx;
		flex: 1;
	}

	.btn {
		justify-items: center;
	}

	.btn,
	.mask {
		display: flex;
		align-items: center;
	}

	.mask {
		position: fixed;
		top: 0;
		left: 0;
		background: rgba(0, 0, 0, .3);
		width: 100%;
		height: 100%;
		z-index: 100;
		justify-content: center;
	}

	.content,
	.mask {
		flex-direction: column;
	}

	.content {
		background: #fff;
		border-radius: 6rpx;
		display: flex;
		padding: 40rpx 20rpx;
		width: 80%;
	}

	.item {
		display: flex;
		flex-direction: row;
		height: 80rpx;
		align-items: center;
		border-bottom: 1rpx solid #f8f8f7;
	}

	.word {
		flex: 1;
	}

	.btn,
	.word {
		font-size: 26rpx;
	}

	.btn {
		background-image: linear-gradient(90deg, #db9e55, #f7ca8f);
		border-radius: 4rpx;
		padding: 5rpx 20rpx;
		color: #fff;
	}

	.line {
		width: 1rpx;
		height: 30rpx;
		background: #f8f8f7;
	}

	.gb {
		width: 40rpx;
		height: 40rpx;
	}
</style>