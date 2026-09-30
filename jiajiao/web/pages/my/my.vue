<template>
	<view class="container">
		<view class="mime_page">
			<image class="ming_bg" src="/static/images/mineBg.png"></image>
			<view class="user_info">
				<view class="ming_bgs">
					<image class="ming_bg" v-if="userInfo.avatar" :src="userInfo.avatar"></image>
					<image class="ming_bg" v-else src="/static/images/logoo.jpg"></image>
				</view>
				<input disabled="true" class="nickname" type="nickname" v-if="userInfo.nickname"
					:value="userInfo.nickname">
				<!-- #ifdef MP-WEIXIN -->
				<input disabled="true" class="nickname" type="nickname" v-else value="微信用户">
				<!-- #endif -->
				<!-- #ifdef MP-TOUTIAO -->
				<input disabled="true" class="nickname" type="nickname" v-else value="抖音用户">
				<!-- #endif -->
				<!-- #ifdef MP-BAIDU -->
				<input disabled="true" class="nickname" type="nickname" v-else value="百度用户">
				<!-- #endif -->
			</view>
			<view class="dj_box" v-if="type==2"></view>
		</view>
		<view class="bg_card">
			<view class="item_tab_box">
				<view class="title">基础设置</view>
				<view class="item_other_box">
					<block v-for="(o,i) in baseMenus" :key="i">
						<view @click="onMenu(o,i)" class="item" v-if="identity==o.identity">
							<image class="icon" :src="o.icon"></image>
							<text class="name">{{o.name}}</text>
						</view>
					</block>
					<view @click="myNewst" class="item">
						<image class="icon" src="/static/images/wdqb.png"></image>
						<text class="name">我的消息</text>
					</view>
					<view class="item" @click="toZhibo">
						<image class="icon" src="/static/images/zhibo.svg"></image>
						<text class="name">直播间</text>
					</view>
					<view @click="login_delete" class="item" v-if="identity==2 && userInfo.teacher_info ">
						<image class="icon" src="/static/images/login_delete.png"></image>
						<text class="name">{{!userInfo.teacher_info.is_hide?'隐藏':'打开'}}简历</text>
					</view>
				</view>
			</view>
			<view class="item_tab_box" style="border-bottom: none;">
				<view class="title">服务</view>
				<view class="item_other_box">
					<view @click="onDemandHistory" class="item">
						<image class="icon" src="/static/images/wdzy.png"></image>
						<text class="name">浏览历史</text>
					</view>
					<view @click="shoucang" class="item">
						<image class="icon" src="/static/images/wdsc.png"></image>
						<text class="name">我的收藏</text>
					</view>
					<view @click="wodehetong" class="item">
						<image class="icon" src="/static/images/wdht.png"></image>
						<text class="name">隐私条约</text>
					</view>

					<view @click="toSeeTip" class="item" v-if="identity==2">
						<image class="icon" src="/static/images/gyxr.png"></image>
						<text class="name">教师注册流程</text>
					</view>
					<!-- #ifdef MP-WEIXIN -->
					<view @click="center_popshow=true" class="item" v-if="identity==2">
						<image class="icon" src="/static/images/xinxi.png"></image>
						<text class="name">简历置顶</text>
					</view>
					<!-- #endif -->
					<!-- #ifdef MP-BAIDU -->
					<view @click="center_popshow=true" class="item" v-if="identity==2&&ios!=='ios'">
						<image class="icon" src="/static/images/xinxi.png"></image>
						<text class="name">简历置顶</text>
					</view>
					<!-- #endif -->
				</view>
				<view class="item_tab_box" style="border-bottom: none;">
					<view class="title">其它</view>
					<view class="item_other_box">
						<view @click="tousujianyi" class="item">
							<image class="icon" src="/static/images/gyts.png"></image>
							<text class="name">意见反馈</text>
						</view>
						<view @click="jiaoshiguanlis" class="item" v-if="identity==2">
							<image class="icon" src="/static/images/tz.png"></image>
							<text class="name">完善简历</text>
						</view>
						<view @click="fanyi" class="item">
							<image class="icon" src="/static/images/lsgzt.png"></image>
							<text class="name">我的资料</text>
						</view>
						<view @click="code_poped=true" class="item" v-if="identity==2">
							<image class="icon" src="/static/images/shangchaun.png"></image>
							<text class="name">上传资料</text>
						</view>
						<view @click="tosc" class="item">
							<image class="icon" src="/static/images/wdsc.png"></image>
							<text class="name">关注公众号</text>
						</view>
						<view @click="toggle" class="item">
							<image class="icon" src="/static/images/qiehuan.png"></image>
							<text class="name" v-if="identity==2">返回首页</text>
							<text class="name" v-if="identity==1">返回首页</text>
						</view>
						<view @click="toggles" class="item">
							<image class="icon" src="/static/images/qiehuan2.png"></image>
							<text class="name">切换身份</text>
						</view>
						<view @click="delUser" class="item delUser">
							<image class="icon" src="/static/images/zhuxiao.png">
							</image>
							<text class="name">注销</text>
						</view>
					</view>
				</view>
			</view>


			<!-- 简历置顶 -->

		</view>
		<u-popup v-model="center_popshow" mode='center' width='88%' border-radius='20'>
			<view class="popup_container">
				<text class="pop_title">选择套餐</text>
				<view :class="active==i?'list_info active_border':'list_info'" v-for="(item,i) in setMeallist"
					@click="choose_active(i)" :key="i">
					<view class="lf_infotext">
						<text class="mst_text">简历置顶 {{item.stick_days}} 天</text>
						<!-- <text class="symble">+</text>
						<text class="big_text">赠{{item.give_days}}天</text> -->
					</view>
					<view class="rf_pricetext">
						<text class="price_sym">￥</text>
						<text class="price_number">{{item.price}}</text>
					</view>
				</view>

				<view class="pay_btnbox">
					<text
						@click="pay_mealfun(setMeallist[active].set_meal_id)">立即支付￥{{setMeallist[active].price}}元</text>
				</view>
			</view>
		</u-popup>
		<u-popup v-model="code_poped" @close="code_poped=false" mode='center' width='88%' border-radius='20'>
			<view class="popup_container">
				<text class="pop_title">选择文件</text>
				<view class="list_info active_border">
					<view class="lf_infotext" style="margin-top: 0;">
						<text class="mst_text" style="margin-top: 0;">文件名称</text>
						<!-- <text class="symble">+</text>
						<text class="big_text">赠{{item.give_days}}天</text> -->
					</view>
					<view class="rf_pricetext">
						<input v-model="fileTitle" type="text" placeholder="请输入文件名称">
					</view>
				</view>
				<view class="list_info active_border">
					<view class="lf_infotext" style="margin-top: 0;">
						<text class="mst_text" style="margin-top: 0;">价钱(元)</text>
						<!-- <text class="symble">+</text>
						<text class="big_text">赠{{item.give_days}}天</text> -->
					</view>
					<view class="rf_pricetext">
						<input v-model="filePrice" type="number" placeholder="请输入价钱(元)">
					</view>
				</view>
				<view class="list_info active_border">
					<view class="lf_infotext" @click="downLoad" style="margin-top: 0;">
						<text class="mst_text" style="margin-top: 0;">{{filename}}</text>
						<!-- <text class="symble">+</text>
						<text class="big_text">赠{{item.give_days}}天</text> -->
					</view>
				</view>
				<view class="pay_btnbox" @click="subDownload">
					<text>确认</text>
				</view>
			</view>
		</u-popup>
		<!-- 公众号二维码 -->
		<u-popup v-model="code_pop" mode="center" @close="code_pop=false" :mask="false">
			<view class="code_imgbox">
				<image style="width: 400rpx;height: 400rpx;" :src="url+gzCode" mode=""></image>
			</view>
		</u-popup>
		<block v-if="identity==1">
			<TabBar :selectIndex="3"></TabBar>
		</block>
		<block v-if="identity==2">
			<TabBar1 :selectIndex="3"></TabBar1>
		</block>
	</view>
