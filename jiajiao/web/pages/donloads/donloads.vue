<template>
	<view style="width: 100%;text-align: center;">

		<audio class="" :controls="true" :src="url+urls"></audio>

		<!-- 	<block v-else>
			<web-view :src="url+urls"></web-view>
		</block> -->
	</view>
</template>

<script>
	export default {
		data() {
			return {
				urls: '',
				url: this.imgUrl,
				ismp3: false
			}
		},
		onLoad(options) {
			this.urls = options.urls
		},
		methods: {

		}
	}
</script>

<style>

</style>