<template>
	<view class="container">
		<view class="home-page">
			<view class="tab_type">
				<view class="search-box">
					<view @click="toSelAddress" class="left">
						<image class="dwicon" src="/static/images/ui_r3_c4.png"></image>
						<text class="localname">{{address}}</text>
					</view>
					<view class="right" v-if="identity==1">
						<image class="search_icon" src="/static/images/ui_r27_c2.png"></image>
						<input @confirm="search" v-model="searchVal" class="search_input"
							placeholder="请输入教师名称编号或科目"></input>
					</view>
				</view>
			</view>
			<swiper autoplay="true" circular="true" class="swiper" duration="500" indicatorActiveColor="#fff"
				indicatorColor="#000" indicatorDots="true" interval="3000" nextMargin="-1px" previousMargin="-1px">
				<swiper-item class="banner_tap" @click="bannerTap(item.id)" v-for="(item,index) in banner" :key="index">
					<image class="banner" :src="url+item.pic"></image>
				</swiper-item>
			</swiper>
			<view class="" style="width: 100%;height: 80rpx;">
				<u-notice-bar :duration="1500" mode="horizontal" :list="listTitle"></u-notice-bar>
			</view>
			<view class="btn_box btn_box_bg" v-if="identity==1">
				<view class="zhaoBox" @click="toTeacher">
					<image src="/static/images/zhaolaoshi.png" mode=""></image>
					<view class="rightBox">
						<text>找老师</text>
						<text>任意老师随意挑选</text>
					</view>
				</view>

				<view class="img_line"></view>
				<view class="zhaoBox" @click="toTeacherIn">
					<image src="/static/images/laoshiruzhu.png" mode=""></image>
					<view class="rightBox">
						<text>老师入驻</text>
						<text>大量生源,随时随地接单</text>
					</view>
				</view>
			</view>
			<view class="btn_box" v-if="identity==2">
				<view @click="toSelectPage(index)" class="sarch_item" v-for="(item,index) in dataArr2" :key="index">
					<image class="bg_img" :src="item.icon"></image>
					<view class="title">{{item.name}}</view>
				</view>
			</view>
			<view class="jiazhangquan" v-if="identity==2">
				<view class="my_tab">案例分享</view>
				<!-- <template is="jiazhangquan" data="{{listArr:listArr}}"></template> -->
				<Jiazhangquan :articleList="articleList"></Jiazhangquan>
			</view>
			<view class="help_box" v-if="identity==1">
				<view class="top">
					<image class="logo" src="/static/images/logoo.jpg"></image>
					<text class="title">献新选师</text>
				</view>
				<view class="desc_item">
					<view class="item" v-for="(item,index) in selectTeacher" :key="index">
						<image class="icon" :src="item.icon"></image>
						<text class="desc">{{item.desc}}</text>
					</view>
				</view>
				<view @click="toSelectTec" class="helpMeBtn">家长免费入驻</view>
				<!-- <view @click="toSelectTec" class="helpMeBtn">本科生通道</view> -->
			</view>
			<view class="home_list" v-if="identity==1">
				<view class="title">最新老师</view>
				<!-- <template is="teacher_list" data="{{teacherList:teacherList}}"></template> -->
				<TeacherList :teacherList="teacherList"></TeacherList>
			</view>
			<view class="footed_box" v-if="identity==1">
				<image class="chennuo" mode="widthFix" src="/static/images/bigImg.png">
				</image>
			</view>
			<!-- <view class="bottom_logo_box" v-if="identity==1">
				<image class="bottom_logo" src="/static/images/logoo.jpg"></image>
				<text class="word">献新家教</text>
			</view> -->
			<image @click="callFun" class="link_icon" src="/static/images/zx.png"></image>
		</view>
		<!-- 	<view class="sj-ico" v-if="ifshowScIcon">▲</view>
		<view class="shoucang" v-if="ifshowScIcon">
			<view class="sc-content">1、点击 <view class="sc-icon">• ● •</view>
			</view>
			<view class="sc-content">2、添加到我的小程序，使用更便捷</view>
			<view class="sc-btn-box">
				<view @click="ikonw" class="sc-btn">我知道了</view>
			</view>
		</view> -->
		<block v-if="identity==1">
			<TabBar :selectIndex="0"></TabBar>
		</block>
		<block v-if="identity==2">
			<TabBar1 :selectIndex="0"></TabBar1>
		</block>
	</view>