</template>

<script>
	export default {
		data() {
			return {
				code_poped: false,
				setMeallist: [],
				active: 0,
				center_popshow: false,
				dengji: "",
				isShowSelIdentity: false,
				//显示选择身份
				type: 1,
				//身份  1是家长  2是老师
				//选择的身份
				typeName: "",
				//大学生  专职老师
				userInfo: {},
				isShouGz: false,
				shenfenArr: [{
					tip1: "找家教",
					tip2: "parent",
					name: "我是家长",
					url: "/static/images/xssf.png",
					isSel: 1,
					id: 1
				}, {
					tip1: "找工作",
					tip2: "Teacher",
					name: "我是老师",
					url: "/static/images/lssf.png",
					isSel: 0,
					id: 2
				}],
				teacherType: [{
					name: "专职老师",
					isSel: 0,
					id: 3
				}, {
					name: "大学生",
					isSel: 0,
					id: 4
				}],
				xieyiList: [{
					id: 1,
					checked: false,
					name: "服务协议"
				}, {
					id: 2,
					checked: false,
					name: "隐私政策"
				}, {
					id: 3,
					checked: false,
					name: "承诺声明书"
				}],
				jiaoshizhucetip: true,
				//老师注册提示弹层
				jsgl: true,
				//教师管理步骤
				syjd: true,
				//生源接单步骤
				jdlbbz: true,
				//接单列表步骤
				gzt: true,
				//工作台
				jssh: true,
				//教师审核
				wdkc: true,
				//我的课程
				dktz: true,
				//打卡通知
				jdxq: true,
				code_pop: false,
				identity: '',
				gzCode: '',
				url: this.imgUrl,
				filename: '点击选择文件',
				fileTitle: '',
				filePrice: '',
				filePathUrl: '',
				ios: '',
				baseMenus: [
					{name: '我的订单', icon: '/static/images/wddd.png', identity: 1, path: '/my/myOrder/myOrder'},
					{name: '我的联系', icon: '/static/images/list.png', identity: 1, path: '/my/lianxi/index'},
					{name: '我的订单', icon: '/static/images/wdxs.png', identity: 2, path: '/my/myStudent/myStudent'},
					{name: '我的简历', icon: '/static/images/wdkc.png', identity: 2, path: '/pages_teacher/register'},
					{name: '我的发布', icon: '/static/images/bwzsIcon.png', identity: 1, path: '/my/myPublish/myPublish'},
					{name: '立即接单', icon: '/static/images/syjd.png', identity: 2, path: '/receiving/receivingOrders/receivingOrders'},
					{name: '联系列表', icon: '/static/images/list.png', identity: 2, path: '/receiving/receivingList/receivingList'},
				]
			}
		},
		onLoad() {
			this.getSetMeal()
			this.ios = uni.getSystemInfoSync().osName
		},
		onShareAppMessage() {
			return {
				title: '献新家教',
				page: '/pages/my/my'
			}
		},
		onShareTimeline() {
			return {
				title: '献新家教',
				page: '/pages/my/my'
			}
		},
		onShow() {
			this.identity = uni.getStorageSync('identity') || 1

			this.getUserInfos()
			this.getGzhCode()
			setTimeout(() => {
				this.getUserInfo()
			}, 100)
		},
		methods: {
			toZhibo() {

				if (!uni.getStorageSync('token')) {
					uni.navigateTo({
						url: '/my/getPhone/getPhone'
					})
					return
				}
				// #ifdef MP-WEIXIN
				uni.navigateTo({
					url: '/division/zhibo/zhibo'
				})
				// #endif
				// #ifdef MP-BAIDU
				uni.showToast({
					title: '暂未开通此功能',
					icon: "none",
				})
				// #endif
				// #ifdef MP-TOUTIAO
				uni.showToast({
					title: '暂未开通此功能',
					icon: "none",
				})
				// #endif
			},
			toggles() {
				if (this.identity == 1) {
					this.identity = 2
					uni.setStorageSync('identity', 2)
				} else {
					this.identity = 1
					uni.setStorageSync('identity', 1)
				}
				uni.switchTab({
					url: '/pages/index/index'
				})
			},
			toggle() {

				this.identity = 1
				uni.setStorageSync('identity', 1)

				uni.switchTab({
					url: '/pages/index/index'
				})
			},
			subDownload() {
				if (!uni.getStorageSync('token')) {
					uni.navigateTo({
						url: '/my/getPhone/getPhone'
					})
					return
				}
				if (!this.fileTitle) {
					uni.showToast({
						title: '请输入文件名称',
						icon: "none",
					})
					return
				}
				if (!this.filePrice) {
					uni.showToast({
						title: '请输入文件价格',
						icon: "none",
					})
					return
				}
				if (!this.filePathUrl) {
					uni.showToast({
						title: '请上传文件',
						icon: "none",
					})
					return
				}
				this.api('/user/uploadFile', 'post', {
					name: this.fileTitle,
					price: this.filePrice,
					file: this.filePathUrl,
				}).then(res => {
					console.log(res)
					if (res.status == 200) {
						this.code_poped = false
						uni.showToast({
							title: res.msg,
							icon: "none",
						})
					} else {
						uni.showToast({
							title: res.msg,
							icon: 'none'
						})
					}
				})
			},
			pay_mealfun(id) {
				if (!uni.getStorageSync('token')) {
					uni.navigateTo({
						url: '/my/getPhone/getPhone'
					})
					return
				}
				let data = {}
				// #ifdef MP-WEIXIN
				data = {
					set_meal_id: id,
					platform_id: 1
				}
				// #endif
				// #ifdef MP-TOUTIAO
				data = {
					set_meal_id: id,
					platform_id: 2
				}
				// #endif
				// #ifdef MP-BAIDU
				data = {
					set_meal_id: id,
					platform_id: 3
				}
				// #endif
				this.api('/order/createTcOrder', 'post', data).then(res => {
					if (res.state != 200) {
						uni.showToast({
							title: res.msg,
							icon: "none"
						})
						return
					}
					// #ifdef MP-WEIXIN
					uni.requestPayment({
						timeStamp: res.data.timeStamp,
						nonceStr: res.data.nonceStr,
						package: res.data.package,
						signType: 'MD5',
						paySign: res.data.paySign,
						success(res2) {
							uni.showToast({
								title: '支付成功',
								icon: 'success',
								duration: 1000
							})
						},
						fail(err) {
							uni.showToast({
								title: '支付失败',
								icon: 'none',
								duration: 1000
							})
						}
					})
					// #endif
					// #ifdef MP-BAIDU
					uni.requestPayment({
						"orderInfo": res.data,
						success(res2) {
							uni.showToast({
								title: '支付成功',
								icon: "none",
								duration: 1000
							})
							setTimeout(() => {
								uni.navigateBack()
							}, 1000)
						},
						fail() {
							uni.showToast({
								title: '支付失败',
								icon: 'none',
								duration: 1000
							})
						}
					})
					// #endif

				})
			},
			downLoad() {
				if (!uni.getStorageSync('token')) {
					uni.navigateTo({
						url: '/my/getPhone/getPhone'
					})
					return
				}
				let that = this
				uni.chooseMessageFile({
					count: 1,
					type: 'file',
					success(res) {
						var size = res.tempFiles[0].size;
						var filename = res.tempFiles[0].name;
						var newfilename = filename + "";
						console.log(newfilename)
						if (newfilename.indexOf(".mp3") == -1 && newfilename.indexOf(".pdf") == -
							1) { //我还限制了文件的大小和具体文件类型
							uni.showToast({
								title: '文件格式必须为pdf或mp3！',
								icon: "none",
								duration: 2000,
								mask: true
							})
						} else {
							uni.showLoading({
								title: '上传中...'
							})
							//that.path = res.tempFiles[0].path //将文件的路径保存在页面的变量上,方便 wx.uploadFile调用
							that.filename = filename //渲染到wxml方便用户知道自己选择了什么文件
							uni.uploadFile({
								url: that.imgUrl + '/Base/upload',
								filePath: res.tempFiles[0].path,
								name: 'file',
								success(res1) {
									uni.hideLoading()
									console.log(res1)
									that.filePathUrl = JSON.parse(res1.data).data
								},
								complete() {
									uni.hideLoading()
								}
							})

						}
					}
				})
			},
			getSetMeal() {
				this.api('/index/getSetMeal', 'post').then(res => {
					this.setMeallist = res.data
				})
			},
			getGzhCode() {
				this.api('/index/getGzhCode').then(res => {
					this.gzCode = res.data.gzh_code
				})
			},
			getUserInfos() {
				this.api('/user/getUserInfo', 'post').then(res => {
					console.log(res)
					uni.setStorageSync('user', res.data)

					this.userInfo = res.data
					if (res.data && res.data.teacher_info && res.data.teacher_info.status == 1) {
						// this.identity = 2
					} else {
						this.identity = uni.getStorageSync('identity') || 1
					}
				})
			},
			getUserInfo() {
				// this.userInfo = uni.getStorageSync('user')
			},
			choose_active(n) {
				this.active = n
			},
			fanyi() {
				if (!uni.getStorageSync('token')) {
					uni.navigateTo({
						url: '/my/getPhone/getPhone'
					})
					return
				}
				uni.navigateTo({
					url: '/my/means/means'
				})
			},
			jiaoshiguanlis() {
				if (!uni.getStorageSync('token')) {
					uni.navigateTo({
						url: '/my/getPhone/getPhone'
					})
					return
				}
				uni.navigateTo({
					url: '/pages_teacher/register?showInfo=' + 2
				})
			},
			myWallet() {
				uni.navigateTo({
					url: '/my/wallet/wallet'
				})
			},
			coupon() {
				uni.navigateTo({
					url: '/my/coupon/coupon'
				})
			},
			wodelaoshi() {
				uni.navigateTo({
					url: '/my/myTeacher/myTeacher'
				})
			},
			shoucang() {
				if (!uni.getStorageSync('token')) {
					uni.navigateTo({
						url: '/my/getPhone/getPhone'
					})
					return
				}
				uni.navigateTo({
					url: '/my/collect/collect'
				})
			},
			toSeeTip() {
				if (!uni.getStorageSync('token')) {
					uni.navigateTo({
						url: '/my/getPhone/getPhone'
					})
					return
				}
				uni.navigateTo({
					url: '/receiving/flowPath/flowPath'
				})
			},
			wodehetong() {
				uni.navigateTo({
					url: '/my/convention/convention'
				})
			},
			tousujianyi() {
				if (!uni.getStorageSync('token')) {
					uni.navigateTo({
						url: '/my/getPhone/getPhone'
					})
					return
				}
				uni.navigateTo({
					url: '/my/idea/idea'
				})
			},

			tosc() {
				this.code_pop = true
			},

			toSetUp() {
				uni.navigateTo({
					url: '/my/setUp/setUp'
				})
			},
			myNewst() {
				if (!uni.getStorageSync('token')) {
					uni.navigateTo({
						url: '/my/getPhone/getPhone'
					})
					return
				}
				uni.navigateTo({
					url: '/my/news/news'
				})
			},
			onMenu(o,i){
				if (!uni.getStorageSync('token')) {
					uni.navigateTo({
						url: '/my/getPhone/getPhone'
					})
					return
				}
				uni.navigateTo({
					url: o.path
				})
			},

			// 隐藏或者打开简历
			login_delete() {
				var conente_info = ''
				if (this.userInfo.is_hide) {
					conente_info = '是否确认隐藏简历？'
				} else {
					conente_info = '是否确认打开简历？'
				}
				let that = this
				uni.showModal({
					title: '提示',
					content: conente_info,
					success(res) {
						if (res.confirm) {
							that.api('/user/hideOrOpenResume', 'post', {

							}).then(res => {
								that.getUserInfos()

								if (res.status == 200) {
									uni.showToast({
										title: res.msg ? res.msg : "简历设置修改成功",
										icon: "none",
										duration: 2000
									})

									setTimeout(() => {
										that.getUserInfo()
									}, 10)


								}
							})
						}
					}
				})


			},


			delUser() {
				let that = this
				uni.showModal({
					title: '提示',
					content: '注销后您的所有信息都将被删除,不可恢复!确认注销?',
					success: function(modalRes) {
						if (modalRes.confirm) {
							that.api('/user/accountCancellation', 'post', {}).then(res => {
								console.log(res)
								if (res.status == 200) {
									uni.showToast({
										title: '注销成功',
										icon: "none"
									})
									uni.clearStorageSync('token')
									uni.clearStorageSync('user')
									uni.clearStorageSync('identity')
									uni.clearStorageSync('isShowTip')
									that.userInfo.nickname = ''
									uni.switchTab({
										url: '/pages/index/index'
									})
								}
							})
						}
					}
				})
			},
			/**
			 * 打开浏览历史
			 */
			onDemandHistory(){
				uni.navigateTo({
					url: '/my/collect/myhistory'
				})
			}
		}
	}
