<template>
	<view>
		<view class="maskbigImg" v-if="isShowTip==1">
			<view class="maskbigImg1">
				<image class="skxzimg2" src="/static/images/xuzhi.png" mode="widthFix"></image>
				<image @click="cloneImg" class="clone" src="/static/images/guanbi.png" mode=""></image>
			</view>
			<view class="skxzgb-box">
				<text style="font-weight: bold;font-size: 32rpx;">{{timeOutNum}}s</text>

			</view>
		</view>
		<view class="tip tipbg">
			<image class="worring" src="/static/images/1321312.png"></image>
			我们将承诺保护你的隐私，请务必确保真实、有效的信息

		</view>
		<view class="shiming">
			<view class="item borDerLine">
				<view class="name-shiming">真实姓名<text class="redcolor">*</text>
				</view>
				<input :placeholder-class="isRed?'iptRed':''" class="input" maxlength="10" placeholder="请输入真实姓名"
					v-model="realName"></input>
			</view>
			<view class="item borDerLine">
				<view class="name-shiming">年龄<text class="redcolor">*</text>
				</view>
				<input :placeholder-class="isRed?'iptRed':''" v-model="aged" class="input" type="number" maxlength="18"
					placeholder="请输入真实年龄"></input>
			</view>
			<view class="item borDerLine">
				<view class="name-shiming">性别<text class="redcolor">*</text>
				</view>
				<picker @change="bindPickerChangeSex" class="selInput" :range="arrayArr">
					<view v-if="arrayArr[sexIndex]">{{arrayArr[sexIndex]}}</view>
					<view :class="isRed?'iptRed':''" v-else>请选择性别</view>
				</picker>
			</view>
		</view>
		<view class="item-header">
			<view class="title">头像<text class="redcolor">*</text>
			</view>
			<image class="img" :src="url+txPic" v-if="txPic!=''&&txPic.indexOf('http')==-1"
				style="width: 160rpx; height: 160rpx;"></image>
			<image class="img" :src="txPic" v-else style="width: 160rpx; height: 160rpx;"></image>
			<!-- @click="selectIdCardImg(5)" -->
			<!-- #ifdef MP-WEIXIN -->
			<view style="width: 160rpx; height: 160rpx;" class="upload" v-if="txPic==''">+
				<button open-type="chooseAvatar" @chooseavatar="chooseavatar"></button>
			</view>
			<!-- #endif -->
			<!-- #ifndef MP-WEIXIN -->
			<view @click="gettx" style="width: 160rpx; height: 160rpx;" class="upload" v-if="txPic==''">+

			</view>
			<!-- #endif -->
			<image @click="clearPic(5)" class="guanbi7" src="/static/images/guanbi.png" v-if="txPic!=''"></image>
		</view>
		<view class="item borDerLine">
			<view class="title">教龄<text class="redcolor">*</text>
			</view>
			<input :placeholder-class="isRed?'iptRed':''" class="value" v-model="jiaoling"
				placeholder="请输入数字，如1，2，3"></input>
		</view>

		<view class="zw"></view>
		<view class="item-title">在读/毕业院校
		</view>
		<view class="biyeyuanxiao">
			<view class="school borDerLine">
				<view class="school-name">院校名称<text class="redcolor">*</text>
				</view>
				<input :placeholder-class="isRed?'iptRed':''" v-model="school" class="input-right" maxlength="20"
					placeholder="请输入院校名称,20字以内"></input>
			</view>
			<view class="time">
				<view class="left">
					<view class="yuan"></view>
					<view class="line"></view>
					<view class="yuan"></view>
				</view>
				<view class="right">
					<view class="time1 borDerLine">
						<view class="biyeyuanxiaoName">开始时间</view>
						<picker @change="bindStartDateChange($event,1)" class="picker" end="2100-09-01" mode="date"
							start="1950-09-01">
							<view v-if="startTime">{{startTime}}</view>
							<view v-else :class="isRed?'iptRed':''">
								请选择时间
							</view>
						</picker>
					</view>
					<view class="time1 borDerLine">
						<view class="biyeyuanxiaoName">结束时间</view>
						<picker @change="bindStartDateChange($event,2)" class="picker" end="2100-09-01" mode="date"
							start="1950-09-01">
							<view v-if="endTime">{{endTime}}</view>
							<view v-else :class="isRed?'iptRed':''">
								请选择时间
							</view>
						</picker>
					</view>
				</view>
			</view>
			<view class="school borDerLine">
				<view class="name">学历<text class="redcolor">*</text>
				</view>
				<input :placeholder-class="isRed?'iptRed':''" v-model="education" class="input-right" maxlength="20"
					placeholder="请输入学历,20字以内"></input>
			</view>
			<view class="school borDerLine">
				<view class="name">专业<text class="redcolor">*</text>
				</view>
				<input :placeholder-class="isRed?'iptRed':''" v-model="specialty" class="input-right" maxlength="20"
					placeholder="请输入专业,20字以内"></input>
			</view>
		</view>
		<view class="zw"></view>
		<view class="item-title">个人照片<text class="redcolor">*</text>
		</view>
		<view class="myimgbox">
			<view class="tip11">每次只能选择1张上传,至少上传<text style="color: red;">3张生活照</text>,建议比例宽:高16:9</view>
			<view class="mypicup">
				<view class="picbox" v-for="(item,index) in picArr" :key="index">
					<image v-if="isShowTip==2" @click="delPic(index)" class="guanbi" src="/static/images/guanbi.png">
					</image>
					<image style="width:210rpx;height:210rpx;" class="img" :src="url+item"></image>
				</view>
				<view @click="selectPicImg" style="width:210rpx;height:210rpx;" class="upload">+</view>
				<!-- 		<view @click="selectPicImg" style="width:210rpx;height:210rpx;" class="upload">+</view>
				<view @click="selectPicImg" style="width:210rpx;height:210rpx;" class="upload">+</view> -->

			</view>
		</view>
		<view class="shiming">
			<view class="item borDerLine">
				<view class="name-shiming">联系方式<text class="redcolor">*</text>
				</view>
				<input :placeholder-class="isRed?'iptRed':''" v-model="phone" class="input" maxlength="11"
					placeholder="请输入联系方式"></input>
			</view>
			<view class="item borDerLine">
				<view class="name-shiming">籍贯<text class="redcolor">*</text>
				</view>
				<input :placeholder-class="isRed?'iptRed':''" class="input" type="text" v-model="birthplace"
					placeholder="请输入籍贯信息"></input>
			</view>
			<view class="item borDerLine">
				<view class="name-shiming">微信号
				</view>
				<input :placeholder-class="isRed?'iptRed':''" v-model="weChat" class="input" maxlength="30"
					placeholder="请输入微信号"></input>
			</view>
			<view class="item borDerLine">
				<view class="name-shiming">微信昵称<text class="redcolor">*</text>
				</view>
				<input :placeholder-class="isRed?'iptRed':''" class="input" type="nickname" v-model="weName"
					placeholder="请输入微信昵称"></input>
			</view>
			<view class="item borDerLine">
				<view class="name-shiming">电子邮箱<text class="redcolor">*</text>
				</view>
				<input :placeholder-class="isRed?'iptRed':''" class="input" type="text" v-model="mail"
					placeholder="请输入电子邮箱"></input>
			</view>

			<view class="item borDerLine">
				<view class="name-shiming">身份证号码<text class="redcolor">*</text>
				</view>
				<input :placeholder-class="isRed?'iptRed':''" v-model="idCard" class="input" maxlength="18"
					placeholder="请输入身份证号码"></input>
			</view>


			<view class="item borDerLine">
				<view class="name-shiming">身份<text class="redcolor">*</text>
				</view>
				<picker @change="bindPickerChangeWay" class="selInput" :range="arrayArrway">
					<view v-if="arrayArrway[sexIndexway]">{{arrayArrway[sexIndexway]}}</view>
					<view v-else :class="isRed?'iptRed':''">
						请选择身份
					</view>
				</picker>
			</view>
			<view class="item borDerLine" @click="openAddress">
				<view class="name-shiming">现所在区域<text class="redcolor">*</text>
				</view>
				<input :placeholder-class="isRed?'iptRed':''" v-model="latAddress" disabled="true" class="input"
					maxlength="18" placeholder="点击选择现所在区域"></input>
			</view>
		</view>


		<view class="zw"></view>
		<view class="comment_style">
			<view class="title">可授科目<text class="redcolor">*</text>
			</view>
			<view class="dateDetail" style="display: flex;flex-direction: column;align-items: flex-start;">
				<view class="" style="display: flex;justify-content: space-between;width:100%">
					<view class="day">主教</view>
					<picker @change="bindLev1" class="pickerVal pickerVal1" mode="selector" :range="categoryList1"
						range-key="name">
						<view class="pickerVal pickerVal1">{{kmLevel1name1||'请选择'}}
							<image class="link-icon45" src="/static/images/link-icon2.png"></image>
						</view>
					</picker>
					<picker @change="bindLev2" class="pickerVal pickerVal1" mode="selector" :range="gradeList1"
						range-key="name">
						<view class="pickerVal pickerVal1">{{kmLevel2name1||'请选择'}}
							<image class="link-icon45" src="/static/images/link-icon2.png"></image>
						</view>
					</picker>
					<picker @change="bindLev3" class="pickerVal pickerVal2" mode="selector" :range="subjectList1"
						range-key="name">
						<view class="pickerVal pickerVal2">{{kmLevel3name1||'请选择'}}
							<image class="link-icon45" src="/static/images/link-icon2.png"></image>
						</view>
					</picker>
				</view>
				<input style="width: 100%;" type="number" v-model="price1" placeholder="请输入课时费(每小时/元)">
			</view>
			<view class="dateDetail" style="display: flex;flex-direction: column;align-items: flex-start;">
				<view class="" style="display: flex;justify-content: space-between;width:100%">
					<view class="day">辅教</view>
					<picker @change="bindLeva1" class="pickerVal pickerVal1" mode="selector" :range="categoryList2"
						range-key="name">
						<view class="pickerVal pickerVal1">{{kmLevel1name2||'请选择'}}
							<image class="link-icon45" src="/static/images/link-icon2.png"></image>
						</view>
					</picker>
					<picker @change="bindLeva2" class="pickerVal pickerVal1" mode="selector" :range="gradeList2"
						range-key="name">
						<view class="pickerVal pickerVal1">{{kmLevel2name2||'请选择'}}
							<image class="link-icon45" src="/static/images/link-icon2.png"></image>
						</view>
					</picker>
					<picker @change="bindLeva3" class="pickerVal pickerVal2" mode="selector" :range="subjectList2"
						range-key="name">
						<view class="pickerVal pickerVal2">{{kmLevel3name2||'请选择'}}
							<image class="link-icon45" src="/static/images/link-icon2.png"></image>
						</view>
					</picker>
				</view>
				<input style="width: 100%;" type="number" v-model="price2" placeholder="请输入课时费(每小时/元)">
			</view>
			<view class="dateDetail" style="display: flex;flex-direction: column;align-items: flex-start;">
				<view class="" style="display: flex;justify-content: space-between;width:100%">
					<view class="day">辅教</view>
					<picker @change="bindLevb1" class="pickerVal pickerVal1" mode="selector" :range="categoryList3"
						range-key="name">
						<view class="pickerVal pickerVal1">{{kmLevel1name3||'请选择'}}
							<image class="link-icon45" src="/static/images/link-icon2.png"></image>
						</view>
					</picker>
					<picker @change="bindLevb2" class="pickerVal pickerVal1" mode="selector" :range="gradeList3"
						range-key="name">
						<view class="pickerVal pickerVal1">{{kmLevel2name3||'请选择'}}
							<image class="link-icon45" src="/static/images/link-icon2.png"></image>
						</view>
					</picker>
					<picker @change="bindLevb3" class="pickerVal pickerVal2" mode="selector" :range="subjectList3"
						range-key="name">
						<view class="pickerVal pickerVal2">{{kmLevel3name3||'请选择'}}
							<image class="link-icon45" src="/static/images/link-icon2.png"></image>
						</view>
					</picker>
				</view>
				<input style="width: 100%;" type="number" v-model="price3" placeholder="请输入课时费(每小时/元)">
			</view>
		</view>
		<image src="/static/images/jiagebiao.jpg" mode="" style="width: 100%;height: 300rpx;"></image>
		<!-- <view class="zw"></view> -->
		<view class="comment_style">
			<view class="title">授课时间<text class="redcolor">*</text>
			</view>
			<view class="timebox">
				<view class="cul">
					<view class="date-item">周一</view>
					<view class="date-item">周二</view>
					<view class="date-item">周三</view>
					<view class="date-item">周四</view>
					<view class="date-item">周五</view>
					<view class="date-item">周六</view>
					<view class="date-item">周日</view>
				</view>
				<view class="cul border-top">
					<view @click="selectDate(index)" :class="item.isSel?'yellbg':''" class="date-item"
						v-for="(item,index) in selArr" :key="index"></view>
				</view>
			</view>
			<view class="time_title">
				<view class="title_item">星期</view>
				<view class="title_item">开始时间</view>
				<view class="title_item">结束时间</view>
			</view>
			<view class="dateDetail" v-for="(item,index) in detailTiem" :key="index">
				<view class="day title_item2">{{item.week}}</view>
				<picker @change="bindTimeChange3($event,item)" class="picker" end="21:00" mode="time" start="08:00">
					<view>{{item.start_time}}</view>
				</picker>
				<picker @change="bindTimeChange4($event,item)" class="picker" end="21:00" mode="time" start="08:00">
					<view>{{item.end_time}}</view>
				</picker>
			</view>
		</view>
		<view class="zw"></view>
		<view class="item-title">个人标签（3个以下）<text class="redcolor">*</text>
		</view>
		<view class="box borDerLine">
			<view class="tiele_box">自定义：
				<input v-model="biaoqian" class="inputbq" maxlength="4" placeholder="请输入标签,最多4个字"></input>
				<image @click="addItem" class="addbq" src="/static/images/13213120.png"></image>
				<view @click="addItem" class="addbqw">添加</view>
			</view>
		</view>
		<view class="bordeR-line"></view>
		<view class="item_box">
			<view class="list_box" v-for="(item,index) in biaoqianArr" :key="index">
				<view class="list-item">{{item}}</view>
				<image @click="delBiaoQian(index)" class="guanbiimg" src="/static/images/guanbi.png"></image>
			</view>
		</view>
		<view class="zw"></view>
		<view class="item-title">可授课区域<text class="redcolor">*</text>
		</view>
		<view class="tip11" v-if="cityArr3.length>0">已选可授课城市:</view>
		<view class="item_box">
			<view class="list_box" v-for="(item,index) in cityArr3" :key="index">
				<view class="list-item">{{item}}</view>
				<image @click="delcs(index)" class="guanbiimg" src="/static/images/guanbi.png">
				</image>
			</view>
		</view>
		<view class="sel-box">
			<view class="section">
				<picker @change="bindMultiPickerChange" @columnchange="bindMultiPickerColumnChange" mode="multiSelector"
					:range="provinceList" range-key="name">
					<view class="city-picker">
						请选择
						<image class="link-icon2" src="/static/images/link-icon2.png"></image>
					</view>
				</picker>
			</view>
			<view class="data">
				<view class="tip" v-if="cityArr.length==0">请先选择左边城市</view>
				<view @click="selCity(item)" :class="item.isSel==1?'select_item_color':''" class="city2"
					v-for="(item,index) in cityArr" :key="index">{{item.name}}</view>
			</view>
		</view>
		<view class="zw"></view>
		<view class="item-title">自我介绍<text class="redcolor">*</text>
			<!-- <view @click="addData">
				<image class="addjl" src="/static/images/13213120.png"></image>
				<view class="addjlw">添加介绍</view>
			</view> -->
		</view>
		<view style="margin-bottom:20rpx;background: white;" v-for="(item,index) in dataArr" :key="index">
			<!-- <view class="title borDerLine">
				<view>{{'自我介绍'+(index+1)}}</view>
				<input v-model="item.title" class="input-right" maxlength="-1" placeholder="请输入标题，20字以内"></input>
			</view> -->
			<!-- 	<view class="time">
				<view class="left">
					<view class="yuan"></view>
					<view class="line"></view>
					<view class="yuan"></view>
				</view>
				<view class="right">
					<view class="time1 borDerLine">
						<view class="name">开始时间</view>
						<picker @change="bindjlStartDateChange($event,item)" class="picker" end="2100-09-01"
							mode="date" start="1950-09-01">
							<view style="width:100%;height:58rpx">{{item.start_time||'请选择时间'}}</view>
						</picker>
					</view>
					<view class="time1 borDerLine">
						<view class="name">结束时间</view>
						<picker @change="bindjlEndDateChange($event,item)" class="picker" end="2100-09-01"
							mode="date" start="1950-09-01">
							<view style="width:100%;height:58rpx">{{item.end_time||'请选择时间'}}</view>
						</picker>
					</view>
				</view>
			</view> -->
			<view class="text borDerLine" style="height:250rpx;padding:20rpx;">
				<textarea style="width:90%;heigh:200rpx" v-model="item.experience" class="jlinput" maxlength="-1"
					placeholder="您曾任职的单位、岗位、具体教学对象和内容等"></textarea>
			</view>
			<view class="item-title">家教经验<text class="redcolor">*</text>
			</view>
			<!-- 	<view class="title borDerLine">标题 <input v-model="suctitle" class="input-right" maxlength="20"
					placeholder="请输入标题，20字以内"></input>
			</view> -->
			<textarea v-model="sucontent" style="padding:20rpx;text-indent:0;" class="textarea borDerLine textareas"
				maxlength="-1" placeholder="您曾取得的教学成效、科研成果等"></textarea>
			<!-- <view class="delete_box">
				<view @click="deleteData(index)" class="delete">删除介绍</view>
			</view> -->
		</view>
		<view class="" style="width: 100%;display: flex;flex-direction: column;align-items: center;"
			v-if="showInfo==1&&teacherId" @click="showInfo=2">
			<text>完善简历</text>
			<text> (点击完善简历，让更多的家长选择您)</text>
		</view>
		<block v-if="showInfo==2">

			<view class="pic_box">
				<view class="name">身份证照<text class="redcolor" v-if="id_card_required==1">*</text>
			 </view>
				<view class="tip">请上传身份证照片,须看清证件号码及照片,请把证件号码后六位打码，把姓名最后一个字打码
				</view>
				<view class="upload_box">
					<image class="img-pic" :src="url+zmidPic" v-if="zmidPic!=''"></image>
					<view @click="selectIdCardImg(1)" class="upload-pic" v-if="zmidPic==''">+</view>
					<image class="img-pic img-pic-mar" :src="url+fmidPic" v-if="fmidPic!=''"></image>
					<view @click="selectIdCardImg(2)" class="upload-pic img-pic-mar" v-if="fmidPic==''">+
					</view>
					<image @click="clearPic(1)" class="guanbi5" src="/static/images/guanbi.png" v-if="zmidPic!=''">
					</image>
					<image @click="clearPic(2)" class="guanbi6" src="/static/images/guanbi.png" v-if="fmidPic!=''">
					</image>
				</view>
			</view>
			<view class="sf-name">
				<view class="sfzm">身份证正面</view>
				<view class="sfzm">身份证背面</view>
			</view>
			<view class="pic_box">
				<!-- v-if="student_card_required==1" -->
				<view class="name">毕业证书/学生证<text class="redcolor">*</text>
				</view>
				<view class="tip">请上传毕业证书或学生证，须看清证书编号。请把证件号码后六位打码，把姓名最后一个字打码
				</view>
				<view class="upload_box">
					<image class="img-pic" :src="url+byPic" v-if="byPic!=''"></image>
					<view @click="selectIdCardImg(3)" class="upload-pic" v-if="byPic==''">+</view>
					<view class="img-pic img-pic-mar"></view>
					<image @click="clearPic(3)" class="guanbi5" src="/static/images/guanbi.png" v-if="byPic!=''">
					</image>
				</view>
			</view>

			<view class="pic_box">
				<view class="name">教师资格证<text class="redcolor" v-if="itic_required==1">*</text>
				</view>
				<view class="tip">请把证件号码后六位打码，把姓名最后一个字打码
				</view>
				<view class="upload_box">
					<image class="img-pic" :src="url+teacherPic" v-if="teacherPic!=''"></image>
					<view @click="selectIdCardImg(4)" class="upload-pic" v-if="teacherPic==''">+</view>
					<view class="img-pic img-pic-mar"></view>
					<image @click="clearPic(4)" class="guanbi5" src="/static/images/guanbi.png" v-if="teacherPic!=''">
					</image>
				</view>
			</view>

			<view class="pic_box">
				<view class="name">学信网<text class="redcolor" >*</text></view>
