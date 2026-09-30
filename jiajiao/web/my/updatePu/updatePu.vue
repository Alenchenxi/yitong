<template>
	<view>
		<view class="teacher_matching">
			<view class="title">
				<view class="desc">填写帮我选师</view>
			</view>
			<!-- <view class="top_img">
				<image class="top_img" src="http://www.xurijiajiao.cn/image/96665.jpg"></image>
			</view> -->
			<view class="from_box">
				<view class="items">
					<view class="name">
						<image class="mast_start" src="/static/images/mast_start.png"></image>姓名：
					</view>
					<input v-model="name1" class="student-type" maxlength="11" placeholder="请输入姓名"></input>
				</view>
				<view class="items">
					<view class="name">
						<image class="mast_start" src="/static/images/mast_start.png"></image>授课方式：
					</view>
					<picker @change="bindTeaching" class="inputval" :range="teachingArr">
						<view class="picker">
							<text class="addressName">{{teachingArr[teachingindex]}}</text>
						</view>
					</picker>
				</view>
				<view class="items">
					<view class="name">
						<image class="mast_start" src="/static/images/mast_start.png"></image>教师授课地址：
					</view>
					<picker @change="bindregions" class="inputval" mode="region">
						<view class="picker">
							<text class="addressName">{{bindregion}}</text>
						</view>
					</picker>
				</view>
				<view class="items">
					<view class="name">
						<image class="mast_start" src="/static/images/mast_start.png"></image>教师授课详细地址：
					</view>
					<textarea v-model="address" class="textarea" placeholder="如道路、门牌号、小区、楼栋号等"></textarea>
				</view>

				<view class="items">
					<view class="name">
						<image class="mast_start" src="/static/images/mast_start.png"></image>联系号码：
					</view>
					<input v-model="phone" class="student-type" maxlength="11" placeholder="联系手机号"
						type="number"></input>
				</view>
				<view class="items">
					<view class="name">
						<image class="mast_start" src="/static/images/mast_start.png"></image>邮箱地址：
					</view>
					<input v-model="email" class="student-type" placeholder="请输入邮箱地址" type="text"></input>
				</view>
				<view class="items">
					<view class="name">
						<image class="mast_start" src="/static/images/mast_start.png"></image>在读学校
					</view>
					<input v-model="school" class="student-type" maxlength="15" placeholder="在读学校"></input>
				</view>
				<view class="items">
					<view class="name">
						<image class="mast_start" src="/static/images/mast_start.png"></image> 辅导的科目：
					</view>
					<view class="picker-box">
						<picker @change="bindLev1" class="kmPicker-item mar" :range="kmLevel1" range-key="name">
							<view class="kmPicker">
								<text class="kmName">{{kmLevel1name||'请选择'}}</text>
							</view>
						</picker>
						<picker @change="bindLev2" class="kmPicker-item mar" :range="kmLevel2" range-key="name">
							<view class="kmPicker">
								<text class="kmName">{{kmLevel2name||'请选择'}}</text>
							</view>
						</picker>
						<picker @change="bindLev3" class="kmPicker-item" :range="kmLevel3" range-key="name">
							<view class="kmPicker">
								<text class="kmName">{{kmLevel3name||'请选择'}}</text>
							</view>
						</picker>
					</view>
				</view>
				<view class="items">
					<view class="name">
						<image class="mast_start" src="/static/images/mast_start.png"></image>课时费：
					</view>
					<input v-model="price" class="student-type" type="number" placeholder="请输入课时费(元/时)"></input>
				</view>
				<view class="items">
					<view class="name">
						<image class="mast_start" src="/static/images/mast_start.png"></image> 学生的性别：
					</view>
					<view class="item_box">
						<view @click="selsctStudentSex(index)" class="select_item" v-for="(item,index) in sex"
							:key="index" :class="item.isSel==1?'select_item_color':''">{{item.name}}</view>
					</view>
				</view>
				<!-- 	<view class="items">
					<view class="name">
						<image class="mast_start" src="/static/images/mast_start.png"></image> 试课时间：
					</view>
					<picker @change="bindMultiPickerChange" mode="multiSelector" :range="multiArray">
						<view class="yuyuepicker">
							{{multiArray[0][ multiIndex[0] ]}}，{{multiArray[1][ multiIndex[1] ]}}
						</view>
					</picker>
				</view> -->
				<view class="items">
					<view class="name">
						<image class="mast_start" src="/static/images/mast_start.png"></image> 上课时间：<text
							style="color:#fc9023;font-size:20rpx">点击09:00可更改开始时间哦</text>
					</view>
					<view class="comment_style">
						<view class="timebox">
							<view class="cul ">
								<view class="item_box" :class="item.isSel?'yellbg':''" v-for="(item,index) in selArr"
									:key="index">
									<view class="item" @click="selectDate(index)">{{item.time}}</view>
									<view class="cTime" @click="selectDate(index)">开始时间</view>
									<view @clcik="stopSelect" class="picker">
										<picker @change="bindTimeChange($event,index)" end="20:00" mode="time"
											start="09:00">
											<view>{{detailTiem[index].start_time}}</view>
										</picker>
									</view>
									<view class="time_line">—</view>
									<view class="cTime">结束时间</view>
									<picker class="picker" disabled="true" end="22:00" mode="time" start="11:00">
										<view>{{detailTiem[index].end_time}}</view>
									</picker>
								</view>
							</view>
						</view>
					</view>
				</view>
				<view class="items">
					<view class="name">
						<image class="mast_start" src="/static/images/mast_start.png"></image> 学生的基本情况：
					</view>
					<view class="item_box">
						<view @click="selsctStudentType(index)" class="select_item" v-for="(item,index) in student"
							:key="index" :class="item.isSel==1?'select_item_color':''">{{item.name}}</view>
					</view>
					<input v-model="studentInput" class="student-type" placeholder="请输入学生基本情况"></input>
				</view>
				<view class="items">
					<view class="name">
						<image class="mast_start" src="/static/images/mast_start.png"></image> 老师性别：
					</view>
					<view class="item_box">
						<view @click="selsctTeacherSex(index)" class="select_item" v-for="(item,index) in teacherSex"
							:key="index" :class="item.isSel==1?'select_item_color':''">{{item.name}}</view>
					</view>
				</view>
				<view class="items">
					<view class="name">
						<image class="mast_start" src="/static/images/mast_start.png"></image> 老师类型：
					</view>
					<view class="item_box">
						<view @click="selsctTeacherType(index)" class="select_item" v-for="(item,index) in teacherType"
							:key="index" :class="item.isSel==1?'select_item_color':''">{{item.name}}</view>
					</view>
				</view>
				<view class="items">
					<view class="name">
						<image class="mast_start" src="/static/images/mast_start.png"></image> 对老师的其他要求：
					</view>
					<view class="item_box">
						<view @click="selsctTeacheryaoqiu(index)" class="select_item" v-for="(item,index) in yaoqiuArr"
							:key="index" :class="item.isSel==1?'select_item_color':''">{{item.name}}</view>
					</view>
					<input v-model="yaoqiuInput" class="student-type" placeholder="对老师的其他要求"></input>
				</view>

				<view class="zw"></view>
				<view @click="submitData" class="btn_submit">立即提交</view>
				<view class="zw"></view>
			</view>

		</view>

	</view>
