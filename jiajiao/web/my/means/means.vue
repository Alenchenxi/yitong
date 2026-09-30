<template>
	<view>
		<block v-if="listArr.length>0">
			<view class="myhetong" v-for="(item,index) in listArr" :key="index">
				<view class="name">{{item.name}}</view>
				<view @click="toDownload(item.file)" class="btn">查看</view>
			</view>
		</block>
		<view class="" v-else style="width: 100%;text-align: center;margin-top: 50rpx;">
			<text>暂无购买资料</text>
		</view>
	</view>
</template>

<script>
	export default {
		data() {
			return {
				showMark: false,
				listArr: []
			}
		},
		onLoad() {
			this.getList()
		},
		methods: {
			getList() {
				this.api('/user/getMyFileList', 'post').then(res => {
					console.log(res)
					this.listArr = res.data
				})
			},
			toDownload(file) {
				console.log(file)
				if (file.indexOf(".mp3") != -1) {
					uni.navigateTo({
						url: '/pages/donloads/donloads?urls=' + file
					})
				} else {
					let that = this
					uni.showLoading({
						title: '请求中...'
					})
					uni.downloadFile({
						url: that.imgUrl + file, //文件的路径
						success: function(res) {
							var filePath = res.tempFilePath;
							uni.openDocument({
								filePath: filePath,
								showMenu: true,
								success() {
									uni.hideLoading()
								}
							});
						}
					});
				}

			},

		}
	}
</script>

<style scoped>
	.myhetong {
		display: flex;
		flex-direction: row;
		height: 80rpx;
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