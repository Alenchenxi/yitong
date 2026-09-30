<?php 
/*
 module:		轮播图片
 create_time:	2023-03-23 10:39:26
 author:		
 contact:		
*/

namespace app\admin\controller;

use app\admin\service\SlideService;
use app\admin\model\Slide as SlideModel;
use think\facade\Db;

class Slide extends Admin {


	/*首页数据列表*/
	function index(){
		if (!$this->request->isAjax()){
			return view('index');
		}else{
			$limit  = $this->request->post('limit', 20, 'intval');
			$offset = $this->request->post('offset', 0, 'intval');
			$page   = floor($offset / $limit) +1 ;

			$where = [];
			$where['title'] = $this->request->param('title', '', 'serach_in');
			$where['status'] = $this->request->param('status', '', 'serach_in');
			$where['type'] = $this->request->param('type', '', 'serach_in');

			$order  = $this->request->post('order', '', 'serach_in');	//排序字段 bootstrap-table 传入
			$sort  = $this->request->post('sort', '', 'serach_in');		//排序方式 desc 或 asc

			$field = 'id,title,pic,status,type';
			$orderby = ($sort && $order) ? $sort.' '.$order : 'id desc';

			$res = SlideService::indexList(formatWhere($where),$field,$orderby,$limit,$page);
			return json($res);
		}
	}

	/*修改排序开关按钮操作*/
	function updateExt(){
		$postField = 'id,status';
		$data = $this->request->only(explode(',',$postField),'post',null);
		if(!$data['id']) $this->error('参数错误');
		try{
			SlideModel::update($data);
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
			$postField = 'title,pic,url,status,type,detail';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = SlideService::add($data);
			return json(['status'=>'00','msg'=>'添加成功']);
		}
	}

	/*修改*/
	function update(){
		if (!$this->request->isPost()){
			$id = $this->request->get('id','','serach_in');
			if(!$id) $this->error('参数错误');
			$this->view->assign('info',checkData(SlideModel::find($id)));
			return view('update');
		}else{
			$postField = 'id,title,pic,url,status,type,detail';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = SlideService::update($data);
			return json(['status'=>'00','msg'=>'修改成功']);
		}
	}

	/*删除*/
	function delete(){
		$idx =  $this->request->post('id', '', 'serach_in');
		if(!$idx) $this->error('参数错误');
		try{
			SlideModel::destroy(['id'=>explode(',',$idx)],true);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return json(['status'=>'00','msg'=>'操作成功']);
	}

	/*查看详情*/
	function view(){
		$id = $this->request->get('id','','serach_in');
		if(!$id) $this->error('参数错误');
		$this->view->assign('info',SlideModel::find($id));
		return view('view');
	}



}

