<?php 
/*
 module:		用户管理验证器
 create_time:	2021-01-05 14:47:00
 author:		
 contact:		
*/

namespace app\admin\validate;
use think\validate;

class User extends validate {


	protected $rule = [
		'name'=>['require'],
		'user'=>['require'],
		'pwd'=>['require','regex'=>'/^(?![0-9]+$)(?![a-zA-Z]+$)[0-9A-Za-z]{6,20}$/'],
	];

	protected $message = [
		'name.require'=>'真实姓名不能为空',
		'user.require'=>'用户名不能为空',
		'pwd.require'=>'密码不能为空',
		'pwd.regex'=>'6-21位数字字母组合',
	];

	protected $scene  = [
		'add'=>['name','user','pwd'],
		'update'=>['name','user'],
		'updatePassword'=>['pwd'],
	];



}

