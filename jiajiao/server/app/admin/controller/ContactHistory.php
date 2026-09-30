<?php 
/*
 module:		家长联系记录
 create_time:	2025-05-26 17:38:28
 author:		
 contact:		
*/

namespace app\admin\controller;

use app\admin\service\ContactHistoryService;
use app\admin\model\ContactHistory as ContactHistoryModel;
use think\facade\Db;

class ContactHistory extends Admin {


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
			$where['teacher_id'] = $this->request->param('teacher_id', '', 'serach_in');

			$create_time_start = $this->request->param('create_time_start', '', 'serach_in');
			$create_time_end = $this->request->param('create_time_end', '', 'serach_in');

			$where['create_time'] = ['between',[strtotime($create_time_start),strtotime($create_time_end)]];

			$order  = $this->request->post('order', '', 'serach_in');	//排序字段 bootstrap-table 传入
			$sort  = $this->request->post('sort', '', 'serach_in');		//排序方式 desc 或 asc

			$field = 'contact_history_id,mid,teacher_id,create_time';
			$orderby = ($sort && $order) ? $sort.' '.$order : 'contact_history_id desc';

			$res = ContactHistoryService::indexList(formatWhere($where),$field,$orderby,$limit,$page);
			return json($res);
		}
	}

	/*删除*/
	function delete(){
		$idx =  $this->request->post('contact_history_id', '', 'serach_in');
		if(!$idx) $this->error('参数错误');
		try{
			ContactHistoryModel::destroy(['contact_history_id'=>explode(',',$idx)],true);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return json(['status'=>'00','msg'=>'操作成功']);
	}

	/*查看详情*/
	function view(){
		$contact_history_id = $this->request->get('contact_history_id','','serach_in');
		if(!$contact_history_id) $this->error('参数错误');
		$this->view->assign('info',ContactHistoryModel::find($contact_history_id));
		return view('view');
	}



}

