<?php
namespace app\ApplicationName\controller;
use app\ApplicationName\service\BaseService;
use app\ApplicationName\service\CatagoryService;
use app\ApplicationName\facade\Cat;
use app\ApplicationName\model\Content;
use app\ApplicationName\model\Catagory;


class View extends Base
{
	
	//列表页面
	public function index(){
		$content_id = $this->request->param('content_id','','intval');
		empty($content_id) && $this->error('内容ID不能为空');
		
		$contentInfo = Content::find($content_id);
		empty($contentInfo['class_id']) && $this->error('栏目ID不能为空');
		
		$contentInfo = $contentInfo->toArray();
		
		$classInfo = checkData(Catagory::find($contentInfo['class_id']),false);
		!$classInfo && $this->error('栏目信息不存在');
		
		//获取拓展模块的内容信息
        if($classInfo['module_id']){
			//获取拓展内容信息
			$extInfo = db("menu")->where('menu_id',$classInfo['module_id'])->find();
			$extContentInfo = db($extInfo['table_name'])->where('content_id',$content_id)->find();
			if($extContentInfo){
				$contentInfo = array_merge($extContentInfo , $contentInfo);
			}
        }
		$contentInfo = checkData($contentInfo,false);
		
		$position = Cat::getPosition($classInfo['class_id']);
		$topCategoryInfo = Cat::getTopBigInfo($classInfo['class_id']); //最上级栏目信息
		
		$this->view->assign('media',BaseService::getMedia($contentInfo['title'],$contentInfo['keyword'],$contentInfo['description'])); //关键词描述等信息
		$this->view->assign('classInfo',$classInfo);  //当前栏目信息
		$this->view->assign('class_name',$classInfo['class_name']);  //当前栏目名称
		$this->view->assign('classid',$classInfo['class_id']);	//当前栏目ID
		$this->view->assign('pname',$topCategoryInfo['class_name']);  //最上级栏目名称
		$this->view->assign('pid',$topCategoryInfo['class_id']);	//最上级栏目ID
		$this->view->assign('position', $position); //面包屑信息
		$this->view->assign('info',$contentInfo);
		$this->view->assign('shownext', BaseService::shownext($content_id,$contentInfo['class_id']));
		$this->view->assign('sub_data', Catagory::where('pid',$topCategoryInfo['class_id'])->count()); //判断是否有子分类
		$default_themes = config('xhadmin.default_themes') ? config('xhadmin.default_themes') : 'index';
		return view($default_themes.'/'.$classInfo['detail_tpl']);
	}
	
	
	//点击量增加
	public function hits(){
	   $content_id = $this->request->param('content_id','','intval');
	   $data = Content::find($content_id);
	   Content::where('content_id',$content_id)->inc('views',1)->update();
	   echo "document.write('".$data['views']."');";
	   
	}
	
}
