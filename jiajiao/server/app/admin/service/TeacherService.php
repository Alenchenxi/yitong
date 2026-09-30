<?php 
/*
 module:		教员列表
 create_time:	2024-06-24 09:09:12
 author:		
 contact:		
*/

namespace app\admin\service;
use app\admin\model\Teacher;
use think\exception\ValidateException;
use xhadmin\CommonService;

class TeacherService extends CommonService {


	/*
 	* @Description  添加
 	*/
	public static function add($data){
		try{
			$data['teaching_way'] = implode(',',$data['teaching_way']);
			$res = Teacher::create($data);
		}catch(ValidateException $e){
			throw new ValidateException ($e->getError());
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		if(!$res){
			throw new ValidateException ('操作失败');
		}
		return $res->teacher_id;
	}


	/*
 	* @Description  修改
 	*/
	public static function update($data){
		try{
			$data['teaching_way'] = implode(',',$data['teaching_way']);
			$res = Teacher::update($data);
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

