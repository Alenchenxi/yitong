<?php
namespace app\api\controller;

use think\exception\ValidateException;
use think\facade\Log;

class Order extends Common {

/**
 * @api {post} /order/createOrder  01、创建订单
 * @apiGroup 订单
 * @apiVersion 1.0.0
 * @apiDescription  创建订单
 * @apiHeader {String} Authorization 用户授权token
 * @apiParam (传入参数：) {number}      demand_id   需求id
 */
	public function createOrder() {
		if (!request()->uid) {
			return json(['status' => 404, 'msg' => '登陆超时']);
		}

		$demand_id = $this->request->param('demand_id', '', 'intval');
		if (!$demand_id) {
			return json(['status' => 404, 'msg' => '参数不完整']);
		}

		//查询 该用户 老师信息
		$teacher_info = db('teacher')->where('mid', request()->uid)->find();
		if (!$teacher_info) {
			return json(['status' => 404, 'msg' => '对不起,没有找到您的老师信息']);
		}

		if ($teacher_info['status'] != 1) {
			return json(['status' => 404, 'msg' => '对不起,您的审核状态不为已通过状态,无法查看学员信息']);
		}

		if ($teacher_info['is_on_off'] != 1) {
			return json(['status' => 404, 'msg' => '您已违规下线，不能联系可退款订单']);
		}

		//查询学生信息
		$demand_info = db('demand')->where('demand_id', $demand_id)->find();
		if (!$demand_info) {
			return json(['status' => 404, 'msg' => '对不起,没有找该学员信息']);
		}

		//查询该老师 有没有购买过该学生的信息
		$teacher_cost_vip = config("config.teacher_cost_vip");
		if ($teacher_cost_vip == 0){
			$has = db('teacher_order')->where('mid', request()->uid)->where('demand_id', $demand_id)->where('status', 1)->find();
		    if ($has) {
			    return json(['status' => 404, 'msg' => '您已购买过,不需要再次购买']);
		   }
		}
		

		$teacher_cost_vip = config("config.teacher_cost_vip");
		if ($teacher_cost_vip == 1){
			$amount = config('config.teacher_vip_price');
		}else{
			$amount = config('config.teacher_price');
		}

		$ins['sn'] = doOrderSn(00);
		$ins['demand_id'] = $demand_id;
		$ins['teacher_id'] = $teacher_info['teacher_id'];
		$ins['amount'] = $amount;
		$ins['create_time'] = time();

		$ins['mid'] = request()->uid;
		//创建订单
		$order_id = db('teacher_order')->insertGetId($ins);

		$total_fee = $ins['amount'] * 100;
		// $total_fee  = 1;
		$openid = db("member")->where("mid", request()->uid)->value('openid');
		$notify_url = request()->domain() . '/wxpay/wxpayBack2'; //支付回调地址
		$payInfo = [
			'body' => '联系学员订单支付', //交易的标题 自己定义
			'out_trade_no' => $ins['sn'], //交易订单号
			'total_fee' => $total_fee, //交易金额 单位 分
			'notify_url' => $notify_url,
			'openid' => $openid,
			'attach' => $order_id,
		];
		try {
			$config = array_merge(config('my.mini_program'), config('my.wechart_pay'));
			$res = \utils\wechart\PayService::jsapiPay($payInfo, $config);
		} catch (\Exception $e) {
			throw new ValidateException($e->getMessage());
		}
		$res['timeStamp'] = $res['timestamp'];
		$res['out_trade_no'] = $ins['sn'];
		return json(['state' => 200, 'data' => $res]);

	}

