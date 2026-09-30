<?php 
/*
 module:		充值记录
 create_time:	2021-04-08 15:10:41
 author:		
 contact:		
*/

namespace app\admin\service;
use app\admin\model\Recharge;
use think\exception\ValidateException;
use xhadmin\CommonService;

class RechargeService extends CommonService {


	/*
 	* @Description  列表数据
 	*/
	public static function indexList($where,$field,$order,$limit,$page){
		try{
			$res = Recharge::where($where)->field($field)->order($order)->paginate(['list_rows'=>$limit,'page'=>$page])->toArray();
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return ['rows'=>$res['data'],'total'=>$res['total']];
	}




}

