<?php 
/*
 module:		类别
 create_time:	2022-10-13 20:13:15
 author:		
 contact:		
*/

namespace app\admin\controller;

use app\admin\service\TypeService;
use app\admin\model\Type as TypeModel;
use think\facade\Db;

class Type extends Admin {


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

			$order  = $this->request->post('order', '', 'serach_in');	//排序字段 bootstrap-table 传入
			$sort  = $this->request->post('sort', '', 'serach_in');		//排序方式 desc 或 asc

			$field = 'type_id,name';
			$orderby = ($sort && $order) ? $sort.' '.$order : 'type_id desc';

			$res = TypeService::indexList(formatWhere($where),$field,$orderby,$limit,$page);
			return json($res);
		}
	}

	/*添加*/
	function add(){
		if (!$this->request->isPost()){
			return view('add');
		}else{
			$postField = 'name';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = TypeService::add($data);
			return json(['status'=>'00','msg'=>'添加成功']);
		}
	}

	/*修改*/
	function update(){
		if (!$this->request->isPost()){
			$type_id = $this->request->get('type_id','','serach_in');
			if(!$type_id) $this->error('参数错误');
			$this->view->assign('info',checkData(TypeModel::find($type_id)));
			return view('update');
		}else{
			$postField = 'type_id,name';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = TypeService::update($data);
			return json(['status'=>'00','msg'=>'修改成功']);
		}
	}

	/*删除*/
	function delete(){
		$idx =  $this->request->post('type_id', '', 'serach_in');
		if(!$idx) $this->error('参数错误');
		try{
			TypeModel::destroy(['type_id'=>explode(',',$idx)],true);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return json(['status'=>'00','msg'=>'操作成功']);
	}



}