	/**
	 * @api {post} /order/createOrder  01、创建订单
	 * @apiGroup 订单
	 * @apiVersion 1.0.0
	 * @apiDescription  创建订单
	 * @apiHeader {String} Authorization 用户授权token
	 * @apiParam (传入参数：) {number}      teacher_id   教师id
	 * @apiParam (传入参数：) {number}      teaching_way   任教方式  上门授课|1|primary,在线授课|2|success,均可|3|info
	 * @apiParam (传入参数：) {string}      linkman   联系人
	 * @apiParam (传入参数：) {string}      mobile   手机号
	 * @apiParam (传入参数：) {string}      province   省
	 * @apiParam (传入参数：) {string}      city   市
	 * @apiParam (传入参数：) {string}      area   区
	 * @apiParam (传入参数：) {string}      address   详细地址
	 * @apiParam (传入参数：) {number}      teaching_subject_id   选择老师授教科目id
	 * @apiParam (传入参数：) {number}      hour   课时
	 * @apiParam (传入参数：) {number}      weeks   周几上课   多个id , 隔开
	 */
	public function createOrder11111() {
		if (!request()->uid) {
			return json(['status' => 404, 'msg' => '登陆超时']);
		}

		$teacher_id = $this->request->param('teacher_id', '', 'intval');
		$teaching_way = $this->request->param('teaching_way', '', 'intval');
		$linkman = $this->request->param('linkman', '', '');
		$mobile = $this->request->param('mobile', '', '');
		$province = $this->request->param('province', '', '');
		$city = $this->request->param('city', '', '');
		$area = $this->request->param('area', '', '');
		$address = $this->request->param('address', '', '');
		$teaching_subject_id = $this->request->param('teaching_subject_id', '', 'intval');
		$hour = $this->request->param('hour', '', 'intval');
		$weeks = $this->request->param('weeks', '', '');
		if (!$teacher_id || !$teaching_way || !$linkman || !$mobile || !$province
			|| !$city || !$area || !$address || !$teaching_subject_id || !$hour || !$weeks) {
			return json(['status' => 404, 'msg' => '参数不完整']);
		}
		$member_info = db('member')->where('mid', request()->uid)->find();

		//查询 该用户 老师信息
		$teacher_info = db('teacher')->where('teacher_id', $teacher_id)->find();
		if (!$teacher_info) {
			return json(['status' => 404, 'msg' => '对不起,没有找到该老师信息']);
		}

		if ($hour < $teacher_info['min_hour']) {
			return json(['status' => 404, 'msg' => '当前购买课时数,小于后台设置最小课时数']);
		}

		//查询老师授教的科目详情
		$teaching_subject_info = db('teaching_subject')->where('teaching_subject_id', $teaching_subject_id)->find();
		if (!$teaching_subject_info) {
			return json(['status' => 404, 'msg' => '对不起,没有找到该老师该课程信息']);
		}

		//课程安排
		$weeks_arr = explode(',', $weeks);
		if (!$weeks_arr) {
			return json(['status' => 404, 'msg' => '上课时间不能为空']);
		}

		$ins['sn'] = doOrderSn(00);
		$ins['mid'] = request()->uid;
		$ins['teacher_id'] = $teacher_id;
		$ins['teaching_way'] = $teaching_way;
		$ins['linkman'] = $linkman;
		$ins['mobile'] = $mobile;
		$ins['province'] = $province;
		$ins['city'] = $city;
		$ins['area'] = $area;
		$ins['address'] = $address;
		$ins['teaching_subject_id'] = $teaching_subject_id;
		$ins['grade_id'] = $teaching_subject_info['grade_id'];
		$ins['grade_name'] = $teaching_subject_info['grade_name'];
		$ins['subject_id'] = $teaching_subject_info['subject_id'];
		$ins['subject_name'] = $teaching_subject_info['subject_name'];
		$ins['price'] = $teaching_subject_info['price'] * 2;
		$ins['hour'] = $hour;
		$ins['remain_hour'] = $hour;
		$ins['weeks'] = $weeks;
		$ins['amount'] = $ins['price'] * $ins['hour'];
		$ins['create_time'] = time();

		//创建订单
		$order_id = db('order')->insertGetId($ins);

		//查询所选择的该老师的上课时间
		$where[] = ['schooltime_id', 'in', $weeks_arr];
		$schooltime_list = db('schooltime')->where($where)->select()->toArray();

		foreach ($schooltime_list as $li) {
			$st_ins['week'] = $li['week'];
			$st_ins['start_time'] = $li['start_time'];
			$st_ins['end_time'] = $li['end_time'];
			$st_ins['order_id'] = $order_id;

			//添加订单上课时间
			db('schooltime')->insert($st_ins);
		}

		return json(['status' => 200, 'data' => $order_id]);
	}

