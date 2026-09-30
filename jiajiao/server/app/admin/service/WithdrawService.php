<?php 
/*
 module:		提现明细
 create_time:	2022-09-21 11:21:21
 author:		
 contact:		
*/

namespace app\admin\service;
use app\admin\model\Withdraw;
use think\exception\ValidateException;
use xhadmin\CommonService;

class WithdrawService extends CommonService {


	/*
 	* @Description  编辑数据
 	*/
	public static function updateStatus($data){
		try{
			$res = Withdraw::update($data);
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

