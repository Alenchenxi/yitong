<?php 
/*
 module:		科目管理
 create_time:	2023-03-01 09:44:40
 author:		
 contact:		
*/

namespace app\admin\service;
use app\admin\model\Subject;
use think\exception\ValidateException;
use xhadmin\CommonService;

class SubjectService extends CommonService {


	/*
 	* @Description  添加
 	*/
	public static function add($data){
		try{
			$res = Subject::create($data);
		}catch(ValidateException $e){
			throw new ValidateException ($e->getError());
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		if(!$res){
			throw new ValidateException ('操作失败');
		}
		return $res->subject_id;
	}


	/*
 	* @Description  修改
 	*/
	public static function update($data){
		try{
			$res = Subject::update($data);
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

