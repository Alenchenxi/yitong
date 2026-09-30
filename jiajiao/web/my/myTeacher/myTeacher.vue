<template>
	<view class="">
		<view style="padding: 20rpx;" v-if="teacherList.length>0">
			<TeacherList :teacherList="teacherList"></TeacherList>
		</view>
	</view>
</template>

<script>
	import TeacherList from '@/components/teacher_list/teacher_list.vue'
	export default {
		data() {
			return {
				teacherList: [],
				page: 1
			}
		},
		components: {
			TeacherList
		},
		onLoad(options) {
			this.page = 1
			this.getlist(options.id)
		},
		onReachBottom() {
			++this.page
			this.getlist()
		},
		onShow() {

		},
		methods: {
			getlist(id) {
				this.api('/user/getStuAppointmentList', 'post', {
					page: this.page,
					demand_id: id,
					latitude: uni.getStorageSync('latitude'),
					longitude: uni.getStorageSync('longitude')
				}).then(res => {
					console.log(res)
					if (this.page == 1) {
						this.teacherList = res.data
					} else {
						this.teacherList = this.teacherList(res.data)
					}
					this.teacherList.forEach(item => {
						item.label = item.label.split(',')
					})
				})
			}
		}
	}
</script>

<style scoped>

</style>
