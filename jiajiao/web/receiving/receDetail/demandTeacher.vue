<template>
	<view v-if="initLoaded">
		<view class="search_list_box">
			<TeacherList :teacherList="teacherList"></TeacherList>
		</view>
		<view v-if="teacherList" class="no_data">
			没有记录~
		</view>
	</view>
</template>

<script>
	import TeacherList from '@/components/teacher_list/teacher_list.vue'
	export default {
		components: {
			TeacherList
		},
		data(){
			return{
				demand_id: -1,
				pageNum: 1,
				pageSize: 10,
				hasMore: true,
				initLoaded: false,
				loading: false,
				teacherList: []
			}
		},
		onLoad(options) {
			this.demand_id = options.demand_id
			this.getTeacherList()
		},
		onReachBottom() {
			this.pageNum = this.pageNum + 1
			this.getTeacherList()
		},
		methods:{
			getTeacherList(){
				if(this.loading || !this.hasMore){
					return
				}
				this.loading = true
				this.api('/demand/getDemandTeacherViewHistory', 'post', {
					pageNum: this.pageNum,
					pageSize: this.pageSize,
					demand_id: this.demand_id,
					longitude: uni.getStorageSync('longitude'),
					latitude: uni.getStorageSync('latitude')
				}).then(res => {
					res.data.list.forEach(item => {
						if (item.label) {
							item.label = item.label.split(',')
						}
					})
					this.teacherList = this.teacherList.concat(res.data.list)
					this.hasMore = res.data.hasMore
				}).finally(()=> {
					this.loading = false
					this.initLoaded = true
				})
			}
		}
	}
</script>

<style scoped lang="less">
	.no_data{
		text-align: center;
		margin-top: 20%;
	}
	.search_list_box{
		margin: 12rpx;
	}
</style>