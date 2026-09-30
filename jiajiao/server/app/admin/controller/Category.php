<?php 
/*
 module:		类别管理
 create_time:	2023-03-01 15:00:51
 author:		
 contact:		
*/

namespace app\admin\controller;

use app\admin\service\CategoryService;
use app\admin\model\Category as CategoryModel;
use think\facade\Db;

class Category extends Admin {


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

			$field = 'category_id,name,zsort';
			$orderby = ($sort && $order) ? $sort.' '.$order : 'zsort desc,category_id desc';

			$res = CategoryService::indexList(formatWhere($where),$field,$orderby,$limit,$page);
			return json($res);
		}
	}

	/*修改排序开关按钮操作*/
	function updateExt(){
		$postField = 'category_id,zsort';
		$data = $this->request->only(explode(',',$postField),'post',null);
		if(!$data['category_id']) $this->error('参数错误');
		try{
			CategoryModel::update($data);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return json(['status'=>'00','msg'=>'操作成功']);
	}

	/*添加*/
	function add(){
		if (!$this->request->isPost()){
			return view('add');
		}else{
			$postField = 'name,zsort';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = CategoryService::add($data);
			if($res && empty($data['zsort'])){
				CategoryModel::update(['zsort'=>$res,'category_id'=>$res]);
			}
			return json(['status'=>'00','msg'=>'添加成功']);
		}
	}

	/*修改*/
	function update(){
		if (!$this->request->isPost()){
			$category_id = $this->request->get('category_id','','serach_in');
			if(!$category_id) $this->error('参数错误');
			$this->view->assign('info',checkData(CategoryModel::find($category_id)));
			return view('update');
		}else{
			$postField = 'category_id,name,zsort';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = CategoryService::update($data);
			return json(['status'=>'00','msg'=>'修改成功']);
		}
	}

	/*删除*/
	function delete(){
		$idx =  $this->request->post('category_id', '', 'serach_in');
		if(!$idx) $this->error('参数错误');
		try{
			CategoryModel::destroy(['category_id'=>explode(',',$idx)],true);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return json(['status'=>'00','msg'=>'操作成功']);
	}

	/*箭头排序*/
	function arrowsort(){
		$postField = 'category_id,sortid,type';
		$data = $this->request->only(explode(',',$postField),'post',null);
		if(empty($data['sortid'])){
			$this->error('操作失败，当前数据没有排序号');
		}
		if($data['type'] == 1){
			$where['zsort'] = ['>',$data['sortid']];
			$info = CategoryModel::where(formatWhere($where))->order('zsort asc')->find();
		}else{
			$where['zsort'] = ['<',$data['sortid']];
			$info = CategoryModel::where(formatWhere($where))->order('zsort desc')->find();
		}
		if(empty($info['zsort'])){
			$this->error('操作失败，目标位置没有排序号');
		}
		if($info){
			try{
				CategoryModel::update(['category_id'=>$data['category_id'],'zsort'=>$info['zsort']]);
				CategoryModel::update(['category_id'=>$info['category_id'],'zsort'=>$data['sortid']]);
			}catch(\Exception $e){
				throw new \think\exception\ValidateException ($e->getMessage());
			}
		}else{
			$this->error('目标位置没有数据');
		}
		return json(['status'=>'00','msg'=>'操作成功']);
	}



}

