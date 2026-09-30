<?php 
namespace app\admin\controller\Cms;
use app\admin\service\Cms\PositionService;
use app\admin\model\Cms\Position as PositionModel;
use app\admin\controller\Admin;

class Position extends Admin {


	/*碎片管理*/
	function index(){
		if (!$this->request->isAjax()){
			return view('cms/position/index');
		}else{
			$limit  = $this->request->post('limit', 0, 'intval');
			$offset = $this->request->post('offset', 0, 'intval');
			$page   = floor($offset / $limit) +1 ;

			$where['title'] = $this->request->param('title', '', 'serach_in');
			$orderby = 'position_id desc';
			$field = 'position_id,title';
			
			$res = PositionService::indexList(formatWhere($where),$field,$orderby,$limit,$page);
			return json($res);
		}
	}
	
	/*修改排序*/
	function updateExt(){
		$postField = 'position_id,sortid';
		$data = $this->request->only(explode(',',$postField),'post',null);
		if(!$data['position_id']) $this->error('参数错误');
		PositionModel::update($data);
		return json(['status'=>'00','msg'=>'操作成功']);
	}

	/*添加*/
	function add(){
		if (!$this->request->isPost()){
			return view('cms/position/add');
		}else{
			$data = $this->request->post();
			$res = PositionService::add($data);
			return json(['status'=>'00','msg'=>'添加成功']);
		}
	}

	/*修改*/
	function update(){
		if (!$this->request->isPost()){
			$position_id = $this->request->get('position_id','','intval');
			if(!$position_id) $this->error('参数错误');
			$this->view->assign('info',checkData(PositionModel::find($position_id)));
			return view('cms/position/update');
		}else{
			$data = $this->request->post();
			PositionService::update($data);
			return json(['status'=>'00','msg'=>'修改成功']);
		}
	}

	/*删除*/
	function delete(){
		$idx =  $this->request->post('position_ids', '', 'serach_in');
		if(!$idx) $this->error('参数错误');
		PositionModel::destroy(['position'=>explode(',',$idx)]);
		return json(['status'=>'00','msg'=>'操作成功']);
	}



}

