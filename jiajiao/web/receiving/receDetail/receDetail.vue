<template>
	<view>
		<view class="content-box">
			<view class="tab5-item">
				<text class="tab5-title">编号：</text>
				<text class="tab5-val">S{{studentInfo.demand_id}}</text>
			</view>
			<view class="tab5-item">
				<view class="tab5-title">学生性别:</view>
				<view class="tab5-val">
					<text v-if="studentInfo.gender==2">男</text>
					<text v-if="studentInfo.gender==1">女</text>
				</view>
			</view>
			<view class="tab5-item">
				<view class="tab5-title">授课科目:</view>
				<view class="tab5-val">
					{{studentInfo.grade_name}}/{{studentInfo.subject_name}}
				</view>
			</view>
			<view class="tab5-item">
				<view class="tab5-title">授课方式:</view>
				<view class="tab5-val" v-if="studentInfo.teaching_way==1">上门授课</view>
				<view class="tab5-val" v-if="studentInfo.teaching_way==2">在线授课</view>
				<view class="tab5-val" v-if="studentInfo.teaching_way==3">上门授课/在线授课</view>
			</view>
			<view class="tab5-item">
				<view class="tab5-title">您的授课地址:</view>
				<view class="tab5-val">
					{{studentInfo.province}}{{studentInfo.city}}{{studentInfo.area}}
				</view>
			</view>
			<view class="tab5-item">
				<view class="tab5-title">详细地址:</view>
				<view class="tab5-val">{{studentInfo.address}}</view>
			</view>
			<view class="tab5-item">
				<view class="tab5-title">学生在读学校:</view>
				<view class="tab5-val">{{studentInfo.school}}</view>
			</view>
			<view class="tab5-item">
				<view class="tab5-title">学生的上课时间:</view>
				<view class="val-box">
					<view v-for="(item,index) in studentInfo.schooltime" :key="index" class="tab5-val">
						{{item.week}}<text style="width:50rpx; display: inline-block;"></text>
						{{item.start_time}}-{{item.end_time}}
					</view>
				</view>
			</view>
			<view class="tab5-item">
				<view class="tab5-title">学生的基本情况:</view>
				<view class="tab5-val">{{studentInfo.gai_kuang}}</view>
			</view>
			<view class="tab5-item">
				<view class="tab5-title">课时费:</view>
				<view class="tab5-val">{{studentInfo.price}}</view>
			</view>
			<view class="tab5-item">
				<view class="tab5-title">学生希望的老师性别:</view>
				<view class="tab5-val" v-if="studentInfo.teacher_gender==1">男</view>
				<view class="tab5-val" v-else-if="studentInfo.teacher_gender==2">女</view>
				<view class="tab5-val" v-else>男/女</view>
			</view>
			<view class="tab5-item">
				<view class="tab5-title">学生希望的老师类型:</view>
				<text class="tab5-val" v-if="studentInfo.teacher_identity==1">大学生教员</text>
				<text class="tab5-val" v-if="studentInfo.teacher_identity==2">专职教员</text>
				<text class="tab5-val" v-if="studentInfo.teacher_identity==3">大学生教员/专职教员</text>
			</view>
			<view class="tab5-item">
				<view class="tab5-title">学生对老师的要求:</view>
				<view class="tab5-val">{{studentInfo.teacher_require}}</view>
			</view>
			<view v-if="mode == 'owner'" class="tab5-item" @click="onTeacherHistory">
				<view class="tab5-title">查看浏览过的老师:</view>
				<view class="tab5-val">点击查看</view>
			</view>
			<view class="bttom-box" style="display: flex;align-items: center;justify-content: space-between;align-items: flex-start;margin-top: 24rpx;">
				<!-- #ifdef MP-WEIXIN -->
				<view @click="formSubmit" class="seemap" style="display: flex;align-items: center;">
					<image class="addressIcon" src="/static/images/22.png"></image>分享学生
				</view>
				<!-- #endif -->

				<view @click="seeMap" class="seemap" style="justify-content: flex-end;">
					<image class="addressIcon" src="/static/images/ui_r3_c4.png"></image>查看授课路程
				</view>
			</view>
			<view style="height: 40rpx;"></view>
			<view class="tiptip tiptipColor1" v-if="studentInfo.status==2">
				来晚了，已被其他老师抢单，请查看更多生源
			</view>

			<view class="btn-box" v-else-if="identity==2">
				<view @click="submit" v-if="studentInfo.is_contact==0 && studentInfo.kefu_direct == 0" class="next-btn-one phone_btn">
					<view>获取联系方式</view>
					<view class="eff_to">支付{{studentInfo.teacher_price}}开通月会员</view>
				</view>
				<view @click="onTuifei" v-if="studentInfo.is_contact==1 && studentInfo.kefu_direct == 0" class="tuifei">
					<view>退费说明</view>
				</view>
				<view @click="makePhone" v-if="studentInfo.is_contact==1 && studentInfo.kefu_direct == 0" class="next-btn-one phone_btn">
					<view>联系TA</view>
					<view v-if="studentInfo.eff_to" class="eff_to">会员有效期:{{studentInfo.eff_to}}</view>
				</view>
				<view v-if="studentInfo.kefu_direct == 1" class="next-btn-one_nobg phone_btn">
					<button type="primary" open-type="contact" bindcontact="onKefuBack" session-from="mini" 
						:send-message-title="`生源${studentInfo.ext_no}`" :show-message-card="true"
						:send-message-path="`/receiving/receDetail/receDetail?id=${id}`">联系客服</button>
				</view>
			</view>
		</view>
		<view class="haibao" v-if="showCanvas" @click="showCanvas=false">
			<view class="hais" @click.stop="">
				<canvas style="width: 570rpx;height: 910rpx;" id="myCanvas" canvas-id="myCanvas"></canvas>
			</view>
			<view class="baocun" @click.stop="saveImg">
				<text>保存到相册</text>
			</view>
		</view>
		
		<u-popup v-model="code_pop1" mode="center" @close="code_pop1=false" :mask="true">
			<view class="code_imgbox" style="padding-bottom: 60rpx;">
				 <view class="conttt" style="width: 96%;margin:0 auto;">
					 <rich-text :nodes="agreement"></rich-text>
				 </view>
				<view @click="submit3" class="next-btn-one2">确定</view>
			</view>
		</u-popup>
		
	</view>
