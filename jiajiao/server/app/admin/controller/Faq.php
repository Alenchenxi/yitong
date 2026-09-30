<?php 
/*
 module:		常见问题
 create_time:	2023-03-15 18:02:00
 author:		
 contact:		
*/

namespace app\admin\controller;

use app\admin\service\FaqService;
use app\admin\model\Faq as FaqModel;
use think\facade\Db;

class Faq extends Admin {


	/*首页数据列表*/
	function index(){
		if (!$this->request->isAjax()){
			return view('index');
		}else{
			$limit  = $this->request->post('limit', 20, 'intval');
			$offset = $this->request->post('offset', 0, 'intval');
			$page   = floor($offset / $limit) +1 ;

			$where = [];
			$where['title'] = ['like',$this->request->param('title', '', 'serach_in')];
			$where['is_hot'] = $this->request->param('is_hot', '', 'serach_in');

			$order  = $this->request->post('order', '', 'serach_in');	//排序字段 bootstrap-table 传入
			$sort  = $this->request->post('sort', '', 'serach_in');		//排序方式 desc 或 asc

			$field = 'faq_id,title,is_hot';
			$orderby = ($sort && $order) ? $sort.' '.$order : 'faq_id desc';

			$res = FaqService::indexList(formatWhere($where),$field,$orderby,$limit,$page);
			return json($res);
		}
	}

	/*添加*/
	function add(){
		if (!$this->request->isPost()){
			return view('add');
		}else{
			$postField = 'title,content,is_hot';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = FaqService::add($data);
			return json(['status'=>'00','msg'=>'添加成功']);
		}
	}

	/*修改*/
	function update(){
		if (!$this->request->isPost()){
			$faq_id = $this->request->get('faq_id','','serach_in');
			if(!$faq_id) $this->error('参数错误');
			$this->view->assign('info',checkData(FaqModel::find($faq_id)));
			return view('update');
		}else{
			$postField = 'faq_id,title,content,is_hot';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = FaqService::update($data);
			return json(['status'=>'00','msg'=>'修改成功']);
		}
	}

	/*删除*/
	function delete(){
		$idx =  $this->request->post('faq_id', '', 'serach_in');
		if(!$idx) $this->error('参数错误');
		try{
			FaqModel::destroy(['faq_id'=>explode(',',$idx)],true);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return json(['status'=>'00','msg'=>'操作成功']);
	}



}