<view class="tip">请把证件号码后六位打码，把姓名最后一个字打码
				</view>	
				<view class="upload_box">
					<image class="img-pic" :src="url+chsi_img" v-if="chsi_img!=''"></image>
					<view @click="selectIdCardImg(14)" class="upload-pic" v-if="chsi_img==''">+</view>
					<view class="img-pic img-pic-mar"></view>
					<image @click="clearPic(14)" class="guanbi5" src="/static/images/guanbi.png" v-if="chsi_img!=''">
					</image>
				</view>
			</view>


			<view class="item-title">所获证书</view>
			<view claa="box">
				<view class="imgbox borDerLine" style="border-radius: 0;">
					<textarea style="height: 150rpx;" v-model="honor" class="textarea2" maxlength="-1"
						placeholder="请输入所获证书详情。"></textarea>
				</view>
				<view class="mypicup" style="background-color: #fff;">
					<view class="picbox" v-for="(item,index) in picArr1" :key="index">
						<image v-if="isShowTip==2" style="margin-left: 50rpx;" @click="delPic1(index)" class="guanbi"
							src="/static/images/guanbi.png">
						</image>
						<image class="img" :src="url+item"></image>
					</view>
					<view style="margin-left: 50rpx;" @click="selectPicImg1" class="upload">+</view>
				</view>
			</view>

			<view class="item-title">职称</view>
			<view class="title borDerLine">教师职称
				<input v-model="zhichen" class="input-right" placeholder="请输入职称"></input>
			</view>
			<view class="pic_box">
				<view class="bordeR-line"></view>
				<view class="upload_box">
					<view class="zhicheng">教师职称证书</view>
					<image class="img-pic" :src="url+zhichengPic" v-if="zhichengPic&&zhichengPic!=''"></image>
					<view @click="selectIdCardImg(6)" class="upload-pic" v-else>+</view>
					<image @click="clearPic(6)" class="guanbi6" src="/static/images/guanbi.png"
						v-if="zhichengPic&&zhichengPic!=''"></image>
				</view>
			</view>
			<view class="item-title">个人视频/作品视频
				<view class="tip11">上传视频更容易获得家长青睐哦</view>
			</view>
			<view class="imgbox">
				<view style="font-size: 20rpx;width: 100%;margin-top: 10rpx;">1、最多上传1个视频，建议视频120秒内</view>
				<view style="font-size: 20rpx;width: 100%;margin-top: 10rpx;">2、视频内容可以是老师的个人介绍/教学展示/作品展示</view>
				<view style="font-size: 20rpx;width: 100%;margin-top: 10rpx;">3、视频开头介绍统一话术：各位家长学生大家好，我是献新家教的XX老师...
				</view>
				<view class="videobox" v-if="isShowTip==2">
					<image @click="delVideo" class="guanbi2" src="/static/images/guanbi.png"></image>
					<video class="video" :src="url+videoUrl"></video>
				</view>
				<view style="display: flex;flex-direction: column;">
					<view style="height: 40rpx;"></view>
					<view @click="selectVideo" class="uploadVideo">+</view>
				</view>
				<view class="uploadStatus" v-if="isShowUpload">上传中，请稍后...</view>
			</view>
		</block>
		<view class="" style="width: 100%;text-align: center;margin: 20rpx 0;">
			<text v-if="status==0" style="color: yellow; font-size: 34rpx;">审核中</text>
			<text v-if="status==1" style="color: green;font-size: 34rpx;">审核通过</text>
			<text v-if="status==2" style="color: red;font-size: 34rpx;">审核未通过</text>
		</view>
		<view class="" style="display: flex;align-items: center;width: 100%;justify-content: center;margin-top: 30rpx;">
			<image @click="check=true" v-if="!check"
				style="width: 40rpx;height: 40rpx;border-radius: 50%;margin-right: 20rpx;"
				src="/static/images/check.png" mode="">
			</image>
			<image @click="check=false" v-else
				style="width: 40rpx;height: 40rpx;border-radius: 50%;margin-right: 20rpx;"
				src="/static/images/checked.png" mode="">
			</image>
			<text @click="check=!check">本人已详细阅读并同意以上内容</text>
			<text @click="toConvention" style="color:#f8c400 ;">
				《协议》
			</text>
		</view>
		<view class="zw"></view>
		<view class="submit-box" style="border:none;">
			<view @click="submit" class="btn btnbg1" style="margin: 0;">提交审核</view>
			<view @click="formSubmit" class="seemap">
				<image class="addressIcon" src="/static/images/22.png"></image>分享简历
			</view>
		</view>
		<view class="zw"></view>

		<view class="haibao" v-if="showCanvas" @click="showCanvas=false">
			<view class="hais" @click.stop="">
				<canvas style="width: 570rpx;height: 910rpx;" id="myCanvad" canvas-id="myCanvad"></canvas>
			</view>
			<view class="baocun" @click.stop="saveImg">
				<text>保存到相册</text>
			</view>
		</view>

	</view>