</template>

<script>
	import { logTeacherVipCost, teacherOrderRefund } from '@/comm/api_teacher.js'
	export default {
		data() {
			return {
				code_pop1: false,
				studentInfo: {},
				status: '',
				showCanvas: false,
				tempFilePath: '',
				w: '',
				id: '',
				identity: uni.getStorageSync('identity'),
				mobile: '',
				item: {},
				agreement:'',
				mode: 'read' //owner 家长 read 只读
			}
		},
		onLoad(options) {
			if(options.mode){
				this.mode = options.mode
			}
			this.item = uni.getStorageSync('user')
			const system = uni.getSystemInfoSync()
			const w = system.windowWidth / 750
			this.w = w
			this.id = options.id
		},
		onShareAppMessage() {
			return {
				title: '献新家教',
				path: '/receiving/receDetail/receDetail?id=' + this.id,
			}

		},
		onShareTimeline() {
			return {
				title: '献新家教',
				path: '/receiving/receDetail/receDetail?id=' + this.id,
			}
		},
		onShow() {
			this.getMobile()
			this.getStudentInfo(this.id)
			this.getTeacherInfo()
		},
		methods: {
			onKefuBack(e){
				console.log('用户发送了消息:', e.detail);
			},
			callFun() {
				let that = this
				uni.makePhoneCall({
					phoneNumber: that.mobile
				})
			},
			getMobile() {
				this.api('/index/getGzhCode', 'post').then(res => {
					this.mobile = res.data.service_tel
				})
			},
			formSubmit() {
				if (!uni.getStorageSync('token')) {
					uni.navigateTo({
						url: '/my/getPhone/getPhone'
					})
					return
				}
				uni.showLoading({
					title: '生成中...'
				})
				this.showCanvas = true
				let that = this
				const ctx = uni.createCanvasContext('myCanvas')
				console.log(ctx)

				ctx.drawImage('../../static/images/haibao.png', 0, 0, 570 * that.w, 910 * that.w)
				var no = ''
				if (that.studentInfo.mid.toString().length < 4) {
					switch (that.studentInfo.mid.toString().length) {
						case 1:
							no = 'S000' + that.studentInfo.mid
							break;
						case 2:
							no = 'S00' + that.studentInfo.mid
							break;
						case 3:
							no = 'S0' + that.studentInfo.mid
							break;
					}
				} else {
					no = 'S' + that.studentInfo.mid
				}
				ctx.fillStyle = "#000000"
				ctx.font = "normal 16px Verdana";
				ctx.fillText(`【编号】:${no}`, 70 * that.w, 430 * that.w, )
				ctx.fillStyle = "#000000"
				ctx.font = "normal 16px Verdana";
				ctx.fillText(`${that.studentInfo.name.charAt(0)+'同学'}`, 370 * that.w, 430 * that.w, )
				ctx.fillStyle = "#fff"
				ctx.font = "normal 12px Verdana";
				ctx.fillText(`适用对象`, 110 * that.w, 538 * that.w, )
				ctx.fillStyle = "#fff"
				ctx.font = "normal 12px Verdana";
				ctx.fillText(`教员要求`, 110 * that.w, 655 * that.w, )
				ctx.fillStyle = "#fff"
				ctx.font = "normal 12px Verdana";
				ctx.fillText(`学习方式`, 110 * that.w, 777 * that.w, )

				ctx.fillStyle = "#f8c400";
				ctx.fillRect(90 * that.w, 450 * that.w, 40 * that.w, 30 * that.w);
				var sex = ''
				if (that.studentInfo.gender == 1) {
					sex = '男'
				} else {
					sex = '女'
				}
				ctx.fillStyle = "#fff"
				ctx.font = "normal 12px Verdana";
				ctx.fillText(`${sex}`, 100 * that.w, 472 * that.w)
				ctx.fillStyle = "#000"
				ctx.font = "normal 12px Verdana";
				ctx.fillText(`${that.studentInfo.price}`, 150 * that.w, 472 * that.w)
				ctx.arc(150 * that.w, 450 * that.w, 50 * that.w, 0, 2 * Math.PI);

				ctx.arc(150 * that.w, 450 * that.w, 50 * that.w, 0, 2 * Math.PI);
				ctx.fillStyle = "#000"
				ctx.font = "normal 12px Verdana";
				ctx.fillText(`${that.studentInfo.grade_name}/${that.studentInfo.subject_name}`, 90 * that.w, 578 * that.w)
				ctx.fillStyle = "#000"
				ctx.font = "normal 12px Verdana";
				ctx.fillText(`${that.studentInfo.province}${that.studentInfo.city}${that.studentInfo.area}`, 90 * that.w,
					618 * that.w)
				ctx.fillStyle = "#000"
				ctx.font = "normal 12px Verdana";
				ctx.fillText(
					`${that.studentInfo.schooltime[0].week}/${that.studentInfo.schooltime[0].start_time}-${that.studentInfo.schooltime[0].end_time}`,
					290 * that.w, 578 * that.w)
				ctx.fillStyle = "#000"
				ctx.font = "normal 12px Verdana";
				var shenfen = ''
				switch (that.studentInfo.teacher_identity) {
					case 1:
						shenfen = '大学生教员'
						break;
					case 2:
						shenfen = '普通教员'
						break;
					case 3:
						shenfen = '专业教员'
						break;
				}
				ctx.fillText(`${shenfen}`, 90 * that.w, 698 * that.w)
				ctx.fillStyle = "#000"
				ctx.font = "normal 12px Verdana";
				ctx.fillText(`${that.studentInfo.teacher_require.slice(0,14)+'...'}`, 90 * that.w, 738 * that.w)
				var fangshi = ''
				switch (that.studentInfo.teaching_way) {
					case 1:
						fangshi = '上门授课'
						break;
					case 2:
						fangshi = '在线授课'
						break;
					case 3:
						fangshi = '上门授课/在线授课'
						break;
				}
				ctx.fillStyle = "#000"
				ctx.font = "normal 12px Verdana";
				ctx.fillText(`${fangshi}`, 290 * that.w, 698 * that.w)
				ctx.fillStyle = "#000"
				ctx.fillStyle = "#000"
				ctx.font = "normal 12px Verdana";
				ctx.fillText(`长按识别小程序码献新家教`, 90 * that.w, 838 * that.w)

				uni.downloadFile({
					url: that.imgUrl + that.studentInfo.qrcode,
					success(res) {
						ctx.drawImage(res.tempFilePath, 390 * that.w, 728 * that.w, 120 * that.w, 120 * that.w)
						setTimeout(() => {
							ctx.draw(false, function() {
								uni.canvasToTempFilePath({
									canvasId: 'myCanvas',
									success(res) {
										uni.hideLoading()
										that.tempFilePath = res.tempFilePath
									}
								})
							})
						}, 500)
					},
					fail(){
						uni.hideLoading()
					}
				})
			},
			saveImg() {
				let that = this
				uni.saveImageToPhotosAlbum({
					filePath: that.tempFilePath,
					success() {
						uni.showToast({
							title: '保存成功',
							icon: "none"
						})
						that.showCanvas = false
					}
				})
			},
			seeMap() {
				if (!uni.getStorageSync('token')) {
					uni.navigateTo({
						url: '/my/getPhone/getPhone'
					})
					return
				}
				console.log(22)
				let that = this
				uni.openLocation({
					latitude: that.studentInfo.latitude * 1,
					longitude: that.studentInfo.longitude * 1,
					success() {

					}
				})
			},
			getTeacherInfo() {
				const cache = uni.getStorageSync('user') || {}
				const mid = cache.mid || ''
				const teacher_id = cache.teacher_info?.teacher_id || ''
				if(!mid && !teacher_id){
					res.data.status = -1
					return
				}
				this.api('/index/getTeacherInfo', 'post', {
					mid: mid,
					teacher_id: teacher_id
				}).then(res => {
					this.status = res.data.status || -1
				})
			},
			getStudentInfo(id) {
				this.api('/index/getStudentInfo', 'post', {
					demand_id: id,
					mid: uni.getStorageSync('user') && uni.getStorageSync('user').mid,
					add_record: 1
				}).then(res => {
					console.log(res)
					this.studentInfo = res.data
				})
			},
			submit() {
				if (!uni.getStorageSync('token')) {
					uni.navigateTo({
						url: '/my/getPhone/getPhone'
					})
					return
				}
				console.log('=====> this.status ', this.status)
				if (!this.status || this.status == -1) {
					this.onReminderNotTeacher()
					return
				}
				if (this.status == 0 || this.status == 2) {
					this.onReminderProfile()
					return
				}
				let that=this
				this.api('/index/getAgreement4', 'post').then(res => {
					this.agreement = res.data
					this.code_pop1=true;
				})	
			},
			onReminderProfile(){
				uni.showModal({
					title: '提示',
					content: '完善教师简历后立即接单',
					confirmText: '完善简历',
					success: function(res) {
						if (res.confirm) {
							uni.navigateTo({
								url: '/pages_teacher/register?navBack=1'
							})
						}
					}
				})
			},
			/**
			 * 提示未注册教师
			 */
			onReminderNotTeacher(){
				uni.showModal({
					title: '提示',
					content: '注册教师后立即接单',
					confirmText: '前往注册',
					success: function(res) {
						if (res.confirm) {
							uni.navigateTo({
								url: '/pages_teacher/register?navBack=1'
							})
						}
					}
				})
			},
			makePhone(){
				if(this.studentInfo.hide_mobile){
					let that=this
					uni.showModal({
						title: '提示',
						content: '确认联系吗',
						success: function (res) {
							that.doShowWxId()
							that.logVipCost()
						}
					});
				}else{
					this.doCallPhone()
				}
			},
			doShowWxId(){
				let _this =this
				uni.setClipboardData({
					data: _this.studentInfo.wx_id,
					success: () => {
						uni.showModal({
							title: '提示',
							content: '用户要求微信联系,微信号已复制到剪切板',
							showCancel: false
						})
					}
				})
			},
			/**
			 * 拨打电话
			 */
			doCallPhone(){
				let that=this
				uni.showModal({
					title: '',
					content: '确认联系吗',
					success: function (res) {
						console.log(that.studentInfo.mobile)
						if (res.confirm) {
							that.logVipCost()
							wx.makePhoneCall({
							 	phoneNumber: that.studentInfo.mobile
							})
						} else if (res.cancel) {
							console.log('用户点击取消');
						}
					}
				});
			},
			logVipCost(){
				logTeacherVipCost({demand_id: this.id}).then(()=>{
					
				})
			},
			submit3() {
				let that=this
				this.code_pop1=false;
				// #ifdef MP-WEIXIN
				let data = {
					demand_id: this.studentInfo.demand_id
				}
				that.iscreateOrder = true
				that.api("/order/createOrder",'post', data).then(res => {
					console.log(res)
					console.log(11)
					if (res.state == 200) {

						wx.requestPayment({
							timeStamp: res.data.timeStamp,
							nonceStr: res.data.nonceStr,
							package: res.data.package,
							signType: 'MD5',
							paySign: res.data.paySign,
							success(res) {
								that.getStudentInfo(that.studentInfo.demand_id)
							},
							fail(res) {},
							complete() {
							}
						})
					} else {
						uni.showToast({
							title: res.msg,
							icon: "none"
						})
					}
				})
				// #endif
			},
			onTuifei(){
				const _this = this
				uni.showModal({
					title: '提示',
					content: '30天内未获得任何生源联系方式可申请退费',
					confirmText: '申请退费',
					success(res){
						if(res.confirm){
							_this.doTuifei()
						}else{
							return
						}
					}
				})
			},
			doTuifei(){
				if (!uni.getStorageSync('token')) {
					uni.navigateTo({
						url: '/my/getPhone/getPhone'
					})
					return
				}
				teacherOrderRefund().then(res=>{
					uni.showModal({
						title:'提示',
						content: res.status == 200 ? '退款申请已提交，费用将原路退回' : res.msg,
						showCancel: false
					})
				})
			},
			onTeacherHistory(){
				console.log('=====> onTeacherHistory')
				uni.navigateTo({
					url: `/receiving/receDetail/demandTeacher?demand_id=${this.studentInfo.demand_id}`
				})
			}
		}
	}
