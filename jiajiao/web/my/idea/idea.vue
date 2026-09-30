<template>
	<view>
		<view class="tousujianyi">
			<view class="title">反馈内容</view>
			<textarea class="input" v-model="content" placeholder="请输入意见内容"></textarea>
		</view>
		<view class=" comment_box">
			<view class="title">添加图片</view>
			<view class="img_box">
				<image @click="selectImg" v-if="imageUrl" class="upload" :src="url+imageUrl"></image>
				<view v-else @click="selectImg" class="upload">+</view>
			</view>
		</view>
		<view @click="submit" class="submit">提交</view>

	</view>
</template>

<script>
	export default {
		data() {
			return {
				isShow: true,
				content: "",
				imageUrl: "",
				url: this.imgUrl
			}
		},
		methods: {

			selectImg() {
				let that = this
				uni.chooseImage({
					count: 1,
					success(res) {
						console.log(res)
						uni.uploadFile({
							url: that.imgUrl + '/Base/upload',
							filePath: res.tempFilePaths[0],
							name: 'image',
							success(res1) {
								console.log(res1)
								// #ifdef MP-WEIXIN
								that.imageUrl = JSON.parse(res1.data).data
								// #endif
								// #ifdef MP-BAIDU
									that.imageUrl = res1.data.data
								// #endif
								if (res1.statusCode == 200) {
									uni.showToast({
										title: '上传成功',
										icon: "none"
									})
								} else {
									uni.showToast({
										title: res.msg,
										icon: "none"
									})
								}
							},
							fail(err) {
								uni.showToast({
									title: err.msg,
									icon: "none"
								})
							}
						})
					}
				})
			},
			submit() {
				if (!this.content) {
					uni.showToast({
						title: '请输入意见内容',
						icon: "none"
					})
					return
				}
				this.api('/user/feedback', 'post', {
					content: this.content,
					img: this.imageUrl

				}).then(res => {
					if (res.status == 200) {
						uni.showToast({
							title: '提交成功',
							icon: "none"
						})
						setTimeout(() => {
							uni.navigateBack()
						}, 1000)
					} else {
						uni.showToast({
							title: res.msg,
							icon: 'none'
						})
					}
					console.log(res)
				})

			},
		}
	}
</script>

<style scoped>
	page {
		background: #f8f8f7;
	}

	.input {
		height: 400rpx;
		width: 95%;
		border: 1rpx solid #ccc;
		margin: 30rpx auto;
		border-radius: 6rpx;
		padding: 20rpx;
	}

	.comment_box {
		display: flex;
		flex-direction: column;
	}

	.title {
		font-size: 28rpx;
		margin: 20rpx;
	}

	.img_box {
		display: flex;
		flex-direction: row;
		margin-left: 20rpx;
		margin-bottom: 20rpx;
	}

	.upload {
		height: 160rpx;
		width: 160rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 26rpx;
		border: 1rpx dashed #ccc;
		border-radius: 6rpx;
		margin-right: 20rpx;
	}

	.submit {
		position: fixed;
		width: 80%;
		border-radius: 6rpx;
		height: 80rpx;
		font-size: 28rpx;
		text-align: center;
		line-height: 80rpx;
		color: #fff;
		background: linear-gradient(90deg, #db9e55, #f7ca8f);
		bottom: 100rpx;
		left: 10%;
	}

	.mask {
		position: fixed;
		top: 0;
		left: 0;
		background: rgba(0, 0, 0, .3);
		width: 100%;
		height: 100%;
		z-index: 100;
		align-items: center;
		justify-content: center;
	}

	.content,
	.mask {
		display: flex;
		flex-direction: column;
	}

	.content {
		background: #fff;
		border-radius: 6rpx;
		padding: 40rpx 20rpx;
		width: 80%;
	}

	.item {
		justify-content: center;
	}

	.item,
	.item_btn {
		display: flex;
		flex-direction: row;
		height: 80rpx;
		align-items: center;
		border-bottom: 1rpx solid #f8f8f7;
	}

	.item_btn {
		justify-content: space-around;
	}

	.word {
		flex: 1;
		display: flex;
		justify-content: center;
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
