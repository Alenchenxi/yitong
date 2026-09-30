<template>
	<!-- <import src="../../components/three-select/three-select.wxml"></import> -->
	<view class="teacher-matchV2">
		<view class="top">
			<view class="stap-box">
				<image class="stap1" src="/static/images/1.png" v-if="activeTab==1"></image>
				<image class="stap1" src="/static/images/2.png" v-if="activeTab==2"></image>
				<image class="stap1" src="/static/images/3.png" v-if="activeTab==3"></image>
				<image class="stap1" src="/static/images/4.png" v-if="activeTab==4"></image>
				<image class="stap1" src="/static/images/5.png" v-if="activeTab==5"></image>
			</view>
		</view>
		<view class="content-box" v-if="activeTab==1">
			<view class="content-tip">*注意事项:填写完信息才能下一步</view>
			<view class="input-item item-input-bottom">
				<input v-model="name1" class="name" placeholder="请输入姓名" type="text"></input>
			</view>
			<view class="input-item item-input-bottom">
				<input v-model="phone" class="phone" maxlength="11" placeholder="请输入联系方式" type="number"></input>
				<view class="phoneTip">*请核对好手机号</view>
			</view>
			<view class="input-item item-input-bottom">
				<input v-model="wxid" class="phone" maxlength="64" placeholder="请输入微信号" type="text"></input>
				<view class="hide_mobile">
					<u-switch v-model="hideMobile"></u-switch>
					<view class="hide_mobile_tip">开启后用户只能通过微信联系</view>
				</view>
				<view v-if="hideMobile" class="phoneTip">*请核对好微信号</view>
			</view>
			<view class="input-item item-input-bottom">
				<input v-model="mail" class="phone" placeholder="请输入邮箱地址" type="text"></input>
				<view class="phoneTip">请核对好邮箱地址</view>
			</view>
			<view class="input-item item-input-bottom">
				<view class="item-title">授课方式</view>
				<picker @change="bindTeaching" class="picker" :range="teachingArr">
					<view class="picker">
						<text class="addressName">{{teachingArr[teachingindex]}}</text>
					</view>
				</picker>
				<image class="jtIcon" src="/static/images/link-icon.png"></image>
			</view>
			<view class="input-item item-input-bottom">
				<view class="item-title">城市/区域</view>
				<picker @change="bindregions" class="picker" mode="region">
					<view class="picker">
						<text class="addressName">{{bindregion}}</text>
					</view>
				</picker>
				<image class="jtIcon" src="/static/images/link-icon.png"></image>
			</view>
			<view class="input-item item-input-bottom">
				<input v-model="address" class="address" placeholder="详细授课地址（如街道/小区/门牌号等）" type="text"></input>
			</view>
			<view class="input-item item-input-bottom" @click="openAddress">
				<input :disabled="true" class="address" placeholder="授课地址定位" v-model="latAddress" type="text"></input>
			</view>
		</view>
		<view class="content-box" v-if="activeTab==2">
			<view class="content-tip">*注意事项:填写完信息才能下一步</view>
			<view class="tab2-item-box">
				<view class="tab2-title">在读学校</view>
				<input maxlength="15" placeholder="请填写在读学校" type="text" v-model="school"></input>
			</view>
			<view class="tab2-item-box">
				<view class="tab2-title">学生性别</view>
				<view class="sel-item-box">
					<view @click="selsctStudentSex(index)" class="sel-item"
						:class="[item.isSel==1?'sel-active-bg':'',(index+1)%3!=0?'sel-item-mar':'']"
						v-for="(item,index) in sex" :key="index">
						{{item.name}}
					</view>
				</view>
			</view>
			<view class="tab2-item-box">
				<view class="tab2-title">学生基本情况</view>
				<input v-model="studentInput" placeholder="请填写学生基本情况"></input>
			</view>
			<view class="tab2-item-box">
				<view class="tab2-title">辅导科目(选择多科目后会生成多条发布)</view>
				<view class="course_list">
					<view v-for="(o,i) in course_list" :key="i" class="course_item">
						<view class="course_flex">
							<view class="course_label">科目</view>
							<view class="course_tag"><u-tag mode="plain" type="primary" :text="`${o.courseName}`" closeable @close="course_list.splice(i,1)"></u-tag></view>
						</view>
						<view class="course_flex">
							<view class="course_label">课时费</view>
							<view class="course_fee"><u-input v-model="course_list[i].price" type="text" :border="true" placeholder="课时费(元/时,元/天,元/周,元/月)" :maxlength="50" height="80rpx" style="height: 460rpx;" /></view>
						</view>
					</view>
					<view v-if="course_list.length < 4" class="course_add">
						<u-input v-model="course_list[i].ui_value" class="course_add_input" type="select" border="true" @click="coursePickerShow = true" placeholder="点击选择科目(可选1-4科)" height="60rpx" />
						<u-select v-model="coursePickerShow" mode="mutil-column-auto" :list="categoryCacadeList" label-name="label" value-name="value" child-name="children" @confirm="onCourseConfirm"></u-select>
					</view>
				</view>
			</view>
			<view style="height: 40rpx;"></view>
		</view>
		<view class="content-box" v-if="activeTab==3">
			<view class="content-tip">*注意事项:填写完信息才能下一步</view>
			<view class="tab2-item-box">
				<view class="tab2-title">上课时间</view>
				<view style="height: 30rpx;"></view>
				<view class="comment_style time_detail">
					<view class="objTimebox">
						<view class="objCul" style="border-radius: 10rpx 10rpx 0 0;">
							<view class="item itemBorder">每周一</view>
							<view class="item itemBorder">每周二</view>
							<view class="item itemBorder">每周三</view>
							<view class="item itemBorder">每周四</view>
							<view class="item itemBorder">每周五</view>
							<view class="item itemBorder">每周六</view>
							<view class="item">每周日</view>
						</view>
						<view class="objCul border-top" style="border-radius: 0 0 10rpx 10rpx;">
							<view @click="selectDate(index)" class="itemData"
								:class="[item.isSel?'yellbg':'',(index+1)!=selArr.length?'itemBorder':'']"
								v-for="(item,index) in selArr" :key="index"></view>
						</view>
					</view>
					<view class="time_title">
						<view class="title_item2 title_item2-border">星期</view>
						<view class="title_item2 title_item2-border">开始时间</view>
						<view class="title_item2">结束时间</view>
					</view>
					<view :class="index+1==tTiems.length?'borderyj':''" class="dateDetail"
						v-for="(item,index) in tTiems" :key="index">
						<view class="title_item2 title_item2-border">{{item.week}}</view>
						<picker @change="bindTimeChange($event,item)" class="title_item2 title_item2-border" end=""
							mode="time" start="">
							<view>{{item.start_time}}</view>
						</picker>
						<picker @change="bindTimeChange1($event,item)" class="title_item2" end="" mode="time" start="">
							<view>{{item.end_time}}</view>
						</picker>
					</view>
					<view style="height: 30rpx;"></view>
				</view>
			</view>
		</view>
		<view class="content-box" v-if="activeTab==4">
			<view class="content-tip">*注意事项:填写完信息才能下一步</view>
			<view class="tab2-item-box">
				<view class="tab2-title">老师性别</view>
				<view class="sel-item-box">
					<view @click="selsctTeacherSex(index)" class="sel-item"
						:class="[item.isSel==1?'sel-active-bg':'',(index+1)%3!=0?'sel-item-mar':'']"
						v-for="(item,index) in teacherSex" :key="index">{{item.name}}</view>
				</view>
			</view>
			<view class="tab2-item-box">
				<view class="tab2-title">老师类型</view>
				<view class="sel-item-box">
					<view @click="selsctTeacherType(index)" class="sel-item"
						:class="[item.isSel==1?'sel-active-bg':'',(index+1)%3!=0?'sel-item-mar':'']"
						v-for="(item,index) in teacherType" :key="index">
						{{item.name}}
					</view>
				</view>
			</view>
			<view class="tab2-item-box">
				<view class="tab2-title">对老师的其他要求</view>
				<view class="sel-item-box">
					<view @click="selsctTeacheryaoqiu(index)" class="sel-item"
						:class="[item.isSel==1?'sel-active-bg':'',(index+1)%3!=0?'sel-item-mar':'']"
						v-for="(item,index) in yaoqiuArr" :key="index">{{item.name}}</view>
				</view>
				<input v-model="yaoqiuInput" placeholder="请填写对老师的其他要求" type="text"></input>
			</view>
			<view style="height: 40rpx;"></view>
		</view>
		<view class="content-box" v-if="activeTab==5">
			<view class="tab5-item">
				<view class="tab5-title">姓名</view>
				<view class="tab5-val">{{name1}}</view>
			</view>
			<view class="tab5-item">
				<view class="tab5-title">联系方式</view>
				<view class="tab5-val">{{phone}}</view>
			</view>
			<view class="tab5-item">
				<view class="tab5-title">邮箱地址</view>
				<view class="tab5-val">{{mail}}</view>
			</view>
			<view class="tab5-item">
				<view class="tab5-title">授课方式</view>
				<view class="tab5-val">{{teachingArr[teachingindex]}}</view>
			</view>
			<view class="tab5-item">
				<view class="tab5-title">城市/区域</view>
				<view class="tab5-val">{{bindregion}}</view>
			</view>
			<view class="tab5-item">
				<view class="tab5-title">教师授课详细地址</view>
				<view class="tab5-val">{{address}}</view>
			</view>
			<view class="tab5-item">
				<view class="tab5-title">在读学校</view>
				<view class="tab5-val">{{school}}</view>
			</view>
			<view class="tab5-item" v-for="(o,i) in course_list" :key="i">
				<view class="tab5-title">辅导科目{{i+1}}</view>
				<view class="tab5-val">
					<view>{{o.courseName}}</view>
					<view>{{o.price}}</view>
				</view>
			</view>
			<view class="tab5-item">
				<view class="tab5-title">学生性别</view>
				<view class="tab5-val" v-if="sexNumber==1">男</view>
				<view class="tab5-val" v-else>女</view>
			</view>
			<view class="tab5-item">
				<view class="tab5-title">学生基本情况</view>
				<view class="tab5-val">{{studentInput}}</view>
			</view>
			<view class="tab5-item">
				<view class="tab5-title">上课时间</view>
				<view class="val-box">
					<view :key="index" class="tab5-val" v-for="(item,index) in tTiems">{{item.week}}
						{{item.start_time}}~{{item.end_time}}
					</view>
				</view>
			</view>
			<view class="tab5-item">
				<view class="tab5-title">老师性别</view>
				<view class="tab5-val">{{teacherSexCon}}</view>
			</view>
			<view class="tab5-item">
				<view class="tab5-title">老师类型</view>
				<view class="tab5-val">{{teacherTypeCon}}</view>
			</view>
			<view class="tab5-item">
				<view class="tab5-title">对老师的其他要求</view>
				<view class="tab5-val">{{yaoqiuArrCon}}{{yaoqiuInput}}</view>
			</view>
			<view class=""
				style="display: flex;align-items: center;width: 100%;justify-content: center;margin-top: 30rpx;">
				<image @click="check=true" v-if="!check"
					style="width: 40rpx;height: 40rpx;border-radius: 50%;margin-right: 20rpx;"
					src="/static/images/check.png" mode="">
				</image>
				<image @click="check=false" v-else
					style="width: 40rpx;height: 40rpx;border-radius: 50%;margin-right: 20rpx;"
					src="/static/images/checked.png" mode="">
				</image>
				<text @click="check=!check">阅读并同意</text>
				<text @click="toConvention" style="color:#f8c400 ;">
					《发布协议》
				</text>
			</view>
			<view style="height: 40rpx;"></view>
		</view>

		<view class="zw-box" v-if="activeTab==5"></view>
		<view class="zw-box2" style="height: 90vh;" v-if="activeTab==3||activeTab==4"></view>
		<view class="btn-box" v-if="activeTab<5">
			<view @click="tabClick" class="btn-one">下一步</view>
		</view>
		<view class="btn-box" v-if="activeTab>1">
			<view @click="backTab" class="to-btn-one">上一步</view>
			<view @click="subInfo" class="next-btn-one" v-if="activeTab==5">提交</view>
			<view @click="tabClick" class="next-btn-one" v-else>下一步</view>
		</view>
	</view>

