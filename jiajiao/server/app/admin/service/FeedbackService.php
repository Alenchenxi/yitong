<?php 
/*
 module:		意见反馈
 create_time:	2023-03-15 11:41:58
 author:		
 contact:		
*/

namespace app\admin\service;
use app\admin\model\Feedback;
use think\exception\ValidateException;
use xhadmin\CommonService;

class FeedbackService extends CommonService {


	/*
 	* @Description  列表数据
 	*/
	public static function indexList($where,$field,$order,$limit,$page){
		try{
			$res = Feedback::where($where)->field($field)->order($order)->paginate(['list_rows'=>$limit,'page'=>$page])->toArray();
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return ['rows'=>$res['data'],'total'=>$res['total']];
	}


	/*
 	* @Description  添加
 	*/
	public static function add($data){
		try{
			$data['create_time'] = strtotime($data['create_time']);
			$res = Feedback::create($data);
		}catch(ValidateException $e){
			throw new ValidateException ($e->getError());
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		if(!$res){
			throw new ValidateException ('操作失败');
		}
		return $res->feedback_id;
	}


	/*
 	* @Description  修改
 	*/
	public static function update($data){
		try{
			$data['create_time'] = strtotime($data['create_time']);
			$res = Feedback::update($data);
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

