<?php 
/*
 module:		套餐订单
 create_time:	2022-11-03 09:27:14
 author:		
 contact:		
*/

namespace app\admin\controller;

use app\admin\service\TcOrderService;
use app\admin\model\TcOrder as TcOrderModel;
use think\facade\Db;

class TcOrder extends Admin {


    /*start*/
	/*首页数据列表*/
	function index(){
		if (!$this->request->isAjax()){
			return view('index');
		}else{
			$limit  = $this->request->post('limit', 20, 'intval');
			$offset = $this->request->post('offset', 0, 'intval');
			$page   = floor($offset / $limit) +1 ;

			$where = [];
			$where['a.sn'] = $this->request->param('sn', '', 'serach_in');
			$where['a.teacher_id'] = $this->request->param('teacher_id', '', 'serach_in');
			$where['a.status'] = $this->request->param('status', '', 'serach_in');

			$create_time_start = $this->request->param('create_time_start', '', 'serach_in');
			$create_time_end = $this->request->param('create_time_end', '', 'serach_in');

			$where['a.create_time'] = ['between',[strtotime($create_time_start),strtotime($create_time_end)]];

			$pay_time_start = $this->request->param('pay_time_start', '', 'serach_in');
			$pay_time_end = $this->request->param('pay_time_end', '', 'serach_in');

			$where['a.pay_time'] = ['between',[strtotime($pay_time_start),strtotime($pay_time_end)]];

			$order  = $this->request->post('order', '', 'serach_in');	//排序字段 bootstrap-table 传入
			$sort  = $this->request->post('sort', '', 'serach_in');		//排序方式 desc 或 asc

			$field = '';
			$orderby = ($sort && $order) ? $sort.' '.$order : 'tc_order_id desc';

			$sql = 'select a.*,b.nickname,c.name as set_meal_name from cd_tc_order a left join cd_member b on a.mid=b.mid left join cd_set_meal c on a.set_meal_id=c.set_meal_id';
			$limit = ($page-1) * $limit.','.$limit;
			$res = \xhadmin\CommonService::loadList($sql,formatWhere($where),$limit,$orderby);

            $key_num = count($res['rows']);
            $total_amount = db('tc_order')->alias('a')->where(formatWhere($where))->sum('amount');

            $res['rows'][$key_num]['sn'] = '总计';
            $res['rows'][$key_num]['mid'] = '';
            $res['rows'][$key_num]['nickname'] = '';
            $res['rows'][$key_num]['teacher_id'] = '';
            $res['rows'][$key_num]['set_meal_id'] = '';
            $res['rows'][$key_num]['set_meal_name'] = '';
            $res['rows'][$key_num]['amount'] = $total_amount;
            $res['rows'][$key_num]['status'] = '';
            $res['rows'][$key_num]['create_time'] = '';
            $res['rows'][$key_num]['pay_time'] = '';
			return json($res);
		}
	}
    /*end*/


}

