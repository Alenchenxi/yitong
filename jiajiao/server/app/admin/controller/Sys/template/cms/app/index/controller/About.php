<?php
namespace app\ApplicationName\controller;
use app\ApplicationName\service\BaseService;
use app\ApplicationName\service\CatagoryService;
use app\ApplicationName\facade\Cat;
use app\ApplicationName\model\Content;
use app\ApplicationName\model\Catagory;


class About extends Base
{

	//列表页面
	public function index(){
		
		$class_id = $this->request->param('class_id','','intval');
		$p = $this->request->param('p',1,'intval');
		empty($class_id) && $this->error('栏目ID不能为空');
		$classInfo = checkData(Catagory::find($class_id),false);
		empty($classInfo) && $this->error('栏目信息不存在');
		
		$position = Cat::getPosition($class_id);
		$topCategoryInfo = Cat::getTopBigInfo($class_id); //最上级栏目信息
		
		$this->view->assign('media',BaseService::getMedia($classInfo['class_name'],$classInfo['keyword'],$classInfo['description'])); //网站关键词描述信息
		$this->view->assign('classInfo',$classInfo);  //当前栏目信息
		$this->view->assign('class_name',$classInfo['class_name']);  //当前栏目名称
		$this->view->assign('classid',$classInfo['class_id']);	//当前栏目ID
		$this->view->assign('pname',$topCategoryInfo['class_name']);  //最上级栏目名称
		$this->view->assign('pid',$topCategoryInfo['class_id']);	//最上级栏目ID
		$this->view->assign('position', $position); //面包屑信息
		$this->view->assign('sub_data', Catagory::where('pid',$topCategoryInfo['class_id'])->count()); //判断是否有子分类
		$this->view->assign('p',$p);
		
		
		//频道页的时候读取第一条内容作为频道页信息
		if($classInfo['type'] == 1){
			$content = Content::where('class_id',$classInfo['class_id'])->find();
			$this->view->assign('info',checkData($content,false));
		}
		$default_themes = config('xhadmin.default_themes') ? config('xhadmin.default_themes') : 'index';
		return view($default_themes.'/'.$classInfo['list_tpl']);
		
	}
}
