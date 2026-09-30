<?php

namespace app\cms\controller;

class User extends Base {
	/**
	 * 我的页面内容
	 */
	public function index() {

        $this->view->assign('nav', 5);
		return view('index/user');
	}

	/**
	 * 家教说明页面
	 */
	public function explain() {
		$tutor_explain = format_html(config('config.tutor_explain'));
		$this->view->assign('info', $tutor_explain);
		return view('index/explain');
	}

	/**
	 * 自习室页面页面
	 */
	public function classroom() {

		if ($this->city) {
			$where[] = ['city', 'like', "$this->city%"];
		}

		$list = db('study_room')->where($where)->order('province desc,city desc,area desc')->select()->toArray();

		$this->view->assign('list', $list);
		return view('index/classroom');
	}

	/**
	 * 收费标准页面
	 */
	public function charges() {

		$type_list = db('type')->select()->toArray();

		foreach ($type_list as $k => $v) {

			//查询当前类目 下的 各种老师的 价格
			$price_list = db('course_price')->where('type_id', $v['type_id'])->select()->toArray();

			$type_list[$k]['price_list'] = $price_list;
		}

		$this->view->assign('list', $type_list);
		return view('index/charges');
	}

	/**
	 * 我的评价
	 */
	public function estimate() {
		if (request()->isPost()) {

			if (!$this->mid) {
				return json(['status' => 404, 'msg' => "登陆超时"]);
			}

			$limit = $this->request->param('limit', '10', 'intval');
			$page = $this->request->param('page', 1, 'intval');
			$teacher_id = $this->request->param('teacher_id', '', 'intval');

			if ($teacher_id) {
				$where[] = ['a.teacher_id', '=', $teacher_id];
			} else {
				$where[] = ['a.mid', '=', $this->mid];
			}

			$list = db('comment')->alias('a')
				->field('a.*,b.nickname,b.avatar,d.name as subject_name')
				->join('member b', 'a.mid=b.mid', 'left')
				->join('demand c', 'a.demand_id=c.demand_id', 'left')
				->join('subject d', 'c.subject_id=d.subject_id', 'left')
				->where($where)
				->where('a.sup_comment_id', 0)
				->order('a.stick_time desc,a.create_time desc')
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
		} else {
			return view('index/estimate');
		}

	}

	/**
	 * 我的消息
	 */
	public function message() {
		if (!$this->mid) {
			return json(['status' => 404, 'msg' => "登陆超时"]);
		}

		$member_info = db('member')->where('mid', $this->mid)->find();

		$where[] = ['class_id', '=', 2];

		$mid = $this->mid;

		$list = db('content')->where($where)->where("FIND_IN_SET($mid,mids) or mids is null")->order('create_time desc')->select()->toArray();

		foreach ($list as $k => $v) {
			$list[$k]['create_time'] = time_tran($list[$k]['create_time']);
			$list[$k]['detail'] = format_html($list[$k]['detail']);

			if (strpos($member_info['is_read'], ',' . $list[$k]['content_id'] . ',') === false) {
				$list[$k]['is_read'] = 0;
			} else {
				$list[$k]['is_read'] = 1;
			}

		}
		$this->view->assign('list', $list);
		return view('index/message');
	}

	/**
	 * 添加已读
	 */
	public function addIsRead() {
		if (!$this->mid) {
			return json(['status' => 404, 'msg' => "登陆超时"]);
		}

		$content_id = $this->request->param('content_id', '', 'intval');

		if (!$content_id) {
			return json(['status' => 404, 'msg' => "参数不完整!"]);
		}

		$member_info = db('member')->where('mid', $this->mid)->find();

		if (strpos($member_info['is_read'], ',' . $content_id . ',') === false) {

			if (!$member_info['is_read']) {
				$str = ',' . $content_id . ',';
			} else {
				$str = $member_info['is_read'] . $content_id . ',';
			}

			db('member')->where('mid', $this->mid)->update(['is_read' => $str]);
		}

		return json(['status' => 200, 'msg' => '添加成功']);
	}

