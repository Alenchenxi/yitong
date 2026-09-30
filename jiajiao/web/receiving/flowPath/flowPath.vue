<template>
	<view class="tip_list">
		<view class="tip">请认真完善教师认证信息，提高审批通过率，谢谢!</view>
		<view class="list">1、我的-教师信息-认证管理</view>
		<view class="list_content">实名认证，请您按要求上传真实的身份信息。</view>
		<view class="list_content">教师资格证书，请您按要求上传真实的教师资格信息。</view>
		<view class="list_content">学历证书，请您按要求上传真实的学历信息。</view>
		<view class="list-tow">2、我的-教师信息-个人资料</view>
		<view class="list_content">教龄/科目，请您按要求完善教龄、授课年级、科目信息。</view>
		<view class="list_content">个人资料，请您按要求完善个人资料信息。</view>
		<view class="list_content">教学情况，请您按要求完善教学情况信息。</view>
		<view class="list_content">风采展示，请您按要求上传照片。</view>
		<view class="list-tow">3、我的-教师信息-授课设置</view>
		<view class="list_content">授课设置，请您按要求设置的你的授课时间。</view>
		<view @click="toLogin" class="btn">立即注册</view>
		<!-- 	<u-popup v-model="code_pop" mode="center" width="80%" border-radius="16rpx" :mask="true">
			<view class="tipCon">
				<text>{{num}}s</text>
				<rich-text :nodes="detail"></rich-text>
			</view>
		</u-popup> -->
	</view>


</template>

<script>
	export default {
		data() {
			return {
				num: 5,
				detail: '',
				code_pop: false
			}
		},
		onLoad() {
			this.getDeatil()
		},
		onShow() {
			this.code_pop = false
			this.num = 5
		},
		methods: {
			getDeatil() {
				this.api('/index/getAgreement', 'post').then(res => {
					this.detail = res.data.take_order_sm
				})
			},
			toLogin() {
				if (!uni.getStorageSync('token')) {
					uni.navigateTo({
						url: '/my/getPhone/getPhone'
					})
					return
				}
				uni.navigateTo({
					url: '/pages_teacher/register'
				})

			}
		}
	}
</script>

<style scoped>
	.tipCon {
		width: 100%;
		padding: 20rpx;
		padding-bottom: constant(safe-area-inset-bottom); // 底部安全区
		padding-bottom: env(safe-area-inset-bottom); // 底部安全区
	}

	.tipCon>text {
		display: block;
		width: 100%;
		text-align: center;
		font-size: 40rpx;
	}

	.tip {
		color: #fff;
		font-size: 28rpx;
		margin-bottom: 30rpx;
		background-color: red;
		height: 80rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 20rpx;
	}

	.tip_list {
		padding: 20rpx;
		display: flex;
		flex-direction: column;
		font-size: 30rpx;
	}

	.list {
		margin-top: 80rpx;
	}

	.list,
	.list-tow {
		margin-bottom: 10rpx;
		font-weight: 700;
		color: red;
	}

	.list-tow {
		margin-top: 40rpx;
	}

	.list_content {
		margin-top: 20rpx;
		font-size: 28rpx;
		margin-left: 30rpx;
	}

	.btn {
		width: 80%;
		height: 80rpx;
		background: linear-gradient(90deg, #eca33d, #f1b833);
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 40rpx;
		margin: 100rpx auto 50rpx;
		font-size: 34rpx;
		letter-spacing: 10rpx;
	}
</style>