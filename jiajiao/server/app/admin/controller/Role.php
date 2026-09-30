<?php 
/*
 module:		角色管理
 create_time:	2021-01-05 14:47:03
 author:		
 contact:		
*/

namespace app\admin\controller;

use app\admin\service\RoleService;
use app\admin\model\Role as RoleModel;
use think\facade\Db;

class Role extends Admin {


	/*首页数据列表*/
	function index(){
		if (!$this->request->isAjax()){
			return view('index');
		}else{
			$limit  = $this->request->post('limit', 20, 'intval');
			$offset = $this->request->post('offset', 0, 'intval');
			$page   = floor($offset / $limit) +1 ;

			$where = [];

			$order  = $this->request->post('order', '', 'serach_in');	//排序字段 bootstrap-table 传入
			$sort  = $this->request->post('sort', '', 'serach_in');		//排序方式 desc 或 asc

			$field = '*';
			$orderby = ($sort && $order) ? $sort.' '.$order : 'role_id desc';

			$res = RoleService::indexList(formatWhere($where),$field,$orderby,$limit,$page);
			$res['rows'] = formartList(['role_id', 'pid', 'name','name'],$res['rows']);
			return json($res);
		}
	}

	/*添加*/
	function add(){
		if (!$this->request->isPost()){
			return view('add');
		}else{
			$postField = 'pid,name,status,description';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = RoleService::add($data);
			return json(['status'=>'00','msg'=>'添加成功']);
		}
	}

	/*修改*/
	function update(){
		if (!$this->request->isPost()){
			$role_id = $this->request->get('role_id','','serach_in');
			if(!$role_id) $this->error('参数错误');
			$this->view->assign('info',checkData(RoleModel::find($role_id)));
			return view('update');
		}else{
			$postField = 'role_id,pid,name,status,description';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = RoleService::update($data);
			return json(['status'=>'00','msg'=>'修改成功']);
		}
	}

	/*修改状态*/
	function updateExt(){
		$postField = 'role_id,status';
		$data = $this->request->only(explode(',',$postField),'post',null);
		if(!$data['role_id']) $this->error('参数错误');
		try{
			RoleModel::update($data);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return json(['status'=>'00','msg'=>'操作成功']);
	}

	/*start*/
	/*删除*/
	function delete(){
		$idx =  $this->request->post('role_id', '', 'serach_in');
		if(!$idx) $this->error('参数错误');
		if($idx == 1) $this->error('该角色禁止删除');
		if(RoleModel::where('pid',$idx)->find()) $this->error('请先删除子角色');
		try{
			RoleModel::destroy(['role_id'=>explode(',',$idx)]);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return json(['status'=>'00','msg'=>'操作成功']);
	}
	/*end*/



}