	/**
	 *意见反馈
	 */
	public function feedback() {
		if (request()->isPost()) {

			if (!$this->mid) {
				return json(['status' => 404, 'msg' => "登陆超时"]);
			}

			$content = $this->request->param('content', '', '');
			$linkman = $this->request->param('linkman', '', '');
			$mobile = $this->request->param('mobile', '', '');

			if (!$content || !$linkman || !$mobile) {
				return json(['status' => 404, 'msg' => "参数不完整"]);
			}

			$ins['mid'] = $this->mid;
			$ins['content'] = $content;
			$ins['linkman'] = $linkman;
			$ins['mobile'] = $mobile;
			$ins['create_time'] = time();

			db('feedback')->insert($ins);

			return json(['status' => 200, 'msg' => '反馈成功']);
		} else {
			return view('index/feedback');
		}

	}

	/**
	 * 注销
	 */
	public function cancel() {
		if (request()->isPost()) {
			if (!$this->mid) {
				return json(['status' => 404, 'msg' => "登陆超时"]);
			}

			$content = $this->request->param('content', '', '');
			if ($content) {
				$ins['mid'] = $this->mid;
				$ins['content'] = $content;
				db('logout')->insert($ins);
			}

			db('member')->where('mid', $this->mid)->update(['status' => 0]);

			return json(['status' => 200, 'msg' => '注销成功']);
		} else {
			return view('index/cancel');
		}
	}

	/**
	 *我的收藏
	 */
	public function collect() {
		if (request()->isPost()) {
			if (!$this->mid) {
				return json(['status' => 404, 'msg' => "登陆超时"]);
			}

			$limit = $this->request->param('limit', '10', 'intval');
			$page = $this->request->param('page', 1, 'intval');

			$where[] = ['a.mid', '=', $this->mid];
			$list = db("collect")->alias('a')
				->field('b.*,c.nickname,c.avatar,c.login_time')
				->join('teacher b', 'a.teacher_id=b.teacher_id', 'left')
				->join('member c', 'b.mid=c.mid', 'left')
				->where($where)
				->order('a.create_time desc')
				->limit(($page - 1) * $limit, $limit)
				->select()->toArray();

			foreach ($list as $k => $v) {
				$list[$k]['name'] = getShortName($list[$k]['name']);
				$list[$k]['login_time'] = time_tran($list[$k]['login_time']);

				if (!$list[$k]['avatar']) {
					$list[$k]['avatar'] = request()->domain() . '/uploads/admin/202210/63590f7d93628.png';
				}

				if (!$list[$k]['head_img']) {
					$list[$k]['head_img'] = $list[$k]['avatar'];
				}

				$list[$k]['name'] = getShortName($list[$k]['name']);
				$list[$k]['gender_str'] = getGenderStr($list[$k]['gender']);
				$list[$k]['teacher_identity_str'] = getTeacherIdentityStr($list[$k]['teacher_identity']);
				$list[$k]['area'] = array_slice(explode(',', $v['area']), 0, 3);

				$subject_id = explode(',', $v['subject_id']);
				$where1 = [];
				$where1[] = ['subject_id', 'in', $subject_id];
				$list[$k]['subject_names'] = db('subject')->where($where1)->limit(3)->select()->toArray();
			}

			return json(['status' => 200, 'data' => $list]);

		} else {
			return view('index/collect');
		}

	}

