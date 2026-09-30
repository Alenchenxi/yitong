<?php 
/*
 module:		公告
 create_time:	2023-05-17 14:51:42
 author:		
 contact:		
*/

namespace app\admin\controller;

use app\admin\service\NoticeService;
use app\admin\model\Notice as NoticeModel;
use think\facade\Db;

class Notice extends Admin {


	/*首页数据列表*/
	function index(){
		if (!$this->request->isAjax()){
			return view('index');
		}else{
			$limit  = $this->request->post('limit', 20, 'intval');
			$offset = $this->request->post('offset', 0, 'intval');
			$page   = floor($offset / $limit) +1 ;

			$where = [];

			$order  = $this->request->post('order', '', 'serach_in');	//排序字段 bootstrap-table 传入
			$sort  = $this->request->post('sort', '', 'serach_in');		//排序方式 desc 或 asc

			$field = 'notice_id,content';
			$orderby = ($sort && $order) ? $sort.' '.$order : 'notice_id desc';

			$res = NoticeService::indexList(formatWhere($where),$field,$orderby,$limit,$page);
			return json($res);
		}
	}

	/*添加*/
	function add(){
		if (!$this->request->isPost()){
			return view('add');
		}else{
			$postField = 'content';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = NoticeService::add($data);
			return json(['status'=>'00','msg'=>'添加成功']);
		}
	}

	/*修改*/
	function update(){
		if (!$this->request->isPost()){
			$notice_id = $this->request->get('notice_id','','serach_in');
			if(!$notice_id) $this->error('参数错误');
			$this->view->assign('info',checkData(NoticeModel::find($notice_id)));
			return view('update');
		}else{
			$postField = 'notice_id,content';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = NoticeService::update($data);
			return json(['status'=>'00','msg'=>'修改成功']);
		}
	}

	/*删除*/
	function delete(){
		$idx =  $this->request->post('notice_id', '', 'serach_in');
		if(!$idx) $this->error('参数错误');
		try{
			NoticeModel::destroy(['notice_id'=>explode(',',$idx)],true);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return json(['status'=>'00','msg'=>'操作成功']);
	}



}