	/**
	 * @api {post} /order/createTcOrder  02、创建套餐订单
	 * @apiGroup 订单
	 * @apiVersion 1.0.0
	 * @apiDescription  创建套餐订单
	 * @apiHeader {String} Authorization 用户授权token
	 * @apiParam (传入参数：) {number}      set_meal_id   套餐id
	 * @apiParam (传入参数：) {number}      platform_id   平台 微信1  抖音2  百度3
	 */
	public function createTcOrder() {
		if (!request()->uid) {
			return json(['status' => 404, 'msg' => '登陆超时']);
		}

		$set_meal_id = $this->request->param('set_meal_id', '', 'intval');
		$platform_id = $this->request->param('platform_id', '', 'intval') ? $this->request->param('platform_id', '', 'intval') : 1;
		if (!$set_meal_id) {
			return json(['status' => 404, 'msg' => '参数不完整']);
		}

		//查询 该用户 老师信息
		$teacher_info = db('teacher')->where('mid', request()->uid)->find();
		if (!$teacher_info) {
			return json(['status' => 404, 'msg' => '对不起,没有找到您的老师信息']);
		}

		//查询套餐信息
		$set_meal_info = db('set_meal')->where('set_meal_id', $set_meal_id)->find();
		if (!$set_meal_info) {
			return json(['status' => 404, 'msg' => '对不起,没有找到该查询套餐信息']);
		}

		$ins['sn'] = doOrderSn(00);
		$ins['mid'] = request()->uid;
		$ins['teacher_id'] = $teacher_info['teacher_id'];
		$ins['set_meal_id'] = $set_meal_info['set_meal_id'];
		$ins['amount'] = $set_meal_info['price'];
		$ins['create_time'] = time();

		//创建订单
		$order_id = db('tc_order')->insertGetId($ins);

		if ($platform_id == 1) {
			$total_fee = $ins['amount'] * 100;
			//$total_fee  = 1;
			$openid = db("member")->where("mid", request()->uid)->value('openid');
			$notify_url = request()->domain() . '/wxpay/wxpayTcBack'; //支付回调地址
			$payInfo = [
				'body' => '置顶订单支付', //交易的标题 自己定义
				'out_trade_no' => $ins['sn'], //交易订单号
				'total_fee' => $total_fee, //交易金额 单位 分
				'notify_url' => $notify_url,
				'openid' => $openid,
				'attach' => $order_id,
			];
			try {
				$config = array_merge(config('my.mini_program'), config('my.wechart_pay'));
				$res = \utils\wechart\PayService::jsapiPay($payInfo, $config);
			} catch (\Exception $e) {
				throw new ValidateException($e->getMessage());
			}
			$res['timeStamp'] = $res['timestamp'];
			return json(['state' => 200, 'data' => $res]);
		} elseif ($platform_id == 2) {

		} else {
			$total_fee = $ins['amount'] * 100;
			$notify_url = request()->domain() . '/bdpay/baiduPayTcBack'; //支付回调地址
			$baidu = config('my.baidu');
			$signArr['appKey'] = $baidu['appKey'];
			$signArr['dealId'] = $baidu['dealId'];
			$signArr['totalAmount'] = $total_fee;
			$signArr['tpOrderId'] = $ins['sn'];
			$rsaSign = \utils\Baidu::sign($signArr);
			$payInfo = [
				'dealTitle' => '百度平台支付',
				'notifyUrl' => $notify_url,
				'totalAmount' => $total_fee,
				'tpOrderId' => $ins['sn'], //交易订单号
				'signFieldsRange' => 1,
				'rsaSign' => $rsaSign,
			];
			$res = array_merge($baidu, $payInfo);
			return json(['state' => 200, 'data' => $res]);
		}

	}

	/**
	 * @api {post} /order/wxPay  02、微信支付
	 * @apiGroup 订单
	 * @apiVersion 1.0.0
	 * @apiDescription  微信支付
	 * @apiHeader {String} Authorization 用户授权token
	 * @apiParam (传入参数：) {number}      order_id 订单id
	 */
	public function wxPay() {
		if (!request()->uid) {
			return json(['status' => 404, 'msg' => '登陆超时']);
		}

		$order_id = $this->request->param('order_id', '', 'intval');

		if (!$order_id) {
			return json(['status' => 404, 'msg' => '参数不完整']);
		}

		//获取订单信息
		$order_info = db('order')->find($order_id);
		if (!$order_info) {
			return json(['status' => 404, 'msg' => '没有找到该订单信息']);
		}

		if ($order_info['status'] == 1) {
			return json(['status' => 404, 'msg' => '该订单已支付']);
		}

		if ($order_info['status'] == 2) {
			return json(['status' => 404, 'msg' => '该订单已完成']);
		}

		$total_fee = $order_info['amount'] * 100;
		//$total_fee  = 1;
		$openid = db("member")->where("mid", request()->uid)->value('openid');
		$notify_url = request()->domain() . '/wxpay/wxpayBack'; //支付回调地址
		$payInfo = [
			'body' => '联系老师购买课时订单支付', //交易的标题 自己定义
			'out_trade_no' => $order_info['sn'], //交易订单号
			'total_fee' => $total_fee, //交易金额 单位 分
			'notify_url' => $notify_url,
			'openid' => $openid,
			'attach' => $order_id,
		];
		try {
			$config = array_merge(config('my.mini_program'), config('my.wechart_pay'));
			$res = \utils\wechart\PayService::jsapiPay($payInfo, $config);
		} catch (\Exception $e) {
			throw new ValidateException($e->getMessage());
		}
		$res['timeStamp'] = $res['timestamp'];
		return json(['status' => 200, 'data' => $res]);
	}