</template>

<script>
	export default {
		data() {
			return {
				latlon: "",
				firstBtn: true,

				lat: "",
				lon: "",
				isPost: false,
				teachAddress: "",
				jigouInput: "",
				grade: "",
				shen: "",
				shi: "",
				qv: "",
				culture: "",
				subject: "",
				selArr: [{
					time: "每周一",
					isSel: false
				}, {
					time: "每周二",
					isSel: false
				}, {
					time: "每周三",
					isSel: false
				}, {
					time: "每周四",
					isSel: false
				}, {
					time: "每周五",
					isSel: false
				}, {
					time: "每周六",
					isSel: false
				}, {
					time: "每周日",
					isSel: false
				}],
				showMap: false,
				detailTiem: [{
					week: "每周一",
					start_time: "09:00",
					end_time: "11:00"
				}, {
					week: "每周二",
					start_time: "09:00",
					end_time: "11:00"
				}, {
					week: "每周三",
					start_time: "09:00",
					end_time: "11:00"
				}, {
					week: "每周四",
					start_time: "09:00",
					end_time: "11:00"
				}, {
					week: "每周五",
					start_time: "09:00",
					end_time: "11:00"
				}, {
					week: "每周六",
					start_time: "09:00",
					end_time: "11:00"
				}, {
					week: "每周日",
					start_time: "09:00",
					end_time: "11:00"
				}],
				iSChangeSk: false,
				iSChangeCt: false,
				bindregion: "请选择教师授课地址",
				index: 0,
				address: "",
				//详细地址
				dataStatus: 1,
				student: [{
					name: "调皮",
					isSel: 0,
					id: 1
				}, {
					name: "不专心",
					isSel: 0,
					id: 2
				}, {
					name: "基础薄弱",
					isSel: 0,
					id: 3
				}, {
					name: "不听讲",
					isSel: 0,
					id: 4
				}, {
					name: "成绩良好",
					isSel: 0,
					id: 5
				}],
				//学生情况
				studentInput: "",
				//学生情况输入
				name1: "",
				teacherSex: [{
					name: "男老师",
					isSel: 0,
					id: 1
				}, {
					name: "女老师",
					isSel: 0,
					id: 2
				}, {
					name: "男女均可",
					isSel: 0,
					id: 3
				}],
				//教师性别
				sex: [{
					name: "男生",
					isSel: 0,
					id: 1
				}, {
					name: "女生",
					isSel: 0,
					id: 2
				}],
				//学生性别
				teacherType: [{
					name: "大学生教员",
					isSel: 0,
					id: 1
				}, {
					name: "专职教员",
					isSel: 0,
					id: 2
				}, {
					name: "均可",
					isSel: 0,
					id: 3
				}],
				//教师类型
				yaoqiuArr: [{
					name: "幽默",
					isSel: 0,
					id: 1
				}, {
					name: "严格",
					isSel: 0,
					id: 2
				}, {
					name: "亲切",
					isSel: 0,
					id: 3
				}, {
					name: "负责",
					isSel: 0,
					id: 4
				}, {
					name: "准时",
					isSel: 0,
					id: 5
				}, {
					name: "基础扎实",
					isSel: 0,
					id: 6
				}],
				//教师要求 

				yaoqiuInput: "",
				//教师要求输入
				multiArray: [],
				//时间选择数据
				objectMultiArray: [],
				multiIndex: [0, 0],
				//试课时间
				projecttype: "",
				//辅导的科目
				phone: "",
				//联系手机
				timeName: "0",
				school: "",
				//学校
				teachingArr: ["上门授课", "在线授课", "均可"],
				teachingindex: 0,
				psotData: "",
				changeId: "",
				kmLevel1: [],
				kmLevel2: [],
				kmLevel3: [],
				kmLevel1name: "",
				kmLevel2name: "",
				kmLevel3name: "",
				sexNumber: '',
				kmLevel1Id: '',
				kmLevel2Id: '',
				kmLevel3Id: '',
				bindregionArr: [],
				detail: {},
				latitude: '',
				longitude: '',
				price: '',
				email: ''
			}
		},
		onLoad(options) {
			this.getCategoryList()

			this.getStudentInfo(options.id)
		},

		methods: {
			submitData() {
				let studentDe = ''
				let teacherSexNum = ''
				let teacherTypeNum = ''
				let yaoqiuArrCon = ''
				let tTiems = []
				this.student.forEach(item => {
					if (item.isSel == 1) {
						studentDe += item.name
					}
				})
				this.teacherSex.forEach((item, index) => {
					if (item.isSel == 1) {
						teacherSexNum = index * 1 + 1
					}
				})
				this.teacherType.forEach((item, index) => {
					if (item.isSel == 1) {
						teacherTypeNum = index * 1 + 1
					}
				})
				this.yaoqiuArr.forEach((item) => {
					if (item.isSel == 1) {
						yaoqiuArrCon += item.name
					}
				})
				this.selArr.forEach((item, index) => {
					if (item.isSel) {
						tTiems.push(this.detailTiem[index])
					}
				})
				if (!this.name1) {
					uni.showToast({
						title: '请输入姓名',
						icon: 'none'
					})
					return
				}
				if (!this.phone) {
					uni.showToast({
						title: '请输入手机号',
						icon: 'none'
					})
					return
				}
				if (!this.email) {
					uni.showToast({
						title: '请输入邮箱地址'
					})
					return
				}
				if (!this.address) {
					uni.showToast({
						title: '请输入详细地址',
						icon: 'none'
					})
					return
				}
				if (!this.school) {
					uni.showToast({
						title: '请输入学校',
						icon: 'none'
					})
					return
				}
				if (tTiems.length <= 0) {
					uni.showToast({
						title: '请选择上课时间',
						icon: 'none'
					})
					return
				}
				if ((!this.kmLevel1Id) || (!this.kmLevel2Id) || (!this.kmLevel3Id)) {
					uni.showToast({
						title: '请选择辅导的科目',
						icon: 'none'
					})
					return
				}
				if (!this.price) {
					uni.showToast({
						title: '请输入课时费',
					})
					return
				}
				if ((!studentDe) && (!this.studentInput)) {
					uni.showToast({
						title: '请选择学生基本情况',
						icon: 'none'
					})
					return
				}
				if ((!yaoqiuArrCon) && (!this.yaoqiuInput)) {
					uni.showToast({
						title: '请选择对老师的要求',
						icon: 'none'
					})
					return
				}

				let data = {
					demand_id: this.detail.demand_id,
					name: this.name1,
					mobile: this.phone,
					teaching_way: this.teachingindex * 1 + 1,
					gender: this.sexNumber,
					category_id: this.kmLevel1Id,
					grade_id: this.kmLevel2Id,
					subject_id: this.kmLevel3Id,
					school: this.school,
					gai_kuang: studentDe + this.studentInput,

					province: this.bindregionArr[0],
					city: this.bindregionArr[1],
					area: this.bindregionArr[2],
					address: this.address,

					teacher_gender: teacherSexNum,
					price: this.price,
					teacher_identity: teacherTypeNum,

					teacher_require: yaoqiuArrCon + this.yaoqiuInput,
					schooltime_json: JSON.stringify(tTiems),
					longitude: this.longitude,
					latitude: this.latitude,
					mail: this.email
				}

				this.api('/user/studentsRelease', 'post', data).then(res => {

					uni.showToast({
						title: '修改成功',
						icon: 'none'
					})
					setTimeout(() => {
						uni.navigateBack()
					}, 500)

				})
			},
			getStudentInfo(id) {
				this.api('/index/getStudentInfo', 'post', {
					demand_id: id,
					mid: uni.getStorageSync('user').mid
				}).then(res => {
					this.detail = res.data
					console.log(res)
					this.longitude = this.detail.longitude
					this.latitude = this.detail.latitude
					this.name1 = this.detail.name
					this.teachingindex = this.detail.teaching_way * 1 - 1
					this.bindregion = this.detail.province + ' ' + this.detail.city + ' ' + this.detail.area
					this.address = this.detail.address
					this.phone = this.detail.mobile
					this.school = this.detail.school
					this.kmLevel1name = this.detail.category_name
					this.kmLevel2name = this.detail.grade_name
					this.kmLevel3name = this.detail.subject_name
					this.kmLevel1Id = this.detail.category_id
					this.kmLevel2Id = this.detail.grade_id
					this.kmLevel3Id = this.detail.subject_id
					this.sex[this.detail.gender * 1 - 1].isSel = 1
					this.sexNumber = this.detail.gender
					this.price = this.detail.price
					this.studentInput = this.detail.gai_kuang
					this.teacherType[this.detail.teacher_identity * 1 - 1].isSel = 1
					this.teacherSex[this.detail.teacher_gender * 1 - 1].isSel = 1
					this.email = this.detail.mail
					this.yaoqiuInput = this.detail.teacher_require
					this.selArr.forEach((item, index) => {

						this.detail.schooltime.forEach(item1 => {
							// console.log(item, item1)
							if (item.time.indexOf(item1.week) != -1) {
								this.selArr[index].isSel = true
								this.detailTiem[index].start_time = item1.start_time
								this.detailTiem[index].end_time = item1.end_time
							}
						})
					})
					this.bindregionArr = [this.detail.province, this.detail.city, this.detail.area]

				})
			},
			bindTeaching(e) {
				this.teachingindex = e.detail.value
			},
			bindregions(e) {
				console.log(e)
				this.bindregionArr = e.detail.value
				this.bindregion = e.detail.value.join(' ')
			},
			getCategoryList() {
				this.api('/index/getCategoryList', 'post').then(res => {
					this.kmLevel1 = res.data
				})
			},
			bindLev1(e) {
				let item = this.kmLevel1[e.detail.value]
				this.kmLevel1name = item.name
				this.kmLevel2name = ''
				this.kmLevel3name = ''
				this.kmLevel2Id = ''
				this.kmLevel3Id = ''
				this.kmLevel1Id = item.category_id
				this.api('/index/getGradeList', 'post', {
					category_id: item.category_id
				}).then(res => {
					this.kmLevel2 = res.data
				})
			},
			bindLev2(e) {
				let item = this.kmLevel2[e.detail.value]
				this.kmLevel2name = item.name
				this.kmLevel3name = ''
				this.kmLevel3Id = ''
				this.kmLevel2Id = item.grade_id
				this.api('/index/getSubjectList', 'post', {
					grade_id: item.grade_id
				}).then(res => {
					this.kmLevel3 = res.data
				})
			},
			//科目选择
			bindLev3(e) {
				let item = this.kmLevel3[e.detail.value]
				this.kmLevel3Id = item.subject_id
				this.kmLevel3name = item.name
			},
			selsctStudentSex(index) {
				this.sex.forEach(item => {
					item.isSel = 0
				})
				this.sex[index].isSel = 1
				this.sexNumber = index * 1 + 1
			},
			selectDate(index) {
				this.selArr[index].isSel = !this.selArr[index].isSel
			},
			bindTimeChange(e, index) {
				this.detailTiem[index].start_time = e.detail.value
			},
			selsctStudentType(index) {
				this.student[index].isSel = this.student[index].isSel == 1 ? 0 : 1
			},
			selsctTeacherType(index) {
				this.teacherType.forEach(item => {
					item.isSel = 0
				})
				this.teacherType[index].isSel = 1
			},
			selsctTeacheryaoqiu(index) {
				this.yaoqiuArr[index].isSel = this.yaoqiuArr[index].isSel == 1 ? 0 : 1
			},
			selsctTeacherSex(index) {
				this.teacherSex.forEach(item => {
					item.isSel = 0
				})
				this.teacherSex[index].isSel = 1
			}
		}
	}
