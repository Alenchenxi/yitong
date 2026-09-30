<template>
	<view>
		<view class="teacher_item">
			<view class="left">
				<image v-if="teacherInfo.head_img?teacherInfo.head_img.indexOf('http')==-1:''" class="teacher_pic"
					:src="url+teacherInfo.head_img">
				</image>
				<image v-else class="teacher_pic" :src="teacherInfo.head_img">
				</image>
			</view>
			<view class="right">
				<view class="desc_item">
					<view class="desc_name teacherName">{{teacherInfo.name}}</view>
					<view class="desc_name flex1">
						<text class="yellowbg" v-if="teacherInfo.teacher_identity==1">大学生教员</text>
						<text class="yellowbg" v-if="teacherInfo.teacher_identity==2">专业教员</text>
						<text class="yellowbg" v-if="teacherInfo.teacher_identity==3">大学生教员/专业教员</text>
					</view>

					<view class="">
						{{teacherInfo.teaching_subject[0].grade_name}}/{{ teacherInfo.teaching_subject[0].subject_name}}
					</view>
				</view>
				<view class="desc_item">

					<view class="desc_name">教龄{{teacherInfo.teaching_age}}年</view>
					<!-- <view class="desc_name">已授课时12</view> -->
					<view class="desc_price">￥{{teacherInfo.salary}}/起</view>
				</view>
				<view class="desc_item">
					<view class="tipName" v-for="(item,index) in teacherInfo.label" :key="index">{{item}}</view>

				</view>
			</view>
		</view>
		<view class="address_select_item">
			<view class="name">上课地址:</view>
			<view class="edit_address">
				<view class="item">
					<view class="name">联 系 人：</view>
					<input class="input" placeholder="请输入姓名（必填）" v-model="addressName"></input>
				</view>
				<view class="item">
					<view class="name">手 机 号：</view>
					<input class="input" placeholder="请输入手机号（必填）" maxlength="11" type="number"
						v-model="addressPhone"></input>
				</view>
				<view class="item2">
					<picker @change="bindRegionChange($event)" mode="region">
						<view class="addressPicker">
							<text class="name">当前选择：</text>
							<text class="colors">{{adderss}}</text>
						</view>
					</picker>
				</view>
				<view class="item">
					<view class="name">详细地址：</view>
					<textarea autoHeight="true" class="textarea" placeholder="如道路、门牌号、小区、楼栋号等"
						placeholderClass="placeholder" v-model="addressInfo"></textarea>
				</view>
			</view>
		</view>

		<view class="select_item">
			<view class="name">选择年级:</view>
			<view class="techer-obj-box">
				<view @click="selectObj(item,index)" class="techer-obj" :class="[item.isSel==1?'selObjColor':'']"
					v-for="(item,index) in teacherInfo.teaching_subject" :key="index" v-if="item.grade_name">
					<view class="obj" v-if="item.is_main==1">主教</view>
					<view class="obj" v-else>辅教</view>
					<view class="time">{{item.grade_name}}-{{item.subject_name}}</view>
					<view class="obj red">￥{{item.price}}</view>
				</view>
			</view>
		</view>
		<view class="time_detail">
			<view class="time_box">
				<view class="name">购买课时:</view>
				<picker @change="changeTime" class="picker_box" :range="timearray" range-key="name">
					<view class="picker">
						{{timearray[timeName].value}}次
						<image class="pull_down" src="/static/images/pull-down.png"></image>
					</view>
				</picker>
			</view>
			<view class="tip">一次课2小时，中间休息5~10分钟</view>
		</view>
		<view class="time_detail" v-if="type==1">
			<view class="time_box">
				<view class="name">套餐优惠:</view>
			</view>
			<view class="time_box">
				<view class="yhlist">200课时 <view class="zhe">9.2折</view>
				</view>
				<view class="yhlist">100课时 <view class="zhe">9.5折</view>
				</view>
				<view class="yhlist">40课时 <view class="zhe">9.8折</view>
				</view>
			</view>
		</view>
		<view class="comment_style time_detail">
			<view class="objTimebox">
				<view class="objCul">
					<view class="item">周一</view>
					<view class="item">周二</view>
					<view class="item">周三</view>
					<view class="item">周四</view>
					<view class="item">周五</view>
					<view class="item">周六</view>
					<view class="item">周日</view>
				</view>
				<view class="objCul border-top">
					<view @click="selectDate(index)" class="itemData" :class="item.isSel?'yellbg':''"
						v-for="(item,index) in selArr" :key="index">{{item.isHaveTime?'':'忙'}}</view>
				</view>
			</view>
			<view class="time_title">
				<view class="title_item2">星期</view>
				<view class="title_item2">开始时间</view>
				<view class="title_item2">结束时间</view>
			</view>
			<view class="dateDetail" v-for="(item,index) in tTiems" :key="index">
				<view class="title_item2">{{item.week}}</view>
				<picker @change="bindTimeChange($event,item)" disabled="true" class="title_item2" end="19:00"
					mode="time" start="9:00">
					<view>{{item.start_time}}</view>
				</picker>
				<picker class="title_item2" disabled="true" end="" mode="time" start="">
					<view>{{item.end_time}}</view>
				</picker>
			</view>
		</view>
		<!-- 	<view class="time_detail">
			<view class="time_box">
				<view class="name">优惠券:</view>
			</view>
			<view @click="showCouponBox" class="couponAddress">
				<view class="address-left">
					<text class="addressT">{{couponName}}元</text>
				</view>
				<view class="address-right">
					<image src="/static/images/link-icon.png"></image>
				</view>
			</view>
		</view> -->
		<view class="all_money_box">
			<view class="name">共计<text class="redColor">{{timearray[timeName].value*2}}</text>小时</view>
			<view class="name">共金额<text class="redColor">￥{{allMoney}}</text>
			</view>
			<view class="tip">课时费可以随时退，请放心购买</view>
		</view>

		<view class="last_tip">因城市差异、路程路况、科目难易程度、家长要求高低等因素影响，价格可能会有些许浮动，浮动幅度不大，专属助教会与您跟进协商。</view>
		<view class="" style="display: flex;align-items: center;width: 100%;justify-content: center;">
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
				《购买课程协议》
			</text>
		</view>
		<view @click="showXieyi" class="payMoney">立即支付</view>
		<view class="zw"></view>
		<!-- 	<view class="payxieyi" v-if="isShowXieyi">
			<view class="content_box">
				<view class="content">
					<view>尊敬的家长学生：</view>
					<view>旭日已对老师的身份证、学生证/毕业证、教师资格<text class="strong">证进行审查，确保老师真实性</text>。根据旭日《服务协议》及相关准则，<text
							class="strong">旭日声明提示如下：</text>
					</view>
					<view class="select_box">
						<view>旭日给予您以下提醒，请您认真阅读并勾选确认</view>
						<view @click="checkboxChange" v-for="(item,index) in xieyisel" :key="index">
							<checkbox :checked="item.checked"></checkbox>{{item.content}}
						</view>
					</view>
					<view>更多温馨建议：</view>
					<view>1.您应尽可能安排除老师与学生外,第三人易于查看、能接触、直接进入的非封闭式环境作为授课地点。</view>
					<view>2.您应让孩子了解自己身体的哪些部位是不允许他人碰触的,对于不当或不舒服的身体接触,要勇敢地说“不”</view>
					<view>3.您应在老师/学生上门授课期间,提醒孩子不要穿睡衣或者过分暴露,以日常装为主。</view>
					<view>4.您在异性家教老师授课结束后,应及时与孩子进行沟通,了解授课情况及老师行为,对于不当行为要让孩子明确表示拒绝。</view>
					<view>若您对于老师或老师授课过程中有任何疑问或投诉建议,您可随时拨打旭日家教的全国客服热线电话:158-1685-8015或联系旭日工作人员。</view>
					<view>若您同意该声明内容，请签署您的真实姓名</view>
					<view class="name_input">
						<input class="input" placeholder="请输入您的真实姓名字" v-model="orderPushName"> </input>
					</view>
				</view>
				<view class="btn_box">
					<view @click="toback" class="back_btn">返回</view>
					<button @click="submit" class="xie_sub_btn">同意并继续支付</button>
				</view>
			</view>
		</view> -->
		<view class="coupon_big_box" v-if="isShowCoupon">
			<view class="coupon_box">
				<view @click="selCoupon" class="coupon_item" v-for="(item,index) in couponArr" :key="index">
					<view class="select_icon">
						<image class="select_img" src="/static/images/ui_r37_c27.png" v-if="item.isSel==0"></image>
						<image class="select_img" src="/static/images/quan.png" v-if="item.isSel==1"></image>
					</view>
					<view class="right">
						<image class="img" src="/static/images/youhuijuan.png">
						</image>
						<view class="right_money">￥{{item.price}}</view>
					</view>
					<view class="left">
						<view class="money">{{item.price}}元</view>
						<view class="time color">仅限购课程，不支持兑现</view>
						<view class="time">有效期：{{item.startime}}~{{item.endtime}}</view>
					</view>
				</view>
				<view style=" height: 80rpx"></view>
				<view class="coupon_btngroup">
					<view @click="couponQx" class="coupon_btnitem qx">取消</view>
					<view @click="couponQd" class="coupon_btnitem qd">确定</view>
				</view>
			</view>
		</view>

	</view>
