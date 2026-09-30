<?php 
/*
 module:		老师下线记录
 create_time:	2022-11-03 11:09:28
 author:		
 contact:		
*/

namespace app\admin\controller;

use app\admin\service\OfflineService;
use app\admin\model\Offline as OfflineModel;
use think\facade\Db;

class Offline extends Admin {


	/*首页数据列表*/
	function index(){
		if (!$this->request->isAjax()){
			return view('index');
		}else{
			$limit  = $this->request->post('limit', 20, 'intval');
			$offset = $this->request->post('offset', 0, 'intval');
			$page   = floor($offset / $limit) +1 ;

			$where = [];
			$where['a.teacher_id'] = $this->request->param('teacher_id', '', 'serach_in');
			$where['a.teacher_name'] = $this->request->param('teacher_name', '', 'serach_in');

			$create_time_start = $this->request->param('create_time_start', '', 'serach_in');
			$create_time_end = $this->request->param('create_time_end', '', 'serach_in');

			$where['a.create_time'] = ['between',[strtotime($create_time_start),strtotime($create_time_end)]];

			$order  = $this->request->post('order', '', 'serach_in');	//排序字段 bootstrap-table 传入
			$sort  = $this->request->post('sort', '', 'serach_in');		//排序方式 desc 或 asc

			$field = '';
			$orderby = ($sort && $order) ? $sort.' '.$order : 'offline_id desc';

			$sql = 'select a.*,b.mobile from cd_offline a left join cd_teacher b on a.teacher_id=b.teacher_id';
			$limit = ($page-1) * $limit.','.$limit;
			$res = \xhadmin\CommonService::loadList($sql,formatWhere($where),$limit,$orderby);
			return json($res);
		}
	}



}

