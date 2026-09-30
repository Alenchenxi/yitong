<template>
	<view>	
		<view class="maskbigImg" v-if="dataLoaded && isShowTip==1">
			<view class="maskbigImg1">
				<image class="skxzimg2" :src="shopTipImage" mode="widthFix"></image>
				<image @click="cloneImg" class="clone" src="/static/images/guanbi.png" mode=""></image>
			</view>
			<view class="skxzgb-box">
				<text style="font-weight: bold;font-size: 32rpx;">{{timeOutNum >= 0 ? timeOutNum : 0}}s</text>
			</view>
		</view>
		<view class="tip tipbg" v-if="dataLoaded">
			<view>
				<image class="worring" src="/static/images/1321312.png"></image>
			</view>
			<view>
				我们将承诺保护你的隐私，请务必确保真实、有效的信息
			</view>
		</view>
		
		<view v-show="isShowTip == 2 && dataLoaded" class="base_info">
			<u-form labelPosition="left" :model="teacherInfo" ref="teacherFormRef" label-width="160">
				<u-form-item label="真实姓名" prop="name" :required="true">
					<u-input v-model="teacherInfo.name" placeholder="请填写真实姓名" :maxlength="20" :border="false"></u-input>
				</u-form-item>
				<u-form-item label="头像" prop="head_img" :required="true">
					<view class="avatar_section">
						<view v-if="teacherInfo.head_img">
							<view class="avatar_upload">
								<u-image width="72rpx" height="72rpx" :src="teacherInfo.head_img.indexOf('http')==-1 ? url+teacherInfo.head_img : teacherInfo.head_img" mode="aspectFill"></u-image>
								<image @click="teacherInfo.head_img = ''" class="guanbi7 avatar_delete_icon" src="/static/images/guanbi.png" style="width:32rpx;height:32rpx;position: absolute;top: 0;right: 0;" ></image>
							</view>
						</view>
						<view v-else>
							<!-- #ifdef MP-WEIXIN -->
							<view style="width: 72rpx; height: 72rpx;" class="p_upload-pic choose_avatar">+
								<button open-type="chooseAvatar" @chooseavatar="chooseavatar"></button>
							</view>
							<!-- #endif -->
							<!-- #ifndef MP-WEIXIN -->
							<view @click="gettx" style="width: 72rpx; height: 72rpx;" class="p_upload-pic">+</view>
							<!-- #endif -->
						</view>
					</view>
				</u-form-item>
				<u-form-item label="身份证" prop="id_number" :required="true">
					<u-input v-model="teacherInfo.id_number" placeholder="请填写身份证" :maxlength="18" :border="false"></u-input>
				</u-form-item>
				<u-form-item label="手机号" prop="mobile" :required="true">
					<u-input v-model="teacherInfo.mobile" :border="false" :maxlength="11" placeholder="请填写身份证"></u-input>
				</u-form-item>
				<u-form-item label="院校名称" prop="school" :required="true">
					<u-input v-model="teacherInfo.school" :border="false" :maxlength="80" placeholder="请填写院校名称"></u-input>
				</u-form-item>
				<u-form-item label="专业" prop="specialty" :required="true">
					<u-input v-model="teacherInfo.specialty" :border="false" :maxlength="20" placeholder="请填写专业,20字内"></u-input>
				</u-form-item>
				<u-form-item label="学历" prop="education" :required="true">
					<u-cell-group :border="false">
						<u-cell-item arrow-direction="down" use-label-slot @click="educationPickerShow=true" :border-bottom="false">
							<template v-slot:title>
								<text v-if="teacherInfo.education">{{teacherInfo.education}}</text>
								<text v-else class="placeholder_color">请点击选择学历</text>
							</template>
						</u-cell-item>
					</u-cell-group>
				</u-form-item>
				<u-form-item label="可授科目" prop="categoryCascadeList" :required="true">
					<!-- 缺少价格 参考价格范围-->
					<view class="kemu_input kemu_cell">
						<u-input v-model="teacherInfo.categoryCascadeInputValue" type="select" @click="categorySelectShow=true" placeholder="点击箭头选择1~4个科目" />
						<view class="kemu_select kemu_flex">
							<u-tag v-for="(o,i) in teacherInfo.categoryCascadeList" :key="i" :text="o.subjectName" type="success" class="kemu_tag" closeable @close="onKemuDelete(o,i)" />
						</view>
					</view>
				</u-form-item>
				<u-form-item label="授课区域" :border-bottom="false" prop="cityCascadeInputValue" :required="true">
					<view class="">
						<view class="kemu_input">
							<u-input v-model="teacherInfo.cityCascadeInputValue" type="select" @click="onCitySelect" placeholder="选择城市后选择1-4个区域" />
						</view>
					</view>
				</u-form-item>
				<u-form-item label="学信网" :border-bottom="false" :required="true" prop="chsi_img">
					<u-cell-group :border="false">
						<u-cell-item :border-bottom="false" :arrow="false">
							<template v-slot:title>
								<text class="placeholder_color">请把证件号码后六位打码，把姓名最后一个字打码</text>
							</template>
							<template v-slot:right-icon>
								<view v-if="teacherInfo.chsi_img" class="xuexin_img_section">
									<u-image class="img-pic" width="72rpx" height="72rpx" 
										:src="teacherInfo.chsi_img!=''&&teacherInfo.chsi_img.indexOf('http')==-1 ? url+teacherInfo.chsi_img : teacherInfo.chsi_img" mode="aspectFill"></u-image>
									<image @click="teacherInfo.chsi_img = ''" class="xuexin_img" style="width:32rpx;height:32rpx;" src="/static/images/guanbi.png"></image>
								</view>
								<view v-else>
									<view @click="onXuexinUpload" class="p_upload-pic" style="width:72rpx !important;height:72rpx !important;">+</view>
								</view>
							</template>
						</u-cell-item>
					</u-cell-group>
				</u-form-item>
				<u-form-item label="教龄" prop="career_year" :required="true">
					<u-input v-model="teacherInfo.career_year" type="select" @click="careerStartPickerShow=true" placeholder="请选择开始从事家教的时间" />
				</u-form-item>
				<u-form-item label="籍贯" prop="birthplace" :required="true">
					<u-input v-model="teacherInfo.birthplace" :border="false" :maxlength="30" placeholder="请填写籍贯信息"></u-input>
				</u-form-item>
				<u-form-item label="授课时间" prop="workTimeDesc" :required="true">
					<u-cell-group :border="false">
						<u-cell-item arrow-direction="down" use-label-slot @click="workTimeSelectShow=true" :border-bottom="false">
							<template v-slot:title>
								{{teacherInfo.workTimeDesc}}
							</template>
							<template v-slot:label>
								{{teacherInfo.workTimeTip}}
							</template>
						</u-cell-item>
					</u-cell-group>
				</u-form-item>
				<u-form-item label="居住区域" prop="currentLocation" :required="true">
					<u-cell-group :border="false">
						<u-cell-item arrow-direction="down" :border-bottom="false" @click="onOpenLocationChoose">
							<template v-slot:title>
								<text v-if="teacherInfo.currentLocation">{{teacherInfo.currentLocation}}</text>
								<text v-else class="placeholder_color">点击选择居住区域</text>
							</template>
						</u-cell-item>
					</u-cell-group>
				</u-form-item>
				<u-form-item label="个人照片" :border-bottom="false" :required="true" prop="photeList">
					<view class="course_tip">每次只能选择1张上传,至少上传<text style="color:red;">3张生活照</text>,建议比例宽:高16:9</view>
				</u-form-item>
				<u-form-item>
					<view class="xuexin_upload">
						<view class="p_img_flex">
							<view class="xuexin_img_section" v-for="(item,index) in teacherInfo.photeList" :key="index">
								<u-image class="img-pic" width="72rpx" height="72rpx" :src="item!=''&&item.indexOf('http')==-1 ? url+item : item" mode="aspectFill"></u-image>
								<image @click="onDeleteLifePhone(item,index)" class="xuexin_img" style="width:32rpx;height:32rpx;" src="/static/images/guanbi.png"></image>
							</view>
							<view v-if="!teacherInfo.photeList || teacherInfo.photeList.length < 9" @click="onLifePhone" style="width:72rpx !important;height:72rpx !important;" class="p_upload-pic">+</view>
						</view>
					</view>
				</u-form-item>
				<u-form-item label="自我介绍" prop="selfIntroduction">
					<u-input v-model="teacherInfo.selfIntroduction" type="textarea" :height="200" :autoHeight="true" placeholder="您曾任职的单位、岗位、具体教学对象和内容等" :maxlength="180" />
				</u-form-item>
				<u-form-item label="其它">
					<u-cell-group :arrow="false" :border="false">
						<u-cell-item :border-bottom="false" :arrow="false">
							<template v-slot:title>
								<text class="placeholder_more">补充更多资料，增加核心竞争力</text>
							</template>
							<template v-slot:right-icon>
								<u-switch v-model="moreInfoShow"></u-switch>
							</template>
						</u-cell-item>
					</u-cell-group>
				</u-form-item>
				<u-form-item v-if="moreInfoShow" label="微信号" prop="wechat">
					<u-input v-model="teacherInfo.wechat" :border="false" :maxlength="30" placeholder="请填写微信号"></u-input>
				</u-form-item>
				<u-form-item v-if="moreInfoShow" label="微信号" prop="nickname">
					<u-input v-model="teacherInfo.nickname" :border="false" :maxlength="30" placeholder="请填写微信昵称"></u-input>
				</u-form-item>
				<u-form-item v-if="moreInfoShow" label="电子邮箱" prop="mail">
					<u-input v-model="teacherInfo.mail" :border="false" :maxlength="30" placeholder="请填写电子邮箱"></u-input>
				</u-form-item>
				<u-form-item v-if="moreInfoShow" label="身份" prop="teacher_identity">
					<u-cell-group :border="false">
						<u-cell-item arrow-direction="down" :border-bottom="false" @click="teacherIdentityPickerShow=true">
							<template v-slot:title>
								<text v-if="teacherInfo.teacher_identity == -1" class="placeholder_color">请选择身份</text>
								<text v-else>{{teacherInfo.teacherIndentityDesc}}</text>
							</template>
						</u-cell-item>
					</u-cell-group>
				</u-form-item>
				<u-form-item v-if="moreInfoShow" label="大学开始时间" prop="school_start_time">
					<u-cell-group :border="false">
						<u-cell-item arrow-direction="down" :border-bottom="false" @click="schoolStartTimePickerShow=true">
							<template v-slot:title>
								<text v-if="teacherInfo.school_start_time">{{teacherInfo.school_start_time}}</text>
								<text v-else class="placeholder_color">请选择大学开始时间</text>
							</template>
						</u-cell-item>
					</u-cell-group>
				</u-form-item>
				<u-form-item v-if="moreInfoShow" label="大学结束时间" prop="school_end_time">
					<u-cell-group :border="false">
						<u-cell-item arrow-direction="down" :border-bottom="false" @click="schoolEndTimePickerShow=true">
							<template v-slot:title>
								<text v-if="teacherInfo.school_end_time">{{teacherInfo.school_end_time}}</text>
								<text v-else class="placeholder_color">请选择大学结束时间</text>
							</template>
						</u-cell-item>
					</u-cell-group>
				</u-form-item>
				<u-form-item v-if="moreInfoShow" label="家教经验" prop="successful_case">
					<u-input v-model="teacherInfo.successful_case" type="textarea" :height="200" :autoHeight="true" placeholder="您曾取得的教学成效、科研成果等" :maxlength="180" />
				</u-form-item>			
				<u-form-item v-if="moreInfoShow" label="标签">
					<u-input v-if="teacherInfo.biaoqianArr.length == 0" v-model="teacherInfo.biaoqianInput" placeholder="可输入3个标签，逗号分割" :border="false" @blur="onBiaoqianBlur"></u-input>
					<view v-else style="display: flex;gap: 6rpx;">
						<u-tag v-for="(o,i) in teacherInfo.biaoqianArr" :key="i" :text="o" type="success" closeable class="kemu_tag" @close="teacherInfo.biaoqianArr.splice(i,1)" />
					</view>
				</u-form-item>
				<u-form-item v-if="moreInfoShow" label="身份证照" :border-bottom="false">
					<view class="course_tip">请上传身份证照片,须看清证件号码及照片,请把证件号码后六位打码，把姓名最后一个字打码</view>
				</u-form-item>
				<u-form-item v-if="moreInfoShow" prop="">
					<view class="xuexin_upload">
						<view class="p_img_flex">
							<view v-if="teacherInfo.id_card_zheng" class="xuexin_img_section p_img_item">
								<u-image class="img-pic" width="120rpx" height="120rpx" 
									:src="teacherInfo.id_card_zheng!=''&&teacherInfo.id_card_zheng.indexOf('http')==-1 ? url+teacherInfo.id_card_zheng : teacherInfo.id_card_zheng" mode="aspectFill"></u-image>
								<image @click="teacherInfo.id_card_zheng = ''" class="xuexin_img" style="width:44rpx;height:44rpx;" src="/static/images/guanbi.png"></image>
							</view>
							<view v-else @click="onIdPicUpload(1)" style="width:120rpx !important;height:120rpx !important;" class="p_upload-pic">+</view>
							
							<view v-if="teacherInfo.id_card_fan" class="xuexin_img_section p_img_item">
								<u-image class="img-pic" width="120rpx" height="120rpx" 
									:src="teacherInfo.id_card_fan!=''&&teacherInfo.id_card_fan.indexOf('http')==-1 ? url+teacherInfo.id_card_fan : teacherInfo.id_card_fan" mode="aspectFill"></u-image>
									<image @click="teacherInfo.id_card_fan = ''" class="xuexin_img" style="width:44rpx;height:44rpx;" src="/static/images/guanbi.png"></image>
							</view>
							<view v-else @click="onIdPicUpload(2)" style="width:120rpx !important;height:120rpx !important;" class="p_upload-pic">+</view>
						</view>
					</view>
				</u-form-item>
				<u-form-item v-if="moreInfoShow" label="高考成绩" :border-bottom="false" prop="gk_score">
					<u-cell-group :border="false">
						<u-cell-item :border-bottom="false" :arrow="false">
							<template v-slot:title>
								<text class="placeholder_color">请上传高考成绩查询截图,姓名最后一个字打码,证件号码后六位打码</text>
							</template>
							<template v-slot:right-icon>
								<view v-if="teacherInfo.gk_score" class="xuexin_img_section">
									<u-image class="img-pic" width="72rpx" height="72rpx" 
										:src="teacherInfo.gk_score!=''&&teacherInfo.gk_score.indexOf('http')==-1 ? url+teacherInfo.gk_score : teacherInfo.gk_score" mode="aspectFill"></u-image>
									<image @click="teacherInfo.gk_score = ''" class="xuexin_img" style="width:32rpx;height:32rpx;" src="/static/images/guanbi.png"></image>
								</view>
								<view v-else>
									<view @click="onGkScoreUpload" class="p_upload-pic" style="width:72rpx !important;height:72rpx !important;">+</view>
								</view>
							</template>
						</u-cell-item>
					</u-cell-group>
				</u-form-item>
				<u-form-item v-if="moreInfoShow" label="毕业证书" :border-bottom="false">
					<view class="course_tip">请上传毕业证书或学生证，须看清证书编号。请把证件号码后六位打码，把姓名最后一个字打码</view>
				</u-form-item>
				<u-form-item v-if="moreInfoShow" prop="">
					<view class="xuexin_upload">
						<view class="p_img_flex">
							<view v-if="teacherInfo.diploma_img" class="xuexin_img_section p_img_item">
								<u-image class="img-pic" width="120rpx" height="120rpx" 
									:src="teacherInfo.diploma_img!=''&&teacherInfo.diploma_img.indexOf('http')==-1 ? url+teacherInfo.diploma_img : teacherInfo.diploma_img" mode="aspectFill"></u-image>
								<image @click="teacherInfo.diploma_img = ''" class="xuexin_img" style="width:44rpx;height:44rpx;" src="/static/images/guanbi.png"></image>
							</view>
							<view v-else @click="onBiyeZhengshuUpload" style="width:120rpx !important;height:120rpx !important;" class="p_upload-pic">+</view>
						</view>
					</view>
				</u-form-item>
				<u-form-item v-if="moreInfoShow" label="教师资格证" :border-bottom="false">
					<view class="course_tip">请把证件号码后六位打码，把姓名最后一个字打码</view>
				</u-form-item>
				<u-form-item v-if="moreInfoShow" prop="">
					<view class="xuexin_upload">
						<view class="p_img_flex">
							<view v-if="teacherInfo.itic_img" class="xuexin_img_section p_img_item">
								<u-image class="img-pic" width="120rpx" height="120rpx" 
									:src="teacherInfo.itic_img!=''&&teacherInfo.itic_img.indexOf('http')==-1 ? url+teacherInfo.itic_img : teacherInfo.itic_img" mode="aspectFill"></u-image>
								<image @click="teacherInfo.itic_img = ''" class="xuexin_img" style="width:44rpx;height:44rpx;" src="/static/images/guanbi.png"></image>
							</view>
							<view v-else @click="onCareerUpload" style="width:120rpx !important;height:120rpx !important;" class="p_upload-pic">+</view>
						</view>
					</view>
				</u-form-item>
				<u-form-item v-if="moreInfoShow" label="所获证书" :border-bottom="false">
					<u-input v-model="teacherInfo.honor" placeholder="请填写所获证书信息,多个荣誉逗号分割" :maxlength="200" :border="false"></u-input>
				</u-form-item>
				<u-form-item v-if="moreInfoShow" prop="">
					<view class="xuexin_upload">
						<view class="p_img_flex">
							<view v-for="(item, index) in teacherInfo.honorImages" :key="index" class="xuexin_img_section p_img_item">
								<u-image class="img-pic" width="120rpx" height="120rpx" 
									:src="item!=''&&item.indexOf('http')==-1 ? url+item : item" mode="aspectFill"></u-image>
								<image @click="onDeleteHonor(item,index)" class="xuexin_img" style="width:44rpx;height:44rpx;" src="/static/images/guanbi.png"></image>
							</view>
							<view v-if="teacherInfo.honorImages.length < 20" @click="onHornoUpload" style="width:120rpx !important;height:120rpx !important;" class="p_upload-pic">+</view>
						</view>
					</view>
				</u-form-item>
				<u-form-item v-if="moreInfoShow" label="教师职称" :border-bottom="false">
					<u-input v-model="teacherInfo.teacher_title" placeholder="请填写职称" :maxlength="50" :border="false"></u-input>
				</u-form-item>
				<u-form-item v-if="moreInfoShow" prop="">
					<view class="xuexin_upload">
						<view class="p_img_flex">
							<view v-if="teacherInfo.teacher_title_img" class="xuexin_img_section p_img_item">
								<u-image class="img-pic" width="120rpx" height="120rpx" 
									:src="teacherInfo.teacher_title_img!=''&&teacherInfo.teacher_title_img.indexOf('http')==-1 ? url+teacherInfo.teacher_title_img : teacherInfo.teacher_title_img" mode="aspectFill"></u-image>
								<image @click="teacherInfo.teacher_title_img = ''" class="xuexin_img" style="width:44rpx;height:44rpx;" src="/static/images/guanbi.png"></image>
							</view>
							<view v-else @click="onTeacherTitleUpload" style="width:120rpx !important;height:120rpx !important;" class="p_upload-pic">+</view>
						</view>
					</view>
				</u-form-item>
				<u-form-item v-if="moreInfoShow" label="个人视频" :border-bottom="false">
					<view class="course_tip">
						<view>1、最多上传1个视频，建议视频120秒内</view>
						<view>2、视频内容可以是老师的个人介绍/教学展示/作品展示</view>
						<view>3、视频开头介绍统一话术：各位家长学生大家好，我是献新家教的XX老师...</view>
					</view>
				</u-form-item>
				<u-form-item v-if="moreInfoShow" prop="">
					<view class="xuexin_upload">
						<view class="p_img_flex">
							<view v-if="teacherInfo.works" class="xuexin_img_section p_img_item">
								<video class="video" :src="teacherInfo.works!=''&&teacherInfo.works.indexOf('http')==-1 ? url+teacherInfo.works : teacherInfo.works"></video>
								<image @click="teacherInfo.works = ''" class="video-close" src="/static/images/guanbi.png" style="width:32rpx;height:32rpx;"></image>
							</view>
							<view @click="onVideo" style="width:120rpx !important;height:120rpx !important;" class="p_upload-pic">+</view>
							<view class="uploadStatus" v-if="isShowUpload">上传中，请稍后...</view>
						</view>
					</view>
				</u-form-item>

			</u-form>
		</view>
		
		
		<view v-if="isShowTip == 2 && dataLoaded" class="" style="width: 100%;text-align: center;margin: 20rpx 0;">
			<text v-if="status==0" style="color: yellow; font-size: 34rpx;">审核中</text>
			<text v-if="status==1" style="color: green;font-size: 34rpx;">审核通过</text>
			<text v-if="status==2" style="color: red;font-size: 34rpx;">审核未通过</text>
		</view>
		<view v-if="isShowTip == 2 && dataLoaded" class="" style="display: flex;align-items: center;width: 100%;justify-content: center;margin-top: 30rpx;">
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
		<view v-if="isShowTip == 2 && dataLoaded" class="submit-box" style="border:none;">
			<view v-if="status == 1" @click="onOff" class="btn_off" style="">下架</view>
			<view @click="submit" class="btn btnbg1" style="margin: 0;">提交审核</view>
			<view v-if="status == 1" @click="formSubmit" class="seemap">
				<image class="addressIcon" src="/static/images/22.png"></image>分享简历
			</view>
		</view>
		<view class="zw"></view>

		<view class="haibao" v-if="dataLoaded && showCanvas" @click="showCanvas=false">
			<view class="hais" @click.stop="">
				<canvas style="width: 570rpx;height: 910rpx;" id="myCanvad" canvas-id="myCanvad"></canvas>
			</view>
			<view class="baocun" @click.stop="saveImg">
				<text>保存到相册</text>
			</view>
		</view>
		
		<!-- 分类-年级-学科级联picker-->
		<u-popup v-model="categorySelectShow" mode="bottom" @close="categorySelectShow = false">
			<view class="pop_category">
				<view class="pop_category_tip">
					<view>提示：</view>
					<view>1. 点击选择科目</view>
					<view>2. 选择科目后填写课时费(元/小时)</view>
					<view>中小学30~80/小时,高中75~150/小时(大学生);中小学100~120/小时,高中200~300/小时(老师)</view>
				</view>
				<view>
				<u-cell-group>
					<u-cell-item v-for="(n,i) in 4" :key="i" :title="`科目${n+1}`" :arrow="false" :use-label-slot="true">
						<template v-slot:right-icon>
							<u-tag v-if="teacherInfo.categoryCascadeList.length > n" mode="plain" type="primary" 
								:text="teacherInfo.categoryCascadeList[n].gradeName + ' - ' + teacherInfo.categoryCascadeList[n].subjectName"
								closeable 
								@close="teacherInfo.categoryCascadeList.splice(n, 1)"
								></u-tag>
							<view v-else @click="onKemuPicker(n)">请点击选择科目</view>
						</template>
						<template v-slot:label>
							<view v-if="teacherInfo.categoryCascadeList.length > n">
								<u-number-box v-model="teacherInfo.categoryCascadeList[n].price" :min="10" :max="1000" :step="5"></u-number-box>
							</view>
							<view v-else>
								<u-number-box :disabled="true"></u-number-box>
							</view>
						</template>
					</u-cell-item>
				</u-cell-group>
				</view>
				<view style="margin-top: 36rpx;" >
					<u-button type="primary" @click="onCategoryConfirm">确定</u-button>
				</view>
			</view>
			<u-select v-model="categorySelectNestShow" mode="mutil-column-auto" :list="categoryCascadeList" label-name="label" value-name="value" child-name="children"
				@confirm="onCategorySelectConfirm" @cancel="categorySelectNestShow=false">
			</u-select>
		</u-popup>
		<!-- 授课城市级联 -->
		<u-select v-model="cityCascadeShow" mode="mutil-column-auto" :list="cityCascadeList" label-name="name" value-name="id" child-name="children"
			@confirm="onCitySelectConfirm" @cancel="cityCascadeShow=false">
		</u-select>
		<!-- 区域选择 -->
		<u-popup v-model="countyPopShow" mode="bottom" @close="countyPopShow = false">
			<view class="pop_category">
				<view class="pop_category_tip">
					<view>提示：</view>
					<view>1. 点击区域选中</view>
					<view>2. 请选择1-4个区域</view>
				</view>
				<view class="pop_county_list">
					<u-tag v-for="(o,i) in countyList" :key="i" :text="o.name" mode="plain" :type="o.selected ? 'primary' : 'info'" @click="onCountyClick(o,i)"></u-tag>
				</view>
				<u-button type="primary" @click="onCountyConfirm">确定</u-button>
			</view>
		</u-popup>
		<!-- 从事家教时间 -->
		<u-picker v-model="careerStartPickerShow" mode="time" :params="careerStartPickerParam" :end-year="careerStartPickerEndYear" @cancel="careerStartPickerShow=false" 
			@confirm="onCareerStartConfirm"></u-picker>
		<!-- 工作时间select -->
		<u-select v-model="workTimeSelectShow" mode="mutil-column-auto" :list="workTimeList" label-name="label" value-name="value" child-name="children"
			@confirm="onWorktimeConfirm" @cancel="workTimeSelectShow=false">
		</u-select>
		<!-- 教师身份 -->
		<u-picker v-model="teacherIdentityPickerShow"  mode="selector" :default-selector="[0]" @cancel="teacherIdentityPickerShow=false" :range="teacherIndentityList"
			@confirm="onTeacherIndentityConfirm"></u-picker>
		<!-- 学历-->
		<u-picker v-model="educationPickerShow"  mode="selector" :default-selector="[0]" @cancel="educationPickerShow=false" :range="xueliList"
			@confirm="onEducationConfirm"></u-picker>
		<!-- 学校时间 -->
		<u-picker v-model="schoolStartTimePickerShow"  mode="time" @cancel="schoolStartTimePickerShow=false" :params="pickerYmdParam"
				@confirm="onSchoolStartTimeConfirm"></u-picker>
		<u-picker v-model="schoolEndTimePickerShow"  mode="time" @cancel="schoolEndTimePickerShow=false" :params="pickerYmdParam"
				@confirm="onSchoolEndTimeConfirm"></u-picker>		
		
	</view>
