<?php 
/*
 module:		教学经历
 create_time:	2024-05-07 11:14:29
 author:		
 contact:		
*/

namespace app\admin\service;
use app\admin\model\Experience;
use think\exception\ValidateException;
use xhadmin\CommonService;

class ExperienceService extends CommonService {


	/*
 	* @Description  列表数据
 	*/
	public static function indexList($where,$field,$order,$limit,$page){
		try{
			$res = Experience::where($where)->field($field)->order($order)->paginate(['list_rows'=>$limit,'page'=>$page])->toArray();
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return ['rows'=>$res['data'],'total'=>$res['total']];
	}




}

