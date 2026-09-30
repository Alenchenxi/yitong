<?php
namespace app\api\controller;

use think\request;
use think\route\Domain;

class User extends Common {
	/**
	 * @api {post} /user/getUserInfo 01、 获取个人资料
	 * @apiGroup 会员
	 * @apiVersion 1.0.0
	 * @apiDescription  获取个人资料
	 * @apiHeader {String} Authorization 用户授权token
	 */
	public function getUserInfo() {
		if (!request()->uid) {
			return json(['status' => 404, 'msg' => "登陆超时"]);
		}
		$info = db("member")->where('mid', request()->uid)->find();

		//更新登录时间
		db("member")->where('mid', request()->uid)->update(['login_time' => time()]);

		//教师信息
		$teacher_info = db('teacher')->where('mid', request()->uid)->find();

		if ($teacher_info) {
			//查询老师是否今日刷新
			$day_ref_info = db('day_refresh')->where('teacher_id', $teacher_info['teacher_id'])->where('date', date('Y-m-d'))->find();
			$is_day_ref = 0;
			if ($day_ref_info) {
				$is_day_ref = 1;
			}
			$teacher_info['is_day_ref'] = $is_day_ref;
		}

		$info['teacher_info'] = $teacher_info;

		return json(['status' => 200, 'data' => $info]);
	}

	/**
	 * @api {post} /user/updateUserInfo 02、 保存个人资料
	 * @apiGroup 会员
	 * @apiVersion 1.0.0
	 * @apiDescription  保存个人资料
	 * @apiHeader {String} Authorization 用户授权token
	 * @apiParam (输入参数：) {string}             mobile 手机号
	 * @apiParam (输入参数：) {number}             gender 性别   男|1|success,女|2|warning
	 * @apiParam (输入参数：) {string}             birthdate 出生日期  时间戳格式
	 */
	public function updateUserInfo() {
		if (!request()->uid) {
			return json(['status' => 404, 'msg' => "登陆超时"]);
		}
		$data = $this->request->param();

		if ($data['mobile']) {
			//如果 存在手机号  查询 手机号有没有被别人占用
			$is_has = db("member")->where('mid', '<>', request()->uid)->where("mobile", $data['mobile'])->find();
			if ($is_has) {
				return json(['status' => 404, 'msg' => "该手机号已被占用"]);
			}
		}

		$update['gender'] = $data['gender'];
		$update['gender'] = $data['gender'];
		$update['birthdate'] = $data['birthdate'];

		//过滤数组中空元素
		$update = array_filter($update);

		db("member")->where('mid', request()->uid)->update($update);

		return json(['status' => 200, 'msg' => '更新成功']);
	}

	/**
	 * @api {post} /user/studentsRelease 03、 学员发布
	 * @apiGroup 会员
	 * @apiVersion 1.0.0
	 * @apiDescription  学员发布
	 * @apiHeader {String} Authorization 用户授权token
	 * @apiParam (输入参数：) {string}      demand_id  需求id  传为修改  不传为添加
	 * @apiParam (输入参数：) {string}      name 姓名
	 * @apiParam (输入参数：) {number}      mobile 联系方式
	 * @apiParam (输入参数：) {number}      teaching_way 授课方式  上门授课|1|primary,在线授课|2|success,均可|3|info
	 * @apiParam (输入参数：) {number}      age 年龄
	 * @apiParam (输入参数：) {number}      gender 性别  男|1|success,女|2|warning
	 * @apiParam (输入参数：) {number}      category_id     分类id
	 * @apiParam (输入参数：) {number}      grade_id     年级id
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
	 * @apiParam (输入参数：) {string}      wx_id 微信联系方式
	 * @apiParam (输入参数：) {string}      hide_mobile 是否隐藏手机号 0|false,1|true
	 */
	public function studentsRelease() {
		if (!request()->uid) {
			return json(['status' => 404, 'msg' => "登陆超时"]);
		}

		$demand_id = $this->request->param('demand_id', '', '');
		$name = $this->request->param('name', '', '');
		$mobile = $this->request->param('mobile', '', '');
		$teaching_way = $this->request->param('teaching_way', '', '');
		$age = $this->request->param('age', '', '');
		$gender = $this->request->param('gender', '', '');
		$category_id = $this->request->param('category_id', '', '');
		$grade_id = $this->request->param('grade_id', '', '');
		$subject_id = $this->request->param('subject_id', '', '');
		$price = $this->request->param('price', '', '');
		$school = $this->request->param('school', '', '');
		$province = $this->request->param('province', '', '');
		$city = $this->request->param('city', '', '');
		$area = $this->request->param('area', '', '');
		$address = $this->request->param('address', '', '');
		$gai_kuang = $this->request->param('gai_kuang', '', '');
		$trial_time = $this->request->param('trial_time', '', '');
		$teacher_gender = $this->request->param('teacher_gender', '', '');
		$teacher_identity = $this->request->param('teacher_identity', '', '');
		$teacher_require = $this->request->param('teacher_require', '', '');
		$schooltime_json = $this->request->param('schooltime_json', '', '');
		$longitude = $this->request->param('longitude', '', '');
		$latitude = $this->request->param('latitude', '', '');
		$mail = $this->request->param('mail', '', '');
		$course_list_json = $this->request->param('course_list_json', '', '');
		$course_list = json_decode(html_out($course_list_json), true);

		$wx_id = $this->request->param('wx_id', '', '');
		$hide_mobile = $this->request->param('hide_mobile', '0', '');

		if ((!$subject_id && !$course_list) || !$area || !$address || !$mobile || !$longitude || !$latitude) {
			return json(['status' => 404, 'msg' => "参数不完整"]);
		}
		$member_info = db('member')->where('mid', request()->uid)->find();

		$schooltime_list = json_decode(html_out($schooltime_json), true);
		if (!$schooltime_list) {
			return json(['status' => 404, 'msg' => "请选择授课时间"]);
		}

// 定义手机号正则表达式
		$pattern = '/1[3-9]\d{9}/';
// 使用preg_match函数进行匹配
		if (preg_match($pattern, $address)) {
			return json(['status' => 404, 'msg' => "地址不正确"]);
		}
		if (preg_match($pattern, $gai_kuang)) {
			return json(['status' => 404, 'msg' => "学生概况不正确"]);
		}
		if (preg_match($pattern, $teacher_require)) {
			return json(['status' => 404, 'msg' => "老师要求不正确"]);
		}

		$ins['mid'] = request()->uid;
		$ins['name'] = $name;
		$ins['mail'] = $mail;
		$ins['mobile'] = $mobile;
		$ins['teaching_way'] = $teaching_way;
		$ins['age'] = $age;
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
		$ins['trial_time'] = $trial_time;
		$ins['teacher_gender'] = $teacher_gender;
		$ins['teacher_identity'] = $teacher_identity;
		$ins['teacher_require'] = $teacher_require;
		$ins['longitude'] = $longitude;
		$ins['latitude'] = $latitude;
		$ins['create_time'] = time();
		$ins['status'] = 1;
		$ins['wx_id'] = $wx_id;
		$ins['hide_mobile'] = $hide_mobile;

		if ($demand_id) {
			//查询该科目 信息
			$demand_info = db('demand')->where('demand_id', $demand_id)->find();
			if ($demand_info['subject_id'] != $subject_id) {
				return json(['status' => 404, 'msg' => "不能修改科目"]);
			}

			try {
				db()->startTrans();

				//修改需求参数
				db('demand')->where('demand_id', $demand_id)->update($ins);

				if ($schooltime_list) {
					//删除 该需求原来的上课 时间
					db('schooltime')->where('demand_id', $demand_id)->delete();

					//添加新的上课时间
					foreach ($schooltime_list as $li) {
						$st_ins['week'] = $li['week'];
						$st_ins['start_time'] = $li['start_time'];
						$st_ins['end_time'] = $li['end_time'];
						$st_ins['demand_id'] = $demand_id;

						//添加授课时间
						db('schooltime')->insert($st_ins);
					}
				}

				db()->commit();
			} catch (\Exception $e) {
				db()->rollback();
				abort(config('my.error_log_code'), $e->getMessage());
			}

			return json(['status' => 200, 'msg' => '修改成功']);

		}

		$demand_id_list = [];
		$qrcode_list = [];
		try {
			db()->startTrans();

			//TODO 如果没有$course_list，$course_list = [[category_id:$category_id,subject_id:$subject_id,grade_id:$grade_id, price: $price]]
			if (!$course_list) {
				$course_list = [[
					'category_id' => $category_id,
					'subject_id' => $subject_id,
					'grade_id' => $grade_id,
					'price' => $price
				]];
			}
			foreach ($course_list as $course) {
				$ins['sn'] = doOrderSn(00);
				$ins['category_id'] = $course['category_id'];
				$ins['subject_id'] = $course['subject_id'];
				$ins['grade_id'] = $course['grade_id'];
				$ins['price'] = $course['price'];

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

				//$demand_id_list增加$demand_id
				$demand_id_list[] = $demand_id;
				$qrcode_list[] = $qrcode;
			}

			db()->commit();
		} catch (\Exception $e) {
			db()->rollback();
			abort(config('my.error_log_code'), $e->getMessage());
		}

		//遍历demand_id_list index
		for ($i = 0; $i < count($demand_id_list); $i++) {
			$demand_id = $demand_id_list[$i];
			$qrcode = $qrcode_list[$i];
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
		}

		return json(['status' => 200, 'msg' => '发布成功']);
	}