</script>

<style scoped lang="less">
	.container {
		width: 100%;
		min-height: 100vh;
		padding-bottom: calc(110rpx + env(safe-area-inset-bottom));
	}

	.delUser {

		.exit {
			width: 100%;
			height: 100%;
			position: absolute;
			top: 0;
			left: 0;
		}
	}

	.popup_container {
		width: 100%;
		padding: 30rpx;

		.pop_title {
			font-size: 30rpx;
			color: #000;
			display: block;
			padding: 10rpx 0 20rpx;
			font-weight: 600;
		}

		.active_border {
			border: 1rpx solid rgba(156, 81, 15, 1) !important;
			box-shadow: 0 0 5rpx rgba(156, 81, 15, 1)
		}

		.list_info {
			width: 100%;
			margin-top: 20rpx;
			display: flex;
			align-items: center;
			justify-content: space-between;
			background-color: #F5E5D8;
			padding: 20rpx 30rpx;
			border-radius: 18rpx;
			border: 1rpx solid rgba(156, 81, 15, 0.3);

			.lf_infotext {
				width: 70%;
				display: flex;
				align-items: center;

				.mst_text {
					font-size: 28rpx;
					color: #555555;
					// margin: auto 0;
					margin-top: 25rpx;
				}

				.symble {
					color: #A5510F;
					font-size: 32rpx;
					margin: 20rpx 15rpx 0;
					font-weight: 600;
				}

				.big_text {
					color: #A5510F;
					font-size: 32rpx;
					margin-top: 20rpx;
					font-weight: 600;
				}
			}

			.rf_pricetext {
				margin: auto 0;

				.price_sym {
					font-size: 24rpx;
					color: #EB5750;
					margin-right: 8rpx;
					font-weight: 600;
				}

				.price_number {
					font-size: 54rpx;
					color: #EB5750;
					font-weight: 500;
				}
			}
		}

		.pay_btnbox {
			width: 100%;

			text {
				width: 100%;
				display: block;
				margin-top: 50rpx;
				text-align: center;
				border-radius: 40rpx;
				padding: 20rpx 0;
				font-size: 32rpx;
				font-weight: 600;
				color: #A5510F;
				background-image: linear-gradient(to right, #FBDEB2, #EFB762);
			}
		}
	}

	.selProper {
		background-size: 100% 100%;
		position: fixed;
		top: 0;
		left: 0;
		height: 100%;
		width: 100%;
		overflow: auto;
		z-index: 1000;
		background-color: #fff;
	}

	.conten_box {
		flex-direction: column;
		width: 100%;
	}

	.box,
	.conten_box {
		display: flex;
		align-items: center;
	}

	.box {
		height: 300rpx;
		width: 90%;
		background: #dbdbdb;
		border-radius: 8rpx;
		margin-top: 50rpx;
		flex-direction: row;
		border-radius: 50rpx;
	}

	.image {
		height: 260rpx;
		width: 200rpx;
		border-radius: 50%;
		margin-bottom: 30rpx;
	}

	.detail_box {
		flex: 1;
		margin-left: 30rpx;
	}

	.tip1 {
		font-size: 38rpx;
		margin-bottom: 10rpx;
	}

	.bg1 {
		background: linear-gradient(90deg, #f1b833, #eca33d);
	}

	.bg2 {
		background: linear-gradient(90deg, #4086da, #4cdadb);
	}

	.color1 {
		color: #41210c;
	}

	.color2 {
		color: #fff;
	}

	.tip2 {
		font-size: 58rpx;
		margin-bottom: 10rpx;
	}

	.type {
		font-size: 28rpx;
		display: flex;
		flex-direction: row;
		align-items: center;
	}

	.radio {
		width: 50rpx;
		height: 50rpx;
		margin-right: 20rpx;
	}

	.teacher_type {
		height: 80rpx;
		background: #fff;
		display: flex;
		align-items: center;
		justify-content: space-around;
		width: 80%;
		border-radius: 6rpx;
	}

	.teacher_type_box {
		height: 80rpx;
		width: 100%;
	}

	.phone,
	.teacher_type_box {
		display: flex;
		justify-content: center;
	}

	.phone {
		height: 90rpx;
		width: 80%;
		align-items: center;
		font-size: 35rpx;
		border-radius: 10rpx;
		margin: 40rpx auto 0;
		background: #fec400;
		color: #41210c;
		letter-spacing: 10rpx;
	}

	.xieyi_box {
		margin-top: 40rpx;
	}

	.xieyi_box view {
		font-size: 30rpx;
		margin-bottom: 20rpx;
		display: flex;
		flex-direction: row;
		margin-left: 60rpx;
	}

	.checkbox {
		transform: scale(.8, .8);
	}

	page {
		background: #f8f8f7;
	}

	.mime_page,
	.mime_page .ming_bg {
		width: 100%;
		height: 300rpx;
	}

	.ming_bgs {
		width: 100rpx;
		height: 100rpx;
		position: relative;
		margin-right: 25rpx;
	}

	.ming_bgs button {
		width: 100rpx;
		height: 100rpx;
		position: absolute;
		top: 0;
		left: 0;
		background-color: transparent;
	}

	.ming_bgs button::after {
		display: none;
	}

	.mime_page .ming_bg {
		position: relative;
	}

	.mime_page .user_info {
		position: absolute;
		left: 40rpx;
		top: 40rpx;
		display: flex;
		align-items: center;
	}

	.mime_page .dj_box {
		position: absolute;
		right: 50rpx;
		top: 40rpx;
		display: flex;
		flex-direction: column;
	}

	.mime_page .dj_box .dj,
	.mime_page .dj_box .pjgz {
		font-size: 28rpx;
		color: #fff;
	}

	.mime_page .dj_box .pjgz {
		padding: 5rpx 10rpx;
		border: 1rpx solid #f0f0f0;
		margin-top: 20rpx;
		border-radius: 5rpx;
		text-align: center;
	}

	.mime_page .user_info .ming_bg {
		height: 100rpx;
		width: 100rpx;
		border-radius: 50%;
		position: absolute;
		top: 0;
		left: 0;
	}

	.mime_page .user_info .nickname {
		font-size: 30rpx;
		color: #fff;
	}

	.bg_card {
		padding-top: 30rpx;
		width: 90%;
		background: #fff;
		border-radius: 15rpx;
		margin-left: 5%;
		transform: translateY(-80rpx);
	}

	.bg_card .item_tab_box {
		width: 100%;
		display: flex;
		flex-direction: column;
		border-bottom: 6rpx solid #f0f0f0;
	}



	.bg_card .item_tab_box .item_box {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-around;
	}

	.bg_card .item_tab_box .item_other_box {
		display: flex;
		flex-direction: row;
		align-items: center;
		flex-wrap: wrap;
	}

	.bg_card .item_other_box .item {
		width: 168rpx;
		justify-content: center;
		position: relative;
	}

	.bg_card .item_other_box .item navigator {
		width: 100%;
		height: 142rpx;
		position: absolute;
		top: 0;
		left: 0;
	}

	.bg_card .item_box .item,
	.bg_card .item_other_box .item {
		display: flex;
		flex-direction: column;
		align-items: center;
		// width: 100%;
	}

	.bg_card .item .icon {
		height: 40rpx;
		width: 40rpx;
		margin: 20rpx 0;
	}

	.bg_card .item .name {
		font-size: 24rpx;
		margin-bottom: 30rpx;
	}

	.item_tab_box .title {
		font-size: 28rpx;
		font-weight: 600;
		text-indent: 20rpx;
	}

	.tjjl {
		border-radius: 45rpx;
		background: linear-gradient(90deg, #eca33d, #f1b833);
	}

	.delBtn,
	.tjjl {
		height: 90rpx;
		width: 80%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 34rpx;
		margin: 20rpx auto;
		letter-spacing: 20rpx;
	}

	.delBtn {
		border-radius: 20rpx;
		background: #838383;
		color: #fff;
	}

	.xieyi_box {
		margin-top: 40rpx;
	}

	.xieyi_box view {
		font-size: 30rpx;
		margin-bottom: 20rpx;
		display: flex;
		align-items: center;
	}

	.checkbox {
		transform: scale(.8, .8);
	}

	.modal_content {
		position: absolute;
		top: 500rpx;
		left: 100rpx;
		height: 660rpx;
		width: 500rpx;
	}

	.jt {
		width: 100%;
		height: 100%;
	}

	.wdkcBtn {
		height: 500rpx;
		width: 500rpx;
		position: absolute;
		top: 20rpx;
		left: 20rpx;
		z-index: 3000;
	}

	.modal_content_jdlb {
		top: 321rpx;
		left: 100rpx;
	}

	.modal_content_gzt,
	.modal_content_jdlb {
		position: absolute;
		height: 660rpx;
		width: 500rpx;
	}

	.modal_content_gzt {
		top: 500rpx;
		left: 120rpx;
	}

	.modal_content_jdxq {
		top: 441rpx;
		left: 106rpx;
	}

	.modal_content_dktz,
	.modal_content_jdxq {
		position: absolute;
		height: 660rpx;
		width: 500rpx;
	}

	.modal_content_dktz {
		top: 500rpx;
		left: 20rpx;
	}

	.modal_content_syjd {
		position: absolute;
		top: 330rpx;
		left: 28rpx;
		height: 660rpx;
		width: 500rpx;
	}

	.icon7 {
		width: 100rpx;
		height: 100rpx;
		position: fixed;
		bottom: 100rpx;
		right: 30rpx;
		padding: 0;
		margin: 0;
		background-color: hsla(0, 0%, 100%, 0);
		z-index: 1000;
	}

	.icon7::after {
		border: none;
	}

	.icon7 image,
	.teacher_modal {
		width: 100%;
		height: 100%;
	}

	.teacher_modal {
		position: fixed;
		background: rgba(0, 0, 0, .5);
		z-index: 10000;
		top: 0;
		left: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}

	.ewm {
		width: 400rpx;
		height: 400rpx;
	}

	.zw {
		margin-top: 40rpx;
	}

	.ewmWord {
		width: 400rpx;
		color: #fff;
		font-size: 30rpx;
		text-align: center;
		margin-top: 20rpx;
	}
</style>