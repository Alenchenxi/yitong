<?php 
/*
 module:		年级管理
 create_time:	2023-03-01 09:45:30
 author:		
 contact:		
*/

namespace app\admin\service;
use app\admin\model\Grade;
use think\exception\ValidateException;
use xhadmin\CommonService;

class GradeService extends CommonService {


	/*
 	* @Description  添加
 	*/
	public static function add($data){
		try{
			$res = Grade::create($data);
		}catch(ValidateException $e){
			throw new ValidateException ($e->getError());
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		if(!$res){
			throw new ValidateException ('操作失败');
		}
		return $res->grade_id;
	}


	/*
 	* @Description  修改
 	*/
	public static function update($data){
		try{
			$res = Grade::update($data);
		}catch(ValidateException $e){
			throw new ValidateException ($e->getError());
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		if(!$res){
			throw new ValidateException ('操作失败');
		}
		return $res;
	}




}

