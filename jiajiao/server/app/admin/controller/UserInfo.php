<?php 
/*
 module:		信息收集
 create_time:	2023-03-23 10:14:26
 author:		
 contact:		
*/

namespace app\admin\controller;

use app\admin\service\UserInfoService;
use app\admin\model\UserInfo as UserInfoModel;
use think\facade\Db;

class UserInfo extends Admin {


	/*首页数据列表*/
	function index(){
		if (!$this->request->isAjax()){
			return view('index');
		}else{
			$limit  = $this->request->post('limit', 20, 'intval');
			$offset = $this->request->post('offset', 0, 'intval');
			$page   = floor($offset / $limit) +1 ;

			$where = [];
			$where['name'] = ['like',$this->request->param('name_s', '', 'serach_in')];
			$where['mobile'] = ['like',$this->request->param('mobile', '', 'serach_in')];

			$order  = $this->request->post('order', '', 'serach_in');	//排序字段 bootstrap-table 传入
			$sort  = $this->request->post('sort', '', 'serach_in');		//排序方式 desc 或 asc

			$field = 'user_info_id,name,mobile,category_id,grade_id,subject_id,subject_name,create_time';
			$orderby = ($sort && $order) ? $sort.' '.$order : 'user_info_id desc';

			$res = UserInfoService::indexList(formatWhere($where),$field,$orderby,$limit,$page);
			return json($res);
		}
	}



}

