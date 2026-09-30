<?php 
/*
 module:		上课时间
 create_time:	2023-05-20 09:59:09
 author:		
 contact:		
*/

namespace app\admin\controller;

use app\admin\service\SchooltimeService;
use app\admin\model\Schooltime as SchooltimeModel;
use think\facade\Db;

class Schooltime extends Admin {


	/*首页数据列表*/
	function index(){
		if (!$this->request->isAjax()){
			return view('index');
		}else{
			$limit  = $this->request->post('limit', 20, 'intval');
			$offset = $this->request->post('offset', 0, 'intval');
			$page   = floor($offset / $limit) +1 ;

			$where = [];
			$where['demand_id'] = $this->request->param('demand_id', '', 'serach_in');
			$where['teacher_id'] = $this->request->param('teacher_id', '', 'serach_in');
			$where['order_id'] = $this->request->param('order_id', '', 'serach_in');

			$order  = $this->request->post('order', '', 'serach_in');	//排序字段 bootstrap-table 传入
			$sort  = $this->request->post('sort', '', 'serach_in');		//排序方式 desc 或 asc

			$field = 'schooltime_id,week,start_time,end_time,demand_id,teacher_id,order_id';
			$orderby = ($sort && $order) ? $sort.' '.$order : 'schooltime_id desc';

			$res = SchooltimeService::indexList(formatWhere($where),$field,$orderby,$limit,$page);
			return json($res);
		}
	}

	/*修改*/
	function update(){
		if (!$this->request->isPost()){
			$schooltime_id = $this->request->get('schooltime_id','','serach_in');
			if(!$schooltime_id) $this->error('参数错误');
			$this->view->assign('info',checkData(SchooltimeModel::find($schooltime_id)));
			return view('update');
		}else{
			$postField = 'schooltime_id,week,start_time,end_time';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = SchooltimeService::update($data);
			return json(['status'=>'00','msg'=>'修改成功']);
		}
	}

	/*删除*/
	function delete(){
		$idx =  $this->request->post('schooltime_id', '', 'serach_in');
		if(!$idx) $this->error('参数错误');
		try{
			SchooltimeModel::destroy(['schooltime_id'=>explode(',',$idx)],true);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return json(['status'=>'00','msg'=>'操作成功']);
	}



}