</script>

<style scoped>
	page {
		background-color: #fff;
	}

	.infoText {
		width: 100%;
		height: 80rpx;
		border: 1px solid #999;
		border-radius: 10rpx;
		font-size: 26rpx;
		line-height: 80rpx;
		text-indent: 10rpx;
	}

	.centerText {
		margin-top: 100rpx;
		width: 100%;
		text-align: center;
	}

	picker {
		height: 100%;
	}

	picker-view {
		background-color: #fff;
		padding: 0;
		width: 100%;
		height: 450rpx;
		bottom: 0;
		position: fixed;
	}

	picker-view-column view {
		vertical-align: middle;
		font-size: 28rpx;
		line-height: 28rpx;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.animation-element-wrapper {
		display: flex;
		position: fixed;
		left: 0;
		top: 0;
		height: 100%;
		width: 100%;
		background-color: rgba(0, 0, 0, .6);
		z-index: 10000;
	}

	.animation-element {
		display: flex;
		position: fixed;
		width: 100%;
		height: 560rpx;
		bottom: 0;
		background-color: #fff;
		z-index: 100;
	}

	.animation-button {
		margin-top: 20rpx;
		top: 20rpx;
		width: 400rpx;
		height: 100rpx;
		line-height: 100rpx;
		align-items: center;
	}

	.animation-element text {
		display: inline-flex;
		position: fixed;
		margin-top: 20rpx;
		height: 50rpx;
		text-align: center;
		line-height: 50rpx;
		font-size: 34rpx;
		font-family: Arial, Helvetica, sans-serif;
	}

	.left-bt {
		left: 30rpx;
		color: #999;
	}

	.right-bt {
		right: 30rpx;
		color: #1aad19;
	}

	.line {
		display: block;
		position: fixed;
		height: 1rpx;
		width: 100%;
		margin-top: 89rpx;
		background-color: #eee;
	}

	page {
		background: #f8f8f7;
	}

	.teacher_matching .title {
		height: 80rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		position: absolute;
		top: 0;
		left: 0;
		background: #fff;
	}

	.teacher_matching .title .desc {
		font-size: 28rpx;
		margin-left: 20rpx;
		flex: 1;
	}

	.teacher_matching .title .see {
		font-size: 28rpx;
		color: #fc9023;
		margin-right: 20rpx;
	}

	.teacher_matching .top_img {
		width: 100%;
		height: 400rpx;
	}

	.teacher_matching .from_box {
		background: #fff;
		border-radius: 20rpx;
		z-index: 100;
		padding: 20rpx;
		box-sizing: border-box;
		position: absolute;
		top: 0rpx;
		width: 100%;
	}

	.teacher_matching .from_box .xin {
		color: red;
	}

	.teacher_matching .items {
		margin-top: 30rpx;
	}

	.teacher_matching .items .name {
		font-size: 30rpx;
		margin-bottom: 20rpx;
		font-weight: 700;
		color: #666;
	}

	.teacher_matching .items .inputval {
		font-size: 28rpx;
		border: 1rpx solid #999;
		height: 80rpx;
		border-radius: 10rpx;
		text-indent: 10rpx;
		line-height: 80rpx;
	}

	.addressName {
		height: 60rpx;
		display: inline-block;
		line-height: 60rpx;
	}

	.textarea {
		font-size: 28rpx;
		border: 1rpx solid #999;
		height: 100rpx;
		width: 100%;
		text-indent: 10rpx;
		border-radius: 10rpx;
	}

	.select_item {
		width: 150rpx;
	}

	.select_item,
	.select_item2 {
		height: 65rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1rpx solid #999;
		border-radius: 5rpx;
		font-size: 28rpx;
		margin-right: 20rpx;
		margin-bottom: 20rpx;
	}

	.select_item2 {
		padding: 0 20rpx;
	}

	.item_box {
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
	}

	.select_item_color {
		border: 1rpx solid #fc9023;
		color: #fc9023;
	}

	.animation-button {
		height: 80rpx;
		width: 100%;
		border: 1px solid #666;
	}

	.yuyuepicker {
		width: 100%;
		line-height: 80rpx;
	}

	.student-type,
	.yuyuepicker {
		height: 80rpx;
		border: 1px solid #999;
		border-radius: 10rpx;
		font-size: 26rpx;
		text-indent: 10rpx;
	}

	.btn_submit {
		height: 80rpx;
		margin: 20rpx auto;
		background: linear-gradient(90deg, #eca33d, #f1b833);
		color: #41210d;
		letter-spacing: 35rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 30rpx;
		width: 80%;
		border-radius: 10rpx;
		font-weight: 600;
	}

	.tip {
		font-size: 26rpx;
		color: #f39c45;
	}

	.last_tip {
		margin: 30rpx 0;
		font-size: 28rpx;
		color: #f39c45;
		align-items: center;
		padding: 20rpx;
		justify-content: center;
		text-align: center;
	}

	.all_money_box,
	.last_tip {
		display: flex;
		background: #fff;
	}

	.all_money_box {
		flex-direction: column;
		margin-top: 100rpx;
	}

	.all_money_box .name {
		height: 60rpx;
		width: 100%;
		font-size: 28rpx;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.all_money_box .name .redColor {
		font-size: 30rpx;
		font-weight: 600;
		color: red;
		margin: 0 10rpx;
	}

	.all_money_box .tip {
		font-size: 28rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #f39c45;
		padding-bottom: 20rpx;
	}

	.zw {
		height: 60rpx;
		width: 100%;
	}

	.mast_start {
		width: 20rpx;
		height: 20rpx;
	}

	.martop {
		margin-top: 10rpx;
	}

	page {
		background: #f8f8f7;
	}

	.comment_style {
		border-radius: 5rpx;
	}

	.comment_style .set {
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

	.comment_style .objTimebox {
		display: flex;
		flex-direction: column;
	}

	.comment_style .objCul {
		display: flex;
		height: 60rpx;
		align-items: center;
		justify-content: center;
		flex-direction: row;
		border: 1rpx solid #ccc;
	}

	.comment_style .cul {
		display: flex;
		flex-direction: column;
		border: 1rpx solid #ccc;
		border-radius: 8rpx;
	}

	.comment_style .border-top {
		border-top: none;
	}

	.comment_style .item {
		font-size: 28rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 15%;
		border-right: 1rpx solid #dbdbdb;
	}

	.comment_style .yellbg {
		background: #f0b732;
		border-right: 1rpx solid #f0b732;
	}

	.comment_style .time_title {
		display: flex;
		flex-direction: row;
		font-size: 26rpx;
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
		font-size: 26rpx;
		padding: 0 20rpx;
		box-sizing: border-box;
		background: #fff;
		border-bottom: 1rpx solid #ccc;
	}

	.comment_style .picker {
		height: 50rpx;
		width: 20%;
		text-align: center;
		line-height: 50rpx;
		font-size: 26rpx;
		z-index: 1000;
	}

	.comment_style .item_box {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: center;
		border-bottom: 1rpx solid #dbdbdb;
		padding: 20rpx 0;
	}

	.comment_style .cTime {
		font-size: 24rpx;
		margin-left: 30rpx;
	}

	.comment_style .submit {
		margin: 100rpx auto 0;
		width: 80%;
		border-radius: 6rpx;
		height: 80rpx;
		font-size: 28rpx;
		text-align: center;
		line-height: 80rpx;
		color: #41210d;
		letter-spacing: 30rpx;
		background: linear-gradient(90deg, #eca33d, #f1b833);
	}

	.mapModal {
		position: fixed;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, .5);
		top: 0;
		left: 0;
		z-index: 10000;
	}

	.picker-box {
		display: flex;
		flex-wrap: nowrap;
		width: 100%;
	}

	.kmPicker-item {
		flex: 1;
	}

	.mar {
		margin-right: 20rpx;
	}

	.kmPicker {
		flex: 1;
		height: 52rpx;
		border: 2rpx solid #999;
		border-radius: 10rpx;
		margin-top: 25rpx;
		font-size: 30rpx;
		text-indent: 20rpx;
		line-height: 52rpx;
		color: #333;
	}
</style>
