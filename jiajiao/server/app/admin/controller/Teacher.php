<?php
/*
module:		教员列表
create_time:	2024-06-24 09:09:12
author:
contact:
 */

namespace app\admin\controller;

use app\admin\model\Teacher as TeacherModel;
use app\admin\service\DemandViewRecordService;
use app\admin\service\TeacherService;
use think\facade\Db;

class Teacher extends Admin {

	/*添加*/
	function add() {
		if (!$this->request->isPost()) {
			return view('add');
		} else {
			$postField = 'mobile,wechat,nickname,name,id_number,gender,age,id_card_zheng,id_card_fan,student_card_img,diploma_img,itic_img,head_img,teaching_age,school,school_start_time,school_end_time,education,specialty,teacher_identity,teaching_way,province,city,area,experience,successful_case_title,successful_case,honor,honor_img,teacher_title,teacher_title_img,label,photos,works,collect_num,teach_num,yuyue_num,avg_score,is_hide,status,is_on_off,offline_num,cause,longitude,latitude,qrcode,poster,star_level,min_hour,chsi_img,mail,introduction,birthplace';
			$data = $this->request->only(explode(',', $postField), 'post', null);
			$res = TeacherService::add($data);
			return json(['status' => '00', 'msg' => '添加成功']);
		}
	}

	/*修改*/
	function update() {
		if (!$this->request->isPost()) {
			$teacher_id = $this->request->get('teacher_id', '', 'serach_in');
			if (!$teacher_id) {
				$this->error('参数错误');
			}

			$this->view->assign('info', checkData(TeacherModel::find($teacher_id)));
			return view('update');
		} else {
			$postField = 'teacher_id,mobile,wechat,nickname,name,id_number,gender,age,id_card_zheng,id_card_fan,student_card_img,diploma_img,itic_img,head_img,teaching_age,school,school_start_time,school_end_time,education,specialty,teacher_identity,teaching_way,province,city,area,experience,successful_case_title,successful_case,honor,honor_img,teacher_title,teacher_title_img,label,photos,works,collect_num,teach_num,yuyue_num,avg_score,is_hide,status,is_on_off,offline_num,cause,longitude,latitude,qrcode,poster,star_level,min_hour,chsi_img,mail,introduction,birthplace';
			$data = $this->request->only(explode(',', $postField), 'post', null);
			$res = TeacherService::update($data);
			return json(['status' => '00', 'msg' => '修改成功']);
		}
	}

	/*删除*/
	function delete() {
		$idx = $this->request->post('teacher_id', '', 'serach_in');
		if (!$idx) {
			$this->error('参数错误');
		}

		try {
			TeacherModel::destroy(['teacher_id' => explode(',', $idx)], true);
		} catch (\Exception $e) {
			abort(config('my.error_log_code'), $e->getMessage());
		}
		return json(['status' => '00', 'msg' => '操作成功']);
	}

	/*查看详情*/
	function view() {
		$teacher_id = $this->request->get('teacher_id', '', 'serach_in');
		if (!$teacher_id) {
			$this->error('参数错误');
		}

		$this->view->assign('info', TeacherModel::find($teacher_id));
		return view('view');
	}

