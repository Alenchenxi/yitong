<template>
	<view>
		<scroll-view class="teacher_img_box" scroll-x="true">
			<video loop="true" controls="true" class="teacher_img" v-if="teacherInfo.works"
				:src="url+teacherInfo.works"></video>
			<image  class="teacher_img" mode="aspectFill" :src="url+item"
				v-for="(item,index) in teacherInfo.photos" :key="index"></image>
		</scroll-view>
		<view class="teacher_content">
			<view class="item_box">
				<view class="name fontWeightW">
					<image class="sexIcon" src="/static/images/man.png" v-if="teacherInfo.gender=='1'"></image>
					<image class="sexIcon" src="/static/images/mw.png" v-else></image>
					<view class="teacherName">{{teacherInfo.name}}</view>
					<text class="yellowbg" v-if="teacherInfo.teacher_identity==1">大学生教员</text>
					<text class="yellowbg" v-if="teacherInfo.teacher_identity==2">专业教员</text>
				</view>
				<view class="location">
					<view class="cityName">{{teacherInfo.city}}</view>
					<view class="pice">￥{{teacherInfo.salary}}/时</view>
				</view>
			</view>
			<view class="item_box">
				<view class="name">
					<view class="item_box-desc" v-if="teacherInfo.label && teacherInfo.label != ''">
						<view class="border" v-for="(item,index) in teacherInfo.label" :key="index">{{item}}</view>
					</view>
				</view>
				<view class="yearName">教龄{{teacherInfo.teaching_age}}年 </view>
			</view>
		</view>
		<view class="school_detail">
			<view class="by_name">毕业院校：</view>
			<view class="school_bg">
				<image src="/static/images/back.jpg" mode=""></image>
				<view class="school_name"
					style="width: 100%;position: absolute;top: 20rpx;left: 0;display: flex;justify-content: space-between;">
					<view class="time">
						<text v-if="teacherInfo.school_start_time && teacherInfo.school_end_time">{{teacherInfo.school_start_time}}~{{teacherInfo.school_end_time }}</text>
					</view>
					<view class="xl">{{teacherInfo.specialty}}</view>
				</view>
				<view class="school_name"
					style="width: 100%;position: absolute;top: 80rpx;left: 0;display: flex;justify-content: space-between;">
					<view class="time">{{teacherInfo.school}}</view>
					<view class="xl">{{teacherInfo.education}}</view>
				</view>
			</view>
		</view>
		<view class="school_detail">
			<view class="by_name">可授科目:</view>
			<view class="techer-obj-box">
				<view v-if="item.subject_name" class="techer-obj" :class="index==0?'border-right':''"
					v-for="(item,index) in teacherInfo.teaching_subject" :key="index">
					<view class="obj" v-if="item.is_main==1">主教</view>
					<view class="obj" v-else>辅教</view>
					<view class="time">{{item.grade_name}}-{{item.subject_name}}</view>
					<view class="obj red">￥{{item.price}}</view>
				</view>
			</view>
		</view>
		
		<view class="school_detail">
			<view class="by_name" style="display: flex;align-items: center;">编号：<image :key="index"
					v-for="(item,index) in (teacherInfo.star_level||0)" src="/static/images/ui_r28_c44.png"></image>
			</view>
			<view class="school_name">
				<text class="dian"></text>{{teacherInfo.teacher_id}}
			</view>
		</view>
		<view class="school_detail">
			<view class="by_name">年龄：</view>
			<view class="school_name">
				<text class="dian"></text>{{teacherInfo.age}}
			</view>
		</view>
		<view class="school_detail">
			<view class="by_name">籍贯：</view>
			<view class="school_name">
				<text class="dian"></text>{{teacherInfo.birthplace || ''}}
			</view>
		</view>
		<view class="school_detail">
			<view class="by_name">最高学历：</view>
			<view class="school_name">
				<text class="dian"></text>{{teacherInfo.education}}
			</view>
		</view>
		<view class="school_detail">
			<view class="by_name">大学专业：</view>
			<view class="school_name">
				<text class="dian"></text>{{teacherInfo.specialty}}
			</view>
		</view>

		<view class="school_detail">
			<view class="by_name">自我介绍：</view>
			<view class="jlItem" v-for="(item,index) in teacherInfo.experience" :key="index">
				<view class="school_name wordColor">{{item.experience || ''}}</view>
			</view>
		</view>
		<view class="school_detail">
			<view class="by_name">家教经验：</view>
			<view class="school_name wordColor">{{teacherInfo.successful_case || ''}}</view>
		</view>
		<view class="school_detail">
			<view class="by_name">所获证书:</view>
			<view class="school_name wordColor">{{teacherInfo.honor}}</view>
			<image  class="teacher_img" mode="aspectFill" :src="url+item" @click="previewImage(url+item)"
				v-for="(item,index) in teacherInfo.honor_img" :key="index"></image>
		</view>
		<view class="school_detail" v-if="teacherInfo.teacher_title_img">
			<view class="by_name">教师职称证书:</view>
			<image  class="teacher_img" mode="aspectFill"  @click="previewImage(url+teacherInfo.teacher_title_img)" :src="url+teacherInfo.teacher_title_img"
			></image>
		</view>
		<view class="school_detail" v-if="teacherInfo.chsi_img">
			<view class="by_name">学信网截图:</view>
			<image  class="teacher_img" mode="aspectFill" :src="url+teacherInfo.chsi_img"  @click="previewImage(url+teacherInfo.chsi_img)"
			></image>
		</view>
		<view class="school_detail" v-if="teacherInfo.student_card_img">
			<view class="by_name">学生证:</view>
			<image  class="teacher_img" mode="aspectFill" :src="url+teacherInfo.student_card_img"  @click="previewImage(url+teacherInfo.student_card_img)"
			></image>
		</view>
		<view class="school_detail" v-if="teacherInfo.diploma_img">
			<view class="by_name">学历证:</view>
			<image  class="teacher_img" mode="aspectFill" @click="previewImage(url+teacherInfo.diploma_img)" :src="url+teacherInfo.diploma_img"
			></image>
		</view>
		<view class="school_detail" v-if="teacherInfo.itic_img">
			<view class="by_name">教师证:</view>
			<image  class="teacher_img" mode="aspectFill" :src="url+teacherInfo.itic_img"  @click="previewImage(url+teacherInfo.itic_img)"
			></image>
		</view>
		<view class="school_detail">
			<view class="by_name">学生评论（{{commetList.length}}）</view>
			<view class="commet_box">
				<view class="commet_boxItem" v-for="(item,index) in commetList" :key="index">
					<view class="school_name">
						<image class="img" src="/static/images/logoo.jpg"></image>
						<text class="time">{{item.nickname}}</text>
					</view>
					<view class="school_name">{{item.content}}</view>
					<view class="pt_time">{{item.create_time}}</view>
				</view>
			</view>
		</view>
		<view class="search_list_box">
			<!-- <TeacherList></TeacherList> -->
		</view>
		<view class="zw"></view>
		<view class="bottom_box">
			<view @click="shoucang" class="item">
				<image class="icon" src="/static/images/24.png" v-if="isSc"></image>
				<image class="icon" src="/static/images/23.png" v-else></image>收藏
			</view>
			<!-- #ifdef MP-WEIXIN -->
			<view @click="formSubmit" class="item yellowBg2">
				<!-- <button open-type="share"></button> -->
				<image class="icon" src="/static/images/22.png">
				</image>生成海报
			</view>
			<!-- #endif -->
			
			<block v-if="teacherInfo.is_contact==1 || teacherInfo.dial_price == 0">
				<view @click="makePhone" class="item yellowBg2">
					<image class="icon" src="/static/images/tel.png">
					</image>拨打电话
				</view>
			</block>
			<block v-else>
				<view @click="showpaypopfun(teacherInfo.user_dial_num)" v-if="teacherInfo.is_vip == 1 && teacherInfo.user_dial_num>0" class="item yellowBg2">
					<image class="icon" src="/static/images/tel.png">
					</image>立即联系
				</view>
				<view @click="showGoClassType" v-else class="item yellowBg2">
					<image class="icon" src="/static/images/tel.png">
					</image>开通会员
				</view>
			</block>
			
			<view class="item yellowBg">
				<button open-type="contact"></button>
				<image class="icon" src="/static/images/21.png">
				</image>客服
			</view>
			<view class="item yellowBg">
				<button open-type="contact"></button>
				<image class="icon" src="/static/images/21.png">
				</image>退款
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
		<!-- <image @click="callFun" class="link_icon" src="/static/images/zx.png"></image> -->
		
		
		<!-- 联系学员支付弹窗 -->
			<u-popup v-model="show_pay_pop" mode='center' width='86%' border-radius='16' :safe-area-inset-bottom='false'>
				<view class="pay_popboxconatianer">
					<view class="show_paypop">
						<view class="list_info">
							<view class="lf_infotext">
								<text class="mst_text">{{teacherInfo.dial_text}}</text>
							</view>
						</view>
						<view class="pay_btnbox">
							<text @click="pay_getusenumfun">立即支付￥{{teacherInfo.dial_price}}元</text>
						</view>
					</view>
				</view>
			</u-popup>
	</view>
