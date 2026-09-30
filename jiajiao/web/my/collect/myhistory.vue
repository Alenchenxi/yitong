<template>
	<view>
		
		<view class="student_list">
			<image src="/static/images/hezi.png" style="margin:0 auto" v-if="initLoaded && dataList.length==0"></image>
			<view class="item" v-for="(item,index) in dataList" :key="item.demand_id"
				@click="toDetail(item.demand_id)">
				<view class="desc">
					<view class="" style="display: flex;align-items: center;">
						<text>编号：</text>
						<text v-if="item.mid.toString().length==1">S000{{item.mid}}</text>
						<text v-else-if="item.mid.toString().length==2">S00{{item.mid}}</text>
						<text v-else-if="item.mid.toString().length==3">S0{{item.mid}}</text>
						<text v-else>S{{item.mid}}</text>
					</view>
					<view class="name">年级：{{item.grade_name}}</view>
					<view class="name name-mar">科目：{{item.subject_name}}</view>
					<view class="name name-mar">地址：{{item.province}}{{item.city}}{{item.area}}{{item.address}}
					</view>
				</view>
				<view class="detail">
					<view class="desc">
						<view class="loaclhost">
							<view class="toClassType" v-if="item.teaching_way==1">上门授课</view>
							<view class="toClassType" v-if="item.teaching_way==2">在线授课</view>
							<view class="toClassType" v-if="item.teaching_way==3">上门授课/在线授课</view>
						</view>
						<view class="loaclhost" style="margin-top: 12rpx;">
							<view class="toClassType" v-if="item.kefu_direct ==0">会员免费</view>
						</view>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
	export default{
		data(){
			return{
				pageNum: 1,
				pageSize: 10,
				hasMore: true,
				initLoaded: false,
				loading: false,
				dataList: []
			}
		},
		onLoad() {
			this.getStudentList()
		},
		methods: {
			getStudentList(){
				if(this.loading || !this.hasMore){
					return
				}
				this.loading = true
				this.api('/demand/getUserDemandHistoryPage', 'post', {
					pageNum: this.pageNum,
					pageSize: this.pageSize
				}).then(res => {
					this.dataList = this.dataList.concat(res.data.list)
					this.hasMore = res.data.hasMore
				}).finally(()=> {
					this.loading = false
					this.initLoaded = true
				})
			},
			toDetail(id) {
				uni.navigateTo({
					url: '/receiving/receDetail/receDetail?id=' + id
				})
			}
		}
	}
</script>

<style scoped lang="less">
	.student_list {
		margin: 24rpx;
		padding-bottom: 88rpx;
		display: flex;
		flex-direction: column;
		.item{
			display: flex;
			flex-direction: row;
			background: #fff;
			border-radius: 6rpx;
			margin-bottom: 30rpx;
			padding: 20rpx;
			box-sizing: border-box;
			width: 100%;
			border-left: 4rpx solid #f8c400;
		}
		.desc {
			padding: 10rpx;
			display: flex;
			align-items: flex-start;
			flex-direction: column;
			flex: 1;
			justify-content: space-between;
		}
		.name {
			font-size: 28rpx;
			margin-right: 20rpx;
			flex-wrap: wrap;
		}
		.pice {
			width: 40rpx;
			height: 40rpx;
		}
		.detail {
			display: flex;
			flex-direction: column;
			justify-content: space-between;
			align-items: flex-end
		}
		.loaclhost {
			display: flex;
			flex-direction: row;
			align-items: center;
			z-index: 5000;
			.img {
				width: 28rpx;
				height: 26rpx;
				margin-right: 10rpx;
			}
		}
		
		.toClassType {
			background-color: #f8c400;
			padding: 6rpx 20rpx;
			font-size: 24rpx;
			border-radius: 20rpx;
		}
	}
</style>