	/*start*/
	/*首页数据列表*/
	function index() {
		if (!$this->request->isAjax()) {
			return view('index');
		} else {
			$limit = $this->request->post('limit', 20, 'intval');
			$offset = $this->request->post('offset', 0, 'intval');
			$page = floor($offset / $limit) + 1;

			$where = [];
			$where['a.teacher_id'] = $this->request->param('teacher_id', '', 'serach_in');
			$where['a.specialty'] = ['like', $this->request->param('specialty', '', 'serach_in')];
			$where['a.school'] = ['like', $this->request->param('school', '', 'serach_in')];
			$where['a.mobile'] = ['like', $this->request->param('mobile', '', 'serach_in')];
			$where['a.wechat'] = ['like', $this->request->param('wechat', '', 'serach_in')];
			$where['a.nickname'] = ['like', $this->request->param('nickname', '', 'serach_in')];
			$where['a.birthplace'] = ['like', $this->request->param('birthplace', '', 'serach_in')];
			$where['a.name'] = ['like', $this->request->param('name_s', '', 'serach_in')];
			$where['a.gender'] = $this->request->param('gender', '', 'serach_in');
			$where['a.education'] = $this->request->param('education', '', 'serach_in');
			$where['a.teacher_identity'] = $this->request->param('teacher_identity', '', 'serach_in');
			$where['a.category_id'] = $this->request->param('category_id', '', 'serach_in');

			$where['a.grade_id'] = ['find in set', $this->request->param('grade_id', '', 'serach_in')];
			$where['a.subject_id'] = $this->request->param('subject_id', '', 'serach_in');
			$where['a.is_hide'] = $this->request->param('is_hide', '', 'serach_in');
			$where['a.status'] = $this->request->param('status', '', 'serach_in');
			$where['a.is_on_off'] = $this->request->param('is_on_off', '', 'serach_in');
			$where['a.star_level'] = $this->request->param('star_level', '', 'serach_in');
			$where['a.province'] = mb_substr($this->request->param('province', '', 'serach_in'), 0, -1);
			$where['a.city'] = $this->request->param('city', '', 'serach_in');
			$where['a.area'] = $this->request->param('area', '', 'serach_in');

			$order = $this->request->post('order', '', 'serach_in'); //排序字段 bootstrap-table 传入
			$sort = $this->request->post('sort', '', 'serach_in'); //排序方式 desc 或 asc

			$field = '';
			$orderby = ($sort && $order) ? $sort . ' ' . $order : 'teacher_id desc';

			//$sql = 'select a.* from cd_teacher a left join cd_teaching_subject b on a.teacher_id=b.teacher_id group by a.teacher_id';
			$sql = 'select a.* from cd_teacher a';
			$limit = ($page - 1) * $limit . ',' . $limit;
			$res = \xhadmin\CommonService::loadList($sql, formatWhere($where), $limit, $orderby);
			return json($res);
		}
	}

	/*刷新*/
	function refreshTeacher() {
		$idx = $this->request->post('teacher_id', '', 'serach_in');
		if (!$idx) {
			$this->error('参数错误');
		}

		try {
			$day_ref_info = db('day_refresh')->where('teacher_id', $idx)->where('date', date('Y-m-d'))->find();
			if ($day_ref_info) {
				return json(['status' => 404, 'msg' => '您今日已刷新,不能再次刷新']);
			}

			db("teacher")->where('teacher_id', $idx)->update(['refresh_time' => time()]);

			$ins['date'] = date('Y-m-d');
			$ins['mid'] = request()->uid;
			$ins['teacher_id'] = $idx;
			//添加 今日刷新记录
			db('day_refresh')->insert($ins);

		} catch (\Exception $e) {
			abort(config('my.error_log_code'), $e->getMessage());
		}
		return json(['status' => '00', 'msg' => '刷新成功']);
	}

	//获取年级列表
	public function getGradeList() {
		$category_id = $this->request->post('category_id', '', 'intval');

		if (!$category_id) {
			return json(['status' => 404, 'data' => '请先选择分类']);
		}

		$list = db('grade')->where('category_id', $category_id)->select()->toArray();
		return json(['status' => '00', 'data' => $list]);
	}

	//获取课程列表
	public function getSubjectList() {
		$grade_id = $this->request->post('grade_id', '', 'intval');

		if (!$grade_id) {
			return json(['status' => 404, 'data' => '请先选择年级']);
		}

		$list = db('subject')->where('grade_id', $grade_id)->select()->toArray();
		return json(['status' => '00', 'data' => $list]);
	}

	/*end*/

	public function browseHistory(){
        $teacher_id = $this->request->param('teacher_id', '', 'intval');
        $pageNum = $this->request->param('page_num', 1, 'intval');
        $pageSize = $this->request->param('page_size', 10, 'intval');
		$teacher_info = db('teacher')->where('teacher_id', $teacher_id)->find();
		if (!$teacher_info) {
			$this->error('参数错误');
            $this->view->assign('info',[]);
            return view('browseHistory');
		}
		$where[] = ['mid', '=', $teacher_info['mid']];
        $data = DemandViewRecordService::getUserDemandHistoryPage($where, $pageNum, $pageSize);
        $this->view->assign('info',$data);
        return view('browseHistory');
    }
}
