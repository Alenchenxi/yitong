<?php 
/*
 module:		消息列表
 create_time:	2023-04-03 16:18:35
 author:		
 contact:		
*/

namespace app\admin\service;
use app\admin\model\Msg;
use think\exception\ValidateException;
use xhadmin\CommonService;

class MsgService extends CommonService {


	/*
 	* @Description  列表数据
 	*/
	public static function indexList($where,$field,$order,$limit,$page){
		try{
			$res = Msg::where($where)->field($field)->order($order)->paginate(['list_rows'=>$limit,'page'=>$page])->toArray();
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return ['rows'=>$res['data'],'total'=>$res['total']];
	}




}

