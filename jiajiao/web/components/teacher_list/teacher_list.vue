<template>
	<view>
		<view style="background-color: #fff;margin-bottom: 20rpx;height: 210rpx;" @click="toTeacher(item.teacher_id)"
			class="" v-for="(item,index) in teacherList" :key="item.teacher_id">
			<view class="" style="display: flex;align-items: center;">
				<text style="white-space: nowrap;">编号：</text>
				<text style="white-space: nowrap;margin-right: 20rpx;">{{item.teacher_id}}</text>
				<image style="width: 32rpx;height: 32rpx;margin-right: 10rpx;" :key="index" v-for="(item,index) in (item.star_level||0)" src="/static/images/ui_r28_c44.png"></image>
			</view>
			<view class="teacher_item">
				<view class="left">

					<image class="teacher_pic" v-if="item.head_img.indexOf('http')==-1" :src="url+item.head_img">
					</image>
					<image class="teacher_pic" v-else :src="item.head_img"></image>
				</view>
				<view class="right" style="width: calc(100% - 170rpx);">
					<view class="desc_item">
						<view class="desc_name teacherName">{{item.name.split('')[0]+'老师'}}</view>
						<view class="desc_name flex1">
							<text class="yellowbg" v-if="item.teacher_identity==1">大学生</text>
							<text class="yellowbg" v-if="item.teacher_identity==2">专业教员</text>
							<text style="white-space: nowrap;">{{item.age}}岁</text>
							<image class="sex" src="/static/images/man.png" mode="" v-if="item.gender==1"></image>
							<image class="sex" src="/static/images/mw.png" mode="" v-if="item.gender==2"></image>
						</view>

						<view class="desc_name" v-if="item.grade_name">{{item.grade_name}}/{{item.subject_name}}</view>
						<view class="desc_name" v-else>
							{{item.teaching_main_subject.grade_name||''}}/{{item.teaching_main_subject.subject_name||''}}
						</view>
					</view>
					<view class="desc_item">
						<view class="desc_name jiaoling" style="white-space: nowrap;">
							<text>教龄{{item.teaching_age}}年</text>
						</view>
						<text class="school_name"
							style="max-width: 240rpx;display: -webkit-box;overflow: hidden;-webkit-box-orient: vertical;-webkit-line-clamp: 2;">
							{{item.school}}
						</text>
						<view class="desc_price">￥{{item.min_price||0}}/时</view>
					</view>
					<view class="desc_item">
						<view class="tipName" v-if="index1<3" v-for="(item1,index1) in item.label" :key="index1">
							{{item1}}
						</view>
						<view class="desc_jl" v-if="item.distance">{{item.distance&&item.distance.toFixed(2)||0}}KM
						</view>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>


<script>
	export default {
		name: "teacher_list",
		data() {
			return {
				url: this.imgUrl,

			};
		},
		props: ['teacherList', 'num'],
		mounted() {
			console.log(this.teacherList)
		},
		methods: {

			toTeacher(id) {
				uni.navigateTo({
					url: '/pages/teacherDetail/teacherDetail?id=' + id
				})
			}
		},
	}
</script>

<style scoped>
	.teacher_item {
		background: #fff;
		display: flex;
		flex-direction: row;
		align-items: center;
		padding: 10rpx 0;
		border-radius: 10rpx;
		border-bottom: 1rpx solid #dbdbdb;
	}

	.teacher_item .left {
		width: 160rpx;
		height: 160rpx;
		margin-right: 10rpx;
		position: relative;
	}

	.teacher_item .left .teacher_pic {
		height: 160rpx;
		width: 160rpx;
		border-radius: 10rpx;
		position: absolute;
		bottom: 0;
		left: 0;
	}

	.school_name {
		background-color: #6C7DC6;
		color: #fff;
		padding: 3rpx 8rpx;
		border-radius: 3rpx;
		display: block;
		font-size: 22rpx;
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

	.teacher_item .desc_item .jiaoling text {
		display: block;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 140rpx;
	}

	.teacher_item .desc_item .desc_name {
		font-size: 28rpx;
		margin-right: 15rpx;
		display: flex;
		align-items: center;
	}

	.teacher_item .desc_item .desc_name .sex {
		width: 30rpx;
		height: 30rpx;
		margin-left: 10rpx;
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
		white-space: nowrap;
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
		margin-right: 10rpx;
		white-space: nowrap;
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
</style>