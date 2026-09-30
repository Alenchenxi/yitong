<template>
	<view>
		<view v-if="tabActive==0">
			<view v-if="hideAdvance" style="margin-top: 16rpx;">
				<u-search placeholder="请输入关键字进行搜索" v-model="searchKeyword" :clearabled="true" action-text="筛选" @search="onKeywordSearch" @clear="onKeywordClear"
				@custom="onShowAdvance"
				></u-search>
			</view>
			<view v-if="!hideAdvance" class="select_box">
				<view
					style="height: 80rpx; width:100%; display: flex; flex-direction: row;justify-content: space-between;">
					<picker @change="changeprovinceObj" :range="province_list" rangeKey="name">
						<view class="picker">
							<text>{{provinceName==''?'省':provinceName}}</text>
							<image class="pull_down" src="/static/images/pull-down.png"></image>
						</view>
					</picker>
					<picker @change="changecityObj" :range="cityList" rangeKey="name">
						<view class="picker">
							<text>{{cityName==''?'市':cityName}}</text>
							<image class="pull_down" src="/static/images/pull-down.png"></image>
						</view>
					</picker>
					<picker @change="bindLev3" :range="subjectList" range-key="name">
						<view class="picker">
							<text>{{kmLevel3name||'科目'}}</text>
							<image class="pull_down" src="/static/images/pull-down.png"></image>
						</view>
					</picker>
					<picker @change="changeTeachType" :range="teachTypeArr">
						<view class="picker">
							<text>{{selTeachType||'授课方式'}}</text>
							<image class="pull_down" src="/static/images/pull-down.png"></image>
						</view>
					</picker>
					<picker @change="changeSex" :range="teacher_identityArray">
						<view class="picker">
							<text> {{teacher_identity?teacher_identityArray[teacher_identity*1-1]:'类型'}}</text>
							<image class="pull_down" src="/static/images/pull-down.png"></image>
						</view>
					</picker>
				</view>
			</view>
			<view :class="hideAdvance ? 'student_list student_list_hide' : 'student_list'">
				<image src="/static/images/hezi.png" style="margin:0 auto" v-if="dataList.length==0"></image>
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
						<view class="desc">
							<view class="loaclhost">
								<image class="img" src="/static/images/ui_r3_c4.png"></image>
								<view class="jl">{{item.distance?item.distance.toFixed(2):0}}km</view>
							</view>
						</view>
					</view>
				</view>
			</view>

			<view>
				<view class="imagePathBox" v-if="maskHidden">
					<image class="shengcheng" :src="imagePath"></image>
					<button @click="baocunfun" class="baocun">保存相册，分享到朋友圈</button>
				</view>
				<view class="mask" v-if="maskHidden"></view>
			</view>
		</view>

	</view>
</template>

