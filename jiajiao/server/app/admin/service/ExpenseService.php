<?php 
/*
 module:		消费记录
 create_time:	2021-04-08 15:27:06
 author:		
 contact:		
*/

namespace app\admin\service;
use app\admin\model\Expense;
use think\exception\ValidateException;
use xhadmin\CommonService;

class ExpenseService extends CommonService {


	/*
 	* @Description  列表数据
 	*/
	public static function indexList($where,$field,$order,$limit,$page){
		try{
			$res = Expense::where($where)->field($field)->order($order)->paginate(['list_rows'=>$limit,'page'=>$page])->toArray();
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return ['rows'=>$res['data'],'total'=>$res['total']];
	}




}