	/**
	 * @api {post} /order/dyPay  02、抖音支付
	 * @apiGroup 订单
	 * @apiVersion 1.0.0
	 * @apiDescription  抖音支付
	 * @apiHeader {String} Authorization 用户授权token
	 * @apiParam (传入参数：) {number}      order_id 订单id
	 */
	public function dyPay() {
		$order_id = $this->request->param('order_id', '', 'intval');

		if (!$order_id) {
			return json(['status' => 404, 'msg' => '参数不完整']);
		}

		//获取订单信息
		$order_info = db('order')->find($order_id);
		if (!$order_info) {
			return json(['status' => 404, 'msg' => '没有找到该订单信息']);
		}

		if ($order_info['status'] == 1) {
			return json(['status' => 404, 'msg' => '该订单已支付']);
		}

		if ($order_info['status'] == 2) {
			return json(['status' => 404, 'msg' => '该订单已完成']);
		}

		$totalAmount = $order_info['amount'] * 100;
		$notify_url = request()->domain() . '/dypay/dyPayBack'; //支付回调地址
		$params = [
			'app_id' => config('my.dy_mini_program.app_id'),
			'out_order_no' => $order_info['sn'],
			'total_amount' => $totalAmount,
			'subject' => '抖音平台支付',
			'body' => '抖音购课支付',
			'valid_time' => 172800,
			'notify_url' => $notify_url,
			//'cp_extra' => $cpExtra,
			//'thirdparty_id' => $thirdPartyId,
			//'disable_msg' => $disableMsg,
			//'msg_page' => $msgPage,
			//'store_uid' => $storeUid
		];

		$params = array_filter($params);
		$params['sign'] = dySign($params);
		//var_dump($params);die;

		$url = "https://developer.toutiao.com/api/apps/ecpay/v1/create_order";
		$headers[] = 'Content-type: application/json';
		$resjson = httpRequest($url, $params, $headers);

		return $resjson;
	}

	/**
	 * @api {post} /order/baiDuPay  03、百度支付
	 * @apiGroup 订单
	 * @apiVersion 1.0.0
	 * @apiDescription  百度支付
	 * @apiHeader {String} Authorization 用户授权token
	 * @apiParam (传入参数：) {number}      order_id 订单id
	 */
	public function baiDuPay() {
		$order_id = $this->request->param('order_id', '', 'intval');

		if (!$order_id) {
			return json(['status' => 404, 'msg' => '参数不完整']);
		}

		//获取订单信息
		$order_info = db('order')->find($order_id);
		if (!$order_info) {
			return json(['status' => 404, 'msg' => '没有找到该订单信息']);
		}

		if ($order_info['status'] == 1) {
			return json(['status' => 404, 'msg' => '该订单已支付']);
		}

		if ($order_info['status'] == 2) {
			return json(['status' => 404, 'msg' => '该订单已完成']);
		}

		$totalAmount = $order_info['amount'] * 100;
		$notify_url = request()->domain() . '/bdpay/baiduPayBack'; //支付回调地址
		$baidu = config('my.baidu');
		$signArr['appKey'] = $baidu['appKey'];
		$signArr['dealId'] = $baidu['dealId'];
		$signArr['totalAmount'] = $totalAmount;
		$signArr['tpOrderId'] = $order_info['sn'];
		$rsaSign = \utils\Baidu::sign($signArr);
		$body = '百度平台支付';
		$payInfo = [
			'dealTitle' => $body,
			'notifyUrl' => $notify_url,
			'totalAmount' => $totalAmount,
			'tpOrderId' => $order_info['sn'], //交易订单号
			'signFieldsRange' => 1,
			'rsaSign' => $rsaSign,
		];
		$res = array_merge($baidu, $payInfo);

		return json(['status' => 200, 'data' => $res]);
	}

	/**
	 * @api {post} /order/getStuOrderList 03、 获取学生订单列表
	 * @apiGroup 订单
	 * @apiVersion 1.0.0
	 * @apiDescription  获取学生订单列表
	 * @apiHeader {String} Authorization 用户授权token
	 * @apiParam (输入参数：) {number}      limit 数量
	 * @apiParam (输入参数：) {number}      page 页数
	 * @apiParam (输入参数：) {string}      order_state 状态  全部 1  不传默认0
	 */
	public function getStuOrderList() {
		if (!request()->uid) {
			return json(['status' => 404, 'msg' => "登陆超时"]);
		}

		$limit = $this->request->param('limit', '10', 'intval');
		$page = $this->request->param('page', 1, 'intval');
		$order_state = $this->request->param('order_state', '', '') ? $this->request->param('order_state', '', '') : 0;

		$where[] = ['a.mid', '=', request()->uid];

		if ($order_state != 1) {
			//status   0待支付
			$where[] = ['a.status', '=', 0];
		}

		$list = db("order")->alias('a')
			->field('a.*,b.name as teacher_name,b.head_img')
			->join('teacher b', 'a.teacher_id=b.teacher_id', 'left')
			->where($where)
			->order('a.create_time desc')
			->limit(($page - 1) * $limit, $limit)
			->select()->toArray();

		foreach ($list as $k => $v) {
			$list[$k]['create_time'] = date('Y-m-d H:i:s', $list[$k]['create_time']);

			$list[$k]['schooltime'] = db('schooltime')->where('order_id', $list[$k]['order_id'])->select()->toArray();
		}

		return json(['status' => 200, 'data' => $list]);
	}

