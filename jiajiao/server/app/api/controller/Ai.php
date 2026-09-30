<?php
namespace app\api\controller;

use think\facade\Log;

class Ai extends Common {
	
	/**
	 * @api {post} /user/autoStudent 01、AI创建学员
	 * @apiGroup ai
	 * @apiVersion 1.0.0
	 * @apiDescription  AI创建学员
     * @apiParam (输入参数：) {string}      stu_no 外部学员编号
	 * @apiParam (输入参数：) {string}      name 姓名
	 * @apiParam (输入参数：) {number}      mobile 联系方式
	 * @apiParam (输入参数：) {number}      teaching_way 授课方式  上门授课|1|primary,在线授课|2|success,均可|3|info
	 * @apiParam (输入参数：) {number}      age 年龄
	 * @apiParam (输入参数：) {number}      gender 性别  男|1|success,女|2|warning
	 * @apiParam (输入参数：) {number}      category_id     分类 id
	 * @apiParam (输入参数：) {number}      grade_id     年级 id
	 * @apiParam (输入参数：) {number}      subject_id     任教科目
	 * @apiParam (输入参数：) {string}      school 在读学校
	 * @apiParam (输入参数：) {string}      gai_kuang 学员概况
	 * @apiParam (输入参数：) {string}      province 省
	 * @apiParam (输入参数：) {string}      city 城市
	 * @apiParam (输入参数：) {string}      area 任教区域名称
	 * @apiParam (输入参数：) {string}      address 详细地址
	 * @apiParam (输入参数：) {string}      trial_time 试课时间
	 * @apiParam (输入参数：) {string}      teacher_gender 教员性别  男|1|success,女|2|warning
	 * @apiParam (输入参数：) {string}      teacher_identity 教师身份  大学生教员|1|primary,专业教员|2|success,均可|3|danger
	 * @apiParam (输入参数：) {string}      teacher_require 教员要求
	 * @apiParam (输入参数：) {string}      schooltime_json 上课时间 [{"week":"周一","start_time":"08:00","end_time":"12:00"}]
	 * @apiParam (输入参数：) {string}      longitude 经度
	 * @apiParam (输入参数：) {string}      latitude 纬度
	 * @apiParam (输入参数：) {string}      course_list [{category_id:1,subject_id:1,grade_id:1}]
	 * @apiParam (输入参数：) {string}      agent 是否中介生源。0否,1是
	 * @apiParam (输入参数：) {string}      agent_phone 中介生源电话
	 * @apiParam (输入参数：) {string}      wx_id 微信号
	 */
	public function autoStudent() {
        $password = $this->request->param('password', '', '');
        if(!$password || $password != 'Nan2026'){
            return json(['status' => 403, 'msg' => '']);
        }
        // 固定手机号
        $mobile = '15867767673';
        $member_info = db('member')->where('mobile', $mobile)->find();
        $ext_no = $this->request->param('stu_no', '', '');
		if($ext_no == 'unknown'){
			$ext_no = '学生';
		}
		if($ext_no && $ext_no != '学生'){
			$demand = db('demand')->where('ext_no', $ext_no)->find();
			if($demand){
				return json(['status' => 400, 'msg' => '学员编号已存在']);
			}
		}
		$name = $this->request->param('name', '学生', '');
		if($name == 'unknown'){
			$name = '学生';
		}
		$teaching_way = $this->request->param('teaching_way', '3', '');
        $gender = $this->request->param('gender', '1', '');
		$category_id = $this->request->param('category_id', '', '');
		$grade_id = $this->request->param('grade_id', '', '');
        $subject_name = $this->request->param('subject_name', '', '');
        //判断subject_name是否包含字符串"全科",如果有,subject_name=全科
        if (strpos($subject_name, '全科') !== false) {
            $subject_name = '全科';
        }
        $subject_info = db('subject')->where('name', $subject_name)->where('grade_id', $grade_id)->find();
        if(!$subject_info){
            $subject_info = db('subject')->where('grade_id', $grade_id)->find();
        }
		$subject_id = $subject_info['subject_id'];
		$price = $this->request->param('price', '', '');
		$school = $this->request->param('school', '', '');
		$province = $this->request->param('province', '', '');
		$city = $this->request->param('city', '', '');
		$area = $this->request->param('area', '', '');
		$address = $this->request->param('address', '', '');
		$gai_kuang = $this->request->param('gai_kuang', '', '');
        $teacher_gender = $this->request->param('teacher_gender', '2', '');
        $teacher_identity = $this->request->param('teacher_identity', '3', '');
		$teacher_require = $this->request->param('teacher_require', '', '');
		$schooltime_json = $this->request->param('schooltime_json', '', '');
        $schooltime_list = json_decode(html_out($schooltime_json), true);
		$longitude = $this->request->param('longitude', '', '');
		$latitude = $this->request->param('latitude', '', '');
		$agent = $this->request->param('agent', '0', '');
		$agent_phone = $this->request->param('agent_phone', '', '');
		$wx_id = $this->request->param('wx_id', '', '');
		
		$ins['mid'] = $member_info['mid'];
		$ins['name'] = $name;
		$ins['mail'] = '';
		$ins['mobile'] = $mobile;
		$ins['wx_id'] = $wx_id;
		$ins['teaching_way'] = $teaching_way;
		$ins['age'] = '';
		$ins['gender'] = $gender;
		$ins['category_id'] = $category_id;
		$ins['grade_id'] = $grade_id;
		$ins['subject_id'] = $subject_id;
		$ins['price'] = $price;
		$ins['school'] = $school;
		$ins['province'] = $province;
		$ins['city'] = $city;
		$ins['area'] = $area;
		$ins['address'] = $address;
		$ins['gai_kuang'] = $gai_kuang;
		$ins['trial_time'] = '';
		$ins['teacher_gender'] = $teacher_gender;
		$ins['teacher_identity'] = $teacher_identity;
		$ins['teacher_require'] = $teacher_require;
		$ins['longitude'] = $longitude;
		$ins['latitude'] = $latitude;
		$ins['create_time'] = time();
		$ins['status'] = 1;
        $ins['ext_no'] = $ext_no;
        $ins['kefu_direct'] = $agent === '1' ? 0 : 1;
		$ins['agent'] = $agent;
		$ins['agent_phone'] = $agent_phone;

		if(empty($agent_phone) && !empty($wx_id)){
			$ins['hide_mobile'] = 1;
		}else {
    		// 建议显式处理“不隐藏”的情况，防止 $ins 数组里残留旧数据
    		$ins['hide_mobile'] = 0; 
		}

		try {
			db()->startTrans();
			$ins['sn'] = doOrderSn(00);

			$demand_id = db('demand')->insertGetId($ins);
			$param = "demand_id=$demand_id";
			//生成分享码
			$qrcode = qrcode($ins['sn'], $param);
			db('demand')->where('demand_id', $demand_id)->update(['qrcode' => $qrcode]);
			foreach ($schooltime_list as $li) {
				$st_ins['week'] = $li['week'];
				$st_ins['start_time'] = $li['start_time'];
				$st_ins['end_time'] = $li['end_time'];
				$st_ins['demand_id'] = $demand_id;

				//添加授课时间
				db('schooltime')->insert($st_ins);
			}

			db()->commit();
		} catch (\Exception $e) {
			db()->rollback();
			abort(config('my.error_log_code'), $e->getMessage());
		}

		//发送符合的老师 推荐给家长邮箱
		sendTeacherToStu($demand_id);

		//发送给符合的老师
		sendStuToTeacher($demand_id);

		//发送消息给相同的学科的老师
		sendMsgToTeacher($demand_id);

		$title = '新家长发布';
		$address = ['1174481445@qq.com'];
		$qrcode = request()->domain() . '/' . $qrcode;
		$content = "        家长编号为 " . $member_info['mid'] . " 的家长,发布了适合您的家教信息,请及时查看,点击前往小程序查看生源单详情<br/> <img height='200px' src='$qrcode'/>";
		sendMail($title, $address, $content);

		return json(['status' => 200, 'msg' => '发布成功']);
	}
	/**
	 * @api {post} /user/autoTeacher 02、AI创建教师
	 * @apiGroup ai
	 * @apiVersion 1.0.0
	 * @apiDescription  AI创建教师
	 * @apiParam (输入参数：) {string}      mobile 联系方式
	 * @apiParam (输入参数：) {string}      wechat 微信号
	 * @apiParam (输入参数：) {string}      nickname 微信昵称
	 * @apiParam (输入参数：) {string}      name 姓名
	 * @apiParam (输入参数：) {number}      age 年龄 (不再传递，生日计算)
	 * @apiParam (输入参数：) {number}      birthday 生日
	 * @apiParam (输入参数：) {string}      gender 性别  男|1|success,女|2|warning
	 * @apiParam (输入参数：) {string}      teaching_age     教龄 (不再传递，careerYear计算)
	 * @apiParam (输入参数：) {string}      careerYear     教龄
	 * @apiParam (输入参数：) {string}      school         学校
	 * @apiParam (输入参数：) {string}      education         学历 ['本科','研究生','博士','其他']
	 * @apiParam (输入参数：) {string}      specialty         专业 
	 * @apiParam (输入参数：) {string}      teacher_identity    教师身份  大学生教员|1|primary,专职教员|2|success
	 * @apiParam (输入参数：) {string}      introduction    个人介绍
	 * @apiParam (输入参数：) {string}      province     省
	 * @apiParam (输入参数：) {string}      city     市
	 * @apiParam (输入参数：) {string}      area     区  多个用 , 隔开
	 * @apiParam (输入参数：) {string}      schooltime_json 上课时间 [{"week":"周一","start_time":"08:00","end_time":"12:00"}]
	 * @apiParam (输入参数：) {string}      teaching_subject_json 教授课程 [{"category_id":1,"grade_id":1,"subject_id":1,"is_main":1, "price":100}]
	 * @apiParam (输入参数：) {string}      longitude 经度
	 * @apiParam (输入参数：) {string}      latitude 纬度
	 * @apiParam (输入参数：) {string}      chsi_img 学信网截图
	 * @apiParam (输入参数：) {string}      gkScore 高考成绩截图
	 */
	public function autoTeacher() {
		$param = $this->request->param();
		
		$mobile = $param['mobile'];
		if (!$mobile) {
			return json(['status' => 901, 'msg' => "请输入手机号码"]);
		}

		$member_info = db('member')->where('mobile', $mobile)->find();
		//随机1-51的数字
		$pic_num = rand(1, 51);
		$avatar = 'https://www.xxjjwz.com'.'/uploads/avatar/ai_'.$pic_num.'.png';
		if (!$member_info) { //用户不存在,注册
            $default_nickName = substr_replace($mobile, '****', 3, 4);
            $memberInfo['mobile']      = $mobile;
            $memberInfo['nickname']    = $default_nickName;
            $memberInfo['avatar']      = $avatar;
            $memberInfo['create_time'] = time();
            $memberInfo['status']      = 1;
			$mid = db('member')->insertGetId($memberInfo);
		}else{
			$mid = $member_info['mid'];
		}

		// 默认头像
		$param['head_img'] = $avatar;
		$param['education'] = $this->request->param('education', '其他', '');
		$param['teacher_identity'] = $this->request->param('teacher_identity', '1', ''); // 默认大学生教员

		if($param['birthday']){
			$param['birthday'] = str_replace('-', '', $param['birthday']);
		}

		$schooltime_json = $this->request->param('schooltime_json', '', '');
		if (empty($schooltime_json)) {
			$schooltime_list = [
				['week'=>'周一','start_time'=>'09:00','end_time'=>'21:00'],
				['week'=>'周二','start_time'=>'09:00','end_time'=>'21:00'],
				['week'=>'周三','start_time'=>'09:00','end_time'=>'21:00'],
				['week'=>'周四','start_time'=>'09:00','end_time'=>'21:00'],
				['week'=>'周五','start_time'=>'09:00','end_time'=>'21:00'],
				['week'=>'周六','start_time'=>'09:00','end_time'=>'21:00'],
				['week'=>'周日','start_time'=>'09:00','end_time'=>'21:00']
			];
		}else{
			$schooltime_list = json_decode(html_out($schooltime_json), true);
		}
		
		$teaching_subject_json = $this->request->param('teaching_subject_json', '', '');
		
		if (empty($teaching_subject_json)) {
			$teaching_subject_list = [
				['category_id'=>2,'grade_id'=>24,'subject_name'=>'全科','is_main'=>1, 'price'=>60],
				['category_id'=>3,'grade_id'=>25,'subject_name'=>'全科','is_main'=>0, 'price'=>60],
				['category_id'=>4,'grade_id'=>28,'subject_name'=>'全科','is_main'=>0, 'price'=>60]
			];
		}else{
			$teaching_subject_list = json_decode(html_out($teaching_subject_json), true);
		}

		if($param['teaching_age']){
			$param['career_year'] = date('Y') - $param['teaching_age'];
		}

		//查询该账户有没有 教员信息 有则修改没有则更新
		$has_teacher_info = db('teacher')->where('mid', $mid)->find();

		try {
			db()->startTrans();

			if ($has_teacher_info) {
				//去掉老师是否上下线的值
				unset($param['is_on_off']);
				//状态 改为待审核
				$param['status'] = 1;
				db('teacher')->where('mid', $mid)->update($param);
				$teacher_id = $has_teacher_info['teacher_id'];
			} else {
				//刷新时间(创建相当于最新刷新)
				$param['refresh_time'] = time();
				$param['mid'] = $mid;
				$param['status'] = 1;
				$param['label'] = '';
				$teacher_id = db('teacher')->insertGetId($param);

				//生成分享码
				$param1 = "teacher_id=$teacher_id";
				$qrcode = qrcode(doOrderSn(11), $param1);
				db('teacher')->where('teacher_id', $teacher_id)->update(['qrcode' => $qrcode]);

				//修改用户 身份
				db('member')->where('mid', $mid)->update(['groupid' => 2]);
			}

			if ($schooltime_list) {
				//删除 该需求原来的上课 时间
				db('schooltime')->where('teacher_id', $teacher_id)->delete();
				//添加新的上课时间
				foreach ($schooltime_list as $li) {
					$st_ins['week'] = $li['week'];
					$st_ins['start_time'] = $li['start_time'];
					$st_ins['end_time'] = $li['end_time'];
					$st_ins['teacher_id'] = $teacher_id;
					//添加授课时间
					db('schooltime')->insert($st_ins);
				}
			}

			if ($teaching_subject_list) {
				//删除 该需求原来的 授课课程
				db('teaching_subject')->where('teacher_id', $teacher_id)->delete();

				//添加新的 授课课程
				foreach ($teaching_subject_list as $li) {

					$category_info = db('category')->where('category_id', $li['category_id'])->find();
					$grade_info = db('grade')->where('grade_id', $li['grade_id'])->find();

					$subject_name = $li['subject_name'] ?: '全科';
					$subject_info = db('subject')->where('name', $subject_name)->where('grade_id', $li['grade_id'])->find();
        			if(!$subject_info){
						$subject_info = db('subject')->where('grade_id', $li['grade_id'])->find();
					}

					$ts_ins['category_id'] = $li['category_id'];
					$ts_ins['grade_id'] = $li['grade_id'];
					$ts_ins['subject_id'] = $subject_info['subject_id'];
					$ts_ins['category_name'] = $category_info['name'];
					$ts_ins['grade_name'] = $grade_info['name'];
					$ts_ins['subject_name'] = $subject_info['name'];
					$ts_ins['is_main'] = $li['is_main'];
					$ts_ins['teacher_id'] = $teacher_id;
					$ts_ins['price'] = $li['price'];

					//添加授课时间
					db('teaching_subject')->insert($ts_ins);
				}
			}

			db()->commit();
		} catch (\Exception $e) {
			db()->rollback();
			abort(config('my.error_log_code'), $e->getMessage());
		}

		return json(['status' => 200, 'msg' => '注册成功']);
	}
}

