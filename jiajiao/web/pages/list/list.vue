<template>
	<view>
		<view class="my_tab">{{title}}</view>
		<Jhazhangquan :articleList="articleList" v-if="articleList.length>0"></Jhazhangquan>
		<!-- #ifdef MP-BAIDU -->
		<text style="display: block;width: 100%;text-align: center;margin-top: 50rpx;">暂无数据</text>
		<!-- #endif -->
	</view>
</template>

<script>
	import Jhazhangquan from '@/components/jiazhangquan/jiazhangquan.vue'
	export default {
		data() {
			return {
				title: '',
				type: '',
				url: '',
				articleList: []
			}
		},
		components: {
			Jhazhangquan
		},
		onLoad(options) {
			this.title = options.title
			this.type = options.type
			this.url = this.imgUrl
			this.getArticleList(options.type)
		},
		methods: {
			getArticleList(type) {
				this.api('/index/getArticleList', 'post', {
					class_id: type
				}).then(res => {
					console.log(res)
					this.articleList = res.data
				})
			}
		}
	}
</script>

<style scoped>
	.my_tab {
		height: 80rpx;
		background: #fff;
		display: flex;
		align-items: center;
		font-size: 30rpx;
		text-indent: 20rpx;
	}
</style>
