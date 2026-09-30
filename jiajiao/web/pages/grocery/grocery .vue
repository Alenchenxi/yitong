<template>
	<view class="container">

		<view class="zahuodian">
			<swiper autoplay="true" circular="true" class="swiper" duration="500" indicatorActiveColor="#fff"
				indicatorColor="#000" indicatorDots="true" interval="3000" nextMargin="0px" previousMargin="0px">
				<swiper-item @click="bannerTap(item.detail)" v-for="(item,index) in banner" :key="index">
					<image class="banner" :src="url+item.pic"></image>
				</swiper-item>
			</swiper>
		</view>
		<view class="tab_box" v-if="identity==1">
			<view class="title">服务</view>
			<view class="item_tab_box">
				<view @click="toList('家庭教育',1)" class="item_box">
					<image class="img" src="/static/images/jtjy.png"></image>
					<text class="word">家庭教育</text>
				</view>
				<view @click="toList('学习方法',2)" class="item_box">
					<image class="img" src="/static/images/xxff.png"></image>
					<text class="word">学习方法</text>
				</view>
				<view @click="toList('教学资讯',3)" class="item_box">
					<image class="img" src="/static/images/jxzx.png"></image>
					<text class="word">教育资讯</text>
				</view>
				<view @click="donload(1,1)" class="item_box">
					<image class="img" src="/static/images/zlxz.png"></image>
					<text class="word">试卷下载</text>
				</view>
			</view>
		</view>
		<view class="tab_box" v-if="identity==2">
			<view class="title">服务</view>
			<view class="item_tab_box">
				<view @click="toList('家庭教育',1)" class="item_box">
					<image class="img" src="/static/images/jtjy.png"></image>
					<text class="word">家庭教育</text>
				</view>
				<view @click="donload(1,2)" class="item_box">
					<image class="img" src="/static/images/zjxz.png"></image>
					<text class="word">试卷下载</text>
				</view>
				<view @click="toList('教学方法',4)" class="item_box">
					<image class="img" src="/static/images/jxff.png"></image>
					<text class="word">教学方法</text>
				</view>
				<view @click="donload(2,2)" class="item_box">
					<image class="img" src="/static/images/alfx.png"></image>
					<text class="word">教案下载</text>
				</view>
			</view>
		</view>
		<block v-if="identity==1">
			<TabBar :selectIndex="2"></TabBar>
		</block>
		<block v-if="identity==2">
			<TabBar1 :selectIndex="2"></TabBar1>
		</block>
	</view>
</template>

<script>
	export default {
		data() {
			return {
				url: this.imgUrl,
				banner: [],
				type: 1,
				identity: ''
			}
		},
		onLoad() {
			this.getHomeInfo()
		},
		onShow() {
			this.identity = uni.getStorageSync('identity') || 1
			if (uni.getStorageSync('user') && uni.getStorageSync('user').teacher_info && uni.getStorageSync('user')
				.teacher_info.status == 1) {
				this.type = 2
			} else {
				this.type = uni.getStorageSync('identity') || 1
			}
		},
		onShareAppMessage() {
			return {
				title: '献新家教',
				page: '/pages/grocery/grocery'
			}
		},
		onShareTimeline() {
			return {
				title: '献新家教',
				page: '/pages/grocery/grocery'
			}
		},
		methods: {
			//轮播图详情页
			bannerTap(detail) {
				// #ifdef MP-WEIXIN
				uni.navigateTo({
					url: '/pages/bannerDetail/bannerDetail?detail=' + detail

				})
				// #endif
			},

			getHomeInfo() {
				this.api('/index/getHomeInfo', 'post', ).then(res => {
					console.log(res)
					this.banner = res.data.slide_list
				})
			},
			toList(title, type) {
				uni.navigateTo({
					url: '/pages/list/list?title=' + title + '&type=' + type
				})
			},
			donload(type, type1) {
				uni.navigateTo({
					url: '/pages/donload/donload?type=' + type + '&user_type=' + type1
				})
			}
		}
	}
</script>

<style scoped>
	.container {
		width: 100%;
		min-height: 100vh;
		padding-bottom: calc(110rpx + env(safe-area-inset-bottom));
		overflow: hidden;
	}

	page {
		background: #f8f8f7;
	}

	.zahuodian {
		border-radius: 20rpx;
	}

	.zahuodian .swiper {
		width: 96%;
		background: #fff;
		height: 360rpx;
		margin: 20rpx auto 0;
		border-radius: 20rpx;
	}

	.zahuodian .banner_tap,
	.zahuodian .swiper .banner {
		width: 100%;
		height: 360rpx;
		border-radius: 20rpx;
	}

	.tab_box {
		display: flex;
		flex-direction: column;
		background: #fff;
		width: 96%;
		border-radius: 8rpx;
		margin: 20rpx auto 0;
	}

	.tab_box .title {
		font-size: 30rpx;
		height: 80rpx;
		font-weight: 600;
		display: flex;
		align-items: center;
		border-bottom: 1rpx solid #f0f0f0;
		width: 95%;
		margin: 0 auto;
	}

	.tab_box .item_tab_box {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-around;
	}

	.tab_box .item_box {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.tab_box .item_box .img {
		height: 100rpx;
		width: 100rpx;
		margin-top: 20rpx;
	}

	.tab_box .item_box .word {
		font-size: 26rpx;
		margin-top: 20rpx;
		margin-bottom: 20rpx;
	}
</style>