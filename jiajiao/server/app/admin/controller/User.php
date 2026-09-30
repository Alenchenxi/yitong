<?php 
/*
 module:		用户管理
 create_time:	2021-01-05 14:47:00
 author:		
 contact:		
*/

namespace app\admin\controller;

use app\admin\service\UserService;
use app\admin\model\User as UserModel;
use think\facade\Db;

class User extends Admin {


	/*首页数据列表*/
	function index(){
		if (!$this->request->isAjax()){
			return view('index');
		}else{
			$limit  = $this->request->post('limit', 20, 'intval');
			$offset = $this->request->post('offset', 0, 'intval');
			$page   = floor($offset / $limit) +1 ;

			$where = [];
			$where['a.user'] = $this->request->param('user', '', 'serach_in');

			$where['a.role_id'] = ['find in set',$this->request->param('role_id', '', 'serach_in')];
			$where['a.status'] = $this->request->param('status', '', 'serach_in');

			$order  = $this->request->post('order', '', 'serach_in');	//排序字段 bootstrap-table 传入
			$sort  = $this->request->post('sort', '', 'serach_in');		//排序方式 desc 或 asc

			$field = '';
			$orderby = ($sort && $order) ? $sort.' '.$order : 'user_id desc';

			$sql = 'select a.*,group_concat(b.name) as role_name from pre_user as a left join pre_role as b on find_in_set(b.role_id,a.role_id)  group by a.user_id';
			$limit = ($page-1) * $limit.','.$limit;
			$res = \xhadmin\CommonService::loadList($sql,formatWhere($where),$limit,$orderby);
			return json($res);
		}
	}

	/*添加*/
	function add(){
		if (!$this->request->isPost()){
			return view('add');
		}else{
			$postField = 'name,user,pwd,role_id,note,status,create_time';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = UserService::add($data);
			return json(['status'=>'00','msg'=>'添加成功']);
		}
	}

	/*修改*/
	function update(){
		if (!$this->request->isPost()){
			$user_id = $this->request->get('user_id','','serach_in');
			if(!$user_id) $this->error('参数错误');
			$this->view->assign('info',checkData(UserModel::find($user_id)));
			return view('update');
		}else{
			$postField = 'user_id,name,user,role_id,note,status,create_time';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = UserService::update($data);
			return json(['status'=>'00','msg'=>'修改成功']);
		}
	}

	/*修改密码*/
	function updatePassword(){
		if (!$this->request->isPost()){
			$info['user_id'] = $this->request->get('user_id','','serach_in');
			return view('updatePassword',['info'=>$info]);
		}else{
			$postField = 'user_id,pwd';
			$data = $this->request->only(explode(',',$postField),'post',null);
			if(empty($data['user_id'])) $this->error('参数错误');
			UserService::updatePassword($data);
			return json(['status'=>'00','msg'=>'操作成功']);
		}
	}

	/*修改状态*/
	function updateExt(){
		$postField = 'user_id,status';
		$data = $this->request->only(explode(',',$postField),'post',null);
		if(!$data['user_id']) $this->error('参数错误');
		try{
			UserModel::update($data);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return json(['status'=>'00','msg'=>'操作成功']);
	}

	/*start*/
	/*删除*/
	function delete(){
		$idx =  $this->request->post('user_id', '', 'serach_in');
		if(!$idx) $this->error('参数错误');
		if(in_array('1',explode(',',$idx))){
			$this->error('该用户禁止删除');
		}
		UserModel::destroy(['user_id'=>explode(',',$idx)]);
		return json(['status'=>'00','msg'=>'操作成功']);
	}
	/*end*/



}

