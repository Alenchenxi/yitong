<?php

namespace app\admin\controller\Sys\service;
use app\admin\controller\Sys\model\Menu;
use app\admin\controller\Sys\model\Application;
use xhadmin\CommonService;


class MenuService extends CommonService
{

	
	 /*
     * @Description  添加或修改信息
	 * @param (输入参数：)  {string}        type 操作类型 add 添加 update修改
     * @param (输入参数：)  {array}         data 原始数据
     * @return (返回参数：) {bool}        
	 */
	public static function saveData($type,$data){
		try{	
			
			//if(!$data['controller_name']) throw new \Exception('控制名不能为空');
			if(strtolower($data['controller_name']) == 'sys') throw new \Exception('系统名称禁止使用');
			
			$controller_name = $data['controller_name'];
			if(strpos($controller_name,'/') > 0){
				$arr = explode('/',$controller_name);
				$controller_name = ucfirst($arr[0]).'/'.ucfirst($arr[1]);
			}else{
				$controller_name = ucfirst($controller_name);
			}
			
			
			$data['controller_name'] = $controller_name;
			$data['table_name'] = strtolower($data['table_name']);
			$data['pk_id'] = strtolower($data['pk_id']);
			
			if($type == 'add'){
				$controllerInfo = Menu::where(['app_id'=>$data['app_id'],'controller_name'=>$data['controller_name']])->find();
				if($data['controller_name'] && $controllerInfo){
					throw new \Exception('控制器已存在');
				}
				
				$tableInfo = Menu::where(['table_status'=>1,'table_name'=>$data['table_name']])->find();
				if($data['table_status'] && $data['table_name'] && $tableInfo){
					throw new \Exception('数据表已存在');
				}
				$reset = Menu::create($data);
				if($reset->menu_id){
					Menu::update(['menu_id'=>$reset->menu_id,'sortid'=>$reset->menu_id]);
					$applicationInfo = Application::find($data['app_id']);
					if($data['table_name'] && $data['pk_id'] && $applicationInfo['app_type'] == 1){
						self::createDefaultAction($data,$reset->menu_id);
					}
				}	
			}elseif($type == 'edit'){			
				$reset = Menu::update($data);
			}
		}catch(\Exception $e){
			throw new \Exception($e->getMessage());
		}
	
		return $reset->menu_id;
	}
	
	
	/**
     * 创建默认的控制器方法以及字段
     * @return bool 信息
     */
	public static function createDefaultAction($data,$id){

		//创建默认操作方法
		db('action')->insertGetId(['menu_id'=>$id,'name'=>'首页数据列表','action_name'=>'index','type'=>'1','is_view'=>'0','sortid'=>'1']);
		db('action')->insertGetId(['menu_id'=>$id,'name'=>'修改排序开关按钮操作','action_name'=>'updateExt','type'=>'16','is_view'=>'0','sortid'=>'2']);
		
		//创建默认主键
		db('field')->insertGetId(['menu_id'=>$id,'name'=>'编号','field'=>$data['pk_id'],'type'=>'1','list_show'=>'1','search_show'=>'0','is_post'=>'0','is_field'=>'1','align'=>'center','sortid'=>'1','datatype'=>'int','length'=>'11']);
	}
	
	
	
	/**
     * 移动排序
	 * @param (输入参数：)  {string}        id 当前ID
     * @param (输入参数：)  {string}        type 类型 1上移 2 下移
     * @return (返回参数：) {bool}        
     * @return bool 信息
     */
	public static function arrowsort($id,$type){
		$data = Menu::find($id);
		if($type == 1){
			$map = 'sortid < '.$data['sortid'].' and pid = '.$data['pid'];
			$info = Menu::where($map)->order('sortid desc')->find();
		}else{
			$map = 'sortid > '.$data['sortid'].' and pid = '.$data['pid'];
			$info = Menu::where($map)->order('sortid asc')->find();
		}

		try{
			if($info && $data){
				Menu::update(['menu_id'=>$id,'sortid'=>$info['sortid']]);
				Menu::update(['menu_id'=>$info['menu_id'],'sortid'=>$data['sortid']]);
			}else{
				throw new \Exception('目标位置没有数据');
			}
		}catch(\Exception $e){
			throw new \Exception($e->getMessage());
		}
		
		return true;	
	}
	
	/**
     * 删除信息
     * @return bool 信息
     */
	public static function delete($id){
		try{	
			$reset = Menu::destroy(['menu_id'=>$id]);
		}catch(\Exception $e){
			throw new \Exception($e->getMessage());
		}
			
		return $reset;
	}
	
    
}
