<?php
/**
 * 创建字段中间件
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
use app\admin\controller\Sys\service\ExtendService;
use app\admin\controller\Admin;
use think\facade\Db;


class SetField extends Admin
{
	
    public function handle($request, \Closure $next)
    {	
		$data = $request->param();
		
		$field_letter_status = !is_null(config('my.field_letter_status')) ? config('my.field_letter_status') : true;
		if($field_letter_status){
			$data['field'] = strtolower(trim($data['field']));
			if(!preg_match('/^[a-z_|0-9]+$/',$data['field'])){
				return json(['status'=>'01','msg'=>'字段格式错误']);
			}
		}
		
		if($data['is_field']){
			$typeField = \app\admin\controller\Sys\service\FieldSetService::typeField() + ExtendService::$fields;
			$propertyField = \app\admin\controller\Sys\service\FieldSetService::propertyField();
			$typeData = $typeField[$data['type']];
			$property = $propertyField[$typeData['property']];

			$property['decimal'] = !empty($property['decimal']) ? ','.$property['decimal'] : '';
			$maxlen = !empty($data['length']) ? $data['length'] : $property['maxlen'];
			$datatype = !empty($data['datatype']) ? $data['datatype'] : $property['name'];
			
			if((!empty($data['default_value']) || is_numeric($data['default_value'])) && !in_array($data['type'],[7,31,12,21,25,17,32])){
				if($data['type'] == 13){
					$data['default_value'] = '0';
				}
				$default = "DEFAULT '".$data['default_value']."'";
			}else{
				$default = 'DEFAULT NULL';
			}
			
			$menuInfo = Menu::find($data['menu_id']);
			$fields = explode('|',$data['field']);
			
			$connect = $menuInfo['connect'] ? $menuInfo['connect'] : config('database.default');
			
			try{
				foreach($fields as $key=>$val){
					$sql="ALTER TABLE ".config('database.connections.'.$connect.'.prefix')."{$menuInfo['table_name']} ADD {$val} {$datatype}({$maxlen}{$property['decimal']}) COMMENT '{$data['name']}' {$default}";
					Db::connect($connect)->execute($sql);
					if(!empty($data['indexdata'])){
						Db::connect($connect)->execute("ALTER TABLE ".config('database.connections.'.$connect.'.prefix')."{$menuInfo['table_name']} ADD ".$data['indexdata']." (  `".$val."` )");
					}
				}
			}catch(\Exception $e){
				return json(['status'=>'01','msg'=>$e->getMessage()]);
			}
		}
		
		return $next($request);
		
		
    }
}