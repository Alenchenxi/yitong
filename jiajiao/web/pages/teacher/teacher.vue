<template>
	<view class="container">
		<view class="sel-box" style="z-index: 999;">
			<view v-if="hideAdvance" style="margin-top: 16rpx;">
				<u-search placeholder="请输入教师名称编号或科目" v-model="searchKeyword" :clearabled="true" action-text="筛选" @search="onKeywordSearch" @clear="onKeywordClear"
				@custom="onShowAdvance"
				></u-search>
			</view>
			<view v-if="!hideAdvance" class="top_select_box" style="z-index: 999;">
				<view class="item" style="z-index: 999;">
					<picker @change="changeprovinceObj" :range="province_list" rangeKey="name">
						<view class="picker pickerval" style="font-size: 30rpx;">
							<text style="font-size: 30rpx;">{{provinceName==''?'省':provinceName}}</text>
							<image class="pull_down" src="/static/images/pull-down.png"></image>
						</view>
					</picker>
				</view>
				<view class="item" style="z-index: 999;">
					<picker @change="changecityObj" :range="cityList" rangeKey="name">
						<view class="picker pickerval" style="font-size: 30rpx;">
							<text style="font-size: 30rpx;">{{cityName==''?'市':cityName}}</text>
							<image class="pull_down" src="/static/images/pull-down.png"></image>
						</view>
					</picker>
				</view>
				<view class="item" @click="bindLev3s" style="z-index: 999;">
					<picker @change="bindLev3" class="kmPicker-item" :range="subjectList" range-key="name">
						<view class="picker pickerval">
							<text class="kmName" style="font-size: 30rpx;">{{kmLevel3name||'科目'}}</text>
							<image class="pull_down" src="/static/images/pull-down.png"></image>
						</view>
					</picker>
				</view>

				<view class="item" style="z-index: 999;">
					<picker @change="changeSex" :range="sex" :value="sexVal">
						<view class="picker" style="font-size: 30rpx;">
							<text style="font-size: 30rpx;">{{sex[sexVal]}}</text>
							<image class="pull_down" src="/static/images/pull-down.png"></image>
						</view>
					</picker>
				</view>
				<view class="item" style="z-index: 999;">
					<picker @change="changeType" :range="type" :value="typeVal">
						<view class="picker">
							<text style="font-size: 30rpx;">{{type[typeVal]}}</text>
							<image class="pull_down" src="/static/images/pull-down.png"></image>
						</view>
					</picker>
				</view>
			</view>
		</view>
		<image @click="zxBtn" class="link_icon" src="/static/images/zx.png"></image>


		<view class="search_list_box">
			<TeacherList :teacherList="teacherList"></TeacherList>
		</view>
		<block v-if="identity==1">
			<TabBar :selectIndex="1"></TabBar>
		</block>
		<block v-if="identity==2">
			<TabBar1 :selectIndex="1"></TabBar1>
		</block>
	</view>
</template>