</template>

<script>
	import TeacherList from '@/components/teacher_list/teacher_list.vue'
	import Jiazhangquan from '@/components/jiazhangquan/jiazhangquan.vue'
	const app = getApp()
	export default {
		data() {
			return {
				searchVal: '',
				listTitle: [],
				url: '',
				ifshowScIcon: false,
				title: "",
				type: "",
				pageNum: 1,
				allPages: 1,
				district: "",
				banner: [],
				name: "",
				//搜索的中文

				dataArr2: [{
					icon: "/static/images/xxff.png",
					name: "立即接单",
					id: 777
				}, {
					icon: "/static/images/11.png",
					name: "联系列表",
					id: 888
				}, {
					icon: "/static/images/lsrz.png",
					name: "教师注册",
					id: 999
				}, {
					icon: "/static/images/12.png",
					name: "疑问解答",
					id: 9990
				}],

				selectTeacher: [{
					icon: "/static/images/znxs.png",
					desc: "大数据智能选师"
				}, {
					icon: "/static/images/zjgj.png",
					desc: "专属助教跟进"
				}, {
					icon: "/static/images/mywz.png",
					desc: "选师满意为止"
				}, {
					icon: "/static/images/anzx.png",
					desc: "安全放心"
				}],
				latitude: "",
				longitude: "",
				identity: '',
				address: '',
				teacherList: [],
				mobile: '',
				//案列分享
				articleList: [],
				xcx_title:''
			}
		},
		components: {
			TeacherList,
			Jiazhangquan
		},
		onShareAppMessage() {
			return {
				title: this.xcx_title,
				page: '/pages/index/index'
			}
		},
		onShareTimeline() {
			return {
				title:  this.xcx_title,
				page: '/pages/index/index'
			}
		},
		onLoad(options) {
			this.getMobile()
			this.url = this.imgUrl
			this.getTeacherList()
			this.getServiceInfo()
			//案例
			this.getArticleList()
			console.log(options)
			if (options.scene) {
				if (options.scene.indexOf('teacher_id') != -1) {
					uni.navigateTo({
						url: '/pages/teacherDetail/teacherDetail?id=' + options.scene.split('%3D')[1]
					})
					return
				} else if (options.scene.indexOf('demand_id') != -1) {
					uni.navigateTo({
						url: '/receiving/receDetail/receDetail?id=' + options.scene.split('%3D')[1]
					})
					return
				}
			}

		},
		onShow() {

			this.getHomeInfo()
			this.identity = uni.getStorageSync('identity') || 1
			let that = this
			uni.getSetting({
				success(res) {
					console.log("res: ", res);
					if (res.authSetting['scope.userLocation']) {
						console.log('授权');
						if (!uni.getStorageSync('address')) {
							that.getAuthAddress()
						} else {
							that.address = uni.getStorageSync('address')
						}
					} else {
						console.log('未授权');
						if (uni.getStorageSync('address')) {
							that.address = uni.getStorageSync('address')
						} else {
							that.auth()
						}
					}
				}
			})
			that.getUserInfo()
			that.identity = uni.getStorageSync('identity') || 1

		},
		methods: {
			goTeacher() {
				uni.switchTab({
					url: '/pages/teacher/teacher'
				})
			},
			//老师信息
			getUserInfo() {
				this.api('/user/getUserInfo', 'post').then(res => {
					console.log(res)
					if (!res.data) {
						return
					}
					uni.setStorageSync('user', res.data)
					if (res.data.teacher_info && res.data.teacher_info.status == 1) {
						console.log('sss')
						// this.identity = 2
						// uni.setStorageSync('identity', 2)
					}
				})

			},
			//老师列表
			getTeacherList() {
				this.api('/index/getTeacherList', 'post', {
					page: 1,
					longitude: uni.getStorageSync('longitude'),
					latitude: uni.getStorageSync('latitude')
				}).then(res => {
					if (res.status == 200 && res.data.length > 6) {
						this.teacherList = res.data.slice(0, 6)
					} else {
						this.teacherList = res.data
					}
					console.log(res.data)
					if (this.teacherList) {
						this.teacherList.forEach(item => {
							item.label = item.label ? item.label.split(',') : ''
						})
					}


				})
			},
			//客服
			getServiceInfo() {
				// this.api('/index/getServiceInfo', 'post').then(res => {
				// 	this.mobile = res.data.mobile
				// })
			},
			//授权获取地址
			getAuthAddress() {
				let that = this
				uni.getLocation({
					type: 'wgs84',
					success(res) {
						uni.setStorageSync('latitude', res.latitude)
						uni.setStorageSync('longitude', res.longitude)
						let lat = res.latitude
						let log = res.longitude
						uni.request({
							url: 'https://apis.map.qq.com/ws/geocoder/v1/?location=' +
								lat + ',' +
								log + '&key=GADBZ-GTUEX-KFC4Q-T7HRD-HS7DF-PWF4M',
							method: 'GET',
							success(data1) {
								console.log("data1: ", data1);
								if (!uni.getStorageSync('address')) {
									uni.setStorageSync('address', data1.data.result
										.address_component.district)
								}
								console.log(data1)
								that.address = uni.getStorageSync('address')

							}
						})
					}
				})
			},
			auth() {
				let that = this
				uni.authorize({
					scope: "scope.userLocation",
					success() {
						that.getAuthAddress()
					},
					fail() {
						uni.showToast({
							title: '经纬度获取失败，请允许获取地理位置！',
							icon: "none"
						})
						uni.navigateTo({
							url: '/authAddress/openSetting/openSetting'
						})
					}
				})
			},
			//帮我选师页
			toSelectTec() {
				uni.navigateTo({
					url: '/division/divisions/divisions'
				})
			},
			//轮播图详情页
			bannerTap(id) {

				// #ifdef MP-WEIXIN
				uni.navigateTo({
					url: '/pages/bannerDetail/bannerDetail?id=' + id

				})
				// #endif


			},
			getMobile() {
				this.api('/index/getGzhCode', 'post').then(res => {
					this.mobile = res.data.service_tel
					this.xcx_title = res.data.xcx_title
					uni.setNavigationBarTitle({
						title: res.data.xcx_title
					});
				})
			},
			//打电话
			callFun() {
				let that = this
				uni.makePhoneCall({
					phoneNumber: that.mobile
				})
			},
			//去搜索页
			search() {
				if (!this.searchVal) {
					uni.showToast({
						title: '请输入搜索内容',
						icon: "none",
					})
					return
				}
				uni.navigateTo({
					url: '/pages/searchList/searchList?searchVal=' + this.searchVal
				})
			},
			toSelAddress() {

				let that = this
				uni.chooseLocation({
					success(e) {
						uni.setStorageSync('address', e.name)
						uni.setStorageSync('latitude', e.latitude)
						uni.setStorageSync('longitude', e.longitude)
					}
				})
			},
			//教师身份首页跳转
			toSelectPage(index) {

				switch (index) {
					case 0:
						uni.navigateTo({
							url: '/receiving/receivingOrders/receivingOrders'
						})
						break;
					case 1:
						uni.navigateTo({
							url: '/receiving/receivingList/receivingList'
						})
						break;
					case 2:
						uni.navigateTo({
							url: '/receiving/flowPath/flowPath'
						})
						break;
					case 3:
						uni.navigateTo({
							url: '/receiving/questions/questions'
						})
						break;
				}
			},
			//找老师页
			toTeacher() {
				uni.switchTab({
					url: '/pages/teacher/teacher'
				})
			},
			//教师入驻
			toTeacherIn() {

				// uni.navigateTo({
				// 	url: '/pages/teacherIn/teacherIn'
				// })
				// this.identity = 2
				uni.navigateTo({
					url: '/pages/reginImg/reginImg'
				})
			},
			getHomeInfo() {
				this.listTitle = []
				this.api('/index/getHomeInfo', 'post', ).then(res => {
					console.log(res)
					this.banner = res.data.slide_list
					res.data.notice_list.forEach(item => {
						this.listTitle.push(item.content)
					})
				})
			},
			//案例分享
			getArticleList() {
				this.api('/index/getArticleList', 'post', {
					class_id: 5,
				}).then(res => {
					this.articleList = res.data
				})
			}
		}
	}