	/**
	 * @api {post} /order/getTeaOrderList 04、 获取老师订单列表
	 * @apiGroup 订单
	 * @apiVersion 1.0.0
	 * @apiDescription  获取老师订单列表
	 * @apiHeader {String} Authorization 用户授权token
	 * @apiParam (输入参数：) {number}      limit 数量
	 * @apiParam (输入参数：) {number}      page 页数
	 */
	public function getTeaOrderList() {
		if (!request()->uid) {
			return json(['status' => 404, 'msg' => "登陆超时"]);
		}

		$limit = $this->request->param('limit', '10', 'intval');
		$page = $this->request->param('page', 1, 'intval');

		$teacher_info = db('teacher')->where('mid', request()->uid)->find();
		if (!$teacher_info) {
			return json(['status' => 404, 'msg' => '对不起,没有找到您的老师信息']);
		}

		$where[] = ['a.teacher_id', '=', $teacher_info['teacher_id']];
		$where[] = ['a.status', '<>', 0];

		$list = db("order")->alias('a')
			->field('a.*,b.name as teacher_name,b.head_img')
			->join('teacher b', 'a.teacher_id=b.teacher_id', 'left')
			->where($where)
			->order('a.create_time desc')
			->limit(($page - 1) * $limit, $limit)
			->select()->toArray();

		foreach ($list as $k => $v) {
			$list[$k]['create_time'] = date('Y-m-d H:i:s', $list[$k]['create_time']);

			$list[$k]['schooltime'] = db('schooltime')->where('order_id', $list[$k]['order_id'])->select()->toArray();
		}

		return json(['status' => 200, 'data' => $list]);
	}

	/**
	 * @api {post} /order/wxPayAppointment 05、微信支付预约订单
	 * @apiGroup 订单
	 * @apiVersion 1.0.0
	 * @apiDescription  微信支付预约订单
	 * @apiHeader {String} Authorization 用户授权token
	 * @apiParam (传入参数：) {number}      appointment_id 预约订单id
	 */
	public function wxPayAppointment() {
		if (!request()->uid) {
			return json(['status' => 404, 'msg' => '登陆超时']);
		}

		$appointment_id = $this->request->param('appointment_id', '', 'intval');

		if (!$appointment_id) {
			return json(['status' => 404, 'msg' => '参数不完整']);
		}

		//获取订单信息
		$order_info = db('appointment')->find($appointment_id);
		if (!$order_info) {
			return json(['status' => 404, 'msg' => '没有找到该订单信息']);
		}

		if ($order_info['status'] == 0) {
			return json(['status' => 404, 'msg' => '该订单不是待支付状态']);
		}

		if ($order_info['status'] == 2) {
			return json(['status' => 404, 'msg' => '该订单已完成']);
		}

		$total_fee = $order_info['amount'] * 100;
		//$total_fee  = 1;
		$openid = db("member")->where("mid", request()->uid)->value('openid');
		$notify_url = request()->domain() . '/wxpay/wxPayAppointmentBack'; //支付回调地址
		$payInfo = [
			'body' => '联系老师购买课时订单支付', //交易的标题 自己定义
			'out_trade_no' => $order_info['sn'], //交易订单号
			'total_fee' => $total_fee, //交易金额 单位 分
			'notify_url' => $notify_url,
			'openid' => $openid,
			'attach' => $appointment_id,
		];
		try {
			$config = array_merge(config('my.mini_program'), config('my.wechart_pay'));
			$res = \utils\wechart\PayService::jsapiPay($payInfo, $config);
		} catch (\Exception $e) {
			throw new ValidateException($e->getMessage());
		}
		$res['timeStamp'] = $res['timestamp'];
		return json(['state' => 200, 'data' => $res]);
	}

	/**
	 * @api {post} /order/reduceOrderHours 06、 减少订单课时
	 * @apiGroup 订单
	 * @apiVersion 1.0.0
	 * @apiDescription  减少订单课时
	 * @apiHeader {String} Authorization 用户授权token
	 * @apiParam (输入参数：) {number}      order_id 订单id
	 * @apiParam (输入参数：) {number}      num  减少课时数量
	 */
	public function reduceOrderHours() {
		if (!request()->uid) {
			return json(['status' => 404, 'msg' => "登陆超时"]);
		}

		$order_id = $this->request->param('order_id', '', 'intval');
		$num = $this->request->param('num', '', 'intval');

		if (!$order_id || !$num) {
			return json(['status' => 404, 'msg' => "参数不完整"]);
		}

		//订单详情
		$order_info = db("order")->where('order_id', $order_id)->find();
		if (!$order_info) {
			return json(['status' => 404, 'msg' => "没有找到该订单信息"]);
		}

		$ins['title'] = '减少课时通知';
		$ins['content'] = "共减少 $num 节课时";
		$ins['mid'] = $order_info['mid'];
		$ins['create_time'] = time();
		$ins['order_id'] = $order_id;
		$ins['num'] = $num;
		$ins['type'] = 1;
		db('msg')->insertGetId($ins);

		return json(['status' => 200, 'msg' => '已通知家长,等待家长确认']);
	}