</template>

<script>
	import { getCategoryCascadeList } from '@/comm/api_common.js'
	export default {
		data() {
			return {
				mail: '',
				name1: "",
				phone: '',
				teachingArr: ['上门授课', '在线授课', '均可'],
				teachingindex: '',
				//地址
				bindregion: '',
				bindregionArr: '',
				address: '',
				school: '',
				categoryCacadeList: [],
				course_list: [], //选择的课程列表
				coursePickerShow: false,
				sexNumber: '',
				tTiems: [],
				studentInput: '',
				yaoqiuInput: '',
				teacherSexCon: '',
				teacherTypeCon: '',
				yaoqiuArrCon: '',
				//老师上课时间
				//时间选择
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
				sex: [{
					name: '男',
					isSel: 0
				}, {
					name: '女',
					isSel: 0
				}],
				check: false,
				multiIndex: [],
				multiArray: [
					['03月01日'],
					['9:00', '10:00']
				],
				teacherSex: [{
					name: '男老师',
					isSel: 0
				}, {
					name: '女老师',
					isSel: 0
				}, {
					name: '男女均可',
					isSel: 0
				}],
				teacherType: [{
					name: '大学生教员',
					isSel: 0
				}, {
					name: '专业教员',
					isSel: 0
				}, {
					name: '均可',
					isSel: 0
				}],
				yaoqiuArr: [{
					name: '幽默',
					isSel: 0
				}, {
					name: '严厉',
					isSel: 0
				}, {
					name: '亲切',
					isSel: 0
				}, {
					name: '负责',
					isSel: 0
				}, {
					name: '准时',
					isSel: 0
				}, {
					name: '基础扎实',
					isSel: 0
				}],
				jigouArr: [{
					name: '微信公众号',
					isSel: 0
				}, {
					name: '微博',
					isSel: 0
				}, {
					name: '百度',
					isSel: 0
				}, {
					name: '淘宝',
					isSel: 0
				}, {
					name: '朋友推荐',
					isSel: 0
				}, {
					name: '大众点评/美团',
					isSel: 0
				}],
				activeTab: 1,
				fjAddress: "",
				latlon: "",
				firstBtn: true,

				lat: "",
				lon: "",
				isPost: false,
				jigouInput: "",
				grade: "",
				shen: "",
				shi: "",
				qv: "",
				culture: "",
				subject: "",
				latitude: '',
				longitude: '',
				latAddress: '',
				wxid: '',
				hideMobile: false,
				loading: false
			}
		},
		onLoad(options) {
			this.getCategoryList()
			if (options.item) {
				var item = JSON.parse(decodeURIComponent(options.item))
				this.name1 = item.name
				this.phone = item.mobile
				this.mail = item.mail
				this.teachingindex = item.teaching_way * 1 - 1
				this.bindregion = item.province + item.city + item.area
				this.bindregionArr = [item.province, item.city, item.area]
				this.address = item.address
				this.school = item.school
				this.sexNumber = item.gender
				this.sex[(item.gender == 1 ? 0 : 1)].isSel = 1
				this.studentInput = item.gai_kuang
				this.teacherSex[item.teacher_gender * 1 - 1].isSel = 1
				this.teacherSexCon = this.teacherSex[item.teacher_gender * 1 - 1].name
				this.teacherType[item.teacher_identity * 1 - 1].isSel = 1
				this.teacherTypeCon = this.teacherType[item.teacher_identity * 1 - 1].name
				this.yaoqiuInput = item.teacher_require
			}
		},
		onShow() {

		},
		methods: {
			onCourseConfirm(e){
				const category_id = e[0].value
				const category_name = e[0].label
				const grade_id = e[1].value
				const grade_name = e[1].label
				const subject_id = e[2].value
				const subject_name = e[2].label
				const keyid = `${category_id}_${grade_id}_${subject_id}`
				const exists = this.course_list.some(item => item.keyid === keyid)
				if(exists){
					return;
				}
				if(this.course_list.length >= 4){
					uni.showToast({
						icon:'none',
						title: '最多选择4门科目'
					})
				}
				const data = {keyid: keyid, category_id: category_id, category_name: category_name, subject_id: subject_id, subject_name: subject_name, 
					grade_id: grade_id, grade_name: grade_name, courseName: `${category_name}_${subject_name}-${grade_name}`, price: ''}
				this.course_list.push(data)
				this.coursePickerShow = false
			},
			toConvention() {
				uni.navigateTo({
					url: '/my/convention/convention'
				})
			},
			openAddress() {
				console.log(">>>>>>>>>>>>>>>>>>>>>>>>>")
				console.log("点击")
				let that = this
				uni.getSetting({
					success(res) {
						console.log("获取设置成功")
						console.log(res.authSetting)
						if (res.authSetting['scope.userLocation'] === true) {
							console.log("权限存在")
							uni.chooseLocation({
								success(e) {
									that.latitude = e.latitude
									that.longitude = e.longitude
									that.latAddress = e.name
									console.log(">>>>>>>>>>>>>>>>>>>>>>>>>")
								},
								fail(err) {
									console.log("失败")
									console.log(err)

								}

							})
						} else {
							console.log("权限不存在")
							that.auth()
							console.log(">>>>>>>>>>>>>>>>>>>>>>>>>")
						}
					}
				})


			},
			auth() {
				uni.openSetting({
					success(res) {
						if (res.authSetting['scope.userLocation']) {
							uni.showToast({
								title: '授权成功！',
								icon: "none"
							})
						} else {
							uni.showToast({
								title: '拒绝授权将无法获取地理位置！',
								icon: "none"
							})
						}
					}
				})
			},
			subInfo() {
				if (!this.check) {
					uni.showToast({
						title: '请同意协议',
						icon: "none"
					})
					return
				}
				if (!uni.getStorageSync('token')) {
					uni.navigateTo({
						url: '/my/getPhone/getPhone'
					})
					return
				}
				let teacherSexNum = 0
				let teacherTypeNum = 0
				switch (this.teacherSexCon) {
					case '男老师':
						teacherSexNum = 1
						break;
					case '女老师':
						teacherSexNum = 2
						break;
					case '男女均可':
						teacherSexNum = 3
						break;
				}
				switch (this.teacherTypeCon) {
					case '大学生教员':
						teacherTypeNum = 1
						break;
					case '专业教员':
						teacherTypeNum = 2
						break;
					case '均可':
						teacherTypeNum = 3
						break;
				}
				let data = {
					name: this.name1,
					mobile: this.phone,
					teaching_way: this.teachingindex * 1 + 1,
					gender: this.sexNumber,
					school: this.school,
					latitude: this.latitude,
					longitude: this.longitude,
					gai_kuang: this.studentInput || '',
					province: this.bindregionArr[0],
					city: this.bindregionArr[1],
					area: this.bindregionArr[2],
					address: this.address,
					teacher_gender: teacherSexNum,
					teacher_identity: teacherTypeNum,
					teacher_require: this.yaoqiuArrCon + '' + this.yaoqiuInput,
					schooltime_json: JSON.stringify(this.tTiems),
					mail: this.mail,
					course_list_json: JSON.stringify(this.course_list),
					wx_id: this.wxid,
					hide_mobile: this.hideMobile,
				}
				if(this.loading){
					return
				}
				this.loading = true
				this.api('/user/studentsRelease', 'post', data).then(res => {
					if (res.status == 200) {
						uni.showToast({
							title: '您已注册成功。我们客服会在工作时间内联系您! 感恩您对我们献新的信任!',
							icon: 'none',
							duration: 1000,
						})
						setTimeout(() => {
							uni.switchTab({
								url: '/pages/my/my'
							})
						}, 1000)
					}else{
						uni.showToast({
							title: res.msg,
							icon: 'none',
							duration: 1000,
						})
					}
				}).finally(()=> {
					this.loading = false
				})
			},
			getCategoryList() {
				getCategoryCascadeList().then(res => {
					this.categoryCacadeList = res.data
				})
			},
			bindTeaching(e) {
				this.teachingindex = e.detail.value
			},
			bindregions(e) {
				console.log(e)
				this.bindregion = e.detail.value.join(' ')
				this.bindregionArr = e.detail.value
			},
			selsctjigou(index) {
				this.jigouArr.forEach(item => {
					item.isSel = 0
				})
				this.jigouArr[index].isSel = 1
			},
			selsctTeacheryaoqiu(index) {
				let yaoqiuArrCon = ''
				this.yaoqiuArr[index].isSel == 1 ? this.yaoqiuArr[index].isSel = 0 : this.yaoqiuArr[index].isSel =
					1
				this.yaoqiuArr.forEach(item => {
					if (item.isSel) {
						yaoqiuArrCon += item.name
					}
				})
				this.yaoqiuArrCon = yaoqiuArrCon
			},
			selsctTeacherSex(index) {
				this.teacherSex.forEach(item => {
					item.isSel = 0
				})
				this.teacherSex[index].isSel = 1
				this.teacherSexCon = this.teacherSex[index].name
			},
			selsctTeacherType(index) {
				this.teacherType.forEach(item => {
					item.isSel = 0
				})
				this.teacherType[index].isSel = 1
				this.teacherTypeCon = this.teacherType[index].name
			},
			bindTimeChange(e, item) {
				item.start_time = e.detail.value
				// item.end_time = e.detail.value.split(':')[0] * 1 + 1 + ':' + e.detail.value.split(':')[1]
			},
			bindTimeChange1(e, item) {
				item.end_time = e.detail.value
				// item.end_time = e.detail.value.split(':')[0] * 1 + 1 + ':' + e.detail.value.split(':')[1]
			},
			selectDate(index) {
				this.selArr[index].isSel = !this.selArr[index].isSel
				if (this.selArr[index].isSel) {
					this.tTiems.push({
						week: this.selArr[index].time,
						start_time: '9:00',
						end_time: '10:00'
					})
				} else {
					this.tTiems.forEach((item, index1) => {
						if (item.week == this.selArr[index].time) {
							this.tTiems.splice(index1, 1)
						}
					})
				}
			},
			selsctStudentSex(index) {
				this.sex.forEach(item => {
					item.isSel = 0
				})
				this.sexNumber = (index == 0 ? '1' : '2')
				this.sex[index].isSel = 1
			},
			tabClick() {
				if (this.activeTab == 1) {
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
					if (this.teachingindex === '') {
						uni.showToast({
							title: '请选择授课方式',
							icon: 'none'
						})
						return
					}
					if (!this.bindregionArr) {
						uni.showToast({
							title: '请选择城市/区域',
							icon: 'none'
						})
						return
					}
					if (!this.address) {
						uni.showToast({
							title: '请填写详细地址',
							icon: 'none'
						})
						return
					}
					if (!this.latAddress) {
						uni.showToast({
							title: '请选择授课地址定位',
							icon: "none"
						})
						return
					}
					if (this.hideMobile && !this.wxid) {
						uni.showToast({
							title: '请输入微信号',
							icon: "none"
						})
						return
					}
				}
				if (this.activeTab == 2) {
					if (!this.school) {
						uni.showToast({
							title: '请填写在读学校',
							icon: 'none'
						})
						return
					}
					if(this.course_list.length == 0){
						uni.showToast({
							title: '请至少选择1门辅导科目',
							icon: 'none'
						})
						return
					}
					console.log('=====> course_list ', this.course_list)
					let allPrice = true
					for(var i in this.course_list){
						const _course = this.course_list[i]
						if(!_course.price || _course.price == ''){
							uni.showToast({
								title: `请填写${_course.subject_name}课时费`,
								icon: 'none'
							})
							allPrice = false
							break
						}
					}
					if(!allPrice){
						return
					}
					if (this.sexNumber === '') {
						uni.showToast({
							title: '请选择学生性别',
							icon: 'none'
						})
						return
					}
					if (!this.studentInput) {
						uni.showToast({
							title: '请填写学生基本情况',
							icon: 'none',
						})
						return
					}
				}
				if (this.activeTab == 3) {
					if (this.tTiems.length <= 0) {
						uni.showToast({
							title: '请选择上课时间',
							icon: 'none'
						})
						return
					}
				}
				if (this.activeTab == 4) {
					if (this.teacherSexCon === '') {
						uni.showToast({
							title: '请选择老师性别',
							icon: 'none'
						})
						return
					}
					if (this.teacherTypeCon === '') {
						uni.showToast({
							title: '请选择老师类型',
							icon: 'none'
						})
						return
					}
					if ((!this.yaoqiuArrCon) && (!this.yaoqiuInput)) {
						uni.showToast({
							title: '请选择对老师的要求',
							icon: 'none'
						})
						return
					}
				}
				++this.activeTab
			},
			backTab() {
				--this.activeTab
			},
		}
	}
</script>

<style scoped>
	@import "./divisions_old.css";
</style>
<style lang="less" scoped>
	@import "./divisions.less";
</style>