</template>

<script>
	export default {
		data() {
			return {
				check: false,
				isRed: false,
				showInfo: 1,
				isShowTip: uni.getStorageSync('isShowTip') || 1,
				isShowGb: true,
				timeOutNum: 15,
				userInfo: {},
				phone: "",
				realName: '',
				//头像
				txPic: '',
				weChat: "",
				birthplace: "",
				weName: '',
				idCard: "",
				jiaoling: '',
				arrayArr: ["男", "女"],
				sexIndex: '',
				zmidPic: "",
				fmidPic: "",
				byPic: '',
				teacherPic: '',
				categoryList1: [],
				kmLevel1name1: "",
				gradeList1: [],
				kmLevel2name1: "",
				subjectList1: [],
				kmLevel3name1: "",
				categoryList2: [],
				kmLevel1name2: "",
				gradeList2: [],
				kmLevel2name2: "",
				subjectList2: [],
				kmLevel3name2: "",
				categoryList3: [],
				kmLevel1name3: "",
				gradeList3: [],
				kmLevel2name3: "",
				subjectList3: [],
				kmLevel3name3: "",
				cateId1: '',
				gradId1: '',
				subjId1: '',
				cateId2: '',
				gradId2: '',
				subjId2: '',
				cateId3: '',
				gradId3: '',
				subjId3: '',
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
				school: '',
				aged: '',
				startTime: '',
				endTime: '',
				education: '',
				specialty: '',
				dataArr: [{
					title: '',
					start_time: '',
					end_time: '',
					experience: ''
				}],
				suctitle: '',
				sucontent: '',
				honor: '',
				zhichen: '',
				zhichengPic: '',
				//标签
				biaoqian: '',
				biaoqianArr: [],

				//个人照片
				picArr: [],
				picArr1: [],
				videoUrl: '',
				provinceList: [],
				cityArr: [],
				cityArr3: [],
				proName1: '',
				proName2: '',
				chsi_img: '',

				loginBtn: "保存二维码到相册",
				isShowUpload: false,
				tabArr: [{
					status: 1,
					isLast: 0,
					name: "实名认证"
				}, {
					status: 0,
					isLast: 0,
					name: "证书认证"
				}, {
					status: 0,
					isLast: 0,
					name: "授课设置"
				}, {
					status: 0,
					isLast: 1,
					name: "个人资料"
				}],
				teacherType: [{
					name: "专职老师",
					isSel: 0,
					id: 3
				}, {
					name: "大学生",
					isSel: 0,
					id: 4
				}],

				typeName: "",
				name: "",
				sex: "",
				index: "",
				arrayArrway: ['大学生教员', '专业教员'],
				sexIndexway: '',
				JlPic: [],
				scidPic: "",
				status: NaN,
				teacherId: '',
				url: this.imgUrl,
				price1: '',
				price2: '',
				price3: '',
				latAddress: '',
				longitude: '',
				latitude: '',
				id_card_required: '',
				student_card_required: '',
				itic_required: '',
				timer: '',
				showCanvas: '',
				tempFilePath: '',
				teacherInfo: {},
				mail: '',
				isSubmit: false
			}
		},
		onLoad(options) {
			if (options.showInfo) {
				this.showInfo = options.showInfo
			}
			this.showBigImg()
			this.userInfo = uni.getStorageSync('user')
			//学科
			this.getCategoryList()
			//城市
			this.getProvinceList()
			if (uni.getStorageSync('user') && uni.getStorageSync('user').teacher_info) {
				this.teacherId = uni.getStorageSync('user').teacher_info.teacher_id

				this.getTeacherInfo()
			} else {
				this.phone = this.userInfo && this.userInfo.mobile
				// this.txPic = this.userInfo.avatar
			}
			const system = uni.getSystemInfoSync()
			const w = system.windowWidth / 750
			this.w = w
		},
		onShow() {

			if (uni.getStorageSync('names')) {
				this.latAddress = uni.getStorageSync('names')
			}
			if (uni.getStorageSync('longitudes')) {
				this.longitude = uni.getStorageSync('longitudes')
			}
			if (uni.getStorageSync('latitudes')) {
				this.latitude = uni.getStorageSync('latitudes')
			}
			this.getFieldStatus()
		},
		onShareAppMessage() {
			return {
				title: this.realName.charAt(0) + '老师',
				path: '/pages/teacherDetail/teacherDetail?id=' + this.teacherId,
			}

		},
		onShareTimeline() {
			return {
				title: this.realName.charAt(0) + '老师',
				path: '/pages/teacherDetail/teacherDetail?id=' + this.teacherId,
			}
		},
		methods: {
			toConvention() {
				uni.navigateTo({
					url: '/my/convention/convention'
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
			async formSubmit() {




				if (this.status == 0) {
					uni.showToast({
						title: '简历审核中',
						icon: 'none'
					})
					return
				} else if (this.status == 2) {
					uni.showToast({
						title: '简历审核未通过',
						icon: 'none'
					})
					return
				} else if (this.status == 1) {
					uni.showLoading({
						title: '生成中...'
					})
					this.showCanvas = true
					let that = this
					const ctx = uni.createCanvasContext('myCanvad')
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
					ctx.fillText(`学习方式`, 110 * that.w, 777 * that.w, )

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
					ctx.arc(150 * that.w, 450 * that.w, 50 * that.w, 0, 2 * Math.PI);
					ctx.fillStyle = "#000"
					ctx.font = "normal 12px Verdana";
					ctx.fillText(`${that.teacherInfo.age}岁`, 300 * that.w, 472 * that.w)
					ctx.arc(150 * that.w, 450 * that.w, 50 * that.w, 0, 2 * Math.PI);
					ctx.fillStyle = "#000"
					ctx.font = "normal 12px Verdana";
					ctx.fillText(`${that.teacherInfo.name.split('')[0]}教员`, 90 * that.w, 578 * that.w)
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
					ctx.fillText(`${that.teacherInfo.city}`, 290 * that.w, 608 * that.w)
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
					ctx.fillText(`${that.teacherInfo.education}`, 90 * that.w, 728 * that.w)
					ctx.fillStyle = "#000"
					ctx.font = "normal 12px Verdana";
					ctx.fillText(`${that.teacherInfo.specialty}`, 290 * that.w, 728 * that.w)
					ctx.fillStyle = "#000"
					ctx.font = "normal 12px Verdana";
					ctx.fillText(`${that.teacherInfo.teaching_subject[0].price*1+'元/每小时'}`, 90 * that.w, 810 * that.w)
					ctx.fillStyle = "#000"
					ctx.font = "normal 12px Verdana";
					ctx.fillText(`长按识别小程序码献新家教`, 90 * that.w, 838 * that.w)




					uni.downloadFile({
						url: that.imgUrl + that.teacherInfo.qrcode,
						success(res1) {
							console.log(res1.tempFilePath)
							ctx.drawImage(res1.tempFilePath, 390 * that.w, 728 * that.w, 120 * that.w,
								120 * that
								.w)
							ctx.save()
							ctx.arc(150 * that.w, 450 * that.w, 50 * that.w, 0, 2 * Math.PI);
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
									ctx.drawImage(res.tempFilePath, 100 * that.w, 400 * that.w, 100 *
										that
										.w, 100 * that.w)
									setTimeout(() => {
										ctx.draw(false, function() {
											console.log(222)
											uni.canvasToTempFilePath({
												canvasId: 'myCanvad',
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



				} else {
					uni.showToast({
						title: '请提交简历',
						icon: 'none'
					})
				}

			},
			getFieldStatus() {
				this.api('/index/getFieldStatus', 'post').then(res => {
					this.id_card_required = res.data.id_card_required
					this.student_card_required = res.data.student_card_required
					this.itic_required = res.data.itic_required
				})
			},
			showBigImg() {
				if (this.isShowTip == 1) {
					this.timeOutNum = 15
					this.timer = setInterval(() => {
						// if (this.timeOutNum <= 10) {
						// 	this.isShowGb = false
						// }
						// if (this.timeOutNum <= 0) {
						// 	this.isShowTip = 2
						// 	uni.setStorageSync('isShowTip', 2)
						// 	clearInterval(this.timer)
						// }
						if (this.timeOutNum <= 0) {
							this.isShowTip = 2
							uni.setStorageSync('isShowTip', 2)
							clearInterval(this.timer)
						}
						this.timeOutNum = this.timeOutNum - 1

					}, 1000)
				}
			},
			cloneImg() {
				this.isShowTip = 2
				uni.setStorageSync('isShowTip', 2)
				clearInterval(this.timer)
			},
			chooseavatar(e) {
				let that = this
				uni.uploadFile({
					url: that.imgUrl + '/Base/upload',
					filePath: e.detail.avatarUrl,
					name: 'image',
					success(res) {
						console.log(res)
						that.txPic = JSON.parse(res.data).data
					}
				})
				console.log(e)

			},
			openAddress() {
				let that = this
				uni.getSetting({
					success(res) {
						console.log("res: ", res);
						if (res.authSetting['scope.userLocation']) {
							uni.chooseLocation({
								success(e) {
									that.latAddress = e.name
									that.longitude = e.longitude
									that.latitude = e.latitude
								}
							})
						} else {
							that.auth()
						}
					}
				})
			},
			auth() {
				let that = this
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
			getTeacherInfo() {
				if (this.teacherId) {
					this.api('/index/getTeacherInfo', 'post', {
						teacher_id: this.teacherId
					}).then(res => {
						let data = res.data
						this.teacherInfo = data
						console.log(res)
						if (data.mail) {
							this.mail = data.mail
						}
						this.aged = data.age
						this.status = data.status
						if (data.status == 1) {
							uni.setNavigationBarTitle({
								title: '注册成功,审核通过'
							})
						}
						this.phone = data.mobile
						this.weChat = data.wechat
						this.birthplace = data.birthplace
						this.weName = data.nickname
						this.realName = data.name
						this.idCard = data.id_number
						this.sexIndex = data.gender * 1 - 1
						this.zmidPic = data.id_card_zheng
						this.fmidPic = data.id_card_fan
						this.byPic = data.diploma_img
						this.teacherPic = data.itic_img
						this.txPic = data.head_img
						this.jiaoling = data.teaching_age
						this.teacherInfo.teaching_subject = data.teaching_subject
						this.teacherInfo.qrcode = data.qrcode
						data.teaching_subject.forEach(item => {
							if (item.is_main == 1 && item.subject_name) {
								this.kmLevel1name1 = item.category_name
								this.kmLevel2name1 = item.grade_name
								this.kmLevel3name1 = item.subject_name
								this.cateId1 = item.category_id
								this.gradId1 = item.grade_id
								this.subjId1 = item.subject_id
								this.price1 = item.price
							} else {
								if (item.subject_name) {
									if (this.kmLevel1name2) {
										this.kmLevel1name3 = item.category_name
										this.kmLevel2name3 = item.grade_name
										this.kmLevel3name3 = item.subject_name
										this.cateId3 = item.category_id
										this.gradId3 = item.grade_id
										this.subjId3 = item.subject_id
										this.price3 = item.price
										return
									}
									this.kmLevel1name2 = item.category_name
									this.kmLevel2name2 = item.grade_name
									this.kmLevel3name2 = item.subject_name
									this.cateId2 = item.category_id
									this.gradId2 = item.grade_id
									this.subjId2 = item.subject_id
									this.price2 = item.price
								}
							}
						})
						data.schooltime.forEach(item => {
							this.selArr.forEach(item1 => {
								if (item.week == item1.time) {
									item1.isSel = true
									this.detailTiem.push(item)
								}
							})
						})
						this.school = data.school
						this.chsi_img = data.chsi_img
						this.startTime = data.school_start_time
						this.endTime = data.school_end_time
						this.education = data.education
						this.specialty = data.specialty
						this.dataArr = []
						data.experience.forEach(item => {

							this.dataArr.push(item)
						})
						this.suctitle = data.successful_case_title
						this.sucontent = data.successful_case
						this.honor = data.honor
						this.zhichen = data.teacher_title
						this.zhichengPic = data.teacher_title_img
						this.biaoqianArr = data.label.split(',')
						this.cityArr3 = data.area.split(',')
						this.proName1 = data.province
						this.proName2 = data.city
						this.sexIndexway = data.teacher_identity * 1 - 1
						if (data.honor_img) {
							data.honor_img.forEach(item => {
								this.picArr1.push(item)
							})
						}

						data.photos.forEach(item => {
							this.picArr.push(item)
						})
						this.videoUrl = data.works
					})
				} else {
					this.phone = this.userInfo.mobile
					// this.txPic = this.userInfo.avatar
				}

			},
			submit() {
				if (this.isSubmit) {
					return
				}
				if (!this.check) {
					uni.showToast({
						title: '请阅读并同意协议',
						icon: "none"
					})
					return
				}

				this.isRed = true
				if (!this.phone) {
					uni.showToast({
						title: '请输入联系方式',
						icon: "none"
					})
					return
				}

				if (!this.weName) {
					uni.showToast({
						title: '请输入微信昵称',
						icon: "none"
					})
					return
				}
				if (!this.mail) {
					uni.showToast({
						title: '请输入电子邮箱',
						icon: "none"
					})
					return
				}
				if (!this.realName) {
					uni.showToast({
						title: '请输入真实姓名',
						icon: "none"
					})
					return
				}
				if (!this.idCard) {
					uni.showToast({
						title: '请输入身份证号',
						icon: "none"
					})
					return
				}
				if (this.sexIndex != 0 && this.sexIndex != 1) {
					uni.showToast({
						title: '请选择性别',
						icon: "none"
					})
					return
				}
				if (!this.aged) {
					uni.showToast({
						title: '请选择输入真实年龄',
						icon: "none"
					})
					return
				}
				if (this.sexIndexway == '' && this.sexIndexway != 0) {
					uni.showToast({
						title: '请选择身份',
						icon: "none"
					})
					return
				}
				if (!this.latAddress) {
					uni.showToast({
						title: '请选择现所在区域',
						icon: "none"
					})
					return
				}
				if (this.showInfo == 2) {
					// if (!this.zmidPic) {
					// 	uni.showToast({
					// 		title: '请上传身份证正面',
					// 		icon: "none"
					// 	})
					// 	return
					// }
					// if (!this.fmidPic) {
					// 	uni.showToast({
					// 		title: '请上传身份证反面',
					// 		icon: "none"
					// 	})
					// 	return
					// }
					// if (this.id_card_required == 1) {

					// }
					if ((!this.byPic) && (!this.teacherPic)) {
						uni.showToast({
							title: '请上传毕业证书/学生证或教师资格证',
							icon: "none"
						})
						return
					}
				}


				// if (this.student_card_required == 1) {
				// 	if (!this.byPic) {
				// 		uni.showToast({
				// 			title: '请上传毕业证书/学生证',
				// 			icon: "none"
				// 		})
				// 		return
				// 	}
				// }
				// if (this.itic_required == 1) {
				// 	if (!this.teacherPic) {
				// 		uni.showToast({
				// 			title: '请上传教师资格证',
				// 			icon: "none"
				// 		})
				// 		return
				// 	}
				// }
				// if (!this.chsi_img) {
				// 	uni.showToast({
				// 		title: '请上传学信网截图',
				// 		icon: "none"
				// 	})
				// 	return
				// }
				// if (!this.teacherPic) {
				// 	uni.showToast({
				// 		title: '请上传教师资格证',
				// 		icon: "none"
				// 	})
				// 	return
				// }
				if (!this.txPic) {
					uni.showToast({
						title: '请上传头像',
						icon: "none"
					})
					return
				}
				if (!this.jiaoling) {
					uni.showToast({
						title: '请输入教龄',
						icon: "none"
					})
					return
				}
				if ((!this.cateId1 || !this.gradId1 || !this.subjId1) && (!this.cateId2 || !this.gradId2 || !this
						.subjId2) && (!
						this.cateId3 || !this.gradId3 || !this.subjId3)) {
					uni.showToast({
						title: '请至少选择一条授课科目',
						icon: "none"
					})
					return
				}
				if (this.cateId1 && this.gradId1 && this.subjId1) {
					if (!this.price1) {
						uni.showToast({
							title: '请填写课时费',
							icon: "none"
						})
						return
					}
				}
				if (this.cateId2 && this.gradId2 && this.subjId2) {
					if (!this.price2) {
						uni.showToast({
							title: '请填写课时费',
							icon: "none"
						})
						return
					}
				}
				if (this.cateId3 && this.gradId3 && this.subjId3) {
					if (!this.price3) {
						uni.showToast({
							title: '请填写课时费',
							icon: "none"
						})
						return
					}
				}
				if (this.detailTiem.length <= 0) {
					uni.showToast({
						title: '请选择授课时间',
						icon: "none"
					})
					return
				}
				if (!this.school) {
					uni.showToast({
						title: '请输入院校名称',
						icon: "none"
					})
					return
				}
				if (!this.startTime) {
					uni.showToast({
						title: '请选择院校时间',
						icon: "none"
					})
					return
				}
				if (!this.endTime) {
					uni.showToast({
						title: '请选择院校时间',
						icon: "none"
					})
					return
				}
				if (!this.education) {
					uni.showToast({
						title: '请输入学历',
						icon: "none"
					})
					return
				}
				if (!this.specialty) {
					uni.showToast({
						title: '请输入专业',
						icon: "none"
					})
					return
				}
				// if (!this.dataArr[0].title) {
				// 	uni.showToast({
				// 		title: '请输入教学经历标题',
				// 		icon: "none"
				// 	})
				// 	return
				// }
				// if (!this.dataArr[0].start_time) {
				// 	uni.showToast({
				// 		title: '请输入教学经历时间',
				// 		icon: "none"
				// 	})
				// 	return
				// }
				// if (!this.dataArr[0].end_time) {
				// 	uni.showToast({
				// 		title: '请输入教学经历时间',
				// 		icon: "none"
				// 	})
				// 	return
				// }
				// if (!this.dataArr[0].experience) {
				// 	uni.showToast({
				// 		title: '请输入教学经历内容',
				// 		icon: "none"
				// 	})
				// 	return
				// }


				if (!this.sucontent) {
					uni.showToast({
						title: '请输入家教经验',
						icon: "none"
					})
					return
				}

				if (this.biaoqianArr.length <= 0) {
					uni.showToast({
						title: '请添加个人标签',
						icon: "none"
					})
					return
				}
				if (this.cityArr3.length <= 0) {
					uni.showToast({
						title: '请添加授课区域',
						icon: "none"
					})
					return
				}
				if (this.picArr.length <= 0) {
					uni.showToast({
						title: '请上传个人照片',
						icon: "none"
					})
					return
				}
				if (!this.dataArr[0].experience) {
					uni.showToast({
						title: '请填写自我介绍',
						icon: "none"
					})
					return
				}
				let data = {
					mail: this.mail,
					age: this.aged,
					mobile: this.phone,
					name: this.realName,
					wechat: this.weChat,
					birthplace: this.birthplace,
					nickname: this.weName,
					id_number: this.idCard,
					gender: this.sexIndex * 1 + 1,
					id_card_zheng: this.zmidPic,
					id_card_fan: this.fmidPic,
					diploma_img: this.byPic,
					itic_img: this.teacherPic,
					head_img: this.txPic,
					teaching_age: this.jiaoling,
					teaching_subject_json: JSON.stringify([{
						is_main: 1,
						category_id: this.cateId1,
						grade_id: this
							.gradId1,
						subject_id: this.subjId1,
						price: this.price1
					}, {
						is_main: 0,
						category_id: this.cateId2,
						grade_id: this
							.gradId2,
						subject_id: this.subjId2,
						price: this.price2
					}, {
						is_main: 0,
						category_id: this.cateId3,
						grade_id: this
							.gradId3,
						subject_id: this.subjId3,
						price: this.price3
					}]),
					schooltime_json: JSON.stringify(this.detailTiem),
					school: this.school,
					school_start_time: this.startTime,
					school_end_time: this.endTime,
					education: this.education,
					specialty: this.specialty,
					experience_json: JSON.stringify(this.dataArr),
					successful_case_title: this.suctitle,
					successful_case: this.sucontent,
					honor: this.honor,
					teacher_title: this.zhichen,
					teacher_title_img: this.zhichengPic,
					label: this.biaoqianArr.join(','),
					photos: this.picArr.join(','),
					honor_img: this.picArr1.join(','),
					works: this.videoUrl,
					province: this.proName1,
					city: this.proName2,
					area: this.cityArr3.join(','),
					teacher_identity: this.sexIndexway * 1 + 1,
					longitude: this.longitude,
					latitude: this.latitude,
					chsi_img: this.chsi_img

				}
				this.isSubmit = true
				this.api('/user/teacherReg', 'post', data).then(res => {
					this.isSubmit = false
					console.log(res)
					if (res.status == 200) {
						uni.setStorageSync('names', this.latAddress)
						uni.setStorageSync('longitudes', this.longitude)
						uni.setStorageSync('latitudes', this.latitude)
						uni.showToast({
							title: res.msg,
							icon: "none"
						}) 
							setTimeout(() => {
									uni.switchTab({
										url: '/pages/my/my'
									})
							}, 1500)
						
						// uni.showModal({
						// 	title: '提示',
						// 	content: '请等待工作人员审核',
						// 	showCancel: false,
						// 	confirmText: '好的',
						// 	success() {
						// 		setTimeout(() => {
						// 			uni.switchTab({
						// 				url: '/pages/my/my'
						// 			})
						// 		}, 1500)
						// 	}
						// })

					} else {
						uni.showToast({
							title: res.msg,
							icon: "none"
						})
					}

				})
			},
			getCategoryList() {
				this.api('/index/getCategoryList', 'post').then(res => {
					this.categoryList1 = res.data
					this.categoryList2 = res.data
					this.categoryList3 = res.data
				})
			},
			bindPickerChangeWay(e) {
				this.sexIndexway = e.detail.value
			},
			getProvinceList() {
				this.api('/index/getHotCityAndProvinceList', 'post').then(res => {
					this.provinceList.push(res.data.province_list)

					this.getCityList(this.provinceList[0][0].id)
				})
			},
			selCity(item) {

				item.isSel = (item.isSel == 1 ? 0 : 1)
				if (item.isSel == 1) {
					if (this.cityArr3.length >= 4) {
						uni.showToast({
							title: '最多选四个区域',
							icon: "none"
						})
						return
					}
					this.cityArr3.push(item.name)
				} else {
					this.cityArr3.forEach((res, index) => {
						if (res == item.name) {
							this.cityArr3.splice(index, 1)
						}
					})
				}
			},
			delcs(index) {
				this.cityArr3.splice(index, 1)
			},
			getCityList(id) {
				this.api('/index/getCityList', 'post', {
					province_id: id
				}).then(res => {
					this.provinceList.push(res.data)
				})
			},
			bindMultiPickerChange(e) {
				console.log(e)
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
			bindMultiPickerColumnChange(e) {

				if (e.detail.column == 1) {
					return
				}
				this.api('/index/getCityList', 'post', {
					province_id: this.provinceList[0][e.detail.value].id
				}).then(res => {
					this.provinceList.splice(1, 1, res.data)
				})
			},
			//分类选择
			bindLev1(e) {
				let item = this.categoryList1[e.detail.value]
				this.kmLevel1name1 = item.name
				this.kmLevel2name1 = ''
				this.kmLevel3name1 = ''
				this.gradId1 = ''
				this.subjId1 = ''
				this.cateId1 = item.category_id
				this.api('/index/getGradeList', 'post', {
					category_id: item.category_id
				}).then(res => {
					console.log(res)
					this.gradeList1 = res.data
				})
			},
			//年级选择
			bindLev2(e) {
				let item = this.gradeList1[e.detail.value]
				this.kmLevel2name1 = item.name
				this.kmLevel3name1 = ''
				this.subjId1 = ''
				this.gradId1 = item.grade_id
				this.api('/index/getSubjectList', 'post', {
					grade_id: item.grade_id
				}).then(res => {
					this.subjectList1 = res.data
				})
			},
			//科目选择
			bindLev3(e) {
				let item = this.subjectList1[e.detail.value]
				this.kmLevel3name1 = item.name
				this.subjId1 = item.subject_id
			},
			//分类选择
			bindLeva1(e) {
				let item = this.categoryList2[e.detail.value]
				this.kmLevel1name2 = item.name
				this.kmLevel2name2 = ''
				this.kmLevel3name2 = ''
				this.gradId2 = ''
				this.subjId2 = ''
				this.cateId2 = item.category_id
				this.api('/index/getGradeList', 'post', {
					category_id: item.category_id
				}).then(res => {
					this.gradeList2 = res.data
				})
			},
			//年级选择
			bindLeva2(e) {
				let item = this.gradeList2[e.detail.value]
				this.kmLevel2name2 = item.name
				this.kmLevel3name2 = ''
				this.subjId2 = ''
				this.gradId2 = item.grade_id
				this.api('/index/getSubjectList', 'post', {
					grade_id: item.grade_id
				}).then(res => {
					this.subjectList2 = res.data
				})
			},
			//科目选择
			bindLeva3(e) {
				let item = this.subjectList2[e.detail.value]
				this.kmLevel3name2 = item.name
				this.subjId2 = item.subject_id
			},
			//分类选择
			bindLevb1(e) {
				let item = this.categoryList3[e.detail.value]
				this.kmLevel1name3 = item.name
				this.kmLevel2name3 = ''
				this.kmLevel3name3 = ''
				this.gradId3 = ''
				this.subjId3 = ''
				this.cateId3 = item.category_id
				this.api('/index/getGradeList', 'post', {
					category_id: item.category_id
				}).then(res => {
					this.gradeList3 = res.data
				})
			},
			//年级选择
			bindLevb2(e) {
				let item = this.gradeList3[e.detail.value]
				this.kmLevel2name3 = item.name
				this.kmLevel3name3 = ''
				this.subjId3 = ''
				this.gradId3 = item.grade_id
				this.api('/index/getSubjectList', 'post', {
					grade_id: item.grade_id
				}).then(res => {
					this.subjectList3 = res.data
				})
			},
			//科目选择
			bindLevb3(e) {
				let item = this.subjectList3[e.detail.value]
				this.kmLevel3name3 = item.name
				this.subjId3 = item.subject_id
			},
			bindPickerChangeSex(e) {
				this.sexIndex = e.detail.value
			},
			delVideo() {
				this.videoUrl = ''
			},
			selectVideo() {
				this.isShowUpload = true
				let that = this
				uni.chooseVideo({
					success(res) {
						console.log(res)

						uni.uploadFile({
							url: that.imgUrl + '/Base/upload',
							filePath: res.tempFilePath,
							name: 'video',
							success(res1) {
								that.isShowUpload = false
								console.log(res1)
								if (typeof res1.data == 'object') {
									that.videoUrl = res1.data.data
								} else {
									that.videoUrl = JSON.parse(res1.data).data
								}
							}
						})
					},
					fail(err) {
						console.log(err)
					}
				})
			},
			gettx() {
				let that = this
				uni.chooseImage({
					count: 1,
					success(res) {
						console.log(res)
						uni.uploadFile({
							url: that.imgUrl + '/Base/upload',
							filePath: res.tempFilePaths[0],
							name: 'image',
							success(res1) {
								console.log(typeof res1.data)
								if (typeof res1.data == 'object') {
									that.txPic = res1.data.data
								} else {
									let img = JSON.parse(res1.data).data
									that.txPic = img
								}
							}
						})
					}
				})
			},
			//上传个人照片
			selectPicImg() {
				let that = this
				uni.chooseImage({
					count: 1,
					success(res) {
						console.log(res)
						uni.uploadFile({
							url: that.imgUrl + '/Base/upload',
							filePath: res.tempFilePaths[0],
							name: 'image',
							success(res1) {
								console.log(typeof res1.data)
								if (typeof res1.data == 'object') {
									that.picArr.push(res1.data.data)
								} else {
									let img = JSON.parse(res1.data).data
									that.picArr.push(img)
								}
							}
						})
					}
				})
			},
			selectPicImg1() {
				let that = this
				uni.chooseImage({
					count: 1,
					success(res) {
						console.log(res)
						uni.uploadFile({
							url: that.imgUrl + '/Base/upload',
							filePath: res.tempFilePaths[0],
							name: 'image',
							success(res1) {
								if (typeof res1.data == 'object') {
									that.picArr1.push(res1.data.data)
								} else {
									let img = JSON.parse(res1.data).data
									that.picArr1.push(img)
								}
							}
						})
					}
				})
			},
			delPic(index) {
				this.picArr.splice(index, 1)
			},
			delPic1(index) {
				this.picArr1.splice(index, 1)
			},
			//添加个人标签
			addItem() {
				if (this.biaoqian == '') {
					uni.showToast({
						title: '请在左侧输入内容',
						icon: "none"
					})
					return
				}
				if (this.biaoqianArr.length >= 3) {
					uni.showToast({
						title: '标签最多三个',
						icon: "none"
					})
					return
				}
				this.biaoqianArr.push(this.biaoqian)
			},
			//删除个人标签
			delBiaoQian(index) {
				this.biaoqianArr.splice(index, 1)
			},
			//删除经历
			deleteData(index) {
				if (this.dataArr.length == 1) {
					uni.showToast({
						title: '经历不能全部删除',
						icon: 'none'
					})
					return
				}
				this.dataArr.splice(index, 1)
			},
			//添加经历
			addData() {
				let data = {
					title: '',
					start_time: '',
					end_time: '',
					experience: ''
				}
				this.dataArr.push(data)
			},
			bindjlStartDateChange(e, item) {
				item.start_time = e.detail.value
			},
			bindjlEndDateChange(e, item) {
				item.end_time = e.detail.value
			},
			selectDate(index) {

				this.selArr[index].isSel = !this.selArr[index].isSel
				if (this.selArr[index].isSel) {
					this.detailTiem.push({
						week: this.selArr[index].time,
						start_time: '9:00',
						end_time: '18:00'
					})
				} else {
					this.detailTiem.forEach((item, index1) => {
						if (item.week == this.selArr[index].time) {
							this.detailTiem.splice(index1, 1)
						}
					})
				}
			},
			bindStartDateChange(e, index) {
				if (index == 1) {
					this.startTime = e.detail.value
				} else {
					this.endTime = e.detail.value
				}
			},
			bindTimeChange3(e, item) {
				item.start_time = e.detail.value
			},
			bindTimeChange4(e, item) {
				console.log(e)
				if ((Number(e.detail.value.split(':')[0]) == Number(item.start_time.split(':')[0])) && ((Number(e.detail
						.value
						.split(':')[1]) <= Number(item.start_time.split(':')[1])))) {
					uni.showToast({
						title: '结束时间不能等于或者小于开始时间',
						icon: "none"
					})
					return;
				}
				if (Number(e.detail.value.split(':')[0]) < Number(item.start_time.split(':')[0])) {
					uni.showToast({
						title: '结束时间不能等于或者小于开始时间',
						icon: "none"
					})
					return;
				}
				item.end_time = e.detail.value
			},
			clearPic(index) {
				switch (index) {
					case 1:
						this.zmidPic = ''
						break;
					case 2:
						this.fmidPic = ''
						break
					case 3:
						this.byPic = ''
						break;
					case 4:
						this.teacherPic = ''
						break;
					case 14:
						this.chsi_img = ''
						break;
					case 5:
						this.txPic = ''
						break;
					case 6:
						this.zhichengPic = ''
						break
				}
			},

			selectIdCardImg(isz) {
				let that = this
				uni.chooseImage({
					count: 1,
					success(res) {
						uni.uploadFile({
							url: that.imgUrl + '/Base/upload',
							filePath: res.tempFilePaths[0],
							name: 'image',
							success(res1) {
								var img = ''
								if (typeof res1.data == 'object') {
									img = res1.data.data
								} else {
									img = JSON.parse(res1.data).data
								}
								console.log(res1)
								switch (isz) {
									case 1:
										that.zmidPic = img
										break;
									case 2:
										that.fmidPic = img
										break
									case 3:
										that.byPic = img
										break;
									case 4:
										that.teacherPic = img
										break;
									case 14:
										that.chsi_img = img
										break;
									case 5:
										that.txPic = img
										break;
									case 6:
										that.zhichengPic = img
										break;
								}
							}
						})


					}
				})
			}
		}
	}
</script>

<style scoped lang="less">
	/deep/.iptRed {
		color: red !important;
	}



	.borDerLine {
		border-bottom: 2rpx solid #ccc !important;
	}

	/deep/.borDerLine textarea {
		width: 90%;
		height: 200rpx;
	}

	.haibao {
		width: 100%;
		height: 100%;
		position: fixed;
		top: 0;
		left: 0;
		background-color: rgba(0, 0, 0, 0.4);
		z-index: 99999;

		.hais {
			width: 570rpx;
			height: 910rpx;
			position: absolute;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);

		}

		.baocun {
			width: 570rpx;
			height: 80rpx;
			background-color: rgb(251, 100, 29);
			border-radius: 25rpx;
			text-align: center;
			line-height: 80rpx;
			position: absolute;
			left: 50%;
			transform: translateX(-50%);
			bottom: 120rpx !important;
			z-index: 88888;

			text {
				color: #fff;
			}

		}
	}





	.seemap {
		display: flex;
		align-items: center;
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		right: 30rpx;

		image {
			width: 60rpx;
			height: 60rpx;
			margin-right: 10rpx;
		}
	}

	.maskbigImg {
		width: 100%;
		position: fixed;
		height: 100%;
		background-color: #fff;
		top: 0;
		left: 0;
		overflow: hidden;
		z-index: 999;

		.maskbigImg1 {
			width: 100%;
			height: 1066.5rpx;

			.skxzimg2 {
				width: 100%;
				height: 1066.5rpx;
				position: absolute;
				top: 0;
				left: 0;
			}

			.clone {
				width: 80rpx;
				height: 80rpx;
				position: absolute;
				top: 45rpx;
				right: 75rpx;
			}
		}




		.skxzgb-box {
			width: 100%;
			text-align: center;
			margin-top: 20rpx;
			// position: absolute;
			// top: 1191.5rpx;
			// left: 50%;
			// transform: translateX(-50%);
		}
	}

	page {
		background: #f8f8f7;
	}

	.box {
		background: #fff;
		display: flex;
		flex-direction: column;
	}

	.tiele_box {
		height: 60rpx;
		display: flex;
		align-items: center;
		width: 100%;
		padding: 0 32rpx;
		box-sizing: border-box;
		position: relative;
	}

	.name {
		flex: 1;
	}

	.biyeyuanxiaoName,
	.name {
		font-size: 26rpx;
		margin-left: 32rpx;
	}

	.biyeyuanxiaoName {
		width: 200rpx;
	}

	.add {
		background: linear-gradient(90deg, #db9e55, #f7ca8f);
		height: 50rpx;
		width: 50rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 26rpx;
		color: #fff;
		border-radius: 3rpx;
		margin-right: 20rpx;
	}

	.item_box {
		display: flex;
		background: #fff;
		padding: 32rpx;
		flex-wrap: wrap;
	}

	.item {
		height: 60rpx;
		padding: 46rpx 0;
		box-sizing: border-box;
	}


	.date-item,
	.item {
		font-size: 28rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		// border-radius: 4rpx;
	}

	.date-item {
		flex: 1;
		border-right: 1rpx solid #999;
	}

	.list_box {
		position: relative;
		height: 80rpx;
	}

	.list-item {
		margin-top: 10rpx;
		height: 60rpx;
		padding: 0 10rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 28rpx;
		background: #f8c400;
		color: #fff;
		border-radius: 10rpx;
		margin-right: 40rpx;
	}

	.input {
		padding: 0 32rpx;
	}

	.input,
	.input-right {
		height: 60rpx;
		font-size: 26rpx;
		background: #fff;
		flex: 3;
	}

	.input-right {
		text-align: right;
	}

	.guanbiimg {
		height: 40rpx;
		width: 40rpx;
		position: absolute;
		top: -10rpx;
		right: 10rpx;
	}

	.city-picker {
		height: 60rpx;
		padding: 10 30rpx;
		box-sizing: border-box;
		font-size: 28rpx;
		line-height: 60rpx;
		border-radius: 5rpx;
		display: flex;
		flex-direction: row;
		align-items: center;
	}

	.sel-box {
		align-items: flex-start;
		flex-direction: row;
		background: #fff;
		border-radius: 10rpx;
	}

	.data,
	.sel-box {
		display: flex;
		padding: 10rpx;
		box-sizing: border-box;
	}

	.data {
		flex: 1;
		border: 1rpx solid #dbdbdb;
		height: 350rpx;
		overflow: auto;
		margin-left: 20rpx;
		border-radius: 10rpx;
		flex-direction: row;
		flex-wrap: wrap;
	}

	.city {
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

	.select_item_color {
		border: 1rpx solid #f8c400 !important;
		color: #fff !important;
		background: #f8c400 !important;
	}

	.mar {
		margin-top: 40rpx;
	}

	.zw {
		height: 60rpx;
		width: 100%;
	}

	.isSelCity {
		display: flex;
		flex-direction: column;
		border-bottom: 1rpx solid #ccc;
		margin-bottom: 30rpx;
	}

	.city-box {
		display: flex;
		flex-wrap: wrap;
		flex-direction: row;
		background: #fff;
		padding-top: 20rpx;
	}

	.imgbox {
		display: flex;
		background: #fff;
		align-items: center;
		flex-wrap: wrap;
		border-radius: 0 0 10rpx 10rpx;
		padding: 0 32rpx;
		box-sizing: border-box;
		position: relative;
	}

	.img,
	.upload {
		width: 120rpx;
		height: 120rpx;
		margin: 20rpx;
	}

	.upload {
		border: 1rpx solid #ccc;
		border-radius: 6rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 28rpx;
		background: #fff;
		position: relative;
	}

	.upload button {
		position: absolute;
		width: 100%;
		height: 100%;
		top: 0;
		left: 0;
		background-color: transparent;
	}

	.upload button::after {
		display: none;
	}

	.picbox {
		position: relative;
		margin: 10rpx;
		display: flex;
	}

	.guanbi {
		right: 0;
		top: 0;
	}

	.guanbi,
	.guanbi2 {
		width: 30rpx;
		height: 30rpx;
		position: absolute;
		z-index: 10000;
	}

	.guanbi2 {
		right: -10rpx;
		top: 22rpx;
	}

	.title-tip {
		font-size: 30rpx;
		height: 80rpx;
		display: flex;
		flex-direction: row;
		align-items: center;
		padding: 0 20rpx;
		box-sizing: border-box;
		flex-wrap: wrap;
	}

	.color {
		color: red;
	}

	.videobox {
		position: relative;
	}

	.video {
		width: 420rpx;
		height: 220rpx;
		margin-top: 40rpx;
	}

	page {
		background: #f8f8f7;
	}

	.box {
		height: 80rpx;
		background: #fff;
		display: flex;
		flex-direction: row;
		align-items: center;
		font-size: 28rpx;
	}

	.title {
		flex: 1;
		box-sizing: border-box;
	}

	.input {
		width: 650rpx;
	}

	.textarea {
		width: 100%;
		height: 300rpx;
		background: #fff;
		font-size: 28rpx;
		text-indent: 1em;
		border-radius: 10rpx 10rpx 0 0;
		padding: 40rpx 0 10rpx;
	}

	page {
		background: #f8f8f7;
	}

	.title {
		font-size: 28rpx;
		display: flex;
		align-items: center;
		border-radius: 10rpx 10rpx 0 0;
	}

	.input {
		flex: 1;
		height: 70rpx;
	}

	.time {
		background: #fff;
		padding: 0 20rpx;
		display: flex;
		flex-direction: row;
	}

	.name {
		font-size: 28rpx;
	}

	.left {
		display: flex;
		flex-direction: column;
		width: 50rpx;
		align-items: center;
		justify-content: center;
	}

	.yuan {
		width: 10rpx;
		height: 10rpx;
		border-radius: 50%;
		border: 1rpx solid #ccc;
	}

	.line {
		height: 80rpx;
		width: 1rpx;
		background: #ccc;
	}

	.right {
		display: flex;
		flex-direction: column;
		width: 100%;
	}

	.time1 {
		height: 80rpx;
		display: flex;
		flex-direction: row;
		align-items: center;
		border-bottom: 1rpx solid #ccc;
	}

	.picker {
		font-size: 26rpx;
		width: 500rpx;
		height: 70rpx;
		text-align: right;
		line-height: 70rpx;
	}

	.textarea {
		background: #fff;
		font-size: 28rpx;
		width: 100%;
		height: 80rpx;
	}

	.tjjl {
		flex: 1;
	}

	.addBtn {
		padding: 0 10rpx;
		height: 50rpx;
		background: linear-gradient(90deg, #db9e55, #f7ca8f);
		border-radius: 4rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 28rpx;
		color: #fff;
	}

	.delete_box {
		width: 100%;
		display: flex;
		justify-content: flex-end;
		margin: 0 auto;
		background: #fff;
	}

	.delete {
		height: 50rpx;
		width: 160rpx;
		background: #ed4014;
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 28rpx;
		border-radius: 5rpx;
		margin-right: 20rpx;
		margin-bottom: 20rpx;
	}

	page {
		background: #f8f8f7;
	}

	.textarea {
		height: 200rpx;
		font-size: 28rpx;
		width: 100%;
		background: #fff;
	}

	.imgbox {
		display: flex;
		background: #fff;
	}

	.img-pic {
		flex: 1;
		height: 200rpx;
		border-radius: 10rpx;
	}

	.img-pic-mar {
		margin-left: 32rpx;
	}

	.upload-pic {
		height: 200rpx;
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 26rpx;
		border: 2rpx dashed #000;
		border-radius: 6rpx;
	}

	.zhicheng {
		font-size: 28rpx;
		height: 80rpx;
		display: flex;
		align-items: center;
		flex: 2;
		background: #fff;
	}

	.bordeR-line {
		width: 100%;
		height: 1rpx;
		background-color: #f8f8f8;
	}

	.select {
		display: flex;
		height: 80rpx;
		align-items: center;
		padding: 0 20rpx;
		background: #fff;
		border-radius: 10rpx;
	}

	.name {
		flex: 1;
	}

	.name,
	.picker {
		font-size: 28rpx;
	}

	.picker {
		height: 70rpx;
		width: 550rpx;
		text-align: right;
		line-height: 70rpx;
	}

	.pic_box {
		background: #fff;
		border-radius: 10rpx;
	}

	.upload-pic {
		height: 230rpx;
		width: 230rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 26rpx;
		border: 2rpx dashed #000;
		border-radius: 6rpx;
		margin-left: 20rpx;
	}

	page {
		background: #f8f8f7;
	}

	.biyeyuanxiao {
		padding: 0 32rpx;
		box-sizing: border-box;
		background-color: #fff;
	}

	.school {
		display: flex;
		height: 80rpx;
		background: #fff;
		align-items: center;
		// border-bottom: 1rpx solid #ccc;
		border-radius: 10rpx 10rpx 0 0;
	}

	.name,
	.school-name {
		font-size: 28rpx;
	}

	.name {
		flex: 1;
	}

	.input {
		width: 550rpx;
		height: 70rpx;
		font-size: 28rpx;
	}

	.time {
		background: #fff;
		padding: 0 20rpx;
		flex-direction: row;
	}

	.left,
	.time {
		display: flex;
	}

	.left {
		flex-direction: column;
		width: 50rpx;
		align-items: center;
		justify-content: center;
	}

	.yuan {
		width: 10rpx;
		height: 10rpx;
		border-radius: 50%;
		border: 1rpx solid #ccc;
	}

	.line {
		height: 80rpx;
		width: 1rpx;
		background: #ccc;
	}

	.right {
		display: flex;
		flex-direction: column;
		width: 100%;
	}

	.time1 {
		height: 80rpx;
		display: flex;
		flex-direction: row;
		align-items: center;
		border-bottom: 1rpx solid #ccc;
	}

	.picker {
		font-size: 26rpx;
		width: 500rpx;
		height: 70rpx;
		text-align: right;
		line-height: 70rpx;
	}

	page {
		background: #f8f8f7;
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

	.title_item2 {
		text-align: center !important;
	}

	.comment_style .dateDetail {
		display: flex;
		align-items: center;
		font-size: 28rpx;
		/* height: 100rpx; */
		box-sizing: border-box;
		background: #fff;
		border-bottom: 1rpx solid #ccc;
	}

	/deep/.comment_style .dateDetail input {
		height: 70rpx;
		line-height: 70rpx;
	}

	.comment_style .day {
		flex: 1;
		text-align: left;
	}

	.comment_style .picker {
		flex: 1;
		text-align: center;
	}

	.comment_style .switch {
		transform: scale(.6);
	}

	page {
		background: #f8f8f7;
	}

	.value {
		font-size: 26rpx;
		text-align: right;
	}

	.img,
	.value {
		margin-right: 5rpx;
		margin-top: 15rpx;
	}

	.img {
		height: 100rpx;
		width: 100rpx;
		border-radius: 5rpx;
	}

	.imgjt {
		width: 20rpx;
		height: 25rpx;
	}

	.header {
		height: 80rpx;
		font-size: 28rpx;
		padding: 0 20rpx;
		margin-top: 20rpx;
	}

	.add,
	.header {
		display: flex;
		align-items: center;
	}

	.add {
		background: #f8c400;
		color: #fff;
		height: 60rpx;
		width: 60rpx;
		border-radius: 6rpx;
		justify-content: center;
	}

	.pickerVal {
		flex: 1;
		display: flex;
		height: 80rpx;
		align-items: center;
	}

	.pickerVal1 {
		justify-content: center;
	}

	.pickerVal2 {
		justify-content: flex-end;
	}

	.upload {
		height: 100rpx;
		width: 100rpx;
		justify-content: center;
		font-size: 26rpx;
		border: 1rpx dashed #ccc;
		border-radius: 6rpx;
		margin-left: 20rpx;
	}

	.comment_style .set,
	.upload {
		display: flex;
		align-items: center;
	}

	.comment_style .set {
		height: 80rpx;
		padding: 0 20rpx;
		box-sizing: border-box;
		background: #fff;
		margin-bottom: 20rpx;
	}

	.comment_style .title {
		font-size: 28rpx;
		flex: 1;
		padding: 0 !important;
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
		/* height: 80rpx; */
		box-sizing: border-box;
		background: #fff;
		border-bottom: 1rpx solid #ccc;
	}

	.comment_style .day,
	.comment_style .picker {
		flex: 1;
		text-align: center;
		line-height: 80rpx;
	}

	.submit-box {
		flex-direction: row;
		height: 100rpx;
	}

	.btn,
	.submit-box {
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.btn {
		width: 40%;
		height: 80rpx;
		margin: 40rpx auto;
		border-radius: 6rpx;
		font-size: 28rpx;
		color: #fff;
	}

	.btnbg1 {
		background: linear-gradient(90deg, #db9e55, #f7ca8f);
	}

	.btnbg2 {
		background: #a5a3a3;
	}

	.ts {
		font-size: 24rpx;
		width: 100%;
		text-align: center;
		color: red;
	}

	.msg_box {
		width: 80%;
		background: #f8c400;
		border-radius: 15rpx;
		margin: 20rpx auto;
	}

	.msg_detail {
		display: flex;
		flex-direction: row;
		align-items: center;
		height: 120rpx;
		padding: 0 20rpx;
	}

	.heard_img {
		height: 100rpx;
		width: 100rpx;
		border-radius: 50%;
		margin-right: 20rpx;
	}

	.proper_msg {
		display: flex;
		flex-direction: column;
		flex: 1;
		justify-content: center;
	}

	.nick {
		font-size: 28rpx;
		font-weight: 600;
		margin-bottom: 10rpx;
	}

	.dec {
		font-size: 20rpx;
		color: #666;
	}

	.jt {
		width: 15rpx;
		height: 25rpx;
	}

	.item-title {
		font-size: 28rpx;
		padding: 32rpx 20rpx 20rpx 32rpx;
		background-color: #fff;
		position: relative;
		display: flex;
		align-items: center;
	}

	.addjl {
		width: 40rpx;
		height: 40rpx;
		right: 148rpx;
	}

	.addjl,
	.addjlw {
		position: absolute;
		top: 32rpx;
	}

	.addjlw {
		right: 35rpx;
	}

	.submit-box {
		flex-direction: row;
		height: 100rpx;
	}

	.btn,
	.submit-box {
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.btn {
		width: 40%;
		height: 80rpx;
		margin: 40rpx auto;
		border-radius: 6rpx;
		font-size: 28rpx;
		color: #fff;
	}

	.btnbg1 {
		background: linear-gradient(90deg, #db9e55, #f7ca8f);
	}

	.btnbg2 {
		background: #a5a3a3;
	}

	.city2 {
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

	.mast_start {
		width: 20rpx;
		height: 20rpx;
	}

	.redcolor {
		color: red;
	}

	.tip {
		font-size: 20rpx;
		color: #666;
		padding: 0 20rpx;
	}

	.shiming {
		padding: 0 32rpx;
		background: #fff;
		box-sizing: border-box;
	}

	.name-shiming {
		font-size: 26rpx;
		flex: 1;
	}

	.sf-name {
		background-color: #fff;
		display: flex;
		flex-direction: row;
		justify-content: center;
		align-items: center;
		padding: 20rpx 0;
	}

	.sfzm {
		flex: 1;
		font-size: 28rpx;
		text-align: center;
	}

	.tip {
		height: 60rpx;
		display: flex;
		align-items: center;
		padding: 0 20rpx;
		font-size: 26rpx;
		color: red;
	}

	.item,
	.tip {
		background: #fff;
	}

	.item {
		display: flex;
		flex-direction: row;
		box-sizing: border-box;
		// border-bottom: 2rpx solid #ccc;
		justify-content: space-between;
		width: 100%;
	}

	.input {
		flex: 1;
	}

	.selInput {
		width: 375rpx;

		height: 60rpx;
		line-height: 60rpx;
		padding-left: 28rpx;

	}

	.selInput view {
		width: 375rpx;
	}

	.pic_box {
		padding-top: 40rpx;
		background: #fff;
	}

	.redcolor {
		color: red;
		font-size: 32rpx;
	}

	.upload_box {
		display: flex;
		flex-direction: row;
		padding: 30rpx 32rpx;
		box-sizing: border-box;
		position: relative;
	}

	.guanbi6 {
		right: 20rpx;
	}

	.guanbi5,
	.guanbi6 {
		position: absolute;
		top: 20rpx;
		width: 40rpx;
		height: 40rpx;
	}

	.guanbi5 {
		right: 380rpx;
	}

	.img {
		width: 250rpx;
		height: 250rpx;
		margin-left: 20rpx;
		border-radius: 10rpx;
	}

	.upload {
		height: 230rpx;
		width: 230rpx;
		font-size: 26rpx;
		border: 1rpx dashed #ccc;
		border-radius: 6rpx;
		margin-left: 20rpx;
	}

	.submit-box,
	.upload {
		display: flex;
		align-items: center;
		justify-content: center;
		border: #000 2rpx solid;
	}

	.submit-box {
		flex-direction: row;
		height: 100rpx;
		position: relative;
	}

	.btn {
		width: 40%;
		height: 80rpx;
		// margin: 40rpx auto;

		border-radius: 6rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 28rpx;
		color: #fff;
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
	}

	.btnbg1 {
		background: linear-gradient(90deg, #db9e55, #f7ca8f);
	}

	.btnbg2 {
		background: #a5a3a3;
	}

	.zw {
		height: 60rpx;
		width: 100%;
		background-color: #f8f8f8;
	}

	.stap-box {
		display: flex;
		flex-direction: row;
		align-items: center;
		height: 120rpx;
		padding: 0 20rpx;
		box-sizing: border-box;
		justify-content: center;
	}

	.stap-img-item {
		display: flex;
		flex-direction: column;
	}

	.stap-img-box {
		display: flex;
		align-items: center;
	}

	.stap-img {
		width: 50rpx;
		height: 50rpx;
	}

	.stap-line {
		height: 10rpx;
		width: 140rpx;
		background-color: #dbdbdb;
		display: flex;
		align-items: center;
	}

	.stap-name {
		font-size: 20rpx;
		color: #666;
	}

	.activeNameColor {
		color: #f8c400;
	}

	.title {
		padding: 0 32rpx;
		background-color: #fff;
		font-size: 30rpx;
	}

	.tip {
		font-size: 20rpx;
		color: #333;
		letter-spacing: 5rpx;
		padding-left: 32rpx;
		padding-right: 32rpx;
	}

	.tipbg {
		background-color: #f8f8f8;
		padding-top: 20rpx;
		padding-bottom: 20rpx;
	}

	.skxz-box {
		width: 100%;
		position: fixed;
		top: 0;
		left: 0;
		background: #fff;
		height: 100%;
	}

	.zindex {
		z-index: 1000;
	}

	.zindex2 {
		z-index: 10000;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.skxzimg2 {
		width: 100%;
	}

	.skxzimg {
		width: 300rpx;
	}

	.skxzgb-box {
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.skxzgb {
		width: 80rpx;
		height: 80rpx;
		text-align: center;
	}

	.saveBg {
		background-color: #ff9e0f;
		border-radius: 40rpx;
		color: #fff;
		height: 80rpx;
		margin-top: 80rpx;
		font-size: 30rpx;
	}

	.changeBg,
	.saveBg {
		letter-spacing: 10rpx;
		padding: 0 20rpx;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.changeBg {
		border: 1px solid #ff9e0f;
		color: #ff9e0f;
		height: 60rpx;
		border-radius: 30rpx;
		margin-top: 30rpx;
		font-size: 25rpx;
	}

	.tipbox {
		border-left: 1rpx solid #000;
		border-right: 1rpx solid #000;
		padding: 0 20rpx;
		width: 62%;
		font-size: 30rpx;
	}

	.item-header {
		display: flex;
		background: #fff;
		border-bottom: 1rpx solid #ccc;
		position: relative;
	}

	.guanbi7 {
		position: absolute;
		top: 0rpx;
		right: 0rpx;
		width: 40rpx;
		height: 40rpx;
	}

	.shenhe-box {
		width: 100%;
		position: fixed;
		flex-direction: column;
		justify-content: center;
		top: 0;
		left: 0;
		z-index: 10000;
		background: #fff;
		height: 100%;
	}

	.shenhe-box,
	.type {
		display: flex;
		align-items: center;
	}

	.type {
		font-size: 28rpx;
		flex-direction: row;
	}

	.radio {
		width: 50rpx;
		height: 50rpx;
		margin-right: 20rpx;
	}

	.teacher_type {
		height: 80rpx;
		display: flex;
		align-items: center;
		justify-content: space-around;
		width: 80%;
		border-radius: 6rpx;
	}

	.teacher_type_box {
		height: 80rpx;
		width: 100%;
		display: flex;
		justify-content: center;
		background: #fff;
	}

	.jlinput {
		height: 90rpx;
		font-size: 28rpx;
		margin: 10rpx 32rpx;
	}

	.msgimg {
		width: 250rpx;
	}

	.video-tip {
		margin-top: 20rpx;
		font-size: 26rpx;
		width: 100%;
	}

	.comment_style {
		background-color: #fff;
		padding: 32rpx 32rpx 0;
		box-sizing: border-box;
	}

	.myimgbox {
		background-color: #fff;
		padding-bottom: 32rpx;
	}

	.link-icon2,
	.link-icon45 {
		width: 20rpx;
		height: 18rpx;
		margin-left: 10rpx;
	}

	.link-icon45 {
		margin-top: 10rpx;
	}

	.tip11 {
		font-size: 20rpx;
		padding: 0 32rpx;
		background-color: #fff;
	}

	.worring {
		width: 40rpx;
		height: 40rpx;
		margin-right: 20rpx;
	}

	.inputbq {
		height: 60rpx;
		font-size: 26rpx;
		padding: 0 32rpx;
		background: #fff;
		width: 300rpx;
	}

	.addbq {
		width: 40rpx;
		height: 40rpx;
		right: 100rpx;
	}

	.addbq,
	.addbqw {
		position: absolute;
		top: 12rpx;
	}

	.addbqw {
		right: 35rpx;
	}

	.uploadVideo {
		height: 200rpx;
		width: 200rpx;
		border: 2rpx solid #000;
		border-radius: 6rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 28rpx;
		background: #fff;
		margin: 0 20rpx;
	}

	.mypicup {
		display: flex;
		flex-wrap: wrap;
	}

	.jl_pic_box {
		width: 100%;
		display: flex;
		flex-direction: row;
		flex-wrap: nowrap;
		margin-right: 20rpx;
	}

	.img-pic,
	.jl_pic {
		height: 230rpx;
		width: 230rpx;
	}

	.jl_pic {
		position: relative;
		margin-right: 30rpx;
	}

	.guanbi8 {
		position: absolute;
		top: 12rpx;
		right: 17rpx;
		width: 40rpx;
		height: 40rpx;
	}

	.textarea2 {
		width: 100%;
		height: 300rpx;
		background: #fff;
		font-size: 28rpx;
		text-indent: 1em;
		border-radius: 10rpx 10rpx 0 0;
		padding: 40rpx 0 10rpx;
	}

	.videobox {
		position: relative;
	}

	.uploadStatus {
		width: 200rpx;
		height: 100rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		color: #fff;
		font-size: 28rpx;
		position: absolute;
		bottom: 70rpx;
		left: 130rpx;
	}
</style>