</script>

<style scoped lang="less">
	.container {
		width: 100%;
		min-height: 100vh;
		padding-bottom: calc(110rpx + env(safe-area-inset-bottom))
	}

	.teacher_item {
		background: #fff;
		display: flex;
		flex-direction: row;
		align-items: center;
		padding: 10rpx 0;
		border-radius: 10rpx;
		margin-bottom: 20rpx;
		border-bottom: 1rpx solid #dbdbdb;
	}

	.teacher_item .left {
		width: 160rpx;
		margin-right: 10rpx;
	}

	.teacher_item .left .teacher_pic {
		height: 160rpx;
		width: 160rpx;
		border-radius: 10rpx;
	}

	.teacher_item .right {
		flex: 1;
	}

	.teacher_item .right .desc_item {
		display: flex;
		flex-direction: row;
		height: 50rpx;
		align-items: center;
	}

	.teacher_item .desc_item .desc_name {
		font-size: 28rpx;
		margin-right: 15rpx;
	}

	.teacher_item .desc_item .xueli {
		font-size: 28rpx;
		color: #fc9023;
		margin-left: 20rpx;
	}

	.teacher_item .desc_item .desc_price {
		color: red;
		font-size: 32rpx;
		display: flex;
		flex: 1;
		justify-content: flex-end;
		margin-right: 20rpx;
	}

	.teacher_item .desc_item .desc_jl {
		color: #999;
		font-size: 30rpx;
		display: flex;
		flex: 1;
		justify-content: flex-end;
		margin-right: 20rpx;
	}

	.teacher_item .flex1 {
		flex: 1;
	}

	.teacher_item .yellowbg {
		background: linear-gradient(90deg, #f1b832, #eca339);
		border-radius: 6rpx;
		padding: 2rpx;
		font-size: 20rpx;
	}

	.teacher_item .teacherName {
		max-width: 190rpx;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		font-size: 32rpx !important;
	}

	.teacher_item .tipName {
		color: #009d8b;
		border: 1rpx solid #009d8b;
		font-size: 20rpx;
		padding: 4rpx;
		border-radius: 6rpx;
		margin-right: 8rpx;
	}

	.jiazhangquan .item_box {
		display: flex;
		flex-direction: column;
		background: #fff;
		margin: 20rpx 10rpx;
		border-radius: 10rpx;
	}

	.jiazhangquan .top {
		height: 340rpx;
		border-radius: 10rpx;
		background: #fff;
	}

	.jiazhangquan .header {
		height: 340rpx;
		border-radius: 10rpx;
		width: 100%;
	}

	.jiazhangquan .bottom {
		display: flex;
		flex-direction: column;
	}

	.jiazhangquan .bottom .title {
		font-size: 30rpx;
		margin: 20rpx 10rpx 0;
		text-indent: 10rpx;
		color: #414040;
		font-weight: 600;
		width: 640rpx;
	}

	.jiazhangquan .bottom .desc {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: flex-end;
		margin: 15rpx 0;
	}

	.jiazhangquan .desc .icon {
		width: 30rpx;
		height: 25rpx;
	}

	.jiazhangquan .desc .num {
		font-size: 24rpx;
		margin-left: 10rpx;
		margin-right: 20rpx;
	}

	page {
		background: #f8f8f7;
	}

	.home-page .swiper {
		width: 96%;
		background: #fff;
		height: 360rpx;
		margin: 20rpx auto 0;
		border-radius: 20rpx;
		overflow: hidden;
	}

	.home-page .banner_tap,
	.home-page .swiper .banner {
		width: 100%;
		height: 360rpx;
		border-radius: 20rpx;
	}

	.home-page .tab_type {
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
		background: #fff;
		box-shadow: 0rpx 2rpx 8rpx #ccc;
	}

	.home-page .tab_type .search-box {
		background: #fff;
		width: 96%;
		height: 80rpx;
		margin: 0 auto;
		display: flex;
		align-items: center;
		flex-direction: row;
	}

	.home-page .tab_type .search-box .left {
		height: 37rpx;
		width: 300rpx;
		display: flex;
		flex-direction: row;
		justify-content: center;
		align-items: center;
	}

	.home-page .dwicon {
		width: 28rpx;
		height: 26rpx;
		margin-right: 10rpx;
	}

	.home-page .localname {
		font-size: 28rpx;
		color: #000;
		width: 300rpx;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.home-page .tab_type .search-box .right {
		display: flex;
		flex-direction: row;
		justify-content: center;
		align-items: center;
		background: #f0f0f0;
		border-radius: 8rpx;
		width: 400rpx;
	}

	.home-page .search_icon {
		width: 28rpx;
		height: 26rpx;
		margin: 0 20rpx;
	}

	.home-page .search_input {
		font-size: 26rpx;
		width: 90%;
		height: 50rpx;
	}

	.home-page .tab_type .item {
		width: 170rpx;
		height: 160rpx;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		margin: 20rpx 6rpx;
		box-shadow: 1rpx 1rpx 5rpx #666;
		border-radius: 10rpx;
	}

	.home-page .tab_type .item .icon {
		width: 60rpx;
		height: 60rpx;
		margin-bottom: 20rpx;
	}

	.home-page .tab_type .item .name {
		font-size: 28rpx;
	}

	.dingzhiIcon {
		width: 100%;
		height: 200rpx;
	}

	.home-page .btn_box {
		margin: 20rpx auto;
		border-radius: 15rpx;
		display: flex;
		width: 720rpx;
		align-items: center;
		justify-content: space-around;
	}

	.home-page .btn_box .img1 {
		margin: 20rpx;
		width: 300rpx;
		height: 110rpx;
	}

	.img_line {
		width: 1rpx;
		height: 110rpx;
		background-color: #c5c5c5;
	}

	.zhaoBox {
		width: 320rpx;
		height: 110rpx;
		display: flex;
		align-items: center;
	}

	.zhaoBox .rightBox {
		display: flex;
		flex-direction: column;

		text {
			&:nth-of-type(1) {
				font-size: 34rpx;
				font-weight: bold;
				white-space: nowrap;
			}

			&:nth-of-type(2) {
				font-size: 18rpx;
				margin-top: 15rpx;
				white-space: nowrap;
			}
		}
	}

	.zhaoBox image {
		width: 100rpx;
		height: 100rpx;
		// border-radius: 50%;
		margin-right: 20rpx;
	}

	.btn_box_bg {
		background: #fff;
		padding: 10rpx 0;
	}

	.home-page .help_box {
		margin: 30rpx auto;
		width: 720rpx;
		background: #fff;
		border-radius: 15rpx;
	}

	.home-page .btn_box .sarch_item,
	.home-page .help_box {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.home-page .btn_box .sarch_item {
		width: 180rpx;
		margin: 20rpx 0;
	}

	.home-page .sarch_item .bg_img {
		width: 110rpx;
		height: 110rpx;
		margin-top: 10rpx;
	}

	.home-page .sarch_item .title {
		font-size: 26rpx;
		color: #2e2e2e;
		margin-top: 10rpx;
	}

	.home-page .data_box {
		margin: 20rpx 10rpx;
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
		background: #fff;
		border-radius: 15rpx;
		box-shadow: 0rpx 2rpx 8rpx #ccc;
	}

	.home-page .data_box .top .item {
		height: 90rpx;
		border-right: 1px solid #ddd;
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.data_box .top .item .num {
		margin-bottom: 15rpx;
		color: #fc9023;
		font-size: 28rpx;
	}

	.data_box .top .item .title {
		color: #656565;
		font-size: 28rpx;
	}

	.home-page .home_list {
		display: flex;
		flex-direction: column;
		border-radius: 15rpx;
		background: #fff;
		margin: 20rpx 15rpx 30rpx;
	}

	.home-page .home_list .title {
		width: 100%;
		text-align: center;
		font-size: 32rpx;
		font-weight: 600;
		margin: 20rpx 0;
	}

	.helpMeBtn {
		border-radius: 8rpx;
		letter-spacing: 30rpx;
		background: linear-gradient(90deg, #eca33d, #f1b833);
		width: 80%;
		margin-bottom: 40rpx;
		font-size: 34rpx;
		font-weight: bold;
		white-space: nowrap;
	}

	.helpMeBtn,
	.home-page .help_box .top {
		display: flex;
		height: 80rpx;
		align-items: center;
		justify-content: center;
	}

	.home-page .help_box .top {
		width: 90%;
		flex-direction: row;
		border-bottom: 1rpx solid #999;
	}

	.home-page .top .logo {
		height: 60rpx;
		width: 60rpx;
		border-radius: 50%;
		margin-right: 10rpx;
	}

	.home-page .top .title {
		font-size: 35rpx;
	}

	.help_box .desc_item {
		margin: 30rpx 30rpx 10rpx;
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
	}

	.help_box .desc_item .item {
		width: 320rpx;
		display: flex;
		flex-direction: row;
		margin-bottom: 20rpx;
	}

	.help_box .desc_item .icon {
		height: 40rpx;
		width: 40rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-right: 10rpx;
		margin-left: 40rpx;
	}

	.help_box .desc_item .desc {
		font-size: 30rpx;
	}

	.xuribzozhen_box {
		margin: 0 auto 30rpx;
		width: 720rpx;
		background: #fff;
		border-radius: 15rpx;
		display: flex;
		flex-direction: column;
	}

	.xuribzozhen_box_title {
		font-size: 30rpx;
		font-weight: 600;
		margin-bottom: 20rpx;
	}

	.xuribzozhen_box .item,
	.xuribzozhen_box_title {
		display: flex;
		align-items: center;
		text-indent: 30rpx;
	}

	.xuribzozhen_box .item {
		font-size: 26rpx;
		height: 60rpx;
	}

	.xuribzozhen_box .item .icon {
		width: 40rpx;
		height: 40rpx;
		margin: 0 20rpx;
	}

	.bottom_logo_box {
		display: flex;
		justify-content: center;
		margin-bottom: 20rpx;
		align-items: center;
	}

	.bottom_logo {
		width: 60rpx;
		height: 60rpx;
		border-radius: 50%;
		margin-right: 20rpx;
	}

	.bottom_logo_box .word {
		font-size: 30rpx;
		color: #666;
	}

	.chennuo,
	.footed_box {
		width: 100%;
	}

	.link_icon {
		height: 60rpx;
		width: 60rpx;
		position: fixed;
		bottom: 200rpx;
		right: 40rpx;
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
		display: flex;
		flex-direction: row;
		height: 80rpx;
		align-items: center;
		border-bottom: 1rpx solid #f8f8f7;
	}

	.word1 {
		flex: 1;
	}

	.btn,
	.word1 {
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

	.my_tab {
		font-size: 30rpx;
		padding-left: 20rpx;
		background-color: #fff;
		height: 60rpx;
		display: flex;
		align-items: center;
	}

	.sj-ico {
		top: -12rpx;
		right: 150rpx;
		opacity: .8;
	}

	.shoucang,
	.sj-ico {
		position: fixed;
		z-index: 1000;
	}

	.shoucang {
		top: 20rpx;
		right: 20rpx;
		background: rgba(0, 0, 0, .8);
		border-radius: 10rpx;
		padding: 10rpx 20rpx;
	}

	.sc-content {
		color: #fff;
		margin-bottom: 15rpx;
	}

	.sc-content,
	.sc-icon {
		font-size: 28rpx;
		display: flex;
		align-items: center;
	}

	.sc-icon {
		color: #00aa94;
		width: 100rpx;
		height: 50rpx;
		justify-content: center;
		background-color: #fff;
		margin: 0 20rpx;
		border-radius: 10rpx;
	}

	.sc-btn-box {
		width: 100%;
	}

	.sc-btn,
	.sc-btn-box {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.sc-btn {
		width: 130rpx;
		height: 60rpx;
		color: #00aa94;
		font-size: 28rpx;
		background-color: #fff;
		border-radius: 10rpx;
	}
</style>