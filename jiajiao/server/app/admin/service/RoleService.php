<?php 
/*
 module:		角色管理
 create_time:	2021-01-05 14:47:03
 author:		
 contact:		
*/

namespace app\admin\service;
use app\admin\model\Role;
use think\exception\ValidateException;
use xhadmin\CommonService;

class RoleService extends CommonService {


	/*
 	* @Description  列表数据
 	*/
	public static function indexList($where,$field,$order,$limit,$page){
		try{
			$res = Role::where($where)->field($field)->order($order)->paginate(['list_rows'=>$limit,'page'=>$page])->toArray();
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return ['rows'=>$res['data'],'total'=>$res['total']];
	}


	/*
 	* @Description  添加分组
 	*/
	public static function add($data){
		try{
			validate(\app\admin\validate\Role::class)->scene('add')->check($data);
			$res = Role::create($data);
		}catch(ValidateException $e){
			throw new ValidateException ($e->getError());
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		if(!$res){
			throw new ValidateException ('操作失败');
		}
		return $res->role_id;
	}


	/*
 	* @Description  修改分组
 	*/
	public static function update($data){
		try{
			validate(\app\admin\validate\Role::class)->scene('update')->check($data);
			$res = Role::update($data);
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