	/**
	 * @api {post} /user/getMyCommentList 04、 获取我的评论列表
	 * @apiGroup 会员
	 * @apiVersion 1.0.0
	 * @apiDescription  获取我的评论列表
	 * @apiHeader {String} Authorization 用户授权token
	 * @apiParam (输入参数：) {number}      limit 数量
	 * @apiParam (输入参数：) {number}      page 页数
	 * @apiParam (输入参数：) {number}      teacher_id     老师id
	 */
	public function getMyCommentList() {
		if (!request()->uid) {
			return json(['status' => 404, 'msg' => "登陆超时"]);
		}

		$limit = $this->request->param('limit', '10', 'intval');
		$page = $this->request->param('page', 1, 'intval');
		$teacher_id = $this->request->param('teacher_id', '', 'intval');

		if ($teacher_id) {
			$where[] = ['a.teacher_id', '=', $teacher_id];
		} else {
			$where[] = ['a.mid', '=', request()->uid];
		}

		$list = db('comment')->alias('a')
			->field('a.*,b.nickname,b.avatar,d.name as subject_name')
			->join('member b', 'a.mid=b.mid', 'left')
			->join('demand c', 'a.demand_id=c.demand_id', 'left')
			->join('subject d', 'c.subject_id=d.subject_id', 'left')
			->where($where)
			->where('a.sup_comment_id', 0)
			->order('a.create_time desc')
			->limit(($page - 1) * $limit, $limit)
			->select()->toArray();

		foreach ($list as $k => $v) {
			$list[$k]['create_time'] = date('Y-m-d', $list[$k]['create_time']);

			$pics = json_decode(html_out($v['pics']), true);
			$pics_list = [];
			foreach ($pics as $key => $value) {
				$pics_list[] = $value['url'];
			}
			$list[$k]['pics'] = $pics_list;

			$comment_lists = db('comment')->alias('a')
				->field('a.*,b.nickname,b.avatar')
				->join('member b', 'a.mid=b.mid', 'left')
				->where('a.sup_comment_id', $v['comment_id'])
				->select()->toArray();

			foreach ($comment_lists as $ck => $cv) {
				$cpics = json_decode(html_out($cv['pics']), true);
				$cpics_list = [];
				foreach ($cpics as $ckey => $cvalue) {
					$cpics_list[] = $cvalue['url'];
				}
				$comment_lists[$ck]['create_time'] = date('Y-m-d', $comment_lists[$ck]['create_time']);
				$comment_lists[$ck]['pics'] = $cpics_list;
			}

			$list[$k]['list'] = $comment_lists;
		}

		return json(['status' => 200, 'data' => $list]);
	}

	/**
	 * @api {post} /user/feedback 05、 意见反馈
	 * @apiGroup 会员
	 * @apiVersion 1.0.0
	 * @apiDescription  意见反馈
	 * @apiHeader {String} Authorization 用户授权token
	 * @apiParam (输入参数：) {string}      content 反馈内容
	 * @apiParam (输入参数：) {string}      img  图片
	 */
	public function feedback() {
		if (!request()->uid) {
			return json(['status' => 404, 'msg' => "登陆超时"]);
		}

		$content = $this->request->param('content', '', '');
		/*$linkman = $this->request->param('linkman', '', '');
        $mobile = $this->request->param('mobile', '', '');*/
		$img = $this->request->param('img', '', '');

		if (!$content) {
			return json(['status' => 404, 'msg' => "请填写反馈内容"]);
		}

		$ins['mid'] = request()->uid;
		$ins['content'] = $content;
		$ins['img'] = $img;
		$ins['create_time'] = time();

		db('feedback')->insert($ins);

		return json(['status' => 200, 'msg' => '反馈成功']);
	}

