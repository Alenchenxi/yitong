<?php 
/*
 module:		会员列表
 create_time:	2025-05-26 15:55:40
 author:		
 contact:		
*/

namespace app\admin\service;
use app\admin\model\Member;
use think\exception\ValidateException;
use xhadmin\CommonService;

class MemberService extends CommonService {


	/*
 	* @Description  列表数据
 	*/
	public static function indexList($where,$field,$order,$limit,$page){
		try{
			$res = Member::where($where)->field($field)->order($order)->paginate(['list_rows'=>$limit,'page'=>$page])->toArray();
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return ['rows'=>$res['data'],'total'=>$res['total']];
	}


	/*
 	* @Description  添加
 	*/
	public static function add($data){
		try{
			$data['login_time'] = strtotime($data['login_time']);
			$res = Member::create($data);
		}catch(ValidateException $e){
			throw new ValidateException ($e->getError());
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		if(!$res){
			throw new ValidateException ('操作失败');
		}
		return $res->mid;
	}


	/*
 	* @Description  修改
 	*/
	public static function update($data){
		try{
			$data['login_time'] = strtotime($data['login_time']);
			$res = Member::update($data);
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

