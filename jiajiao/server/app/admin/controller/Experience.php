<?php 
/*
 module:		教学经历
 create_time:	2024-05-07 11:14:29
 author:		
 contact:		
*/

namespace app\admin\controller;

use app\admin\service\ExperienceService;
use app\admin\model\Experience as ExperienceModel;
use think\facade\Db;

class Experience extends Admin {


	/*首页数据列表*/
	function index(){
		if (!$this->request->isAjax()){
			return view('index');
		}else{
			$limit  = $this->request->post('limit', 20, 'intval');
			$offset = $this->request->post('offset', 0, 'intval');
			$page   = floor($offset / $limit) +1 ;

			$where = [];
			$where['teacher_id'] = $this->request->param('teacher_id', '', 'serach_in');

			$order  = $this->request->post('order', '', 'serach_in');	//排序字段 bootstrap-table 传入
			$sort  = $this->request->post('sort', '', 'serach_in');		//排序方式 desc 或 asc

			$field = 'experience_id,teacher_id,title,experience,start_time,end_time';
			$orderby = ($sort && $order) ? $sort.' '.$order : 'experience_id desc';

			$res = ExperienceService::indexList(formatWhere($where),$field,$orderby,$limit,$page);
			return json($res);
		}
	}



}