	/**
	 * @api {post} /user/logout 06、 注销
	 * @apiGroup 会员
	 * @apiVersion 1.0.0
	 * @apiDescription  注销
	 * @apiHeader {String} Authorization 用户授权token
	 * @apiParam (输入参数：) {string}      content 注销原因
	 */
	public function logout() {
		if (!request()->uid) {
			return json(['status' => 200, 'msg' => '退出成功']);
		}

		$this->clearToken(request()->uid); // 调用父类方法清除token

		return json(['status' => 200, 'msg' => '退出成功']);
	}

	/**
	 * @api {post} /user/addComment 07、 发表评论
	 * @apiGroup 会员
	 * @apiVersion 1.0.0
	 * @apiDescription  发表评论
	 * @apiHeader {String} Authorization 用户授权token
	 * @apiParam (输入参数：) {number}      order_id 订单id
	 * @apiParam (输入参数：) {number}      teacher_id 老师id
	 * @apiParam (输入参数：) {number}      attitude 教学态度   1星|1|primary,2星|2|success,3星|3|info,4星|4|warning,5星|5|danger
	 * @apiParam (输入参数：) {number}      level 专业等级  1星|1|primary,2星|2|success,3星|3|info,4星|4|warning,5星|5|danger
	 * @apiParam (输入参数：) {string}      content 评价内容
	 * @apiParam (输入参数：) {string}      pics  图片  多个用 , 隔开
	 * @apiParam (输入参数：) {string}      sup_comment_id  上级评论id  不传为0
	 */
	public function addComment() {
		if (!request()->uid) {
			return json(['status' => 404, 'msg' => "登陆超时"]);
		}

		$order_id = $this->request->param('order_id', '', '');
		$teacher_id = $this->request->param('teacher_id', '', '');
		$attitude = $this->request->param('attitude', '', '');
		$level = $this->request->param('level', '', '');
		$content = $this->request->param('content', '', '');
		$pics = $this->request->param('pics', '', '');
		$sup_comment_id = $this->request->param('sup_comment_id', '', '') ? $this->request->param('sup_comment_id', '', '') : 0;

		if (!$teacher_id || !$content) {
			return json(['status' => 404, 'msg' => "参数不完整"]);
		}

		/*$order_info = db('order')->where('order_id', $order_id)->find();
			        if(!$order_info){
			        return json(['status' => 404, 'msg' => "没有找到您的该订单信息"]);
		*/

		if (!$sup_comment_id) {
			//没有上级 说明是 发表评论 查看是否评论
			$has_comment = db('comment')->where('teacher_id', $teacher_id)->where('order_id', $order_id)->find();
			if ($has_comment) {
				return json(['status' => 404, 'msg' => "您已发表过评论"]);
			}

		} else {
			//有上级 说明是 追加评论 查看是否追加
			$has_sup_comment = db('comment')->where('sup_comment_id', $sup_comment_id)->find();
			if ($has_sup_comment) {
				return json(['status' => 404, 'msg' => "您已追加过该评论"]);
			}

		}

		$ins['mid'] = request()->uid;
		$ins['order_id'] = $order_id;
		$ins['teacher_id'] = $teacher_id;
		$ins['subject_id'] = $order_info['subject_id'];
		$ins['attitude'] = $attitude;
		$ins['level'] = $level;
		$ins['content'] = $content;
		$ins['sup_comment_id'] = $sup_comment_id;
		$ins['create_time'] = time();

		if ($pics) {
			$pics = explode(',', $pics);

			foreach ($pics as $key => $value) {
				$arr[$key]['url'] = $value;
			}
			$pics = json_encode($arr, JSON_UNESCAPED_UNICODE);

			$ins['pics'] = $pics;
		}

		db('comment')->insert($ins);

		//计算平均分
		//教学态度
		$total_attitude = db('comment')->where('teacher_id', $teacher_id)->sum('attitude');
		//专业度
		$total_level = db('comment')->where('teacher_id', $teacher_id)->sum('level');
		$total_comment_num = db('comment')->where('teacher_id', $teacher_id)->count();

		$avg_score = cusDecimal(($total_attitude + $total_level) / 2 / $total_comment_num);
		//修改 老师平均分支
		db('teacher')->where('teacher_id', $teacher_id)->update(['avg_score' => $avg_score]);

		return json(['status' => 200, 'msg' => '发布成功']);
	}

	/**
	 * @api {post} /user/getMyCollectList 08、 获取我的收藏列表
	 * @apiGroup 会员
	 * @apiVersion 1.0.0
	 * @apiDescription  获取我的收藏列表
	 * @apiHeader {String} Authorization 用户授权token
	 * @apiParam (输入参数：) {number}      limit 数量
	 * @apiParam (输入参数：) {number}      page 页数
	 */
	public function getMyCollectList() {
		if (!request()->uid) {
			return json(['status' => 404, 'msg' => "登陆超时"]);
		}

		$limit = $this->request->param('limit', '10', 'intval');
		$page = $this->request->param('page', 1, 'intval');

		$where[] = ['a.mid', '=', request()->uid];

		$list = db("collect")->alias('a')
			->field('b.*')
			->join('teacher b', 'a.teacher_id=b.teacher_id', 'left')
			->where($where)
			->order('a.create_time desc')
			->limit(($page - 1) * $limit, $limit)
			->select()->toArray();

		foreach ($list as $k => $v) {
			//老师教授科目
			$list[$k]['teaching_subject'] = db('teaching_subject')->where('teacher_id', $v['teacher_id'])->select()->toArray();
			//教授主课
			$list[$k]['teaching_main_subject'] = db('teaching_subject')->where('teacher_id', $v['teacher_id'])->where('is_main', 1)->find();

			//老师教授科目
			$list[$k]['schooltime'] = db('schooltime')->where('teacher_id', $v['teacher_id'])->select()->toArray();
			//老师教学经历
			$list[$k]['experience'] = db('experience')->where('teacher_id', $v['teacher_id'])->select()->toArray();
		}

		return json(['status' => 200, 'data' => $list]);
	}
//我的联系

