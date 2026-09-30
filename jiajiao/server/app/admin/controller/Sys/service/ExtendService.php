<?php

//自定义字段以及方法信息
namespace app\admin\controller\Sys\service;


class ExtendService
{
	
	/*@desscription 拓展字段定义 
	* @param name 字段名称
	* @param property 字段类型 参考 FieldSetservice.php
	* @param search  字段允许搜索
	*/
	public static $fields = [
		//100 => ['name'=>'百度地图','property'=>1],
	];
	
	
	/*后台方法自定义*/
	public static $adminActions = [
		//100 => '空方法',
	];
	
	
	/*api方法自定义*/
	public static $apiActions = [
		//100 => '空方法',
	];
	
	
	/*
	* @description 自定义字段生成
	* @param fieldInfo 字段信息
	* @param type 方法类型 参考 ActionSetservice.php
	* @param applicationInfo 应用信息
	* @param menuInfo 菜单信息
	*/
	public static function getExtendFieldList($fieldInfo,$type,$applicationInfo,$menuInfo){
		$str = '';
		switch($fieldInfo['type']){	
			case 100:
				$str .="					<div class=\"form-group\">\n";
				$str .="						<label class=\"col-sm-2 control-label\">".$fieldInfo['name']."：</label>\n";
				$str .="						<div class=\"col-sm-9\">\n";
				if($type == 3 && !is_null($fieldInfo['default_value'])){
					$defaultValue = $fieldInfo['default_value'];
				}else{
					$defaultValue = "{\$info.".$fieldInfo['field']."}";
				}
				$str .="							<input type=\"text\" autocomplete=\"off\" id=\"".$fieldInfo['field']."\" value=\"".$defaultValue."\" name=\"".$fieldInfo['field']."\" class=\"form-control\" placeholder=\"请输入".$fieldInfo['name']."\">\n";
				if(!empty($fieldInfo['note'])){
					$str .="							<span class=\"help-block m-b-none\">".$fieldInfo['note']."</span>\n";
				}
				
				$str .="						</div>\n";
				$str .="					</div>\n";
			break;
			
		}
		return $str;	
	}
	
	
	/*
	* @description 后台自定义方法生成
	* @param actionInfo 方法信息
	* @param fieldList 当前所属菜单的定义的所有字段
	*/
	public static function getAdminExtendFuns($actionInfo,$fieldList){
		$str  = '';
		switch($actionInfo['type']){
			case 100:
				$str .= "	function ".$actionInfo['action_name']." (){\n";
				$str .="		return 'hello word';\n";
				$str .= "	}\n";
			break;
		}
		
		return $str;
	}
	
	
	/*
	* @description api自定义方法生成
	* @param actionInfo 方法信息
	* @param fieldList 当前所属菜单的定义的所有字段
	*/
	public static function getApiExtendFuns($actionInfo,$fieldList){
		$str  = '';
		switch($actionInfo['type']){
			case 100:
				$str .= "	function ".$actionInfo['action_name']." (){\n";
				$str .="		return 'hello word';\n";
				$str .= "	}\n";
			break;
		}
		
		return $str;
	}
	
	
}
