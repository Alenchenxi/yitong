<?php 
/*
 module:		用户管理
 create_time:	2021-01-05 14:47:00
 author:		
 contact:		
*/

namespace app\admin\service;
use app\admin\model\User;
use think\exception\ValidateException;
use xhadmin\CommonService;

class UserService extends CommonService {


	/*
 	* @Description  添加账户
 	*/
	public static function add($data){
		try{
			validate(\app\admin\validate\User::class)->scene('add')->check($data);
			$data['pwd'] = md5($data['pwd'].config('my.password_secrect'));
			$data['role_id'] = implode(',',$data['role_id']);
			$data['create_time'] = time();
			$res = User::create($data);
		}catch(ValidateException $e){
			throw new ValidateException ($e->getError());
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		if(!$res){
			throw new ValidateException ('操作失败');
		}
		return $res->user_id;
	}


	/*
 	* @Description  修改账户
 	*/
	public static function update($data){
		try{
			validate(\app\admin\validate\User::class)->scene('update')->check($data);
			$data['role_id'] = implode(',',$data['role_id']);
			$data['create_time'] = strtotime($data['create_time']);
			$res = User::update($data);
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
 	* @Description  修改密码
 	*/
	public static function updatePassword($data){
		try{
			validate(\app\admin\validate\User::class)->scene('updatePassword')->check($data);
			$data['pwd'] = md5($data['pwd'].config('my.password_secrect'));
			$res = User::update($data);
		}catch(ValidateException $e){
			throw new ValidateException ($e->getError());
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return $res;
	}




}

