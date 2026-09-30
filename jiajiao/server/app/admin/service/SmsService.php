<?php 
/*
 module:		短信记录
 create_time:	2022-09-21 11:25:41
 author:		
 contact:		
*/

namespace app\admin\service;
use app\admin\model\Sms;
use think\exception\ValidateException;
use xhadmin\CommonService;

class SmsService extends CommonService {


	/*
 	* @Description  列表数据
 	*/
	public static function indexList($where,$field,$order,$limit,$page){
		try{
			$res = Sms::where($where)->field($field)->order($order)->paginate(['list_rows'=>$limit,'page'=>$page])->toArray();
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return ['rows'=>$res['data'],'total'=>$res['total']];
	}




}