<script>
	import TeacherList from '@/components/teacher_list/teacher_list.vue'

	export default {
		data() {
			return {
				cityarray: [],
				kemuarray: [],
				nianji: ["年级", "小学", "一年级", "二年级", "三年级", "四年级", "五年级", "六年级", "初一", "初二", "初三", "高一", "高二", "高三", "艺术",
					"语言"
				],

				// cityName: "",
				kemuVal: 0,

				nianjiVal: 0,
				isShowModal: false,

				//总页码数
				kmLevel1: [],
				kmLevel2: [],
				kmLevel3: [],


				categoryList: [{
					name: '分类'
				}],
				kmLevel1name: "",
				gradeList: [{
					name: '年级'
				}],
				kmLevel2name: "",
				subjectList: [{
					name: '科目'
				}],
				kmLevel3name: "",
				sex: ['性别', "男", "女"],
				type: ['类型', " 大学生教员", "专职教员", '不限'],
				sexVal: 0,
				typeVal: 0,
				teacherList: [],
				category_id: '',
				grade_id: '',
				subject_id: '',
				gender: '',
				teacher_identity: '',
				city: '',
				area: '',
				page: 1,
				isList: true,
				mobile: '',
				identity: '',
				province_list: [{
					name: '省'
				}],
				provinceName: '',
				cityList: [{
					name: '市'
				}],
				cityName: '',
				areaList: [{
					name: '区'
				}],
				areaName: '',
				searchKeyword: '', //搜索关键字
				hideAdvance: true
			}
		},
		components: {
			TeacherList
		},
		onLoad() {
			this.getTeacherList()
			this.getCategoryList()
			this.getMobile()
			this.getSubjectNames()
			this.getHotCityAndProvinceList()

		},
		onShareAppMessage() {
			return {
				title: '献新家教',
				page: '/pages/teacher/teacher'
			}
		},
		onShareTimeline() {
			return {
				title: '献新家教',
				page: '/pages/teacher/teacher'
			}
		},
		onShow() {
			this.identity = uni.getStorageSync('identity') || 1
		},
		onReachBottom() {

			this.getTeacherList()
		},

		methods: {
			onShowAdvance(){
				this.hideAdvance = false
			},
			onKeywordSearch(){
				this.page = 1
				this.teacherList = []
				this.getTeacherList()
			},
			onKeywordClear(){
				this.searchKeyword = ''
				this.page = 1
				this.teacherList = []
				this.getTeacherList()
			},
			changeprovinceObj(e) {
				this.cityName = ''
				this.areaName = ''
				let item = this.province_list[e.detail.value]
				this.provinces = (item.name == '省') ? '' : item.name
				this.citys = ''
				this.areas = ''
				this.provinceName = (item.name == '省') ? '' : item.name
				this.cityList = [{
					name: '市'
				}]
				this.page = 1
				this.teacherList = []
				this.getTeacherList()
				this.api('/index/getCityList', 'post', {
					province_id: item.id
				}).then(res => {
					if (res.status == 200) {
						this.cityList = this.cityList.concat(res.data)
					}
				})
			},
			changecityObj(e) {
				this.areaName = ''
				this.areas = ''
				let item = this.cityList[e.detail.value]
				this.citys = (item.name == '市') ? '' : item.name
				this.cityName = (item.name == '市') ? '' : item.name
				this.areaList = [{
					name: '区'
				}]
				this.page = 1
				this.teacherList = []
				this.getTeacherList()
				this.api('/index/getAreaList', 'post', {
					city_id: item.id
				}).then(res => {
					if (res.status == 200) {
						this.areaList = this.areaList.concat(res.data)

					}
				})
			},
			changeareaObj(e) {
				let item = this.areaList[e.detail.value]
				this.areaName = (item.name == '区') ? '' : item.name
				this.areas = (item.name == '区') ? '' : item.name
				this.page = 1
				this.teacherList = []
				this.getTeacherList()
			},
			getHotCityAndProvinceList() {
				this.api('/index/getHotCityAndProvinceList', 'post').then(res => {
					console.log(res)
					if (res.status == 200) {

						this.province_list = this.province_list.concat(res.data.province_list)
					} else {
						uni.showToast({
							title: res.msg,
							icon: "none"
						})
					}
				})
			},
			getSubjectNames() {
				this.api('/index/getSubjectNames', 'post').then(res => {
					console.log(res)
					this.subjectList = res.data
					this.subjectList.unshift({
						name: '科目'
					})
				})
			},
			//老师列表
			getTeacherList() {

				this.api('/index/getTeacherList', 'post', {
					page: this.page,
					limit: 10,
					// category_id: this.category_id,
					// grade_id: this.grade_id,
					// subject_id: this.subject_id,
					subject_name: this.kmLevel3name,
					gender: this.gender,
					teacher_identity: this.teacher_identity,
					city: this.cityName,
					area: this.areaName,
					province: this.provinceName,
					longitude: uni.getStorageSync('longitude'),
					latitude: uni.getStorageSync('latitude'),
					keyword: this.searchKeyword
				}).then(res => {

					console.log(res)
					this.page = this.page + 1
					res.data.forEach(item => {
						if (item.label) {
							item.label = item.label.split(',')
						}
					})
					this.teacherList = this.teacherList.concat(res.data)

				})
			},
			getCategoryList() {
				this.api('/index/getCategoryList', 'post').then(res => {
					this.categoryList = this.categoryList.concat(res.data)
				})
			},
			getMobile() {
				this.api('/index/getGzhCode', 'post').then(res => {
					this.mobile = res.data.service_tel
				})
			},
			//分类选择
			bindLev1(e) {
				let item = this.categoryList[e.detail.value]
				this.kmLevel1name = item.name
				this.category_id = item.category_id || ''
				this.grade_id = ''
				this.subject_id = ''
				this.kmLevel2name = ''
				this.kmLevel3name = ''
				this.getTeacherList()
				this.gradeList = [{
					name: '年级'
				}]
				this.api('/index/getGradeList', 'post', {
					category_id: item.category_id
				}).then(res => {
					this.gradeList = this.gradeList.concat(res.data)
				})
			},
			bindLev2s() {
				if (!this.kmLevel1name) {
					uni.showToast({
						title: '请先选择分类',
						icon: "none"
					})
					return
				}
			},
			//年级选择
			bindLev2(e) {
				let item = this.gradeList[e.detail.value]
				this.kmLevel2name = item.name
				this.grade_id = item.grade_id || ''
				this.subject_id = ''
				this.kmLevel3name = ''
				this.subjectList = [{
					name: '科目'
				}]
				this.getTeacherList()
				this.api('/index/getSubjectList', 'post', {
					grade_id: item.grade_id
				}).then(res => {
					this.subjectList = this.subjectList.concat(res.data)
				})
			},
			bindLev3s() {
				// if (!this.kmLevel2name) {
				// 	uni.showToast({
				// 		title: '请先选择年级',
				// 		icon: "none"
				// 	})
				// 	return
				// }
			},
			//科目选择
			bindLev3(e) {

				let item = this.subjectList[e.detail.value]
				this.kmLevel3name = item.name == '科目' ? '' : item.name
				// this.subject_id = item.subject_id || ''
				this.page = 1
				this.teacherList = []
				this.getTeacherList()
			},
			changeSex(e) {
				this.sexVal = e.detail.value
				this.gender = e.detail.value
				this.page = 1
				this.teacherList = []
				this.getTeacherList()
			},
			changeType(e) {
				this.teacher_identity = e.detail.value
				this.page = 1
				this.teacherList = []
				this.getTeacherList()
				this.typeVal = e.detail.value
			},
			zxBtn() {
				let that = this
				uni.makePhoneCall({
					phoneNumber: that.mobile
				})
			}
		}
	}
