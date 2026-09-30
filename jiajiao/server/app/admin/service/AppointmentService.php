<?php 
/*
 module:		预约
 create_time:	2023-05-16 14:11:10
 author:		
 contact:		
*/

namespace app\admin\service;
use app\admin\model\Appointment;
use think\exception\ValidateException;
use xhadmin\CommonService;

class AppointmentService extends CommonService {


	/*
 	* @Description  添加
 	*/
	public static function add($data){
		try{
			$data['create_time'] = strtotime($data['create_time']);
			$data['pay_time'] = strtotime($data['pay_time']);
			$res = Appointment::create($data);
		}catch(ValidateException $e){
			throw new ValidateException ($e->getError());
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		if(!$res){
			throw new ValidateException ('操作失败');
		}
		return $res->appointment_id;
	}


	/*
 	* @Description  修改
 	*/
	public static function update($data){
		try{
			$data['create_time'] = strtotime($data['create_time']);
			$data['pay_time'] = strtotime($data['pay_time']);
			$res = Appointment::update($data);
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