</template>

<script>
	import TeacherList from '@/components/teacher_list/teacher_list.vue'
	export default {
		data() {
			return {
				show_pay_pop:false, 
				showCanvas: false,
				w: '',
				id: "",
				//老师的id
				name: "张收纳",
				price: "199",
				level: "专职导师",
				seniority: "4",
				otherpro: [{
					km: '英语',
					nj: '小学',
					price: 120,
					type: '主教'
				}, {
					km: '数学',
					nj: '小学',
					price: 120,
					type: '辅教'
				}, {
					km: '语文',
					nj: '小学',
					price: 120,
					type: '辅教'
				}],
				character: ['负责', '耐心', '英才施教'],
				school: "",
				profession: "",
				education: "",
				scontent: "",
				honor: "中国政法大学研究生",
				honorimage: "",
				image: "",
				number: "",
				sbegin: "",
				send: "",
				begin: "",
				end: "",
				startNum: [],
				grade: "",
				project: "",
				suctitle: "辅导广东广州初中生李子其",
				sucontent: "经过系统的知识体系梳理，深化基础，使其成绩 提高20分",
				location: "西安市",

				//是否收藏
				commetList: [],
				sex: "1",
				otherscontent: [{
					startTime: '2019-09-01',
					endTime: '2022-3-2',
					study: '随机数培训机构',
					sContent: '教授初中数学 小班，8~10人 平均成绩提高20分'
				}],
				teacherOpenId: "",
				collectionId: "",
				maskHidden: false,
				codeImage: "",
				shareBg: "",
				isShowCode: true,
				options: "",


				teacherInfo: {},
				isSc: false,
				url: this.imgUrl,
				teacherId: '',
				tempFilePath: '',
				page: 1,
				mobile: ''
			}
		},
		components: {
			TeacherList
		},
		onLoad(options) {
			this.getTeacherInfo(options.id)
			this.teacherId = options.id
			// this.getTeacherCommentList(options.id)
			const system = uni.getSystemInfoSync()
			const w = system.windowWidth / 750
			this.w = w
		},
		onShareAppMessage() {
			return {
				title: '献新家教',
				path: '/pages/teacherDetail/teacherDetail?id=' + this.teacherId,
			}

		},
		onShareTimeline() {
			return {
				title: '献新家教',
				path: '/pages/teacherDetail/teacherDetail?id=' + this.teacherId,
			}
		},
		onShow() {
			this.getMobile()
			this.page = 1
			this.commetList = []
			this.getTeacherList()
		},
		// onReachBottom() {
		// 	this.page = this.page + 1
		// 	this.getTeacherList()
		// },
		methods: {
// 购买查看次数
			showpaypopfun(num) {
				let that=this;
				let token = uni.getStorageSync("token")
				 uni.showModal({
					title: '联系老师',
					content: '你还有'+num+'次联系次数',
					success(res1) {
						if (res1.confirm) {
							that.api('/user/dec_teach_DialNum', 'post', {
								teacher_id: that.teacherInfo.teacher_id
							}).then(res2 => {
								if (res2.status == 200) {
									wx.makePhoneCall({
										phoneNumber: res2.mobile
									})
									that.getTeacherInfo(that.teacherInfo.teacher_id)
								} else {
									uni.showToast({
										title: res2.msg,
										icon: "none"
									})
								}
							})
						}
					}
				 })
			},
			makePhone(){
				wx.makePhoneCall({
				 	phoneNumber:  this.teacherInfo.mobile
				})
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
			getTeacherList() {
				this.api('/index/getTeacherCommentList', 'post', {
					page: this.page,
					teacher_id: this.teacherId
				}).then(res => {
					this.commetList = res.data
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
			getTeacherInfo(id) {
				this.api('/index/getTeacherInfo', 'post', {
					teacher_id: id,
					mid: uni.getStorageSync('user') && uni.getStorageSync('user').mid
				}).then(res => {
					this.teacherInfo = res.data
					this.teacherInfo.area = res.data.area.split(',')[0]
					this.teacherInfo.name = this.teacherInfo.name.charAt(0) + '老师'
					this.teacherInfo.label = this.teacherInfo.label.split(',')
					if (this.teacherInfo.is_collect == 1) {
						this.isSc = true
					} else {
						this.isSc = false
					}
					console.log(this.teacherInfo)
					let salary = []

					this.teacherInfo.teaching_subject.forEach(item => {

						salary.push(item.price * 1)

					})

					salary.forEach((item, index) => {
						if (item == 0) {
							salary.splice(index, 1)
						}
					})
					let minPrice = salary[0]
					salary.forEach(item => {
						if (item < minPrice) {
							minPrice = item
						}
					})
					this.teacherInfo.salary = minPrice

				})
			},
			getTeacherCommentList(id) {
				this.api('/index/getTeacherCommentList', 'post', {
					page: 1,
					teacher_id: id,
				}).then(res => {

				})
			},
			pay_getusenumfun() {
				if (!uni.getStorageSync('token')) {
					uni.navigateTo({
						url: '/my/getPhone/getPhone'
					})
					return
				}
				let that=this
				this.show_pay_pop=false;
				// #ifdef MP-WEIXIN
				let data = {
				}
				that.api("/order/createDialOrder",'post', data).then(res => {
					if (res.status == 200) {
						wx.requestPayment({
							timeStamp: res.data.timeStamp,
							nonceStr: res.data.nonceStr,
							package: res.data.package,
							signType: 'MD5',
							paySign: res.data.paySign,
							success(res) {
								that.getTeacherInfo(that.teacherId)
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
			showGoClassType() {
				this.show_pay_pop=true
			},
			async formSubmit() {
				uni.showLoading({
					title: '生成中...'
				})
				this.showCanvas = true
				let that = this
				const ctx = uni.createCanvasContext('myCanvas')
				console.log(ctx)

				ctx.drawImage('../../static/images/haibao.png', 0, 0, 570 * that.w, 910 * that.w)

				var no = that.teacherId

				ctx.fillStyle = "#000000"
				ctx.font = "normal 16px Verdana";
				ctx.fillText(`【编号】:${no}`, 220 * that.w, 430 * that.w, )

				ctx.fillStyle = "#fff"
				ctx.font = "normal 12px Verdana";
				ctx.fillText(`基本信息`, 110 * that.w, 538 * that.w, )
				ctx.fillStyle = "#fff"
				ctx.font = "normal 12px Verdana";
				ctx.fillText(`学历资质`, 110 * that.w, 655 * that.w, )
				ctx.fillStyle = "#fff"
				ctx.font = "normal 12px Verdana";
				ctx.fillText(`课时费`, 110 * that.w, 777 * that.w, )

				ctx.fillStyle = "#f8c400";
				ctx.fillRect(240 * that.w, 450 * that.w, 40 * that.w, 30 * that.w);
				var sex = ''
				if (that.teacherInfo.gender == 1) {
					sex = '男'
				} else {
					sex = '女'
				}
				ctx.fillStyle = "#fff"
				ctx.font = "normal 12px Verdana";
				ctx.fillText(`${sex}`, 250 * that.w, 472 * that.w)
				ctx.arc(150 * that.w, 430 * that.w, 50 * that.w, 0, 2 * Math.PI);
				ctx.fillStyle = "#000"
				ctx.font = "normal 12px Verdana";
				ctx.fillText(`${that.teacherInfo.age}岁`, 300 * that.w, 472 * that.w)
				if (that.teacherInfo.star_level * 1 > 0) {
					for (let i = 1; i <= that.teacherInfo.star_level * 1; i++) {
						ctx.drawImage('/static/images/ui_r28_c44.png', (80 * that.w) + (30 * i * that.w), 485 * that
							.w,
							20 * that.w, 20 * that.w)
					}
				}
				ctx.arc(150 * that.w, 430 * that.w, 50 * that.w, 0, 2 * Math.PI);
				ctx.fillStyle = "#000"
				ctx.font = "normal 12px Verdana";
				ctx.fillText(`${that.teacherInfo.name.split('')[0]}老师`, 90 * that.w, 578 * that.w)
				ctx.fillStyle = "#000"
				ctx.font = "normal 12px Verdana";
				ctx.fillText(`${that.teacherInfo.teaching_age}年教龄`, 290 * that.w, 578 * that.w)
				ctx.fillStyle = "#000"
				ctx.font = "normal 12px Verdana";
				ctx.fillText(
					`${that.teacherInfo.teaching_subject[0].grade_name}/${that.teacherInfo.teaching_subject[0].subject_name}`,
					90 * that.w, 608 * that.w)
				ctx.fillStyle = "#000"
				ctx.font = "normal 12px Verdana";
				ctx.fillText(`${that.teacherInfo.province}${that.teacherInfo.city}`, 290 * that.w, 608 * that.w)
				ctx.fillStyle = "#000"
				ctx.font = "normal 12px Verdana";
				var shenfen = ''
				switch (that.teacherInfo.teacher_identity) {
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
				ctx.fillText(`${that.teacherInfo.school}`, 290 * that.w, 698 * that.w)
				ctx.fillStyle = "#000"
				ctx.font = "normal 12px Verdana";
				if (that.teacherInfo.education.length > 6) {
					that.teacherInfo.education = that.teacherInfo.education.slice(0, 6) + '...'
				}
				ctx.fillText(`${that.teacherInfo.education}`, 90 * that.w,
					728 * that.w, )
				ctx.fillStyle = "#000"
				ctx.font = "normal 12px Verdana";
				if (that.teacherInfo.specialty.length > 8) {
					that.teacherInfo.specialty = that.teacherInfo.specialty.slice(0, 8) + '...'
				}
				ctx.fillText(`${that.teacherInfo.specialty}`, 290 * that.w,
					728 * that.w)
				ctx.fillStyle = "#000"
				ctx.font = "normal 12px Verdana";
				ctx.fillText(`${that.teacherInfo.teaching_subject[0].price*1+'元/每小时'}`, 90 * that.w, 818 * that.w)
				ctx.fillStyle = "#f99d07"
				ctx.font = "normal 10px Verdana";
				ctx.fillText(`长按识别二维码查看老师详细资料`, 90 * that.w, 848 * that.w)

				// ctx.fillStyle = "#f99d07"
				// ctx.font = "normal 9px Verdana";

				// ctx.fillText(`长按识别二维码查看老师详细资料`, 90 * that.w, 868 * that.w)





				uni.downloadFile({
					url: that.imgUrl + that.teacherInfo.qrcode,
					success(res1) {
						console.log(res1.tempFilePath)
						ctx.drawImage(res1.tempFilePath, 390 * that.w, 728 * that.w, 120 * that.w,
							120 * that
							.w)
						ctx.save()
						ctx.arc(150 * that.w, 430 * that.w, 50 * that.w, 0, 2 * Math.PI);
						ctx.strokeStyle = '#FFFFFF'
						ctx.stroke()
						ctx.clip()
						var headImg = ''
						if (that.teacherInfo.head_img.indexOf('http') != -1) {
							headImg = that.teacherInfo.head_img
						} else {
							headImg = that.imgUrl + that.teacherInfo.head_img
						}
						uni.downloadFile({
							url: headImg,
							success(res) {
								ctx.drawImage(res.tempFilePath, 100 * that.w, 380 * that.w,
									100 * that
									.w,
									100 * that
									.w)
								setTimeout(() => {
									ctx.draw(true, function() {
										uni.canvasToTempFilePath({
											canvasId: 'myCanvas',
											success(res2) {
												uni.hideLoading()
												console.log(res2)
												that.tempFilePath =
													res2
													.tempFilePath
											}
										})
									})
								}, 500)

							}
						})
					}

				})




			},
			async downloag(url) {
				uni.downloadFile({
					url,
					success(res) {
						console.log(res.tempFilePath)
						return res.tempFilePath
					},
					fail(err) {
						return err
					}
				})
			},
			shoucang() {
				if (!uni.getStorageSync('token')) {
					uni.navigateTo({
						url: '/my/getPhone/getPhone'
					})
					return
				}
				this.api('/user/addOrCancelCollect', 'post', {
					teacher_id: this.teacherInfo.teacher_id
				}).then(res => {
					console.log(res)
					this.isSc = !this.isSc
					uni.showToast({
						title: res.msg,
						icon: "none"
					})
				})
			},
			// 新增图片预览方法
			previewImage(index) {
				uni.previewImage({
					current: 0, // 当前点击的图片索引
					urls: [index], // 所有图片路径数组
					// loop: true // 支持循环预览
				});
			},
		}
	}
</script>

<style scoped>
	.link_icon {
		height: 60rpx;
		width: 60rpx;
		position: fixed;
		bottom: 300rpx;
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
		height: 200rpx;
		background-color: rgb(251, 100, 29);
		border-radius: 25rpx;
		text-align: center;
		line-height: 200rpx;
		position: absolute;
		left: 0;
		/* bottom: 120rpx !important; */
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


	.yellowBg2 {
		position: relative;

	}

	.yellowBg2 button {
		position: absolute;
		width: 100%;
		height: 100%;
		top: 0;
		left: 0;
		background-color: transparent;
	}

	.yellowBg2 button::after {
		display: none;
	}

	.yellowBg {
		position: relative;

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

	.wxssrpxbody {
		background: #f8f8f7;
	}

	.swiper {
		background: #fff;
	}

	.banner_tap,
	.swiper {
		width: 100%;
		height: 430rpx;
	}

	.banner {
		width: 100%;
		border-radius: 10rpx;
	}

	.teacher_content {
		display: flex;
		flex-direction: column;
		padding: 20rpx;
		background: #fff;
	}

	.teacher_content .item_box {
		display: flex;
		flex-direction: row;
		height: 60rpx;
		align-items: center;
	}

	.teacher_content .item_box .name {
		flex: 1;
		font-size: 32rpx;
		display: flex;
		align-items: center;
	}

	.teacher_content .item_box .yearName {
		font-size: 28rpx;
		display: flex;
		align-items: center;
	}

	.teacher_content .item_box .location {
		display: flex;
	}

	.teacher_content .sexIcon {
		width: 30rpx;
		height: 30rpx;
		margin-right: 6rpx;
	}

	.teacher_content .yellowbg {
		background: linear-gradient(90deg, #f1b832, #eca339);
		border-radius: 6rpx;
		padding: 2rpx;
		font-size: 20rpx;
		margin-left: 20rpx;
	}

	.teacher_content .item_box .cityName {
		font-size: 30rpx;
		margin-right: 10rpx;
		font-weight: 600;
	}

	.teacher_content .item_box .pice {
		color: red;
		font-size: 30rpx;
		font-weight: 600;
	}

	.item_box-desc {
		display: flex;
		flex-wrap: wrap;
	}

	.teacher_content .item_box-desc .border {
		border: 1rpx solid #009d8b;
		color: #009d8b;
		padding: 4rpx 10rpx;
		border-radius: 6rpx;
		text-align: center;
		font-size: 20rpx;
		margin-right: 10rpx;
		margin-bottom: 10rpx;
	}

	.school_bg {
		margin-top: 20rpx;
		position: relative;
		width: 100%;
		height: 180rpx;
	}

	.school_bg image {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: 0;
	}

	.techer-obj-box {
		display: flex;
		flex-direction: row;
		justify-content: space-around;
		margin-top: 10rpx;
	}

	.techer-obj {
		display: flex;
		flex-direction: column;
		flex: 1;
		align-items: center;
		margin-top: 20rpx;
	}

	.techer-obj .obj {
		font-size: 30rpx;
	}

	.techer-obj .time {
		margin-top: 40rpx;
		font-size: 24rpx;
	    white-space: normal;
	    display: -webkit-box;
	    -webkit-line-clamp: 1;
	    -webkit-box-orient: vertical;
	    overflow: hidden;	
	}

	.border-right {
		border-right: 1rpx solid #dbdbdb;
	}

	.teacher_content .item_box .name {
		font-size: 30rpx;
	}

	.teacher_content .item_box .name .dj {
		width: 35rpx;
		height: 35rpx;
	}

	.teacher_content .fontWeightW {
		font-weight: 600;
	}

	.pay_select {
		display: flex;
		margin: 15rpx 0;
		padding: 0 20rpx;
		flex-direction: row;
		height: 80rpx;
		align-items: center;
		background: #fff;
	}

	.pay_select .name {
		font-size: 26rpx;
		flex: 1;
	}

	.pay_select .now {
		font-size: 26rpx;
		margin-right: 10rpx;
		color: #fc9023;
	}

	.jt_icon {
		width: 15rpx;
		height: 20rpx;
	}

	.school_detail {
		display: flex;
		flex-direction: column;
		background: #fff;
		padding: 0 20rpx 20rpx;
		margin-bottom: 20rpx;
	}

	.school_detail .by_name {
		font-size: 30rpx;
		font-weight: 600;
		margin-top: 20rpx;
	}

	.school_detail .by_name image {
		width: 48rpx;
		height: 48rpx;
		margin-right: 10rpx;
	}

	.school_detail .school_name {
		font-size: 28rpx;
		margin: 20rpx 0;
		display: flex;
		flex-direction: row;
		align-items: center;
	}

	.school_detail .school_name .dian {
		width: 20rpx;
		height: 20rpx;
		border-radius: 50%;
		margin-right: 10rpx;
		background: #f1b833;
	}

	.school_detail .wordColor {
		color: #666;
	}

	.school_detail .school_name .time {
		font-size: 28rpx;
		flex: 2;
		margin-left: 10rpx;
	}

	.school_detail .school_name .zy {
		font-size: 28rpx;
		margin-right: 20rpx;
		flex: 1;
	}

	.school_detail .school_name .xl {
		font-size: 28rpx;
		margin-right: 20rpx;
		margin-left: 10rpx;
	}

	.school_detail .school_name .img {
		height: 60rpx;
		width: 60rpx;
		border-radius: 50%;
		margin-right: 20rpx;
	}

	.school_detail .pt_time {
		flex-direction: row;
		justify-content: flex-end;
		margin-right: 20rpx;
	}

	.school_detail .pt_time,
	.seeMode {
		color: #999;
		font-size: 24rpx;
		display: flex;
	}

	.seeMode {
		height: 60rpx;
	}

	.bottom_box,
	.seeMode {
		align-items: center;
		justify-content: center;
	}

	.bottom_box {
		position: fixed;
		bottom: 40rpx;
		left: 40rpx;
		display: flex;
		flex-direction: row;
		height: 120rpx;
		background: #e6b662;
		width: 90%;
		z-index: 5;
		border-radius: 20rpx;
	}

	.bottom_box .item {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		font-size: 26rpx;
	}

	.bottom_box .item .icon {
		height: 60rpx;
		width: 60rpx;
	}

	.search_list_box {
		margin-bottom: 40rpx;
	}

	.picture {
		display: flex;
		align-items: center;
		padding: 30rpx 20rpx;
		justify-content: space-around;
		background: #fff;
	}

	.picture .item {
		width: 220rpx;
		height: 220rpx;
	}

	.commet_box {
		width: 100%;
		max-height: 500rpx;
		overflow-y: scroll;
		padding: 20px 0;
	}

	.commet_box .commet_boxItem {
		width: 100%;
	}

	.commonimg,
	.honorimage {
		margin-top: 10rpx;
	}

	.red {
		color: red;
	}

	.jlItem {
		border-bottom: 1rpx solid #eee;
	}

	.teacher_img_box {
		white-space: nowrap;
	}

	.teacher_img {
		width: 220rpx;
		height: 200rpx;
		margin: 20rpx 1.5%;
		border-radius: 10rpx;
	}

	.helpMeBtn {
		display: flex;
		height: 80rpx;
		align-items: center;
		justify-content: center;
		border-radius: 40rpx;
		font-size: 35rpx;
		letter-spacing: 25rpx;
		background: linear-gradient(90deg, #eca33d, #f1b833);
		width: 60%;
		color: #41210d;
		font-weight: 600;
		margin: 40rpx 20%;
	}

	.bgImg {
		display: block;
		width: 100%;
		height: 366rpx;
	}

	.mine {
		margin-top: 44rpx;
	}

	.code,
	.mine {
		display: block;
		text-align: center;
		color: #333;
	}

	.code {
		font-size: 76rpx;
		font-weight: 700;
		margin-top: 30rpx;
	}

	.who {
		display: block;
		margin-top: 80rpx;
		font-size: 32rpx;
		color: #333;
	}

	.inputBox,
	.who {
		text-align: center;
	}

	.inputBox {
		margin-top: 44rpx;
	}

	.input {
		text-align: center;
		width: 440rpx;
		background: #f5f5f5;
	}

	.btn,
	.input {
		height: 88rpx;
		border-radius: 44rpx;
		font-size: 32rpx;
		display: inline-block;
	}

	.btn {
		width: 160rpx;
		background: linear-gradient(90deg, #ffe200, #ffc80b);
		box-shadow: 0 4px 8px 0 rgba(255, 200, 11, .5);
		color: #333;
		line-height: 88rpx;
		margin-left: 40rpx;
	}

	button[class="btn"]::after {
		border: 0;
	}

	.tishi {
		color: #999;
		margin-top: 30rpx;
	}

	.shareText,
	.tishi {
		display: block;
		text-align: center;
	}

	.shareText {
		color: #333;
		font-size: 28rpx;
		margin-top: 100rpx;
	}

	.imgBox {
		text-align: center;
		width: 100%;
		margin-top: 60rpx;
		padding-bottom: 120rpx;
	}

	.img {
		display: inline-block;
		width: 100%;
		height: 100%;
	}

	.m_l {
		margin-left: 180rpx;
	}

	.zfbtn {
		display: inline-block;
		width: 120rpx;
		height: 120rpx;
		border-radius: 50%;
		background: transparent;
		outline: none;
		padding: 0;
	}

	.zfbtn,
	button[class="zfbtn"]::after,
	button[class="zfbtn m_l"]::after {
		border: 0;
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
		z-index: 10;
	}

	.shengcheng {
		width: 90%;
		height: 80%;
		position: fixed;
		top: 50rpx;
		left: 45%;
		margin-left: -40%;
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
		bottom: 120rpx;
		left: 10%;
		background: #fb641d;
		color: #fff;
		font-size: 32rpx;
		border-radius: 44rpx;
	}

	button[class="baocun"]::after {
		border: 0;
	}

	.canvas22 {
		margin-left: 200rpx;
	}

	.noneCode {
		display: none;
	}

	.zw {
		height: 100rpx;
		width: 100%;
	}

	.teacherName {
		max-width: 250rpx;
		height: 40rpx;
		text-overflow: ellipsis;
		overflow: hidden;
		word-spacing: normal;
	}
	
	.pay_popboxconatianer {
						width: 100%;
	}		
			
						.show_paypop {
							width: 100%;
							padding: 30rpx;
			}
							.list_info {
								width: 100%;
								margin-top: 20rpx;
								display: flex;
								justify-content: space-between;
								background-color: #F5E5D8;
								padding: 20rpx 30rpx;
								border-radius: 18rpx;
								border: 1rpx solid rgba(156, 81, 15, 0.3);
			}
								.lf_infotext {
									display: flex;
									align-items: center;
			}
									.mst_text {
										font-size: 28rpx;
										color: #555555;
										// margin: auto 0;
			
									}
			
									.symble {
										color: #A5510F;
										font-size: 32rpx;
										margin: 20rpx 15rpx 0;
										font-weight: 600;
									}
			
									.big_text {
										color: #A5510F;
										font-size: 32rpx;
										// margin-top: 20rpx;
										margin-left: 20rpx;
										font-weight: 600;
									}
			
								.rf_pricetext {
									margin: auto 0;
								}
									.price_sym {
										font-size: 24rpx;
										color: #EB5750;
										margin-right: 8rpx;
										font-weight: 600;
									}
			
									.price_number {
										font-size: 54rpx;
										color: #EB5750;
										font-weight: 500;
									}
							 
			
							.pay_btnbox {
								width: 100%;
								}
								.pay_btnbox  text {
									width: 100%;
									display: block;
									margin-top: 50rpx;
									text-align: center;
									border-radius: 40rpx;
									padding: 20rpx 0;
									font-size: 32rpx;
									font-weight: 600;
									color: #A5510F;
									background-image: linear-gradient(to right, #FBDEB2, #EFB762);
								}
</style>