<?php
/**
 * 删除字段中间件
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
use app\admin\controller\Admin;
use think\facade\Db;

class DeleteField extends Admin
{
	
    public function handle($request, \Closure $next)
    {	
		$data = $request->param();

		try{	
			$fieldInfo = Field::find($data['id']);
			$menuInfo = Menu::find($fieldInfo['menu_id']);
			$applicationInfo = Application::find($menuInfo['app_id']);
			
			$connect = $menuInfo['connect'] ? $menuInfo['connect'] : config('database.default');
			
			if($menuInfo['menu_id'] <> config('my.config_module_id')){
				//判断 字段状态可以删除 并且是系统动态创建的字段 则直接删除数据表字段
				if($fieldInfo['is_field'] == 1 && in_array($applicationInfo['app_type'],[1,3])){
					foreach(explode('|',$fieldInfo['field']) as $k=>$v){
						if(self::getFieldStatus(config('database.connections.'.$connect.'.prefix').$menuInfo['table_name'],$v,$connect)){
							$sql = 'ALTER TABLE '.config('database.connections.'.$connect.'.prefix').$menuInfo['table_name'].' DROP '.$v;
							Db::connect($connect)->execute($sql);
						}
					}	
				}
			}else{
				db('config')->where(['name'=>$fieldInfo['field']])->delete();
			}
		}catch(\Exception $e){
			throw new \Exception($e->getMessage());
		}	
		
		return $next($request);		
    }
	
	//删除字段之前 先判断数据表字段是否存在
	public static function getFieldStatus($tablename,$field,$connect){
		$list = Db::connect($connect)->query('show columns from '.$tablename);
		foreach($list as $v){
			$arr[] = $v['Field'];
		}
		if(in_array($field,$arr)){
			return true;
		}
	}
}