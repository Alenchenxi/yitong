<?php 
/*
 module:		科目价格
 create_time:	2022-10-13 20:19:45
 author:		
 contact:		
*/

namespace app\admin\service;
use app\admin\model\CoursePrice;
use think\exception\ValidateException;
use xhadmin\CommonService;

class CoursePriceService extends CommonService {


	/*
 	* @Description  添加
 	*/
	public static function add($data){
		try{
			$res = CoursePrice::create($data);
		}catch(ValidateException $e){
			throw new ValidateException ($e->getError());
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		if(!$res){
			throw new ValidateException ('操作失败');
		}
		return $res->course_price_id;
	}


	/*
 	* @Description  修改
 	*/
	public static function update($data){
		try{
			$res = CoursePrice::update($data);
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

