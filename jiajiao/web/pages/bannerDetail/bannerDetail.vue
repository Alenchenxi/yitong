<template>
	<view class="container">
		<rich-text :nodes="detail"></rich-text>
		<block v-if="type==1">
			<view class="unuItem" style="border-radius: 16rpx 16rpx 0 0;margin-top: 50rpx;">
				<view class="unuItems">
					<text>姓名</text>
					<input v-model="leanName" type="text" placeholder="请输入姓名" placeholder-class="unuIpt">
				</view>
			</view>
			<view class="unuItem">
				<view class="unuItems">
					<text>电话</text>
					<input type="number" v-model="phone" maxlength="11" placeholder="请输入电话" placeholder-class="unuIpt">
				</view>

			</view>

			<view class="unuItemd">
				<text>分类</text>
				<view class="unu">
					<picker mode="selector" :range="typearr1" @change="handChange1" range-key="name">
						<view>{{typeIndex1==-1?'请选择分类':typearr1[typeIndex1].name}}</view>
					</picker>
					<image src="/static/images/link-icon.png" mode=""></image>
				</view>

			</view>
			<view class="unuItemd">
				<text>年级</text>
				<view class="unu" @click="tabFun1">
					<picker :disabled="typeIndex1==-1" mode="selector" :range="typearr2" @change="handChange2"
						range-key="name">
						<view>{{typeIndex2==-1?'请选择年级':typearr2[typeIndex2].name}}</view>
					</picker>
					<image src="/static/images/link-icon.png" mode=""></image>
				</view>

			</view>
			<view class="unuItemd" style="border-radius: 0 0 16rpx 16rpx ;">
				<text>科目</text>
				<view class="unu" @click="tabFun2">
					<picker :disabled="typeIndex2==-1" mode="selector" :range="typearr3" @change="handChange3"
						range-key="name">
						<view>{{typeIndex3==-1?'请选择科目':typearr3[typeIndex3].name}}</view>
					</picker>
					<image src="/static/images/link-icon.png" mode=""></image>
				</view>

			</view>
			<view class="unuSub" @click="unuSub">
				<text>提交</text>
			</view>
		</block>
	</view>
</template>

<script>
	export default {
		data() {
			return {
				detail: '',
				leanName: '',
				phone: '',
				typearr1: [],
				typearr2: [],
				typearr3: [],
				typeIndex1: -1,
				typeIndex2: -1,
				typeIndex3: -1,
				type: '',
				id: ''
			}
		},
		onLoad(options) {
			this.id = options.id
			this.getCategoryList()
		},
		onShow() {
			this.getDetail()
		},
		methods: {
			getDetail() {
				this.api('/index/getBannerInfo', 'post', {
					id: this.id
				}).then(res => {
					this.detail = res.data.detail
					this.type = res.data.type
				})
			},
			getCategoryList() {
				this.api('/index/getCategoryList', 'post').then(res => {
					this.typearr1 = res.data
				})
			},
			tabFun1() {
				if (this.typeIndex1 == -1) {
					uni.showToast({
						title: '请选择分类',
						icon: "none"
					})
				}
			},
			tabFun2() {
				if (this.typeIndex2 == -1) {
					uni.showToast({
						title: '请选择年级',
						icon: "none"
					})
				}
			},
			unuSub() {
				if (!this.leanName) {
					uni.showToast({
						title: '请输入姓名',
						icon: "none"
					})
					return
				}
				if (!this.phone) {
					uni.showToast({
						title: '请输入电话',
						icon: "none"
					})
					return
				}
				if (this.typeIndex1 == -1) {
					uni.showToast({
						title: '请选择分类',
						icon: "none"
					})
					return
				}
				if (this.typeIndex2 == -1) {
					uni.showToast({
						title: '请选择年级',
						icon: "none"
					})
					return
				}
				if (this.typeIndex3 == -1) {
					uni.showToast({
						title: '请选择科目',
						icon: "none"
					})
					return
				}
				this.api('/index/collectUserInfo', 'post', {
					name: this.leanName,
					mobile: this.phone,
					category_id: this.typearr1[this.typeIndex1].category_id,
					grade_id: this.typearr2[this.typeIndex2].grade_id,
					subject_id: this.typearr3[this.typeIndex3].subject_id
				}).then(res => {
					if (res.status == 200) {
						uni.showToast({
							title: '提交成功',
							icon: "none",
							duration: 1000
						})
						setTimeout(() => {
							uni.navigateBack()
						}, 1000)
					} else {
						uni.showToast({
							title: res.msg,
							icon: "none"
						})
					}
				})
			},
			handChange1(e) {

				let item = this.typearr1[e.detail.value]
				this.typeIndex1 = e.detail.value
				this.typeIndex2 = -1
				this.typeIndex3 = -1
				this.api('/index/getGradeList', 'post', {
					category_id: item.category_id
				}).then(res => {
					this.typearr2 = res.data
				})
			},
			handChange2(e) {
				let item = this.typearr1[e.detail.value]
				this.typeIndex2 = e.detail.value
				this.typeIndex3 = -1

				this.api('/index/getSubjectList', 'post', {
					grade_id: item.grade_id
				}).then(res => {
					this.typearr3 = res.data
				})
			},
			handChange3(e) {
				let item = this.typeIndex3[e.detail.value]
				this.typeIndex3 = e.detail.value
			}
		}
	}