</template>

<script>
	export default {
		data() {
			return {
				check: false,
				province: "",
				city: "",
				area: "",
				tid: "",
				//老师的id
				ponenId: "",
				//老师的openId
				timeName: "0",
				level: "",
				grade: "",
				seniority: "",
				number: "",
				duration: "",
				project: "",
				timearray: [{
						name: '2小时/一课时',
						value: 1
					}, {
						name: '10小时/5课时',
						value: 5
					}, {
						name: '20小时/10课时',
						value: 10
					}, {
						name: '30小时/15课时',
						value: 15
					},
					{
						name: '40小时/20课时',
						value: 20
					},
					{
						name: '60小时/30课时',
						value: 30
					}
				],
				isShowTimeMask: true,
				type: "",
				//1是上门授课 2是团购  //在线授课
				name: "",
				//名字
				otherpro: [{
					type: '主教',
					nj: '初三',
					km: '语文',
					price: 123,
					isSel: 0,
				}, {
					type: '主教',
					nj: '初三',
					km: '语文',
					price: 123,
					isSel: 0,
				}, {
					type: '主教',
					nj: '初三',
					km: '语文',
					price: 123,
					isSel: 0,
				}],
				//年级
				image: "",
				//头像
				price: 0,
				//价格
				character: ['负责', '耐心', '因材施教'],
				//个性
				objName: "",
				//支付科目
				tmiecs: 40,
				//次数
				allMoney: 0,
				//总价格
				tTiems: [],
				//老师上课时间
				goTime: [],
				//上课时间
				tgTeacherPrice2: 0,
				//两人团购
				tgTeacherPrice3: 0,
				//三人团购
				tgPrice: 0,
				//团购在最终价格
				tgPrope: 2,
				//团购人数
				showAdd: true,
				// 没有地址显示默认 显示
				orderPushName: "",
				//家长真实姓名
				lesson: "",
				//课程
				//时间选择
				selArr: [{
					time: "周一",
					isSel: false,
					isHaveTime: false,
				}, {
					time: "周二",
					isSel: false,
					isHaveTime: false,
				}, {
					time: "周三",
					isSel: false,
					isHaveTime: false,
				}, {
					time: "周四",
					isSel: false,
					isHaveTime: false,
				}, {
					time: "周五",
					isSel: false,
					isHaveTime: false,
				}, {
					time: "周六",
					isSel: false,
					isHaveTime: false,
				}, {
					time: "周日",
					isSel: false,
					isHaveTime: false,
				}],
				detailTiem: [],
				xieyisel: [{
					id: 1,
					checked: false,
					content: "请您在老师/学生上门期间注意老师和学生的安全，避免发生肢体冲突行为"
				}, {
					id: 2,
					checked: false,
					content: "请您在老师/学生上门期间注意财产安全，避免产生经济纠纷"
				}, {
					id: 3,
					checked: false,
					content: "您知悉，监护人有监督和保护少年儿童的义务"
				}, {
					id: 4,
					checked: false,
					content: "您知悉，旭日仅作为家教平台，不对家长/学生/老师的人身及财产安全问题负责。"
				}],
				//地址输入
				addressName: "",
				addressPhone: "",
				infos: "",
				adderss: "上课地址（必选）",
				colors: "#888",
				isShowXieyi: false,
				//优惠券
				isShowCoupon: false,
				couponArr: [{
					price: '123'
				}, {
					price: '123'
				}, {
					price: '123'
				}],
				couponName: "选择优惠券",
				couponMoney: 0,
				couponId: "",
				laoshijiage: 0,
				teacherInfo: {},
				url: this.imgUrl,
				addressArr: '',
				addressInfo: '',
				tabIndex: ''
			}
		},
		onLoad(options) {
			console.log(options)
			this.tabIndex = options.tabIndex * 1 + 1
			this.teacherInfo = JSON.parse(decodeURIComponent(options.teacherInfo))
			console.log(JSON.parse(decodeURIComponent(options.teacherInfo)))
			this.selArr.forEach((item, index) => {
				this.teacherInfo.schooltime.forEach(item1 => {
					if (item.time == item1.week) {
						this.selArr[index].isHaveTime = true
					}
				})
			})
		},
		methods: {
			toConvention() {
				uni.navigateTo({
					url: '/my/convention/convention'
				})
			},
			changeTime(e) {
				this.timeName = e.detail.value
				let price = ''
				this.teacherInfo.teaching_subject.forEach(item => {
					if (item.isSel == 1) {
						price = item.price
					}
				})
				this.allMoney = (price * 1) * (this.timearray[this.timeName].value * 2)
			},
			showXieyi() {
				if (!uni.getStorageSync('token')) {
					uni.navigateTo({
						url: '/my/getPhone/getPhone'
					})
					return
				}
				if (!this.addressName) {
					uni.showToast({
						title: '请输入姓名',
						icon: "none"
					})
					return
				}
				if (!this.addressPhone) {
					uni.showToast({
						title: '请输入手机号',
						icon: "none"
					})
					return
				}
				if (!this.addressArr) {
					uni.showToast({
						title: '请选择地址',
						icon: "none"
					})
					return
				}
				if (!this.addressInfo) {
					uni.showToast({
						title: '请输入详细地址',
						icon: "none"
					})
					return
				}

				if (!this.teacherInfo.teaching_subject.some(item => {
						return item.isSel == 1
					})) {
					uni.showToast({
						title: '请选择年级',
						icon: "none"
					})
					return
				}
				if (this.tTiems.length <= 0) {
					uni.showToast({
						title: '请选择时间',
						icon: "none"
					})
					return
				}
				if (!this.check) {
					uni.showToast({
						title: '请同意协议',
						icon: "none"
					})
					return
				}
				let id = ''
				let weekId = ''
				this.teacherInfo.teaching_subject.forEach(item => {
					if (item.isSel == 1) {
						id = item.teaching_subject_id
					}
				})
				let ids = []
				this.tTiems.forEach(item => {
					ids.push(item.schooltime_id)
				})
				let data = {
					teacher_id: this.teacherInfo.teacher_id,
					teaching_way: this.tabIndex,
					linkman: this.addressName,
					mobile: this.addressPhone,
					province: this.addressArr[0],
					city: this.addressArr[1],
					area: this.addressArr[2],
					address: this.addressInfo,
					teaching_subject_id: id,
					hour: this.timearray[this.timeName].value,
					weeks: ids.join(',')
				}
				console.log(data)
				let that = this
				that.api('/order/createOrder', 'post', data).then(res => {
					console.log(res)
					// #ifdef MP-BAIDU
					that.api('/order/baiDuPay', 'post', {
						order_id: res.data
					}).then(res1 => {
						if (res1.status != 200) {
							uni.showToast({
								title: res1.msg,
								icon: "none"
							})
							return
						}
						uni.requestPayment({
							"orderInfo": res1.data,
							success(res2) {
								uni.showToast({
									title: '支付成功',
									icon: "none",
									duration: 1000
								})
								setTimeout(() => {
									uni.navigateBack()
								}, 1000)
							},
							fail() {
								uni.showToast({
									title: '支付失败',
									icon: 'none',
									duration: 1000
								})
							}
						})
					})
					// #endif
					// #ifdef MP-WEIXIN
					that.api('/order/wxPay', 'post', {
						order_id: res.data
					}).then(res1 => {
						if (res1.status != 200) {
							uni.showToast({
								title: res1.msg,
								icon: "none"
							})
							return
						}
						console.log(res1)

						uni.requestPayment({
							timeStamp: res1.data.timeStamp,
							nonceStr: res1.data.nonceStr,
							package: res1.data.package,
							signType: 'MD5',
							paySign: res1.data.paySign,
							success(res2) {
								uni.showToast({
									title: '支付成功',
									icon: 'success',
									duration: 1000
								})
								setTimeout(function() {
									uni.navigateBack()
								}, 1000);
							},
							fail(err) {
								uni.showToast({
									title: '支付失败',
									icon: 'none',
									duration: 1000
								})
							}
						})
					})
					// #endif
				})

			},
			bindTimeChange(e, item) {
				item.start_time = e.detail.value
				item.end_time = e.detail.value.split(':')[0] * 1 + 2 + ':' + e.detail.value.split(':')[1]
			},
			selectDate(index) {
				console.log(index)
				if (!this.selArr[index].isHaveTime) {
					return
				}
				this.selArr[index].isSel = !this.selArr[index].isSel
				if (this.selArr[index].isSel) {
					this.teacherInfo.schooltime.forEach(item => {
						if (this.selArr[index].time == item.week) {
							this.tTiems.push({
								week: this.selArr[index].time,
								start_time: item.start_time,
								end_time: item.end_time,
								schooltime_id: item.schooltime_id
							})
						}
					})

				} else {
					this.tTiems.forEach((item, index1) => {
						if (item.week == this.selArr[index].time) {
							this.tTiems.splice(index1, 1)
						}
					})
				}
			},
			showCouponBox() {
				this.isShowCoupon = true
			},
			couponQx() {
				this.isShowCoupon = false
			},
			bindRegionChange(e) {
				this.addressArr = e.detail.value
				this.adderss = e.detail.value.join(' ')
			},
			selectObj(item, index) {
				this.teacherInfo.teaching_subject.forEach(item => {

					this.$set(item, 'isSel', false)
				})
				this.teacherInfo.teaching_subject[index].isSel = true
				this.allMoney = (item.price * 1) * (this.timearray[this.timeName].value * 2)

			}
		}
	}
