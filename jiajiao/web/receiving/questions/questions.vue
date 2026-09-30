<template>
	<view class="pic-page">
		<view class="search-box">
			<view class="right">
				<input @input="search" class="search_input" placeholder="请填写您要了解的疑问关键词" v-model="cityName"></input>
				<image class="search_icon" src="/static/images/ui_r27_c2.png"></image>
			</view>
		</view>
		<view class="title">热门问题</view>
		<view class="item-box">
			<view :key="index" @click="toCityDatile(item)" class="item" v-for="(item,index) in hotCityArr">
				{{item.title}}
			</view>
		</view>
		<view class="line"></view>
		<view class="city-list">
			<view class="city-left">
				<view :key="item.faq_id" @click="toCityDatile(item)" v-for="(item,index) in list">
					<view style="display: flex;flex-direction: row;align-items: center;">
						<view class="cs">{{item.title}}</view>
						<image class="jt" src="/static/images/link-icon.png"></image>
					</view>
					<view class="zline"></view>
				</view>
			</view>
		</view>
	</view>

</template>

<script>
	export default {
		data() {
			return {
				cityName: "",
				list: [],
				lists: [],
				hotCityArr: [],
			}
		},
		onLoad() {
			this.getFaqList()
			this.getHotFaqList()
		},
		methods: {
			getFaqList(obj = {}) {
				this.api('/index/getFaqList', 'post', {
					faq_id: obj.faq_id || '',
					keywords: obj.keywords || ''
				}).then(res => {
					this.list = res.data
					this.lists = res.data
				})
			},
			getHotFaqList() {
				this.api('/index/getHotFaqList', 'post').then(res => {
					this.hotCityArr = res.data
				})
			},
			toCityDatile(item) {
				uni.navigateTo({
					url: '/receiving/questions/questionsDetail?item=' + encodeURIComponent(JSON.stringify(item))
				})
			},
			search() {
				if (!this.cityName) {
					this.list = this.lists
					return
				}
				this.list = this.lists
				let lists = []
				this.list.forEach((item, index) => {
					if (item.title.indexOf(this.cityName) != -1) {
						lists.push(item)
					}

				})
				this.list = lists


				console.log(this.list)
			}
		}
	}
</script>

<style scoped>
	.search-box .right {
		display: flex;
		flex-direction: row;
		justify-content: center;
		align-items: center;
		border: 2rpx solid #333;
		border-radius: 8rpx;
		width: 90%;
		margin: 32rpx auto;
	}

	.search_icon {
		width: 28rpx;
		height: 26rpx;
		margin: 0 20rpx;
	}

	.search_input {
		font-size: 26rpx;
		width: 90%;
		height: 60rpx;
		padding-left: 20rpx;
	}

	.title {
		margin: 32rpx;
		font-weight: 600;
		font-size: 24rpx;
	}

	.item-box {
		display: flex;
		flex-direction: row;
		padding: 0 32rpx;
		flex-wrap: wrap;
	}

	.item {
		padding: 10rpx 24rpx;
		border-radius: 25rpx;
		background-color: #eee;
		font-size: 24rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 32rpx;
		margin-right: 20rpx;
	}

	.line {
		width: 100%;
		height: 10rpx;
		background-color: #f8f8f8;
	}

	.city-list {
		display: flex;
		flex-direction: row;
	}

	.city-right {
		padding-top: 100rpx;
		width: 50rpx;
	}

	.w {
		width: 100%;
		text-align: center;
		font-size: 20rpx;
	}

	.city-left {
		flex: 1;
		padding: 32rpx;
		box-sizing: border-box;
		font-size: 28rpx;
	}

	.zm {
		margin-bottom: 32rpx;
	}

	.cs {
		margin-top: 20;
	}

	.cs,
	.zline {
		margin-bottom: 20rpx;
		flex: 1;
	}

	.zline {
		height: 2rpx;
		background-color: #ccc;
	}

	.nodeta {
		width: 100%;
		text-align: center;
		font-size: 28rpx;
		margin-top: 50rpx;
	}

	.jt {
		width: 20rpx;
		height: 24rpx;
	}
</style>
