<?php 
/*
 module:		家长联系记录
 create_time:	2025-05-26 17:38:28
 author:		
 contact:		
*/

namespace app\admin\service;
use app\admin\model\ContactHistory;
use think\exception\ValidateException;
use xhadmin\CommonService;

class ContactHistoryService extends CommonService {


	/*
 	* @Description  列表数据
 	*/
	public static function indexList($where,$field,$order,$limit,$page){
		try{
			$res = ContactHistory::where($where)->field($field)->order($order)->paginate(['list_rows'=>$limit,'page'=>$page])->toArray();
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return ['rows'=>$res['data'],'total'=>$res['total']];
	}




}

