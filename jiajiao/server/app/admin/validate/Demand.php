<?php 
/*
 module:		家长发布验证器
 create_time:	2023-07-22 16:28:53
 author:		
 contact:		
*/

namespace app\admin\validate;
use think\validate;

class Demand extends validate {


	protected $rule = [
		'mobile'=>['require'],
	];

	protected $message = [
		'mobile.require'=>'联系方式不能为空',
	];

	protected $scene  = [
		'add'=>['mobile'],
		'update'=>['mobile'],
	];



}

