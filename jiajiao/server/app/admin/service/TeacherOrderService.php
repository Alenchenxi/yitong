<?php 
/*
 module:		老师支付订单
 create_time:	2025-05-26 15:52:22
 author:		
 contact:		
*/

namespace app\admin\service;
use app\admin\model\TeacherOrder;
use think\exception\ValidateException;
use xhadmin\CommonService;

class TeacherOrderService extends CommonService {


	/*
 	* @Description  列表数据
 	*/
	public static function indexList($where,$field,$order,$limit,$page){
		try{
			$res = TeacherOrder::where($where)->field($field)->order($order)->paginate(['list_rows'=>$limit,'page'=>$page])->toArray();
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return ['rows'=>$res['data'],'total'=>$res['total']];
	}


	/*
 	* @Description  修改
 	*/
	public static function update($data){
		try{
			$data['create_time'] = strtotime($data['create_time']);
			$data['pay_time'] = strtotime($data['pay_time']);
			$res = TeacherOrder::update($data);
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

