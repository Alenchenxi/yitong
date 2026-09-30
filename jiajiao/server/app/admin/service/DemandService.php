<?php 
/*
 module:		家长发布
 create_time:	2023-07-22 16:28:53
 author:		
 contact:		
*/

namespace app\admin\service;
use app\admin\model\Demand;
use think\exception\ValidateException;
use xhadmin\CommonService;

class DemandService extends CommonService {


	/*
 	* @Description  添加
 	*/
	public static function add($data){
		try{
			validate(\app\admin\validate\Demand::class)->scene('add')->check($data);
			$data['sn'] = doOrderSn('000');
			$data['trial_time'] = strtotime($data['trial_time']);
			$data['create_time'] = strtotime($data['create_time']);
			$data['refresh_time'] = strtotime($data['refresh_time']);
			$data['stick_time'] = strtotime($data['stick_time']);
			$res = Demand::create($data);
		}catch(ValidateException $e){
			throw new ValidateException ($e->getError());
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		if(!$res){
			throw new ValidateException ('操作失败');
		}
		return $res->demand_id;
	}


	/*
 	* @Description  修改
 	*/
	public static function update($data){
		try{
			validate(\app\admin\validate\Demand::class)->scene('update')->check($data);
			$data['trial_time'] = strtotime($data['trial_time']);
			$data['create_time'] = strtotime($data['create_time']);
			$res = Demand::update($data);
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


	/*
 	* @Description  编辑数据
 	*/
	public static function setStick($data){
		try{
			$res = Demand::update($data);
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

