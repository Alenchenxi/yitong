<?php 
/*
 module:		日志管理
 create_time:	2021-01-05 14:47:06
 author:		
 contact:		
*/

namespace app\admin\controller;

use app\admin\service\LogService;
use app\admin\model\Log as LogModel;
use think\facade\Db;

class Log extends Admin {


	/*首页数据列表*/
	function index(){
		if (!$this->request->isAjax()){
			return view('index');
		}else{
			$limit  = $this->request->post('limit', 20, 'intval');
			$offset = $this->request->post('offset', 0, 'intval');
			$page   = floor($offset / $limit) +1 ;

			$where = [];
			$where['application_name'] = $this->request->param('application_name', '', 'serach_in');
			$where['username'] = $this->request->param('username', '', 'serach_in');
			$where['url'] = $this->request->param('url', '', 'serach_in');
			$where['ip'] = $this->request->param('ip', '', 'serach_in');
			$where['type'] = $this->request->param('type', '', 'serach_in');

			$create_time_start = $this->request->param('create_time_start', '', 'serach_in');
			$create_time_end = $this->request->param('create_time_end', '', 'serach_in');

			$where['create_time'] = ['between',[strtotime($create_time_start),strtotime($create_time_end)]];

			$order  = $this->request->post('order', '', 'serach_in');	//排序字段 bootstrap-table 传入
			$sort  = $this->request->post('sort', '', 'serach_in');		//排序方式 desc 或 asc

			$field = 'id,application_name,username,url,ip,type,create_time';
			$orderby = ($sort && $order) ? $sort.' '.$order : 'id desc';

			$res = LogService::indexList(formatWhere($where),$field,$orderby,$limit,$page);
			return json($res);
		}
	}

	/*删除*/
	function delete(){
		$idx =  $this->request->post('id', '', 'serach_in');
		if(!$idx) $this->error('参数错误');
		try{
			LogModel::destroy(['id'=>explode(',',$idx)],true);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return json(['status'=>'00','msg'=>'操作成功']);
	}

	/*查看详情*/
	function view(){
		$id = $this->request->get('id','','serach_in');
		if(!$id) $this->error('参数错误');
		$this->view->assign('info',LogModel::find($id));
		return view('view');
	}

	/*导出*/
	function dumpData(){
		$where = [];
		$where['application_name'] = $this->request->param('application_name', '', 'serach_in');
		$where['username'] = $this->request->param('username', '', 'serach_in');
		$where['url'] = $this->request->param('url', '', 'serach_in');
		$where['ip'] = $this->request->param('ip', '', 'serach_in');
		$where['type'] = $this->request->param('type', '', 'serach_in');

		$create_time_start = $this->request->param('create_time_start', '', 'serach_in');
		$create_time_end = $this->request->param('create_time_end', '', 'serach_in');

		$where['create_time'] = ['between',[strtotime($create_time_start),strtotime($create_time_end)]];
		$where['id'] = ['in',$this->request->param('id', '', 'serach_in')];

		try {
			//此处读取前端传过来的 表格勾选的显示字段
			$fieldInfo = [];
			for($j=0; $j<100;$j++){
				$fieldInfo[] = $this->request->param($j);
			}
			$list = LogModel::where(formatWhere($where))->order('id desc')->select();
			if(empty($list)) throw new Exception('没有数据');
			LogService::dumpData(htmlOutList($list),filterEmptyArray(array_unique($fieldInfo)));
		} catch (\Exception $e) {
			$this->error($e->getMessage());
		}
	}



}

