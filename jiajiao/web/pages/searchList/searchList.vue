<template>
	<view style="padding: 0 20rpx;">
		<block v-if="teacherList.length>0">
			<TeacherList :teacherList="teacherList"></TeacherList>
		</block>
		<view v-else class="" style="width: 100%;text-align: center;margin-top: 50rpx;">
			<text>暂无信息</text>
		</view>
	</view>
</template>

<script>
	import TeacherList from '@/components/teacher_list/teacher_list.vue'
	export default {
		data() {
			return {
				teacherList: [],
				keyword: '',
				page: 1
			}
		},
		components: {
			TeacherList
		},
		onLoad(options) {
			this.keyword = options.searchVal

		},
		onShow() {
			this.page = 1
			this.teacherList = []
			this.getList()
		},
		onReachBottom() {
			this.page = this.page + 1
			this.getList()
		},
		methods: {
			getList() {
				this.api('/index/getTeacherList', 'post', {
					page: this.page,
					longitude: uni.getStorageSync('longitude'),
					latitude: uni.getStorageSync('latitude'),
					keyword: this.keyword
				}).then(res => {
					res.data.forEach(item => {
						item.label = item.label.split(',')
					})
					this.teacherList = this.teacherList.concat(res.data)

				})
			}
		}
	}
</script>

<style>

</style>