</script>

<style scoped>
	.yellowBg {
		position: absolute;
		display: flex;
		align-items: center;
		top: 50%;
		transform: translateY(-50%);
		right: 100rpx;
	}

	.item {


		align-items: center;
		font-size: 26rpx;
	}

	.yellowBg image {
		width: 50rpx;
		height: 50rpx;
	}

	.yellowBg button {
		position: absolute;
		width: 100%;
		height: 100%;
		top: 0;
		left: 0;
		background-color: transparent;
	}

	.yellowBg button::after {
		display: none;
	}

	.link_icon {
		height: 60rpx;
		width: 60rpx;
		position: fixed;
		bottom: 250rpx;
		right: 40rpx;
	}

	.haibao {
		width: 100%;
		height: 100%;
		position: fixed;
		top: 0;
		left: 0;
		background-color: rgba(0, 0, 0, 0.4);
		z-index: 9999;
	}

	.baocun {
		width: 570rpx;
		height: 80rpx;
		background-color: rgb(251, 100, 29);
		border-radius: 50rpx;
		text-align: center;
		line-height: 80rpx;
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		bottom: 120rpx !important;
	}

	.baocun text {
		color: #fff;
	}

	.haibao .hais {
		width: 570rpx;
		height: 910rpx;
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);

	}

	page {
		background-color: #efefef;
	}

	.teacher-matchV2 .top {
		height: 400rpx;
		width: 100%;
		background-color: #f8c400;
	}

	.stap-box {
		display: flex;
		flex-direction: row;
		height: 145rpx;
		width: 90%;
		margin-left: 5%;
		justify-content: space-between;
		align-items: center;
		padding-top: 30rpx;
	}

	.stap1 {
		width: 100%;
		height: 118rpx;
	}

	.input-item {
		display: flex;
		height: 100rpx;
		width: 90%;
		align-items: center;
		margin: 0 auto;
		position: relative;
	}

	.item-input-bottom {
		border-bottom: 2rpx solid #d4d4d4;
	}

	.item-padding-bottom {
		margin-bottom: 40rpx;
	}

	.jtIcon {
		width: 25rpx;
		height: 35rpx;
	}

	.picker {
		flex: 1;
		height: 60rpx;
		text-align: right;
		margin-right: 10rpx;
		font-size: 30rpx;
		line-height: 60rpx;
	}

	.content-tip {
		font-size: 20rpx;
		color: #666;
		margin-left: 26rpx;
		margin-top: 10rpx;
	}

	.name {
		width: 286rpx;
	}

	.name,
	.phone {
		font-size: 30rpx;
	}

	.flex,
	.phone {
		flex: 1;
	}

	.phoneIcon {
		width: 40rpx;
		height: 40rpx;
	}

	.item-title {
		font-size: 30rpx;
		color: #666;
	}

	.address {
		width: 100%;
		font-size: 30rpx;
	}

	.local-tip {
		font-size: 18rpx;
		color: #e8bf4b;
		position: absolute;
		left: 2rpx;
		bottom: 6rpx;
	}

	.tab2-item-box {
		padding-top: 20rpx;
		display: flex;
		flex-direction: column;
		width: 90%;
		margin: 0 auto;
		position: relative;
	}

	.tab2-title {
		font-size: 32rpx;
	}

	.kmText,
	.tab2-item-box input {
		font-size: 30rpx;
		margin-top: 25rpx;
		border: 2rpx solid #999;
		border-radius: 10rpx;
		height: 60rpx;
		text-indent: 20rpx;
	}

	.kmText {
		line-height: 60rpx;
	}

	.kmTextColor {
		color: #666;
	}

	.sel-item-box {
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
	}

	.sel-item {
		width: 180rpx;
		height: 60rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 26rpx;
		border: 2rpx solid #999;
		border-radius: 10rpx;
		margin-top: 20rpx;
	}

	.sel-item-mar {
		margin-right: 20rpx;
	}

	.sel-active-bg {
		background-color: #e8bf4b;
		border: 2rpx solid #e8bf4b;
	}

	.to-btn-one {
		background-color: #ccc;
		margin-right: 20rpx;
		color: #fff;
		letter-spacing: 4rpx;
	}

	.next-btn-one,
	.to-btn-one {
		width: 40%;
		height: 80rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 10rpx;
		font-size: 36rpx;
	}

	.next-btn-one {
		background-color: #e8bf4b;
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
	}
	.next-btn-one_nobg{
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
	}
	.next-btn-one2 {
		background-color: #e8bf4b;
		text-align: center;
		    width: 200rpx;
		    border-radius: 10rpx;
		    height: 60rpx;
		    line-height: 60rpx;
		    margin: 10rpx auto;
	}
	.tab5-item {
		display: flex;
		flex-direction: row;
		border-bottom: 2rpx solid #c3c3c3;
		width: 90%;
		padding: 20rpx 0;
		box-sizing: border-box;
		align-items: flex-start;
		margin: 0 auto;
		font-size: 30rpx;
	}

	.tab5-title {
		color: #717171;
		font-size: 26rpx;
	}

	.tab5-val {
		flex: 1;
		text-align: right;
		font-size: 26rpx;
	}

	.time-picker {
		flex: 1;
		margin-right: 10rpx;
		color: #666;
		font-size: 26rpx;
		border: 2rpx solid #999;
		height: 60rpx;
		line-height: 60rpx;
		border-radius: 8rpx;
		margin-top: 30rpx;
	}

	.val-box {
		display: flex;
		flex-direction: column;
		flex: 1;
		justify-content: flex-end;
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
		border: 1rpx solid #dbdbdb;
	}

	.comment_style .cul {
		display: flex;
		flex-direction: column;
		border: 1rpx solid #dbdbdb;
	}

	.comment_style .border-top {
		border-top: none;
	}

	.comment_style .item {
		font-size: 22rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 15%;
	}

	.comment_style .itemBorder {
		border-right: 1rpx solid #dbdbdb;
	}

	.comment_style .yellbg {
		background: #f0b732;
	}

	.comment_style .time_title {
		margin-top: 30rpx;
		display: flex;
		flex-direction: row;
		font-size: 26rpx;
		align-items: center;
		background: #fff;
		border: 1rpx solid #dbdbdb;
		border-radius: 10rpx 10rpx 0 0;
	}

	.comment_style .title_item {
		flex: 1;
		text-align: center;
	}

	.comment_style .dateDetail {
		display: flex;
		align-items: center;
		font-size: 26rpx;
		box-sizing: border-box;
		background: #fff;
		border-right: 1rpx solid #dbdbdb;
		border-left: 1rpx solid #dbdbdb;
		border-bottom: 1rpx solid #dbdbdb;
	}

	.borderyj {
		border-radius: 0 0 10rpx 10rpx;
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

	.title_item2 {
		height: 80rpx;
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.content-box {
		width: 100%;
		background-color: #fff;
		margin-bottom: 200rpx;
	}

	.btn-box {
		position: fixed;
		width: 100%;
		height: 120rpx;
		background-color: #fff;
		bottom: 0;
		left: 0;
		z-index: 100;
	}

	.btn-box,
	.btn-one {
		display: flex;
		align-items: center;
	}

	.btn-one {
		background-color: #e8bf4b;
		width: 85%;
		height: 80rpx;
		border-radius: 10rpx;
		font-size: 36rpx;
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

	.lanlat {
		flex: 1;
		font-size: 30rpx;
	}

	.phoneTip {
		font-size: 18rpx;
		color: #e8bf4b;
		position: absolute;
		left: 10rpx;
		bottom: 6rpx;
	}

	.itemData {
		height: 60rpx;
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 30rpx;
	}

	.zxbtn {
		width: 34rpx;
		height: 40rpx;
		opacity: 0;
	}

	.zxicon {
		width: 34rpx;
		height: 37rpx;
		right: 0;
		top: 27rpx;
	}

	.fd,
	.zxicon {
		position: absolute;
	}

	.fd {
		width: 23rpx;
		height: 30rpx;
		right: 12rpx;
		top: 106rpx;
	}

	.tiptip {
		font-size: 28rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 20rpx;
	}

	.tiptipColor1 {
		color: #a52021;
	}

	.tiptipColor2 {
		color: #00a99d;
	}

	.bttom-box {
		flex-direction: row;
		height: 100rpx;
		padding: 0 32rpx;
	}

	.bttom-box,
	.seemap {
		display: flex;
		align-items: center;
	}

	.seemap {
		font-size: 28rpx;
		text-decoration: underline;
	}

	.addressIcon {
		width: 40rpx;
		height: 40rpx;
		margin-right: 16rpx;
	}
	.phone_btn{
		display: block !important;
		text-align: center;
		height: auto !important;
		padding: 12rpx 0 !important;
	}
	.phone_btn .eff_to{
		font-size: 24rpx;
	}
	.tuifei{
		margin-left: 24rpx;
	}
</style>