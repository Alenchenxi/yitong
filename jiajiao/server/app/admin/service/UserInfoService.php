<?php 
/*
 module:		信息收集
 create_time:	2023-03-23 10:14:26
 author:		
 contact:		
*/

namespace app\admin\service;
use app\admin\model\UserInfo;
use think\exception\ValidateException;
use xhadmin\CommonService;

class UserInfoService extends CommonService {


	/*
 	* @Description  列表数据
 	*/
	public static function indexList($where,$field,$order,$limit,$page){
		try{
			$res = UserInfo::where($where)->field($field)->order($order)->paginate(['list_rows'=>$limit,'page'=>$page])->toArray();
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return ['rows'=>$res['data'],'total'=>$res['total']];
	}




}

