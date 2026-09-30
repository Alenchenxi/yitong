<?php 
/*
 module:		授教科目
 create_time:	2023-05-25 15:00:46
 author:		
 contact:		
*/

namespace app\admin\controller;

use app\admin\service\TeachingSubjectService;
use app\admin\model\TeachingSubject as TeachingSubjectModel;
use think\facade\Db;

class TeachingSubject extends Admin {


	/*首页数据列表*/
	function index(){
		if (!$this->request->isAjax()){
			return view('index');
		}else{
			$limit  = $this->request->post('limit', 20, 'intval');
			$offset = $this->request->post('offset', 0, 'intval');
			$page   = floor($offset / $limit) +1 ;

			$where = [];
			$where['teacher_id'] = $this->request->param('teacher_id', '', 'serach_in');

			$order  = $this->request->post('order', '', 'serach_in');	//排序字段 bootstrap-table 传入
			$sort  = $this->request->post('sort', '', 'serach_in');		//排序方式 desc 或 asc

			$field = 'teaching_subject_id,category_id,category_name,grade_id,grade_name,subject_id,subject_name,is_main,teacher_id,price';
			$orderby = ($sort && $order) ? $sort.' '.$order : 'teaching_subject_id desc';

			$res = TeachingSubjectService::indexList(formatWhere($where),$field,$orderby,$limit,$page);
			return json($res);
		}
	}

    /*start*/
	/*修改*/
	function update(){
		if (!$this->request->isPost()){
			$teaching_subject_id = $this->request->get('teaching_subject_id','','serach_in');
			if(!$teaching_subject_id) $this->error('参数错误');
			$this->view->assign('info',checkData(TeachingSubjectModel::find($teaching_subject_id)));
			return view('update');
		}else{
			$postField = 'teaching_subject_id,category_id,grade_id,subject_id,is_main,price';
			$data = $this->request->only(explode(',',$postField),'post',null);

            $category_info = db('category')->where('category_id', $data['category_id'])->find();
            $grade_info = db('grade')->where('grade_id', $data['grade_id'])->find();
            $subject_info = db('subject')->where('subject_id', $data['subject_id'])->find();

            $data['category_name'] = $category_info['name'];
            $data['grade_name'] = $grade_info['name'];
            $data['subject_name'] = $subject_info['name'];

			$res = TeachingSubjectService::update($data);
			return json(['status'=>'00','msg'=>'修改成功']);
		}
	}
    /*end*/

	/*删除*/
	function delete(){
		$idx =  $this->request->post('teaching_subject_id', '', 'serach_in');
		if(!$idx) $this->error('参数错误');
		try{
			TeachingSubjectModel::destroy(['teaching_subject_id'=>explode(',',$idx)],true);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return json(['status'=>'00','msg'=>'操作成功']);
	}



}

