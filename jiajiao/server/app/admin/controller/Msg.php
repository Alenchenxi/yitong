<?php 
/*
 module:		消息列表
 create_time:	2023-04-03 16:18:35
 author:		
 contact:		
*/

namespace app\admin\controller;

use app\admin\service\MsgService;
use app\admin\model\Msg as MsgModel;
use think\facade\Db;

class Msg extends Admin {


	/*首页数据列表*/
	function index(){
		if (!$this->request->isAjax()){
			return view('index');
		}else{
			$limit  = $this->request->post('limit', 20, 'intval');
			$offset = $this->request->post('offset', 0, 'intval');
			$page   = floor($offset / $limit) +1 ;

			$where = [];
			$where['title'] = ['like',$this->request->param('title', '', 'serach_in')];
			$where['status'] = $this->request->param('status', '', 'serach_in');
			$where['type'] = $this->request->param('type', '', 'serach_in');

			$order  = $this->request->post('order', '', 'serach_in');	//排序字段 bootstrap-table 传入
			$sort  = $this->request->post('sort', '', 'serach_in');		//排序方式 desc 或 asc

			$field = 'msg_id,mid,title,content,create_time,order_id,num,status,type';
			$orderby = ($sort && $order) ? $sort.' '.$order : 'msg_id desc';

			$res = MsgService::indexList(formatWhere($where),$field,$orderby,$limit,$page);
			return json($res);
		}
	}



}

