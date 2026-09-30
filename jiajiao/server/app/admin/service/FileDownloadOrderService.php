<?php 
/*
 module:		文件下载支付订单
 create_time:	2023-03-17 10:48:45
 author:		
 contact:		
*/

namespace app\admin\service;
use app\admin\model\FileDownloadOrder;
use think\exception\ValidateException;
use xhadmin\CommonService;

class FileDownloadOrderService extends CommonService {


	/*
 	* @Description  列表数据
 	*/
	public static function indexList($where,$field,$order,$limit,$page){
		try{
			$res = FileDownloadOrder::where($where)->field($field)->order($order)->paginate(['list_rows'=>$limit,'page'=>$page])->toArray();
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return ['rows'=>$res['data'],'total'=>$res['total']];
	}




}