</script>

<style scoped>
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

	.select_item {
		padding: 0 20rpx;
	}

	.ddress_select_item,
	.select_item {
		display: flex;
		flex-direction: column;
		background: #fff;
		margin-bottom: 30rpx;
	}

	.address_select_item {
		background: #fff;
		padding: 0 20rpx;
		margin-bottom: 30rpx;
	}

	.address_select_item .name,
	.select_item .name {
		font-size: 30rpx;
		font-weight: 600;
		height: 60rpx;
		display: flex;
		align-items: center;
	}

	.select_item .name {
		border-bottom: 1rpx solid #f8f8f7;
	}

	.techer-obj-box {
		display: flex;
		flex-direction: row;
		justify-content: flex-start;
		margin-top: 10rpx;
		padding-bottom: 20rpx;
	}

	.techer-obj {
		display: flex;
		flex-direction: column;
		width: 33%;
		align-items: center;
	}

	.techer-obj .obj {
		font-size: 30rpx;
	}

	.techer-obj .time {
		margin-top: 40rpx;
		font-size: 30rpx;
	}

	.red {
		color: red;
	}

	.select_item .item_box {
		display: flex;
		font-size: 26rpx;
		margin: 20rpx 0;
		flex-wrap: wrap;
	}

	.select_item .item_box .item {
		margin-right: 30rpx;
		border: 1rpx solid #999;
		color: #999;
		border-radius: 6rpx;
		height: 60rpx;
		padding: 0 30rpx;
		text-align: center;
		line-height: 60rpx;
		margin-top: 20rpx;
	}

	.selObjColor {
		background-color: #f0b732;
		border-radius: 10rpx;
	}

	.tuan {
		margin-right: 30rpx;
		border: 4rpx solid #f0b732;
		border-radius: 6rpx;
		height: 60rpx;
		text-align: center;
		line-height: 60rpx;
		padding: 0 20rpx;
	}

	.time_box {
		display: flex;
		background: #fff;
		height: 80rpx;
		align-items: center;
	}

	.time_box .name {
		font-size: 28rpx;
		font-weight: 600;
		flex: 1;
	}

	.picker_box {
		width: 150rpx;
		text-align: center;
		height: 80rpx;
		line-height: 80rpx;
	}

	.picker {
		font-size: 26rpx;
		margin-right: 10rpx;
	}

	.time_box .pull_down {
		height: 15rpx;
		width: 20rpx;
	}

	.time_detail .tip {
		color: #f39c45;
		font-size: 24rpx;
		padding-bottom: 20rpx;
	}

	.time_detail {
		background: #fff;
		padding: 0 20rpx;
		margin-bottom: 30rpx;
	}

	.all_money_box {
		display: flex;
		flex-direction: column;
		background: #fff;
		margin-top: 40rpx;
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

	.time_detail .add_time_box {
		width: 60rpx;
		height: 60rpx;
		background: #f39c45;
		justify-content: center;
		color: #fff;
		border-radius: 6rpx;
	}

	.time_box .day,
	.time_detail .add_time_box {
		display: flex;
		align-items: center;
		font-size: 28rpx;
	}

	.time_box .day {
		flex: 1;
	}

	.time_box .time {
		flex: 1;
		font-size: 26rpx;
		justify-content: flex-end;
	}

	.time_box .time,
	.time_mask_box {
		display: flex;
		align-items: center;
	}

	.time_mask_box {
		background: rgba(0, 0, 0, .3);
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		justify-content: center;
		flex-direction: column;
	}

	.mask_item_box {
		width: 90%;
		height: 75%;
		background: #fff;
		border-radius: 10rpx;
		position: relative;
	}

	.mask_item_box .item_box {
		display: flex;
		font-size: 26rpx;
		margin: 20rpx 0 20rpx 10rpx;
		flex-wrap: wrap;
		padding: 10rpx 0 10rpx 10rpx;
		box-sizing: border-box;
	}

	.mask_item_box .item_box .item {
		margin-right: 30rpx;
		border: 1rpx solid #999;
		color: #999;
		border-radius: 6rpx;
		height: 60rpx;
		width: 130rpx;
		text-align: center;
		line-height: 60rpx;
		margin-top: 20rpx;
	}

	.selColor {
		background-color: #f0b732;
	}

	.bottom {
		display: flex;
		align-items: center;
		flex-direction: column;
	}

	.border {
		background: #ccc;
		height: 80rpx;
		width: 1rpx;
	}

	.guanbbi {
		width: 60rpx;
		height: 60rpx;
	}

	.agreeSelect {
		font-size: 28rpx;
		color: #fff;
		background: #f8c400;
		position: absolute;
		bottom: 40rpx;
		left: 5%;
		width: 90%;
	}

	.agreeSelect,
	.payMoney {
		height: 80rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 6rpx;
	}

	.payMoney {
		background: linear-gradient(90deg, #eca33d, #f1b833);
		color: #41210d;
		font-size: 34rpx;
		font-weight: 600;
		width: 80%;
		margin: 30rpx auto;
	}

	.all_money_box .tip {
		font-size: 28rpx;
		justify-content: center;
		color: #f39c45;
		padding-bottom: 20rpx;
	}

	.all_money_box .tip,
	.yhlist {
		display: flex;
		align-items: center;
	}

	.yhlist {
		border: 1rpx solid #db9e55;
		width: 180rpx;
		height: 60rpx;
		font-size: 26rpx;
		padding: 0 20rpx;
		border-radius: 6rpx;
		margin-right: 15rpx;
		margin-bottom: 30rpx;
	}

	.yhlist,
	.zhe {
		color: #db9e55;
	}

	.zhe {
		margin-left: 10rpx;
	}

	.zw {
		height: 60rpx;
		width: 100%;
	}

	.last_tip {
		margin: 30rpx 0;
		font-size: 28rpx;
		color: #f39c45;
		padding: 20rpx;
		justify-content: center;
		text-align: center;
	}

	.address,
	.last_tip {
		display: flex;
		align-items: center;
		background: #fff;
	}

	.address {
		width: 92%;
		padding: 10rpx 0;
	}

	.address,
	.couponAddress {
		justify-content: space-between;
	}

	.couponAddress {
		background: #f0b732;
		width: 90%;
		height: 60rpx;
		display: flex;
		align-items: center;
		padding: 0 30rpx;
		border-radius: 10rpx;
	}

	.address-left {
		width: 80%;
	}

	.address-right image,
	.item-right image {
		width: 18rpx;
		height: 32rpx;
	}

	.item-right text {
		font-size: 28rpx;
	}

	.item-right {
		text-align: right;
	}

	.item-right image {
		vertical-align: middle;
		margin-left: 20rpx;
	}

	.user-info {
		font-size: 30rpx;
		color: #000;
	}

	.user-info text {
		margin-right: 40rpx;
	}

	.user-adrr {
		margin-top: 15rpx;
		font-size: 26rpx;
		font-weight: 400;
		color: #666;
	}

	.addressT {
		color: #333;
		font-size: 30rpx;
	}

	.edit_address {
		display: flex;
		flex-direction: column;
		background: #eee;
	}

	.edit_address .item {
		display: flex;
		flex-direction: row;
		align-items: center;
		border-bottom: 1px solid #eee;
		background: #fff;
		padding: 10rpx;
	}

	.edit_address .name {
		font-size: 28rpx;
		color: #333;
		display: flex;
		align-items: center;
	}

	.edit_address .input {
		font-size: 28rpx;
		flex: 1;
		padding-left: 30rpx;
	}

	.edit_address .textarea {
		font-size: 28rpx;
		flex: 1;
		height: 52rpx;
		max-height: 100rpx;
		margin-left: 20rpx;
	}

	.edit_address .border {
		width: 22rpx;
		height: 22rpx;
		border: 1px solid #666;
		margin-right: 20rpx;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.edit_address .sele {
		width: 12rpx;
		height: 12rpx;
		background: #666;
	}

	.edit_address_btn {
		display: flex;
		flex-direction: column;
		background: #eee;
		height: 10vh;
		align-items: center;
	}

	.edit_address_btn .btn {
		width: 690rpx;
		height: 88rpx;
		background: linear-gradient(90deg, #db9e55, #f7ca8f);
		border-radius: 10rpx;
		text-align: center;
		line-height: 88rpx;
	}

	.addressPicker {
		font-size: 28rpx;
		display: flex;
		align-items: center;
	}

	.edit_address .item2 {
		display: flex;
		flex-direction: row;
		height: 80rpx;
		align-items: center;
		border-bottom: 1px solid #eee;
		background: #fff;
		padding: 0 10rpx;
	}

	.addressPicker text {
		display: inline-block;
	}

	.addressPicker>.colors {
		width: 510rpx;
		margin-left: 20rpx;
	}

	.colors {
		color: #888;
	}

	.payxieyi {
		position: fixed;
		top: 0;
		left: 0;
		height: 100%;
		width: 100%;
		background: #fff;
		padding: 10rpx 20rpx;
		z-index: 100;
		box-sizing: border-box;
	}

	.content {
		font-size: 30rpx;
		height: 90vh;
		overflow: scroll;
	}

	.content view {
		margin-bottom: 20rpx;
	}

	.sub_btn {
		position: fixed;
		bottom: 0;
		height: 10vh;
	}

	.strong {
		font-weight: 600;
	}

	.name_input {
		height: 80rpx;
	}

	.name_input .input {
		height: 60rpx;
		margin: 10rpx auto;
		border: 1rpx solid #c2c2c2;
		font-size: 28rpx;
		z-index: 10rpx;
	}

	.select_box {
		background: #f8f8f7;
		padding: 20rpx;
		box-sizing: border-box;
		border-radius: 10rpx;
	}

	.btn_box {
		height: 10vh;
		width: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.xie_sub_btn {
		margin: 0 0 10rpx;
		background: linear-gradient(90deg, #db9e55, #f7ca8f);
	}

	.back_btn,
	.xie_sub_btn {
		height: 80rpx;
		color: #fff;
		width: 40%;
		font-size: 30rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 6rpx;
	}

	.back_btn {
		margin-bottom: 10rpx;
		margin-right: 20rpx;
		background: #c2c2c2;
	}

	.coupon_big_box {
		position: fixed;
		height: 50%;
		width: 100%;
		bottom: 0;
		left: 0;
		display: flex;
		align-items: flex-end;
		z-index: 100000;
		/* background: rgba(0, 0, 0, .3); */
	}

	.coupon_box {
		width: 100%;
		height: 100%;
		background: #f8f8f7;
		overflow-y: scroll;
		border-radius: 20rpx 20rpx 0 0;
	}

	.coupon_item {
		width: 95%;
		background: #fff;
		display: flex;
		flex-direction: row;
		padding: 20rpx;
		box-sizing: border-box;
		margin: 10rpx auto;
		border-radius: 20rpx;
	}

	.coupon_item .right {
		position: relative;
	}

	.coupon_item .right_money {
		color: #f8c400;
		position: absolute;
		top: 48rpx;
		right: 55rpx;
		font-size: 40rpx;
		font-weight: 600;
	}

	.coupon_item .right .img {
		width: 240rpx;
		height: 150rpx;
		margin-right: 20rpx;
	}

	.coupon_item .left {
		display: flex;
		flex-direction: column;
		height: 150rpx;
		justify-content: space-between;
	}

	.coupon_item .left .money {
		font-size: 28rpx;
	}

	.coupon_item .left .time {
		font-size: 24rpx;
	}

	.coupon_item .left .color {
		color: #f8c400;
	}

	.select_icon {
		width: 80rpx;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.select_img {
		height: 60rpx;
		width: 60rpx;
	}

	.coupon_btngroup {
		position: fixed;
		left: 0;
		bottom: 0;
		height: 80rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		background: #fff;
	}

	.coupon_btnitem {
		width: 30%;
		height: 60rpx;
		text-align: center;
		line-height: 60rpx;
		font-size: 30rpx;
		border-radius: 8rpx;
		background: #fff;
	}

	.qx {
		margin-right: 30rpx;
		border: 1rpx solid #ccc;
	}

	.qd {
		background: #f8c400;
		color: #fff;
	}

	.huibg {
		background: #dbdbdb;
	}

	.itemData {
		height: 60rpx;
		font-size: 30rpx;
		border-right: 1px solid #dbdbdb;
	}

	.itemData,
	.title_item2 {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.title_item2 {
		height: 80rpx;
	}
</style>