	/**
	 * @api {post} /order/msgConfirmOrCancel 06、 确定/取消减少订单课时
	 * @apiGroup 订单
	 * @apiVersion 1.0.0
	 * @apiDescription  确定/取消减少订单课时
	 * @apiHeader {String} Authorization 用户授权token
	 * @apiParam (输入参数：) {number}      msg_id 消息id
	 * @apiParam (输入参数：) {number}      status 1确认 2取消
	 */
	public function msgConfirmOrCancel() {
		if (!request()->uid) {
			return json(['status' => 404, 'msg' => "登陆超时"]);
		}

		$msg_id = $this->request->param('msg_id', '', 'intval');
		$status = $this->request->param('status', '', 'intval');

		if (!$msg_id || !$status) {
			return json(['status' => 404, 'msg' => "参数不完整"]);
		}

		//订单详情
		$msg_info = db("msg")->where('msg_id', $msg_id)->find();
		if (!$msg_info) {
			return json(['status' => 404, 'msg' => "对不起,没有找到该消息内容"]);
		}

		if ($msg_info['status'] != 0) {
			return json(['status' => 404, 'msg' => "该消息不是待操作状态,不能再次操作"]);
		}

		try {
			db()->startTrans();

			//修改 消息状态
			db("msg")->where('msg_id', $msg_id)->update(['status' => $status]);

			//如果 修改状态 为 确认
			if ($status == 1) {
				db("order")->where('order_id', $msg_info['order_id'])->dec('remain_hour', $msg_info['num'])->update();
			}

			db()->commit();
		} catch (\Exception $e) {
			db()->rollback();
			abort(config('my.error_log_code'), $e->getMessage());
		}

		return json(['status' => 200, 'msg' => '已通知家长,等待家长确认']);
	}

	/**
	 * @api {post} /order/createFileDownloadOrder  07、创建购买文件支付订单
	 * @apiGroup 订单
	 * @apiVersion 1.0.0
	 * @apiDescription  创建订单
	 * @apiHeader {String} Authorization 用户授权token
	 * @apiParam (传入参数：) {number}      file_download_id   文件id
	 */
	public function createFileDownloadOrder() {
		if (!request()->uid) {
			return json(['status' => 404, 'msg' => '登陆超时']);
		}

		$file_download_id = $this->request->param('file_download_id', '', 'intval');
		if (!$file_download_id) {
			return json(['status' => 404, 'msg' => '参数不完整']);
		}

		$file_info = db('file_download')->where('file_download_id', $file_download_id)->find();
		if (!$file_info) {
			return json(['status' => 404, 'msg' => '改资料信息不存在']);
		}

		//查询 该用户 老师信息
		$has_buy = db('file_download_order')
			->where('mid', request()->uid)
			->where('file_download_id', $file_download_id)
			// ->where('status',1)
			->find();
		if ($has_buy) {
			return json(['status' => 404, 'msg' => '您已购买过该资料,请勿重复购买']);
		}

		$ins['sn'] = doOrderSn(00);
		$ins['mid'] = request()->uid;
		$ins['file_download_id'] = $file_download_id;
		$ins['amount'] = $file_info['price'];
		$ins['create_time'] = time();

		//创建订单
		$order_id = db('file_download_order')->insertGetId($ins);

		return json(['state' => 205, 'data' => $order_id]);
	}

