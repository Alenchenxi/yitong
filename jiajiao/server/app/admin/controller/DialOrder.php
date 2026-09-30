<?php 
/*
 module:		家长支付订单
 create_time:	2025-05-26 15:46:50
 author:		
 contact:		
*/

namespace app\admin\controller;

use app\admin\service\DialOrderService;
use app\admin\model\DialOrder as DialOrderModel;
use think\facade\Db;

class DialOrder extends Admin {


	/*首页数据列表*/
	function index(){
		if (!$this->request->isAjax()){
			return view('index');
		}else{
			$limit  = $this->request->post('limit', 20, 'intval');
			$offset = $this->request->post('offset', 0, 'intval');
			$page   = floor($offset / $limit) +1 ;

			$where = [];
			$where['sn'] = $this->request->param('sn', '', 'serach_in');
			$where['mid'] = $this->request->param('mid', '', 'serach_in');
			$where['dial_num'] = $this->request->param('dial_num', '', 'serach_in');

			$amount_start = $this->request->param('amount_start', '', 'serach_in');
			$amount_end = $this->request->param('amount_end', '', 'serach_in');

			$where['amount'] = ['between',[$amount_start,$amount_end]];

			$create_time_start = $this->request->param('create_time_start', '', 'serach_in');
			$create_time_end = $this->request->param('create_time_end', '', 'serach_in');

			$where['create_time'] = ['between',[strtotime($create_time_start),strtotime($create_time_end)]];

			$pay_time_start = $this->request->param('pay_time_start', '', 'serach_in');
			$pay_time_end = $this->request->param('pay_time_end', '', 'serach_in');

			$where['pay_time'] = ['between',[strtotime($pay_time_start),strtotime($pay_time_end)]];
			$where['status'] = $this->request->param('status', '', 'serach_in');

			$order  = $this->request->post('order', '', 'serach_in');	//排序字段 bootstrap-table 传入
			$sort  = $this->request->post('sort', '', 'serach_in');		//排序方式 desc 或 asc

			$field = 'dial_order_id,sn,mid,dial_num,amount,create_time,pay_time,status';
			$orderby = ($sort && $order) ? $sort.' '.$order : 'dial_order_id desc';

			$res = DialOrderService::indexList(formatWhere($where),$field,$orderby,$limit,$page);
			return json($res);
		}
	}

	/*修改*/
	function update(){
		if (!$this->request->isPost()){
			$dial_order_id = $this->request->get('dial_order_id','','serach_in');
			if(!$dial_order_id) $this->error('参数错误');
			$this->view->assign('info',checkData(DialOrderModel::find($dial_order_id)));
			return view('update');
		}else{
			$postField = 'dial_order_id,sn,mid,dial_num,amount,create_time,pay_time,status';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = DialOrderService::update($data);
			return json(['status'=>'00','msg'=>'修改成功']);
		}
	}

	/*删除*/
	function delete(){
		$idx =  $this->request->post('dial_order_id', '', 'serach_in');
		if(!$idx) $this->error('参数错误');
		try{
			DialOrderModel::destroy(['dial_order_id'=>explode(',',$idx)],true);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return json(['status'=>'00','msg'=>'操作成功']);
	}

	/*查看详情*/
	function view(){
		$dial_order_id = $this->request->get('dial_order_id','','serach_in');
		if(!$dial_order_id) $this->error('参数错误');
		$this->view->assign('info',DialOrderModel::find($dial_order_id));
		return view('view');
	}



}

