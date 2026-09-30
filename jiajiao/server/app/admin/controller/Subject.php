<?php 
/*
 module:		科目管理
 create_time:	2023-03-01 09:44:40
 author:		
 contact:		
*/

namespace app\admin\controller;

use app\admin\service\SubjectService;
use app\admin\model\Subject as SubjectModel;
use think\facade\Db;

class Subject extends Admin {


	/*首页数据列表*/
	function index(){
		if (!$this->request->isAjax()){
			return view('index');
		}else{
			$limit  = $this->request->post('limit', 20, 'intval');
			$offset = $this->request->post('offset', 0, 'intval');
			$page   = floor($offset / $limit) +1 ;

			$where = [];
			$where['a.name'] = ['like',$this->request->param('name_s', '', 'serach_in')];
			$where['a.grade_id'] = $this->request->param('grade_id', '', 'serach_in');

			$order  = $this->request->post('order', '', 'serach_in');	//排序字段 bootstrap-table 传入
			$sort  = $this->request->post('sort', '', 'serach_in');		//排序方式 desc 或 asc

			$field = '';
			$orderby = ($sort && $order) ? $sort.' '.$order : 'zsort desc,subject_id desc';

			$sql = 'select a.*,b.name as grade_name from cd_subject a left join cd_grade b on a.grade_id=b.grade_id';
			$limit = ($page-1) * $limit.','.$limit;
			$res = \xhadmin\CommonService::loadList($sql,formatWhere($where),$limit,$orderby);
			return json($res);
		}
	}

	/*修改排序开关按钮操作*/
	function updateExt(){
		$postField = 'subject_id,zsort';
		$data = $this->request->only(explode(',',$postField),'post',null);
		if(!$data['subject_id']) $this->error('参数错误');
		try{
			SubjectModel::update($data);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return json(['status'=>'00','msg'=>'操作成功']);
	}

	/*添加*/
	function add(){
		if (!$this->request->isPost()){
			return view('add');
		}else{
			$postField = 'name,grade_id,price,hours,zsort';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = SubjectService::add($data);
			if($res && empty($data['zsort'])){
				SubjectModel::update(['zsort'=>$res,'subject_id'=>$res]);
			}
			return json(['status'=>'00','msg'=>'添加成功']);
		}
	}

	/*修改*/
	function update(){
		if (!$this->request->isPost()){
			$subject_id = $this->request->get('subject_id','','serach_in');
			if(!$subject_id) $this->error('参数错误');
			$this->view->assign('info',checkData(SubjectModel::find($subject_id)));
			return view('update');
		}else{
			$postField = 'subject_id,name,grade_id,price,hours,zsort';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = SubjectService::update($data);
			return json(['status'=>'00','msg'=>'修改成功']);
		}
	}

	/*删除*/
	function delete(){
		$idx =  $this->request->post('subject_id', '', 'serach_in');
		if(!$idx) $this->error('参数错误');
		try{
			SubjectModel::destroy(['subject_id'=>explode(',',$idx)],true);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return json(['status'=>'00','msg'=>'操作成功']);
	}

	/*箭头排序*/
	function arrowsort(){
		$postField = 'subject_id,sortid,type';
		$data = $this->request->only(explode(',',$postField),'post',null);
		if(empty($data['sortid'])){
			$this->error('操作失败，当前数据没有排序号');
		}
		if($data['type'] == 1){
			$where['zsort'] = ['>',$data['sortid']];
			$info = SubjectModel::where(formatWhere($where))->order('zsort asc')->find();
		}else{
			$where['zsort'] = ['<',$data['sortid']];
			$info = SubjectModel::where(formatWhere($where))->order('zsort desc')->find();
		}
		if(empty($info['zsort'])){
			$this->error('操作失败，目标位置没有排序号');
		}
		if($info){
			try{
				SubjectModel::update(['subject_id'=>$data['subject_id'],'zsort'=>$info['zsort']]);
				SubjectModel::update(['subject_id'=>$info['subject_id'],'zsort'=>$data['sortid']]);
			}catch(\Exception $e){
				throw new \think\exception\ValidateException ($e->getMessage());
			}
		}else{
			$this->error('目标位置没有数据');
		}
		return json(['status'=>'00','msg'=>'操作成功']);
	}



}