</script>

<style scoped>
	.container {
		width: 100%;
		min-height: 100vh;
		padding-bottom: calc(110rpx + env(safe-area-inset-bottom))
	}




	.pickerval text {
		display: block;
		white-space: nowrap;
		text-overflow: ellipsis;
		overflow: hidden;
		max-width: 120rpx;
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

	page {
		background: #f8f8f7;
	}

	.sel-box {
		width: 750rpx;
		overflow-x: scroll;
		position: fixed;
		top: 0;
		left: 0;
	}

	.sel-box::-webkit-scrollbar {
		display: none;
	}

	.top_select_box {
		width: 100%;
		height: 80rpx;
		background: #fff;
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-direction: row;

	}

	.top_select_box .item {
		width: 20% !important;
		display: flex;
		justify-content: center;
	}

	/deep/.top_select_box .item picker {
		width: 100%;
	}

	.top_select_box .picker {
		height: 60rpx;
		font-size: 26rpx;
		display: flex;
		/* width: 120rpx; */
		width: 100%;
		align-items: center;
		justify-content: center;
		border-right: 1px solid #f0f0f0;
		color: #5e5e5e;
	}

	.top_select_box .picker text {
		white-space: nowrap;
		display: block;
		max-width: calc(100% - 50rpx);
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.top_select_box .pull_down {
		width: 30rpx;
		height: 15rpx;
		margin: 8rpx 0 0 20rpx;
	}

	.search_list_box {
		margin: 90rpx 10rpx 40rpx;
	}

	.tab_type {
		flex-wrap: wrap;
		background: #fff;
		border-radius: 15rpx;
		box-shadow: 0rpx 2rpx 8rpx #ccc;
		position: fixed;
		top: 0;
	}

	.tab_type,
	.tab_type .search-box {
		display: flex;
		flex-direction: row;
		width: 100%;
	}

	.tab_type .search-box {
		height: 80rpx;
		margin: 0 auto;
		align-items: center;
	}

	.tab_type .search-box .left {
		height: 37rpx;
		width: 150rpx;
		border-right: 1rpx solid #999;
		display: flex;
		flex-direction: row;
		justify-content: center;
		align-items: center;
	}

	.dwicon {
		width: 28rpx;
		height: 26rpx;
		margin-right: 20rpx;
	}

	.localname {
		font-size: 26rpx;
		color: #999;
	}

	.tab_type .search-box .right {
		display: flex;
		flex-direction: row;
		justify-content: center;
		align-items: center;
	}

	.search_icon {
		width: 28rpx;
		height: 26rpx;
		margin: 0 20rpx;
	}

	.search_input {
		font-size: 26rpx;
		width: 480rpx;
		height: 50rpx;
	}

	.tab_type .item {
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

	.tab_type .item .icon {
		width: 60rpx;
		height: 60rpx;
		margin-bottom: 20rpx;
	}

	.tab_type .item .name {
		font-size: 28rpx;
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
		border-radius: 6rpx;
		padding: 40rpx 20rpx;
		width: 80%;
	}

	.content,
	.item {
		background: #fff;
	}

	.item {
		display: flex;
		flex-direction: row;
		height: 80rpx;
		align-items: center;
		border-bottom: 1rpx solid #f8f8f7;
	}

	.word {
		flex: 1;
	}

	.btn,
	.word {
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

	.picker-box {
		display: flex;
		flex-wrap: nowrap;
	}

	.kmPicker-item {
		text-align: center;
	}

	.kmPicker {
		display: flex;
		align-items: center;
		flex: 1;
		height: 52rpx;
		border-radius: 10rpx;
		font-size: 30rpx;
		text-indent: 20rpx;
		line-height: 52rpx;
		color: #5e5e5e;
		text-align: center;
	}

	.kmPicker text {
		white-space: nowrap;
	}
</style>