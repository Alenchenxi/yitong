<?php 
/*
 module:		充值记录
 create_time:	2021-04-08 15:10:41
 author:		
 contact:		
*/

namespace app\admin\controller;

use app\admin\service\RechargeService;
use app\admin\model\Recharge as RechargeModel;
use think\facade\Db;

class Recharge extends Admin {


	/*首页数据列表*/
	function index(){
		if (!$this->request->isAjax()){
			return view('index');
		}else{
			$limit  = $this->request->post('limit', 20, 'intval');
			$offset = $this->request->post('offset', 0, 'intval');
			$page   = floor($offset / $limit) +1 ;

			$where = [];
			$where['mid'] = $this->request->param('mid', '', 'serach_in');
			$where['amount'] = $this->request->param('amount', '', 'serach_in');
			$where['sn'] = $this->request->param('sn', '', 'serach_in');

			$createtime_start = $this->request->param('createtime_start', '', 'serach_in');
			$createtime_end = $this->request->param('createtime_end', '', 'serach_in');

			$where['createtime'] = ['between',[strtotime($createtime_start),strtotime($createtime_end)]];
			$where['status'] = $this->request->param('status', '', 'serach_in');

			$order  = $this->request->post('order', '', 'serach_in');	//排序字段 bootstrap-table 传入
			$sort  = $this->request->post('sort', '', 'serach_in');		//排序方式 desc 或 asc

			$field = 'id,mid,amount,sn,createtime,status,paytime';
			$orderby = ($sort && $order) ? $sort.' '.$order : 'id desc';

			$res = RechargeService::indexList(formatWhere($where),$field,$orderby,$limit,$page);
			return json($res);
		}
	}

	/*删除*/
	function delete(){
		$idx =  $this->request->post('id', '', 'serach_in');
		if(!$idx) $this->error('参数错误');
		try{
			RechargeModel::destroy(['id'=>explode(',',$idx)],true);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return json(['status'=>'00','msg'=>'操作成功']);
	}

	/*查看详情*/
	function view(){
		$id = $this->request->get('id','','serach_in');
		if(!$id) $this->error('参数错误');
		$this->view->assign('info',RechargeModel::find($id));
		return view('view');
	}



}

