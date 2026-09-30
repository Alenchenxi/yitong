<?php 
/*
 module:		短信记录
 create_time:	2022-09-21 11:25:41
 author:		
 contact:		
*/

namespace app\admin\controller;

use app\admin\service\SmsService;
use app\admin\model\Sms as SmsModel;
use think\facade\Db;

class Sms extends Admin {


	/*首页数据列表*/
	function index(){
		if (!$this->request->isAjax()){
			return view('index');
		}else{
			$limit  = $this->request->post('limit', 20, 'intval');
			$offset = $this->request->post('offset', 0, 'intval');
			$page   = floor($offset / $limit) +1 ;

			$where = [];
			$where['mobile'] = ['like',$this->request->param('mobile', '', 'serach_in')];
			$where['mail'] = ['like',$this->request->param('mail', '', 'serach_in')];

			$create_time_start = $this->request->param('create_time_start', '', 'serach_in');
			$create_time_end = $this->request->param('create_time_end', '', 'serach_in');

			$where['create_time'] = ['between',[strtotime($create_time_start),strtotime($create_time_end)]];
			$where['type'] = $this->request->param('type', '', 'serach_in');

			$order  = $this->request->post('order', '', 'serach_in');	//排序字段 bootstrap-table 传入
			$sort  = $this->request->post('sort', '', 'serach_in');		//排序方式 desc 或 asc

			$field = 'id,mobile,mail,code,create_time,reason,type';
			$orderby = ($sort && $order) ? $sort.' '.$order : 'id desc';

			$res = SmsService::indexList(formatWhere($where),$field,$orderby,$limit,$page);
			return json($res);
		}
	}



}

