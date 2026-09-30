<?php 
/*
 module:		消费记录
 create_time:	2021-04-08 15:27:06
 author:		
 contact:		
*/

namespace app\admin\controller;

use app\admin\service\ExpenseService;
use app\admin\model\Expense as ExpenseModel;
use think\facade\Db;

class Expense extends Admin {


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

			$amount_start = $this->request->param('amount_start', '', 'serach_in');
			$amount_end = $this->request->param('amount_end', '', 'serach_in');

			$where['amount'] = ['between',[$amount_start,$amount_end]];

			$createtime_start = $this->request->param('createtime_start', '', 'serach_in');
			$createtime_end = $this->request->param('createtime_end', '', 'serach_in');

			$where['createtime'] = ['between',[strtotime($createtime_start),strtotime($createtime_end)]];

			$order  = $this->request->post('order', '', 'serach_in');	//排序字段 bootstrap-table 传入
			$sort  = $this->request->post('sort', '', 'serach_in');		//排序方式 desc 或 asc

			$field = 'id,mid,amount,createtime';
			$orderby = ($sort && $order) ? $sort.' '.$order : 'id desc';

			$res = ExpenseService::indexList(formatWhere($where),$field,$orderby,$limit,$page);
			return json($res);
		}
	}

	/*删除*/
	function delete(){
		$idx =  $this->request->post('id', '', 'serach_in');
		if(!$idx) $this->error('参数错误');
		try{
			ExpenseModel::destroy(['id'=>explode(',',$idx)],true);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return json(['status'=>'00','msg'=>'操作成功']);
	}

	/*查看详情*/
	function view(){
		$id = $this->request->get('id','','serach_in');
		if(!$id) $this->error('参数错误');
		$this->view->assign('info',ExpenseModel::find($id));
		return view('view');
	}



}

