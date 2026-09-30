<?php 
/*
 module:		角色管理验证器
 create_time:	2021-01-05 14:47:03
 author:		
 contact:		
*/

namespace app\admin\validate;
use think\validate;

class Role extends validate {


	protected $rule = [
		'name'=>['require'],
	];

	protected $message = [
		'name.require'=>'角色不能为空',
	];

	protected $scene  = [
		'add'=>['name'],
		'update'=>['name'],
	];



}