	/**
	 * @api {post} /order/wxPayFileDownloadOrder  08、微信支付购买文件订单
	 * @apiGroup 订单
	 * @apiVersion 1.0.0
	 * @apiDescription  微信支付购买文件订单
	 * @apiHeader {String} Authorization 用户授权token
	 * @apiParam (传入参数：) {number}      file_download_order_id 订单id
	 */
	public function wxPayFileDownloadOrder() {
		if (!request()->uid) {
			return json(['status' => 404, 'msg' => '登陆超时']);
		}

		$order_id = $this->request->param('file_download_order_id', '', 'intval');

		if (!$order_id) {
			return json(['status' => 404, 'msg' => '参数不完整']);
		}

		//获取订单信息
		$order_info = db('file_download_order')->find($order_id);
		if (!$order_info) {
			return json(['status' => 404, 'msg' => '没有找到该订单信息']);
		}

		if ($order_info['status'] == 1) {
			return json(['status' => 404, 'msg' => '该订单已支付']);
		}

		if ($order_info['amount'] <= 0) {

			$file_info = db('file_download')->where('file_download_id', $order_info['file_download_id'])->find();
			//添加购买记录
			$ins['file_download_id'] = $file_info['file_download_id'];
			$ins['name'] = $file_info['name'];
			$ins['file'] = $file_info['file'];
			$ins['mid'] = request()->uid;
			$ins['create_time'] = time();
			db('my_file')->insert($ins);

			if ($file_info['mid']) {
				//给上传资料的老师 添加消息通知
				$ins['title'] = '购买资料通知';
				$ins['content'] = "有用户购买了您的 " . $file_info['name'] . " 资料,请联系客服";
				$ins['mid'] = $file_info['mid'];
				$ins['create_time'] = time();
				$ins['type'] = 2;
				db('msg')->insertGetId($ins);
			}

			return json(['status' => 201]);
		}

		$total_fee = $order_info['amount'] * 100;
		//$total_fee  = 1;
		$openid = db("member")->where("mid", request()->uid)->value('openid');
		$notify_url = request()->domain() . '/wxpay/wxPayFileDownloadOrderBack'; //支付回调地址
		$payInfo = [
			'body' => '联系老师购买课时订单支付', //交易的标题 自己定义
			'out_trade_no' => $order_info['sn'], //交易订单号
			'total_fee' => $total_fee, //交易金额 单位 分
			'notify_url' => $notify_url,
			'openid' => $openid,
			'attach' => $order_id,
		];
		try {
			$config = array_merge(config('my.mini_program'), config('my.wechart_pay'));
			$res = \utils\wechart\PayService::jsapiPay($payInfo, $config);
		} catch (\Exception $e) {
			throw new ValidateException($e->getMessage());
		}
		$res['timeStamp'] = $res['timestamp'];
		return json(['state' => 200, 'data' => $res]);
	}

	/**
	 * @api {post} /order/baiDuPayFileDownloadOrder  08、微信支付购买文件订单
	 * @apiGroup 订单
	 * @apiVersion 1.0.0
	 * @apiDescription  微信支付购买文件订单
	 * @apiHeader {String} Authorization 用户授权token
	 * @apiParam (传入参数：) {number}      file_download_order_id 订单id
	 */
	public function baiDuPayFileDownloadOrder() {
		$order_id = $this->request->param('file_download_order_id', '', 'intval');

		if (!$order_id) {
			return json(['status' => 404, 'msg' => '参数不完整']);
		}

		//获取订单信息
		$order_info = db('file_download_order')->find($order_id);
		if (!$order_info) {
			return json(['status' => 404, 'msg' => '没有找到该订单信息']);
		}

		if ($order_info['status'] == 1) {
			return json(['status' => 404, 'msg' => '该订单已支付']);
		}

		if ($order_info['amount'] <= 0) {

			$file_info = db('file_download')->where('file_download_id', $order_info['file_download_id'])->find();
			//添加购买记录
			$ins['file_download_id'] = $file_info['file_download_id'];
			$ins['name'] = $file_info['name'];
			$ins['file'] = $file_info['file'];
			$ins['mid'] = request()->uid;
			$ins['create_time'] = time();
			db('my_file')->insert($ins);

			if ($file_info['mid']) {
				//给上传资料的老师 添加消息通知
				$ins['title'] = '购买资料通知';
				$ins['content'] = "有用户购买了您的 " . $file_info['name'] . " 资料,请联系客服";
				$ins['mid'] = $file_info['mid'];
				$ins['create_time'] = time();
				$ins['type'] = 2;
				db('msg')->insertGetId($ins);
			}

			return json(['status' => 201]);
		}

		$total_fee = $order_info['amount'] * 100;
		$notify_url = request()->domain() . '/bdpay/baiduPayFileDownloadOrderBack'; //支付回调地址
		$baidu = config('my.baidu');
		$signArr['appKey'] = $baidu['appKey'];
		$signArr['dealId'] = $baidu['dealId'];
		$signArr['totalAmount'] = $total_fee;
		$signArr['tpOrderId'] = $order_info['sn'];
		$rsaSign = \utils\Baidu::sign($signArr);
		$payInfo = [
			'dealTitle' => '百度平台支付',
			'notifyUrl' => $notify_url,
			'totalAmount' => $total_fee,
			'tpOrderId' => $order_info['sn'], //交易订单号
			'signFieldsRange' => 1,
			'rsaSign' => $rsaSign,
		];
		$res = array_merge($baidu, $payInfo);

		return json(['state' => 200, 'data' => $res]);
	}