	public function getMyLianxiList() {
		if (!request()->uid) {
			return json(['status' => 404, 'msg' => "登陆超时"]);
		}

		$limit = $this->request->param('limit', '10', 'intval');
		$page = $this->request->param('page', 1, 'intval');

		$where[] = ['a.mid', '=', request()->uid];

		$list = db("contact_history")->alias('a')
			->field('b.*')
			->join('teacher b', 'a.teacher_id=b.teacher_id', 'left')
			->where($where)
			->order('a.create_time desc')
			->limit(($page - 1) * $limit, $limit)
			->select()->toArray();

		foreach ($list as $k => $v) {
			//老师教授科目
			$list[$k]['teaching_subject'] = db('teaching_subject')->where('teacher_id', $v['teacher_id'])->select()->toArray();
			//教授主课
			$list[$k]['teaching_main_subject'] = db('teaching_subject')->where('teacher_id', $v['teacher_id'])->where('is_main', 1)->find();

			//老师教授科目
			$list[$k]['schooltime'] = db('schooltime')->where('teacher_id', $v['teacher_id'])->select()->toArray();
			//老师教学经历
			$list[$k]['experience'] = db('experience')->where('teacher_id', $v['teacher_id'])->select()->toArray();
		}

		return json(['status' => 200, 'data' => $list]);
	}

