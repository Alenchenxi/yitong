<?php

namespace app\admin\controller\Sys\service;
use app\admin\controller\Sys\model\Application;
use app\admin\controller\Sys\model\Menu;
use app\admin\controller\Sys\model\Action;
use app\admin\controller\Sys\model\Field;
use think\facade\Validate;
use xhadmin\CommonService;


class ApplicationService extends CommonService
{
	
	
	 /*
     * @Description  添加或修改信息
	 * @param (输入参数：)  {string}        type 操作类型 add 添加 update修改
     * @param (输入参数：)  {array}         data 原始数据
     * @return (返回参数：) {bool}        
	 */
	public static function saveData($type,$data){
		
		try{	
			//调用验证器
			$rule = [
				'name'  => 'require',
				'app_dir' => 'require',
				'app_dir'=>['regex'=>'/^([a-z])+$/'],
				'login_table'=>['regex'=>'/^[a-z_]\w+$/'],
				'pk'=>['regex'=>'/^([a-z_])+$/'],
			];
			$msg = [
				'name.require'=>'应用名称必填',
				'app_dir.require'=>'应用目录必填',
				'login_table.regex'=>'小写字母下划线数字组合',
				'pk.regex'=>'主键小写字母下划线组合',
			];
			
			$validate = Validate::rule($rule)->message($msg);	
			if (!$validate->check($data)) {
				throw new ValidateException($validate->getError());
			}
			
			if($data['login_fields'] && false == strpos($data['login_fields'],'|')){
				throw new \Exception('登录字段格式错误');
			}
			
			if($type == 'add'){
				$reset = Application::create($data);
				if($reset->app_id && $data['app_type'] == 1){
					self::createDefaultAction($reset->app_id);
				}
			}elseif($type == 'edit'){
				$reset = Application::update($data);
			}
		}catch(\Exception $e){
			throw new \Exception($e->getMessage());
		}
			
		return $reset;
	}
	
	/**
     * 创建应用的默认操作
     * @return bool 信息
     */
	public static function createDefaultAction($app_id){
		
		$applicationInfo = Application::find($app_id);
		
		$res = Menu::create(['title'=>'系统管理','is_create'=>0,'table_status'=>0,'is_url'=>0,'status'=>1,'menu_icon'=>'fa fa-gears','app_id'=>$app_id]);
		if($res->menu_id){
			Menu::update(['sortid'=>$res->menu_id,'menu_id'=>$res->menu_id]);
			
			$url = $applicationInfo['app_dir'].'/Index/main';
			Menu::create(['title'=>'后台首页','pid'=>$res->menu_id,'is_create'=>0,'table_status'=>0,'is_url'=>1,'status'=>1,'sortid'=>1,'menu_icon'=>'fa fa-gears','app_id'=>$app_id,'url'=>$url]);
			
			$url = $applicationInfo['app_dir'].'/Base/password';
			Menu::create(['title'=>'修改密码','pid'=>$res->menu_id,'is_create'=>0,'table_status'=>0,'is_url'=>1,'status'=>1,'sortid'=>2,'menu_icon'=>'fa fa-gears','app_id'=>$app_id,'url'=>$url]);
		}
	}

    
}