<script>
	export default {
		data() {
			return {
				searchName: "",
				searchId: "",
				allCityArr: [],
				cityArr3: [],
				//授课时间
				selArr: [{
					time: "周一",
					isSel: false
				}, {
					time: "周二",
					isSel: false
				}, {
					time: "周三",
					isSel: false
				}, {
					time: "周四",
					isSel: false
				}, {
					time: "周五",
					isSel: false
				}, {
					time: "周六",
					isSel: false
				}, {
					time: "周日",
					isSel: false
				}],
				detailTiem: [],
				qiyu1: "",
				qiyu2: "",
				orderAreaOne: [],
				orderAreaTwo: [],
				teachTypeArr: ['授课方式', "上门授课", "在线授课", "均可"],
				selTeachType: "",
				kmLevel1: ['分类1', '分类2', '分类3'],
				kmLevel2: [],
				kmLevel3: [],

				isChecked: false,
				isDisabled: false,
				activate: 0,
				maskHidden: false,
				shareBg: "",
				tabActive: 0,
				tabArr: [{
					name: "接单列表",
					id: "0",
					active: 1
				}, {
					name: "接单设置",
					id: "1",
					active: 0
				}],
				pageNum: 1,
				isShowNoMag: true,
				bindregion: "区域",
				index: 0,
				obj: [],
				province: "地址",
				city: "市",
				area: "区",
				cityObj: [],
				areaObj: [],
				objName: "科目",
				sel: [{
					id: 3,
					name: "性别"
				}, {
					id: 0,
					name: "女"
				}, {
					id: 1,
					name: "男"
				}],
				selName: "性别",
				dataList: [],
				allPages: 1,
				//可授课区域
				cityArr: [],
				cityArr2: [],
				cityArr4: [],
				multiIndex: [0, 0],
				multiIndex2: [0, 0],

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
				//分类
				categoryList: [{
					name: '分类'
				}],
				gradeList: [{
					name: '年级'
				}],
				subjectList: [{
					name: '科目'
				}],
				kmLevel1name: "",
				kmLevel2name: "",
				kmLevel3name: "",
				provinceList: [],
				page: 1,
				isList: true,
				category_id: '',
				grade_id: '',
				subject_id: '',
				gender: '',
				provinces: '',
				citys: '',
				areas: '',
				teaching_way: '',
				teacher_identity: '',
				teacher_identityArray: ['大学生教员', '专职教员', '不限'],
				hideAdvance: true,
				searchKeyword: '',
			}
		},
		onLoad() {
			//学生列表
			this.getTStudentList()
			//城市列表
			this.getHotCityAndProvinceList()
			//分类
			this.getCategoryList()
			//城市
			// this.getProvinceList()
			this.getSubjectNames()
		},
		onReachBottom() {
			if (this.isList) {
				++this.page
				this.getTStudentList()
			}

		},
		onShareAppMessage() {
			return {
				title: '献新家教',
				page: '/receiving/receivingOrders/receivingOrders'
			}
		},
		onShareTimeline() {
			return {
				title: '献新家教',
				page: '/receiving/receivingOrders/receivingOrders'
			}
		},
		methods: {
			onShowAdvance(){
				this.hideAdvance = false
			},
			onKeywordSearch(){
				this.page = 1
				this.dataList = []
				this.getTStudentList()
			},
			onKeywordClear(){
				this.searchKeyword = ''
				this.page = 1
				this.dataList = []
				this.getTStudentList()
			},
			// getProvinceList() {
			// 	this.api('/index/getHotCityAndProvinceList', 'post').then(res => {
			// 		this.provinceList.push(res.data.province_list)

			// 		this.getCityList(this.provinceList[0][0].id)
			// 	})
			// },
			getSubjectNames() {
				this.api('/index/getSubjectNames', 'post').then(res => {
					console.log(res)
					this.subjectList = res.data
					this.subjectList.unshift({
						name: '科目'
					})
				})
			},
			bindMultiPickerChange() {
				console.log(this.provinceList[1][e.detail.value[1]])
				this.proName1 = this.provinceList[0][e.detail.value[0]].name
				this.proName2 = this.provinceList[1][e.detail.value[1]].name
				console.log(this.proName1, this.proName2)
				this.api('/index/getAreaList', 'post', {
					city_id: this.provinceList[1][e.detail.value[1]].id
				}).then(res => {
					console.log()
					if (res.status != 200) {
						uni.showToast({
							title: res.msg,
							icon: "none"
						})
						return
					}
					this.cityArr = res.data
					this.cityArr.forEach(item => {
						this.$set(item, 'isSel', 0)
					})

				})
			},
			bindMultiPickerColumnChange() {

			},
			getCategoryList() {
				this.api('/index/getCategoryList', 'post').then(res => {
					this.categoryList = this.categoryList.concat(res.data)
				})
			},
			changeSex(e) {
				// this.page = 1
				// this.selName = this.sel[e.detail.value].name
				// this.gender = e.detail.value
				this.teacher_identity = e.detail.value * 1 + 1
				this.getTStudentList()
			},
			changeTeachType(e) {
				this.page = 1
				this.teaching_way = e.detail.value * 1
				this.getTStudentList()
				this.selTeachType = this.teachTypeArr[e.detail.value]
			},
			getTStudentList() {
				this.api('/index/getStudentList', 'post', {
					page: this.page,
					// category_id: this.category_id,
					// grade_id: this.grade_id,
					subject_name: (this.kmLevel3name == '科目') ? '' : this.kmLevel3name,
					gender: this.gender,
					province: this.provinces,
					city: this.citys,
					area: this.areas,
					teacher_identity: this.teacher_identity || "",
					teaching_way: this.teaching_way || '',
					longitude: uni.getStorageSync('longitude'),
					latitude: uni.getStorageSync('latitude'),
					keyword: this.searchKeyword
				}).then(res => {
					if (res.status == 200) {
						console.log(res)
						if (res.data.length <= 0) {
							this.isList = false
						}
						if (this.page == 1) {
							this.dataList = res.data
						} else {
							this.dataList = this.dataList.concat(res.data)
						}
					} else {
						uni.showToast({
							title: res.msg,
							icon: "none"
						})
					}
				})
			},
			handlv2() {
				if (!this.kmLevel1name) {
					uni.showToast({
						title: '请先选择分类',
						icon: "none"
					})
				}
			},
			// handlv3() {
			// 	if (!this.kmLevel2name) {
			// 		uni.showToast({
			// 			title: '请先选择年级',
			// 			icon: "none"
			// 		})
			// 	}
			// },
			changeareaObj(e) {
				this.page = 1
				let item = this.areaList[e.detail.value]
				this.areaName = item.name
				this.areas = (item.name == '区') ? '' : item.name
				this.getTStudentList()
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
			changecityObj(e) {
				this.areaName = ''
				this.areas = ''
				let item = this.cityList[e.detail.value]
				this.citys = (item.name == '市') ? '' : item.name
				this.cityName = item.name
				this.page = 1
				this.areaList = [{
					name: '区'
				}]
				this.getTStudentList()
				this.api('/index/getAreaList', 'post', {
					city_id: item.id
				}).then(res => {
					if (res.status == 200) {
						this.areaList = this.areaList.concat(res.data)
					} else {
						uni.showToast({
							title: res.msg,
							icon: "none"
						})
					}
				})
			},
			toDetail(id) {
				uni.navigateTo({
					url: '/receiving/receDetail/receDetail?id=' + id
				})
			},
			clickTab(index) {
				this.tabActive = index
				this.tabArr.forEach(item => {
					item.active = 0
				})
				this.tabArr[index].active = 1
			},
			bindLev1(e) {
				console.log(e)
				let item = this.categoryList[e.detail.value]
				this.kmLevel1name = item.name
				this.kmLevel2name = ''
				this.kmLevel3name = ''
				this.grade_id = ''
				this.subject_id = ''
				this.page = 1
				this.category_id = item.category_id || ''
				this.getTStudentList()
				this.gradeList = [{
					name: '年级'
				}]
				this.api('/index/getGradeList', 'post', {
					category_id: item.category_id
				}).then(res => {
					this.gradeList = this.gradeList.concat(res.data)
				})
			},
			bindLev2(e) {
				let item = this.gradeList[e.detail.value]
				this.kmLevel2name = item.name
				this.kmLevel3name = ''
				this.subject_id = ''
				this.grade_id = item.grade_id || ''
				this.page = 1
				this.subjectList = [{
					name: '科目'
				}]
				this.getTStudentList()
				this.api('/index/getSubjectList', 'post', {
					grade_id: item.grade_id
				}).then(res => {
					this.subjectList = this.subjectList.concat(res.data)
				})
			},
			bindLev3(e) {
				let item = this.subjectList[e.detail.value]
				this.page = 1
				this.kmLevel3name = item.name
				this.subject_id = item.subject_id || ''
				this.getTStudentList()
			},
			changeprovinceObj(e) {
				this.cityName = ''
				this.areaName = ''
				this.page = 1
				let item = this.province_list[e.detail.value]
				this.provinces = (item.name == '省') ? '' : item.name
				this.citys = ''
				this.areas = ''
				this.provinceName = item.name
				this.cityList = [{
					name: '市'
				}]
				this.getTStudentList()
				this.api('/index/getCityList', 'post', {
					province_id: item.id
				}).then(res => {
					if (res.status == 200) {
						this.cityList = this.cityList.concat(res.data)
					} else {
						uni.showToast({
							title: res.msg,
							icon: "none"
						})
					}
				})
			},
			selectDate(index) {

				this.selArr[index].isSel = !this.selArr[index].isSel
				if (this.selArr[index].isSel) {
					this.detailTiem.push({
						week: this.selArr[index].time,
						time1: '9:00',
						time2: '18:00'
					})
				} else {
					this.detailTiem.forEach((item, index1) => {
						if (item.week == this.selArr[index].time) {
							this.detailTiem.splice(index1, 1)
						}
					})
				}
			}
		}
	}
</script>

<style scoped>
	page {
		background: #f8f8f7;
		border: 1rpx solid #fff;
	}

	.order_page {
		background: #fff;
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		z-index: 10000;
		border-bottom: 2px solid #f0f0f0;
	}

	.order_page .tab_box {
		height: 90rpx;
		flex-direction: row;
		align-content: center;
		display: flex;
	}

	.order_page .tab_box .tab {
		font-size: 28rpx;
		height: 90rpx;
		flex: 1;
		color: #999;
		text-align: center;
		line-height: 90rpx;
		border-right: 4rpx solid #f0f0f0;
	}

	.order_page .tab_box .active {
		color: #fc9023;
		font-weight: 600;
	}

	.select_box {
		position: fixed;
		top: 0rpx;
		left: 0;
		display: flex;
		flex-direction: row;
		font-weight: 400;
		height: 80rpx;
		align-items: center;
		background: #fff;
		z-index: 10000;
		width: 750rpx;
		/* overflow-x: scroll;
		 */

	}

	.zw {
		height: 90rpx;
	}

	/deep/.select_box picker {
		width: 25%;
	}

	.select_box .picker {
		height: 60rpx;
		min-width: 100%;
		font-size: 26rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		border-right: 1px solid #f0f0f0;
		color: #5e5e5e;
		white-space: nowrap;
	}

	.select_box .picker text {
		display: block;
		max-width: calc(100% - 40rpx);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.pickerval {
		width: 100%;

	}

	.pickerobj {
		width: 100%;
	}

	.select_box .pull_down {
		width: 20rpx;
		height: 10rpx;
		margin: 8rpx 0 0 20rpx;
	}

	.student_list_hide{
		margin-top: 30rpx !important;
	}
	.student_list {
		width: 95%;
		display: flex;
		margin: 90rpx auto 40rpx;
		flex-direction: column;
	}

	.student_list .item {
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

	.student_list .desc {
		padding: 10rpx;
		display: flex;
		align-items: flex-start;
		flex-direction: column;
		flex: 1;
		justify-content: space-between;
	}

	.student_list .name {
		font-size: 28rpx;
		margin-right: 20rpx;
		flex-wrap: wrap;
	}



	.student_list .pice {
		width: 40rpx;
		height: 40rpx;
	}

	.piceword {
		font-size: 26rpx;
		margin-right: 15rpx;
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
	}

	.toClassType {
		background-color: #f8c400;
		padding: 6rpx 20rpx;
		font-size: 24rpx;
		border-radius: 20rpx;
	}

	.loaclhost .img {
		width: 28rpx;
		height: 26rpx;
		margin-right: 10rpx;
	}

	.jl {
		color: #ccc;
	}

	.jl,
	.noMsg {
		font-size: 26rpx;
	}

	.noMsg {
		text-align: center;
	}

	.share-box {
		bottom: 200rpx;
	}

	.share-box,
	.share-box2 {
		position: fixed;
		right: 0;
		width: 120rpx;
		height: 60rpx;
		z-index: 10000;
	}

	.share-box2 {
		bottom: 300rpx;
	}

	.imagePathBox {
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, .7);
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 10000;
	}

	.shengcheng {
		width: 95%;
		height: 80%;
		position: fixed;
		top: 70rpx;
		left: 40%;
		margin-left: -39%;
		z-index: 10;
	}

	.baocun {
		display: block;
		width: 80%;
		height: 80rpx;
		padding: 0;
		line-height: 80rpx;
		text-align: center;
		position: fixed;
		bottom: 50rpx;
		left: 10%;
		background: linear-gradient(90deg, #f1b832, #eca339);
		color: #fff;
		font-size: 32rpx;
		border-radius: 44rpx;
		z-index: 100000;
	}

	button[class="baocun"]::after {
		border: 0;
	}

	.jiedan-box {
		display: flex;
		flex-direction: row;
		align-items: center;
		height: 80rpx;
		border-bottom: 1rpx solid #ccc;
		padding: 0 20rpx;
		box-sizing: border-box;
	}

	.jiedanName {
		flex: 1;
		font-size: 28rpx;
	}

	.switch {
		zoom: .7;
	}

	.teacher-set .item-title {
		font-size: 30rpx;
		font-weight: 600;
		margin: 40rpx 20rpx 10rpx;
	}

	.teacher-set .redcolor {
		color: red;
	}

	.teacher-set .title {
		padding: 0 20rpx;
		font-size: 30rpx;
		font-weight: 600;
	}

	.teacher-set .item_box {
		display: flex;
		background: #fff;
		margin-top: 20rpx;
		flex-wrap: wrap;
	}

	.teacher-set .list_box {
		position: relative;
		height: 80rpx;
	}

	.teacher-set .list-item {
		margin-top: 10rpx;
		height: 60rpx;
		padding: 0 10rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 28rpx;
		background: #f8c400;
		color: #fff;
		margin-right: 40rpx;
	}

	.guanbiimg {
		height: 40rpx;
		width: 40rpx;
		position: absolute;
		top: -10rpx;
		right: 10rpx;
	}

	.teacher-set .sel-box {
		align-items: flex-start;
		flex-direction: row;
		background: #fff;
		border-radius: 10rpx;
	}

	.teacher-set .data,
	.teacher-set .sel-box {
		display: flex;
		padding: 10rpx;
		box-sizing: border-box;
	}

	.teacher-set .data {
		flex: 1;
		border: 1rpx solid #dbdbdb;
		height: 350rpx;
		overflow: auto;
		margin-left: 20rpx;
		border-radius: 10rpx;
		flex-direction: row;
		flex-wrap: wrap;
	}

	.teacher-set .tip {
		font-size: 26rpx;
		color: #dbdbdb;
		padding: 10rpx;
		box-sizing: border-box;
	}

	.teacher-set .city {
		font-size: 26rpx;
		background: #f8c400;
		color: #fff;
		height: 50rpx;
		line-height: 50rpx;
		margin-right: 20rpx;
		border-radius: 5rpx;
		margin-bottom: 20rpx;
		padding: 0 20rpx;
	}

	.teacher-set .mar {
		margin-top: 40rpx;
	}

	.teacher-set .zw {
		height: 60rpx;
		width: 100%;
	}

	.teacher-set .isSelCity {
		display: flex;
		flex-direction: column;
		border-bottom: 1rpx solid #ccc;
		margin-bottom: 30rpx;
	}

	.teacher-set .city-box {
		display: flex;
		flex-wrap: wrap;
		flex-direction: row;
		background: #fff;
		padding-top: 20rpx;
	}

	.teacher-set .saveBg {
		width: 80%;
		border-radius: 6rpx;
		height: 80rpx;
		font-size: 28rpx;
		text-align: center;
		line-height: 80rpx;
		color: #fff;
		margin: 101rpx auto 20rpx;
		background: linear-gradient(90deg, #eca33d, #f1b833);
	}

	.teacher-set .city2 {
		font-size: 26rpx;
		background: #fff;
		border: 1rpx solid #000;
		color: #000;
		height: 50rpx;
		line-height: 50rpx;
		margin-right: 20rpx;
		border-radius: 5rpx;
		margin-bottom: 20rpx;
		padding: 0 20rpx;
	}

	.select_item_color {
		border: 1rpx solid #f8c400 !important;
		color: #fff !important;
		background: #f8c400 !important;
	}

	.comment_style .set {
		height: 80rpx;
		display: flex;
		align-items: center;
		padding: 0 20rpx;
		box-sizing: border-box;
		background: #fff;
		margin-bottom: 20rpx;
	}

	.comment_style .title {
		font-size: 28rpx;
		flex: 1;
	}

	.comment_style .timebox {
		background: #fff;
		padding: 20rpx 10rpx;
		margin-bottom: 30rpx;
	}

	.comment_style .cul {
		height: 80rpx;
		display: flex;
		flex-direction: row;
		border: 1rpx solid #ccc;
	}

	.comment_style .border-top {
		border-top: none;
	}

	.comment_style .date-item {
		font-size: 28rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 1;
		border-radius: 4rpx;
		border-right: 1rpx solid #999;
	}

	.comment_style .yellbg {
		background: #f8c400;
		border-right: 1rpx solid #f8c400;
	}

	.comment_style .time_title {
		display: flex;
		flex-direction: row;
		height: 60rpx;
		font-size: 28rpx;
		align-items: center;
		background: #fff;
		border-bottom: 1rpx solid #ccc;
	}

	.comment_style .title_item {
		flex: 1;
		text-align: center;
	}

	.comment_style .dateDetail {
		display: flex;
		align-items: center;
		font-size: 28rpx;
		height: 80rpx;
		padding: 0 20rpx;
		box-sizing: border-box;
		background: #fff;
		border-bottom: 1rpx solid #ccc;
	}

	.comment_style .day,
	.comment_style .picker {
		flex: 1;
		text-align: center;
	}

	.comment_style .switch {
		transform: scale(.6);
	}

	.share-box3 {
		position: fixed;
		bottom: 100rpx;
		right: 0;
		width: 120rpx;
		height: 60rpx;
		z-index: 10000;
	}
</style>