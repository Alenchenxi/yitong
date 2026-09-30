<?php
namespace app\admin\controller\Cms;
use app\admin\service\Cms\CatagoryService;
use app\admin\model\Cms\Catagory as CatagoryModel;
use app\admin\controller\Admin;

class Catagory extends Admin {


	/*栏目管理*/
	function index(){
		if (!$this->request->isAjax()){
			return view('cms/catagory/index');
		}else{
			$limit  = $this->request->post('limit', 0, 'intval');
			$offset = $this->request->post('offset', 0, 'intval');
			$page   = floor($offset / $limit) +1 ;
			
			$where = [];
			$field = 'a.*,b.title as module_name';
			$orderby = 'sortid asc';
			
			$res = CatagoryService::indexList(formatWhere($where),$field,$orderby,$limit,$page);
			$res['rows'] = formartList(['class_id', 'pid', 'class_name','class_name'],$res['rows']);
			return json($res);
		}
	}

	/*修改排序*/
	function updateExt(){
		$postField = 'class_id,status,sortid';
		$data = $this->request->only(explode(',',$postField),'post',null);
		if(!$data['class_id']) $this->error('参数错误');
		CatagoryModel::update($data);
		return json(['status'=>'00','msg'=>'操作成功']);
	}

	/*添加*/
	function add(){
		if (!$this->request->isPost()){
			$class_id = $this->request->get('class_id','','intval');
			$info = CatagoryModel::find($class_id);
			$data['type'] = $info->type;
			$data['list_tpl'] = $info->list_tpl;
			$data['detail_tpl'] = $info->detail_tpl;
			$data['pid'] = $info->class_id;
			$data['module_id'] = $info->module_id;
			$data['upload_config_id'] = $info->upload_config_id;
			$data['filepath'] = $info->filepath;
			$default_themes = config('xhadmin.default_themes') ? config('xhadmin.default_themes') : 'index';
			$this->view->assign('info',$data);
			$this->view->assign('tpList',CatagoryService::tplList($default_themes));
			return view('cms/catagory/add');
		}else{
			$data = $this->request->post();
			$res = CatagoryService::add($data);
			return json(['status'=>'00','msg'=>'添加成功']);
		}
	}

	/*修改*/
	function update(){
		if (!$this->request->isPost()){
			$class_id = $this->request->get('class_id','','intval');
			if(!$class_id) $this->error('参数错误');
			$default_themes = config('xhadmin.default_themes') ? config('xhadmin.default_themes') : 'index';
			$this->view->assign('tpList',CatagoryService::tplList($default_themes));
			$this->view->assign('info',checkData(CatagoryModel::find($class_id)));
			return view('cms/catagory/update');
		}else{
			$data = $this->request->post();
			if($data['class_id'] == $data['pid']) $this->error('当前分类不能作为父分类');
			CatagoryService::update($data);
			return json(['status'=>'00','msg'=>'修改成功']);
		}
	}

	/*删除*/
	function delete(){
		$idx =  $this->request->post('class_ids', '', 'serach_in');
		if(!$idx) $this->error('参数错误');
		CatagoryModel::destroy(['class_id'=>explode(',',$idx)]);
		return json(['status'=>'00','msg'=>'操作成功']);
	}
	
	//排序上下移动操作
	function setSort(){
		$class_id  = $this->request->post('class_id', 0, 'intval');
		$type  = $this->request->post('type', 0, 'intval');
		if(empty($class_id) || empty($type)) $this->error('参数错误');
		CatagoryService::setSort($class_id,$type);
		return json(['status'=>'00','msg'=>'操作成功']);
		
	}



}

