<?php 
/*
 module:		意见反馈
 create_time:	2023-03-15 11:41:58
 author:		
 contact:		
*/

namespace app\admin\controller;

use app\admin\service\FeedbackService;
use app\admin\model\Feedback as FeedbackModel;
use think\facade\Db;

class Feedback extends Admin {


	/*首页数据列表*/
	function index(){
		if (!$this->request->isAjax()){
			return view('index');
		}else{
			$limit  = $this->request->post('limit', 20, 'intval');
			$offset = $this->request->post('offset', 0, 'intval');
			$page   = floor($offset / $limit) +1 ;

			$where = [];

			$create_time_start = $this->request->param('create_time_start', '', 'serach_in');
			$create_time_end = $this->request->param('create_time_end', '', 'serach_in');

			$where['create_time'] = ['between',[strtotime($create_time_start),strtotime($create_time_end)]];

			$order  = $this->request->post('order', '', 'serach_in');	//排序字段 bootstrap-table 传入
			$sort  = $this->request->post('sort', '', 'serach_in');		//排序方式 desc 或 asc

			$field = 'feedback_id,mid,content,img,create_time';
			$orderby = ($sort && $order) ? $sort.' '.$order : 'feedback_id desc';

			$res = FeedbackService::indexList(formatWhere($where),$field,$orderby,$limit,$page);
			return json($res);
		}
	}

	/*添加*/
	function add(){
		if (!$this->request->isPost()){
			return view('add');
		}else{
			$postField = 'mid,content,linkman,mobile,create_time,img';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = FeedbackService::add($data);
			return json(['status'=>'00','msg'=>'添加成功']);
		}
	}

	/*修改*/
	function update(){
		if (!$this->request->isPost()){
			$feedback_id = $this->request->get('feedback_id','','serach_in');
			if(!$feedback_id) $this->error('参数错误');
			$this->view->assign('info',checkData(FeedbackModel::find($feedback_id)));
			return view('update');
		}else{
			$postField = 'feedback_id,mid,content,linkman,mobile,create_time,img';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = FeedbackService::update($data);
			return json(['status'=>'00','msg'=>'修改成功']);
		}
	}

	/*删除*/
	function delete(){
		$idx =  $this->request->post('feedback_id', '', 'serach_in');
		if(!$idx) $this->error('参数错误');
		try{
			FeedbackModel::destroy(['feedback_id'=>explode(',',$idx)],true);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return json(['status'=>'00','msg'=>'操作成功']);
	}



}