</template>

<script>
	import { getCategoryCascadeList, offProfile } from '@/comm/api_teacher.js'
	import { getCityCascade, uploadFile, getCityCountyList, getMiniConfig } from '@/comm/api_common.js'
	export default {
		data() {
			return {
				navBack: 0,
				check: false,
				isRed: false,
				showInfo: 1,
				isShowTip: uni.getStorageSync('isShowTip') || 1,
				isShowGb: true,
				timeOutNum: 5,
				userInfo: {},
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
				status: NaN,
				url: this.imgUrl,
				shopTipImage: '/static/images/xuzhi.png',
				timer: '',
				showCanvas: '',
				tempFilePath: '',
				
				// 教师信息
				pickerYmdParam: {
					year: true,
					month: true,
					day: true
				},
				dataLoaded: false,
				teacherInfo: {
					name: '', // 姓名
					id_number: '', // 身份证
					mobile: '', //手机号
					categoryCascadeList: [], //科目cascade
					categoryCascadeInputValue: '',
					cityCascadeList: [], //授课城市
					cityCascadeInputValue: '',
					head_img: '', //头像图片
					chsi_img: '', //学信网图片
					school: '', //院校名称
					career_year: '', //生涯开始时间
					workTimeList: [],
					workTimeDesc: '', //
					workTimeTip: '默认全时段可授课(可多选)',
					selfIntroduction: '', //自我介绍  experience_json 其中一个
					biaoqianInput: '',
					biaoqianArr: [], //标签组
					gk_score: '', //高考成绩
					education: '', //学历
					specialty: '', //专业
					birthplace: '', //籍贯
					wechat: '', //微信号
					nickname: '', //微信昵称
					mail: '', //邮箱
					teacher_identity: -1, //教师身份(index)
					teacherIndentityDesc: '', // 教师身份
					currentLocation: '', // 当前定位
					longitude: '', //经度
					latitude: '', //纬度
					successful_case: '', // 家教经验
					photeList: [], // 个人照片
					id_card_zheng: '', //身份证正面
					id_card_fan: '', //身份证反面
					diploma_img: '', //毕业证书/学生证
					itic_img: '', //教师资格证
					honor: '', //奖励荣誉
					honorImages: [], //奖励荣誉图片
					teacher_title: '', //教师职称
					teacher_title_img: '', //教师职称证书
					works: '', //个人作品
					qrcode: '', //二维码
					school_start_time: '',
					school_end_time: ''
				},
				// 教师信息表单
				teacherRules: {
					name: [
						{ type: 'string', required: true, message: '请填写姓名',trigger: ['blur', 'change']},
						{ type: 'string', max: 20, message: '长度不能超过20', trigger: ['blur', 'change']},
					],
					head_img: [
						{ type: 'string', required: true, message: '请上传头像',trigger: ['blur', 'change']},
					],
					id_number: [
						{ type: 'string', required: true, message: '请填写身份证', trigger: ['blur', 'change']},
						{
							validator: (rule, value, callback) => {
								return uni.$u.test.idCard(value);
							},
							message: '请检查身份证号码是否正确',
							trigger: ['blur', 'change']
						}
					],
					mobile: [
						{ type: 'string', required: true, message: '请填写手机号',trigger: ['blur', 'change']},
						{
							validator: (rule, value, callback) => {
								return uni.$u.test.mobile(value);
							},
							message: '请检查手机号是否正确',
							trigger: ['blur', 'change']
						}
					],
					school: [
						{ type: 'string', required: true, message: '请填写院校',trigger: ['blur', 'change']},
						{ type: 'string', max: 80, message: '长度不能超过80', trigger: ['blur', 'change']},
					],
					specialty: [
						{ type: 'string', required: true, message: '请填写专业',trigger: ['blur', 'change']},
						{ type: 'string', max: 20, message: '长度不能超过20', trigger: ['blur', 'change']},
					],
					categoryCascadeList: [
						{
							validator: (rule, value, callback) => {
								return value.length > 0;
							},
							message: '请选择1-4个科目',
							trigger: ['blur', 'change']
						}
					],
					chsi_img: [
						{ type: 'string', required: true, message: '请上传学信网照片',trigger: ['blur', 'change']},
					],
					career_year: [
						{
							validator: (rule, value, callback) => {
								return value != undefined && value > 0;
							},
							message: '请选择教龄',
							trigger: ['blur', 'change']
						}
					],
					birthplace: [
						{ type: 'string', required: true, message: '请填写籍贯信息',trigger: ['blur', 'change']},
						{ type: 'string', max: 20, message: '长度不能超过20', trigger: ['blur', 'change']},
					],
					education: [
						{ type: 'string', required: true, message: '请选择学历',trigger: ['blur', 'change']}
					],
					photeList: [
						{
							validator: (rule, value, callback) => {
								return value != undefined && value.length > 0 && value.length <= 20;
							},
							message: '请上传至少3张生活照',
							trigger: ['blur', 'change']
						}
					],
					cityCascadeInputValue: [
						{ type: 'string', required: true, message: '请选择1-4个区域',trigger: ['blur', 'change']}
					],
					currentLocation: [
						{
							validator: (rule, value, callback) => {
								return value != undefined && value.length > 0;
							},
							message: '请选择居住区域',
							trigger: ['blur', 'change']
						}
					]
				},
				categorySelectShow: false,
				categorySelectNestShow: false,
				categoryCascadeList: [],
				cityCascadeList: [],
				cityCascadeShow: false,
				countyPopShow: false,
				countyList: [],
				careerStartPickerShow: false, // 生涯开始时间picker
				careerStartPickerParam: {
					year: true,
					month: false,
					day: false,
					hour: false,
					minute: false,
					second: false
				},
				careerStartPickerEndYear: 2026,
				workTimeSelectShow: false,
				workTimeList: [
					{index: 1, value: '1', label: '周一', children: [{index: 10, value: '10', label: '全天'}, {index: 11, value: '11', label: '上午'}, {index: 12, value: '12', label: '下午'}, {index: 13, value: '13', label: '晚上'}]},
					{index: 2, value: '2', label: '周二', children: [{index: 20, value: '20', label: '全天'}, {index: 21, value: '21', label: '上午'}, {index: 22, value: '22', label: '下午'}, {index: 23, value: '23', label: '晚上'}]},
					{index: 3, value: '3', label: '周三', children: [{index: 30, value: '30', label: '全天'}, {index: 31, value: '31', label: '上午'}, {index: 32, value: '32', label: '下午'}, {index: 33, value: '33', label: '晚上'}]},
					{index: 4, value: '4', label: '周四', children: [{index: 40, value: '40', label: '全天'}, {index: 41, value: '41', label: '上午'}, {index: 42, value: '42', label: '下午'}, {index: 43, value: '43', label: '晚上'}]},
					{index: 5, value: '5', label: '周五', children: [{index: 50, value: '50', label: '全天'}, {index: 51, value: '51', label: '上午'}, {index: 52, value: '52', label: '下午'}, {index: 53, value: '53', label: '晚上'}]},
					{index: 6, value: '6', label: '周六', children: [{index: 60, value: '60', label: '全天'}, {index: 61, value: '61', label: '上午'}, {index: 62, value: '62', label: '下午'}, {index: 63, value: '63', label: '晚上'}]},
					{index: 7, value: '7', label: '周日', children: [{index: 70, value: '70', label: '全天'}, {index: 71, value: '71', label: '上午'}, {index: 72, value: '72', label: '下午'}, {index: 73, value: '73', label: '晚上'}]}
				],
				moreInfoShow: false,
				teacherIdentityPickerShow: false, // 教师身份picker控制
				educationPickerShow: false, //学历picker控制
				teacherIndentityList: ['大学生教员', '专业教员'],
				xueliList: ['本科','研究生','博士','其他'],
				schoolStartTimePickerShow: false,
				schoolEndTimePickerShow: false,
				
				isSubmit: false,
				teacherId: ''
			}
		},
		onReady(){
			this.$nextTick(()=>{
				this.$refs.teacherFormRef.setRules(this.teacherRules);
			})
		},
		async onLoad(options) {
			if(options.navBack){
				this.navBack = options.navBack
			}
			if(options.tipImage){
				this.shopTipImage = options.tipImage != 'static/images/xuzhi.png' && options.tipImage.indexOf('http')==-1 ? this.url+options.tipImage : options.tipImage
			}
			if (options.showInfo) {
				this.showInfo = options.showInfo
			}
			
			
			
			const system = uni.getSystemInfoSync()
			const w = system.windowWidth / 750
			this.w = w
			await this.initData()
			
			this.showBigImg()
			this.userInfo = uni.getStorageSync('user')
			if(this.userInfo){
				this.teacherInfo.mobile = this.userInfo.mobile
			}
			if (this.userInfo && this.userInfo.teacher_info) {
				this.teacherId = this.userInfo.teacher_info.teacher_id
				this.getTeacherInfo()
			}else{
				this.dataLoaded = true
			}
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
			async initData(){
				getMiniConfig().then(res => {
					const tipImage = res.data.teacher_register_tip
					this.shopTipImage = tipImage != '/static/images/xuzhi.png' && tipImage.indexOf('http')==-1 ? this.url+tipImage : tipImage
				})
				
				const time = new Date()
				this.careerStartPickerEndYear = time.getFullYear()
				
				const res1 = await getCategoryCascadeList()
				this.categoryCascadeList = res1.data

				const res2 = await getCityCascade();
				this.cityCascadeList = res2.data
			},
			/**
			 * 初始化身份
			 */
			initTeacherIndentity(){
				const index = this.teacherInfo.teacher_identity - 1
				this.teacherInfo.teacherIndentityDesc = this.teacherIndentityList[index]
			},
			/**
			 * 教师身份选择
			 * @param {Object} e
			 */
			onTeacherIndentityConfirm(e){
				const index = e[0]
				this.teacherInfo.teacher_identity = (index + 1)
				this.teacherInfo.teacherIndentityDesc = this.teacherIndentityList[index]
			},
			/**
			 * 初始化标签
			 */
			initTags(){
				if(this.teacherInfo.label && this.teacherInfo.label.length > 0){
					this.teacherInfo.biaoqianArr = this.teacherInfo.label.split(',')
				}
			},
			/**
			 * 标签失焦
			 * @param {Object} e
			 */
			onBiaoqianBlur(e){
				let _str = this.teacherInfo.biaoqianInput
				if(_str == undefined || _str.length == 0){
					return
				}
				console.log('=====> onBiaoqianBlur _str ', _str)
				_str = _str.replaceAll("，",",")
				const tags = _str.split(',')
				let _list = []
				for(var i = 0; i < tags.length; i++){
					if(i == 3){
						break
					}
					_list.push(tags[i])
				}
				this.teacherInfo.biaoqianArr = _list
				this.teacherInfo.biaoqianInput = ''
			},
			/**
			 * 初始化授课时间
			 */
			initWorktime(){
				if(!this.teacherInfo.schooltime || this.teacherInfo.schooltime.length == 0){
					return
				}
				let _list = []
				for(var i in this.teacherInfo.schooltime){
					const _item = this.teacherInfo.schooltime[i]
					let day = ''
					let time = ''
					let timeName = ''
					const startTime = Number(_item.start_time.replace(':', ''))
					const endTime = Number(_item.end_time.replace(':', ''))
					if(_item.week = '周一'){
						day = '1'
					}else if(_item.week = '周二'){
						day = '2'
					}else if(_item.week = '周三'){
						day = '3'
					}else if(_item.week = '周四'){
						day = '4'
					}else if(_item.week = '周无'){
						day = '5'
					}else if(_item.week = '周六'){
						day = '6'
					}else if(_item.week = '周日'){
						day = '7'
					}else{
						day = '7'
					}
					if(startTime <= 900 && endTime >= 1800){
						time = day * 10 + '0'
						timeName = '全天'
					}else if(endTime <= 1200){
						time = day * 10 + '1'
						timeName = '上午'
					}else if(endTime <= 1800){
						time = day * 10 + '2'
						timeName = '下午'
					}else{
						time = day * 10 + '3'
						timeName = '晚上'
					}
					const keyid = `${day}_${time}`
					const _data = { keyid: keyid, day: day, dayName: _item.week, time: time, timeName: timeName }
					_list.push(_data)
				}
				let _desc = ''
				for(var i in _list){
					const _item = _list[i]
					if(i != 0){
						_desc += ';'
					}
					_desc += _item.dayName + _item.timeName
				}
				this.teacherInfo.workTimeList = _list
				this.teacherInfo.workTimeDesc = _desc
				this.teacherInfo.workTimeTip = ''
			},
			/**
			 * 确认工作时间
			 * @param {Object} e
			 */
			onWorktimeConfirm(e){
				const day = e[0].value
				const dayName = e[0].label
				const time = e[1].value
				const timeName = e[1].label
				const keyid = `${day}_${time}`
				const exists = this.teacherInfo.workTimeList.some(item => item.keyid === keyid)
				if (exists) {
					return
				}
				const _data = { keyid: keyid, day: day, dayName: dayName, time: time, timeName: timeName }
				this.teacherInfo.workTimeList.push(_data)
				
				let _desc = ''
				for(var i in this.teacherInfo.workTimeList){
					const _item = this.teacherInfo.workTimeList[i]
					if(i != 0){
						_desc += ';'
					}
					_desc += _item.dayName + _item.timeName
				}
				this.teacherInfo.workTimeDesc = _desc
				this.teacherInfo.workTimeTip = ''
			},
			/**
			 * 家教开始时间picker确认
			 * @param {Object} e
			 */
			onCareerStartConfirm(e){
				this.teacherInfo.career_year = e.year
				this.careerStartPickerShow = false
			},
			onCitySelect(){
				this.countyList = []
				this.cityCascadeShow = true
			},
			/**
			 * 初始化授课区域
			 */
			initCounty(){
				const province = this.teacherInfo.province
				const city = this.teacherInfo.city
				if(!city){
					return
				}

				const provinceItem = this.cityCascadeList.find(r => r.name == province)
				if(!provinceItem){
					return
				}
				const cityItem = provinceItem.children.find(r => r.name == city)
				const _data = { provinceId: provinceItem.id, provinceName: province, cityId: cityItem.id, cityName: city }
				this.teacherInfo.cityCascadeList = [_data]
				const countyStrs = this.teacherInfo.area.split(',')
				let _countyList = []
				let _inputValue = city + '|'
				for(var i in countyStrs){
					_countyList.push({
						selected: true,
						name: countyStrs[i]
					})
					_inputValue += (countyStrs[i] + ',')
				}
				if(_inputValue.endsWith(',')){
					_inputValue = _inputValue.substring(0, _inputValue.length - 1)
				}
				this.teacherInfo.cityCascadeInputValue = _inputValue
				this.countyList = _countyList
			},
			/**
			 * 选择授课城市（单选）
			 * @param {Object} e
			 */
			onCitySelectConfirm(e){
				const provinceId = e[0].value
				const provinceName = e[0].label
				const cityId = e[1].value || 0
				const cityName = e[1].label || provinceName
				const _data = { provinceId: provinceId, provinceName: provinceName, cityId: cityId, cityName: cityName }
				this.teacherInfo.cityCascadeList = [_data]
				getCityCountyList(cityId).then(res => {
					let _list = []
					res.data.forEach(r => {
						r.selected = false
						_list.push(r)
					})
					this.countyList = _list
					this.countyPopShow = true
				})
			},
			/**
			 * 删除科目
			 * @param {Object} o 科目
			 * @param {Object} i index
			 */
			onKemuDelete(o,i){
				this.teacherInfo.categoryCascadeList.splice(i,1)
				if(this.teacherInfo.categoryCascadeList.length == 0){
					this.teacherInfo.categoryCascadeInputValue = ''
				}
			},
			/**
			 * 初始化科目
			 */
			initCategory(){
				let _list = []
				for(var i in this.teacherInfo.teaching_subject){
					const _item = this.teacherInfo.teaching_subject[i]
					const keyid = `${_item.category_id}_${_item.grade_id}_${_item.subject_id}`
					const _data = { keyid: keyid, 
									categoryId: _item.category_id, categoryName: _item.category_name, 
									gradeId: _item.grade_id, gradeName: _item.grade_name, 
									subjectId: _item.subject_id, subjectName: _item.subject_name, 
								price: _item.price }
					_list.push(_data)
				}
				this.teacherInfo.categoryCascadeList = _list
				this.teacherInfo.categoryCascadeInputValue = '\u200B'
			},
			/**
			 * 选择科目
			 * @param {Object} e
			 */
			onCategorySelectConfirm(e){
				const categoryId = e[0].value
				const categoryName = e[0].label
				const gradeId = e[1].value
				const gradeName = e[1].label
				const subjectId = e[2].value
				const subjectName = e[2].label
				const keyid = `${categoryId}_${gradeId}_${subjectId}`
				let _list = this.teacherInfo.categoryCascadeList
				const exists = _list.some(item => item.keyid === keyid)
				if (exists) {
					return
				}
				if(_list.length >= 4){
					uni.showToast({
						icon:'none',
						title: '最多选择4个科目'
					})
					return
				}
				const _data = { keyid: keyid, categoryId: categoryId, categoryName: categoryName, gradeId: gradeId, gradeName: gradeName, subjectId: subjectId, subjectName: subjectName, price: 0 }
				_list.push(_data)
				this.categorySelectNestShow = false
				this.teacherInfo.categoryCascadeList = _list
			},
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
					ctx.drawImage('../static/images/haibao.png', 0, 0, 570 * that.w, 910 * that.w)
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
													console.log(res2)
													that.tempFilePath =
														res2
														.tempFilePath
												}
											})
										})
									}, 500)

								},
								complete(){
									uni.hideLoading()
								}
							})
						},
						fail() {
							uni.hideLoading()
						}
					})
				} else {
					uni.showToast({
						title: '请提交简历',
						icon: 'none'
					})
				}

			},
			showBigImg() {
				if (this.isShowTip == 1) {
					this.timeOutNum = 5
					this.timer = setInterval(() => {
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
				uploadFile(e.detail.avatarUrl, 'image', (res) => {
					console.log(res)
					that.teacherInfo.head_img = res
				})
				console.log(e)
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
			mergeIgnoreNull(target, source) {
			    for (let key in source) {
			        if (source.hasOwnProperty(key)) {
			            // 只有当 source 的值不为 null 且不为 undefined 时才赋值
			            if (source[key] !== null && source[key] !== undefined) {
			                target[key] = source[key];
			            }
			        }
			    }
			    return target;
			},
			getTeacherInfo() {
				if (this.teacherId) {
					this.api('/index/getTeacherInfo', 'post', {
						teacher_id: this.teacherId
					}).then(res => {
						let data = res.data
						console.log('=====> data ', data)
						this.mergeIgnoreNull(this.teacherInfo, data);
						console.log('=====> teacherInfo ', this.teacherInfo)
						this.initCategory()
						this.initCounty()
						this.initPhotes()
						this.initTags()
						this.initHonorImages()
						this.initWorktime()
						this.initTeacherIndentity()
						this.status = data.status
						if (data.status == 1) {
							uni.setNavigationBarTitle({
								title: '注册成功,审核通过'
							})
						}
					}).finally(()=>{
						this.dataLoaded = true
					})
				} else {
					this.phone = this.userInfo.mobile || ''
					this.dataLoaded = true
				}
			},
			submit(){
				if (this.isSubmit) {
					return
				}
				console.log('=====> data ', JSON.stringify(this.teacherInfo))
				const _this = this
				this.$refs.teacherFormRef.validate(valid => {
					if (valid) {
						console.log('=====> 验证成功');
						_this.doSubmit()
					} else {
						console.log('=====> 验证失败');
						return false
					}
				});
			},
			doSubmit() {
				if (!this.check) {
					uni.showToast({
						title: '请阅读并同意协议',
						icon: "none"
					})
					return
				}
				
				
				let data = this.teacherInfo

				//gender 性别  男|1|success,女|2|warning
				let birthYear = '';
				let genderCode = '';
				if (data.id_number.length === 18) {
				    // 18位身份证：第7-14位是生日，第17位是性别
				    birthYear = data.id_number.substring(6, 10);
				    genderCode = data.id_number.substring(16, 17);
				} else if (data.id_number.length === 15) {
				    // 15位身份证（老式）：第7-12位是生日(YYMMDD)，年份默认19xx，第15位是性别
				    birthYear = '19' + data.id_number.substring(6, 8);
				    genderCode = data.id_number.substring(14, 15);
				}
				const gender = parseInt(genderCode) % 2 === 1 ? 1 : 2
				data.gender = gender
				
				const today = new Date();
				let age = today.getFullYear() - Number(birthYear)
				data.age = age
				
				//teaching_age
				data.teaching_age = today.getFullYear() - Number(data.career_year)
				
				// experience_json
				if(data.selfIntroduction){
					data.experience_json = JSON.stringify([{experience: data.selfIntroduction}])
				}
				//honor_img
				if(data.honorImages){
					data.honor_img = data.honorImages.join(',')
				}
				//label
				if(data.biaoqianArr){
					data.label = data.biaoqianArr.join(',')
				}
				//province city area
				const _city = data.cityCascadeList[0]
				data.province = _city.provinceName
				data.city = _city.cityName
				data.area = this.countyList.filter(r=>r.selected).map(r=>r.name).join(',')
				//photos
				if(data.photeList){
					data.photos = data.photeList.join(',')
				}
				
				// teaching_subject_json 教授课程 [{"category_id":1,"grade_id":1,"subject_id":1,"is_main":1}]
				let teaching_subject_json = []
				for(var i in data.categoryCascadeList){
					const _item = data.categoryCascadeList[i]
					teaching_subject_json.push({
						category_id: _item.categoryId,
						grade_id: _item.gradeId,
						subject_id: _item.subjectId,
						price: _item.price,
						is_main: i == 0
					})
				}
				data.teaching_subject_json = JSON.stringify(teaching_subject_json)
				
				// schooltime_json 上课时间 [{"week":"周一","start_time":"08:00","end_time":"12:00"}]
				let schooltime_json = []
				if(data.workTimeList.length == 0){ // 所有时间可以
					schooltime_json = [
						{"week":"周一","start_time":"09:00","end_time":"21:00"},
						{"week":"周二","start_time":"09:00","end_time":"21:00"},
						{"week":"周三","start_time":"09:00","end_time":"21:00"},
						{"week":"周四","start_time":"09:00","end_time":"21:00"},
						{"week":"周五","start_time":"09:00","end_time":"21:00"},
						{"week":"周六","start_time":"09:00","end_time":"21:00"},
						{"week":"周日","start_time":"09:00","end_time":"21:00"}
					]
				}else{
					for(var i in data.workTimeList){
						const _item = data.workTimeList[i]
						let _week = ''
						if(_item.day == '1'){
							_week = '周一'
						}else if(_item.day == '2'){
							_week = '周二'
						}else if(_item.day == '3'){
							_week = '周三'
						}else if(_item.day == '4'){
							_week = '周四'
						}else if(_item.day == '5'){
							_week = '周五'
						}else if(_item.day == '6'){
							_week = '周六'
						}else if(_item.day == '7'){
							_week = '周日'
						}
						const time = Number(_item.time) % 10
						let start_time = ''
						let end_time = ''
						if(time == 0){
							start_time = '09:00'
							end_time = '21:00'
						}else if(time == 1){
							start_time = '09:00'
							end_time = '12:00'
						}else if(time == 2){
							start_time = '12:00'
							end_time = '18:00'
						}else if(_item.day == 3){
							start_time = '18:00'
							end_time = '21:00'
						}
						schooltime_json.push(
							{"week":_week,"start_time":start_time,"end_time":end_time}
						)
					}
				}
				data.schooltime_json = JSON.stringify(schooltime_json)
				
				console.log('=====> data before submit ', JSON.stringify(data))
				
				this.isSubmit = true
				this.api('/user/teacherReg', 'post', data).then(res => {
					if (res.status == 200) {
						uni.setStorageSync('names', this.teacherInfo.currentLocation)
						uni.setStorageSync('longitudes', this.teacherInfo.longitude)
						uni.setStorageSync('latitudes', this.teacherInfo.latitude)
						uni.showToast({
							title: res.msg,
							icon: "none"
						}) 
						// 后退
						if(this.navBack == 1){
							setTimeout(() => {
								uni.navigateBack({
									delta: 1
								})
							}, 1500)
						}else{
							setTimeout(() => {
								uni.switchTab({
									url: '/pages/my/my'
								})
							}, 1500)
						}
					} else {
						uni.showToast({
							title: res.msg,
							icon: "none"
						})
					}
				}).finally(()=>{
					this.isSubmit = false
				})
			},
			gettx() {
				let that = this
				uni.chooseImage({
					count: 1,
					success(res) {
						console.log(res)
						uploadFile(res.tempFilePaths[0], 'image', (res1) => {
							console.log(typeof res1.data)
							that.txPic = res1
						})
					}
				})
			},
			/**
			 * 原openAddress
			 */
			onOpenLocationChoose() {
				let that = this
				uni.getSetting({
					success(res) {
						if (res.authSetting['scope.userLocation']) {
							uni.chooseLocation({
								success(e) {
									that.teacherInfo.currentLocation = e.name
									that.teacherInfo.longitude = e.longitude
									that.teacherInfo.latitude = e.latitude
								}
							})
						} else {
							that.auth()
						}
					}
				})
			},
			/**
			 * 初始化个人照片
			 */
			initPhotes(){
				this.teacherInfo.photeList = this.teacherInfo.photos || []
			},
			/**
			 * 上传个人照片（原selectPicImg）
			 */
			onLifePhone() {
				let that = this
				uni.chooseImage({
					count: 1,
					success(res) {
						uploadFile(res.tempFilePaths[0], 'image', (res1) => {
							that.teacherInfo.photeList.push(res1)
						})
					}
				})
			},
			/**
			 * 删除个人照片
			 * @param {Object} o
			 * @param {Object} i
			 */
			onDeleteLifePhone(o,i){
				this.teacherInfo.photeList.splice(i, 1)
			},
			/**
			 * 身份证上传
			 * @param index 1 正面；2 反面
			 */
			onIdPicUpload(index){
				let that = this
				uni.chooseImage({
					count: 1,
					success(res) {
						uploadFile(res.tempFilePaths[0], 'image', (res1) => {
							if(index == 1){
								that.teacherInfo.id_card_zheng = res1
							}else{
								that.teacherInfo.id_card_fan = res1
							}
						})
					}
				})
			},
			/**
			 * 毕业证书/学生证上传
			 */
			onBiyeZhengshuUpload(){
				let that = this
				uni.chooseImage({
					count: 1,
					success(res) {
						uploadFile(res.tempFilePaths[0], 'image', (res1) => {
							that.teacherInfo.diploma_img = res1
						})
					}
				})
			},
			/**
			 * 教师资格证上传
			 */
			onCareerUpload(){
				let that = this
				uni.chooseImage({
					count: 1,
					success(res) {
						uploadFile(res.tempFilePaths[0], 'image', (res1) => {
							that.teacherInfo.itic_img = res1
						})
					}
				})
			},
			/**
			 * 初始化荣誉证书
			 */
			initHonorImages(){
				if(this.teacherInfo.honor_img && this.teacherInfo.honor_img.length > 0){
					this.teacherInfo.honorImages = this.teacherInfo.honor_img
				}
			},
			/**
			 * 荣誉证书上传
			 */
			onHornoUpload(){
				let that = this
				uni.chooseImage({
					count: 1,
					success(res) {
						uploadFile(res.tempFilePaths[0], 'image', (res1) => {
							that.teacherInfo.honorImages.push(res1)
						})
					}
				})
			},
			/**
			 * 删除个人照片
			 * @param {Object} o
			 * @param {Object} i
			 */
			onDeleteHonor(o,i){
				this.teacherInfo.honorImages.splice(i, 1)
			},
			/**
			 * 上传教师职称证书
			 */
			onTeacherTitleUpload(){
				let that = this
				uni.chooseImage({
					count: 1,
					success(res) {
						uploadFile(res.tempFilePaths[0], 'image', (res1) => {
							that.teacherInfo.teacher_title_img = res1
						})
					}
				})
			},
			/**
			 * 个人视频上传（原selectVideo）
			 */
			onVideo(){
				this.isShowUpload = true
				let that = this
				uni.chooseVideo({
					success(res) {
						console.log(res)
						uploadFile(res.tempFilePath, 'video', (res1) => {
							that.isShowUpload = false
							that.teacherInfo.works = res1
						})
					},
					fail(err) {
						console.log(err)
					}
				})
			},
			/**
			 * 学信网上传
			 */
			onXuexinUpload(){
				let that = this
				uni.chooseImage({
					count: 1,
					success(res) {
						uploadFile(res.tempFilePaths[0], 'image', (res1) => {
							that.teacherInfo.chsi_img = res1
						})
					}
				})
			},
			/**
			 * 头像上传
			 */
			onAvatarUpload(){
				let that = this
				uni.chooseImage({
					count: 1,
					success(res) {
						uploadFile(res.tempFilePaths[0], 'image', (res1) => {
							that.teacherInfo.head_img = res1
						})
					}
				})
			},
			/**
			 * 学历选择
			 * @param {Object} e
			 */
			onEducationConfirm(e){
				const index = e[0]
				this.teacherInfo.education = this.xueliList[index]
			},
			/**
			 * 高考成绩上传
			 */
			onGkScoreUpload(){
				let that = this
				uni.chooseImage({
					count: 1,
					success(res) {
						uploadFile(res.tempFilePaths[0], 'image', (res1) => {
							that.teacherInfo.gk_score = res1
						})
					}
				})
			},
			/**
			 * 科目确认
			 */
			onCategoryConfirm(){
				if(this.teacherInfo.categoryCascadeList.length == 0){
					uni.showToast({
						icon:'none',
						title:'请选择1-4个科目'
					})
					return
				}
				let priceMatch = true
				for(var i in this.teacherInfo.categoryCascadeList){
					const _item = this.teacherInfo.categoryCascadeList[i]
					if(Number(_item.price) <= 0){
						priceMatch = false
						break
					}
				}
				if(!priceMatch){
					uni.showToast({
						icon:'none',
						title:'请输入正确的课时费'
					})
					return
				}
				this.teacherInfo.categoryCascadeInputValue = '\u200B'
				this.categorySelectShow = false
			},
			/**
			 * 科目选择打开
			 * @param {Object} index
			 */
			onKemuPicker(index){
				this.categorySelectNestShow = true
			},
			/**
			 * 点击区域
			 * @param {Object} item
			 * @param {Object} index
			 */
			onCountyClick(item, index){
				let selectedNum = 0
				for(var i in this.countyList){
					const _item = this.countyList[i]
					if(_item.selected){
						selectedNum ++
					}
				}
				if(!item.selected && selectedNum >= 4){
					uni.showToast({
						icon:'none',
						title: '请选择1-4个区域'
					})
					return
				}
				item.selected = !item.selected
			},
			/**
			 * 确定区域
			 */
			onCountyConfirm(){
				if(this.teacherInfo.cityCascadeList.length == 0){
					this.teacherInfo.cityCascadeInputValue = ''
				}else{
					const city = this.teacherInfo.cityCascadeList[0]
					let _str = city.cityName + '|'
					for(var i in this.countyList){
						const _item = this.countyList[i]
						if(_item.selected){
							_str += _item.name + ','
						}
					}
					if(_str.endsWith(',')){
						_str = _str.substring(0, _str.length - 1)
					}
					this.teacherInfo.cityCascadeInputValue = _str
				}
				
				this.countyPopShow = false
			},
			onOff(){
				const _this = this
				uni.showModal({
					title:'提示',
					content: '下架后简历不再曝光,可重新提交审核',
					success(res){
						if(res.cancel){
							return
						}
						if(res.confirm){
							_this.doOffProfile()
						}
					}
				})
			},
			doOffProfile(){
				offProfile().then(() => {
					uni.showToast({
						icon:'success',
						title: '操作成功'
					})
					setTimeout(()=> {
						uni.switchTab({
							url: '/pages/my/my'
						})
					}, 1500)
				})
			},
			onSchoolStartTimeConfirm(e){
				this.teacherInfo.school_start_time = `${e.year}-${e.month}-${e.day}`
			},
			onSchoolEndTimeConfirm(e){
				this.teacherInfo.school_end_time = `${e.year}-${e.month}-${e.day}`
			}
		}
	}
</script>

<style scoped lang="less">
	@import "./register_old.less";
	
	@import "./register.less";
</style>