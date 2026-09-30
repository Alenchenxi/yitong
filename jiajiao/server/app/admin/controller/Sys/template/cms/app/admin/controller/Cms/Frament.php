<?php 
namespace app\admin\controller\Cms;
use app\admin\service\Cms\FramentService;
use app\admin\model\Cms\Frament as FramentModel;
use app\admin\controller\Admin;

class Frament extends Admin {


	/*碎片管理*/
	function index(){
		if (!$this->request->isAjax()){
			return view('cms/frament/index');
		}else{
			$limit  = $this->request->post('limit', 0, 'intval');
			$offset = $this->request->post('offset', 0, 'intval');
			$page   = floor($offset / $limit) +1 ;

			$where['title'] = $this->request->param('title', '', 'serach_in');
			$orderby = 'frament_id desc';
			$field = 'frament_id,title,content';
			
			$res = FramentService::indexList(formatWhere($where),$field,$orderby,$limit,$page);
			return json($res);
		}
	}

	/*添加*/
	function add(){
		if (!$this->request->isPost()){
			return view('cms/frament/add');
		}else{
			$data = $this->request->post();
			$res = FramentService::add($data);
			return json(['status'=>'00','msg'=>'添加成功']);
		}
	}

	/*修改*/
	function update(){
		if (!$this->request->isPost()){
			$frament_id = $this->request->get('frament_id','','intval');
			if(!$frament_id) $this->error('参数错误');
			$this->view->assign('info',checkData(FramentModel::find($frament_id)));
			return view('cms/frament/update');
		}else{
			$data = $this->request->post();
			FramentService::update($data);
			return json(['status'=>'00','msg'=>'修改成功']);
		}
	}

	/*删除*/
	function delete(){
		$idx =  $this->request->post('frament_ids', '', 'serach_in');
		if(!$idx) $this->error('参数错误');
		FramentModel::destroy(['frament_id'=>explode(',',$idx)]);
		return json(['status'=>'00','msg'=>'操作成功']);
	}



}