	/**
	 * @api {post} /user/teacherReg 09、 教师注册
	 * @apiGroup 会员
	 * @apiVersion 1.0.0
	 * @apiDescription  教师注册
	 * @apiHeader {String} Authorization 用户授权token
	 * @apiParam (输入参数：) {string}      mobile 联系方式
	 * @apiParam (输入参数：) {string}      wechat 微信号
	 * @apiParam (输入参数：) {string}      nickname 微信昵称
	 * @apiParam (输入参数：) {string}      name 姓名
	 * @apiParam (输入参数：) {string}      id_number     身份证号码
	 * @apiParam (输入参数：) {number}      age 年龄 (不再传递，身份证计算)
	 * @apiParam (输入参数：) {string}      gender 性别  男|1|success,女|2|warning
	 * @apiParam (输入参数：) {string}      id_card_zheng 身份证正面
	 * @apiParam (输入参数：) {string}      id_card_fan 身份证反面
	 * @apiParam (输入参数：) {string}      student_card_img 学生证
	 * @apiParam (输入参数：) {string}      diploma_img 学历证
	 * @apiParam (输入参数：) {string}      itic_img 教师证
	 * @apiParam (输入参数：) {string}      head_img 头像
	 * @apiParam (输入参数：) {string}      teaching_age     教龄 (不再传递，careerYear计算)
	 * @apiParam (输入参数：) {string}      careerYear     教龄
	 * @apiParam (输入参数：) {string}      school         学校
	 * @apiParam (输入参数：) {string}      school_start_time         学校就读开始时间
	 * @apiParam (输入参数：) {string}      school_end_time         学校就读结束时间
	 * @apiParam (输入参数：) {string}      education         学历
	 * @apiParam (输入参数：) {string}      specialty         专业
	 * @apiParam (输入参数：) {string}      teacher_identity    教师身份  大学生教员|1|primary,专职教员|2|success
	 * @apiParam (输入参数：) {string}      experience_json 任教经历 [{"title":"标题","experience":"任教经理","start_time":"","end_time":""}]
	 * @apiParam (输入参数：) {string}      successful_case_title 成功案例标题
	 * @apiParam (输入参数：) {string}      successful_case 成功案例
	 * @apiParam (输入参数：) {string}      honor 奖励荣誉
	 * @apiParam (输入参数：) {string}      honor_img     奖励荣誉图片
	 * @apiParam (输入参数：) {string}      teacher_title     教师职称
	 * @apiParam (输入参数：) {string}      teacher_title_img     教师职称证书
	 * @apiParam (输入参数：) {string}      label     个人标签  多个用 , 隔开
	 * @apiParam (输入参数：) {string}      province     省
	 * @apiParam (输入参数：) {string}      city     市
	 * @apiParam (输入参数：) {string}      area     区  多个用 , 隔开
	 * @apiParam (输入参数：) {string}      photos     个人照片   多个用 , 隔开
	 * @apiParam (输入参数：) {string}      works     个人作品
	 * @apiParam (输入参数：) {string}      schooltime_json 上课时间 [{"week":"周一","start_time":"08:00","end_time":"12:00"}]
	 * @apiParam (输入参数：) {string}      teaching_subject_json 教授课程 [{"category_id":1,"grade_id":1,"subject_id":1,"is_main":1}]
	 * @apiParam (输入参数：) {string}      longitude 经度
	 * @apiParam (输入参数：) {string}      latitude 纬度
	 * @apiParam (输入参数：) {string}      chsi_img 学信网截图
	 * @apiParam (输入参数：) {string}      mail 邮箱
	 * @apiParam (输入参数：) {string}      gkScore 高考成绩截图

	 */
	public function teacherReg() {
		if (!request()->uid) {
			return json(['status' => 404, 'msg' => "登陆超时"]);
		}

		//获取所有参数
		$param = $this->request->param();

		$id_card_required = config("config.id_card_required");
		$student_card_required = config("config.student_card_required");
		$itic_required = config("config.itic_required");

		if ($id_card_required == 1 && (!$param['id_card_zheng'] || !$param['id_card_fan'])) {
			return json(['status' => 404, 'msg' => "请上传身份证照片"]);
		}

		if ($student_card_required == 1 && !$param['student_card_img']) {
			return json(['status' => 404, 'msg' => "请上传学生证/毕业证"]);
		}

		if ($itic_required == 1 && !$param['itic_img']) {
			return json(['status' => 404, 'msg' => "请上传教师资格证"]);
		}

		$schooltime_list = json_decode(html_out($param['schooltime_json']), true);
		if (!$schooltime_list) {
			return json(['status' => 404, 'msg' => "请选择授课时间"]);
		}

		$teaching_subject_list = json_decode(html_out($param['teaching_subject_json']), true);
		if (!$teaching_subject_list) {
			return json(['status' => 404, 'msg' => "请选择授课时间"]);
		}

		// 定义手机号正则表达式
		$pattern = '/1[3-9]\d{9}/';
// 使用preg_match函数进行匹配
		if (preg_match($pattern, $param['name'])) {
			return json(['status' => 404, 'msg' => "姓名不正确"]);
		}
		if (preg_match($pattern, $param['successful_case'])) {
			return json(['status' => 404, 'msg' => "任教经验不正确"]);
		}

		$experience_list = json_decode(html_out($param['experience_json']), true);
		if ($experience_list) {
			$param['introduction'] = $experience_list[0]['experience'];

			if (preg_match($pattern, $param['introduction'])) {
				return json(['status' => 404, 'msg' => "自我介绍不正确"]);
			}

		}

		if ($photos_pics = $param['photos']) {
			$photos_pics = explode(',', $photos_pics);

			foreach ($photos_pics as $key => $value) {
				$arr[$key]['url'] = $value;
			}
			$param['photos'] = json_encode($arr, JSON_UNESCAPED_UNICODE);
		}

		if ($honor_img_pics = $param['honor_img']) {
			$honor_img_pics = explode(',', $honor_img_pics);

			foreach ($honor_img_pics as $key => $value) {
				$arr[$key]['url'] = $value;
			}
			$param['honor_img'] = json_encode($arr, JSON_UNESCAPED_UNICODE);
		}

		//查询该账户有没有 教员信息 有则修改没有则更新
		$has_teacher_info = db('teacher')->where('mid', request()->uid)->find();

		try {
			db()->startTrans();

			if ($has_teacher_info) {

				//去掉老师是否上下线的值
				unset($param['is_on_off']);

				//状态 改为待审核
				$param['status'] = 1;
				db('teacher')->where('mid', request()->uid)->update($param);

				$teacher_id = $has_teacher_info['teacher_id'];
			} else {

				if (!$param['longitude'] || !$param['latitude']) {
					return json(['status' => 404, 'msg' => "请获取当前位置"]);
				}

				//刷新时间(创建相当于最新刷新)
				$param['refresh_time'] = time();
				$param['mid'] = request()->uid;
				$param['status'] = 1;
				$teacher_id = db('teacher')->insertGetId($param);

				//生成分享码
				$param1 = "teacher_id=$teacher_id";
				$qrcode = qrcode(doOrderSn(11), $param1);
				db('teacher')->where('teacher_id', $teacher_id)->update(['qrcode' => $qrcode]);

				//修改用户 身份
				db('member')->where('mid', request()->uid)->update(['groupid' => 2]);

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

					if ($li['subject_id']) {
						$category_info = db('category')->where('category_id', $li['category_id'])->find();
						$grade_info = db('grade')->where('grade_id', $li['grade_id'])->find();
						$subject_info = db('subject')->where('subject_id', $li['subject_id'])->find();

						$ts_ins['category_id'] = $li['category_id'];
						$ts_ins['grade_id'] = $li['grade_id'];
						$ts_ins['subject_id'] = $li['subject_id'];
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
			}

			db()->commit();
		} catch (\Exception $e) {
			db()->rollback();
			abort(config('my.error_log_code'), $e->getMessage());
		}

		return json(['status' => 200, 'msg' => '注册成功']);
	}

	/**
	 * @api {post} /user/addOrCancelCollect 10、 添加或取消收藏
	 * @apiGroup 会员
	 * @apiVersion 1.0.0
	 * @apiDescription  添加或取消收藏
	 * @apiHeader {String} Authorization 用户授权token
	 * @apiParam (输入参数：) {number}      teacher_id 教师id
	 */
	public function addOrCancelCollect() {
		if (!request()->uid) {
			return json(['status' => 404, 'msg' => "登陆超时"]);
		}

		$teacher_id = $this->request->param('teacher_id', '', 'intval');

		$has = db("collect")->where('mid', request()->uid)->where('teacher_id', $teacher_id)->find();

		if (!$has) {
			$ins['mid'] = request()->uid;
			$ins['teacher_id'] = $teacher_id;
			$ins['create_time'] = time();

			//添加收藏
			db("collect")->insert($ins);
			//添加老师收藏次数
			db('teacher')->where('teacher_id', $teacher_id)->inc('collect_num')->update();
			$msg = '添加';
		} else {

			//取消收藏
			db("collect")->where('collect_id', $has['collect_id'])->delete();
			//减少老师收藏次数
			db('teacher')->where('teacher_id', $teacher_id)->dec('collect_num')->update();
			$msg = '取消';
		}

		return json(['status' => 200, 'msg' => $msg . '收藏成功']);
	}

	/**
	 * @api {post} /user/addAppointment 11、 添加预约
	 * @apiGroup 会员
	 * @apiVersion 1.0.0
	 * @apiDescription  添加预约
	 * @apiHeader {String} Authorization 用户授权token
	 * @apiParam (输入参数：) {number}      teacher_id 教师id
	 * @apiParam (输入参数：) {number}      demand_id  需求id
	 */
	public function addAppointment() {
		if (!request()->uid) {
			return json(['status' => 404, 'msg' => "登陆超时"]);
		}

		$teacher_id = $this->request->param('teacher_id', '', 'intval');
		$demand_id = $this->request->param('demand_id', '', 'intval');

		if (!$teacher_id || !$demand_id) {
			return json(['status' => 404, 'msg' => "参数不完整"]);
		}

		$member_info = db('member')->where('mid', request()->uid)->find();

		$teacher_info = db('teacher')->where('teacher_id', $teacher_id)->find();
		if (!$teacher_info) {
			return json(['status' => 404, 'msg' => "对不起没有找到该老师信息"]);
		}

		$demand_info = db('demand')->alias('a')
			->field('a.*,b.name as grade_name,c.name as subject_name')
			->join('grade b', 'a.grade_id=b.grade_id', 'left')
			->join('subject c', 'a.subject_id=c.subject_id', 'left')
			->where('a.demand_id', $demand_id)
			->find();
		if (!$demand_info) {
			return json(['status' => 404, 'msg' => "对不起没有找到该学生信息"]);
		}

		$has = db("appointment")->where('teacher_id', $teacher_id)->where('demand_id', $demand_id)->find();

		if ($has) {
			return json(['status' => 404, 'msg' => '您已预约该学生,请勿重复预约']);
		}

		try {
			db()->startTrans();

			$ins['sn'] = doOrderSn(00);
			$ins['mid'] = request()->uid;
			$ins['teacher_id'] = $teacher_id;
			$ins['demand_id'] = $demand_id;
			$ins['teacher_name'] = $teacher_info['name'];
			$ins['teacher_mobile'] = $teacher_info['mobile'];
			$ins['teacher_wechat'] = $teacher_info['wechat'];
			$ins['stu_name'] = $demand_info['name'];
			$ins['stu_mobile'] = $demand_info['mobile'];
			$ins['grade_id'] = $demand_info['grade_id'];
			$ins['grade_name'] = $demand_info['grade_name'];
			$ins['subject_id'] = $demand_info['subject_id'];
			$ins['subject_name'] = $demand_info['subject_name'];
			$ins['create_time'] = time();

			//添加预约
			db("appointment")->insert($ins);

			db()->commit();
		} catch (\Exception $e) {
			db()->rollback();
			abort(config('my.error_log_code'), $e->getMessage());
		}

		//老师预约通知 给家长发送消息
		$ins['title'] = '老师预约通知';
		$ins['content'] = "        编号为 " . $teacher_info['teacher_id'] . " 的教员,预约了您的家教,请及时联系";
		$ins['mid'] = $demand_info['mid'];
		$ins['create_time'] = time();
		$ins['type'] = 3;
		db('msg')->insertGetId($ins);

		if ($demand_info['mail']) {
			$title = '老师预约家长';
			$address = [$demand_info['mail']];
			$qrcode = request()->domain() . '/' . $teacher_info['qrcode'];
			$content = "        编号为 " . $teacher_info['teacher_id'] . " 的教员,预约了您的家教,请及时联系,点击前往小程序查看教师详情</br> <img height='200px' src='$qrcode'/>";
			sendMail($title, $address, $content);
		}

		return json(['status' => 200, 'msg' => '预约成功']);
	}

	/**
	 * @api {post} /user/cancelAppointment 11、 取消预约
	 * @apiGroup 会员
	 * @apiVersion 1.0.0
	 * @apiDescription  取消预约
	 * @apiParam (输入参数：) {number}      appointment_id 预约id
	 */
	public function cancelAppointment() {
		$appointment_id = $this->request->param('appointment_id', '', 'intval');

		if (!$appointment_id) {
			return json(['status' => 404, 'msg' => "参数不完整"]);
		}

		$appointment_info = db("appointment")->where('appointment_id', $appointment_id)->find();

		if (!$appointment_info) {
			return json(['status' => 404, 'msg' => "对不起没有找到该预约信息"]);
		}

		db("appointment")->where('appointment_id', $appointment_id)->delete();

		return json(['status' => 200, 'msg' => '取消预约成功']);
	}

	/**
	 * @api {post} /user/getTeacherAppointmentList 12、 获取老师预约订单
	 * @apiGroup 会员
	 * @apiVersion 1.0.0
	 * @apiDescription  获取老师预约订单
	 * @apiHeader {String} Authorization 用户授权token
	 * @apiParam (输入参数：) {number}      limit 数量
	 * @apiParam (输入参数：) {number}      page 页数
	 */
	public function getTeacherAppointmentList() {
		if (!request()->uid) {
			return json(['status' => 404, 'msg' => "登陆超时"]);
		}

		$limit = $this->request->param('limit', '10', 'intval');
		$page = $this->request->param('page', 1, 'intval');

		//教师信息
		$teacher_info = db('teacher')->where('mid', request()->uid)->find();

		$list = db("appointment")->alias('a')
			->field('a.*,b.province,b.city,b.area,b.address')
			->join('demand b', 'a.demand_id=b.demand_id', 'left')
			->where('a.teacher_id', $teacher_info['teacher_id'])
			->order('a.create_time desc')
			->limit(($page - 1) * $limit, $limit)
			->select()->toArray();

		foreach ($list as $k => $v) {
			$list[$k]['create_time'] = date('Y-m-d H:i:s', $list[$k]['login_time']);
		}

		return json(['status' => 200, 'data' => $list]);
	}

// 老师联系列表
	public function getTeacheOrder() {
		if (!request()->uid) {
			return json(['status' => 404, 'msg' => "登陆超时"]);
		}

		$limit = $this->request->param('limit', '10', 'intval');
		$page = $this->request->param('page', 1, 'intval');

		$list = db("teacher_order")->alias('a')
			->field('a.*,b.province,b.city,b.area,b.address,b.grade_id,b.subject_id')
			->join('demand b', 'a.demand_id=b.demand_id', 'left')
			->where('a.mid', request()->uid)
			->where('a.status', 1)
			->order('a.create_time desc')
			->limit(($page - 1) * $limit, $limit)
			->select()->toArray();

		foreach ($list as $k => $v) {
			$list[$k]['grade_name'] = db('grade')->where('grade_id', $v['grade_id'])->value('name');
			$list[$k]['subject_name'] = db('subject')->where('subject_id', $v['subject_id'])->value('name');
			$list[$k]['create_time'] = date('Y-m-d H:i:s', $list[$k]['login_time']);
		}

		return json(['status' => 200, 'data' => $list]);
	}

	/**
	 * @api {post} /user/getStuAppointmentList 13、 获取学生预约订单
	 * @apiGroup 会员
	 * @apiVersion 1.0.0
	 * @apiDescription  获取学生预约订单
	 * @apiParam (输入参数：) {number}      limit 数量
	 * @apiParam (输入参数：) {number}      page 页数
	 * @apiParam (输入参数：) {number}      demand_id 需求id
	 */
	public function getStuAppointmentList() {
		$limit = $this->request->param('limit', '10', 'intval');
		$page = $this->request->param('page', 1, 'intval');
		$demand_id = $this->request->param('demand_id', '', 'intval');
		$longitude = $this->request->param('longitude', '', '');
		$latitude = $this->request->param('latitude', '', '');

		if (!$longitude || !$latitude) {
			return json(['status' => 404, 'msg' => '请获取当前位置']);
		}

		$where[] = ['a.demand_id', '=', $demand_id];

		$list = db("appointment")->alias('a')
			->field("a.*,b.province,b.city,b.area,b.address,c.name,c.head_img,c.label,c.teaching_age,c.teacher_identity,
            (
		6371 * acos(
			cos( radians( $latitude ) ) * cos( radians( c.latitude ) ) * cos(
				radians( c.longitude ) - radians( $longitude )
			) + sin( radians( $latitude ) ) * sin( radians( c.latitude ) )
		)
	) AS distance")
			->join('demand b', 'a.demand_id=b.demand_id', 'left')
			->join('teacher c', 'a.teacher_id=c.teacher_id', 'left')
			->where($where)
			->order('a.create_time desc')
			->limit(($page - 1) * $limit, $limit)
			->select()->toArray();

		foreach ($list as $k => $v) {

			$main_subject = db('teaching_subject')->where('teacher_id', $v['teacher_id'])->where('is_main', 1)->find();

			$min_subject = db('teaching_subject')->where('teacher_id', $v['teacher_id'])->order('price asc')->find();

			$list[$k]['category_name'] = $main_subject['category_name'];
			$list[$k]['grade_name'] = $main_subject['grade_name'];
			$list[$k]['subject_name'] = $main_subject['subject_name'];
			$list[$k]['min_price'] = $min_subject['price'];

			$list[$k]['create_time'] = date('Y-m-d H:i:s', $list[$k]['login_time']);
		}

		return json(['status' => 200, 'data' => $list]);
	}

	/**
	 * @api {post} /user/refreshCv 14、 刷新简历
	 * @apiGroup 会员
	 * @apiVersion 1.0.0
	 * @apiDescription  刷新简历
	 * @apiHeader {String} Authorization 用户授权token
	 */
	public function refreshCv() {
		if (!request()->uid) {
			return json(['status' => 404, 'msg' => "登陆超时"]);
		}

		$teacher_info = db("teacher")->where('mid', request()->uid)->find();

		if (!$teacher_info) {
			return json(['status' => 404, 'msg' => '没有找到您的老师信息']);
		}

		$day_ref_info = db('day_refresh')->where('teacher_id', $teacher_info['teacher_id'])->where('date', date('Y-m-d'))->find();
		if ($day_ref_info) {
			return json(['status' => 404, 'msg' => '您今日已刷新,不能再次刷新']);
		}

		db("teacher")->where('teacher_id', $teacher_info['teacher_id'])->update(['refresh_time' => time()]);

		$ins['date'] = date('Y-m-d');
		$ins['mid'] = request()->uid;
		$ins['teacher_id'] = $teacher_info['teacher_id'];
		//添加 今日刷新记录
		db('day_refresh')->insert($ins);

		return json(['status' => 200, 'msg' => '刷新成功']);
	}

	/**
	 * @api {post} /user/getStuDemandList 15、 获取学生订单
	 * @apiGroup 会员
	 * @apiVersion 1.0.0
	 * @apiDescription  获取学生订单
	 * @apiHeader {String} Authorization 用户授权token
	 * @apiParam (输入参数：) {number}      limit 数量
	 * @apiParam (输入参数：) {number}      page 页数
	 */
	public function getStuDemandList() {
		if (!request()->uid) {
			return json(['status' => 404, 'msg' => "登陆超时"]);
		}

		$limit = $this->request->param('limit', '10', 'intval');
		$page = $this->request->param('page', 1, 'intval');
		// file_put_contents("payback.txt", print_r($page, true), FILE_APPEND);
		$page = 1;
		//$status = $this->request->param('status', '', 'intval');

		$where[] = ['a.mid', '=', request()->uid];

		/*if($status==1){
			        $where[] = ['a.status','=',2];
			        }else{
			        $where[] = ['a.status','in',[0,1,3]];
		*/

		$list = db("demand")->alias('a')
			->field('a.*,b.name as subject_name,c.name as grade_name')
			->join('subject b', 'a.subject_id=b.subject_id', 'left')
			->join('grade c', 'a.grade_id=c.grade_id', 'left')
			->where($where)
			->order('a.create_time desc')
			->limit(($page - 1) * $limit, $limit)
			->select()->toArray();

		foreach ($list as $k => $v) {

			$list[$k]['create_time'] = date('Y-m-d H:i:s', $list[$k]['create_time']);
		}
		// $list[0]['create_time'] = 1;
		return json(['status' => 200, 'data' => $list]);
	}

	/**
	 * @api {post} /user/getDelDemand 15、 关闭学生需求(订单)
	 * @apiGroup 会员
	 * @apiVersion 1.0.0
	 * @apiDescription  删除学生需求(订单)
	 * @apiHeader {String} Authorization 用户授权token
	 * @apiParam (输入参数：) {number}      demand_id   需求id
	 */
	public function getDelDemand() {
		if (!request()->uid) {
			return json(['status' => 404, 'msg' => "登陆超时"]);
		}
		$demand_id = $this->request->param('demand_id', '', 'intval');

		$where[] = ['mid', '=', request()->uid];
		$where[] = ['demand_id', '=', $demand_id];
		$demand_info = db("demand")->where($where)->find();

		if (!$demand_info) {
			return json(['status' => 404, 'msg' => "没有找到您的该需求信息"]);
		}

		try {
			db()->startTrans();

			//关闭 学生订单状态
			db('demand')->where('demand_id', $demand_id)->update(['status' => 3]);

			//删除 其他 该需求的 预约订单
			//db('appointment')->where('demand_id',$demand_id)->delete();

			db()->commit();
		} catch (\Exception $e) {
			db()->rollback();
			abort(config('my.error_log_code'), $e->getMessage());
		}

		return json(['status' => 200, 'msg' => '关闭成功']);
	}

	/**
	 * @api {post} /user/hideOrOpenResume 16、 隐藏或打开简历
	 * @apiGroup 会员
	 * @apiVersion 1.0.0
	 * @apiDescription  隐藏简历
	 * @apiHeader {String} Authorization 用户授权token
	 * @apiParam (输入参数：) {number}      teacher_id   教师id
	 */
	public function hideOrOpenResume() {
		if (!request()->uid) {
			return json(['status' => 404, 'msg' => "登陆超时"]);
		}
		$teacher_id = $this->request->param('teacher_id', '', 'intval');

		$where[] = ['mid', '=', request()->uid];
		// $where[] = ['teacher_id','=',$teacher_id];
		$teacher_info = db("teacher")->where($where)->find();

		if ($teacher_info['is_hide'] == 1) {
			$is_hide = 0;
			$msg = '简历已开启';
		} else {
			$is_hide = 1;
			$msg = '简历已隐藏';
		}
		db("teacher")->where($where)->update(['is_hide' => $is_hide]);

		return json(['status' => 200, 'msg' => $msg]);
	}

	/**
	 * @api {post} /user/getMsgList 17、 获取消息列表
	 * @apiGroup 会员
	 * @apiVersion 1.0.0
	 * @apiDescription  获取消息列表
	 * @apiHeader {String} Authorization 用户授权token
	 */
	public function getMsgList() {
		if (!request()->uid) {
			return json(['status' => 404, 'msg' => "登陆超时"]);
		}

		$where[] = ['a.mid', '=', request()->uid];
		$list = db("msg")->alias('a')
			->field('b.*,a.*')
			->join('order b', 'a.order_id=b.order_id', 'left')
			->where($where)->order('a.create_time desc')->select()->toArray();

		foreach ($list as $k => $v) {

			$list[$k]['content'] = format_html($list[$k]['content']);
		}

		return json(['status' => 200, 'data' => $list]);
	}

	/**
	 * @api {post} /user/getMyFileList 18、 获取我得文件列表
	 * @apiGroup 会员
	 * @apiVersion 1.0.0
	 * @apiDescription  获取我得文件列表
	 * @apiHeader {String} Authorization 用户授权token
	 */
	public function getMyFileList() {
		if (!request()->uid) {
			return json(['status' => 404, 'msg' => "登陆超时"]);
		}

		$where[] = ['mid', '=', request()->uid];
		$list = db("my_file")
			->where($where)->order('create_time desc')->select()->toArray();

		foreach ($list as $k => $v) {

			$list[$k]['create_time'] = date('Y-m-d H:i:s', $list[$k]['create_time']);
		}

		return json(['status' => 200, 'data' => $list]);
	}

	/**
	 * @api {post} /user/uploadFile 19、 上传文件
	 * @apiGroup 会员
	 * @apiVersion 1.0.0
	 * @apiDescription  上传文件
	 * @apiHeader {String} Authorization 用户授权token
	 * @apiParam (输入参数：) {string}      name   文件名称
	 * @apiParam (输入参数：) {string}      file   文件路径
	 * @apiParam (输入参数：) {string}      price   价格
	 */
	public function uploadFile() {
		if (!request()->uid) {
			return json(['status' => 404, 'msg' => "登陆超时"]);
		}

		$name = $this->request->param('name', '', '');
		$file = $this->request->param('file', '', '');
		$price = $this->request->param('price', '', '');

		if (!$name || !$file) {
			return json(['status' => 404, 'msg' => "参数不完整"]);
		}

		$where[] = ['mid', '=', request()->uid];
		$teacher_info = db("teacher")->where($where)->find();

		if (!$teacher_info) {
			return json(['status' => 404, 'msg' => "对不起,没有找到您的老师信息"]);
		}

		$ins['name'] = $name;
		$ins['file'] = $file;
		$ins['price'] = $price;
		$ins['mid'] = request()->uid;
		$ins['teacher_id'] = $teacher_info['teacher_id'];

		db('file_download')->insertGetId($ins);

		return json(['status' => 200, 'msg' => '上传成功,等待管理员审核']);
	}

	/*public function testSendMail(){

		$teacher_info = db('teacher')->where('teacher_id', 447)->find();
		$title = '老师预约家长';
		$address = ['1053099821@qq.com'];
		$qrcode     = request()->domain().'/'.$teacher_info['qrcode'];
		$content = "        编号为 1000 的教员,预约了您的家教,请及时联系,点击前往小程序查看教师详情</br> <img height='200px' src='$qrcode'/>";
		sendMail($title, $address,$content);
	*/

	//减去老师联系次数
	public function dec_teach_DialNum() {
		$teacher_id = $this->request->param('teacher_id', '', '');
		try {
			db()->startTrans();
			db('member')->where('mid', request()->uid)->dec('dial_num')->update();
			$ins['mid'] = request()->uid;
			$ins['teacher_id'] = $teacher_id;
			$ins['create_time'] = time();
			db('contact_history')->insertGetId($ins);
			db()->commit();
		} catch (\Exception $e) {
			db()->rollback();
			abort(config('my.error_log_code'), $e->getMessage());
		}
		$mobile = db("teacher")->where("teacher_id", $teacher_id)->value('mobile');
		return json(['status' => 200, 'mobile' => $mobile, 'msg' => '操作成功']);
	}

	/**
	 * @api {post} /user/teacherOffProfile 20、 老师下架简历
	 * @apiGroup 老师
	 * @apiVersion 1.0.0
	 * @apiDescription  老师下架简历
	 * @apiHeader {String} Authorization 用户授权token
	 */
	public function teacherOffProfile(){
		$has_teacher_info = db('teacher')->where('mid', request()->uid)->find();

		if(!$has_teacher_info){
			return json(['status' => 500, 'msg' => '未注册教师信息']);
		}

		try {
			db()->startTrans();
			$param['status'] = 2;
			db('teacher')->where('mid', request()->uid)->update($param);

			db()->commit();
		} catch (\Exception $e) {
			db()->rollback();
			abort(config('my.error_log_code'), $e->getMessage());
		}

		return json(['status' => 200, 'msg' => '操作成功']);
	}

	/**
	 * @api {post} /user/teacherVipCost 21、 老师消耗会员
	 * @apiGroup 老师
	 * @apiVersion 1.0.0
	 * @apiDescription  老师消耗会员
	 * @apiHeader {String} Authorization 用户授权token
	 * @apiParam (输入参数：) {string}      demand_id   学生简历id
	 */
	public function teacherVipCost(){
		$demand_id = $this->request->param('demand_id', '', 'intval');
		if(!$demand_id){
			return json(['status' => 404, 'msg' => '参数不完整']);
		}
		$mid = request()->uid;
		$teacher_info = db('teacher')->where('mid', $mid)->find();
		if(!$teacher_info){
			return json(['status' => 404, 'msg' => '未注册教师信息']);
		}
		$demand_info = db('demand')->where('demand_id', $demand_id)->find();
		if(!$demand_info){
			return json(['status' => 404, 'msg' => '没有找到该学生简历信息']);
		}

		$has_cost_log = db('member_vip_cost_log')->where('mid', $mid)->where('teacher_id', $teacher_info['teacher_id'])->where('demand_id', $demand_id)->find();
		if($has_cost_log){
			return json(['status' => 200, 'msg' => '操作成功']);
		}
		try {
			db()->startTrans();
			$param['mid'] = $mid;
			$param['teacher_id'] = $teacher_info['teacher_id'];
			$param['demand_id'] = $demand_id;
			$param['cost_content'] = '拨打电话';
			$param['create_time'] = time();

			db('member_vip_cost_log')->insert($param);

			db()->commit();
		} catch (\Exception $e) {
			db()->rollback();
			return json(['status' => 500, 'msg' => '保存失败']);
		}

		return json(['status' => 200, 'msg' => '操作成功']);
	}
	/**
	 * @api {post} /user/accountCancellation 22、 账号注销
	 * @apiGroup 会员
	 * @apiVersion 1.0.0
	 * @apiDescription  账号注销
	 * @apiHeader {String} Authorization 用户授权token
	 */
	public function accountCancellation(){
		$mid = request()->uid;
		if(!$mid){
			return json(['status' => 401, 'msg' => '请先登录']);
		}

		$now = time();
		$member_info = db('member')->where('mid', $mid)->find();
		if(!$member_info){
			return json(['status' => 200, 'msg' => '账号注销成功']);
		}

		// 构造手机号和 openid 的注销标记
		$mobile_mark = $member_info['mobile'] . '_注销_' . $now;
		$openid_mark = $member_info['openid'] ? $member_info['openid'] . '_注销_' . $now : '';

		try {
			db()->startTrans();

			// 1. 更新 demand 表：所有该用户的学员需求状态改为申请退款
			db('demand')->where('mid', $mid)->update(['status' => 3]);

			// 2. 更新 teacher 表：所有该用户的老师信息状态改为未通过/已注销
			db('teacher')->where('mid', $mid)->update(['status' => 2]);

			// 3. 更新 member 表：标记手机号和 openid，状态设为无效
			db('member')->where('mid', $mid)->update([
				'status' => 1,  // 保持正常状态避免被清理，但手机号已标记
				'mobile' => $mobile_mark,
				'openid' => $openid_mark,
			]);

			db()->commit();
		} catch (\Exception $e) {
			db()->rollback();
			return json(['status' => 500, 'msg' => '注销失败：' . $e->getMessage()]);
		}

		return json(['status' => 200, 'msg' => '账号注销成功']);
	}
}