	/**
	 * 添加或取消收藏
	 */
	public function addOrCancelCollect() {
		if (!$this->mid) {
			return json(['status' => 404, 'msg' => "登陆超时"]);
		}

		$teacher_id = $this->request->param('teacher_id', '', 'intval');

		$has = db("collect")->where('mid', $this->mid)->where('teacher_id', $teacher_id)->find();

		if (!$has) {
			$ins['mid'] = $this->mid;
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
	 *待上订单
	 */
	public function dsOrder() {
		if (request()->isPost()) {

			if (!$this->mid) {
				return json(['status' => 404, 'msg' => "登陆超时"]);
			}

			$limit = $this->request->param('limit', '10', 'intval');
			$page = $this->request->param('page', 1, 'intval');
			$status = $this->request->param('status', '', 'intval');

			$where[] = ['a.mid', '=', $this->mid];
			//待上订单
			$where[] = ['a.status', '=', 0];

			$list = db("demand")->alias('a')
				->field('a.*,c.nickname,c.avatar,c.login_time,d.name as subject_name')
				->join('member c', 'a.mid=c.mid', 'left')
				->join('subject d', 'a.subject_id=d.subject_id', 'left')
				->where($where)
				->order('a.create_time desc')
				->limit(($page - 1) * $limit, $limit)
				->select()->toArray();

			foreach ($list as $k => $v) {
				$list[$k]['login_time'] = time_tran($list[$k]['login_time']);
				//查看是否评论
				$list[$k]['is_pl'] = db('comment')->where('teacher_id', $v['teacher_id'])->where('demand_id', $v['demand_id'])->where('sup_comment_id', 0)->find();
				//查看是否追加
				$list[$k]['is_zp'] = db('comment')->where('sup_comment_id', $list[$k]['is_pl']['comment_id'])->find();

			}

			return json(['status' => 200, 'data' => $list]);

		} else {
			return view('index/ds_order');
		}

	}

	/**
	 *完成订单
	 */
	public function wcOrder() {
		if (request()->isPost()) {

			if (!$this->mid) {
				return json(['status' => 404, 'msg' => "登陆超时"]);
			}

			$limit = $this->request->param('limit', '10', 'intval');
			$page = $this->request->param('page', 1, 'intval');
			$status = $this->request->param('status', '', 'intval');

			$where[] = ['a.mid', '=', $this->mid];
			//完成订单
			$where[] = ['a.status', '=', 1];

			$list = db("demand")->alias('a')
				->field('a.*,c.nickname,c.avatar,c.login_time,d.name as subject_name')
				->join('member c', 'a.mid=c.mid', 'left')
				->join('subject d', 'a.subject_id=d.subject_id', 'left')
				->where($where)
				->order('a.create_time desc')
				->limit(($page - 1) * $limit, $limit)
				->select()->toArray();

			foreach ($list as $k => $v) {
				$list[$k]['login_time'] = time_tran($list[$k]['login_time']);
				//查看是否评论
				$list[$k]['is_pl'] = db('comment')->where('teacher_id', $v['teacher_id'])->where('demand_id', $v['demand_id'])->where('sup_comment_id', 0)->find();
				//查看是否追加
				$list[$k]['is_zp'] = db('comment')->where('sup_comment_id', $list[$k]['is_pl']['comment_id'])->find();

			}

			return json(['status' => 200, 'data' => $list]);
		} else {
			return view('index/wc_order');
		}

	}

	/**
	 *教员管理中心
	 */
	public function teacherCenter() {
		if (request()->isPost()) {

		} else {
			//教师信息
			$teacher_info = db('teacher')->where('mid', $this->mid)->find();
			$subject_id = explode(',', $teacher_info['subject_id']);
			$where1 = [];
			$where1[] = ['subject_id', 'in', $subject_id];
			$teacher_info['subject_names'] = db('subject')->where($where1)->select()->toArray();

			$this->view->assign('teacher_info', $teacher_info);

			return view('index/teacher_center');
		}

	}
	public function comment() {
		if (request()->isPost()) {

		} else {
            $demand_id = $this->request->param('demand_id', '', 'intval');
            $teacher_id = $this->request->param('teacher_id', '', 'intval');
            $sup_comment_id = $this->request->param('sup_comment_id', '', 'intval');

            $this->view->assign('demand_id', $demand_id);
            $this->view->assign('teacher_id', $teacher_id);
            $this->view->assign('sup_comment_id', $sup_comment_id);

            return view('index/comment');
		}

	}

}
