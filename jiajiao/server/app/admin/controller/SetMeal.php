<?php 
/*
 module:		套餐
 create_time:	2022-11-03 09:23:40
 author:		
 contact:		
*/

namespace app\admin\controller;

use app\admin\service\SetMealService;
use app\admin\model\SetMeal as SetMealModel;
use think\facade\Db;

class SetMeal extends Admin {


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

			$field = 'set_meal_id,name,stick_days,give_days,price';
			$orderby = ($sort && $order) ? $sort.' '.$order : 'set_meal_id desc';

			$res = SetMealService::indexList(formatWhere($where),$field,$orderby,$limit,$page);
			return json($res);
		}
	}

	/*添加*/
	function add(){
		if (!$this->request->isPost()){
			return view('add');
		}else{
			$postField = 'stick_days,give_days,price,name';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = SetMealService::add($data);
			return json(['status'=>'00','msg'=>'添加成功']);
		}
	}

	/*修改*/
	function update(){
		if (!$this->request->isPost()){
			$set_meal_id = $this->request->get('set_meal_id','','serach_in');
			if(!$set_meal_id) $this->error('参数错误');
			$this->view->assign('info',checkData(SetMealModel::find($set_meal_id)));
			return view('update');
		}else{
			$postField = 'set_meal_id,stick_days,give_days,price,name';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = SetMealService::update($data);
			return json(['status'=>'00','msg'=>'修改成功']);
		}
	}

	/*删除*/
	function delete(){
		$idx =  $this->request->post('set_meal_id', '', 'serach_in');
		if(!$idx) $this->error('参数错误');
		try{
			SetMealModel::destroy(['set_meal_id'=>explode(',',$idx)],true);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return json(['status'=>'00','msg'=>'操作成功']);
	}



}

