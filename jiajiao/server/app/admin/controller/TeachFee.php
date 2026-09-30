<?php 
/*
 module:		任教费用设置
 create_time:	2022-10-29 12:12:11
 author:		
 contact:		
*/

namespace app\admin\controller;

use app\admin\service\TeachFeeService;
use app\admin\model\TeachFee as TeachFeeModel;
use think\facade\Db;

class TeachFee extends Admin {


	/*首页数据列表*/
	function index(){
		if (!$this->request->isAjax()){
			return view('index');
		}else{
			$limit  = $this->request->post('limit', 20, 'intval');
			$offset = $this->request->post('offset', 0, 'intval');
			$page   = floor($offset / $limit) +1 ;

			$where = [];
			$where['fee_set'] = $this->request->param('fee_set', '', 'serach_in');

			$order  = $this->request->post('order', '', 'serach_in');	//排序字段 bootstrap-table 传入
			$sort  = $this->request->post('sort', '', 'serach_in');		//排序方式 desc 或 asc

			$field = 'teach_fee_id,fee_set';
			$orderby = ($sort && $order) ? $sort.' '.$order : 'teach_fee_id desc';

			$res = TeachFeeService::indexList(formatWhere($where),$field,$orderby,$limit,$page);
			return json($res);
		}
	}

	/*添加*/
	function add(){
		if (!$this->request->isPost()){
			return view('add');
		}else{
			$postField = 'fee_set';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = TeachFeeService::add($data);
			return json(['status'=>'00','msg'=>'添加成功']);
		}
	}

	/*修改*/
	function update(){
		if (!$this->request->isPost()){
			$teach_fee_id = $this->request->get('teach_fee_id','','serach_in');
			if(!$teach_fee_id) $this->error('参数错误');
			$this->view->assign('info',checkData(TeachFeeModel::find($teach_fee_id)));
			return view('update');
		}else{
			$postField = 'teach_fee_id,fee_set';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = TeachFeeService::update($data);
			return json(['status'=>'00','msg'=>'修改成功']);
		}
	}

	/*删除*/
	function delete(){
		$idx =  $this->request->post('teach_fee_id', '', 'serach_in');
		if(!$idx) $this->error('参数错误');
		try{
			TeachFeeModel::destroy(['teach_fee_id'=>explode(',',$idx)],true);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return json(['status'=>'00','msg'=>'操作成功']);
	}



}