	/**
	 * @api {post} /order/createDialOrder  07、创建购买可拨打次数订单订单
	 * @apiGroup 订单
	 * @apiVersion 1.0.0
	 * @apiDescription  创建购买可拨打次数订单订单
	 * @apiHeader {String} Authorization 用户授权token
	 */
	public function createDialOrder() {
		if (!request()->uid) {
			return json(['status' => 404, 'msg' => '登陆超时']);
		}

		$i=db("demand")->where("mid",request()->uid)->find();
		if(!$i){
			return json(['status' => 404, 'msg' => '请先发布家教信息']);
		}


		$city = $this->request->param('city', '', '');
		$dial_num = config('config.dial_num');
		$dial_price = config('config.dial_price');

		$ins['sn'] = doOrderSn(00);
		$ins['mid'] = request()->uid;
		$ins['dial_num'] = $dial_num;
		$ins['amount'] = $dial_price;
		$ins['create_time'] = time();

		//创建订单
		$order_id = db('dial_order')->insertGetId($ins);

		$total_fee = $ins['amount'] * 100;
		// $total_fee  = 1;
		$openid = db("member")->where("mid", request()->uid)->value('openid');
		$notify_url = request()->domain() . '/wxpay/dialOrderWxpayBack'; //支付回调地址
		$payInfo = [
			'body' => '联系老师订单支付', //交易的标题 自己定义
			'out_trade_no' => $ins['sn'], //交易订单号
			'total_fee' => $total_fee, //交易金额 单位 分
			'notify_url' => $notify_url,
			'openid' => $openid,
			'attach' => $order_id,
		];
		try {
			$config = array_merge(config('my.mini_program'), config('my.wechart_pay'));
			$res = \utils\wechart\PayService::jsapiPay($payInfo, $config);
		} catch (\Exception $e) {
			throw new ValidateException($e->getMessage());
		}
		$res['timeStamp'] = $res['timestamp'];
		$res['out_trade_no'] = $ins['sn'];
		return json(['status' => 200, 'data' => $res]);

	}

	/**
	 * @api {post} /order/teacherOrderRefund XX、教员订单退款
	 * @apiGroup 订单
	 * @apiVersion 1.0.0
	 * @apiDescription  教员订单退款
	 * @apiHeader {String} Authorization 用户授权 token
	 */
	public function teacherOrderRefund() {
		if (!request()->uid) {
			return json(['status' => 401, 'msg' => '请先登录']);
		}
		
		$mid = request()->uid;
		
		// 1. 检查 mid 对应的 teacher 是否存在
		$teacher_info = db('teacher')->where('mid', $mid)->find();
		if (!$teacher_info) {
			return json(['status' => 500, 'msg' => '您未注册老师']);
		}
		
		// 2. 查看 member_vip 是否存在 mid,teacher_id 关联且 eff_to 大于当前时间的数据
		$vip_info = db('member_vip')
			->where('mid', $mid)
			->where('teacher_id', $teacher_info['teacher_id'])
			->where('eff_to', '>', time())
			->find();
		if (!$vip_info) {
			return json(['status' => 500, 'msg' => '您未开通会员或已过期']);
		}
		
		// 3. 查看 member_vip_cost_log 是否存在 mid,teacher_id 关联且 create_time 在 30 天内的数据
		$thirty_days_ago = strtotime('-30 days');
		$cost_log = db('member_vip_cost_log')
			->where('mid', $mid)
			->where('teacher_id', $teacher_info['teacher_id'])
			->where('create_time', '>=', $thirty_days_ago)
			->find();
		if ($cost_log) {
			$create_time_str = date('Y-m-d', $cost_log['create_time']);
			return json(['status' => 500, 'msg' => "您于{$create_time_str}查看过生源联系方式，不可申请退款"]);
		}
		
		// 4. 获取 teacher_order(mid,teacher_id 关联倒序最新一条)
		$teacher_order = db('teacher_order')
			->where('mid', $mid)
			->where('teacher_id', $teacher_info['teacher_id'])
			->where('status', '1')
			->where('create_time', '>=', $thirty_days_ago)
			->order('teacher_order_id desc')
			->find();
		if (!$teacher_order) {
			return json(['status' => 500, 'msg' => '只有30天内的订单才能申请退款，请联系客服']);
		}
		
		try {
			db()->startTrans();
			
			// 调用 PayService::refund 方法申请退款
			$res = \utils\wechart\PayService::refund([
				'out_trade_no' => $teacher_order['sn'],
				'total_fee'    => $teacher_order['amount'],
				'refund_fee'   => $teacher_order['amount'],
				'desc'         => '申请退款,原路退回',
			]);
			Log::error('wxchat pay refund response:'.print_r($res,true));
			
			// teacher_order.status 更新为 21(不检查退款状态，直接更新)
			db('teacher_order')
				->where('teacher_order_id', $teacher_order['teacher_order_id'])
				->update(['status' => 21]);
			
			db()->commit();
			
			return json(['status' => 200, 'msg' => '退款申请已提交，费用将原路退回']);
		} catch (\Exception $e) {
			db()->rollback();
			return json(['status' => 500, 'msg' => '退款失败：' . $e->getMessage()]);
		}
	}
}
