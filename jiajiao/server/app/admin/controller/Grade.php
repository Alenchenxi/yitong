<?php 
/*
 module:		年级管理
 create_time:	2023-03-01 09:45:30
 author:		
 contact:		
*/

namespace app\admin\controller;

use app\admin\service\GradeService;
use app\admin\model\Grade as GradeModel;
use think\facade\Db;

class Grade extends Admin {


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
			$where['a.category_id'] = $this->request->param('category_id', '', 'serach_in');

			$order  = $this->request->post('order', '', 'serach_in');	//排序字段 bootstrap-table 传入
			$sort  = $this->request->post('sort', '', 'serach_in');		//排序方式 desc 或 asc

			$field = '';
			$orderby = ($sort && $order) ? $sort.' '.$order : 'zsort desc,grade_id desc';

			$sql = 'select a.*,b.name as category_name  from cd_grade a left join cd_category b on a.category_id=b.category_id';
			$limit = ($page-1) * $limit.','.$limit;
			$res = \xhadmin\CommonService::loadList($sql,formatWhere($where),$limit,$orderby);
			return json($res);
		}
	}

	/*修改排序开关按钮操作*/
	function updateExt(){
		$postField = 'grade_id,zsort';
		$data = $this->request->only(explode(',',$postField),'post',null);
		if(!$data['grade_id']) $this->error('参数错误');
		try{
			GradeModel::update($data);
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
			$postField = 'name,zsort,category_id';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = GradeService::add($data);
			if($res && empty($data['zsort'])){
				GradeModel::update(['zsort'=>$res,'grade_id'=>$res]);
			}
			return json(['status'=>'00','msg'=>'添加成功']);
		}
	}

	/*修改*/
	function update(){
		if (!$this->request->isPost()){
			$grade_id = $this->request->get('grade_id','','serach_in');
			if(!$grade_id) $this->error('参数错误');
			$this->view->assign('info',checkData(GradeModel::find($grade_id)));
			return view('update');
		}else{
			$postField = 'grade_id,name,zsort,category_id';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = GradeService::update($data);
			return json(['status'=>'00','msg'=>'修改成功']);
		}
	}

	/*删除*/
	function delete(){
		$idx =  $this->request->post('grade_id', '', 'serach_in');
		if(!$idx) $this->error('参数错误');
		try{
			GradeModel::destroy(['grade_id'=>explode(',',$idx)],true);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return json(['status'=>'00','msg'=>'操作成功']);
	}

	/*箭头排序*/
	function arrowsort(){
		$postField = 'grade_id,sortid,type';
		$data = $this->request->only(explode(',',$postField),'post',null);
		if(empty($data['sortid'])){
			$this->error('操作失败，当前数据没有排序号');
		}
		if($data['type'] == 1){
			$where['zsort'] = ['>',$data['sortid']];
			$info = GradeModel::where(formatWhere($where))->order('zsort asc')->find();
		}else{
			$where['zsort'] = ['<',$data['sortid']];
			$info = GradeModel::where(formatWhere($where))->order('zsort desc')->find();
		}
		if(empty($info['zsort'])){
			$this->error('操作失败，目标位置没有排序号');
		}
		if($info){
			try{
				GradeModel::update(['grade_id'=>$data['grade_id'],'zsort'=>$info['zsort']]);
				GradeModel::update(['grade_id'=>$info['grade_id'],'zsort'=>$data['sortid']]);
			}catch(\Exception $e){
				throw new \think\exception\ValidateException ($e->getMessage());
			}
		}else{
			$this->error('目标位置没有数据');
		}
		return json(['status'=>'00','msg'=>'操作成功']);
	}



}

