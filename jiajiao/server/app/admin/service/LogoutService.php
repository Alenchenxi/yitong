<?php 
/*
 module:		注销原因
 create_time:	2022-10-19 17:54:31
 author:		
 contact:		
*/

namespace app\admin\service;
use app\admin\model\Logout;
use think\exception\ValidateException;
use xhadmin\CommonService;

class LogoutService extends CommonService {


	/*
 	* @Description  列表数据
 	*/
	public static function indexList($where,$field,$order,$limit,$page){
		try{
			$res = Logout::where($where)->field($field)->order($order)->paginate(['list_rows'=>$limit,'page'=>$page])->toArray();
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return ['rows'=>$res['data'],'total'=>$res['total']];
	}




}

