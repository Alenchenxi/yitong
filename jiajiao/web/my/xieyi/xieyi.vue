<template>
	<view class="content-box">
		<view class="title">《{{title}}》</view>
		<view class="content">
			<rich-text :nodes="agreement"></rich-text>
		</view>
	</view>

</template>

<script>
	export default {
		data() {
			return {
				title: '',
				type: '',
				agreement: ''
			}
		},
		onLoad(options) {
			this.type = options.type
			this.getAgreement()
		},
		methods: {
			getAgreement() {
				this.api('/index/getAgreement', 'post').then(res => {
					console.log(res)
					switch (this.type) {
						case '1':
							this.title = '用户协议'
							this.agreement = res.data.user_agreement
							break;
						case '2':
							this.title = '免责声明'
							this.agreement = res.data.disclaimer
							break;
						case '3':
							this.title = '隐私保护'
							this.agreement = res.data.privacy_agreement
							break;
					}
				})
			}
		}
	}
</script>

<style scoped>
	.title {
		font-size: 30rpx !important;
		font-weight: 700;
		text-align: center !important;
		margin: 30rpx 0;
	}

	.content {
		font-size: 26rpx;
		padding: 0 10rpx;
	}

	.content view {
		margin-bottom: 10rpx;
	}
</style>