<?php 
/*
 module:		钱包交易明细
 create_time:	2022-09-21 11:18:14
 author:		
 contact:		
*/

namespace app\admin\controller;

use app\admin\service\WalletService;
use app\admin\model\Wallet as WalletModel;
use think\facade\Db;

class Wallet extends Admin {


	/*首页数据列表*/
	function index(){
		if (!$this->request->isAjax()){
			return view('index');
		}else{
			$limit  = $this->request->post('limit', 20, 'intval');
			$offset = $this->request->post('offset', 0, 'intval');
			$page   = floor($offset / $limit) +1 ;

			$where = [];
			$where['a.sn'] = ['like',$this->request->param('sn', '', 'serach_in')];
			$where['a.type'] = $this->request->param('type', '', 'serach_in');

			$create_time_start = $this->request->param('create_time_start', '', 'serach_in');
			$create_time_end = $this->request->param('create_time_end', '', 'serach_in');

			$where['a.create_time'] = ['between',[strtotime($create_time_start),strtotime($create_time_end)]];

			$order  = $this->request->post('order', '', 'serach_in');	//排序字段 bootstrap-table 传入
			$sort  = $this->request->post('sort', '', 'serach_in');		//排序方式 desc 或 asc

			$field = '';
			$orderby = ($sort && $order) ? $sort.' '.$order : 'wallet_id desc';

			$sql = 'select a.*,b.nickname from cd_wallet a left join cd_member b on a.mid=b.mid';
			$limit = ($page-1) * $limit.','.$limit;
			$res = \xhadmin\CommonService::loadList($sql,formatWhere($where),$limit,$orderby);
			return json($res);
		}
	}



}

