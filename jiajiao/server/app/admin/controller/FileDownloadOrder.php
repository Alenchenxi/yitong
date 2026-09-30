<?php 
/*
 module:		文件下载支付订单
 create_time:	2023-03-17 10:48:45
 author:		
 contact:		
*/

namespace app\admin\controller;

use app\admin\service\FileDownloadOrderService;
use app\admin\model\FileDownloadOrder as FileDownloadOrderModel;
use think\facade\Db;

class FileDownloadOrder extends Admin {


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
			$where['status'] = $this->request->param('status', '', 'serach_in');

			$order  = $this->request->post('order', '', 'serach_in');	//排序字段 bootstrap-table 传入
			$sort  = $this->request->post('sort', '', 'serach_in');		//排序方式 desc 或 asc

			$field = 'file_download_order_id,sn,mid,file_download_id,amount,create_time,status,pay_time';
			$orderby = ($sort && $order) ? $sort.' '.$order : 'file_download_order_id desc';

			$res = FileDownloadOrderService::indexList(formatWhere($where),$field,$orderby,$limit,$page);
			return json($res);
		}
	}



}

