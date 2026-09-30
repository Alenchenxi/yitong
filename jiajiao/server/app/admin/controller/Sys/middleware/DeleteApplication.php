<?php
/**
 * 删除菜单中间件
 * ============================================================================
 * * COPYRIGHT 2016-2019 xhadmin.com , and all rights reserved.
 * * WEBSITE: http://www.xhadmin.com;
 * ----------------------------------------------------------------------------
 * This is not a free software!You have not used for commercial purposes in the
 * premise of the program code to modify and use; and publication does not allow
 * any form of code for any purpose.
 * ============================================================================
 * Author: 寒塘冷月 QQ：274363574
 */

namespace app\admin\controller\Sys\middleware;
use app\admin\controller\Sys\model\Menu;
use app\admin\controller\Sys\model\Application;
use app\admin\controller\Sys\model\Field;
use app\admin\controller\Sys\model\Action;
use app\admin\controller\Admin;
use think\facade\Db;

class DeleteApplication extends Admin
{
	
    public function handle($request, \Closure $next)
    {	
		$data = $request->param();
		
		$applicationInfo = Application::find($data['app_id']);
		
		$rootPath = app()->getRootPath();
		
		if($applicationInfo['app_type'] == 3){
			if($applicationInfo['app_dir']){
				deldir($rootPath.'/app/'.$applicationInfo['app_dir']); //删除前端应用
			}
			
			$cmsCount = Application::where(['app_type'=>3])->count();
			if($cmsCount <= 1){
				deldir($rootPath.'/app/admin/controller/Cms'); //删除控制器
				deldir($rootPath.'/app/admin/view/cms'); //删除视图
				deldir($rootPath.'/app/admin/service/Cms'); //删除服务层
				deldir($rootPath.'/app/admin/model/Cms'); //删除模型
				
				Db::execute('DROP TABLE IF EXISTS '.config('database.connections.mysql.prefix').'content');
				Db::execute('DROP TABLE IF EXISTS '.config('database.connections.mysql.prefix').'catagory');
				Db::execute('DROP TABLE IF EXISTS '.config('database.connections.mysql.prefix').'frament');
				Db::execute('DROP TABLE IF EXISTS '.config('database.connections.mysql.prefix').'position');
			
				$extendList = Menu::where(['app_id'=>$data['app_id']])->select();
				
				if($extendList){
					foreach($extendList as $key=>$val){
						Field::where(['menu_id'=>$val['menu_id']])->delete();
						Menu::where(['menu_id'=>$val['menu_id']])->delete();
						Db::execute('DROP TABLE IF EXISTS '.config('database.connections.mysql.prefix').$val['table_name']);
					}
				}
			}
		}else{
			if($applicationInfo['app_dir']){
				deldir($rootPath.'/app/'.$applicationInfo['app_dir']); //删除应用
			}
			$where['menu_id'] = Menu::where(['app_id'=>$data['app_id']])->column('menu_id');
			
			Menu::where(['app_id'=>$data['app_id']])->delete();
			Field::where($where)->delete();
			Action::where($where)->delete();
		}	
		
		return $next($request);		
    }
}