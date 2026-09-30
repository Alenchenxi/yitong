<?php 
/*
 module:		注销原因
 create_time:	2022-10-19 17:54:30
 author:		
 contact:		
*/

namespace app\admin\controller;

use app\admin\service\LogoutService;
use app\admin\model\Logout as LogoutModel;
use think\facade\Db;

class Logout extends Admin {


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

			$field = 'logout_id,content,mid';
			$orderby = ($sort && $order) ? $sort.' '.$order : 'logout_id desc';

			$res = LogoutService::indexList(formatWhere($where),$field,$orderby,$limit,$page);
			return json($res);
		}
	}



}

