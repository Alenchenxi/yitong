<?php 
/*
 module:		我的评价
 create_time:	2022-10-24 17:37:32
 author:		
 contact:		
*/

namespace app\admin\controller;

use app\admin\service\CommentService;
use app\admin\model\Comment as CommentModel;
use think\facade\Db;

class Comment extends Admin {


	/*首页数据列表*/
	function index(){
		if (!$this->request->isAjax()){
			return view('index');
		}else{
			$limit  = $this->request->post('limit', 20, 'intval');
			$offset = $this->request->post('offset', 0, 'intval');
			$page   = floor($offset / $limit) +1 ;

			$where = [];
			$where['attitude'] = $this->request->param('attitude', '', 'serach_in');
			$where['level'] = $this->request->param('level', '', 'serach_in');

			$create_time_start = $this->request->param('create_time_start', '', 'serach_in');
			$create_time_end = $this->request->param('create_time_end', '', 'serach_in');

			$where['create_time'] = ['between',[strtotime($create_time_start),strtotime($create_time_end)]];

			$order  = $this->request->post('order', '', 'serach_in');	//排序字段 bootstrap-table 传入
			$sort  = $this->request->post('sort', '', 'serach_in');		//排序方式 desc 或 asc

			$field = 'comment_id,mid,teacher_id,attitude,level,content,pics,create_time,sup_comment_id,order_id,demand_id';
			$orderby = ($sort && $order) ? $sort.' '.$order : 'comment_id desc';

			$res = CommentService::indexList(formatWhere($where),$field,$orderby,$limit,$page);
			return json($res);
		}
	}

	/*添加*/
	function add(){
		if (!$this->request->isPost()){
			return view('add');
		}else{
			$postField = 'teacher_id,mid,content,pics,create_time,sup_comment_id,attitude,level,stick_time,order_id,demand_id';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = CommentService::add($data);
			return json(['status'=>'00','msg'=>'添加成功']);
		}
	}

	/*修改*/
	function update(){
		if (!$this->request->isPost()){
			$comment_id = $this->request->get('comment_id','','serach_in');
			if(!$comment_id) $this->error('参数错误');
			$this->view->assign('info',checkData(CommentModel::find($comment_id)));
			return view('update');
		}else{
			$postField = 'comment_id,teacher_id,mid,content,pics,create_time,sup_comment_id,attitude,level,stick_time,order_id,demand_id';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = CommentService::update($data);
			return json(['status'=>'00','msg'=>'修改成功']);
		}
	}

	/*删除*/
	function delete(){
		$idx =  $this->request->post('comment_id', '', 'serach_in');
		if(!$idx) $this->error('参数错误');
		try{
			CommentModel::destroy(['comment_id'=>explode(',',$idx)],true);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return json(['status'=>'00','msg'=>'操作成功']);
	}



}

