<?php 
/*
 module:		老师支付订单
 create_time:	2025-05-26 15:52:22
 author:		
 contact:		
*/

namespace app\admin\controller;

use app\admin\service\TeacherOrderService;
use app\admin\model\TeacherOrder as TeacherOrderModel;
use think\facade\Db;

class TeacherOrder extends Admin {


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
			$where['demand_id'] = $this->request->param('demand_id', '', 'serach_in');
			$where['teacher_id'] = $this->request->param('teacher_id', '', 'serach_in');

			$amount_start = $this->request->param('amount_start', '', 'serach_in');
			$amount_end = $this->request->param('amount_end', '', 'serach_in');

			$where['amount'] = ['between',[$amount_start,$amount_end]];
			$where['status'] = $this->request->param('status', '', 'serach_in');

			$create_time_start = $this->request->param('create_time_start', '', 'serach_in');
			$create_time_end = $this->request->param('create_time_end', '', 'serach_in');

			$where['create_time'] = ['between',[strtotime($create_time_start),strtotime($create_time_end)]];

			$pay_time_start = $this->request->param('pay_time_start', '', 'serach_in');
			$pay_time_end = $this->request->param('pay_time_end', '', 'serach_in');

			$where['pay_time'] = ['between',[strtotime($pay_time_start),strtotime($pay_time_end)]];

			$order  = $this->request->post('order', '', 'serach_in');	//排序字段 bootstrap-table 传入
			$sort  = $this->request->post('sort', '', 'serach_in');		//排序方式 desc 或 asc

			$field = 'teacher_order_id,sn,mid,demand_id,teacher_id,amount,status,create_time,pay_time';
			$orderby = ($sort && $order) ? $sort.' '.$order : 'teacher_order_id desc';

			$res = TeacherOrderService::indexList(formatWhere($where),$field,$orderby,$limit,$page);
			return json($res);
		}
	}

	/*修改*/
	function update(){
		if (!$this->request->isPost()){
			$teacher_order_id = $this->request->get('teacher_order_id','','serach_in');
			if(!$teacher_order_id) $this->error('参数错误');
			$this->view->assign('info',checkData(TeacherOrderModel::find($teacher_order_id)));
			return view('update');
		}else{
			$postField = 'teacher_order_id,sn,mid,demand_id,teacher_id,amount,status,create_time,pay_time';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = TeacherOrderService::update($data);
			return json(['status'=>'00','msg'=>'修改成功']);
		}
	}

	/*删除*/
	function delete(){
		$idx =  $this->request->post('teacher_order_id', '', 'serach_in');
		if(!$idx) $this->error('参数错误');
		try{
			TeacherOrderModel::destroy(['teacher_order_id'=>explode(',',$idx)],true);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return json(['status'=>'00','msg'=>'操作成功']);
	}

	/*查看详情*/
	function view(){
		$teacher_order_id = $this->request->get('teacher_order_id','','serach_in');
		if(!$teacher_order_id) $this->error('参数错误');
		$this->view->assign('info',TeacherOrderModel::find($teacher_order_id));
		return view('view');
	}



}

