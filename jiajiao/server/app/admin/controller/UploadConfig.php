<?php 
/*
 module:		上传配置
 create_time:	2021-01-05 14:47:09
 author:		
 contact:		
*/

namespace app\admin\controller;

use app\admin\service\UploadConfigService;
use app\admin\model\UploadConfig as UploadConfigModel;
use think\facade\Db;

class UploadConfig extends Admin {


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
			$where['thumb_type'] = $this->request->param('thumb_type', '', 'serach_in');

			$order  = $this->request->post('order', '', 'serach_in');	//排序字段 bootstrap-table 传入
			$sort  = $this->request->post('sort', '', 'serach_in');		//排序方式 desc 或 asc

			$field = 'id,title,thumb_status,upload_replace,thumb_width,thumb_height,thumb_type';
			$orderby = ($sort && $order) ? $sort.' '.$order : 'id desc';

			$res = UploadConfigService::indexList(formatWhere($where),$field,$orderby,$limit,$page);
			return json($res);
		}
	}

	/*修改排序开关按钮操作*/
	function updateExt(){
		$postField = 'id,thumb_status,upload_replace';
		$data = $this->request->only(explode(',',$postField),'post',null);
		if(!$data['id']) $this->error('参数错误');
		try{
			UploadConfigModel::update($data);
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
			$postField = 'title,upload_replace,thumb_status,thumb_width,thumb_height,thumb_type';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = UploadConfigService::add($data);
			return json(['status'=>'00','msg'=>'添加成功']);
		}
	}

	/*修改*/
	function update(){
		if (!$this->request->isPost()){
			$id = $this->request->get('id','','serach_in');
			if(!$id) $this->error('参数错误');
			$this->view->assign('info',checkData(UploadConfigModel::find($id)));
			return view('update');
		}else{
			$postField = 'id,title,upload_replace,thumb_status,thumb_width,thumb_height,thumb_type';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = UploadConfigService::update($data);
			return json(['status'=>'00','msg'=>'修改成功']);
		}
	}

	/*删除*/
	function delete(){
		$idx =  $this->request->post('id', '', 'serach_in');
		if(!$idx) $this->error('参数错误');
		try{
			UploadConfigModel::destroy(['id'=>explode(',',$idx)],true);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return json(['status'=>'00','msg'=>'操作成功']);
	}



}

