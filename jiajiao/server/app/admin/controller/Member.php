<?php 
/*
 module:		会员列表
 create_time:	2025-05-26 15:55:40
 author:		
 contact:		
*/

namespace app\admin\controller;

use app\admin\service\MemberService;
use app\admin\model\Member as MemberModel;
use think\facade\Db;

class Member extends Admin {


	/*首页数据列表*/
	function index(){
		if (!$this->request->isAjax()){
			return view('index');
		}else{
			$limit  = $this->request->post('limit', 20, 'intval');
			$offset = $this->request->post('offset', 0, 'intval');
			$page   = floor($offset / $limit) +1 ;

			$where = [];
			$where['nickname'] = $this->request->param('nickname', '', 'serach_in');
			$where['mobile'] = $this->request->param('mobile', '', 'serach_in');
			$where['gender'] = $this->request->param('gender', '', 'serach_in');

			$amount_start = $this->request->param('amount_start', '', 'serach_in');
			$amount_end = $this->request->param('amount_end', '', 'serach_in');

			$where['amount'] = ['between',[$amount_start,$amount_end]];

			$create_time_start = $this->request->param('create_time_start', '', 'serach_in');
			$create_time_end = $this->request->param('create_time_end', '', 'serach_in');

			$where['create_time'] = ['between',[strtotime($create_time_start),strtotime($create_time_end)]];
			$where['status'] = $this->request->param('status', '', 'serach_in');
			$where['groupid'] = $this->request->param('groupid', '', 'serach_in');
			$where['dial_num'] = $this->request->param('dial_num', '', 'serach_in');

			$order  = $this->request->post('order', '', 'serach_in');	//排序字段 bootstrap-table 传入
			$sort  = $this->request->post('sort', '', 'serach_in');		//排序方式 desc 或 asc

			$field = 'mid,nickname,avatar,mobile,gender,amount,create_time,status,groupid,dial_num';
			$orderby = ($sort && $order) ? $sort.' '.$order : 'mid desc';

			$res = MemberService::indexList(formatWhere($where),$field,$orderby,$limit,$page);
			return json($res);
		}
	}

	/*修改排序开关按钮操作*/
	function updateExt(){
		$postField = 'mid,status';
		$data = $this->request->only(explode(',',$postField),'post',null);
		if(!$data['mid']) $this->error('参数错误');
		try{
			MemberModel::update($data);
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
			$postField = 'nickname,avatar,mobile,gender,createtime,status,amount,groupid,openid,withdrawn_amount,login_time,is_read,dy_openid,bd_openid,dial_num';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = MemberService::add($data);
			return json(['status'=>'00','msg'=>'添加成功']);
		}
	}

	/*修改*/
	function update(){
		if (!$this->request->isPost()){
			$mid = $this->request->get('mid','','serach_in');
			if(!$mid) $this->error('参数错误');
			$this->view->assign('info',checkData(MemberModel::find($mid)));
			return view('update');
		}else{
			$postField = 'mid,nickname,avatar,mobile,gender,createtime,status,amount,groupid,openid,withdrawn_amount,login_time,is_read,dy_openid,bd_openid,dial_num';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = MemberService::update($data);
			return json(['status'=>'00','msg'=>'修改成功']);
		}
	}

	/*删除*/
	function delete(){
		$idx =  $this->request->post('mid', '', 'serach_in');
		if(!$idx) $this->error('参数错误');
		try{
			MemberModel::destroy(['mid'=>explode(',',$idx)],true);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return json(['status'=>'00','msg'=>'操作成功']);
	}

	/*查看详情*/
	function view(){
		$mid = $this->request->get('mid','','serach_in');
		if(!$mid) $this->error('参数错误');
		$this->view->assign('info',MemberModel::find($mid));
		return view('view');
	}



}