</script>

<style scoped lang="less">
	.container {
		width: 100%;
		padding: 32rpx;
		padding-bottom: 200rpx;

		.unuSub {
			width: 100%;
			background-color: #fff;
			padding: 0 32rpx;

			position: fixed;
			bottom: 0;
			left: 0;
			padding-bottom: constant(safe-area-inset-bottom); // 底部安全区
			padding-bottom: env(safe-area-inset-bottom); // 底部安全区

			text {
				display: block;
				width: 100%;
				height: 80rpx;
				background-color: #f5cb2b;
				border-radius: 40rpx;
				font-size: 34rpx;
				font-family: PingFang SC-Regular, PingFang SC;
				font-weight: 400;
				color: #FFFFFF;
				text-align: center;
				line-height: 80rpx;
				margin-top: 32rpx;
			}
		}

		.unuItemd {
			width: 100%;
			height: 112rpx;
			background-color: #fff;
			padding: 0 32rpx;
			display: flex;
			align-items: center;
			justify-content: space-between;

			&>text {
				font-size: 34rpx;
				font-family: PingFang SC-Bold, PingFang SC;
				font-weight: bold;
				color: #101010;
				white-space: nowrap;
			}

			.unu {
				width: 468rpx;
				height: 100%;
				display: flex;
				align-items: center;
				padding-left: 54rpx;

				image {
					width: 40rpx;
					height: 40rpx;
				}

				picker {
					width: calc(100% - 60rpx);
					height: 100%;

					view {
						width: 100%;
						height: 100%;
						line-height: 112rpx;
						white-space: nowrap;
						overflow: hidden;
						text-overflow: ellipsis;
					}
				}
			}
		}

		.unuItem {
			width: 100%;
			height: 112rpx;
			background-color: #fff;
			padding: 0 32rpx;

			.unuItemsd {
				width: 100%;
				height: 100%;
				display: flex;
				align-items: flex-start;
				justify-content: space-between;
				background-color: #fff;
				padding: 32rpx 0;

				&>text {
					font-size: 34rpx;
					font-family: PingFang SC-Bold, PingFang SC;
					font-weight: bold;
					color: #101010;
					white-space: nowrap;
				}

				.unuRis {
					width: 468rpx;
					height: 190rpx;
					border-radius: 4rpx;
					border: 2rpx solid #EEEEEE;
					padding: 20rpx;
					position: relative;

					.textarea {
						width: calc(100% - 40rpx);
						height: calc(100% - 40rpx);
						position: absolute;
						top: 20rpx;
						left: 20rpx;
						font-size: 24rpx;
					}

					/deep/.unuArea {
						font-size: 24rpx;
						font-family: PingFang SC-Regular, PingFang SC;
						font-weight: 400;
						color: #979797;
					}

					text {
						font-size: 24rpx;
						font-family: PingFang SC-Regular, PingFang SC;
						font-weight: 400;
						color: #979797;
						position: absolute;
						right: 20rpx;
						bottom: 20rpx;
					}
				}
			}

			.unuItems {
				display: flex;
				align-items: center;
				justify-content: space-between;
				width: 100%;
				height: 100%;
				border-bottom: 2rpx solid #F5F5F5;

				&>text {
					font-size: 34rpx;
					font-family: PingFang SC-Bold, PingFang SC;
					font-weight: bold;
					color: #101010;
					white-space: nowrap;
				}

				input {
					width: 468rpx;
					height: 100%;
					padding-left: 54rpx;
					font-size: 28rpx;
				}


				/deep/.unuIpt {
					font-size: 28rpx;
					font-family: PingFang SC-Regular, PingFang SC;
					font-weight: 400;
					color: #979797;
				}
			}

			&:first-child {
				border-radius: 12rpx 12rpx 0rpx 0rpx;
			}

			&:nth-of-type(5) {
				border-radius: 0rpx 0rpx 12rpx 12rpx;
				height: 254rpx;
			}
		}
	}
</style>
