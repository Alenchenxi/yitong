<template>
	<view class="rate_page">
		<view class="message_container">
			<view class="textaretboxcont">
				<textarea maxlength="100" v-model="content" placeholder="请描述一下对教员的教导感受"
					placeholder-style="font-size:26rpx;color:#999999;line-height:50rpx;"></textarea>
			</view>
		</view>
		<view class="submit_butbox">
			<button @click="submit_infofun">提交评价</button>
		</view>
	</view>
</template>

<script>
	export default {
		data() {
			return {
				id: '',
				content: ''
			}
		},
		onLoad(option) {
			this.id = option.id
		},
		methods: {
			submit_infofun() {
				if (!this.content) {
					uni.showToast({
						title: '请输入评价内容',
						icon: "none"
					})
				}
				this.api('/user/addComment', 'post', {
					teacher_id: this.id,
					content: this.content
				}).then(res => {
					if (res.status == 200) {
						uni.showToast({
							title: '评价成功',
							icon: "none"
						})
						setTimeout(() => {
							uni.navigateBack()
						}, 1000)
					}
				})
			}


		}
	}
</script>

<style lang="less">
	.rate_page {
		width: 100%;
		min-height: 100vh;
		padding-bottom: constant(safe-area-inset-bottom);
		padding-bottom: env(safe-area-inset-bottom);
		background-color: #f8f8f8;
		padding-left: 4%;
		padding-right: 4%;
		padding-top: 30rpx;



		.message_container {
			width: 100%;
			padding: 40rpx;
			background-color: #fff;
			border-radius: 20rpx;
			box-shadow: 0 0 10rpx #eeeeee;

			.uploadbox {
				width: 100%;
				display: flex;
				flex-wrap: wrap;
				border-bottom: 2rpx solid #f6f6f6;

				.list_img {
					width: 30%;
					height: 180rpx;
					margin: 11rpx;
					box-sizing: 0 0 10rpx #f6f6f6;

					.uploadimg {
						width: 100%;
						height: 100%;
					}

					image {
						width: 100%;
						height: 100%;
						border-radius: 10rpx;
					}
				}
			}

			.rate_box {
				width: 100%;
				padding: 20rpx;
				border-bottom: 2rpx solid #eee;

				.rf_ratebox {
					width: 100%;

					.list_rate {
						display: flex;
						padding: 14rpx 0;

						.title_text {
							font-size: 30rpx;
							color: #000;
							margin-right: 18rpx;
						}
					}
				}
			}

			.textaretboxcont {
				width: 100%;
				padding: 20rpx;
				border-radius: 6rpx;
				background-color: #f5f5f5;

				textarea {
					width: 100%;
					height: 260rpx;
					font-size: 26rpx;
					color: #333;
					line-height: 50rpx;
				}
			}

		}

		.submit_butbox {
			width: 100%;
			display: flex;
			padding: 60rpx 0 0;

			button {
				width: 92%;
				margin: auto;
				background-color: #f5cb2b;
				color: #fff;
				padding: 4rpx 0;
				font-size: 28rpx;
				border-radius: 40rpx;
			}
		}
	}
</style>
